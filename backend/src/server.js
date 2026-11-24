require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploads = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploads, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploads));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/user'));

// In production, serve the built React app from the same server
const web = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(web)) {
  app.use(express.static(web));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(web, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Click&Share API running on http://localhost:${port}`));
