const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, getRolePermissions, clearPermissionCache } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

router.use(authenticateToken);

// List all roles
router.get('/', (req, res) => {
  db.all('SELECT * FROM roles ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ data: rows });
  });
});

// Get single role with its permissions
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM roles WHERE id = ?', [id], (err, role) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    db.all(
      `SELECT p.* FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.code`,
      [id],
      (err, perms) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ ...role, permissions: perms || [] });
      }
    );
  });
});

// Create role (super_admin only)
router.post(
  '/',
  requireRole('super_admin'),
  auditLog('role.create', 'role', null, (req) => `Created role: ${req.body.name}`),
  (req, res) => {
    const { name, display_name, description } = req.body;
    if (!name || !display_name) return res.status(400).json({ error: 'Name and display_name required' });

    db.run(
      'INSERT INTO roles (name, display_name, description) VALUES (?, ?, ?)',
      [name, display_name, description || null],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Role name already exists' });
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ id: this.lastID, name, message: 'Role created' });
      }
    );
  }
);

// Update role (super_admin only, cannot edit system roles)
router.put(
  '/:id',
  requireRole('super_admin'),
  auditLog('role.update', 'role', (req) => req.params.id, (req) => `Updated role #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    const { display_name, description } = req.body;

    db.get('SELECT is_system FROM roles WHERE id = ?', [id], (err, role) => {
      if (err || !role) return res.status(404).json({ error: 'Role not found' });
      if (role.is_system && req.body.name) {
        return res.status(400).json({ error: 'Cannot rename system role' });
      }

      db.run(
        'UPDATE roles SET display_name = COALESCE(?, display_name), description = COALESCE(?, description) WHERE id = ?',
        [display_name, description, id],
        function (err) {
          if (err) return res.status(500).json({ error: 'Database error' });
          clearPermissionCache(id);
          res.json({ message: 'Role updated' });
        }
      );
    });
  }
);

// Assign permissions to a role (super_admin only)
router.put(
  '/:id/permissions',
  requireRole('super_admin'),
  auditLog('role.update_permissions', 'role', (req) => req.params.id, (req) => `Updated permissions for role #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    const { permissionIds } = req.body;
    if (!Array.isArray(permissionIds)) return res.status(400).json({ error: 'permissionIds must be an array' });

    // Replace all permissions for this role
    db.serialize(() => {
      db.run('DELETE FROM role_permissions WHERE role_id = ?', [id]);

      if (permissionIds.length > 0) {
        const placeholders = permissionIds.map(() => '(?, ?)').join(', ');
        const values = permissionIds.flatMap((pid) => [id, pid]);
        db.run(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${placeholders}`,
          values
        );
      }

      clearPermissionCache(id);
      res.json({ message: 'Permissions updated', count: permissionIds.length });
    });
  }
);

// Delete role (super_admin only, cannot delete system roles)
router.delete(
  '/:id',
  requireRole('super_admin'),
  auditLog('role.delete', 'role', (req) => req.params.id, (req) => `Deleted role #${req.params.id}`),
  (req, res) => {
    const id = Number(req.params.id);
    db.get('SELECT is_system FROM roles WHERE id = ?', [id], (err, role) => {
      if (err || !role) return res.status(404).json({ error: 'Role not found' });
      if (role.is_system) return res.status(400).json({ error: 'Cannot delete system role' });

      db.run('DELETE FROM roles WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        clearPermissionCache(id);
        res.json({ message: 'Role deleted' });
      });
    });
  }
);

// List all permissions (super_admin only)
router.get('/permissions/all', requireRole('super_admin'), (req, res) => {
  db.all('SELECT * FROM permissions ORDER BY module, code', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ data: rows });
  });
});

module.exports = router;
