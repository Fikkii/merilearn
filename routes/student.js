const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// Fetch HTML Email Template
const { getTemplate } = require('../utils/emailTemplates');

const checkEnrollment = require('../middleware/enroll');

// User onboarding...
router.post('/onboarding', async (req, res) => {
  const { fullname, phone, heardFrom, occupation } = req.body;

  if (!fullname || !phone || !heardFrom || !occupation) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // assuming you have user ID from auth middleware
    const userId = req.user.id;

    await pool.query(
      'INSERT INTO student_profiles (id, fullname, phone, heard_from, occupation) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE fullname=?, phone=?, heard_from=?, occupation=?',
      [userId, fullname, phone, heardFrom, occupation, fullname, phone, heardFrom, occupation]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

//user profile
router.get('/me', async (req, res) => {
  try {
        const sql = `
          SELECT u.id, s.fullname, u.email, s.phone, c.d_wlink as group_link, u.created_at
          FROM users u
          JOIN student_profiles s ON s.id = u.id
          LEFT JOIN enrollments e ON e.student_id = u.id
          LEFT JOIN courses c ON c.id = e.course_id
          WHERE u.id = ?
        `;

        const [rows] = await pool.query(sql, [req.user.id]);
        const student = rows[0];

        if (!student) {
          return res.status(404).json({ error: 'Student not found' });
        }

        res.json(student);
  } catch (err) {
    console.error('Error fetching student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/me', async (req, res) => {
  const { fullname, password, phone } = req.body;

  if (!fullname && !password) {
    return res.status(400).json({ error: 'At least one field (name or password) must be provided' });
  }

  try {
        const fields = [];
        const values = [];

        if (fullname) {
            fields.push('fullname = ?');
            values.push(fullname);
        }

        if (password) {
            fields.push('password = ?');
            values.push(password);
        }

        if (phone) {
            fields.push('phone = ?');
            values.push(phone);
        }

        values.push(req.user.id);

        const [result] = await pool.execute(
            `UPDATE student_profiles SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Profile not found or no changes made' });
        }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Error updating student profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//This route is used to handle durations used by users on the website
router.get('/duration-tracker', async (req, res) => {
  try {
    const userId = req.user.id // assumes you use authentication middleware

    const [rows] = await pool.execute(
      'SELECT durations FROM user_durations WHERE user_id = ?',
      [userId]
    )

    if (rows.length === 0) {
      return res.json({ durations: {} }) // no record yet, return empty object
    }

    const durations = JSON.parse(rows[0].durations)
    res.json({ durations })
  } catch (error) {
    console.error('Error fetching durations:', error)
    res.status(500).json({ error: 'Failed to fetch durations' })
  }
})

router.post('/duration-tracker', async (req, res) => {
  try {
    const userId = req.user.id // assumes you use authentication middleware
    const durations = req.body.durations

    if (!durations || typeof durations !== 'object') {
      return res.status(400).json({ error: 'Invalid durations payload' })
    }

    // Convert to JSON string to save
    const durationsJson = JSON.stringify(durations)

    // Store in a table, e.g., `user_durations`
    await pool.execute(`
      INSERT INTO user_durations (user_id, durations)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE durations = VALUES(durations)
    `, [userId, durationsJson])

    res.json({ success: true, message: 'Durations saved successfully' })
  } catch (error) {
    console.error('Error saving durations:', error)
    res.status(500).json({ error: 'Failed to save durations' })
  }
})

//user metrics
router.get('/metrics', async (req, res) => {
  try {
    // Fetch enrolled course (assuming only one course, else use query)
    const enrolledSql = `
      SELECT c.title
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.student_id = ?
      LIMIT 1
    `;
    const [enrolledRows] = await pool.query(enrolledSql, [req.user.id]);
    const enrolled = enrolledRows[0];

      const completedTopicSql = `
      SELECT COUNT(tc.id) as completed, ( SELECT count(*) FROM topics t JOIN modules m ON m.id = t.module_id WHERE m.course_id = tc.course_id ) as total from topic_completion tc
      WHERE tc.student_id = ?
      `;

    const [completionRows] = await pool.query(completedTopicSql, [req.user.id]);
      console.log(completionRows[0].completed)

    const evaluationSql = `
      SELECT ROUND(AVG(score), 1) AS average_score, COUNT(*) AS total_evaluation
      FROM evaluations
      WHERE student_id = ?
    `;
    const [evaluationRows] = await pool.query(evaluationSql, [req.user.id]);
    const metric = evaluationRows[0];

    if (!metric) {
      return res.status(404).json({ error: 'Student not found' });
    }

    metric.course = enrolled ? enrolled.title : null;
    metric.total_topic_completed =  `${completionRows[0].completed} / ${completionRows[0].total}`

    res.json(metric);
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ENROLLMENTS ---
router.post('/enrollment', async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    // Fetch user info
    const userSql = `
      SELECT p.fullname AS fullname, u.email AS email
      FROM student_profiles p
      JOIN users u ON u.id = p.id
      WHERE u.id = ?
    `;
    const [userRows] = await pool.query(userSql, [req.user.id]);
    const user = userRows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if already enrolled in a course
    const enrollmentCheckSql = 'SELECT course_id FROM enrollments WHERE student_id = ? LIMIT 1';
    const [enrollments] = await pool.query(enrollmentCheckSql, [req.user.id]);
    if (enrollments.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in a course' });
    }

    // Insert new enrollment
    const insertSql = 'INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)';
    await pool.query(insertSql, [req.user.id, courseId]);

    // Prepare and send email
    const html = getTemplate('enroll-welcome');

    req.mailer.sendMail({
      from: `"MerilLearn Course Enrollment Successful" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Congratulations on Enrolling, We are pleased to have you...',
      html,
    }).catch(err => {
      console.error('Mailer error:', err);
    });

    res.json({ message: 'Enrollment successful' });
  } catch (err) {
    console.error('Error in enrollment POST:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/enrollment', async (req, res) => {
  try {
    const deleteSql = 'DELETE FROM enrollments WHERE student_id = ?';
    const [result] = await pool.query(deleteSql, [req.user.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({ message: 'Enrollment deleted successfully' });
  } catch (err) {
    console.error('Error deleting enrollment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.use(checkEnrollment);

//current course leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    // Fetch user average score based on evaluation
      const evaluationSql = `
    SELECT
      s.fullname,
      u.email,
      c.title AS course_title,
      ROUND(AVG(e.score), 1) AS average_score
    FROM evaluations e
    INNER JOIN student_profiles s ON s.id = e.student_id
    INNER JOIN users u ON u.id = e.student_id
    INNER JOIN courses c ON c.id = e.course_id
    WHERE e.course_id = ?
    GROUP BY e.student_id
    ORDER BY average_score DESC
    LIMIT 5
  `;

      const [metric] = await pool.query(evaluationSql, [req.user.course_id]);

      if (!metric) {
          return res.status(404).json({ error: 'Student not found' });
      }

      res.json(metric);
  } catch (err) {
      console.error('Error fetching metrics:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/course', async (req, res) => {
    try {
        // Get modules for the course
        const modulesSql = `
        SELECT id, title, active
        FROM modules
        WHERE course_id = ?
            `;
        const [modules] = await pool.query(modulesSql, [req.user.course_id]);

        // For each module, get topics
        const topicSql = `
      SELECT t.id, t.module_id, t.title, t.content,
        EXISTS (
SELECT 1
    FROM topic_completion tc
      WHERE tc.topic_id = t.id
        ) AS is_completed
      FROM topics t
      WHERE module_id = ?
    `;

        // Use Promise.all to parallelize topic queries
        const modulesWithTopics = await Promise.all(
            modules.map(async (mod) => {
                const [topics] = await pool.query(topicSql, [mod.id]);
                return { ...mod, topics };
            })
        );

        console.log(req.user.course_id)

        res.json({
            course: {
                id: req.user.course_id,
                modules: modulesWithTopics,
            },
        });
    } catch (err) {
        console.error('Error fetching enrolled course:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//fetch topic based on params
router.get('/topic', async (req, res) => {
    const topicId = req.query.topicId;

    if (!topicId) {
        return res.status(400).json({ error: 'Missing topicId in query.' });
    }

    try {
        const sql = `
      SELECT
        t.id,
        t.title,
        t.content,
        t.recommended_video AS video,
        m.course_id,
        EXISTS (
SELECT 1
    FROM topic_completion tc
      WHERE tc.course_id = m.course_id AND tc.topic_id = t.id
        ) AS is_completed,
        m.title AS module_title
      FROM topics t
      JOIN modules m ON t.module_id = m.id
      WHERE t.id = ?
    `;
        const [rows] = await pool.query(sql, [topicId]);
        const topic = rows[0];

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        if (topic.course_id !== req.user.course_id) {
            return res.status(403).json({ error: 'Access denied to this topic.' });
        }

        res.json({ topic });
    } catch (err) {
        console.error('Error fetching topic:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//fetch project based on params
router.get('/project', async (req, res) => {
    const projectId = req.query.projectId;

    if (!projectId) {
        return res.status(400).json({ error: 'Missing projectId in query.' });
    }

    try {
        // Fetch project with module details
        const projectSql = `
      SELECT p.id, p.title, p.instructions, p.project_hint, p.rubric, m.id AS module_id
      FROM projects p
      JOIN modules m ON m.id = p.module_id
      WHERE p.id = ?
    `;
        const [projectRows] = await pool.query(projectSql, [projectId]);
        const project = projectRows[0];

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Fetch evaluation if exists
        const evalSql = `
      SELECT * FROM evaluations
      WHERE project_id = ? AND student_id = ?
    `;
        const [evalRows] = await pool.query(evalSql, [projectId, req.user.id]);
        const evaluation = evalRows[0];

        if (evaluation && evaluation.feedback) {
            try {
                evaluation.feedback = JSON.parse(evaluation.feedback);
            } catch (e) {
                console.warn('Failed to parse evaluation feedback JSON:', e);
                evaluation.feedback = null;
            }
        }

        project.evaluation = evaluation || null;

        res.json({ project });
    } catch (err) {
        console.error('Error fetching project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//mark topic as complete
router.post('/topic/complete', async (req, res) => {
    const { topicId } = req.body;

    if (!topicId) {
        return res.status(400).json({ error: 'topicId is Required...' });
    }

    try {

        // Update topic as completed
        const updateSql = `
      INSERT INTO topic_completion(student_id,course_id, topic_id)
      VALUES(?,?,?)
    `;
        const [updateResult] = await pool.query(updateSql, [req.user.id, req.user.course_id,topicId]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Topic update failed' });
        }

        res.json({ message: 'Topic marked as complete' });
    } catch (err) {
        console.error('Error updating topic completion:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//project-scores
router.get('/project-scores', async (req, res) => {
    try {
        const sql = `
      SELECT
        ps.score,
        ps.feedback
      FROM project_scores ps
      WHERE ps.student_id = ?
    `;
        const [scores] = await pool.query(sql, [req.user.id]);

        if (scores.length === 0) {
            return res.status(404).json({ message: 'No project scores found for this student.' });
        }

        res.json({ scores });
    } catch (err) {
        console.error('Error fetching project scores:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/project-scores', async (req, res) => {
    const { project_id, score, feedback } = req.body;

    if (!project_id || score == null) {
        return res.status(400).json({ error: 'project_id and score are required' });
    }

    try {
        // Check if record already exists (avoid duplicates)
        const checkSql = `
      SELECT * FROM project_scores
      WHERE student_id = ? AND project_id = ?
    `;
        const [existingRows] = await pool.query(checkSql, [req.user.id, project_id]);

        if (existingRows.length > 0) {
            return res.status(409).json({ error: 'Project score for this project already exists' });
        }

        // Insert new project score
        // Generate a new id if your id column requires a UUID or auto-increment? Adjust accordingly
        const id = randomUUID();

        const insertSql = `
      INSERT INTO project_scores (id, student_id, project_id, score, feedback)
      VALUES (?, ?, ?, ?, ?)
    `;
        await pool.query(insertSql, [id, req.user.id, project_id, score, feedback || null]);

        res.status(201).json({ message: 'Project score created successfully' });
    } catch (err) {
        console.error('Error creating project score:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/projects', async (req, res) => {
    try {
        const sql = `
      SELECT
        m.title AS module_title,
        p.title AS project_title,
        p.instructions
      FROM modules m
      JOIN projects p ON p.id = m.project_id
      WHERE m.course_id = ?
    `;
        const [projects] = await pool.query(sql, [req.user.course_id]);

        res.json({ projects });
    } catch (err) {
        console.error('Error fetching projects for student:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//User leave peer group...
router.delete('/', async (req, res) => {
    const conn = await pool.getConnection();

    try {
        // Step 1: Get users belonging to same learning track but not yet in any group
        const [peerMember] = await conn.execute(`
      SELECT group_id
        FROM peer_group_members WHERE user_id = ?
    `, [req.user.id]);

        if (!peerMember.length) {
            return res.status(200).json({ message: 'unable to find user' });
        }

        await conn.execute(`
      DELETE FROM peer_groups WHERE id= ?
    `, [peerMember[0].group_id]);

        await conn.commit();
        res.status(201).json({ message: 'Group was deleted successfully'});

    } catch (err) {
        await conn.rollback();
        console.error('Error deleting user group:', err);
        res.status(500).json({ message: 'Error deleting group', err });
    } finally {
        conn.release();
    }
});


module.exports = router;
