const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

const checkEnrollment = require('../middleware/enroll');

router.get('/me', (req, res) => {
    const stmt = db.prepare('SELECT u.id, s.fullname, u.email, u.created_at FROM users u JOIN student_profiles s ON s.id=u.id WHERE u.id = ?');
    const student = stmt.get(req.user.id);
    console.log(student)
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
});

router.put('/me', async (req, res) => {
  const { fullname, password } = req.body;

  // At least one field should be present
  if (!fullname && !password) {
    return res.status(400).json({ error: 'At least one field (name, email, or password) must be provided' });
  }

  try {
    // Build update query dynamically
    const fields = [];
    const values = [];

    if (fullname) {
      fields.push('fullname = ?');
      values.push(fullname);
    }

    const hashed = await bcrypt.hash(password, 10);

    values.push(req.user.id); // for WHERE clause

      if(password){
        db.prepare(`
          UPDATE users
          SET password = ?
          WHERE id = ?
        `).run(hashed, req.user.id);
      }

    const stmt = db.prepare(`
      UPDATE student_profiles
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Student not found or no changes made' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Error updating student profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ENROLLMENTS ---
router.post('/enrollment', (req, res) => {
  const { courseId, paid } = req.body;
  if (!courseId) return res.status(400).json({ error: 'courseId is required' });

  if (req.user.course_id) {
    return res.status(400).json({ error: 'Already enrolled in a course' });
  }

  db.prepare(`INSERT INTO enrollments (id, student_id, course_id, paid) VALUES (?, ?, ?)`)
    .run(req.user.id, courseId, paid ? 1 : 0);

  res.json({ message: 'Enrollment successful'});
});

router.delete('/enrollment', (req, res) => {
  try {

    db.prepare('DELETE FROM enrollments WHERE student_id = ?').run(req.user.id);

    res.json({ message: 'Enrollment deleted successfully' });
  } catch (err) {
    console.error('Error deleting enrollment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.use(checkEnrollment);

router.get('/course', (req, res) => {
  try {
    // Get modules for the course
    const modules = db.prepare(`
      SELECT id, title, "order"
      FROM modules
      WHERE course_id = ?
      ORDER BY "order"
    `).all(req.user.course_id);

    // Get topics for each module
    const topicStmt = db.prepare(`
      SELECT id, module_id, title, content, "order", completed
      FROM topics
      WHERE module_id = ?
      ORDER BY "order"
    `);

    const modulesWithTopics = modules.map(mod => ({
      ...mod,
      topics: topicStmt.all(mod.id)
    }));

    res.json({
      course: {
        id: req.user.course_id,
        modules: modulesWithTopics
      }
    });

  } catch (err) {
    console.error('Error fetching enrolled course:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/topic', (req, res) => {
  const topicId = req.query.topicId;

  if (!topicId) {
    return res.status(400).json({ error: 'Missing topicId in query.' });
  }

  try {
    // Fetch topic and its module details
    const topic = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.content,
        t.completed,
        m.course_id
      FROM topics t
      JOIN modules m ON t.module_id = m.id
      WHERE t.id = ?
    `).get(topicId);

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Validate that the topic belongs to the user's course
    if (topic.course_id !== req.user.course_id) {
      return res.status(403).json({ error: 'Access denied to this topic.' });
    }

    res.json({ topic });

  } catch (err) {
    console.error('Error fetching topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/topic/complete', (req, res) => {
  const { topicId } = req.body;

  if (!topicId) {
    return res.status(400).json({ error: 'topicId is Required...' });
  }

  try {
    // Fetch topic and its module details
    const topic = db.prepare(`
      UPDATE
        topics
      SET completed=1
      WHERE id = ?
    `).run(topicId);

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Validate that the topic belongs to the user's course
    if (topic.course_id !== req.user.course_id) {
      return res.status(403).json({ error: 'Access denied to this topic.' });
    }

    res.json({ topic });

  } catch (err) {
    console.error('Error fetching topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/project-scores', (req, res) => {
  try {
    const scores = db.prepare(`
      SELECT
        ps.score,
        ps.feedback
      FROM project_scores ps
      WHERE ps.student_id = ?
    `).all(req.user.id);

    if (scores.length === 0) {
      return res.status(404).json({ message: 'No project scores found for this student.' });
    }

    res.json({ scores });
  } catch (err) {
    console.error('Error fetching project scores:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/project-scores', (req, res) => {
  const { project_id, score, feedback } = req.body;

  if (!project_id || score == null) {
    return res.status(400).json({ error: 'project_id and score are required' });
  }

  try {
    // Check if record already exists (avoid duplicates)
    const existing = db.prepare(`
      SELECT * FROM project_scores
      WHERE student_id = ? AND project_id = ?
    `).get(req.user.id, project_id);

    if (existing) {
      return res.status(409).json({ error: 'Project score for this project already exists' });
    }

    db.prepare(`
      INSERT INTO project_scores (id, student_id, project_id, score, feedback)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, project_id, score, feedback || null);

    res.status(201).json({ message: 'Project score created successfully'});
  } catch (err) {
    console.error('Error creating project score:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/projects', (req, res) => {
  try {
    // Fetch projects related to the enrolled course
    const projects = db.prepare(`
      SELECT
        m.title,
        p.title,
        p.instructions
      FROM modules m JOIN projects p ON p.id = m.project_id WHERE course_id = ?
      ORDER BY m."order"
    `).all(req.user.course_id);

    res.json({ projects });
  } catch (err) {
    console.error('Error fetching projects for student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
