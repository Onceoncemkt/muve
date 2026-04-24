const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const googleService = require('../services/googleService');

const router = express.Router();

// GET /api/google/auth-url/:clientId
router.get('/auth-url/:clientId', (req, res) => {
  const db = getDb();
  const { clientId } = req.params;

  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const state = `${clientId}:${uuidv4()}`;

  // Store state for CSRF validation
  db.prepare(`
    INSERT INTO client_credentials (client_id, platform, google_oauth_state)
    VALUES (?, 'google', ?)
    ON CONFLICT(client_id, platform) DO UPDATE SET google_oauth_state = excluded.google_oauth_state
  `).run(clientId, state);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    state
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// GET /api/google/status/:clientId — dedicated connection status
router.get('/status/:clientId', (req, res) => {
  const db = getDb();
  const creds = db.prepare(
    "SELECT google_refresh_token, google_location_name FROM client_credentials WHERE client_id = ? AND platform = 'google'"
  ).get(req.params.clientId);

  res.json({
    authorized: !!(creds && creds.google_refresh_token),
    location_name: creds?.google_location_name || null
  });
});

// GET /api/google/locations/:clientId
router.get('/locations/:clientId', async (req, res) => {
  try {
    const locations = await googleService.getLocations(req.params.clientId);
    res.json(locations);
  } catch (err) {
    const code = err.response?.data?.error?.code;
    const status = code === 429 ? 429 : 400;
    res.status(status).json({ error: err.message, detail: err.response?.data });
  }
});

// PUT /api/google/locations/:clientId
router.put('/locations/:clientId', (req, res) => {
  const db = getDb();
  const { location_name } = req.body;
  if (!location_name) return res.status(400).json({ error: 'location_name required' });

  db.prepare(`
    UPDATE client_credentials SET google_location_name = ?
    WHERE client_id = ? AND platform = 'google'
  `).run(location_name, req.params.clientId);

  res.json({ success: true });
});

// GET /api/google/reviews/:clientId  — manual sync trigger
router.get('/reviews/:clientId', async (req, res) => {
  try {
    const count = await googleService.fetchReviews(req.params.clientId);
    res.json({ new_reviews: count });
  } catch (err) {
    console.error('[Google sync error]', err.response?.data || err.message);
    res.status(400).json({ error: err.message, detail: err.response?.data });
  }
});

module.exports = router;
