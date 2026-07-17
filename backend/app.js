require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const contactRoutes = require('./routes/contacts');
const groupRoutes = require('./routes/groups');
const catalogRoutes = require('./routes/catalog');
const statsRoutes = require('./routes/stats');
const apiKeyRoutes = require('./routes/apiKeys');
const organizationRoutes = require('./routes/organizations');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const auditRoutes = require('./routes/audit');
const smsRoutes = require('./routes/sms');
const exportRoutes = require('./routes/exports');
const gatewayRoutes = require('./routes/gateways');
const notificationRoutes = require('./routes/notifications');
const inboundRoutes = require('./routes/inbound');
const blacklistRoutes = require('./routes/blacklist');
const importRoutes = require('./routes/imports');
const publicApiRoutes = require('./routes/publicApi');
const smsWorker = require('./services/smsWorker');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/gateways', gatewayRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/inbound', inboundRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/v1', publicApiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Cron endpoints ──────────────────────────────────────────────
// Replace the old setInterval-based worker loop (not viable on Vercel's
// serverless model — no persistent background process). Triggered by an
// external scheduler (see .github/workflows/cron.yml) rather than Vercel's
// own Cron feature, so this works the same on the free Hobby plan.
// Separate trust boundary from the JWT-authenticated API: a shared secret
// instead of a user session.
function requireCronSecret(req, res, next) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || req.headers.authorization !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/cron/process-queue', requireCronSecret, async (req, res) => {
  try {
    const result = await smsWorker.processQueue();
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/process-queue] error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cron/process-scheduled-campaigns', requireCronSecret, async (req, res) => {
  try {
    const result = await smsWorker.processScheduledCampaigns();
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/process-scheduled-campaigns] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Seed Libre organisation (one-time setup) ───────────────────
app.post('/api/seed-libre', requireCronSecret, async (req, res) => {
  const bcrypt = require('bcryptjs');
  const db = require('./config/db');

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this.lastID || this.changes);
      });
    });
  }
  function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  }

  try {
    const results = {};

    // 1. Organisation Libre
    let org = await getOne("SELECT id FROM organizations WHERE name = 'Libre'");
    if (!org) {
      const orgId = await run(
        "INSERT INTO organizations (name, type, email, phone, address, sms_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['Libre', 'entreprise', 'contact@libre.ml', '+223 20 00 00 00', 'Bamako, Mali', 5000, 'active']
      );
      org = { id: orgId };
      results.org = 'created';
    } else {
      results.org = 'exists';
    }

    // 2. Rôle org_admin
    const role = await getOne("SELECT id FROM roles WHERE name = 'org_admin'");
    if (!role) return res.status(500).json({ error: 'Role org_admin not found. Run main seed first.' });

    // 3. Utilisateur
    const email = 'libre@montexto.com';
    let user = await getOne('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      const hashed = bcrypt.hashSync('libre123', 10);
      const userId = await run(
        'INSERT INTO users (email, password, first_name, last_name, phone, organization_id, role_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [email, hashed, 'Libre', 'Admin', '+22377000000', org.id, role.id, 'active']
      );
      user = { id: userId };
      results.user = 'created';
    } else {
      await run('UPDATE users SET organization_id = ?, role_id = ? WHERE id = ?', [org.id, role.id, user.id]);
      results.user = 'updated';
    }

    // 4. Gateway SMS Orange Mali
    let gw = await getOne('SELECT id FROM sms_gateways WHERE organization_id = ? AND provider = ?', [org.id, 'orange']);
    if (!gw) {
      const config = JSON.stringify({
        clientId: process.env.ORANGE_CLIENT_ID || '',
        clientSecret: process.env.ORANGE_CLIENT_SECRET || '',
        senderAddress: '+2230000',
        senderName: 'Libre',
      });
      const gwId = await run(
        'INSERT INTO sms_gateways (name, provider, config, is_default, status, channel, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['Orange Mali - Libre', 'orange', config, 1, 'active', 'sms', org.id]
      );
      gw = { id: gwId };
      results.gatewaySms = 'created';
    } else {
      results.gatewaySms = 'exists';
    }

    // 5. Gateway mail SMTP
    let mailGw = await getOne('SELECT id FROM sms_gateways WHERE organization_id = ? AND channel = ?', [org.id, 'mail']);
    if (!mailGw) {
      const mailConfig = JSON.stringify({
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT || '587',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'no-reply@libre.ml',
      });
      const gwId = await run(
        'INSERT INTO sms_gateways (name, provider, config, is_default, status, channel, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['SMTP - Libre', 'smtp', mailConfig, 1, 'active', 'mail', org.id]
      );
      mailGw = { id: gwId };
      results.gatewayMail = 'created';
    } else {
      results.gatewayMail = 'exists';
    }

    res.json({
      ok: true,
      results,
      credentials: { email: 'libre@montexto.com', password: 'libre123' },
      orgId: org.id,
    });
  } catch (error) {
    console.error('[seed-libre] error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
