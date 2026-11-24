const fs = require('fs');
const path = require('path');

// Proof screenshots. Point UPLOAD_DIR at a persistent disk in production.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

module.exports = { UPLOAD_DIR };
