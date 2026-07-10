const db = require('../config/db');

// Cache for role permissions to avoid repeated DB queries
const permissionCache = new Map();
const CACHE_TTL = 60000; // 60 seconds

function getCachedPermissions(roleId) {
  const cached = permissionCache.get(roleId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }
  return null;
}

function setCachedPermissions(roleId, permissions) {
  permissionCache.set(roleId, { permissions, timestamp: Date.now() });
}

function clearPermissionCache(roleId) {
  if (roleId) {
    permissionCache.delete(roleId);
  } else {
    permissionCache.clear();
  }
}

/**
 * Get all permission codes for a given role ID
 */
function getRolePermissions(roleId) {
  return new Promise((resolve, reject) => {
    const cached = getCachedPermissions(roleId);
    if (cached) return resolve(cached);

    const sql = `
      SELECT p.code FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `;
    db.all(sql, [roleId], (err, rows) => {
      if (err) return reject(err);
      const permissions = rows.map((r) => r.code);
      setCachedPermissions(roleId, permissions);
      resolve(permissions);
    });
  });
}

/**
 * Get role name for a given role ID
 */
function getRoleName(roleId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT name FROM roles WHERE id = ?', [roleId], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.name : null);
    });
  });
}

/**
 * Middleware factory: require one or more permission codes
 * Usage: requirePermission('users.create') or requirePermission('users.create', 'users.edit')
 */
function requirePermission(...codes) {
  return async (req, res, next) => {
    if (!req.user || !req.user.role_id) {
      return res.status(403).json({ error: 'No role assigned' });
    }

    try {
      const permissions = await getRolePermissions(req.user.role_id);
      const hasAll = codes.every((code) => permissions.includes(code));
      if (!hasAll) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch (err) {
      console.error('RBAC error:', err);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Middleware factory: require any of the given permission codes
 */
function requireAnyPermission(...codes) {
  return async (req, res, next) => {
    if (!req.user || !req.user.role_id) {
      return res.status(403).json({ error: 'No role assigned' });
    }

    try {
      const permissions = await getRolePermissions(req.user.role_id);
      const hasAny = codes.some((code) => permissions.includes(code));
      if (!hasAny) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch (err) {
      console.error('RBAC error:', err);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Middleware: require a specific role by name
 * Usage: requireRole('super_admin')
 */
function requireRole(...roleNames) {
  return async (req, res, next) => {
    if (!req.user || !req.user.role_id) {
      return res.status(403).json({ error: 'No role assigned' });
    }

    try {
      const roleName = await getRoleName(req.user.role_id);
      if (!roleName || !roleNames.includes(roleName)) {
        return res.status(403).json({ error: 'Insufficient role' });
      }
      next();
    } catch (err) {
      console.error('RBAC error:', err);
      res.status(500).json({ error: 'Role check failed' });
    }
  };
}

/**
 * Middleware: ensure user can only access resources within their organization
 * Super admins bypass this check.
 */
function requireOrgScope(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  // Super admin can access everything
  if (req.user.role_name === 'super_admin') {
    return next();
  }

  // Other roles are scoped to their organization
  if (!req.user.organization_id) {
    return res.status(403).json({ error: 'No organization assigned' });
  }

  req.orgFilter = { organization_id: req.user.organization_id };
  next();
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireOrgScope,
  getRolePermissions,
  getRoleName,
  clearPermissionCache,
};
