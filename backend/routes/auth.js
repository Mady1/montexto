const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { logLoginAttempt } = require('../middleware/audit');
const { rateLimit } = require('../middleware/rateLimit');
const { getRolePermissions } = require('../middleware/rbac');

const router = express.Router();

// Public: list demo users for quick login (dev convenience)
router.get('/demo-users', (req, res) => {
  db.all(
    `SELECT u.id, u.email, u.first_name, u.last_name,
            r.name as role_name, r.display_name as role_display_name,
            o.name as organization_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE u.status = 'active'
     ORDER BY u.id ASC
     LIMIT 10`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      const users = rows.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        roleName: u.role_name,
        roleDisplayName: u.role_display_name,
        organizationName: u.organization_name,
        password: 'admin123',
      }));
      // Assign known demo passwords
      const passwordMap = {
        'admin@montexto.com': 'admin123',
        'demo@montexto.com': 'demo123',
        'resp.com@montexto.com': 'resp123',
        'operator@montexto.com': 'op123',
        'auditor@montexto.com': 'audit123',
        'admin.banco@montexto.com': 'banco123',
        'com.banco@montexto.com': 'bcom123',
        'admin.orange@montexto.com': 'orange123',
        'op.sifca@montexto.com': 'sifca123',
        'mohamed.wague2453@gmail.com': 'admin123',
      };
      users.forEach((u) => {
        u.password = passwordMap[u.email] || 'demo123';
      });
      res.json({ data: users });
    }
  );
});

// Register (creates user with default role 'org_admin' if no role specified)
router.post('/register', (req, res) => {
  const { email, password, firstName, lastName, phone, organizationName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const hashed = bcrypt.hashSync(password, 10);

  db.serialize(() => {
    // Create organization if name provided
    if (organizationName) {
      db.run(
        'INSERT INTO organizations (name, type) VALUES (?, ?)',
        [organizationName, 'entreprise'],
        function (err) {
          if (err) return res.status(500).json({ error: 'Failed to create organization' });
          const orgId = this.lastID;
          // Get org_admin role
          db.get("SELECT id FROM roles WHERE name = 'org_admin'", (err, role) => {
            createUser(orgId, role ? role.id : null);
          });
        }
      );
    } else {
      createUser(null, null);
    }
  });

  function createUser(orgId, roleId) {
    db.run(
      'INSERT INTO users (email, password, first_name, last_name, phone, organization_id, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashed, firstName || '', lastName || '', phone || null, orgId, roleId],
      function (err) {
        if (err) {
          if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
          return res.status(500).json({ error: 'Database error' });
        }
        const userId = this.lastID;
        const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
        logAudit({ userId, organizationId: orgId, action: 'auth.register', ipAddress: req.ip, userAgent: req.get('User-Agent') });
        res.status(201).json({
          token,
          user: { id: userId, email, firstName, lastName, phone, organization_id: orgId, role_id: roleId },
        });
      }
    );
  }
});

// Login with audit logging + rate limiting + account lockout
router.post('/login', rateLimit({ windowMs: 60000, max: 5, key: 'login' }), (req, res) => {
  const { email, password, otp } = req.body;
  const ip = req.ip;
  const userAgent = req.get('User-Agent');

  db.get(
    `SELECT u.*, r.name as role_name, r.display_name as role_display_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
    [email],
    (err, user) => {
      if (err || !user || !bcrypt.compareSync(password, user.password)) {
        if (user) {
          logLoginAttempt(user.id, ip, userAgent, false);
          // Check failed login count for lockout
          db.get(
            "SELECT COUNT(*) as failed_count FROM login_history WHERE user_id = ? AND success = 0 AND created_at > NOW() - INTERVAL '15 minutes'",
            [user.id],
            (err2, result) => {
              if (!err2 && result && result.failed_count >= 5) {
                db.run("UPDATE users SET status = 'locked' WHERE id = ?", [user.id]);
                logAudit({ userId: user.id, action: 'auth.account_locked', ipAddress: ip, userAgent });
                return res.status(423).json({ error: 'Compte verrouillé après 5 tentatives échouées. Contactez votre administrateur.' });
              }
            }
          );
        }
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      if (user.status === 'locked') {
        return res.status(423).json({ error: 'Compte verrouillé. Contactez votre administrateur.' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Compte désactivé. Contactez votre administrateur.' });
      }

      // If OTP is enabled, check for valid OTP
      if (otp) {
        db.get(
          'SELECT * FROM otp_codes WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
          [user.id, otp],
          (err, otpRecord) => {
            if (err || !otpRecord) {
              return res.status(401).json({ error: 'Invalid or expired OTP' });
            }
            db.run('UPDATE otp_codes SET used = 1 WHERE id = ?', [otpRecord.id]);
            issueToken(user, ip, userAgent);
          }
        );
      } else {
        // Check if user has 2FA enabled (for now, skip — just issue token)
        issueToken(user, ip, userAgent);
      }
    }
  );

  function issueToken(user, ip, userAgent) {
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    logLoginAttempt(user.id, ip, userAgent, true);
    logAudit({ userId: user.id, organizationId: user.organization_id, action: 'auth.login', ipAddress: ip, userAgent });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        organization_id: user.organization_id,
        role_id: user.role_id,
        role_name: user.role_name,
        role_display_name: user.role_display_name,
      },
    });
  }
});

// Request OTP
router.post('/otp/request', rateLimit({ windowMs: 60000, max: 10, key: 'otp' }), (req, res) => {
  const { email } = req.body;
  db.get("SELECT id FROM users WHERE email = ? AND status = 'active'", [email], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();

    db.run(
      'INSERT INTO otp_codes (user_id, code, expires_at) VALUES (?, ?, ?)',
      [user.id, code, expiresAt],
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        // No mailer wired up yet to actually deliver the code — surface it in the
        // response so the login screen can show it directly. Once SMTP_HOST is set,
        // this stops being returned (the real mailer is expected to deliver it instead).
        res.json({ message: 'OTP sent', devCode: process.env.SMTP_HOST ? undefined : code });
      }
    );
  });
});

// Verify OTP and login
router.post('/otp/verify', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  db.get("SELECT * FROM users WHERE email = ? AND status = 'active'", [email], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });

    db.get(
      'SELECT * FROM otp_codes WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [user.id, otp],
      (err, otpRecord) => {
        if (err || !otpRecord) {
          return res.status(401).json({ error: 'Invalid or expired OTP' });
        }
        db.run('UPDATE otp_codes SET used = 1 WHERE id = ?', [otpRecord.id]);
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        logLoginAttempt(user.id, req.ip, req.get('User-Agent'), true);
        logAudit({ userId: user.id, organizationId: user.organization_id, action: 'auth.login_otp', ipAddress: req.ip, userAgent: req.get('User-Agent') });
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            organization_id: user.organization_id,
            role_id: user.role_id,
          },
        });
      }
    );
  });
});

// Request password reset
router.post('/password/reset-request', rateLimit({ windowMs: 60000, max: 3, key: 'pwd_reset' }), (req, res) => {
  const { email } = req.body;
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) return res.json({ message: 'If the email exists, a reset link has been sent' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60000).toISOString();

    db.run(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt],
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        logAudit({ userId: user.id, action: 'auth.password_reset_request', ipAddress: req.ip, userAgent: req.get('User-Agent') });
        // No mailer wired up yet to actually deliver the reset link — surface the
        // token in the response so ForgotPassword can show it directly. Once
        // SMTP_HOST is set, this stops being returned (email delivers it instead).
        res.json({
          message: 'If the email exists, a reset link has been sent',
          devToken: process.env.SMTP_HOST ? undefined : token,
        });
      }
    );
  });
});

// Confirm password reset
router.post('/password/reset-confirm', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

  db.get(
    'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
    [token],
    (err, reset) => {
      if (err || !reset) return res.status(401).json({ error: 'Invalid or expired token' });

      const hashed = bcrypt.hashSync(newPassword, 10);
      db.serialize(() => {
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, reset.user_id]);
        db.run('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);
        logAudit({ userId: reset.user_id, action: 'auth.password_reset', ipAddress: req.ip, userAgent: req.get('User-Agent') });
        res.json({ message: 'Password reset successful' });
      });
    }
  );
});

// Logout (audit)
router.post('/logout', authenticateToken, (req, res) => {
  logAudit({ userId: req.user.id, organizationId: req.user.organization_id, action: 'auth.logout', ipAddress: req.ip, userAgent: req.get('User-Agent') });
  res.json({ message: 'Logged out' });
});

// Get current user info (enhanced)
router.get('/me', authenticateToken, (req, res) => {
  db.get(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.status,
            u.organization_id, u.role_id, u.last_login, u.created_at,
            o.name as organization_name, o.sms_balance as org_sms_balance,
            r.name as role_name, r.display_name as role_display_name
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [req.user.id],
    async (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      try {
        const permissions = user.role_id ? await getRolePermissions(user.role_id) : [];
        res.json({ ...user, permissions });
      } catch {
        res.json(user);
      }
    }
  );
});

// Update own profile (self-update)
router.put('/me', authenticateToken, (req, res) => {
  const { firstName, lastName, phone, currentPassword, newPassword } = req.body;

  // If password change requested, verify current password first
  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
    db.get('SELECT password FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      if (!bcrypt.compareSync(currentPassword, user.password)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const hashed = bcrypt.hashSync(newPassword, 10);
      db.run(
        'UPDATE users SET first_name = ?, last_name = ?, phone = ?, password = ? WHERE id = ?',
        [firstName || '', lastName || '', phone || null, hashed, req.user.id],
        (err) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          logAudit({ userId: req.user.id, organizationId: req.user.organization_id, action: 'user.update_self', ipAddress: req.ip, userAgent: req.get('User-Agent') });
          res.json({ message: 'Profile updated' });
        }
      );
    });
  } else {
    db.run(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?',
      [firstName || '', lastName || '', phone || null, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        logAudit({ userId: req.user.id, organizationId: req.user.organization_id, action: 'user.update_self', ipAddress: req.ip, userAgent: req.get('User-Agent') });
        res.json({ message: 'Profile updated' });
      }
    );
  }
});

module.exports = router;
