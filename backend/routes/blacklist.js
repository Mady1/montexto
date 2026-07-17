const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

// ─── List blacklist entries ──────────────────────────────────────
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;
  const isSuperAdmin = req.user.role_name === 'super_admin';

  let where = '';
  let params = [];
  if (!isSuperAdmin) {
    where = 'WHERE b.organization_id = ?';
    params.push(req.user.organization_id);
  }
  if (search) {
    where += where ? ' AND b.phone LIKE ?' : 'WHERE b.phone LIKE ?';
    params.push(`%${search}%`);
  }

  db.get(
    `SELECT COUNT(*) as total FROM blacklist b ${where}`,
    params,
    (err, countRow) => {
      db.all(
        `SELECT b.*, u.first_name, u.last_name
         FROM blacklist b
         LEFT JOIN users u ON u.id = b.created_by
         ${where}
         ORDER BY b.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)],
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: 'Database error' });
          res.json({
            data: rows,
            total: countRow?.total || 0,
            page: parseInt(page),
            totalPages: Math.ceil((countRow?.total || 0) / limit),
          });
        }
      );
    }
  );
});

// ─── Add to blacklist ────────────────────────────────────────────
router.post('/', authenticateToken, requirePermission('contacts.edit'), auditLog('blacklist.add', 'blacklist', null, (req) => ({ phone: req.body.phone, reason: req.body.reason })), (req, res) => {
  const { phone, reason = 'manual', organizationId } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });

  const orgId = req.user.role_name === 'super_admin' ? (organizationId || req.user.organization_id) : req.user.organization_id;

  db.run(
    'INSERT INTO blacklist (organization_id, phone, reason, source, created_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT (organization_id, phone) DO NOTHING',
    [orgId, phone, reason, 'manual', req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) {
        return res.status(409).json({ error: 'Ce numéro est déjà en liste noire' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// ─── Bulk add to blacklist ───────────────────────────────────────
router.post('/bulk', authenticateToken, requirePermission('contacts.edit'), (req, res) => {
  const { phones, reason = 'manual' } = req.body;
  if (!phones || !Array.isArray(phones) || !phones.length) {
    return res.status(400).json({ error: 'Phones array required' });
  }

  const orgId = req.user.organization_id;
  let added = 0;

  const stmt = db.prepare(
    'INSERT INTO blacklist (organization_id, phone, reason, source, created_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT (organization_id, phone) DO NOTHING'
  );

  phones.forEach((phone) => {
    stmt.run(orgId, phone, reason, 'manual', req.user.id, function () {
      if (this.changes > 0) added++;
    });
  });

  stmt.finalize(() => {
    res.json({ success: true, added });
  });
});

// ─── Remove from blacklist ───────────────────────────────────────
router.delete('/:id', authenticateToken, requirePermission('contacts.edit'), auditLog('blacklist.remove', 'blacklist', (req) => req.params.id), (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const where = isSuperAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND organization_id = ?';
  const params = isSuperAdmin ? [req.params.id] : [req.params.id, req.user.organization_id];

  db.run(`DELETE FROM blacklist ${where}`, params, function (err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });
});

// ─── Check if a number is blacklisted ────────────────────────────
router.get('/check/:phone', authenticateToken, (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const where = isSuperAdmin ? 'WHERE phone = ?' : 'WHERE phone = ? AND organization_id = ?';
  const params = isSuperAdmin ? [req.params.phone] : [req.params.phone, req.user.organization_id];

  db.get(`SELECT * FROM blacklist ${where}`, params, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ blacklisted: !!row, data: row });
  });
});

// ─── Blacklist stats ─────────────────────────────────────────────
router.get('/stats', authenticateToken, (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const where = isSuperAdmin ? '' : 'WHERE organization_id = ?';
  const params = isSuperAdmin ? [] : [req.user.organization_id];

  db.all(
    `SELECT
       COUNT(*) as total,
       COALESCE(SUM(CASE WHEN reason = 'opt_out_sms' THEN 1 ELSE 0 END), 0) as opt_outs,
       COALESCE(SUM(CASE WHEN reason = 'manual' THEN 1 ELSE 0 END), 0) as manual,
       COALESCE(SUM(CASE WHEN source = 'inbound' THEN 1 ELSE 0 END), 0) as from_inbound
     FROM blacklist ${where}`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ data: rows[0] || { total: 0, opt_outs: 0, manual: 0, from_inbound: 0 } });
    }
  );
});

module.exports = router;
