// server.js
const express = require('express');
const cors = require('cors');

//routes
const todosRoutes = require('./routes/todos');
const authRoutes = require('./routes/auth');
const chatRoute = require('./routes/chat');
const ebookRoutes = require('./routes/ebook');
const quizRouter = require('./routes/quiz.js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/todos', todosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoute);
app.use('/api/ebooks', ebookRoutes);
app.use('/api/quiz', quizRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

