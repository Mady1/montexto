const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');
const smsGateway = require('../services/smsGateway');
const { renderTemplate } = require('../services/templateEngine');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.use(authenticateToken);

function orgScope(req) {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  return {
    where: isSuperAdmin ? '' : 'WHERE organization_id = ?',
    params: isSuperAdmin ? [] : [req.user.organization_id],
    whereId: isSuperAdmin ? 'id = ?' : 'id = ? AND organization_id = ?',
    paramsId: (id) => isSuperAdmin ? [id] : [id, req.user.organization_id],
  };
}

router.get('/', (req, res) => {
  const { skip = 0, take = 20 } = req.query;
  const { where, params } = orgScope(req);
  db.all(
    `SELECT * FROM campaigns ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(take), Number(skip)],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT COUNT(*) as total FROM campaigns ${where}`, params, (err2, count) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ data: rows, total: count.total });
      });
    }
  );
});

router.get('/:id', (req, res) => {
  const { whereId, paramsId } = orgScope(req);
  db.get(`SELECT * FROM campaigns WHERE ${whereId}`, paramsId(req.params.id), (err, campaign) => {
    if (err || !campaign) return res.status(404).json({ error: 'Campaign not found' });
    db.all(
      'SELECT cr.*, c.first_name, c.last_name FROM campaign_recipients cr LEFT JOIN contacts c ON cr.contact_id = c.id WHERE cr.campaign_id = ?',
      [campaign.id],
      (err2, recipients) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ...campaign, recipients });
      }
    );
  });
});

router.post('/', requirePermission('campaigns.create'), auditLog('campaign.create'), async (req, res) => {
  const { name, message, type = 'sms', groupId, recipients: manualRecipients = [], scheduleAt } = req.body;

  let phones = [];
  if (groupId) {
    const rows = await new Promise((resolve, reject) => {
      const isSuperAdmin = req.user.role_name === 'super_admin';
    const contactWhere = isSuperAdmin ? 'group_id = ?' : 'group_id = ? AND organization_id = ?';
    const contactParams = isSuperAdmin ? [groupId] : [groupId, req.user.organization_id];
    db.all(`SELECT phone, id FROM contacts WHERE ${contactWhere}`, contactParams, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    phones = rows.map((r) => ({ phone: r.phone, contactId: r.id }));
  } else if (manualRecipients.length) {
    phones = manualRecipients.map((p) => ({ phone: p, contactId: null }));
  }

  const total = phones.length;
  const status = scheduleAt ? 'scheduled' : 'sent';

  // Filter out blacklisted numbers
  let blacklistedCount = 0;
  if (req.user.organization_id && phones.length > 0) {
    const blRows = await new Promise((resolve) => {
      db.all('SELECT phone FROM blacklist WHERE organization_id = ?', [req.user.organization_id], (e, r) => resolve(r || []));
    });
    const blSet = new Set(blRows.map((r) => r.phone));
    const filtered = phones.filter((p) => {
      if (blSet.has(p.phone)) { blacklistedCount++; return false; }
      return true;
    });
    phones = filtered;
  }

  const actualTotal = phones.length;

  const campaignId = await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO campaigns (user_id, organization_id, name, message, type, status, scheduled_at, total_recipients, pending) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, req.user.organization_id, name, message, type, status, scheduleAt || null, actualTotal, actualTotal],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

  const stmt = db.prepare('INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone) VALUES (?, ?, ?, ?)');
  for (const { phone, contactId } of phones) {
    stmt.run(campaignId, req.user.organization_id, contactId, phone);
  }
  stmt.finalize();

  // If scheduled, don't send now
  if (scheduleAt) {
    return res.status(201).json({ id: campaignId, total: actualTotal, blacklisted: blacklistedCount, status: 'scheduled', message: 'Campaign scheduled' });
  }

  // Send messages
  const recipientRows = await new Promise((resolve, reject) => {
    db.all(
      'SELECT cr.*, c.first_name, c.last_name, c.email FROM campaign_recipients cr LEFT JOIN contacts c ON cr.contact_id = c.id WHERE cr.campaign_id = ?',
      [campaignId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  const gateway = await smsGateway.getDefaultGateway();

  let delivered = 0;
  let failed = 0;
  for (const recipient of recipientRows) {
    const personalizedMessage = renderTemplate(message, recipient);
    const result = await smsGateway.sendSms({ to: recipient.phone, body: personalizedMessage, gateway });
    if (result.error) {
      failed++;
      db.run('UPDATE campaign_recipients SET status = ?, error_message = ?, sent_at = ? WHERE id = ?', [
        'failed', result.error, new Date().toISOString(), recipient.id
      ]);
    } else {
      delivered++;
      db.run('UPDATE campaign_recipients SET status = ?, twilio_sid = ?, sent_at = ? WHERE id = ?', [
        result.status === 'simulated' ? 'simulated' : 'delivered', result.sid, new Date().toISOString(), recipient.id
      ]);
    }
  }

  db.run(
    'UPDATE campaigns SET delivered = ?, failed = ?, pending = 0, status = ? WHERE id = ?',
    [delivered, failed, 'sent', campaignId]
  );

  res.status(201).json({ id: campaignId, total, delivered, failed });
});

// Update campaign (only if draft or scheduled)
router.put('/:id', requirePermission('campaigns.edit'), auditLog('campaign.update'), (req, res) => {
  const { whereId, paramsId } = orgScope(req);
  const { name, message, type, scheduledAt } = req.body;

  db.get(`SELECT * FROM campaigns WHERE ${whereId}`, paramsId(req.params.id), (err, campaign) => {
    if (err || !campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sent' || campaign.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot edit a sent or cancelled campaign' });
    }

    db.run(
      'UPDATE campaigns SET name = ?, message = ?, type = ?, scheduled_at = ? WHERE id = ?',
      [name || campaign.name, message || campaign.message, type || campaign.type, scheduledAt || campaign.scheduled_at, campaign.id],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Campaign updated' });
      }
    );
  });
});

// Validate/approve a campaign (change status from draft → validated)
router.patch('/:id/validate', requirePermission('campaigns.validate'), auditLog('campaign.validate'), (req, res) => {
  const { whereId, paramsId } = orgScope(req);
  db.get(`SELECT * FROM campaigns WHERE ${whereId}`, paramsId(req.params.id), (err, campaign) => {
    if (err || !campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft campaigns can be validated' });
    }
    db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['validated', campaign.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Campaign validated', status: 'validated' });
    });
  });
});

// Cancel a campaign (only if not already sent)
router.patch('/:id/cancel', requirePermission('campaigns.cancel'), auditLog('campaign.cancel'), (req, res) => {
  const { whereId, paramsId } = orgScope(req);
  db.get(`SELECT * FROM campaigns WHERE ${whereId}`, paramsId(req.params.id), (err, campaign) => {
    if (err || !campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sent') {
      return res.status(400).json({ error: 'Cannot cancel a sent campaign' });
    }
    db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['cancelled', campaign.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Campaign cancelled', status: 'cancelled' });
    });
  });
});

// Delete a campaign
router.delete('/:id', requirePermission('campaigns.delete'), auditLog('campaign.delete'), (req, res) => {
  const { whereId, paramsId } = orgScope(req);
  db.get(`SELECT * FROM campaigns WHERE ${whereId}`, paramsId(req.params.id), (err, campaign) => {
    if (err || !campaign) return res.status(404).json({ error: 'Campaign not found' });
    db.serialize(() => {
      db.run('DELETE FROM campaign_recipients WHERE campaign_id = ?', [campaign.id]);
      db.run('DELETE FROM campaigns WHERE id = ?', [campaign.id], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Campaign deleted' });
      });
    });
  });
});

module.exports = router;
