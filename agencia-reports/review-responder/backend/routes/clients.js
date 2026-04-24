const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET /api/clients
router.get('/', (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT
      c.*,
      (SELECT COUNT(*) FROM client_credentials cc WHERE cc.client_id = c.id AND cc.platform = 'google' AND cc.google_refresh_token IS NOT NULL) AS google_connected,
      (SELECT COUNT(*) FROM client_credentials cc WHERE cc.client_id = c.id AND cc.platform = 'facebook' AND cc.meta_page_access_token IS NOT NULL) AS meta_connected,
      (SELECT COUNT(*) FROM client_credentials cc WHERE cc.client_id = c.id AND cc.platform = 'facebook' AND cc.meta_instagram_account_id IS NOT NULL) AS instagram_connected,
      (SELECT COUNT(*) FROM reviews r WHERE r.client_id = c.id AND r.status = 'pending') AS pending_count
    FROM clients c
    ORDER BY c.name
  `).all();
  res.json(clients);
});

// GET /api/clients/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const credentials = db.prepare(
    `SELECT platform, google_location_name, meta_page_id, meta_instagram_account_id,
            CASE WHEN google_refresh_token IS NOT NULL THEN 1 ELSE 0 END AS google_authorized
     FROM client_credentials WHERE client_id = ?`
  ).all(req.params.id);

  res.json({ ...client, credentials });
});

// POST /api/clients
router.post('/', (req, res) => {
  const { name, business_type, brand_personality, context } = req.body;
  if (!name || !business_type || !brand_personality) {
    return res.status(400).json({ error: 'name, business_type and brand_personality are required' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO clients (name, business_type, brand_personality, context)
    VALUES (?, ?, ?, ?)
  `).run(name, business_type, brand_personality, context || '');

  res.status(201).json({ id: result.lastInsertRowid, name, business_type, brand_personality, context: context || '' });
});

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  const { name, business_type, brand_personality, context } = req.body;
  db.prepare(`
    UPDATE clients
    SET name = COALESCE(?, name),
        business_type = COALESCE(?, business_type),
        brand_personality = COALESCE(?, brand_personality),
        context = COALESCE(?, context),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(name, business_type, brand_personality, context, req.params.id);

  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

// DELETE /api/clients/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PUT /api/clients/:id/credentials/meta
router.put('/:id/credentials/meta', (req, res) => {
  const db = getDb();
  const { meta_page_access_token, meta_page_id, meta_instagram_account_id } = req.body;

  db.prepare(`
    INSERT INTO client_credentials (client_id, platform, meta_page_access_token, meta_page_id, meta_instagram_account_id)
    VALUES (?, 'facebook', ?, ?, ?)
    ON CONFLICT(client_id, platform) DO UPDATE SET
      meta_page_access_token      = excluded.meta_page_access_token,
      meta_page_id                = excluded.meta_page_id,
      meta_instagram_account_id   = excluded.meta_instagram_account_id
  `).run(req.params.id, meta_page_access_token || null, meta_page_id || null, meta_instagram_account_id || null);

  res.json({ success: true });
});

module.exports = router;
