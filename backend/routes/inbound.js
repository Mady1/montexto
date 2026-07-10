const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

// ─── Webhook: receive inbound SMS from gateways ──────────────────
// This route is public (called by gateways like Twilio, Orange, etc.)
router.post('/inbound', (req, res) => {
  const { From, To, Body, MessageSid, AccountSid, from, to, body, messageId, provider } = req.body;

  const fromPhone = From || from || '';
  const toPhone = To || to || '';
  const message = Body || body || '';
  const gatewayMsgId = MessageSid || messageId || '';
  const gatewayProvider = provider || 'twilio';

  if (!fromPhone || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Try to find the organization by the destination number or gateway config
  // For now, try to match by the most recent campaign that sent to this number
  db.get(
    `SELECT cr.organization_id, cr.campaign_id, cr.contact_id
     FROM campaign_recipients cr
     WHERE cr.phone = ?
     ORDER BY cr.id DESC LIMIT 1`,
    [fromPhone],
    (err, row) => {
      const orgId = row?.organization_id || null;
      const campaignId = row?.campaign_id || null;
      const contactId = row?.contact_id || null;

      db.run(
        'INSERT INTO inbound_sms (organization_id, from_phone, to_phone, message, gateway_provider, gateway_message_id, campaign_id, contact_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orgId, fromPhone, toPhone, message, gatewayProvider, gatewayMsgId, campaignId, contactId],
        (err2) => {
          if (err2) {
            console.error('[Inbound SMS] Error saving:', err2);
            return res.status(500).json({ error: 'Database error' });
          }

          // Check for opt-out keywords
          const optOutKeywords = ['STOP', 'ARRET', 'DESINSCRIPTION', 'UNSUBSCRIBE', 'DND'];
          const upperMessage = message.toUpperCase().trim();
          if (optOutKeywords.some((kw) => upperMessage.includes(kw)) && orgId) {
            db.run(
              'INSERT OR IGNORE INTO blacklist (organization_id, phone, reason, source) VALUES (?, ?, ?, ?)',
              [orgId, fromPhone, 'opt_out_sms', 'inbound'],
              () => {
                console.log(`[Inbound SMS] ${fromPhone} opted out (blacklisted)`);
              }
            );
          }

          // Create notification for org admins
          if (orgId) {
            db.run(
              `INSERT INTO notifications (user_id, organization_id, title, message, type, link)
               SELECT NULL, ?, 'SMS reçu', ?, 'info', '/inbox'
               WHERE EXISTS (SELECT 1 FROM organizations WHERE id = ?)`,
              [orgId, `Nouveau SMS de ${fromPhone}: ${message.substring(0, 50)}`, orgId]
            );
          }

          res.json({ status: 'received' });
        }
      );
    }
  );
});

// ─── List inbound SMS (authenticated) ────────────────────────────
router.get('/inbox', authenticateToken, (req, res) => {
  const { page = 1, limit = 50, unreadOnly } = req.query;
  const offset = (page - 1) * limit;
  const isSuperAdmin = req.user.role_name === 'super_admin';

  let where = '';
  let params = [];
  if (!isSuperAdmin) {
    where = 'WHERE i.organization_id = ?';
    params.push(req.user.organization_id);
  }
  if (unreadOnly === 'true') {
    where += where ? ' AND i.is_read = 0' : 'WHERE i.is_read = 0';
  }

  db.get(
    `SELECT COUNT(*) as total FROM inbound_sms i ${where}`,
    params,
    (err, countRow) => {
      db.all(
        `SELECT i.*, c.first_name, c.last_name
         FROM inbound_sms i
         LEFT JOIN contacts c ON c.id = i.contact_id
         ${where}
         ORDER BY i.received_at DESC
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

// ─── Mark inbound SMS as read ────────────────────────────────────
router.patch('/inbox/:id/read', authenticateToken, (req, res) => {
  db.run('UPDATE inbound_sms SET is_read = 1 WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
  });
});

// ─── Mark all inbound SMS as read ────────────────────────────────
router.patch('/inbox/read-all', authenticateToken, (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  if (isSuperAdmin) {
    db.run('UPDATE inbound_sms SET is_read = 1 WHERE is_read = 0', (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true });
    });
  } else {
    db.run('UPDATE inbound_sms SET is_read = 1 WHERE is_read = 0 AND organization_id = ?', [req.user.organization_id], (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true });
    });
  }
});

// ─── Delete inbound SMS ──────────────────────────────────────────
router.delete('/inbox/:id', authenticateToken, requirePermission('sms.delete'), auditLog('sms.inbox_delete', 'inbound_sms', (req) => req.params.id), (req, res) => {
  db.run('DELETE FROM inbound_sms WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
  });
});

// ─── Inbound stats ───────────────────────────────────────────────
router.get('/inbox/stats', authenticateToken, (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const where = isSuperAdmin ? '' : 'WHERE organization_id = ?';
  const params = isSuperAdmin ? [] : [req.user.organization_id];

  db.all(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
       COUNT(DISTINCT from_phone) as unique_senders
     FROM inbound_sms ${where}`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ data: rows[0] || { total: 0, unread: 0, unique_senders: 0 } });
    }
  );
});

module.exports = router;
