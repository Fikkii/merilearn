// routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../db')
const axios = require('axios')

const authRoute = require('./auth')

const { checkPermission } = require('../middleware/checkPermission')

router.use('/', authRoute)

// Fetch all courses available
// This is the only unprotected route in the server since it will be used at the frontend
router.get('/courses', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT id, title, description, price
      FROM courses
      ORDER BY created_at DESC
    `).all();

    res.json(courses);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/modules', (req, res) => {
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
router.get('/enrollments', (req, res) => {
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

router.get('/verify/:reference', async (req, res) => {
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

