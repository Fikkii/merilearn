// db.js
const Database = require('better-sqlite3');
const db = new Database('merilearn.db');

module.exports = db;

