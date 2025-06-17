const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// Fetch HTML Email Template
const { getTemplate } = require('../utils/emailTemplates');

const checkEnrollment = require('../middleware/enroll');

//user profile
router.get('/me', async (req, res) => {
  try {
        const sql = `
          SELECT u.id, s.fullname, u.email, u.created_at
          FROM users u
          JOIN student_profiles s ON s.id = u.id
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
  const { fullname, password } = req.body;

  if (!fullname && !password) {
    return res.status(400).json({ error: 'At least one field (name or password) must be provided' });
  }

  try {
    const values = [];
    let updateProfileSql = '';
    let profileParams = [];

    // Update password if provided
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      const updatePasswordSql = 'UPDATE users SET password = ? WHERE id = ?';
      await pool.query(updatePasswordSql, [hashed, req.user.id]);
    }

    // Update fullname if provided
    if (fullname) {
      updateProfileSql = 'UPDATE student_profiles SET fullname = ? WHERE id = ?';
      profileParams = [fullname, req.user.id];

      const [result] = await pool.query(updateProfileSql, profileParams);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Student not found or no changes made' });
      }
    }

    // If only password was updated, still send success
    if (!fullname) {
      return res.json({ message: 'Profile updated successfully' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Error updating student profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    // Fetch user average score based on evaluation
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

router.get('/course', async (req, res) => {
  try {
    // Get modules for the course
    const modulesSql = `
      SELECT id, title, active
      FROM modules
      WHERE course_id = ?
    `;
    const [modules] = await pool.query(modulesSql, [req.user.course_id]);
      console.log(req.user.course_id)

    // For each module, get topics
    const topicSql = `
      SELECT id, module_id, title, content
      FROM topics
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
      SELECT p.id, p.title, p.instructions, p.rubric, m.id AS module_id
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
router.put('/topic/complete', async (req, res) => {
  const { topicId } = req.body;

  if (!topicId) {
    return res.status(400).json({ error: 'topicId is Required...' });
  }

  try {
    // First, verify topic belongs to user's course
    const checkSql = `
      SELECT t.course_id
      FROM topics t
      WHERE t.id = ?
    `;
    const [checkRows] = await pool.query(checkSql, [topicId]);
    const topic = checkRows[0];

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    if (topic.course_id !== req.user.course_id) {
      return res.status(403).json({ error: 'Access denied to this topic.' });
    }

    // Update topic as completed
    const updateSql = `
      UPDATE topics
      SET completed = 1
      WHERE id = ?
    `;
    const [updateResult] = await pool.query(updateSql, [topicId]);

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

module.exports = router;
