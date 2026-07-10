const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Load full user info including role and organization
    const sql = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
             u.organization_id, u.role_id, u.status,
             r.name as role_name, r.display_name as role_display_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
    `;
    db.get(sql, [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(403).json({ error: 'User not found' });
      }
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Account disabled' });
      }
      req.user = user;
      next();
    });
  });
}

module.exports = { authenticateToken, JWT_SECRET };
