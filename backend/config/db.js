const { Pool } = require('pg');

// Neon's connection string includes channel_binding=require, which node-postgres's
// SASL/SCRAM implementation doesn't handle (fails with "client password must be a
// string"). sslmode=require alone already gives us an encrypted, verified
// connection, so strip channel_binding before handing the string to `pg`.
function toPoolConnectionString(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

const pool = new Pool({
  connectionString: toPoolConnectionString(process.env.DATABASE_URL),
  max: Number(process.env.PG_POOL_MAX || 3),
  idleTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

// ─── sqlite3-shaped adapter over `pg` ───────────────────────────────────────
// Every route/service already does `const db = require('../config/db')` and
// calls db.run/db.get/db.all/db.serialize/db.prepare with sqlite3's callback
// API (`?` placeholders, `this.lastID`/`this.changes`). This module keeps
// that exact shape so none of those call sites need to change — only the
// handful of genuinely SQLite-specific SQL strings do (datetime(), DATE(),
// INSERT OR IGNORE, double-quoted string literals), fixed at their call sites.

let activeClient = null; // set while inside db.serialize(), for real transactions
let activeClientError = null;

function getExecutor() {
  return activeClient || pool;
}

function noteError(err) {
  if (activeClient && !activeClientError) activeClientError = err;
}

function toPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// role_permissions is the one table with no surrogate `id` column (composite
// PK of role_id + permission_id) — every other table has `id SERIAL PRIMARY KEY`.
const TABLES_WITHOUT_ID = new Set(['role_permissions']);

function withReturningId(sql) {
  const match = sql.match(/^\s*insert\s+into\s+(\w+)/i);
  if (!match) return sql;
  if (TABLES_WITHOUT_ID.has(match[1].toLowerCase())) return sql;
  if (/\breturning\b/i.test(sql)) return sql;
  return `${sql} RETURNING id`;
}

function buildRunResult(sql, result) {
  const wantsId = /^\s*insert\b/i.test(sql);
  return {
    lastID: wantsId ? result.rows[0]?.id : undefined,
    changes: result.rowCount,
  };
}

const db = {};

db.run = function (sql, params, cb) {
  if (typeof params === 'function') { cb = params; params = []; }
  params = params || [];
  const finalSql = withReturningId(sql);
  getExecutor()
    .query(toPg(finalSql), params)
    .then((result) => { if (cb) cb.call(buildRunResult(sql, result), null); })
    .catch((err) => {
      noteError(err);
      if (cb) cb.call({}, err);
      else if (!activeClient) console.error('[db.run] unhandled error:', err.message, '\n  SQL:', sql);
    });
};

db.get = function (sql, params, cb) {
  if (typeof params === 'function') { cb = params; params = []; }
  params = params || [];
  getExecutor()
    .query(toPg(sql), params)
    .then((result) => cb(null, result.rows[0]))
    .catch((err) => { noteError(err); cb(err); });
};

db.all = function (sql, params, cb) {
  if (typeof params === 'function') { cb = params; params = []; }
  params = params || [];
  getExecutor()
    .query(toPg(sql), params)
    .then((result) => cb(null, result.rows))
    .catch((err) => { noteError(err); cb(err); });
};

// Mirrors sqlite3's db.prepare(sql) -> stmt.run(...)/stmt.get(...)/stmt.finalize()
// bulk pattern. sqlite3 accepts both call styles and this codebase uses both:
// stmt.run(a, b, c, cb?) (varargs) and stmt.run([a, b, c], cb?) (array) —
// normalize whichever was passed into a flat params array.
function normalizeStmtArgs(args) {
  let cb;
  if (typeof args[args.length - 1] === 'function') cb = args.pop();
  const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return { params, cb };
}

db.prepare = function (sql) {
  const finalSql = withReturningId(sql);
  return {
    run(...args) {
      const { params, cb } = normalizeStmtArgs(args);
      getExecutor()
        .query(toPg(finalSql), params)
        .then((result) => { if (cb) cb.call(buildRunResult(sql, result), null); })
        .catch((err) => { noteError(err); if (cb) cb.call({}, err); });
      return this;
    },
    get(...args) {
      const { params, cb } = normalizeStmtArgs(args);
      getExecutor()
        .query(toPg(sql), params)
        .then((result) => cb(null, result.rows[0]))
        .catch((err) => { noteError(err); cb(err); });
    },
    finalize(cb) {
      if (cb) cb();
    },
  };
};

// Checks out ONE client and routes every db.run/get/all/prepare call issued
// synchronously inside fn() through it, wrapped in a real BEGIN/COMMIT/
// ROLLBACK transaction. pg's Client processes queries on a connection in the
// order .query() was called (a FIFO queue internal to the driver), so a final
// sentinel query after fn() reliably waits for everything fn() issued to
// finish before we decide whether to commit or roll back.
// Fire-and-forget from the caller's side, matching every existing call site
// (none of them await db.serialize() today). Does not support nesting —
// confirmed no call site in this codebase nests serialize() blocks.
db.serialize = function (fn) {
  const task = (async () => {
    const client = await pool.connect();
    const prevClient = activeClient;
    const prevErr = activeClientError;
    activeClient = client;
    activeClientError = null;
    try {
      await client.query('BEGIN');
      fn();
      await client.query('SELECT 1'); // drains the FIFO queue of queries fn() issued
      if (activeClientError) throw activeClientError;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[db.serialize] transaction rolled back:', err.message);
    } finally {
      activeClient = prevClient;
      activeClientError = prevErr;
      client.release();
    }
  })();
  task.catch((err) => console.error('[db.serialize] unexpected error:', err));
};

db.pool = pool;
// sqlite3 compatibility: scripts/seed*.js call db.close() when done.
db.close = function (cb) {
  pool.end().then(() => cb && cb(null)).catch((err) => cb && cb(err));
};

// ─── Schema (idempotent — safe to run on every boot) ────────────────────────
async function initSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    type TEXT DEFAULT 'entreprise',
    sms_balance INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    organization_id INTEGER,
    role_id INTEGER,
    status TEXT DEFAULT 'active',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    organization_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS sms_gateways (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    config TEXT,
    is_default INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    channel TEXT DEFAULT 'sms',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS sms_credit_transactions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    balance_after INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    key_value TEXT UNIQUE NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contact_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    group_id INTEGER,
    first_name TEXT,
    last_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    tags TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE SET NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS catalog_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'sms',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'sms',
    status TEXT DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER,
    organization_id INTEGER,
    contact_id INTEGER,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    twilio_sid TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS recharges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    organization_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    organization_id INTEGER,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS sms_queue (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER,
    organization_id INTEGER,
    contact_id INTEGER,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    gateway_id INTEGER,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    twilio_sid TEXT,
    channel TEXT DEFAULT 'sms',
    subject TEXT,
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS inbound_sms (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    from_phone TEXT NOT NULL,
    to_phone TEXT,
    message TEXT NOT NULL,
    gateway_provider TEXT,
    gateway_message_id TEXT,
    campaign_id INTEGER,
    contact_id INTEGER,
    is_read INTEGER DEFAULT 0,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS blacklist (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    phone TEXT NOT NULL,
    reason TEXT DEFAULT 'user_request',
    source TEXT DEFAULT 'manual',
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, phone)
  )`);
}

const ready = initSchema()
  .then(() => console.log('Postgres schema ready'))
  .catch((err) => console.error('Error initializing Postgres schema', err));

db.ready = ready;

module.exports = db;
