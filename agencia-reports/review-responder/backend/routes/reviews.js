const express = require('express');
const { getDb } = require('../database');
const aiService = require('../services/aiService');
const googleService = require('../services/googleService');
const metaService = require('../services/metaService');

const router = express.Router();

// GET /api/reviews/stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT platform, status, COUNT(*) AS count
    FROM reviews
    GROUP BY platform, status
  `).all();

  const totals = db.prepare(`
    SELECT status, COUNT(*) AS count FROM reviews GROUP BY status
  `).all();

  res.json({ by_platform: stats, totals });
});

// GET /api/reviews
router.get('/', (req, res) => {
  const db = getDb();
  const { client_id, status, platform, page = 1, limit = 20, search } = req.query;

  const conditions = [];
  const params = [];

  if (client_id) { conditions.push('r.client_id = ?'); params.push(client_id); }
  if (status)    { conditions.push('r.status = ?');    params.push(status); }
  if (platform)  { conditions.push('r.platform = ?');  params.push(platform); }
  if (search)    { conditions.push('r.content LIKE ?'); params.push(`%${search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const total = db.prepare(`SELECT COUNT(*) AS count FROM reviews r ${where}`).get(...params).count;
  const rows = db.prepare(`
    SELECT r.*, c.name AS client_name
    FROM reviews r
    JOIN clients c ON c.id = r.client_id
    ${where}
    ORDER BY r.fetched_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/reviews/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const review = db.prepare(`
    SELECT r.*, c.name AS client_name
    FROM reviews r JOIN clients c ON c.id = r.client_id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!review) return res.status(404).json({ error: 'Review not found' });
  res.json(review);
});

// POST /api/reviews/:id/generate
router.post('/:id/generate', async (req, res) => {
  try {
    const suggestion = await aiService.generateResponse(req.params.id);
    const db = getDb();
    res.json({ ai_suggestion: suggestion, review: db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews/:id/regenerate (alias — always overwrites)
router.post('/:id/regenerate', async (req, res) => {
  try {
    const suggestion = await aiService.generateResponse(req.params.id);
    const db = getDb();
    res.json({ ai_suggestion: suggestion, review: db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reviews/:id/approve
router.put('/:id/approve', (req, res) => {
  const db = getDb();
  const { edited_response } = req.body || {};

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  if (edited_response) {
    db.prepare('UPDATE reviews SET ai_suggestion = ?, status = ? WHERE id = ?')
      .run(edited_response, 'approved', req.params.id);
  } else {
    db.prepare("UPDATE reviews SET status = 'approved' WHERE id = ?").run(req.params.id);
  }

  res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id));
});

// PUT /api/reviews/:id/ignore
router.put('/:id/ignore', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE reviews SET status = 'ignored' WHERE id = ?").run(req.params.id);
  res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id));
});

// PUT /api/reviews/:id/restore  (ignored → pending)
router.put('/:id/restore', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE reviews SET status = 'pending' WHERE id = ?").run(req.params.id);
  res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id));
});

// POST /api/reviews/:id/publish
router.post('/:id/publish', async (req, res) => {
  const db = getDb();
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  if (!review.ai_suggestion) return res.status(400).json({ error: 'No response to publish' });

  try {
    if (review.platform === 'google') {
      await googleService.publishReply(review.client_id, review.external_id, review.ai_suggestion);
    } else if (review.platform === 'facebook') {
      await metaService.publishFacebookReply(review.client_id, review.external_id, review.ai_suggestion);
    } else if (review.platform === 'instagram') {
      await metaService.publishInstagramReply(review.client_id, review.external_id, review.ai_suggestion);
    }

    db.prepare("UPDATE reviews SET status = 'published', published_at = datetime('now') WHERE id = ?")
      .run(req.params.id);

    res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
