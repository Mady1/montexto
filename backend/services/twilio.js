const twilio = require('twilio');

const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
const envAuthToken = process.env.TWILIO_AUTH_TOKEN;
const envFromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!envAccountSid || !envAuthToken || !envAccountSid.startsWith('AC')) {
  console.warn('Twilio credentials not configured. SMS sending will be simulated unless a gateway config provides them.');
}

async function sendSms({ to, body, config = {} }) {
  const accountSid = config.accountSid || envAccountSid;
  const authToken = config.authToken || envAuthToken;
  const fromNumber = config.from || envFromNumber;

  if (!accountSid || !authToken || !accountSid.startsWith('AC') || !fromNumber) {
    return {
      sid: `SIMULATED_${Date.now()}`,
      status: 'simulated',
      error: null
    };
  }

  try {
    const client = twilio(accountSid, authToken);
    const baseUrl = process.env.PUBLIC_BASE_URL;
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to,
      ...(baseUrl ? { statusCallback: `${baseUrl.replace(/\/$/, '')}/api/inbound/status` } : {}),
    });
    return {
      sid: message.sid,
      status: message.status,
      error: null
    };
  } catch (error) {
    return {
      sid: null,
      status: 'failed',
      error: error.message
    };
  }
}

module.exports = { sendSms };
