const db = require('../config/db');

// Authenticates requests to the public API via an X-API-Key header instead of
// a JWT session. Populates req.user the same shape as authenticateToken does,
// so downstream middleware (requirePermission, org-scoped queries) works
// unmodified whether the caller used a browser session or an API key.
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const sql = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
           u.organization_id, u.role_id, u.status,
           r.name as role_name, r.display_name as role_display_name,
           ak.id as api_key_id
    FROM api_keys ak
    INNER JOIN users u ON u.id = ak.user_id
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE ak.key_value = ?
  `;
  db.get(sql, [apiKey], (err, user) => {
    if (err) return res.status(500).json({ error: 'Authentication error' });
    if (!user) return res.status(401).json({ error: 'Invalid API key' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account disabled' });

    req.user = user;
    req.apiKeyId = user.api_key_id;
    db.run('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [user.api_key_id]);
    next();
  });
}

module.exports = { authenticateApiKey };
