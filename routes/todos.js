// routes/todos.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');


// GET /api/todos
router.get('/', async (req, res) => {
  try {
    const sql = 'SELECT * FROM todos WHERE user_id = ?';
    const [todos] = await pool.query(sql, [req.user.id]);
    res.json(todos);
  } catch (err) {
    console.error('Error fetching todos:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/todos
router.post('/', async (req, res) => {
  const { text } = req.body;

  try {
    const insertSql = 'INSERT INTO todos (text, user_id) VALUES (?, ?)';
    const [result] = await pool.query(insertSql, [text, req.user.id]);

    // result.insertId holds the new todo ID (assuming `id` is AUTO_INCREMENT)
    const selectSql = 'SELECT * FROM todos WHERE id = ?';
    const [rows] = await pool.query(selectSql, [result.insertId]);

    const todo = rows[0];
    res.status(201).json(todo);
  } catch (err) {
    console.error('Error creating todo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/todos/:id
router.put('/:id', async (req, res) => {
  const { completed } = req.body;
  const id = req.params.id;

  try {
    const updateSql = 'UPDATE todos SET completed = ? WHERE id = ? AND user_id = ?';
    await pool.query(updateSql, [completed ? 1 : 0, id, req.user.id]);

    const selectSql = 'SELECT * FROM todos WHERE id = ? AND user_id = ?';
    const [rows] = await pool.query(selectSql, [id, req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating todo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleteSql = 'DELETE FROM todos WHERE id = ? AND user_id = ?';
    const [result] = await pool.query(deleteSql, [req.params.id, req.user.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting todo:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

