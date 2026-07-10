const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function orgFilter(req) {
  return req.user.role_name === 'super_admin' ? {} : { organization_id: req.user.organization_id };
}

function buildWhere(req, extra = '') {
  const filter = orgFilter(req);
  if (filter.organization_id) {
    return `WHERE organization_id = ?${extra ? ' AND ' + extra : ''}`;
  }
  return extra ? `WHERE ${extra}` : 'WHERE 1=1';
}

router.get('/', authenticateToken, (req, res) => {
  const { skip = 0, take = 20, groupId } = req.query;
  const filter = orgFilter(req);
  let sql = 'SELECT * FROM contacts';
  let countSql = 'SELECT COUNT(*) as total FROM contacts';
  const params = [];
  const countParams = [];

  if (filter.organization_id) {
    sql += ' WHERE organization_id = ?';
    countSql += ' WHERE organization_id = ?';
    params.push(filter.organization_id);
    countParams.push(filter.organization_id);
  } else {
    sql += ' WHERE 1=1';
    countSql += ' WHERE 1=1';
  }

  if (groupId) {
    sql += ' AND group_id = ?';
    countSql += ' AND group_id = ?';
    params.push(groupId);
    countParams.push(groupId);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(take), Number(skip));

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get(countSql, countParams, (err2, count) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ data: rows, total: count.total });
    });
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { firstName, lastName, phone, email, groupId } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  db.run(
    'INSERT INTO contacts (user_id, organization_id, group_id, first_name, last_name, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.organization_id, groupId || null, firstName || '', lastName || '', phone, email || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, firstName, lastName, phone, email, groupId });
    }
  );
});

router.post('/bulk', authenticateToken, (req, res) => {
  const { contacts, groupId } = req.body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Contacts array required' });
  }
  const stmt = db.prepare(
    'INSERT INTO contacts (user_id, organization_id, group_id, first_name, last_name, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  let inserted = 0;
  for (const c of contacts) {
    stmt.run([req.user.id, req.user.organization_id, groupId || null, c.firstName || '', c.lastName || '', c.phone, c.email || '']);
    inserted++;
  }
  stmt.finalize();
  res.status(201).json({ inserted });
});

router.delete('/:id', authenticateToken, (req, res) => {
  const filter = orgFilter(req);
  if (filter.organization_id) {
    db.run('DELETE FROM contacts WHERE id = ? AND organization_id = ?', [req.params.id, filter.organization_id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  } else {
    db.run('DELETE FROM contacts WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  }
});

module.exports = router;
