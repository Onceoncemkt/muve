require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { getDb } = require('./database');
const cronService = require('./services/cronService');

const clientsRouter  = require('./routes/clients');
const googleRouter   = require('./routes/google');
const metaRouter     = require('./routes/meta');
const reviewsRouter  = require('./routes/reviews');

const app = express();
const PORT = process.env.PORT_REVIEWS || 4000;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json());

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/clients', clientsRouter);
app.use('/api/google',  googleRouter);
app.use('/api/meta',    metaRouter);
app.use('/api/reviews', reviewsRouter);

// GET /api/cron/logs
app.get('/api/cron/logs', (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM cron_log ORDER BY run_at DESC LIMIT 20').all();
  res.json(logs);
});

// POST /api/cron/run — manual trigger for testing
app.post('/api/cron/run', async (req, res) => {
  try {
    await cronService.runSync();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Google OAuth callback ───────────────────────────────────────────────────
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const FRONTEND = 'http://localhost:5173';

  if (error || !code || !state) {
    return res.redirect(`${FRONTEND}/clients?google=error&msg=${encodeURIComponent(error || 'missing_params')}`);
  }

  const [clientId] = state.split(':');
  const db = getDb();

  const creds = db.prepare(
    "SELECT * FROM client_credentials WHERE client_id = ? AND platform = 'google'"
  ).get(clientId);

  if (!creds || creds.google_oauth_state !== state) {
    return res.redirect(`${FRONTEND}/clients?google=error&msg=invalid_state`);
  }

  try {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback',
      grant_type: 'authorization_code'
    });

    const expiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    db.prepare(`
      UPDATE client_credentials
      SET google_access_token  = ?,
          google_refresh_token = COALESCE(?, google_refresh_token),
          google_token_expiry  = ?,
          google_oauth_state   = NULL
      WHERE client_id = ? AND platform = 'google'
    `).run(data.access_token, data.refresh_token || null, expiry, clientId);

    res.redirect(`${FRONTEND}/clients/${clientId}?google=connected`);
  } catch (err) {
    console.error('Google OAuth error:', err.response?.data || err.message);
    res.redirect(`${FRONTEND}/clients/${clientId}?google=error&msg=${encodeURIComponent('token_exchange_failed')}`);
  }
});

// ── Serve Vite build in production ──────────────────────────────────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ONCE ONCE REVIEWER backend running on http://localhost:${PORT}`);
  getDb(); // initialize DB on startup
  cronService.start();
});
