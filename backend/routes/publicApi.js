const express = require('express');
const db = require('../config/db');
const { authenticateApiKey } = require('../middleware/apiKeyAuth');
const { requirePermission } = require('../middleware/rbac');
const { rateLimit } = require('../middleware/rateLimit');
const smsSender = require('../services/smsSender');

const router = express.Router();

router.use(authenticateApiKey);
router.use(rateLimit({ windowMs: 60000, max: 60, key: 'public_api' }));

// POST /api/v1/sms/send — { to, message }
router.post('/sms/send', requirePermission('sms.send'), async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' });

  try {
    const result = await smsSender.sendSingleSms({ organizationId: req.user.organization_id, to, message });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// POST /api/v1/sms/send-bulk — { phones: string[], message }
router.post('/sms/send-bulk', requirePermission('sms.send_bulk'), async (req, res) => {
  const { phones, message } = req.body;
  if (!Array.isArray(phones) || phones.length === 0 || !message) {
    return res.status(400).json({ error: 'phones (array) and message are required' });
  }

  try {
    const result = await smsSender.sendBulkSms({ organizationId: req.user.organization_id, phones, message });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// GET /api/v1/balance — remaining SMS credits for the key's organization
router.get('/balance', (req, res) => {
  if (!req.user.organization_id) return res.json({ organizationId: null, smsBalance: null });
  db.get('SELECT sms_balance FROM organizations WHERE id = ?', [req.user.organization_id], (err, org) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ organizationId: req.user.organization_id, smsBalance: org ? org.sms_balance : 0 });
  });
});

module.exports = router;
