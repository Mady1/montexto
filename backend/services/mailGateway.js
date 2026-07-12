const db = require('../config/db');
const mailer = require('./mailer');

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getDefaultMailGateway() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM sms_gateways WHERE channel = 'mail' AND is_default = 1 AND status = 'active' LIMIT 1`,
      [],
      (err, row) => (err ? reject(err) : resolve(row || null))
    );
  });
}

async function sendMail({ to, subject, body, gateway }) {
  const config = parseConfig(gateway?.config);
  const result = await mailer.sendMail({ to, subject, body, config });
  return { ...result, gatewayId: gateway?.id || null };
}

// Validates SMTP credentials (and optionally sends a real test email) for a
// draft or saved mail gateway, mirroring smsGateway.testGateway.
async function testGateway({ config, testEmail }) {
  const auth = await mailer.testAuth({ config });
  const result = { auth };

  if (testEmail && auth.success) {
    const sendResult = await mailer.sendMail({
      to: testEmail,
      subject: 'Test Montexto',
      body: 'Votre passerelle email est correctement configurée.',
      config,
    });
    result.send = {
      attempted: true,
      success: sendResult.status !== 'failed',
      status: sendResult.status,
      message: sendResult.error || (sendResult.status === 'simulated' ? 'Envoi simulé (config incomplète)' : 'Email envoyé'),
      sid: sendResult.sid,
    };
  }

  return result;
}

module.exports = { sendMail, getDefaultMailGateway, testGateway, parseConfig };
