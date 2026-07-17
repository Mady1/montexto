const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');
const smsSender = require('../services/smsSender');

const router = express.Router();

router.use(authenticateToken);

// Send a single SMS
router.post('/send', requirePermission('sms.send'), auditLog('sms.send'), async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Phone and message required' });

  try {
    const isSuperAdmin = req.user.role_name === 'super_admin';
    const result = await smsSender.sendSingleSms({ organizationId: req.user.organization_id, to, message, skipCreditCheck: isSuperAdmin });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Send bulk SMS (direct, not via campaign)
router.post('/send-bulk', requirePermission('sms.send_bulk'), auditLog('sms.send_bulk'), async (req, res) => {
  const { phones, message } = req.body;
  if (!Array.isArray(phones) || phones.length === 0 || !message) {
    return res.status(400).json({ error: 'Phones array and message required' });
  }

  try {
    const isSuperAdmin = req.user.role_name === 'super_admin';
    const result = await smsSender.sendBulkSms({ organizationId: req.user.organization_id, phones, message, skipCreditCheck: isSuperAdmin });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// SMS history (standalone SMS + campaign recipients)
router.get('/history', requirePermission('sms.history'), (req, res) => {
  const { skip = 0, take = 20, status, search } = req.query;
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const scopeWhere = isSuperAdmin ? '' : 'AND cr.organization_id = ?';
  const scopeParams = isSuperAdmin ? [] : [req.user.organization_id];

  let filterSql = `WHERE cr.campaign_id IS NULL ${scopeWhere}`;
  const filterParams = [...scopeParams];

  if (status) {
    filterSql += ' AND cr.status = ?';
    filterParams.push(status);
  }
  if (search) {
    filterSql += ' AND (cr.phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)';
    filterParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const sql = `SELECT cr.*, c.first_name, c.last_name
             FROM campaign_recipients cr
             LEFT JOIN contacts c ON cr.contact_id = c.id
             ${filterSql}
             ORDER BY cr.sent_at DESC LIMIT ? OFFSET ?`;
  const params = [...filterParams, Number(take), Number(skip)];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const countSql = `SELECT COUNT(*) as total FROM campaign_recipients cr LEFT JOIN contacts c ON cr.contact_id = c.id ${filterSql}`;
    db.get(countSql, filterParams, (err2, count) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ data: rows, total: count.total });
    });
  });
});

module.exports = router;
