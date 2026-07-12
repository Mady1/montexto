const db = require('../config/db');
const smsGateway = require('./smsGateway');

// Shared send logic used by both the session-authenticated /api/sms routes
// and the API-key-authenticated /api/v1 public routes, so credit deduction,
// blacklist checks and gateway dispatch only exist in one place.

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function getOrgBalance(organizationId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT sms_balance FROM organizations WHERE id = ?', [organizationId], (err, org) => {
      if (err) reject(err);
      else resolve(org);
    });
  });
}

function isBlacklisted(organizationId, phone) {
  return new Promise((resolve) => {
    db.get('SELECT id FROM blacklist WHERE organization_id = ? AND phone = ?', [organizationId, phone], (err, row) => {
      resolve(!!row);
    });
  });
}

async function sendSingleSms({ organizationId, to, message }) {
  if (organizationId) {
    const org = await getOrgBalance(organizationId);
    if (!org) throw httpError('Organization not found', 500);
    if (org.sms_balance <= 0) throw httpError('Insufficient SMS credits', 403);
    if (await isBlacklisted(organizationId, to)) throw httpError('Ce numéro est en liste noire (DND)', 403);
  }

  const gateway = await smsGateway.getDefaultGateway();
  const smsResult = await smsGateway.sendSms({ to, body: message, gateway });

  if (organizationId && smsResult.status !== 'failed') {
    db.run('UPDATE organizations SET sms_balance = sms_balance - 1 WHERE id = ?', [organizationId]);
  }

  const status = smsResult.status === 'simulated' ? 'simulated' : (smsResult.error ? 'failed' : 'delivered');

  const id = await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone, status, error_message, twilio_sid, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [null, organizationId, null, to, status, smsResult.error, smsResult.sid, new Date().toISOString()],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

  return { id, to, message, status: smsResult.status, sid: smsResult.sid, error: smsResult.error };
}

async function sendBulkSms({ organizationId, phones, message }) {
  const blacklisted = new Set();
  if (organizationId) {
    const org = await getOrgBalance(organizationId);
    if (!org) throw httpError('Organization not found', 500);
    if (org.sms_balance < phones.length) {
      throw httpError(`Insufficient SMS credits. Need ${phones.length}, have ${org.sms_balance}`, 403);
    }
    const blRows = await new Promise((resolve) => {
      db.all('SELECT phone FROM blacklist WHERE organization_id = ?', [organizationId], (e, r) => resolve(r || []));
    });
    blRows.forEach((r) => blacklisted.add(r.phone));
  }

  const validPhones = phones.filter((p) => !blacklisted.has(p));
  const skipped = phones.length - validPhones.length;

  const gateway = await smsGateway.getDefaultGateway();

  let delivered = 0;
  let failed = 0;
  const results = [];

  for (const phone of validPhones) {
    const smsResult = await smsGateway.sendSms({ to: phone, body: message, gateway });
    const status = smsResult.status === 'simulated' ? 'simulated' : (smsResult.error ? 'failed' : 'delivered');

    db.run(
      'INSERT INTO campaign_recipients (campaign_id, organization_id, contact_id, phone, status, error_message, twilio_sid, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [null, organizationId, null, phone, status, smsResult.error, smsResult.sid, new Date().toISOString()]
    );

    if (smsResult.error) failed++;
    else delivered++;

    results.push({ phone, status, sid: smsResult.sid, error: smsResult.error });
  }

  if (organizationId) {
    db.run('UPDATE organizations SET sms_balance = sms_balance - ? WHERE id = ?', [delivered, organizationId]);
  }

  return { total: phones.length, delivered, failed, skipped, results };
}

module.exports = { sendSingleSms, sendBulkSms, httpError };
