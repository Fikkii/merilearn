// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const ebookRoutes = require('./routes/ebook');

const db = require('./db');

const { preloadEmailTemplates } = require('./utils/emailTemplates');

const app = express();
const PORT = process.env.PORT || 3001;

const { useUploader } = require('./middleware/upload')

preloadEmailTemplates();

app.use(cors());

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', useUploader(),(req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' })
  }
  res.status(200).json({
    message: 'Image uploaded successfully',
    filename: req.file.filename,
    path: `${req.file.uploadUrl}`
  })
})

app.get('/courses/details', (req, res) => {
  try {
    const modules = db.prepare(`
      SELECT *
      FROM modules
    `).all();

    const courses = db.prepare(`
      SELECT id, title, cover_img_url, description, price
      FROM courses
      ORDER BY created_at DESC
    `).all();

    const topicStmt = db.prepare(`
      SELECT *
      FROM topics
    `).all();

      modulesWithTopics = []
      modules.map((value) => {
          const filteredTopics = topicStmt.filter((topic) =>
              topic.module_id == value.id
          )

          modulesWithTopics.push({ ...value, topics: filteredTopics })

      })

      const courseDetail = []

      courses.map((value) => {

          const filteredModules = modulesWithTopics.filter((mod) =>
              mod.course_id == value.id
          )

          courseDetail.push({ ...value, modules: filteredModules })
      })

      res.json(courseDetail);
  } catch (err) {
      console.error('Failed to fetch courses:', err);
      res.status(500).json({ error: 'Internal server error' });
  }

})

app.use('/api', apiRoutes);
app.use('/ebooks', ebookRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

