// middlewares/mailerMiddleware.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT == '465', // true if using 465 (SSL)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // use only for dev/debug
  },
  connectionTimeout: 10000, // 10 seconds
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Failed:', error);
  } else {
    console.log('✅ SMTP Ready to Send Emails');
  }
});

const mailerMiddleware = (req, res, next) => {
  req.mailer = transporter;
  next();
};

module.exports = mailerMiddleware;

