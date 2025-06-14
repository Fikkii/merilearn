// routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const pool = require('../db')
const axios = require('axios')

const authRoute = require('./auth')
const peerGroups = require('./peerGroup')
const gradeRoute = require('./grade')

router.use('/', authRoute)
router.use('/peer', peerGroups)
router.use('/grade', gradeRoute)

// Fetch all courses available
// This is the only unprotected route in the server since it will be used at the frontend
router.get('/courses/details', async (req, res) => {
  try {
    // Fetch all modules
    const [modules] = await pool.execute(`
      SELECT * FROM modules ORDER BY created_at DESC
    `);

    // Fetch all courses
    const [courses] = await pool.execute(`
      SELECT id, cover_img_url, title, description, price
      FROM courses ORDER BY created_at DESC
    `);

    // Fetch all topics
    const [topics] = await pool.execute(`
      SELECT * FROM topics ORDER BY created_at DESC
    `);

    // Map topics to modules
    const modulesWithTopics = modules.map(mod => ({
      ...mod,
      topics: topics.filter(t => t.module_id === mod.id) // assuming `topics.module_id` exists
    }));

    // Map modules to courses
    const coursesWithModules = courses.map(course => ({
      ...course,
      modules: modulesWithTopics.filter(mod => mod.course_id === course.id)
    }));

    res.json(coursesWithModules);
  } catch (err) {
    console.error('Failed to fetch courses with details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const [courses] = await pool.execute(`
      SELECT id, title, cover_img_url, description, price
      FROM courses ORDER BY created_at DESC
    `);

    res.json(courses);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch Courses based on ID
router.get('/courses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(`
      SELECT id, title, cover_img_url, description, price
      FROM courses WHERE id = ?
    `, [id]);

    const course = rows[0];

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (err) {
    console.error('Failed to fetch course:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch Modules based on ID
router.get('/modules/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(`
      SELECT m.id, m.title, c.title AS course_title, c.id AS courseId, c.active AS active
      FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = ?
    `, [id]);

    const module = rows[0];

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json(module);
  } catch (err) {
    console.error('Failed to fetch module:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch Modules
router.get('/modules', async (req, res) => {
  try {
    const [modules] = await pool.execute(`
      SELECT m.id, m.title, c.title AS course_title, m.active AS status
      FROM modules m
      JOIN courses c ON c.id = m.course_id
    `);

    res.json(modules);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch all Topics
router.get('/topics', async (req, res) => {
  try {
    const [topics] = await pool.execute(`
      SELECT
        t.id,
        t.title AS topic_title,
        t.content AS topic_content,
        t.recommended_video AS yVideoLink,
        m.title AS module_title,
        c.title AS course_title
      FROM topics t
      JOIN modules m ON m.id = t.module_id
      JOIN courses c ON c.id = m.course_id
    `);

    res.json(topics);
  } catch (err) {
    console.error('Failed to fetch topics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch single topic
router.get('/topics/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(`
      SELECT
        t.id,
        t.title AS title,
        t.content AS topic_content,
        t.recommended_video AS recommended_video,
        m.title AS module_title,
        c.title AS course_title,
        m.id AS moduleId
      FROM topics t
      JOIN modules m ON m.id = t.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE t.id = ?
    `, [id]);

    res.json(rows[0] || {});
  } catch (err) {
    console.error('Failed to fetch topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/students', async (req, res) => {
  try {
    const [users] = await pool.execute(`
      SELECT u.id, s.fullname, u.email
      FROM users u
      JOIN student_profiles s ON s.id = u.id
    `);

    res.json(users);
  } catch (err) {
    console.error('Failed to fetch students:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/enrollments', async (req, res) => {
  try {
    const [enrollments] = await pool.execute(`
      SELECT
        e.id,
        s.fullname AS student_name,
        u.email AS student_email
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      JOIN courses c ON c.id = e.course_id
      JOIN student_profiles s ON s.id = u.id
    `);

    res.json(enrollments);
  } catch (err) {
    console.error('Failed to fetch enrollments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all projects
router.get('/projects', async (req, res) => {
  try {
    const [projects] = await pool.execute(`
      SELECT p.id, p.title, p.instructions, p.rubric, m.id AS module_id
      FROM projects p
      JOIN modules m ON m.id = p.module_id
    `);
    res.json(projects);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch single project
router.get('/projects/:id', async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  try {
    const [projectRows] = await pool.execute(`
      SELECT p.id, p.title, p.instructions, m.id AS moduleId, p.rubric
      FROM projects p
      JOIN modules m ON m.id = p.module_id
      WHERE p.id = ?
    `, [id]);

    const project = projectRows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    let evaluation = null;

    if (studentId) {
      const [evalRows] = await pool.execute(`
        SELECT * FROM evaluations
        WHERE project_id = ? AND student_id = ?
      `, [id, studentId]);

      if (evalRows.length) {
        try {
          evalRows[0].feedback = JSON.parse(evalRows[0].feedback);
        } catch (e) {
          evalRows[0].feedback = [];
        }
        evaluation = evalRows[0];
      }
    }

    res.json({ ...project, evaluation });
  } catch (err) {
    console.error('Failed to fetch project:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total courses
router.get('/total/courses', async (req, res) => {
  try {
    const [result] = await pool.execute(`
      SELECT COUNT(*) AS total FROM courses
    `);
    res.json({ total_courses: result[0].total });
  } catch (err) {
    console.error('Failed to fetch total courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total modules
router.get('/total/modules', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS total FROM modules
    `);
    res.json({ total_modules: rows[0].total });
  } catch (err) {
    console.error('Failed to fetch total modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total users
router.get('/total/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS total FROM users
    `);
    res.json({ total_users: rows[0].total });
  } catch (err) {
    console.error('Failed to fetch total users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total projects
router.get('/total/projects', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS total FROM projects
    `);
    res.json({ total_projects: rows[0].total });
  } catch (err) {
    console.error('Failed to fetch total projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total topics
router.get('/total/topics', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS total FROM topics
    `);
    res.json({ total_topics: rows[0].total });
  } catch (err) {
    console.error('Failed to fetch total topics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total enrollments
router.get('/total/enrollments', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS total FROM enrollments
    `);
    res.json({ total_enrollments: rows[0].total });
  } catch (err) {
    console.error('Failed to fetch total enrollments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total instructors
router.get('/total/instructors', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS total FROM instructor_profiles
    `);
    res.json({ total_instructors: rows[0].total });
  } catch (err) {
    console.error('Failed to fetch total instructors:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//leaderboard courses
router.get('/leaderboard/courses', async (req, res) => {
  try {
    const [courses] = await pool.execute(`
      SELECT c.title, COUNT(*) AS total
      FROM courses c
      JOIN enrollments e ON e.course_id = c.id
      GROUP BY c.id
      ORDER BY total DESC
      LIMIT 3
    `);

    res.json({ courses });
  } catch (err) {
    console.error('Failed to fetch leaderboard courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all notifications
router.get('/notifications', async (req, res) => {
  try {
    const [notifications] = await pool.execute(`
      SELECT * FROM notification ORDER BY createdat DESC
    `);
    res.json(notifications);
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single notification
router.get('/notifications/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT * FROM notification WHERE id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to fetch notification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a notification
router.post('/notifications', async (req, res) => {
  const { title } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO notification (title) VALUES (?)',
      [title]
    );

    const [rows] = await pool.execute(
      'SELECT * FROM notification WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create notification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a notification
router.put('/notifications/:id', async (req, res) => {
  const { title } = req.body;

  try {
    const [result] = await pool.execute(
      'UPDATE notification SET title = ? WHERE id = ?',
      [title, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM notification WHERE id = ?',
      [req.params.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update notification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a notification
router.delete('/notifications/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM notification WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete notification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Paystack Reference checker
router.get('/verify/:reference',async (req, res) => {
    const reference = req.params.reference

    try {
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        )

        // Check if payment was successful
        if (response.data.data.status === 'success') {
            return res.status(200).json({ status: 'success', data: response.data.data })
        } else {
            return res.status(404).json({ status: 'failed', data: response.data.data })
        }
    } catch (error) {
        console.error('Verification error:', error.message)
        return res.status(500).json({ status: 'error', message: 'Verification failed' })
    }
})

module.exports = router;

