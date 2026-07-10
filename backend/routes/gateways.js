const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

router.use(authenticateToken);

// List all gateways
router.get('/', (req, res) => {
  db.all('SELECT * FROM sms_gateways ORDER BY is_default DESC, created_at ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// Get single gateway
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM sms_gateways WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Gateway not found' });
    res.json(row);
  });
});

// Create gateway
router.post('/', requirePermission('admin.gateways'), auditLog('gateway.create'), (req, res) => {
  const { name, provider, config, isDefault } = req.body;
  if (!name || !provider) return res.status(400).json({ error: 'Name and provider required' });

  db.serialize(() => {
    if (isDefault) {
      db.run('UPDATE sms_gateways SET is_default = 0');
    }
    db.run(
      'INSERT INTO sms_gateways (name, provider, config, is_default, status) VALUES (?, ?, ?, ?, ?)',
      [name, provider, config ? JSON.stringify(config) : null, isDefault ? 1 : 0, 'active'],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, message: 'Gateway created' });
      }
    );
  });
});

// Update gateway
router.put('/:id', requirePermission('admin.gateways'), auditLog('gateway.update'), (req, res) => {
  const { name, provider, config, isDefault, status } = req.body;

  db.get('SELECT * FROM sms_gateways WHERE id = ?', [req.params.id], (err, gateway) => {
    if (err || !gateway) return res.status(404).json({ error: 'Gateway not found' });

    db.serialize(() => {
      if (isDefault) {
        db.run('UPDATE sms_gateways SET is_default = 0');
      }
      db.run(
        'UPDATE sms_gateways SET name = ?, provider = ?, config = ?, is_default = ?, status = ? WHERE id = ?',
        [
          name || gateway.name,
          provider || gateway.provider,
          config ? JSON.stringify(config) : gateway.config,
          isDefault !== undefined ? (isDefault ? 1 : 0) : gateway.is_default,
          status || gateway.status,
          gateway.id,
        ],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ message: 'Gateway updated' });
        }
      );
    });
  });
});

// Delete gateway
router.delete('/:id', requirePermission('admin.gateways'), auditLog('gateway.delete'), (req, res) => {
  db.get('SELECT * FROM sms_gateways WHERE id = ?', [req.params.id], (err, gateway) => {
    if (err || !gateway) return res.status(404).json({ error: 'Gateway not found' });
    if (gateway.is_default) return res.status(400).json({ error: 'Cannot delete the default gateway' });

    db.run('DELETE FROM sms_gateways WHERE id = ?', [gateway.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Gateway deleted' });
    });
  });
});

// Set default gateway
router.patch('/:id/default', requirePermission('admin.gateways'), auditLog('gateway.set_default'), (req, res) => {
  db.serialize(() => {
    db.run('UPDATE sms_gateways SET is_default = 0');
    db.run('UPDATE sms_gateways SET is_default = 1 WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Default gateway set' });
    });
  });
});

module.exports = router;
