// server.js
const express = require('express');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const ebookRoutes = require('./routes/ebook');

const { preloadEmailTemplates } = require('./utils/emailTemplates');

const app = express();
const PORT = process.env.PORT || 3001;

preloadEmailTemplates();

app.use(cors());
app.options('*', cors());

app.use(express.json());

app.use('/api', apiRoutes);
app.use('/ebooks', ebookRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

