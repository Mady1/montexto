const nodemailer = require('nodemailer');

const envHost = process.env.SMTP_HOST;
const envPort = process.env.SMTP_PORT;
const envUser = process.env.SMTP_USER;
const envPass = process.env.SMTP_PASS;
const envFrom = process.env.SMTP_FROM;

if (!envHost || !envUser || !envPass) {
  console.warn('SMTP credentials not configured. Mail sending will be simulated unless a gateway config provides them.');
}

// Cached transporter per host+user, since multiple mail gateways may use different credentials.
const transporterCache = new Map();

function getTransporter(config) {
  const key = `${config.host}:${config.port}:${config.user}`;
  const cached = transporterCache.get(key);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || 587,
    secure: Number(config.port) === 465,
    auth: { user: config.user, pass: config.pass },
  });
  transporterCache.set(key, transporter);
  return transporter;
}

// Validates SMTP credentials by verifying the connection, without sending anything.
async function testAuth({ config = {} }) {
  const host = config.host || envHost;
  const user = config.user || envUser;
  const pass = config.pass || envPass;

  if (!host || !user || !pass) {
    return { success: false, message: 'Hôte, utilisateur et mot de passe SMTP requis' };
  }

  try {
    const transporter = getTransporter({ host, port: config.port || envPort, user, pass });
    await transporter.verify();
    return { success: true, message: `Connexion SMTP réussie (${host})` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function sendMail({ to, subject, body, config = {} }) {
  const host = config.host || envHost;
  const port = config.port || envPort;
  const user = config.user || envUser;
  const pass = config.pass || envPass;
  const from = config.from || envFrom || user;

  if (!host || !user || !pass) {
    return {
      sid: `SIMULATED_${Date.now()}`,
      status: 'simulated',
      error: null,
    };
  }

  try {
    const transporter = getTransporter({ host, port, user, pass });
    const info = await transporter.sendMail({ from, to, subject: subject || 'Message', text: body, html: body });
    return {
      sid: info.messageId || null,
      status: 'sent',
      error: null,
    };
  } catch (error) {
    return {
      sid: null,
      status: 'failed',
      error: error.message,
    };
  }
}

module.exports = { sendMail, testAuth };
