const fs = require('fs');
const path = require('path');

const templates = {};

// Preload templates during startup
function preloadEmailTemplates() {
  const files = fs.readdirSync(path.join(__dirname, '../emails'));
  for (const file of files) {
    const fullPath = path.join(__dirname, '../emails', file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const key = path.basename(file, '.html'); // e.g. 'reset-password'
    templates[key] = content;
  }
}

// Get template by name
function getTemplate(name) {
  return templates[name] || null;
}

module.exports = {
  preloadEmailTemplates,
  getTemplate,
};

