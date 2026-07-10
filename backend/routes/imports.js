const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

// ─── Import contacts from CSV ────────────────────────────────────
router.post('/contacts', authenticateToken, requirePermission('contacts.import'), auditLog('contacts.import', 'contacts', null, (req) => ({ count: req.body.contacts?.length || 0, groupId: req.body.groupId })), (req, res) => {
  const { contacts, groupId, organizationId } = req.body;

  if (!contacts || !Array.isArray(contacts) || !contacts.length) {
    return res.status(400).json({ error: 'Contacts array required' });
  }

  const orgId = req.user.role_name === 'super_admin' ? (organizationId || req.user.organization_id) : req.user.organization_id;
  const userId = req.user.id;

  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  const stmt = db.prepare(
    'INSERT INTO contacts (user_id, organization_id, group_id, first_name, last_name, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const checkStmt = db.prepare(
    'SELECT id FROM contacts WHERE organization_id = ? AND phone = ?'
  );

  let pending = contacts.length;

  contacts.forEach((c) => {
    const phone = (c.phone || '').trim();
    if (!phone) {
      errors++;
      pending--;
      if (pending === 0) finish();
      return;
    }

    checkStmt.get([orgId, phone], (err, existing) => {
      if (err) {
        errors++;
        pending--;
        if (pending === 0) finish();
        return;
      }

      if (existing) {
        duplicates++;
        pending--;
        if (pending === 0) finish();
        return;
      }

      stmt.run(
        [userId, orgId, groupId || null, (c.firstName || '').trim() || null, (c.lastName || '').trim() || null, phone, (c.email || '').trim() || null],
        (err2) => {
          if (err2) errors++;
          else inserted++;
          pending--;
          if (pending === 0) finish();
        }
      );
    });
  });

  function finish() {
    stmt.finalize();
    checkStmt.finalize();
    res.json({
      success: true,
      total: contacts.length,
      inserted,
      duplicates,
      errors,
    });
  }
});

// ─── Parse CSV text (no external deps) ───────────────────────────
router.post('/parse-csv', authenticateToken, (req, res) => {
  const { csvText, delimiter = ',' } = req.body;
  if (!csvText) return res.status(400).json({ error: 'CSV text required' });

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

  const headers = parseCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));

  // Try to auto-map columns
  const mapping = {};
  headers.forEach((h, i) => {
    const lower = h.toLowerCase().trim();
    if (lower === 'phone' || lower === 'telephone' || lower === 'tel' || lower === 'numero' || lower === 'mobile') mapping.phone = i;
    else if (lower === 'firstname' || lower === 'first_name' || lower === 'prenom') mapping.firstName = i;
    else if (lower === 'lastname' || lower === 'last_name' || lower === 'nom') mapping.lastName = i;
    else if (lower === 'email' || lower === 'mail' || lower === 'courriel') mapping.email = i;
  });

  const contacts = rows.map((row) => ({
    phone: mapping.phone !== undefined ? row[mapping.phone] : '',
    firstName: mapping.firstName !== undefined ? row[mapping.firstName] : '',
    lastName: mapping.lastName !== undefined ? row[mapping.lastName] : '',
    email: mapping.email !== undefined ? row[mapping.email] : '',
  })).filter((c) => c.phone);

  res.json({
    headers,
    rowCount: rows.length,
    mapping,
    contacts,
  });
});

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

module.exports = router;
