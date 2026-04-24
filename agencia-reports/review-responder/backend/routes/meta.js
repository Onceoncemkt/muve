const express = require('express');
const metaService = require('../services/metaService');

const router = express.Router();

// GET /api/meta/verify/:clientId
router.get('/verify/:clientId', async (req, res) => {
  try {
    const result = await metaService.verifyPageToken(req.params.clientId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/meta/fetch/:clientId  — manual sync trigger
router.get('/fetch/:clientId', async (req, res) => {
  try {
    const [fb, ig] = await Promise.all([
      metaService.fetchFacebookComments(req.params.clientId),
      metaService.fetchInstagramComments(req.params.clientId)
    ]);
    res.json({ new_facebook: fb, new_instagram: ig });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
