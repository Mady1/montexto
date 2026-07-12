const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;
  const isSuperAdmin = req.user.role_name === 'super_admin';
  const scopeCol = isSuperAdmin ? '1=1' : 'organization_id = ?';
  const scopeParams = isSuperAdmin ? [] : [req.user.organization_id];
  
  let dateFilter = '';
  if (startDate && endDate) {
    dateFilter = ' AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)';
  }
  const dateParams = (startDate && endDate) ? [startDate, endDate] : [];

  db.get(
    `SELECT
      COALESCE(SUM(total_recipients), 0) as total_sent,
      COALESCE(SUM(delivered), 0) as delivered,
      COALESCE(SUM(failed), 0) as failed,
      COALESCE(SUM(pending), 0) as pending
    FROM campaigns WHERE ${scopeCol} AND type = 'sms' ${dateFilter}`,
    [...scopeParams, ...dateParams],
    (err, smsStats) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(
        `SELECT
          COALESCE(SUM(total_recipients), 0) as total_sent,
          COALESCE(SUM(delivered), 0) as delivered,
          COALESCE(SUM(failed), 0) as failed,
          COALESCE(SUM(pending), 0) as pending
        FROM campaigns WHERE ${scopeCol} AND type = 'mail' ${dateFilter}`,
        [...scopeParams, ...dateParams],
        (errMail, mailStats) => {
          if (errMail) return res.status(500).json({ error: errMail.message });
          db.get(
            `SELECT COUNT(*) as total_groups FROM contact_groups WHERE ${scopeCol}`,
            scopeParams,
            (err2, groups) => {
              if (err2) return res.status(500).json({ error: err2.message });
              db.get(
                `SELECT COUNT(*) as total_contacts FROM contacts WHERE ${scopeCol}`,
                scopeParams,
                (err3, contacts) => {
                  if (err3) return res.status(500).json({ error: err3.message });
                  db.all(
                    `SELECT DATE(created_at) as date, SUM(total_recipients) as count
                     FROM campaigns WHERE ${scopeCol} ${dateFilter}
                     GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
                    [...scopeParams, ...dateParams],
                    (err4, chart) => {
                      if (err4) return res.status(500).json({ error: err4.message });
                      db.all(
                        `SELECT * FROM recharges WHERE ${scopeCol} ORDER BY created_at DESC LIMIT 10`,
                        scopeParams,
                        (err5, recharges) => {
                          if (err5) return res.status(500).json({ error: err5.message });
                          res.json({
                            sms: { ...smsStats, success_rate: smsStats.total_sent > 0 ? Math.round((smsStats.delivered / smsStats.total_sent) * 100) : 0 },
                            mail: { ...mailStats, opened: 0, success_rate: mailStats.total_sent > 0 ? Math.round((mailStats.delivered / mailStats.total_sent) * 100) : 0, open_rate: 0 },
                            groups: groups.total_groups,
                            contacts: contacts.total_contacts,
                            chart,
                            recharges
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

module.exports = router;
