// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const crypto = require('crypto')
const router = express.Router();

const { authenticate, googleVerification } = require('../middleware/auth');

// Fetch HTML Email Template
const { getTemplate } = require('../utils/emailTemplates');

const JWT_SECRET = process.env.JWT_SECRET;

//importing and mounting my nodemailer middleware
const mailer = require('../middleware/mailer')
router.use(mailer)

// Main route
router.post('/auth/google', googleVerification, async (req, res) => {
  const google = req.google;

  try {
    // Check if user exists
    const [users] = await pool.execute(`
      SELECT u.id as id, u.email as email, r.role as role, u.password as password
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.email = ?
    `, [google.email]);

    let user = users[0];

    // If user does not exist, create one
    if (!user) {
      const [roles] = await pool.execute(`
        SELECT id FROM roles WHERE role = ?
      `, ['student']);

      const role_id = roles[0].id;

      // Insert user
      const [insertResult] = await pool.execute(`
        INSERT INTO users (email, role_id, provider) VALUES (?, ?, ?)
      `, [google.email, role_id, 'google']);

      const newUserId = insertResult.insertId;

      await pool.execute(`
        INSERT INTO student_profiles (id, fullname) VALUES (?, ?)
      `, [newUserId, google.name]);

      const token = jwt.sign(
        { id: newUserId, email: google.email, role: 'student' },
        JWT_SECRET
      );

      return res.json({
        token,
        user: { id: newUserId, email: google.email, role: 'student' }
      });
    }

    // If user exists
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(403).json({ error: 'Username exists...' });
    }

    // Get student role ID
    const [roles] = await pool.execute(
      'SELECT * FROM roles WHERE role = ?',
      ['student']
    );
    const role_id = roles[0].id;

    // Insert user into database
    const [insertResult] = await pool.execute(
      'INSERT INTO users (email, role_id, password) VALUES (?, ?, ?)',
      [email, role_id, hashed]
    );

    const newUserId = insertResult.insertId;

    // Insert student profile
    await pool.execute(
      'INSERT INTO student_profiles (id) VALUES (?)',
      [newUserId]
    );

    const token = jwt.sign(
      { id: newUserId, email, role: roles[0].role },
      JWT_SECRET
    );

    // Send welcome mail
    const template = getTemplate('signup-welcome');
    const html = template.replace('{{resetLink}}', '#'); // You may want to define resetLink

    req.mailer.sendMail({
      from: `"Welcome to MeriLearn" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Account creation successful. Thus, the journey begins!',
      html
    }).catch(err => console.error('Mail error:', err));

    res.json({ token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(400).json({ error: 'Internal server error, please try again later.' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT u.id as id, u.email as email, r.role as role, u.password as password
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?`,
      [email]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const student = users[0];
    if (!student) {
      return res.status(404).json({ message: 'Student email not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour

    await pool.execute(
      'UPDATE users SET resetToken = ?, resetTokenExpires = ? WHERE email = ?',
      [token, expires, email]
    );

    const resetLink = `${process.env.FRONTEND_PASSWORD_RESET_URL}/${token}`;
    const template = getTemplate('reset-password');
    const html = template.replace('{{resetLink}}', resetLink);

    req.mailer.sendMail({
      from: `"MeriLearn Auth" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Password',
      html
    }).then((info) => {
      res.json({ message: 'Reset link sent to student email.', info });
    }).catch(err => {
      console.error('Email sending failed:', err);
      res.status(500).json({ message: 'Failed to send email.' });
    });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//To complete password reset
router.post('/auth/reset-password', async (req, res) => {
  const { password, token } = req.body;

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE resetToken = ? AND resetTokenExpires > ?',
      [token, Date.now()]
    );

    const student = users[0];
    if (!student) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.execute(
      'UPDATE users SET password = ?, resetToken = NULL, resetTokenExpires = NULL WHERE id = ?',
      [hashedPassword, student.id]
    );

    res.json({ message: 'Student password has been successfully reset.' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//This route is used to for the chat section in the Frontend App powered by Gemini
const chatRoute = require('./chat');
router.use('/chat', chatRoute);

// Checking if user is authenticated for the following routes...
const todosRoutes = require('./todos');
const ebookRoutes = require('./ebook');
const studentRoutes = require('./student.js');
const projectRoutes = require('./project.js');
const adminRoutes = require('./admin.js');

// Protect all routes
router.use(authenticate);
router.use('/todos', todosRoutes);
router.use('/ebooks', ebookRoutes);
router.use('/student', studentRoutes);
router.use('/project', projectRoutes);
router.use('/admin', adminRoutes);


module.exports = router;


