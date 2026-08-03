'use strict';

const express = require('express');
const { consult } = require('../ai');
const { authOptional } = require('../middleware/auth');

const router = express.Router();

router.post('/consult', authOptional, (req, res) => {
  const text = String((req.body && (req.body.text || req.body.query || req.body.message)) || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Sorğu mətni tələb olunur' });
  }
  if (text.length > 500) {
    return res.status(400).json({ error: 'Sorğu çox uzundur (max 500 simvol)' });
  }
  try {
    const limit = Math.min(Math.max(parseInt(req.body && req.body.limit, 10) || 8, 1), 16);
    const history = Array.isArray(req.body && req.body.history) ? req.body.history.slice(-6).map(String) : [];
    const result = consult(text, {
      limit: limit,
      history: history,
      userId: req.user && req.user.id
    });
    return res.json(result);
  } catch (e) {
    console.error('AI consult error', e);
    return res.status(500).json({ error: 'Məsləhətçi xətası', detail: e.message });
  }
});

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'nexora-ai', mode: 'catalog-rules' });
});

module.exports = router;
