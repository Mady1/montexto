const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (accountSid && authToken && accountSid.startsWith('AC')) {
  client = twilio(accountSid, authToken);
} else {
  console.warn('Twilio credentials not configured. SMS sending will be simulated.');
}

async function sendSms({ to, body }) {
  if (!client || !fromNumber) {
    return {
      sid: `SIMULATED_${Date.now()}`,
      status: 'simulated',
      error: null
    };
  }

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to
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
