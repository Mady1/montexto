const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');
const { sendSms } = require('../services/twilio');
const smsWorker = require('../services/smsWorker');

const router = express.Router();

router.use(authenticateToken);

// Send a single SMS
router.post('/send', requirePermission('sms.send'), auditLog('sms.send'), async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Phone and message required' });

  // Check org SMS balance for non-super-admins
  if (req.user.organization_id) {
    db.get('SELECT sms_balance FROM organizations WHERE id = ?', [req.user.organization_id], (err, org) => {
      if (err || !org) return res.status(500).json({ error: 'Organization not found' });
      if (org.sms_balance <= 0) return res.status(403).json({ error: 'Insufficient SMS credits' });

      doSend(req, res, to, message);
    });
  } else {
    doSend(req, res, to, message);
  }
});

function doSend(req, res, to, message) {
  // Check blacklist
  db.get('SELECT id FROM blacklist WHERE organization_id = ? AND phone = ?', [req.user.organization_id, to], (blErr, blRow) => {
    if (blRow) return res.status(403).json({ error: 'Ce numéro est en liste noire (DND)' });

  const result = sendSms({ to, body: message });
  result.then((smsResult) => {
    // Deduct credit from org
    if (req.user.organization_id && smsResult.status !== 'failed') {
      db.run('UPDATE organizations SET sms_balance = sms_balance - 1 WHERE id = ?', [req.user.organization_id]);
    }

    // Log in campaign_recipients as a standalone SMS (campaign_id = null)
    db.run(
      'INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone, status, error_message, twilio_sid, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [null, req.user.organization_id, null, to, smsResult.status === 'simulated' ? 'simulated' : (smsResult.error ? 'failed' : 'delivered'), smsResult.error, smsResult.sid, new Date().toISOString()],
      function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({
          id: this.lastID,
          to,
          message,
          status: smsResult.status,
          sid: smsResult.sid,
          error: smsResult.error,
        });
      }
    );
  });
  });
}

// Send bulk SMS (direct, not via campaign)
router.post('/send-bulk', requirePermission('sms.send_bulk'), auditLog('sms.send_bulk'), async (req, res) => {
  const { phones, message } = req.body;
  if (!Array.isArray(phones) || phones.length === 0 || !message) {
    return res.status(400).json({ error: 'Phones array and message required' });
  }

  // Check org SMS balance
  if (req.user.organization_id) {
    db.get('SELECT sms_balance FROM organizations WHERE id = ?', [req.user.organization_id], (err, org) => {
      if (err || !org) return res.status(500).json({ error: 'Organization not found' });
      if (org.sms_balance < phones.length) {
        return res.status(403).json({ error: `Insufficient SMS credits. Need ${phones.length}, have ${org.sms_balance}` });
      }
      doBulkSend(req, res, phones, message);
    });
  } else {
    doBulkSend(req, res, phones, message);
  }
});

async function doBulkSend(req, res, phones, message) {
  // Filter out blacklisted numbers
  const blacklisted = new Set();
  if (req.user.organization_id) {
    const blRows = await new Promise((resolve) => {
      db.all('SELECT phone FROM blacklist WHERE organization_id = ?', [req.user.organization_id], (e, r) => resolve(r || []));
    });
    blRows.forEach((r) => blacklisted.add(r.phone));
  }

  const validPhones = phones.filter((p) => !blacklisted.has(p));
  const skipped = phones.length - validPhones.length;

  let delivered = 0;
  let failed = 0;
  const results = [];

  for (const phone of validPhones) {
    const smsResult = await sendSms({ to: phone, body: message });
    const status = smsResult.status === 'simulated' ? 'simulated' : (smsResult.error ? 'failed' : 'delivered');

    db.run(
      'INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone, status, error_message, twilio_sid, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [null, req.user.organization_id, null, phone, status, smsResult.error, smsResult.sid, new Date().toISOString()]
    );

    if (smsResult.error) failed++;
    else delivered++;

    results.push({ phone, status, sid: smsResult.sid, error: smsResult.error });
  }

  // Deduct credits
  if (req.user.organization_id) {
    db.run('UPDATE organizations SET sms_balance = sms_balance - ? WHERE id = ?', [delivered, req.user.organization_id]);
  }

  res.status(201).json({ total: phones.length, delivered, failed, skipped, results });
}

// SMS history (standalone SMS + campaign recipients)
router.get('/history', requirePermission('sms.history'), (req, res) => {
  const { skip = 0, take = 20, status, search } = req.query;
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const scopeWhere = isSuperAdmin ? '' : 'AND cr.organization_id = ?';
  const scopeParams = isSuperAdmin ? [] : [req.user.organization_id];

  let sql = `SELECT cr.*, c.first_name, c.last_name
             FROM campaign_recipients cr
             LEFT JOIN contacts c ON cr.contact_id = c.id
             WHERE cr.campaign_id IS NULL ${scopeWhere}`;
  const params = [...scopeParams];

  if (status) {
    sql += ' AND cr.status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (cr.phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY cr.sent_at DESC LIMIT ? OFFSET ?';
  params.push(Number(take), Number(skip));

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    let countSql = `SELECT COUNT(*) as total FROM campaign_recipients cr WHERE cr.campaign_id IS NULL ${scopeWhere}`;
    db.get(countSql, scopeParams, (err2, count) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ data: rows, total: count.total });
    });
  });
});

module.exports = router;
