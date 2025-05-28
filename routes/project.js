const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
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
module.exports = router;
