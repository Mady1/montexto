const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// List organizations (super_admin: all, org_admin: own org only)
router.get('/', (req, res) => {
  if (req.user.role_name === 'super_admin') {
    db.all('SELECT * FROM organizations ORDER BY created_at DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ data: rows });
    });
  } else {
    db.get('SELECT * FROM organizations WHERE id = ?', [req.user.organization_id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ data: row ? [row] : [] });
    });
  }
});

// Get single organization
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role_name !== 'super_admin' && req.user.organization_id !== id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.get('SELECT * FROM organizations WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Organization not found' });
    res.json(row);
  });
});

// Create organization (super_admin only)
router.post(
  '/',
  requireRole('super_admin'),
  auditLog('organization.create', null, (req) => req.body.name, (req) => `Created organization: ${req.body.name}`),
  (req, res) => {
    const { name, logo, address, email, phone, type, sms_balance } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    db.run(
      'INSERT INTO organizations (name, logo, address, email, phone, type, sms_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, logo || null, address || null, email || null, phone || null, type || 'entreprise', sms_balance || 0],
      function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ id: this.lastID, name, message: 'Organization created' });
      }
    );
  }
);

// Update organization
router.put(
  '/:id',
  auditLog('organization.update', null, (req) => req.params.id, (req) => `Updated organization #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    if (req.user.role_name !== 'super_admin' && req.user.organization_id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { name, logo, address, email, phone, type } = req.body;
    db.run(
      'UPDATE organizations SET name = COALESCE(?, name), logo = COALESCE(?, logo), address = COALESCE(?, address), email = COALESCE(?, email), phone = COALESCE(?, phone), type = COALESCE(?, type) WHERE id = ?',
      [name, logo, address, email, phone, type, id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Organization not found' });
        res.json({ message: 'Organization updated' });
      }
    );
  }
);

// Toggle organization status (super_admin only)
router.patch(
  '/:id/status',
  requireRole('super_admin'),
  auditLog('organization.status_change', null, (req) => req.params.id, (req) => `Changed status of org #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    db.run('UPDATE organizations SET status = ? WHERE id = ?', [status, id], function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Organization not found' });
      res.json({ message: 'Status updated' });
    });
  }
);

// Add SMS credits to organization (super_admin only)
router.post(
  '/:id/credits',
  requireRole('super_admin'),
  auditLog('organization.add_credits', null, (req) => req.params.id, (req) => `Added ${req.body.amount} credits to org #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    const { amount, description } = req.body;
    if (!amount || amount === 0) return res.status(400).json({ error: 'Amount required' });

    db.get('SELECT sms_balance FROM organizations WHERE id = ?', [id], (err, org) => {
      if (err || !org) return res.status(404).json({ error: 'Organization not found' });
      const newBalance = org.sms_balance + amount;
      db.serialize(() => {
        db.run('UPDATE organizations SET sms_balance = ? WHERE id = ?', [newBalance, id]);
        db.run(
          'INSERT INTO sms_credit_transactions (organization_id, amount, type, description, balance_after) VALUES (?, ?, ?, ?, ?)',
          [id, amount, amount > 0 ? 'credit' : 'debit', description || 'Manual adjustment', newBalance],
          function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ balance: newBalance, message: 'Credits updated' });
          }
        );
      });
    });
  }
);

// Get credit transaction history for an organization
router.get('/:id/credits', (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role_name !== 'super_admin' && req.user.organization_id !== id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.all(
    'SELECT * FROM sms_credit_transactions WHERE organization_id = ? ORDER BY created_at DESC',
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ data: rows });
    }
  );
});

// Delete organization (super_admin only)
router.delete(
  '/:id',
  requireRole('super_admin'),
  auditLog('organization.delete', null, (req) => req.params.id, (req) => `Deleted organization #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    db.run('DELETE FROM organizations WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Organization not found' });
      res.json({ message: 'Organization deleted' });
    });
  }
);

module.exports = router;
