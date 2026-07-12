const db = require('../config/db');
const smsGateway = require('./smsGateway');
const mailGateway = require('./mailGateway');
const { renderTemplate } = require('./templateEngine');

const BATCH_SIZE = 50;
const CHECK_INTERVAL = 10000; // 10 seconds

let running = false;

function start() {
  if (running) return;
  running = true;
  console.log('[SMS Worker] Started — checking queue every 10s');
  setInterval(processScheduledCampaigns, CHECK_INTERVAL);
  setInterval(processQueue, CHECK_INTERVAL);
}

// ─── Process scheduled campaigns ─────────────────────────────────
function processScheduledCampaigns() {
  db.all(
    `SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= datetime('now')`,
    [],
    (err, campaigns) => {
      if (err || !campaigns.length) return;

      campaigns.forEach((campaign) => {
        console.log(`[SMS Worker] Activating campaign #${campaign.id} "${campaign.name}"`);

        // Get recipients from campaign_recipients with pending status
        db.all(
          `SELECT cr.id as cr_id, cr.contact_id, cr.phone, c.organization_id, c.first_name, c.last_name, c.email
           FROM campaign_recipients cr
           LEFT JOIN contacts c ON c.id = cr.contact_id
           WHERE cr.campaign_id = ? AND cr.status = 'pending'`,
          [campaign.id],
          (err2, recipients) => {
            if (err2 || !recipients.length) {
              // No recipients in campaign_recipients, try from groups
              return;
            }

            // Queue each recipient (message personalized per-recipient since it's fixed at insertion time)
            const stmt = db.prepare(
              'INSERT INTO sms_queue (campaign_id, organization_id, contact_id, phone, message, status, channel, subject) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            recipients.forEach((r) => {
              const personalizedMessage = renderTemplate(campaign.message, r);
              stmt.run(campaign.id, campaign.organization_id, r.contact_id, r.phone, personalizedMessage, 'queued', campaign.type, campaign.name);
            });
            stmt.finalize();

            // Update campaign status to 'sending'
            db.run("UPDATE campaigns SET status = 'sending' WHERE id = ?", [campaign.id]);

            // Update campaign_recipients status to 'queued'
            db.run("UPDATE campaign_recipients SET status = 'queued' WHERE campaign_id = ? AND status = 'pending'", [campaign.id]);
          }
        );
      });
    }
  );
}

// ─── Process the SMS queue ───────────────────────────────────────
function processQueue() {
  db.all(
    `SELECT sq.*, g.provider, g.config as gateway_config
     FROM sms_queue sq
     LEFT JOIN sms_gateways g ON g.id = sq.gateway_id
     WHERE sq.status IN ('queued', 'retry')
       AND (sq.next_retry_at IS NULL OR sq.next_retry_at <= datetime('now'))
     ORDER BY sq.queued_at ASC
     LIMIT ?`,
    [BATCH_SIZE],
    async (err, items) => {
      if (err || !items.length) return;

      const defaultSmsGateway = await smsGateway.getDefaultGateway();
      const defaultMailGateway = await mailGateway.getDefaultMailGateway();
      items.forEach((item) => {
        sendQueuedItem(item, item.channel === 'mail' ? defaultMailGateway : defaultSmsGateway);
      });
    }
  );
}

// ─── Send a single queued item (SMS or mail) ─────────────────────
function sendQueuedItem(item, defaultGateway) {
  // Mark as sending
  db.run(
    "UPDATE sms_queue SET status = 'sending', attempts = attempts + 1 WHERE id = ?",
    [item.id],
    async () => {
      const gateway = item.provider
        ? { id: item.gateway_id, provider: item.provider, config: item.gateway_config }
        : defaultGateway;

      const result = item.channel === 'mail'
        ? await mailGateway.sendMail({ to: item.phone, subject: item.subject, body: item.message, gateway })
        : await smsGateway.sendSms({ to: item.phone, body: item.message, gateway });
      const success = result.status !== 'failed';

      if (success) {
        // Success
        db.run(
          "UPDATE sms_queue SET status = 'sent', sent_at = datetime('now'), twilio_sid = ? WHERE id = ?",
          [result.sid, item.id]
        );

        // Update campaign_recipients
        if (item.campaign_id) {
          db.run(
            "UPDATE campaign_recipients SET status = 'delivered', sent_at = datetime('now') WHERE campaign_id = ? AND phone = ?",
            [item.campaign_id, item.phone]
          );

          // Update campaign counters
          db.run(
            "UPDATE campaigns SET delivered = delivered + 1, pending = pending - 1 WHERE id = ?",
            [item.campaign_id]
          );

          // Check if campaign is complete
          checkCampaignComplete(item.campaign_id);
        }

        // Deduct SMS credit
        if (item.organization_id) {
          db.run("UPDATE organizations SET sms_balance = sms_balance - 1 WHERE id = ?", [item.organization_id]);
        }
      } else {
        // Failure
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
            "UPDATE campaign_recipients SET status = 'failed', error_message = ?, sent_at = datetime('now') WHERE campaign_id = ? AND phone = ?",
            [errorMsg, item.campaign_id, item.phone]
          );
          db.run(
            "UPDATE campaigns SET failed = failed + 1, pending = pending - 1 WHERE id = ?",
            [item.campaign_id]
          );
          checkCampaignComplete(item.campaign_id);
        }
      }
    }
  );
}

// ─── Check if campaign is complete ───────────────────────────────
function checkCampaignComplete(campaignId) {
  db.get(
    "SELECT pending FROM campaigns WHERE id = ?",
    [campaignId],
    (err, campaign) => {
      if (err || !campaign) return;
      if (campaign.pending <= 0) {
        db.run("UPDATE campaigns SET status = 'sent' WHERE id = ? AND status = 'sending'", [campaignId]);
        console.log(`[SMS Worker] Campaign #${campaignId} completed`);

        // Create notification for the campaign owner
        db.get("SELECT user_id, organization_id, name FROM campaigns WHERE id = ?", [campaignId], (err2, c) => {
          if (err2 || !c) return;
          db.run(
            'INSERT INTO notifications (user_id, organization_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)',
            [c.user_id, c.organization_id, 'Campagne terminée', `La campagne "${c.name}" est terminée.`, 'success', '/campaigns']
          );
        });
      }
    }
  );
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
