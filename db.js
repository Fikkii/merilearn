// db.js
const Database = require('better-sqlite3');
const db = new Database('todos.db');

db.pragma('foreign_keys = ON');

db.prepare(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`).run();

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'student' CHECK(role IN ('student', 'instructor', 'admin')),
    password TEXT NOT NULL,
    resetToken TEXT,
    resetTokenExpires INT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    amount INT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    instructions TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    project_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_scores (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    score REAL NOT NULL,
    feedback TEXT,
    graded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, project_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        "order" INTEGER,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );
`);

module.exports = db;

