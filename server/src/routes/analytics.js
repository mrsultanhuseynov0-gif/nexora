'use strict';

const express = require('express');
const { adminRequired } = require('../middleware/auth');
const { trackEvent, getDashboard } = require('../analytics');

const router = express.Router();

/** Public beacon — storefront events */
router.post('/event', (req, res) => {
  try {
    const result = trackEvent(req.body || {});
    return res.json(result);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message || 'Xəta' });
  }
});

router.get('/dashboard', adminRequired, (req, res) => {
  const data = getDashboard({
    limit: req.query.limit,
    unsoldLimit: req.query.unsoldLimit
  });
  return res.json(data);
});

module.exports = router;
