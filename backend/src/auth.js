const jwt = require('jsonwebtoken');
const { query } = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

function sign(user) {
  return jwt.sign({ id: user.Id, role: user.Role }, SECRET, { expiresIn: '7d' });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    const payload = jwt.verify(token, SECRET);
    const [user] = await query('SELECT Id, Role, IsBlocked FROM Users WHERE Id=@id', { id: payload.id });
    if (!user) return res.status(401).json({ error: 'Account not found' });
    if (user.IsBlocked) return res.status(403).json({ error: 'Your account is blocked' });
    req.user = { id: user.Id, role: user.Role };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

module.exports = { sign, requireAuth, requireAdmin };
