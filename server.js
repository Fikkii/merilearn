// server.js
const express = require('express');
const cors = require('cors');
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
      ORDER BY created_at DESC
    `).all();

    const courses = db.prepare(`
      SELECT id, title, cover_img_url, description, price
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

app.use('/api', apiRoutes);
app.use('/ebooks', ebookRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

