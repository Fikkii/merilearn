// routes/todos.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticate = require('../middleware/auth');

// Protect all routes
router.use(authenticate);

// GET /api/todos
router.get('/', (req, res) => {
  const todos = db.prepare('SELECT * FROM todos WHERE user_id = ?').all(req.user.id);
  res.json(todos);
});

// POST /api/todos
router.post('/', (req, res) => {
  const { text } = req.body;
  const stmt = db.prepare('INSERT INTO todos (text, user_id) VALUES (?, ?)');
  const info = stmt.run(text, req.user.id);
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(todo);
});

// PUT /api/todos/:id
router.put('/:id', (req, res) => {
  const { completed } = req.body;
  const id = req.params.id;

  db.prepare('UPDATE todos SET completed = ? WHERE id = ? AND user_id = ?')
    .run(completed ? 1 : 0, id, req.user.id);

  const updated = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
    .get(id, req.user.id);

  res.json(updated);
});

// DELETE /api/todos/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.status(204).end();
});

module.exports = router;

