const express = require('express');
const { randomUUID } = require('crypto');
const pool = require('../db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const id = randomUUID();
    const { title, instructions } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const sql = 'INSERT INTO projects (id, title, instructions) VALUES (?, ?, ?)';
    await pool.query(sql, [id, title, instructions || null]);

    res.status(201).json({ message: 'Project created successfully', id });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
