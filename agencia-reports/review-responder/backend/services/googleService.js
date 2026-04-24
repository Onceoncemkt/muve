const axios = require('axios');
const { getDb } = require('../database');

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVIEWS_BASE    = 'https://mybusiness.googleapis.com/v4';

const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

function getCredentials(clientId) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM client_credentials WHERE client_id = ? AND platform = 'google'"
  ).get(clientId);
}

async function refreshTokenIfNeeded(clientId) {
  const db = getDb();
  const creds = getCredentials(clientId);
  if (!creds || !creds.google_refresh_token) return null;

  const expiry = creds.google_token_expiry ? new Date(creds.google_token_expiry) : null;
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiry && expiry > fiveMinFromNow) return creds.google_access_token;

  const { data } = await axios.post(OAUTH_TOKEN_URL, {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: creds.google_refresh_token,
    grant_type: 'refresh_token'
  });

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  db.prepare(`
    UPDATE client_credentials
    SET google_access_token = ?, google_token_expiry = ?
    WHERE client_id = ? AND platform = 'google'
  `).run(data.access_token, newExpiry, clientId);

  return data.access_token;
}

async function getLocations(clientId) {
  const token = await refreshTokenIfNeeded(clientId);
  if (!token) throw new Error('Google not connected for this client');

  // Step 1: list accounts via Account Management API
  const { data: accountsData } = await axios.get(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const accounts = accountsData.accounts || [];
  if (!accounts.length) return [];

  // Step 2: list locations for each account via Business Information API
  const locations = [];
  for (const account of accounts) {
    try {
      const { data } = await axios.get(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.locations) {
        locations.push(...data.locations.map(l => ({ name: l.name, title: l.title || l.name })));
      }
    } catch (err) {
      console.warn(`Could not fetch locations for ${account.name}:`, err.response?.data?.error?.message || err.message);
    }
  }
  return locations;
}

function normalizeLocationName(raw) {
  if (!raw) return null;
  // Reject Maps URLs or anything that isn't the accounts/X/locations/Y format
  if (raw.startsWith('http') || raw.includes('maps.google') || raw.includes('maps.app.goo')) return null;
  // Already correct format
  if (raw.startsWith('accounts/') && raw.includes('/locations/')) return raw;
  // Bare numeric ID — treat as both accountId and locationId (single-location personal accounts)
  if (/^\d+$/.test(raw.trim())) return `accounts/${raw.trim()}/locations/${raw.trim()}`;
  return raw;
}

async function fetchReviews(clientId) {
  const db = getDb();
  const token = await refreshTokenIfNeeded(clientId);
  if (!token) return 0;

  const creds = getCredentials(clientId);
  const locationName = normalizeLocationName(creds?.google_location_name);
  if (!locationName) return 0;

  let newCount = 0;
  let nextPageToken = null;

  do {
    const url = `${REVIEWS_BASE}/${locationName}/reviews?pageSize=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const reviews = data.reviews || [];
    nextPageToken = data.nextPageToken || null;

    for (const review of reviews) {
      if (review.reviewReply) continue; // already replied

      const existing = db.prepare(
        "SELECT id FROM reviews WHERE platform = 'google' AND external_id = ?"
      ).get(review.reviewId);
      if (existing) continue;

      db.prepare(`
        INSERT INTO reviews (client_id, platform, external_id, author_name, content, star_rating, status)
        VALUES (?, 'google', ?, ?, ?, ?, 'pending')
      `).run(
        clientId,
        review.reviewId,
        review.reviewer?.displayName || 'Anónimo',
        review.comment || null,
        STAR_MAP[review.starRating] || null
      );
      newCount++;
    }
  } while (nextPageToken);

  return newCount;
}

async function publishReply(clientId, externalId, replyText) {
  const token = await refreshTokenIfNeeded(clientId);
  if (!token) throw new Error('Google not connected');

  const creds = getCredentials(clientId);
  const locationName = normalizeLocationName(creds?.google_location_name);
  if (!locationName) throw new Error('No Google location configured');

  await axios.put(
    `${REVIEWS_BASE}/${locationName}/reviews/${externalId}/reply`,
    { comment: replyText },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

module.exports = { getLocations, fetchReviews, publishReply, getCredentials };
