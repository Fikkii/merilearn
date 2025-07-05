// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

//Api routes
const apiRoutes = require('./routes/api');
const ebookRoutes = require('./routes/ebook');

const pool = require('./db'); // MySQL pool
const { preloadEmailTemplates } = require('./utils/emailTemplates');
const { useUploader } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 3001;

preloadEmailTemplates();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Upload route
app.post('/upload', useUploader(), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  res.status(200).json({
    message: 'Image uploaded successfully',
    filename: req.file.filename,
    path: `${req.file.uploadUrl}`
  });
});

// Fetch course details
app.get('/courses/details', async (req, res) => {
  try {
    const [modules] = await pool.query(`SELECT * FROM modules`);
    const [courses] = await pool.query(`
      SELECT id, title, cover_img_url, description, price
      FROM courses
      ORDER BY created_at DESC
    `);
    const [topics] = await pool.query(`SELECT * FROM topics`);

    // Group topics under their modules
    const modulesWithTopics = modules.map(mod => {
      const modTopics = topics.filter(topic => topic.module_id === mod.id);
      return { ...mod, topics: modTopics };
    });

    // Group modules under their respective courses
    const courseDetail = courses.map(course => {
      const filteredModules = modulesWithTopics.filter(mod => mod.course_id === course.id);
      return { ...course, modules: filteredModules };
    });

    res.json(courseDetail);
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    const [result] = await pool.execute(`
      SELECT COUNT(*) AS total FROM courses
    `);

    const [users] = await pool.execute(`
      SELECT COUNT(*) AS total FROM users
    `);

    const [projects] = await pool.execute(`
      SELECT COUNT(*) AS total FROM projects
    `);

    res.json({ total_courses: result[0].total, total_users: users[0].total,  total_projects: projects[0].total   });
  } catch (err) {
    console.error('Failed to fetch total courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.use('/api', apiRoutes);
app.use('/ebooks', ebookRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

