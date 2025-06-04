// routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../db')
const axios = require('axios')

const authRoute = require('./auth')

const { checkPermission, authenticate } = require('../middleware/checkPermission')

router.use('/', authRoute)

// Fetch all courses available
// This is the only unprotected route in the server since it will be used at the frontend
router.get('/courses/details', (req, res) => {
  try {
    const modules = db.prepare(`
      SELECT *
      FROM modules
      ORDER BY created_at DESC
    `).all();

    const courses = db.prepare(`
      SELECT id, cover_img_url, title, description, price
      FROM courses
      ORDER BY created_at DESC
    `).all();

    const topicStmt = db.prepare(`
      SELECT *
      FROM topics WHERE id=?
      ORDER BY created_at DESC
    `);

      const modulesWithTopics = modules.map((value) => ({
          ...value,
         topics: topicStmt.all(value.id)
      }))


      const coursesWithModules = courses.map((value) => {
          const data = []
          modulesWithTopics.forEach(mod => {
              if(mod.id == value.id){
                  data.push({ ...value, modules: mod })
              }
          })
          return data
      })

    res.json(...coursesWithModules);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }

})

router.get('/courses', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT id, title, cover_img_url, description, price
      FROM courses
      ORDER BY created_at DESC
    `).all();

    res.json(courses);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/modules',(req, res) => {
  try {
    const modules = db.prepare(`
      SELECT m.id, m.title as module_title, c.title as course_title
      FROM modules m JOIN courses c ON c.id=m.course_id
    `).all();

    res.json(modules);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/topics', (req, res) => {
  try {
    const topics = db.prepare(`
      SELECT t.id, t.title as topic_title, t.content as topic_content, m.title as module_title, c.title as course_title
      FROM topics t JOIN modules m ON m.id=t.module_id JOIN courses c on c.id=m.course_id
    `).all();

    res.json(topics);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/students', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, s.fullname, u.email
      FROM users u JOIN student_profiles s on s.id=u.id
    `).all();

    res.json(users);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/enrollments',(req, res) => {
  try {
    const enrollments = db.prepare(`
      SELECT e.id, s.fullname as student_name, u.email as student_email
      FROM enrollments e join users u on u.id=e.student_id join courses c on c.id=e.course_id join student_profiles s on s.id=u.id
    `).all();

    res.json(enrollments);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/projects', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT id, title, instructions
      FROM projects
    `).all();

    res.json(projects);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//total courses
router.get('/total/courses', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT count(*) as total
      FROM courses
      ORDER BY created_at DESC
    `).all();

    res.json({ total_courses: courses[0].total });
  } catch (err) {
    console.error('Failed to fetch total courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//total modules
router.get('/total/modules', (req, res) => {
  try {
    const modules = db.prepare(`
      SELECT count(*) as total
      FROM modules
      ORDER BY created_at DESC
    `).all();

    res.json({ total_modules: modules[0].total });
  } catch (err) {
    console.error('Failed to fetch total modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//total users
router.get('/total/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT count(*) as total
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json({ total_users: users[0].total });
  } catch (err) {
    console.error('Failed to fetch total users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//total projects
router.get('/total/projects', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT count(*) as total
      FROM projects
      ORDER BY created_at DESC
    `).all();

    res.json({ total_projects: projects[0].total });
  } catch (err) {
    console.error('Failed to fetch total projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//total topics
router.get('/total/topics', (req, res) => {
  try {
    const topics = db.prepare(`
      SELECT count(*) as total
      FROM topics
      ORDER BY created_at DESC
    `).all();

    res.json({ total_topics: topics[0].total });
  } catch (err) {
    console.error('Failed to fetch total topics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//total enrollments
router.get('/total/enrollments', (req, res) => {
  try {
    const enrollments = db.prepare(`
      SELECT count(*) as total
      FROM enrollments
      ORDER BY created_at DESC
    `).all();

    res.json({ total_enrollments: enrollments[0].total });
  } catch (err) {
    console.error('Failed to fetch total enrollments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//total instructors
router.get('/total/instructors', (req, res) => {
  try {
    const instructors = db.prepare(`
      SELECT count(*) as total
      FROM instructors
      ORDER BY created_at DESC
    `).all();

    res.json({ total_instructors: instructors[0].total });
  } catch (err) {
    console.error('Failed to fetch total instructors:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//leaderboard courses
router.get('/leaderboard/courses', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT title, count(*) as total
      FROM courses c JOIN enrollments e ON e.course_id=c.id
      ORDER BY created_at DESC limit 3
    `).all();

    res.json({ courses });
  } catch (err) {
    console.error('Failed to fetch total courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

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

