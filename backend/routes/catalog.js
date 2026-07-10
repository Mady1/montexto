const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function orgWhere(req) {
  return req.user.role_name === 'super_admin' ? 'WHERE 1=1' : 'WHERE organization_id = ?';
}

function orgParams(req) {
  return req.user.role_name === 'super_admin' ? [] : [req.user.organization_id];
}

router.get('/', authenticateToken, (req, res) => {
  const { skip = 0, take = 20 } = req.query;
  const where = orgWhere(req);
  const params = orgParams(req);
  db.all(
    `SELECT * FROM catalog_items ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(take), Number(skip)],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT COUNT(*) as total FROM catalog_items ${where}`, params, (err2, count) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ data: rows, total: count.total });
      });
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  const { name, content, type = 'sms' } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
  db.run(
    'INSERT INTO catalog_items (user_id, organization_id, name, content, type) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, req.user.organization_id, name, content, type],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, content, type });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { name, content, type = 'sms' } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
  if (req.user.role_name === 'super_admin') {
    db.run('UPDATE catalog_items SET name = ?, content = ?, type = ? WHERE id = ?', [name, content, type, req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    });
  } else {
    db.run('UPDATE catalog_items SET name = ?, content = ?, type = ? WHERE id = ? AND organization_id = ?', [name, content, type, req.params.id, req.user.organization_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role_name === 'super_admin') {
    db.run('DELETE FROM catalog_items WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  } else {
    db.run('DELETE FROM catalog_items WHERE id = ? AND organization_id = ?', [req.params.id, req.user.organization_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  }
});

module.exports = router;
