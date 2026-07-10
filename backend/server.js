require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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
const smsWorker = require('./services/smsWorker');

const app = express();
const PORT = process.env.PORT || 3001;

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  smsWorker.start();
});
