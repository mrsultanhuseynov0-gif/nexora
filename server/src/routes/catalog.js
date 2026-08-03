'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT data_json FROM categories').all();
  const categories = rows.map((r) => {
    try { return JSON.parse(r.data_json); } catch (e) { return null; }
  }).filter(Boolean);

  // If we stored the whole file under id=all
  if (categories.length === 1 && categories[0].categories) {
    return res.json(categories[0]);
  }
  return res.json({ categories });
});

router.get('/coupons/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const row = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code);
  if (!row) return res.status(404).json({ error: 'Kupon tapılmadı' });
  return res.json({
    coupon: {
      code: row.code,
      type: row.type,
      value: row.value,
      minOrder: row.min_order,
      description: row.description
    }
  });
});

router.get('/coupons', (_req, res) => {
  const rows = db.prepare('SELECT * FROM coupons WHERE active = 1').all();
  return res.json({
    coupons: rows.map((row) => ({
      code: row.code,
      type: row.type,
      value: row.value,
      minOrder: row.min_order,
      description: row.description
    }))
  });
});

module.exports = router;
