// routes/auth.js
require('dotenv').config()
const express = require('express');
const db = require('../db');
const axios = require('axios');
const fs = require('fs')
const path = require('path')

const {checkPermission} = require('../middleware/checkPermission');

//Middleware to upload file
const { useUploader } = require('../middleware/upload.js');


const router = express.Router();

// Create a topic
router.post('/topics', (req, res) => {
    const { moduleId, title, content, recommended_video } = req.body;
    if (!moduleId || !title || !content ) {
        return res.status(400).json({ error: 'moduleId, title, and content are required' });
    }

    const query = db.prepare(`
    INSERT INTO topics (module_id, title, content, recommended_video)
    VALUES (?, ?, ?, ?)
  `).run(moduleId, title, content, recommended_video);

    res.status(201).json({ message: 'Topic created', topicId: query.lastInsertRowid });
});

//Delete a Topic
router.delete('/topics/:id', (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    db.prepare('DELETE FROM topics WHERE id=?')
        .run(id);

    res.status(201).json({ message: 'Topic Deleted Successfully', courseId: id });
});

//Edit a Topic
router.put('/topics/:id', (req, res) => {
    const { id } = req.params;
    const { title, moduleId, content, recommended_video } = req.body;

    if (!title, !moduleId, !content) {
        return res.status(400).json({ error: 'module_id, instructions and title are required' });
    }

    try {
        // Build update query dynamically
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

        const stmt = db.prepare(`
          UPDATE topics
          SET ${fields.join(', ')}
          WHERE id = ?
        `);

        const result = stmt.run(...values);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Topic not found or no changes made' });
        }

        res.status(201).json({ message: 'Topic updated successfully' });
    } catch (err) {
        console.error('Error updating topic:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a course
router.post('/courses', useUploader('/uploads/courses'), (req, res) => {

    const { title, price, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const query = db.prepare('INSERT INTO courses (title, cover_img_url, description, price) VALUES (?, ?, ?, ?)')
        .run(title, req.file.uploadUrl, description || null, price);

    res.status(201).json({ message: 'Course created', courseId: query.lastInsertRowid });
});

// Edit a course
router.put('/courses/:id', useUploader('/uploads/courses'), (req, res) => {
    const { id } = req.params;
    const { title, price, description } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });

        const rootDir = process.cwd()

        const courses = db.prepare(`
        SELECT cover_img_url
        FROM courses WHERE id = ?
      `).get(id);


    const imagePath = path.join(rootDir, courses.cover_img_url)

    fs.unlink(imagePath, (err) => {
        if(err){
            return res.status(500).json({error: err})
        }
    })

    const query = db.prepare('UPDATE courses SET title = ?, cover_img_url = ?, description = ?, price = ? where id = ?')
        .run(title, req.file.uploadUrl, description || null, price, id);

    res.status(201).json({ message: 'Course Edited Successfully', courseId: query.lastInsertRowid });
});

//Delete a course
router.delete('/courses/:id', (req, res) => {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: 'id is required' });

    const rootDir = process.cwd()

    const courses = db.prepare(`
    SELECT cover_img_url
    FROM courses WHERE id = ?
  `).get(id);

    const imagePath = path.join(rootDir, courses.cover_img_url)

    //Delete cover image along with course so as to save space on server
    fs.unlink(imagePath, (err) => {
        if(err){
            return res.status(500).json({message: 'Unable to delete cover image', error: err})
        }

        db.prepare('DELETE FROM courses WHERE id=?') .run(id);
        res.status(201).json({ message: 'Course Deleted Successfully', courseId: id });
    })
});

// Create a module
router.post('/modules', (req, res) => {
    const { courseId, title, active} = req.body;
    if (!courseId || !title ) {
        return res.status(400).json({ error: 'courseId, title, required' });
    }

    const query = db.prepare(` INSERT INTO modules (course_id, title, active )
    VALUES (?, ?, ?)
  `).run(courseId, title, active);

    res.status(201).json({ message: 'Module created', moduleId: query.lastInsertRowid });
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
    const { id } = req.params;
    const { courseId, title, active } = req.body;

    // At least one field should be present
    if (!courseId || !title ||!id ) {
        return res.status(400).json({ error: 'id, courseId, title, is required' });
    }

    try {
        // Build update query dynamically
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

        if (active) {
            fields.push('active = ?');
            values.push(active);
        }

        values.push(id); // for WHERE clause

        const stmt = db.prepare(`
          UPDATE modules
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
    const { title, moduleId, instructions, rubric } = req.body;

    if (!title, !moduleId, !instructions, !rubric) {
        return res.status(400).json({ error: 'module_id, instructions, rubric and title are required' });
    }

    try {

        db.prepare(`
      INSERT INTO projects (title, module_id, instructions, rubric)
      VALUES (?, ?, ?, ?)
    `).run(title, moduleId, instructions || null, rubric);

        res.status(201).json({ message: 'Project created successfully', id });
    } catch (err) {
        console.error('Error creating project:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//edit a project
router.put('/projects/:id', (req, res) => {
    const { id } = req.params;
    const { title, moduleId, instructions, rubric } = req.body;

    if (!title, !moduleId, !instructions) {
        return res.status(400).json({ error: 'module_id, instructions and title are required' });
    }

    try {
        // Build update query dynamically
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


        if (rubric) {
            fields.push('rubric = ?');
            values.push(rubric);
        }

        values.push(id); // for WHERE clause

        const stmt = db.prepare(`
          UPDATE projects
          SET ${fields.join(', ')}
          WHERE id = ?
        `);

        const result = stmt.run(...values);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found or no changes made' });
        }

        res.status(201).json({ message: 'Project updated successfully' });
    } catch (err) {
        console.error('Error updating project:', err);
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
      SELECT id, title
      FROM modules
      WHERE course_id = ?
      ORDER BY created_at DESC
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


