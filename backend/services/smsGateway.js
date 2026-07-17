const db = require('../config/db');
const twilio = require('./twilio');
const orangeSms = require('./orangeSms');

const PROVIDERS = {
  twilio: twilio.sendSms,
  orange: orangeSms.sendSms,
};

const AUTH_TESTERS = {
  twilio: twilio.testAuth,
  orange: orangeSms.testAuth,
};

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getDefaultGateway(organizationId) {
  return new Promise((resolve, reject) => {
    // First try org-specific default gateway
    if (organizationId) {
      db.get(
        `SELECT * FROM sms_gateways WHERE organization_id = ? AND is_default = 1 AND status = 'active' AND channel = 'sms' LIMIT 1`,
        [organizationId],
        (err, row) => {
          if (err) return reject(err);
          if (row) return resolve(row);
          // Fall back to global default (organization_id IS NULL)
          db.get(
            `SELECT * FROM sms_gateways WHERE organization_id IS NULL AND is_default = 1 AND status = 'active' AND channel = 'sms' LIMIT 1`,
            [],
            (err2, row2) => (err2 ? reject(err2) : resolve(row2 || null))
          );
        }
      );
    } else {
      db.get(
        `SELECT * FROM sms_gateways WHERE organization_id IS NULL AND is_default = 1 AND status = 'active' AND channel = 'sms' LIMIT 1`,
        [],
        (err, row) => (err ? reject(err) : resolve(row || null))
      );
    }
  });
}

// Sends through a specific gateway row (provider + config). Falls back to Twilio/env
// credentials when no gateway is configured, so the app keeps working out of the box.
async function sendSms({ to, body, gateway, correlationId }) {
  const provider = gateway?.provider || 'twilio';
  const send = PROVIDERS[provider];

  if (!send) {
    return {
      sid: null,
      status: 'failed',
      error: `Fournisseur SMS inconnu: ${provider}`,
      gatewayId: gateway?.id || null,
      provider,
    };
  }

  const config = parseConfig(gateway?.config);
  const result = await send({ to, body, config, correlationId });
  return { ...result, gatewayId: gateway?.id || null, provider };
}

// Validates credentials (and optionally sends a real test SMS) for a draft or saved
// gateway, without requiring it to be saved as the default first.
async function testGateway({ provider, config, testPhone }) {
  const testAuth = AUTH_TESTERS[provider];
  if (!testAuth) {
    return { auth: { success: false, message: `Test non supporté pour le fournisseur: ${provider}` } };
  }

  const auth = await testAuth({ config });
  const result = { auth };

  if (testPhone && auth.success) {
    const send = PROVIDERS[provider];
    const sendResult = await send({ to: testPhone, body: 'Test Montexto : votre passerelle SMS est correctement configurée.', config });
    result.send = {
      attempted: true,
      success: sendResult.status !== 'failed',
      status: sendResult.status,
      message: sendResult.error || (sendResult.status === 'simulated' ? 'Envoi simulé (config incomplète)' : 'SMS envoyé'),
      sid: sendResult.sid,
    };
  }

  return result;
}

function getActiveGatewaysByProvider(provider) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM sms_gateways WHERE provider = ? AND status = 'active'`,
      [provider],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

// Subscribes every active Orange gateway to delivery receipt (DR) notifications.
// Orange must be able to reach notifyUrl, so this is skipped without a public base URL.
async function subscribeOrangeDeliveryReceipts() {
  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!baseUrl) {
    console.warn('[SMS Gateway] PUBLIC_BASE_URL not set — skipping Orange DR subscription (webhook must be publicly reachable).');
    return;
  }

  const notifyUrl = `${baseUrl.replace(/\/$/, '')}/api/inbound/dr`;
  const gateways = await getActiveGatewaysByProvider('orange');

  for (const gateway of gateways) {
    const config = parseConfig(gateway.config);
    const result = await orangeSms.subscribeDeliveryReceipts({ config, notifyUrl });
    if (result.subscribed) {
      console.log(`[SMS Gateway] Subscribed to Orange DR notifications for gateway "${gateway.name}"`);
    } else {
      console.warn(`[SMS Gateway] Failed to subscribe Orange DR for gateway "${gateway.name}": ${result.error}`);
    }
  }
}

module.exports = { sendSms, getDefaultGateway, parseConfig, subscribeOrangeDeliveryReceipts, testGateway };
