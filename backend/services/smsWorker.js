const db = require('../config/db');
const smsGateway = require('./smsGateway');
const mailGateway = require('./mailGateway');
const { renderTemplate } = require('./templateEngine');

// Lowered from 50: a full batch at the existing 250ms Orange TPS pacing plus
// real network latency risks exceeding Vercel's function duration limit
// (10s on Hobby). The queue drains over more frequent invocations instead.
const BATCH_SIZE = 20;
const CHECK_INTERVAL = 10000; // 10 seconds, local dev only (see start())

let running = false;

// Only used by the local-dev entrypoint (backend/server.js). On Vercel there
// is no persistent process to poll from — processScheduledCampaigns/
// processQueue are instead triggered over HTTP by an external scheduler
// (see .github/workflows/cron.yml) hitting backend/app.js's /api/cron/* routes.
function start() {
  if (running) return;
  running = true;
  console.log('[SMS Worker] Started — checking queue every 10s');
  setInterval(() => { processScheduledCampaigns().catch((err) => console.error('[SMS Worker] processScheduledCampaigns error:', err)); }, CHECK_INTERVAL);
  setInterval(() => { processQueue().catch((err) => console.error('[SMS Worker] processQueue error:', err)); }, CHECK_INTERVAL);
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

// ─── Process scheduled campaigns ─────────────────────────────────
// Returns a summary so the /api/cron/process-scheduled-campaigns route has
// something to log/respond with.
async function processScheduledCampaigns() {
  const campaigns = await dbAll(`SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()`, []);
  if (!campaigns.length) return { activated: 0 };

  let activated = 0;
  for (const campaign of campaigns) {
    console.log(`[SMS Worker] Activating campaign #${campaign.id} "${campaign.name}"`);

    const recipients = await dbAll(
      `SELECT cr.id as cr_id, cr.contact_id, cr.phone, c.organization_id, c.first_name, c.last_name, c.email
       FROM campaign_recipients cr
       LEFT JOIN contacts c ON c.id = cr.contact_id
       WHERE cr.campaign_id = ? AND cr.status = 'pending'`,
      [campaign.id]
    );
    if (!recipients.length) continue;

    // Queue each recipient (message personalized per-recipient since it's fixed at insertion time)
    const stmt = db.prepare(
      'INSERT INTO sms_queue (campaign_id, organization_id, contact_id, phone, message, status, channel, subject) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    recipients.forEach((r) => {
      const personalizedMessage = renderTemplate(campaign.message, r);
      stmt.run(campaign.id, campaign.organization_id, r.contact_id, r.phone, personalizedMessage, 'queued', campaign.type, campaign.name);
    });
    stmt.finalize();

    db.run("UPDATE campaigns SET status = 'sending' WHERE id = ?", [campaign.id]);
    db.run("UPDATE campaign_recipients SET status = 'queued' WHERE campaign_id = ? AND status = 'pending'", [campaign.id]);
    activated++;
  }

  return { activated };
}

// ─── Process the SMS queue ───────────────────────────────────────
async function processQueue() {
  const items = await dbAll(
    `SELECT sq.*, g.provider, g.config as gateway_config
     FROM sms_queue sq
     LEFT JOIN sms_gateways g ON g.id = sq.gateway_id
     WHERE sq.status IN ('queued', 'retry')
       AND (sq.next_retry_at IS NULL OR sq.next_retry_at <= NOW())
     ORDER BY sq.queued_at ASC
     LIMIT ?`,
    [BATCH_SIZE]
  );
  if (!items.length) return { processed: 0 };

  // Group items by organization_id so we can resolve the correct per-org gateway
  const orgIds = [...new Set(items.map(i => i.organization_id).filter(Boolean))];
  const smsGatewayCache = {};
  const mailGatewayCache = {};
  for (const orgId of orgIds) {
    smsGatewayCache[orgId] = await smsGateway.getDefaultGateway(orgId);
    mailGatewayCache[orgId] = await mailGateway.getDefaultMailGateway(orgId);
  }
  const globalSmsGateway = await smsGateway.getDefaultGateway();
  const globalMailGateway = await mailGateway.getDefaultMailGateway();

  // Orange's SMS API caps outbound requests at 5/second; pace launches instead of
  // firing the whole batch concurrently (each send still completes independently).
  const sends = [];
  for (const item of items) {
    const orgId = item.organization_id;
    const gw = item.channel === 'mail'
      ? (mailGatewayCache[orgId] || globalMailGateway)
      : (smsGatewayCache[orgId] || globalSmsGateway);
    sends.push(sendQueuedItem(item, gw));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await Promise.all(sends);

  return { processed: items.length };
}

// ─── Send a single queued item (SMS or mail) ─────────────────────
async function sendQueuedItem(item, defaultGateway) {
  await new Promise((resolve, reject) => {
    db.run("UPDATE sms_queue SET status = 'sending', attempts = attempts + 1 WHERE id = ?", [item.id], (err) => (err ? reject(err) : resolve()));
  });

  const gateway = item.provider
    ? { id: item.gateway_id, provider: item.provider, config: item.gateway_config }
    : defaultGateway;

  const result = item.channel === 'mail'
    ? await mailGateway.sendMail({ to: item.phone, subject: item.subject, body: item.message, gateway })
    : await smsGateway.sendSms({ to: item.phone, body: item.message, gateway, correlationId: item.id });
  const success = result.status !== 'failed';

  if (success) {
    db.run("UPDATE sms_queue SET status = 'sent', sent_at = NOW(), twilio_sid = ? WHERE id = ?", [result.sid, item.id]);

    // Update campaign_recipients (twilio_sid stored too so the DR webhook can
    // correlate exactly by callbackData instead of guessing by recipient phone)
    if (item.campaign_id) {
      db.run(
        "UPDATE campaign_recipients SET status = 'delivered', sent_at = NOW(), twilio_sid = ? WHERE campaign_id = ? AND phone = ?",
        [result.sid, item.campaign_id, item.phone]
      );
      db.run("UPDATE campaigns SET delivered = delivered + 1, pending = pending - 1 WHERE id = ?", [item.campaign_id]);
      checkCampaignComplete(item.campaign_id);
    }

    if (item.organization_id) {
      db.run("UPDATE organizations SET sms_balance = sms_balance - 1 WHERE id = ?", [item.organization_id]);
    }
  } else {
    const errorMsg = result.error || 'Gateway error';
    const shouldRetry = item.attempts < item.max_attempts;
    const retryDelay = Math.pow(2, item.attempts) * 60; // exponential backoff in seconds

    db.run(
      `UPDATE sms_queue SET status = ?, error_message = ?, next_retry_at = ? WHERE id = ?`,
      [
        shouldRetry ? 'retry' : 'failed',
        errorMsg,
        shouldRetry ? new Date(Date.now() + retryDelay * 1000).toISOString() : null,
        item.id,
      ]
    );

    if (!shouldRetry && item.campaign_id) {
      db.run(
        "UPDATE campaign_recipients SET status = 'failed', error_message = ?, sent_at = NOW() WHERE campaign_id = ? AND phone = ?",
        [errorMsg, item.campaign_id, item.phone]
      );
      db.run("UPDATE campaigns SET failed = failed + 1, pending = pending - 1 WHERE id = ?", [item.campaign_id]);
      checkCampaignComplete(item.campaign_id);
    }
  }
}

// ─── Check if campaign is complete ───────────────────────────────
function checkCampaignComplete(campaignId) {
  db.get("SELECT pending FROM campaigns WHERE id = ?", [campaignId], (err, campaign) => {
    if (err || !campaign) return;
    if (campaign.pending <= 0) {
      db.run("UPDATE campaigns SET status = 'sent' WHERE id = ? AND status = 'sending'", [campaignId]);
      console.log(`[SMS Worker] Campaign #${campaignId} completed`);

      db.get("SELECT user_id, organization_id, name FROM campaigns WHERE id = ?", [campaignId], (err2, c) => {
        if (err2 || !c) return;
        db.run(
          'INSERT INTO notifications (user_id, organization_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)',
          [c.user_id, c.organization_id, 'Campagne terminée', `La campagne "${c.name}" est terminée.`, 'success', '/campaigns']
        );
      });
    }
  });
}

// ─── Queue SMS for sending ───────────────────────────────────────
function queueSms({ campaignId, organizationId, contactId, phone, message, gatewayId }) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sms_queue (campaign_id, organization_id, contact_id, phone, message, status, gateway_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [campaignId || null, organizationId || null, contactId || null, phone, message, 'queued', gatewayId || null],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

module.exports = { start, queueSms, processScheduledCampaigns, processQueue };
