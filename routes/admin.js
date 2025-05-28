// routes/auth.js
require('dotenv').config()
const express = require('express');
const db = require('../db');
const axios = require('axios');
const router = express.Router();
const { randomUUID } = require('crypto');

//importing and mounting my nodemailer middleware
const mailer = require('../middleware/mailer')
router.use(mailer)

// Create a topic
router.post('/topics', (req, res) => {
  const { moduleId, title, content, order } = req.body;
  if (!moduleId || !title || !content ) {
    return res.status(400).json({ error: 'moduleId, title, and content are required' });
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO topics (id, module_id, title, content)
    VALUES (?, ?, ?, ?)
  `).run(id, moduleId, title, content);

  res.status(201).json({ message: 'Topic created', topicId: id });
});

//Delete a Topic
router.delete('/topics/:id', (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id is required' });

  db.prepare('DELETE FROM topics WHERE id=?')
    .run(id);

  res.status(201).json({ message: 'Topic Deleted Successfully', courseId: id });
});

// Create a course
router.post('/courses', (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const id = randomUUID();
  db.prepare('INSERT INTO courses (id, title, description) VALUES (?, ?, ?)')
    .run(id, title, description || null);

  res.status(201).json({ message: 'Course created', courseId: id });
});

//Delete a course
router.delete('/courses/:id', (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id is required' });

  db.prepare('DELETE FROM courses WHERE id=?')
    .run(id);

  res.status(201).json({ message: 'Course Deleted Successfully', courseId: id });
});

// Create a module
router.post('/modules', (req, res) => {
  const { courseId, title, order } = req.body;
  if (!courseId || !title ) {
    return res.status(400).json({ error: 'courseId, title, order, required' });
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO modules (id, course_id, title, "order")
    VALUES (?, ?, ?, ?)
  `).run(id, courseId, title, order );

  res.status(201).json({ message: 'Module created', moduleId: id });
});

// Delete a module
router.delete('/modules/:id', (req, res) => {
  const { id } = req.params;
  if ( !id ) {
    return res.status(400).json({ error: 'Invalid Parameter, missing Id ' });
  }

  db.prepare(`
    DELETE FROM modules WHERE id=?
  `).run(id);

  res.status(201).json({ message: 'Module deleted', moduleId: id });
});

//Edit Module
router.put('/modules/:id', (req, res) => {
  const { courseId, title, order, id } = req.body;

  // At least one field should be present
  if (!courseId || !title || !id ) {
    return res.status(400).json({ error: 'id, courseId, title, is required' });
  }

  try {
    // Build update query dynamically
    const fields = [];
    const values = [];

    if (courseId) {
      fields.push('course_id = ?');
      values.push(course_id);
    }

    if (title) {
      fields.push('title = ?');
      values.push(title);
    }

    if (order) {
      fields.push('order = ?');
      values.push(order);
    }

    values.push(req.user.id); // for WHERE clause

    const stmt = db.prepare(`
      UPDATE students
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Module not found or no changes made' });
    }

    res.json({ message: 'Module updated successfully' });
  } catch (err) {
    console.error('Error updating student profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
  if ( !id ) {
    return res.status(400).json({ error: 'Invalid Parameter, missing Id ' });
  }
});

//create a project
router.post('/projects', (req, res) => {
  const { title, instructions } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'module_id and title are required' });
  }

  try {
    const id = randomUUID();

    db.prepare(`
      INSERT INTO projects (id, title, instructions)
      VALUES (?, ?, ?)
    `).run(id, title, instructions || null);

    res.status(201).json({ message: 'Project created successfully', id });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a module
router.delete('/projects/:id', (req, res) => {
  const { id } = req.params;

  if ( !id ) {
    return res.status(400).json({ error: 'Invalid Parameter, missing Id ' });
  }

  db.prepare(`
    DELETE FROM projects WHERE id=?
  `).run(id);

  res.status(201).json({ message: 'Project deleted', moduleId: id });
});

// Fetch student modules
router.get('/student/modules', (req, res) => {
    router.use(checkEnrollment);
  try {

    // Fetch modules belonging to that course, ordered by their order
    const modules = db.prepare(`
      SELECT id, title, "order"
      FROM modules
      WHERE course_id = ?
      ORDER BY "order"
    `).all(req.user.course_id);

    res.json({ modules });
  } catch (err) {
    console.error('Error fetching modules for student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all paystack Transactions
router.get('/transactions', async (req, res) => {
  try {
    const response = await axios.get('https://api.paystack.co/transaction', {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Only return the array of transactions
    res.status(200).json(response.data.data);
  } catch (error) {
    console.error('Paystack error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.response?.data || error.message
    });
  }
});

// GET all paystack Transactions
router.get('/transaction/:id', async (req, res) => {
    const { id } = req.params
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Only return the array of transactions
    res.status(200).json(response.data.data);
  } catch (error) {
    console.error('Paystack error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.response?.data || error.message
    });
  }
});

// GET my paystack Account balance
router.get('/transactions/balance', async (req, res) => {
  try {
    const response = await axios.get('https://api.paystack.co/balance', {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Only return the array of transactions
    console.log(response.data.data)
    res.status(200).json(response.data.data);
  } catch (error) {
    console.error('Paystack error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.response?.data || error.message
    });
  }
});

// send Mail
router.post('/mail', async (req, res) => {
    const { header, subject, message, recipients } = req.body;

      if (!subject || !header || !message || !Array.isArray(recipients)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }


      try {
        const info = await req.mailer.sendMail({
          from: `"${header}" <${process.env.SMTP_USER}>`,
          to: recipients.join(','),
          subject,
          html: message
        });

    return res.status(200).json({ message: 'Email sent', info });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: 'Email sending failed' });
  }});

module.exports = router;


