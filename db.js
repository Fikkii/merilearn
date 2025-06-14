/**
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_db_name'
});

const [rows] = await pool.query('SELECT * FROM users');
console.log(rows);
**/

const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

async function createGoogleAdmin() {
  try {
      const email = 'ajalafikayo@gmail.com';

      // Ensure roles exist
      await pool.query(`
    INSERT IGNORE INTO roles (role)
    VALUES ('student'), ('instructor'), ('admin')
  `);

      // Get role_id for admin
      const [roles] = await pool.query(`SELECT id FROM roles WHERE role = 'admin'`);

      if (roles.length === 0) {
          throw new Error('Admin role not found.');
      }

      const roleId = roles[0].id;

      // Check if user already exists
      const [existing] = await pool.query(`SELECT id FROM users WHERE email = ?`, [email]);
      if (existing.length > 0) {
          console.log('Admin already exists.');
          return;
      }

      // Insert new admin
      await pool.query(`
    INSERT INTO users (email, role_id, password, provider, created_at)
    VALUES (?, ?, NULL, 'google', NOW())
  `, [email, roleId]);

      console.log('Default Google Admin created')
  } catch (error) {
      console.error('Database error:', error.message);
  }
}

createGoogleAdmin();


module.exports = pool;

