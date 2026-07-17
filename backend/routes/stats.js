const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function toInt(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

router.get('/dashboard', authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const orgId = req.user.organization_id;

  const scopeWhere = isSuperAdmin ? '1=1' : 'organization_id = $1';
  const scopeParams = isSuperAdmin ? [] : [orgId];
  let paramOffset = isSuperAdmin ? 0 : 1;

  let dateFilter = '';
  const dateParams = [];
  if (startDate && endDate) {
    dateFilter = ` AND created_at::date BETWEEN $${paramOffset + 1}::date AND $${paramOffset + 2}::date`;
    dateParams.push(startDate, endDate);
    paramOffset += 2;
  }

  const allParams = [...scopeParams, ...dateParams];

  // SMS stats from campaign_recipients (covers both campaigns and direct sends)
  const smsSql = `SELECT
      COALESCE(COUNT(*), 0) as total_sent,
      COALESCE(COUNT(*) FILTER (WHERE cr.status IN ('delivered','sent','simulated')), 0) as delivered,
      COALESCE(COUNT(*) FILTER (WHERE cr.status = 'failed'), 0) as failed,
      COALESCE(COUNT(*) FILTER (WHERE cr.status IN ('pending','queued')), 0) as pending
    FROM campaign_recipients cr
    LEFT JOIN campaigns c ON c.id = cr.campaign_id
    WHERE (c.type = 'sms' OR c.type IS NULL) AND ${scopeWhere.replace('organization_id', 'cr.organization_id')}
    ${dateFilter.replace('created_at', 'cr.sent_at')}`;

  // Mail stats from campaigns
  const mailSql = `SELECT
      COALESCE(SUM(total_recipients), 0) as total_sent,
      COALESCE(SUM(delivered), 0) as delivered,
      COALESCE(SUM(failed), 0) as failed,
      COALESCE(SUM(pending), 0) as pending
    FROM campaigns WHERE ${scopeWhere} AND type = 'mail' ${dateFilter}`;

  // Groups count
  const groupsSql = `SELECT COUNT(*) as total FROM contact_groups WHERE ${scopeWhere}`;

  // Contacts count
  const contactsSql = `SELECT COUNT(*) as total FROM contacts WHERE ${scopeWhere}`;

  // Chart data - daily SMS activity from campaign_recipients
  const chartSql = `SELECT cr.sent_at::date as date, COUNT(*) as count
    FROM campaign_recipients cr
    LEFT JOIN campaigns c ON c.id = cr.campaign_id
    WHERE (c.type = 'sms' OR c.type IS NULL) AND ${scopeWhere.replace('organization_id', 'cr.organization_id')}
    ${dateFilter.replace('created_at', 'cr.sent_at')}
    GROUP BY cr.sent_at::date ORDER BY cr.sent_at::date`;

  // Recharges
  const rechargeDateFilter = dateFilter.replace('created_at', 'r.created_at').replace(/\$(\d+)/g, (m, n) => `$${Number(n) + (isSuperAdmin ? 0 : 1)}`);
  const rechargeScopeWhere = isSuperAdmin ? '1=1' : 'r.organization_id = $1';
  const rechargeSql = `SELECT r.* FROM recharges r WHERE ${rechargeScopeWhere} ${rechargeDateFilter} ORDER BY r.created_at DESC LIMIT 10`;
  const rechargeParams = isSuperAdmin ? [...dateParams] : [orgId, ...dateParams];

  Promise.all([
    new Promise((resolve, reject) => db.get(smsSql, allParams, (err, row) => err ? reject(err) : resolve(row))),
    new Promise((resolve, reject) => db.get(mailSql, allParams, (err, row) => err ? reject(err) : resolve(row))),
    new Promise((resolve, reject) => db.get(groupsSql, scopeParams, (err, row) => err ? reject(err) : resolve(row))),
    new Promise((resolve, reject) => db.get(contactsSql, scopeParams, (err, row) => err ? reject(err) : resolve(row))),
    new Promise((resolve, reject) => db.all(chartSql, allParams, (err, rows) => err ? reject(err) : resolve(rows))),
    new Promise((resolve, reject) => db.all(rechargeSql, rechargeParams, (err, rows) => err ? reject(err) : resolve(rows))),
  ])
  .then(([smsRaw, mailRaw, groupsRaw, contactsRaw, chart, recharges]) => {
    const smsTotal = toInt(smsRaw?.total_sent);
    const smsDelivered = toInt(smsRaw?.delivered);
    const mailTotal = toInt(mailRaw?.total_sent);
    const mailDelivered = toInt(mailRaw?.delivered);

    res.json({
      sms: {
        total_sent: smsTotal,
        delivered: smsDelivered,
        failed: toInt(smsRaw?.failed),
        pending: toInt(smsRaw?.pending),
        success_rate: smsTotal > 0 ? Math.round((smsDelivered / smsTotal) * 100) : 0,
      },
      mail: {
        total_sent: mailTotal,
        delivered: mailDelivered,
        failed: toInt(mailRaw?.failed),
        pending: toInt(mailRaw?.pending),
        opened: 0,
        success_rate: mailTotal > 0 ? Math.round((mailDelivered / mailTotal) * 100) : 0,
        open_rate: 0,
      },
      groups: toInt(groupsRaw?.total),
      contacts: toInt(contactsRaw?.total),
      chart: (chart || []).map((d) => ({ date: d.date, count: toInt(d.count) })),
      recharges: recharges || [],
    });
  })
  .catch((err) => {
    console.error('[stats/dashboard] error:', err);
    res.status(500).json({ error: err.message });
  });
});

module.exports = router;
