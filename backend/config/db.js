const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

db.serialize(() => {
  // ─── Organizations ───────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    type TEXT DEFAULT 'entreprise',
    sms_balance INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── Roles ───────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── Permissions ─────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── Role ↔ Permissions (join) ───────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`);

  // ─── Users (enhanced) ────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    organization_id INTEGER,
    role_id INTEGER,
    status TEXT DEFAULT 'active',
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
  )`);

  // ─── Audit logs ──────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    organization_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── Login history ───────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ─── OTP codes ───────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ─── Password resets ─────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ─── SMS Gateways ────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS sms_gateways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    config TEXT,
    is_default INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── SMS Credit transactions ─────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS sms_credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    balance_after INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  // ─── API keys (org-scoped) ───────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    key_value TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
  )`);

  // ─── Contact groups (org-scoped) ─────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS contact_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  // ─── Contacts (org-scoped) ───────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    group_id INTEGER,
    first_name TEXT,
    last_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE SET NULL
  )`);

  // ─── Catalog items (org-scoped) ──────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS catalog_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'sms',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  // ─── Campaigns (org-scoped) ──────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'sms',
    status TEXT DEFAULT 'draft',
    scheduled_at DATETIME,
    total_recipients INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  // ─── Campaign recipients ─────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS campaign_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    organization_id INTEGER,
    contact_id INTEGER,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    twilio_sid TEXT,
    error_message TEXT,
    sent_at DATETIME,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )`);

  // ─── Recharges (org-scoped) ──────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS recharges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  // ─── Notifications ───────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    organization_id INTEGER,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  // ─── SMS Queue (async sending with retry) ────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS sms_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    organization_id INTEGER,
    contact_id INTEGER,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    gateway_id INTEGER,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at DATETIME,
    error_message TEXT,
    twilio_sid TEXT,
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )`);

  // ─── Inbound SMS (replies / webhooks) ────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS inbound_sms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    from_phone TEXT NOT NULL,
    to_phone TEXT,
    message TEXT NOT NULL,
    gateway_provider TEXT,
    gateway_message_id TEXT,
    campaign_id INTEGER,
    contact_id INTEGER,
    is_read INTEGER DEFAULT 0,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )`);

  // ─── Blacklist / DND ─────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    phone TEXT NOT NULL,
    reason TEXT DEFAULT 'user_request',
    source TEXT DEFAULT 'manual',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, phone)
  )`);
});

module.exports = db;
