// server.js
const express = require('express');
const cors = require('cors');
const todosRoutes = require('./routes/todos');
const authRoutes = require('./routes/auth');
const chatRoute = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/todos', todosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

