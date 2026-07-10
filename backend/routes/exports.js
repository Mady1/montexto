const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

function orgScope(req) {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  return {
    where: isSuperAdmin ? '' : 'WHERE organization_id = ?',
    params: isSuperAdmin ? [] : [req.user.organization_id],
  };
}

function sendCsv(res, filename, headers, rows) {
  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => {
      const val = cell === null || cell === undefined ? '' : String(cell).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\ufeff' + csv);
}

// Export campaigns
router.get('/campaigns', requirePermission('reporting.export_excel'), (req, res) => {
  const { where, params } = orgScope(req);
  db.all(
    `SELECT name, type, status, total_recipients, delivered, failed, pending, cost, created_at, scheduled_at
     FROM campaigns ${where} ORDER BY created_at DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      sendCsv(res, 'campagnes.csv', [
        'Nom', 'Type', 'Statut', 'Destinataires', 'Delivres', 'Echoues', 'En attente', 'Cout', 'Cree le', 'Programme le'
      ], rows.map(r => [r.name, r.type, r.status, r.total_recipients, r.delivered, r.failed, r.pending, r.cost, r.created_at, r.scheduled_at]));
    }
  );
});

// Export contacts
router.get('/contacts', requirePermission('reporting.export_excel'), (req, res) => {
  const { where, params } = orgScope(req);
  db.all(
    `SELECT c.first_name, c.last_name, c.phone, c.email, g.name as group_name, c.created_at
     FROM contacts c
     LEFT JOIN contact_groups g ON c.group_id = g.id
     ${where ? where.replace('organization_id', 'c.organization_id') : ''}
     ORDER BY c.created_at DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      sendCsv(res, 'contacts.csv', [
        'Prenom', 'Nom', 'Telephone', 'Email', 'Groupe', 'Cree le'
      ], rows.map(r => [r.first_name, r.last_name, r.phone, r.email, r.group_name, r.created_at]));
    }
  );
});

// Export SMS history (campaign recipients + standalone)
router.get('/sms-history', requirePermission('reporting.export_excel'), (req, res) => {
  const { where, params } = orgScope(req);
  const w = where ? where.replace('organization_id', 'cr.organization_id') : '';
  db.all(
    `SELECT cr.phone, cr.status, cr.error_message, cr.sent_at,
            c.first_name, c.last_name, camp.name as campaign_name
     FROM campaign_recipients cr
     LEFT JOIN contacts c ON cr.contact_id = c.id
     LEFT JOIN campaigns camp ON cr.campaign_id = camp.id
     ${w} ORDER BY cr.sent_at DESC LIMIT 5000`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      sendCsv(res, 'historique_sms.csv', [
        'Telephone', 'Prenom', 'Nom', 'Campagne', 'Statut', 'Erreur', 'Envoye le'
      ], rows.map(r => [r.phone, r.first_name, r.last_name, r.campaign_name || 'SMS unique', r.status, r.error_message, r.sent_at]));
    }
  );
});

// Export audit logs
router.get('/audit', requirePermission('reporting.export_excel'), (req, res) => {
  const { where, params } = orgScope(req);
  const w = where ? where.replace('organization_id', 'a.organization_id') : '';
  db.all(
    `SELECT a.action, a.entity_type, a.details, a.ip_address, a.created_at,
            u.email, u.first_name, u.last_name
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ${w} ORDER BY a.created_at DESC LIMIT 5000`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      sendCsv(res, 'audit_logs.csv', [
        'Action', 'Utilisateur', 'Type entite', 'Details', 'IP', 'Date'
      ], rows.map(r => [r.action, `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email, r.entity_type, r.details, r.ip_address, r.created_at]));
    }
  );
});

// Export users
router.get('/users', requirePermission('reporting.export_excel'), (req, res) => {
  const isSuperAdmin = req.user.role_name === 'super_admin';
  if (!isSuperAdmin) return res.status(403).json({ error: 'Super admin only' });
  db.all(
    `SELECT u.email, u.first_name, u.last_name, u.phone, u.status, u.last_login, u.created_at,
            r.display_name as role, o.name as organization
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN organizations o ON u.organization_id = o.id
     ORDER BY u.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      sendCsv(res, 'utilisateurs.csv', [
        'Email', 'Prenom', 'Nom', 'Telephone', 'Role', 'Organisation', 'Statut', 'Derniere connexion', 'Cree le'
      ], rows.map(r => [r.email, r.first_name, r.last_name, r.phone, r.role, r.organization, r.status, r.last_login, r.created_at]));
    }
  );
});

module.exports = router;
