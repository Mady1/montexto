const db = require('../config/db');

/**
 * Log an action to the audit_logs table
 * @param {object} params - { userId, organizationId, action, entityType, entityId, details, ipAddress, userAgent }
 */
function logAudit({ userId, organizationId, action, entityType, entityId, details, ipAddress, userAgent }) {
  db.run(
    `INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId || null, organizationId || null, action, entityType || null, entityId || null, details || null, ipAddress || null, userAgent || null],
    (err) => {
      if (err) console.error('Audit log error:', err);
    }
  );
}

/**
 * Express middleware: automatically logs the action after the response is sent
 * @param {string} action - e.g. 'campaign.create', 'user.delete'
 * @param {function} getEntityType - function(req) => string
 * @param {function} getEntityId - function(req) => number
 * @param {function} getDetails - function(req) => string (optional)
 */
function auditLog(action, getEntityType, getEntityId, getDetails) {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
      // Only log on successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAudit({
          userId: req.user?.id,
          organizationId: req.user?.organization_id,
          action,
          entityType: typeof getEntityType === 'function' ? getEntityType(req) : (getEntityType || null),
          entityId: typeof getEntityId === 'function' ? getEntityId(req) : (getEntityId || null),
          details: getDetails ? getDetails(req) : null,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }
      originalSend.call(this, data);
    };
    next();
  };
}

/**
 * Log a login attempt to login_history
 */
function logLoginAttempt(userId, ipAddress, userAgent, success) {
  db.run(
    'INSERT INTO login_history (user_id, ip_address, user_agent, success) VALUES (?, ?, ?, ?)',
    [userId, ipAddress, userAgent, success ? 1 : 0],
    (err) => {
      if (err) console.error('Login history error:', err);
    }
  );
}

module.exports = { logAudit, auditLog, logLoginAttempt };
