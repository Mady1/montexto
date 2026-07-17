const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');
const smsGateway = require('../services/smsGateway');
const mailGateway = require('../services/mailGateway');

const router = express.Router();

router.use(authenticateToken);

// Test a gateway's credentials (and optionally send a real test SMS/email),
// without requiring it to be saved first — lets the UI validate a draft config.
router.post('/test', requirePermission('admin.gateways'), async (req, res) => {
  const { provider, config, testPhone, testEmail } = req.body;
  if (!provider || !config) return res.status(400).json({ error: 'provider et config requis' });

  try {
    const result = provider === 'smtp'
      ? await mailGateway.testGateway({ config, testEmail })
      : await smsGateway.testGateway({ provider, config, testPhone });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all gateways
router.get('/', (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const where = isSuperAdmin ? '' : 'WHERE organization_id = ? OR organization_id IS NULL';
  const params = isSuperAdmin ? [] : [req.user.organization_id];
  db.all(`SELECT * FROM sms_gateways ${where} ORDER BY is_default DESC, created_at ASC`, params, (err, rows) => {
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
  const { name, provider, config, isDefault, channel = 'sms' } = req.body;
  if (!name || !provider) return res.status(400).json({ error: 'Name and provider required' });

  const orgId = req.user.role_name === 'super_admin' ? (req.body.organizationId || null) : req.user.organization_id;

  db.serialize(() => {
    if (isDefault) {
      db.run('UPDATE sms_gateways SET is_default = 0 WHERE channel = ? AND (organization_id = ? OR organization_id IS NULL)', [channel, orgId]);
    }
    db.run(
      'INSERT INTO sms_gateways (name, provider, config, is_default, status, channel, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, provider, config ? JSON.stringify(config) : null, isDefault ? 1 : 0, 'active', channel, orgId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, message: 'Gateway created' });
      }
    );
  });
});

// Update gateway
router.put('/:id', requirePermission('admin.gateways'), auditLog('gateway.update'), (req, res) => {
  const { name, provider, config, isDefault, status, channel } = req.body;

  db.get('SELECT * FROM sms_gateways WHERE id = ?', [req.params.id], (err, gateway) => {
    if (err || !gateway) return res.status(404).json({ error: 'Gateway not found' });

    const effectiveChannel = channel || gateway.channel || 'sms';

    const orgId = gateway.organization_id;

    db.serialize(() => {
      if (isDefault) {
        db.run('UPDATE sms_gateways SET is_default = 0 WHERE channel = ? AND (organization_id = ? OR organization_id IS NULL)', [effectiveChannel, orgId]);
      }
      db.run(
        'UPDATE sms_gateways SET name = ?, provider = ?, config = ?, is_default = ?, status = ?, channel = ? WHERE id = ?',
        [
          name || gateway.name,
          provider || gateway.provider,
          config ? JSON.stringify(config) : gateway.config,
          isDefault !== undefined ? (isDefault ? 1 : 0) : gateway.is_default,
          status || gateway.status,
          effectiveChannel,
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

// Set default gateway (scoped to its own channel, so an SMS default and a
// mail default can coexist)
router.patch('/:id/default', requirePermission('admin.gateways'), auditLog('gateway.set_default'), (req, res) => {
  db.get('SELECT channel FROM sms_gateways WHERE id = ?', [req.params.id], (err, gateway) => {
    if (err || !gateway) return res.status(404).json({ error: 'Gateway not found' });

    const orgId = gateway.organization_id;

    db.serialize(() => {
      db.run('UPDATE sms_gateways SET is_default = 0 WHERE channel = ? AND (organization_id = ? OR organization_id IS NULL)', [gateway.channel || 'sms', orgId]);
      db.run('UPDATE sms_gateways SET is_default = 1 WHERE id = ?', [req.params.id], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Default gateway set' });
      });
    });
  });
});

module.exports = router;
