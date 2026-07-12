const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  if (req.user.role_name === 'super_admin') {
    db.all('SELECT id, name, key_value, created_at, last_used_at FROM api_keys ORDER BY created_at DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    db.all('SELECT id, name, key_value, created_at, last_used_at FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC', [req.user.organization_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});

router.post('/', authenticateToken, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const keyValue = `mtk_${uuidv4().replace(/-/g, '')}`;
  db.run(
    'INSERT INTO api_keys (user_id, organization_id, name, key_value) VALUES (?, ?, ?, ?)',
    [req.user.id, req.user.organization_id, name, keyValue],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, keyValue });
    }
  );
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role_name === 'super_admin') {
    db.run('DELETE FROM api_keys WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  } else {
    db.run('DELETE FROM api_keys WHERE id = ? AND organization_id = ?', [req.params.id, req.user.organization_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  }
});

module.exports = router;
