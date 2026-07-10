const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

// List audit logs with filtering
router.get('/', (req, res) => {
  const { user_id, organization_id, action, entity_type, start_date, end_date, page, limit } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Number(limit) || 50);
  const offset = (pageNum - 1) * pageSize;

  let sql = `
    SELECT a.*, u.email as user_email, u.first_name, u.last_name, o.name as organization_name
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN organizations o ON o.id = a.organization_id
    WHERE 1=1
  `;
  let countSql = 'SELECT COUNT(*) as total FROM audit_logs a WHERE 1=1';
  const params = [];
  const countParams = [];

  // Non-super-admins can only see their org's logs
  if (req.user.role_name !== 'super_admin') {
    sql += ' AND a.organization_id = ?';
    countSql += ' AND a.organization_id = ?';
    params.push(req.user.organization_id);
    countParams.push(req.user.organization_id);
  } else if (organization_id) {
    sql += ' AND a.organization_id = ?';
    countSql += ' AND a.organization_id = ?';
    params.push(organization_id);
    countParams.push(organization_id);
  }

  if (user_id) {
    sql += ' AND a.user_id = ?';
    countSql += ' AND a.user_id = ?';
    params.push(user_id);
    countParams.push(user_id);
  }
  if (action) {
    sql += ' AND a.action LIKE ?';
    countSql += ' AND a.action LIKE ?';
    params.push(`%${action}%`);
    countParams.push(`%${action}%`);
  }
  if (entity_type) {
    sql += ' AND a.entity_type = ?';
    countSql += ' AND a.entity_type = ?';
    params.push(entity_type);
    countParams.push(entity_type);
  }
  if (start_date) {
    sql += ' AND a.created_at >= ?';
    countSql += ' AND a.created_at >= ?';
    params.push(start_date);
    countParams.push(start_date);
  }
  if (end_date) {
    sql += ' AND a.created_at <= ?';
    countSql += ' AND a.created_at <= ?';
    params.push(end_date);
    countParams.push(end_date);
  }

  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  db.get(countSql, countParams, (err, countRow) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({
        data: rows,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: countRow.total,
          totalPages: Math.ceil(countRow.total / pageSize),
        },
      });
    });
  });
});

// Get login history (super_admin: all, others: own org users)
router.get('/login-history', (req, res) => {
  const { user_id, start_date, end_date } = req.query;
  let sql = `
    SELECT lh.*, u.email as user_email, u.first_name, u.last_name
    FROM login_history lh
    INNER JOIN users u ON u.id = lh.user_id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role_name !== 'super_admin') {
    sql += ' AND u.organization_id = ?';
    params.push(req.user.organization_id);
  }
  if (user_id) {
    sql += ' AND lh.user_id = ?';
    params.push(user_id);
  }
  if (start_date) {
    sql += ' AND lh.created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND lh.created_at <= ?';
    params.push(end_date);
  }

  sql += ' ORDER BY lh.created_at DESC LIMIT 200';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ data: rows });
  });
});

module.exports = router;
