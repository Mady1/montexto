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

module.exports = app;
