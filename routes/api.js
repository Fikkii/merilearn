// routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const db = require('../db')
const axios = require('axios')

const authRoute = require('./auth')
const peerGroups = require('./peerGroup')
const gradeRoute = require('./grade')

router.use('/', authRoute)
router.use('/peer', peerGroups)
router.use('/grade', gradeRoute)

// Fetch all courses available
// This is the only unprotected route in the server since it will be used at the frontend
router.get('/courses/details', (req, res) => {
  try {
    const modules = db.prepare(`
      SELECT *
      FROM modules
      ORDER BY created_at DESC
    `).all();

    const courses = db.prepare(`
      SELECT id, cover_img_url, title, description, price
      FROM courses
      ORDER BY created_at DESC
    `).all();

    const topicStmt = db.prepare(`
      SELECT *
      FROM topics WHERE id=?
      ORDER BY created_at DESC
    `);

      const modulesWithTopics = modules.map((value) => ({
          ...value,
         topics: topicStmt.all(value.id)
      }))


      const coursesWithModules = courses.map((value) => {
          const data = []
          modulesWithTopics.forEach(mod => {
              if(mod.id == value.id){
                  data.push({ ...value, modules: mod })
              }
          })
          return data
      })

    res.json(...coursesWithModules);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }

})

router.get('/courses', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT id, title, cover_img_url, description, price
      FROM courses
      ORDER BY created_at DESC
    `).all();

    res.json(courses);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch Courses based on ID
router.get('/courses/:id', (req, res) => {
  const { id } = req.params
  try {
    const courses = db.prepare(`
      SELECT id, title, cover_img_url, description, price
      FROM courses WHERE id = ?
    `).get(id);

    res.json(courses);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch Modules based on ID
router.get('/modules/:id',(req, res) => {
    const { id } = req.params
  try {
    const modules = db.prepare(`
      SELECT m.id, m.title, c.title as course_title, c.id as courseId, c.active as active
      FROM modules m JOIN courses c ON c.id=m.course_id WHERE m.id = ?
    `).get(id);

    res.json(modules);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch Modules
router.get('/modules',(req, res) => {
  try {
    const modules = db.prepare(`
      SELECT m.id, m.title, c.title as course_title, m.active as status
      FROM modules m JOIN courses c ON c.id=m.course_id
    `).all();

    res.json(modules);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch all Topics
router.get('/topics', (req, res) => {
  try {
    const topics = db.prepare(`
      SELECT t.id, t.title as topic_title, t.content as topic_content, t.recommended_video as yVideoLink, m.title as module_title, c.title as course_title
      FROM topics t JOIN modules m ON m.id=t.module_id JOIN courses c on c.id=m.course_id
    `).all();

    res.json(topics);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Fetch single topic
router.get('/topics/:id', (req, res) => {
    const { id } = req.params
  try {
    const topics = db.prepare(`
      SELECT t.id, t.title as title, t.content as topic_content, t.recommended_video as recommended_video, m.title as module_title, c.title as course_title, m.id as moduleId
      FROM topics t JOIN modules m ON m.id=t.module_id JOIN courses c on c.id=m.course_id WHERE t.id = ?
    `).get(id);

    res.json(topics);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/students', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, s.fullname, u.email
      FROM users u JOIN student_profiles s on s.id=u.id
    `).all();

    res.json(users);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/enrollments',(req, res) => {
  try {
    const enrollments = db.prepare(`
      SELECT e.id, s.fullname as student_name, u.email as student_email
      FROM enrollments e join users u on u.id=e.student_id join courses c on c.id=e.course_id join student_profiles s on s.id=u.id
    `).all();

    res.json(enrollments);
  } catch (err) {
    console.error('Failed to fetch modules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all projects
router.get('/projects', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.id, p.title, p.instructions, p.rubric, m.id as module_id
      FROM projects p JOIN modules m ON m.id=p.module_id
    `).all();

    res.json(projects);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch single project
router.get('/projects/:id', (req, res) => {
  const { id } = req.params

  try {
    let projects = db.prepare(`
      SELECT p.id, p.title, p.instructions, m.id as moduleId, p.rubric as rubric
      FROM projects p JOIN modules m ON m.id = p.id WHERE p.id = ?
    `).get(id);

    //join project evaluation if it exists
      const stmt = db.prepare(`SELECT * FROM evaluations WHERE project_id = ? AND student_id = ?`)
      let rows = stmt.get(id, req.user.id)

      rows.feedback = JSON.parse(rows.feedback) // Convert from string to array

      projects.evaluation = rows

      res.json(projects);
  } catch (err) {
      console.error('Failed to fetch projects:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

//total courses
router.get('/total/courses', (req, res) => {
    try {
        const courses = db.prepare(`
        SELECT count(*) as total
        FROM courses
        ORDER BY created_at DESC
        `).all();

    res.json({ total_courses: courses[0].total });
  } catch (err) {
            console.error('Failed to fetch total courses:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
})

//total modules
router.get('/total/modules', (req, res) => {
    try {
        const modules = db.prepare(`
      SELECT count(*) as total
      FROM modules
      ORDER BY created_at DESC
    `).all();

        res.json({ total_modules: modules[0].total });
    } catch (err) {
        console.error('Failed to fetch total modules:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//total users
router.get('/total/users', (req, res) => {
    try {
        const users = db.prepare(`
      SELECT count(*) as total
      FROM users
      ORDER BY created_at DESC
    `).all();

        res.json({ total_users: users[0].total });
    } catch (err) {
        console.error('Failed to fetch total users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//total projects
router.get('/total/projects', (req, res) => {
    try {
        const projects = db.prepare(`
      SELECT count(*) as total
      FROM projects
      ORDER BY created_at DESC
    `).all();

        res.json({ total_projects: projects[0].total });
    } catch (err) {
        console.error('Failed to fetch total projects:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//total topics
router.get('/total/topics', (req, res) => {
    try {
        const topics = db.prepare(`
      SELECT count(*) as total
      FROM topics
      ORDER BY created_at DESC
    `).all();

        res.json({ total_topics: topics[0].total });
    } catch (err) {
        console.error('Failed to fetch total topics:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//total enrollments
router.get('/total/enrollments', (req, res) => {
    try {
        const enrollments = db.prepare(`
      SELECT count(*) as total
      FROM enrollments
    `).all();

        res.json({ total_enrollments: enrollments[0].total });
    } catch (err) {
        console.error('Failed to fetch total enrollments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//total instructors
router.get('/total/instructors', (req, res) => {
    try {
        const instructors = db.prepare(`
      SELECT count(*) as total
      FROM instructor_profiles
      ORDER BY created_at DESC
    `).all();

        res.json({ total_instructors: instructors[0].total });
    } catch (err) {
        console.error('Failed to fetch total instructors:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//leaderboard courses
router.get('/leaderboard/courses', (req, res) => {
    try {
        const courses = db.prepare(`
      SELECT title, count(*) as total
      FROM courses c JOIN enrollments e ON e.course_id=c.id
      ORDER BY created_at DESC limit 3
    `).all();

        res.json({ courses });
    } catch (err) {
        console.error('Failed to fetch total courses:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

// Get all notifications
router.get('/notifications', (req, res) => {
    const notifications = db.prepare('SELECT * FROM notification ORDER BY createdat DESC').all();
    res.json(notifications);
});

// Get a single notification
router.get('/notifications/:id', (req, res) => {
    const notification = db.prepare('SELECT * FROM notification WHERE id = ?').get(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Not found' });
    res.json(notification);
});

// Create a notification
router.post('/notifications', (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const stmt = db.prepare('INSERT INTO notification (title) VALUES (?)');
    const result = stmt.run(title);
    const newNotification = db.prepare('SELECT * FROM notification WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newNotification);
});
//
// Update a notification
router.put('/notifications/:id', (req, res) => {
    const { title } = req.body;
    const stmt = db.prepare('UPDATE notification SET title = ? WHERE id = ?');
    const result = stmt.run(title, req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });

    const updated = db.prepare('SELECT * FROM notification WHERE id = ?').get(req.params.id);
    res.json(updated);
});

// Delete a notification
router.delete('/notifications/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM notification WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });

    res.status(204).send();
});

//Paystack Reference checker
router.get('/verify/:reference',async (req, res) => {
    const reference = req.params.reference

    try {
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        )

        // Check if payment was successful
        if (response.data.data.status === 'success') {
            return res.status(200).json({ status: 'success', data: response.data.data })
        } else {
            return res.status(404).json({ status: 'failed', data: response.data.data })
        }
    } catch (error) {
        console.error('Verification error:', error.message)
        return res.status(500).json({ status: 'error', message: 'Verification failed' })
    }
})

module.exports = router;

