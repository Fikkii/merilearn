// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const crypto = require('crypto')
const router = express.Router();

const authenticate = require('../middleware/auth');

// Fetch HTML Email Template
const { getTemplate } = require('../utils/emailTemplates');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

//importing and mounting my nodemailer middleware
const mailer = require('../middleware/mailer')
router.use(mailer)

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  const { email, name, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  const user = db.prepare('SELECT * FROM students WHERE email = ?').get(email);

    if(user){
        res.status(403).json({ error: 'username exists...' })
    }

  try {
    const stmt = db.prepare('INSERT INTO students (name, email, password) VALUES (?, ?, ?)');
    const info = stmt.run(name, email, hashed);
    const token = jwt.sign({ id: info.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
      console.log(err)
    res.status(400).json({ error: "Internal Server error, please try later..."});
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare(`SELECT * FROM students WHERE email = ?`).get(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, 'user': { id: user.id, email: user.email, role: user.role } });
});

// POST /api/auth/forgot-password
router.post('/auth/forgot-password', (req, res) => {
  const { email } = req.body;

  const student = db.prepare("SELECT * FROM students WHERE email = ?").get(email);
  if (!student) return res.status(404).json({ message: 'Student email not found' });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000; // 1 hour


  db.prepare(`
    UPDATE students SET resetToken = ?, resetTokenExpires = ? WHERE email = ?
  `).run(token, expires, email);

  const resetLink = `${process.env.FRONTEND_PASSWORD_RESET_URL}/${token}`;

  const template = getTemplate('reset-password')
  const html = template.replace('{{resetLink}}', resetLink)

  req.mailer.sendMail({
    from: `"MerilLearn Auth" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Reset Your Password',
    html
  }).then((info) => {
    res.json({ message: 'Reset link sent to student email.', info });
  }).catch(err => {
    console.error(err);
    res.status(500).json({ message: 'Failed to send email.' });
  });
});

//To complete password reset
router.post('/auth/reset-password', async (req, res) => {
  const { password, token } = req.body;

  const student = db.prepare(`
    SELECT * FROM students WHERE resetToken = ? AND resetTokenExpires > ?
  `).get(token, Date.now());

  if (!student) return res.status(400).json({ message: 'Invalid or expired token' });

  const hashedPassword = await bcrypt.hash(password, 12);

  db.prepare(`
    UPDATE students SET password = ?, resetToken = NULL, resetTokenExpires = NULL WHERE id = ?
  `).run(hashedPassword, student.id);

  res.json({ message: 'Student password has been successfully reset.' });
});

// Checking if user is authenticated for the following routes...
const todosRoutes = require('./todos');
const chatRoute = require('./chat');
const ebookRoutes = require('./ebook');
const quizRoutes = require('./quiz.js');
const studentRoutes = require('./student.js');
const projectRoutes = require('./project.js');
const adminRoutes = require('./admin.js');

// Protect all routes
router.use(authenticate);
router.use('/todos', todosRoutes);
router.use('/chat', chatRoute);
router.use('/ebooks', ebookRoutes);
router.use('/student', studentRoutes);
router.use('/quiz', quizRoutes);
router.use('/project', projectRoutes);
router.use('/admin', adminRoutes);


module.exports = router;


