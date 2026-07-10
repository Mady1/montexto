const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// List notifications for current user (or org-wide for admins)
router.get('/', (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const where = isSuperAdmin
    ? 'WHERE 1=1'
    : 'WHERE (user_id = ? OR (organization_id = ? AND user_id IS NULL))';
  const params = isSuperAdmin ? [] : [req.user.id, req.user.organization_id];

  db.all(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const unread = rows.filter((r) => !r.is_read).length;
      res.json({ data: rows, unread });
    }
  );
});

// Mark single notification as read
router.patch('/:id/read', (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Marked as read' });
  });
});

// Mark all as read
router.patch('/read-all', (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const where = isSuperAdmin
    ? 'WHERE is_read = 0'
    : 'WHERE is_read = 0 AND (user_id = ? OR (organization_id = ? AND user_id IS NULL))';
  const params = isSuperAdmin ? [] : [req.user.id, req.user.organization_id];

  db.run(`UPDATE notifications SET is_read = 1 ${where}`, params, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'All marked as read' });
  });
});

// Delete notification
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM notifications WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Notification deleted' });
  });
});

// Create notification (internal use or admin)
router.post('/', (req, res) => {
  const { title, message, type = 'info', link, userId, organizationId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  db.run(
    'INSERT INTO notifications (user_id, organization_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)',
    [userId || null, organizationId || req.user.organization_id, title, message, type, link || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

module.exports = router;
