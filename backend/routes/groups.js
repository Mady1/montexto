const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function orgWhere(req) {
  return req.user.role_name === 'super_admin' ? '' : ' AND organization_id = ?';
}

function orgParams(req) {
  return req.user.role_name === 'super_admin' ? [] : [req.user.organization_id];
}

router.get('/', authenticateToken, (req, res) => {
  const where = orgWhere(req);
  const params = orgParams(req);
  db.all(
    `SELECT g.*, (SELECT COUNT(*) FROM contacts WHERE group_id = g.id) as contact_count FROM contact_groups g WHERE 1=1${where} ORDER BY g.created_at DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  db.run(
    'INSERT INTO contact_groups (user_id, organization_id, name, description) VALUES (?, ?, ?, ?)',
    [req.user.id, req.user.organization_id, name, description || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, description });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  if (req.user.role_name === 'super_admin') {
    db.run('UPDATE contact_groups SET name = ?, description = ? WHERE id = ?', [name, description || '', req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    });
  } else {
    db.run('UPDATE contact_groups SET name = ?, description = ? WHERE id = ? AND organization_id = ?', [name, description || '', req.params.id, req.user.organization_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role_name === 'super_admin') {
    db.run('DELETE FROM contact_groups WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  } else {
    db.run('DELETE FROM contact_groups WHERE id = ? AND organization_id = ?', [req.params.id, req.user.organization_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  }
});

module.exports = router;
