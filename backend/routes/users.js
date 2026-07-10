const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireAnyPermission, requireRole, getRolePermissions } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

router.use(authenticateToken);

// List users
// super_admin: all users, org_admin: users in their org, others: just themselves
router.get('/', (req, res) => {
  const { search, organization_id, role_id, status } = req.query;
  let sql = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.status,
           u.organization_id, u.role_id, u.last_login, u.created_at,
           o.name as organization_name,
           r.name as role_name, r.display_name as role_display_name
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role_name !== 'super_admin') {
    sql += ' AND u.organization_id = ?';
    params.push(req.user.organization_id);
  } else if (organization_id) {
    sql += ' AND u.organization_id = ?';
    params.push(organization_id);
  }

  if (role_id) {
    sql += ' AND u.role_id = ?';
    params.push(role_id);
  }
  if (status) {
    sql += ' AND u.status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY u.created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ data: rows });
  });
});

// Get single user
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role_name !== 'super_admin' && req.user.id !== id && req.user.organization_id !== req.user.organization_id) {
    // org_admin can view users in their org
  }

  db.get(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.status,
            u.organization_id, u.role_id, u.last_login, u.created_at,
            o.name as organization_name,
            r.name as role_name, r.display_name as role_display_name
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(404).json({ error: 'User not found' });

      // Non-super-admins can only see users in their org
      if (req.user.role_name !== 'super_admin' && row.organization_id !== req.user.organization_id && req.user.id !== id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json(row);
    }
  );
});

// Create user (super_admin or org_admin)
router.post(
  '/',
  requireAnyPermission('users.create'),
  auditLog('user.create', 'user', null, (req) => `Created user: ${req.body.email}`),
  (req, res) => {
    const { email, password, firstName, lastName, phone, organization_id, role_id } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // org_admin can only create users in their own org
    const orgId = req.user.role_name === 'super_admin' ? organization_id : req.user.organization_id;
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    // org_admin cannot assign super_admin role
    if (req.user.role_name !== 'super_admin' && role_id) {
      db.get('SELECT name FROM roles WHERE id = ?', [role_id], (err, role) => {
        if (role && role.name === 'super_admin') {
          return res.status(403).json({ error: 'Cannot assign super_admin role' });
        }
      });
    }

    const hashed = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (email, password, first_name, last_name, phone, organization_id, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashed, firstName || '', lastName || '', phone || null, orgId, role_id || null],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ id: this.lastID, email, message: 'User created' });
      }
    );
  }
);

// Update user
router.put(
  '/:id',
  requireAnyPermission('users.edit', 'users.edit_self'),
  auditLog('user.update', 'user', (req) => req.params.id, (req) => `Updated user #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    const { firstName, lastName, phone, organization_id, role_id, status } = req.body;

    // Non-super-admins can only edit users in their own org
    if (req.user.role_name !== 'super_admin') {
      db.get('SELECT organization_id FROM users WHERE id = ?', [id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        if (user.organization_id !== req.user.organization_id && req.user.id !== id) {
          return res.status(403).json({ error: 'Access denied' });
        }
        doUpdate();
      });
    } else {
      doUpdate();
    }

    function doUpdate() {
      // org_admin cannot change organization_id or assign super_admin
      const allowedOrgId = req.user.role_name === 'super_admin' ? organization_id : undefined;
      const allowedRoleId = role_id;

      db.run(
        `UPDATE users SET
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          phone = COALESCE(?, phone),
          ${req.user.role_name === 'super_admin' ? 'organization_id = COALESCE(?, organization_id),' : ''}
          role_id = COALESCE(?, role_id),
          status = COALESCE(?, status)
        WHERE id = ?`,
        req.user.role_name === 'super_admin'
          ? [firstName, lastName, phone, allowedOrgId, allowedRoleId, status, id]
          : [firstName, lastName, phone, allowedRoleId, status, id],
        function (err) {
          if (err) return res.status(500).json({ error: 'Database error' });
          if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
          res.json({ message: 'User updated' });
        }
      );
    }
  }
);

// Change password (self or admin)
router.patch(
  '/:id/password',
  (req, res) => {
    const id = Number(req.params.id);
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password required' });

    // Self can change with current password
    if (req.user.id === id) {
      db.get('SELECT password FROM users WHERE id = ?', [id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        if (currentPassword && !bcrypt.compareSync(currentPassword, user.password)) {
          return res.status(403).json({ error: 'Current password incorrect' });
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, id], (err) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          res.json({ message: 'Password changed' });
        });
      });
    } else if (req.user.role_name === 'super_admin' || req.user.role_name === 'org_admin') {
      // Admin can reset without current password
      const hashed = bcrypt.hashSync(newPassword, 10);
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, id], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Password reset' });
      });
    } else {
      res.status(403).json({ error: 'Access denied' });
    }
  }
);

// Delete user (super_admin or org_admin for their org)
router.delete(
  '/:id',
  requirePermission('users.delete'),
  auditLog('user.delete', 'user', (req) => req.params.id, (req) => `Deleted user #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    if (req.user.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });

    if (req.user.role_name !== 'super_admin') {
      db.get('SELECT organization_id FROM users WHERE id = ?', [id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        if (user.organization_id !== req.user.organization_id) {
          return res.status(403).json({ error: 'Access denied' });
        }
        doDelete();
      });
    } else {
      doDelete();
    }

    function doDelete() {
      db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted' });
      });
    }
  }
);

// Get user permissions
router.get('/:id/permissions', async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.id !== id && req.user.role_name !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    db.get('SELECT role_id FROM users WHERE id = ?', [id], async (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      const permissions = user.role_id ? await getRolePermissions(user.role_id) : [];
      res.json({ permissions });
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load permissions' });
  }
});

// Get login history for a user
router.get('/:id/login-history', (req, res) => {
  const id = Number(req.params.id);
  if (req.user.id !== id && req.user.role_name !== 'super_admin' && req.user.role_name !== 'org_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.all(
    'SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ data: rows });
    }
  );
});

module.exports = router;
