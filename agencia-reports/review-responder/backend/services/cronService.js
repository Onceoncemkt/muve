const cron = require('node-cron');
const { getDb } = require('../database');
const googleService = require('./googleService');
const metaService = require('./metaService');
const aiService = require('./aiService');

async function runSync() {
  const db = getDb();
  const clients = db.prepare('SELECT id FROM clients').all();

  let totalNew = 0;
  let errorMessages = [];

  for (const { id: clientId } of clients) {
    // Google
    const googleCreds = db.prepare(
      "SELECT id FROM client_credentials WHERE client_id = ? AND platform = 'google' AND google_refresh_token IS NOT NULL"
    ).get(clientId);

    if (googleCreds) {
      try {
        const count = await googleService.fetchReviews(clientId);
        totalNew += count;
      } catch (err) {
        errorMessages.push(`Google client ${clientId}: ${err.message}`);
      }
    }

    // Meta (Facebook + Instagram)
    const metaCreds = db.prepare(
      "SELECT id FROM client_credentials WHERE client_id = ? AND platform = 'facebook' AND meta_page_access_token IS NOT NULL"
    ).get(clientId);

    if (metaCreds) {
      try {
        const fb = await metaService.fetchFacebookComments(clientId);
        totalNew += fb;
      } catch (err) {
        errorMessages.push(`Facebook client ${clientId}: ${err.message}`);
      }

      const igCreds = db.prepare(
        "SELECT id FROM client_credentials WHERE client_id = ? AND platform = 'facebook' AND meta_instagram_account_id IS NOT NULL"
      ).get(clientId);

      if (igCreds) {
        try {
          const ig = await metaService.fetchInstagramComments(clientId);
          totalNew += ig;
        } catch (err) {
          errorMessages.push(`Instagram client ${clientId}: ${err.message}`);
        }
      }
    }
  }

  // Auto-generate AI suggestions for all new pending reviews without one
  const pending = db.prepare(
    "SELECT id FROM reviews WHERE status = 'pending' AND ai_suggestion IS NULL"
  ).all();

  for (const { id: reviewId } of pending) {
    try {
      await aiService.generateResponse(reviewId);
    } catch (err) {
      errorMessages.push(`AI review ${reviewId}: ${err.message}`);
    }
  }

  db.prepare(`
    INSERT INTO cron_log (clients_checked, new_items, errors)
    VALUES (?, ?, ?)
  `).run(clients.length, totalNew, errorMessages.length ? errorMessages.join(' | ') : null);

  console.log(`[cron] ${new Date().toISOString()} — checked ${clients.length} clients, ${totalNew} new items, ${errorMessages.length} errors`);
}

function start() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', () => {
    runSync().catch(err => console.error('[cron] Unhandled error:', err));
  });

  console.log('[cron] Scheduler started — runs every hour');
}

module.exports = { start, runSync };
