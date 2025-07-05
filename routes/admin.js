// routes/auth.js
require('dotenv').config()
const express = require('express');
const pool = require('../db')
const axios = require('axios');
const fs = require('fs')
const path = require('path')

const {checkPermission} = require('../middleware/checkPermission');

//Middleware to upload file
const { useUploader } = require('../middleware/upload.js');

// Fetch HTML Email Template
const { getTemplate } = require('../utils/emailTemplates');

const router = express.Router();

// Create a topic
router.post('/topics', async (req, res) => {
    const { title, moduleId, recommended_video, content } = req.body;

    if (!title || !moduleId || !content || !recommended_video) {
        return res.status(400).json({ error: 'module_id, recommended_video, content and title are required' });
    }

    try {
        const [result] = await pool.execute(
            `INSERT INTO topics (title, recommended_video, content, module_id) VALUES (?, ?, ?, ?)`,
            [title, recommended_video || null, content, moduleId]
        );

        res.status(201).json({ message: 'Topic created successfully', id: result.insertId });
    } catch (err) {
        console.error('Error creating project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a Topic (MySQL version)
router.delete('/topics/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
        const [result] = await pool.execute(`DELETE FROM topics WHERE id = ?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        res.status(201).json({ message: 'Topic Deleted Successfully', courseId: id });
    } catch (err) {
        console.error('Error deleting topic:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Edit a Topic
router.put('/topics/:id', async (req, res) => {
    const { id } = req.params;
    const { title, moduleId, content, recommended_video } = req.body;

    if (!title || !moduleId || !content) {
        return res.status(400).json({ error: 'module_id, content and title are required' });
    }

    try {
        const fields = [];
        const values = [];

        if (title) {
            fields.push('title = ?');
            values.push(title);
        }

        if (content) {
            fields.push('content = ?');
            values.push(content);
        }

        if (recommended_video) {
            fields.push('recommended_video = ?');
            values.push(recommended_video);
        }

        if (moduleId) {
            fields.push('module_id = ?');
            values.push(moduleId);
        }

        values.push(id); // for WHERE clause

        const sql = `UPDATE topics SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await pool.execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Topic not found or no changes made' });
        }

        res.status(201).json({ message: 'Topic updated successfully' });
    } catch (err) {
        console.error('Error updating topic:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a course
router.post('/courses', useUploader('/uploads/courses'), async (req, res) => {
    const { title, price, description, d_wlink } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });

    try {
        const sql = 'INSERT INTO courses (title, cover_img_url, description, price, d_wlink) VALUES (?, ?, ?, ?, ?)';
        const [result] = await pool.execute(sql, [
            title,
            req.file.uploadUrl,
            description || null,
            price || null,
            d_wlink || null
        ]);

        res.status(201).json({ message: 'Course created', courseId: result.insertId });
    } catch (err) {
        console.error('Error creating course:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Edit a course
router.put('/courses/:id', useUploader('/uploads/courses'), async (req, res) => {
  const { id } = req.params;
  const { title, price, description, d_wlink } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const [rows] = await pool.execute('SELECT cover_img_url FROM courses WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

      const imagePath = path.join(process.cwd(), rows[0].cover_img_url);
      try {
          await fs.unlinkSync(imagePath) // ignore if file not found
      } catch (e) {
          console.log(e)
      }

      const [result] = await pool.execute(
          'UPDATE courses SET title = ?, cover_img_url = ?, description = ?, price = ?, d_wlink = ? WHERE id = ?',
          [title, req.file.uploadUrl, description || null, price, d_wlink || null, id]
      );

      res.status(201).json({ message: 'Course Edited Successfully', courseId: id });
  } catch (err) {
      console.error('Error updating course:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a course
router.delete('/courses/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
        const [rows] = await pool.execute('SELECT cover_img_url FROM courses WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const imagePath = path.join(process.cwd(), rows[0].cover_img_url);
        fs.unlinkSync(imagePath)

        await pool.execute('DELETE FROM courses WHERE id = ?', [id]);

        res.status(201).json({ message: 'Course Deleted Successfully', courseId: id });
    } catch (err) {
        console.error('Error deleting course:', err);
        res.status(500).json({ message: 'Server error', error: err });
    }
});

// Create a module
router.post('/modules', async (req, res) => {
    const { courseId, title, active } = req.body;
    if (!courseId || !title) {
        return res.status(400).json({ error: 'courseId and title are required' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO modules (course_id, title, active) VALUES (?, ?, ?)',
            [courseId, title, active]
        );

        res.status(201).json({ message: 'Module created', moduleId: result.insertId });
    } catch (err) {
        console.error('Error creating module:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a module
router.delete('/modules/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Invalid Parameter, missing Id' });
    }

    try {
        await pool.execute('DELETE FROM modules WHERE id = ?', [id]);
        res.status(201).json({ message: 'Module deleted', moduleId: id });
    } catch (err) {
        console.error('Error deleting module:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Edit a module
router.put('/modules/:id', async (req, res) => {
    const { id } = req.params;
    const { courseId, title, active } = req.body;

    if (!id || !courseId || !title) {
        return res.status(400).json({ error: 'id, courseId, title are required' });
    }

    try {
        const fields = [];
        const values = [];

        if (courseId) {
            fields.push('course_id = ?');
            values.push(courseId);
        }

        if (title) {
            fields.push('title = ?');
            values.push(title);
        }

        if (typeof active !== 'undefined') {
            fields.push('active = ?');
            values.push(active);
        }

        values.push(id);

        const [result] = await pool.execute(
            `UPDATE modules SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Module not found or no changes made' });
        }

        res.json({ message: 'Module updated successfully' });
    } catch (err) {
        console.error('Error updating module:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//create a project
router.post('/projects', async (req, res) => {
    const { title, moduleId, courseId, instructions, content, rubric } = req.body;

    if (!title || !moduleId || !instructions || !rubric) {
        return res.status(400).json({ error: 'module_id, instructions, rubric and title are required' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO projects (title, module_id, course_id, instructions, project_hint, rubric) VALUES (?, ?, ?, ?, ?, ?)',
            [title, moduleId, courseId, instructions || null, content || null, rubric]
        );
        res.status(201).json({ message: 'Project created successfully', id: result.insertId });
    } catch (err) {
        console.error('Error creating project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a project
router.delete('/projects/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Invalid Parameter, missing Id' });
    }

    try {
        await pool.execute('DELETE FROM projects WHERE id = ?', [id]);
        res.status(201).json({ message: 'Project deleted', moduleId: id });
    } catch (err) {
        console.error('Error deleting project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//edit a project
router.put('/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { title, moduleId, instructions, content, rubric } = req.body;

    if (!title || !moduleId || !instructions) {
        return res.status(400).json({ error: 'module_id, instructions and title are required' });
    }

    try {
        const fields = [];
        const values = [];

        if (title) {
            fields.push('title = ?');
            values.push(title);
        }

        if (instructions) {
            fields.push('instructions = ?');
            values.push(instructions);
        }

        if (moduleId) {
            fields.push('module_id = ?');
            values.push(moduleId);
        }


        if (content) {
            fields.push('project_hint = ?');
            values.push(content);
        }

        if (rubric) {
            fields.push('rubric = ?');
            values.push(rubric);
        }

        values.push(id); // for WHERE clause

        const [result] = await pool.execute(
            `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Project not found or no changes made' });
        }

        res.status(201).json({ message: 'Project updated successfully' });
    } catch (err) {
        console.error('Error updating project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch student modules
router.get('/student/modules', async (req, res) => {
    router.use(checkEnrollment);

    try {
        const [modules] = await pool.execute(
            'SELECT id, title FROM modules WHERE course_id = ? ORDER BY created_at DESC',
            [req.user.course_id]
        );
        res.json({ modules });
    } catch (err) {
        console.error('Error fetching modules for student:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a student
router.delete('/students/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Invalid Parameter, missing Id' });
    }

    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        res.status(201).json({ message: 'User deleted', moduleId: id });
    } catch (err) {
        console.error('Error deleting User:', err);
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

// GET TOP ENROLLED COURSE
router.get('/top/course', async (req, res) => {
  try {

    // Fetch user info
    const userSql = `
      SELECT count(*) as total, c.title as title
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id ORDER BY c.id DESC
    `;
    const [topCourses] = await pool.query(userSql, [req.user.id]);

    res.json({ topCourses });
  } catch (err) {
    console.error('Error in Fetching Total Courses', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// send Mail
router.post('/general-reminder', async (req, res) => {
    const { header, subject, message, recipients } = req.body;

    if (!subject || !header || !message || !Array.isArray(recipients)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        recipients.forEach( async (email) => {
             await req.mailer.sendMail({
                from: `"${header}" <${process.env.SMTP_USER}>`,
                to: email,
                subject,
                html: message
            });
        })

        return res.status(200).json({ message: 'Emails sent successfully...'});
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'Email sending failed' });
    }});

// send Mail
router.post('/mail', async (req, res) => {
    const { header, subject, message, recipients } = req.body;

    if (!subject || !header || !message || !Array.isArray(recipients)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const template = getTemplate('general-reminder');
    let html = template.replace('{{content}}', message);

    try {
        recipients.forEach( async (email) => {
             await req.mailer.sendMail({
                from: `"${header}" <${process.env.SMTP_USER}>`,
                to: email,
                subject,
                html
            });
        })

        return res.status(200).json({ message: 'Emails sent successfully...'});
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'Email sending failed' });
    }});

module.exports = router;


