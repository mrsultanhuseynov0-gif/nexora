'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { db } = require('../db');
const { adminRequired, authOptional } = require('../middleware/auth');

const router = express.Router();
const ROOT = path.join(__dirname, '..', '..', '..');
const DATA = path.join(ROOT, 'data');

const ALLOWED = new Set([
  'site', 'brands', 'faq', 'hero', 'campaigns', 'categories', 'coupons', 'tech-news'
]);

db.exec(`
  CREATE TABLE IF NOT EXISTS cms_docs (
    key TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function readFileJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function ensureCmsSeed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM cms_docs').get().n;
  if (count > 0) return;
  const now = new Date().toISOString();
  const insert = db.prepare('INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)');
  const map = {
    site: 'site.json',
    brands: 'brands.json',
    faq: 'faq.json',
    hero: 'hero-slides.json',
    campaigns: 'campaigns.json',
    categories: 'categories.json',
    coupons: 'coupons.json',
    'tech-news': 'tech-news.json'
  };
  const tx = db.transaction(() => {
    Object.keys(map).forEach((key) => {
      try {
        insert.run(key, JSON.stringify(readFileJson(map[key])), now);
      } catch (e) {
        console.warn('CMS seed skip', key, e.message);
      }
    });
  });
  tx();

  // Existing DBs may miss newer CMS keys
  try {
    const hasNews = db.prepare('SELECT key FROM cms_docs WHERE key = ?').get('tech-news');
    if (!hasNews) {
      db.prepare('INSERT INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)')
        .run('tech-news', JSON.stringify(readFileJson('tech-news.json')), new Date().toISOString());
    }
  } catch (e) {
    console.warn('CMS tech-news ensure', e.message);
  }
}

ensureCmsSeed();

function ensureCmsKey(key, fileName) {
  try {
    const row = db.prepare('SELECT key FROM cms_docs WHERE key = ?').get(key);
    if (row) return;
    db.prepare('INSERT INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)')
      .run(key, JSON.stringify(readFileJson(fileName)), new Date().toISOString());
  } catch (e) {
    console.warn('CMS ensure', key, e.message);
  }
}
ensureCmsKey('site', 'site.json');

router.get('/:key', (req, res) => {
  const key = req.params.key;
  if (!ALLOWED.has(key)) return res.status(404).json({ error: 'Tapılmadı' });
  const row = db.prepare('SELECT data_json, updated_at FROM cms_docs WHERE key = ?').get(key);
  if (!row) return res.status(404).json({ error: 'Sənəd yoxdur' });
  try {
    return res.json({ key, updatedAt: row.updated_at, data: JSON.parse(row.data_json) });
  } catch (e) {
    return res.status(500).json({ error: 'JSON xətası' });
  }
});

router.put('/:key', adminRequired, (req, res) => {
  const key = req.params.key;
  if (!ALLOWED.has(key)) return res.status(404).json({ error: 'Tapılmadı' });
  const data = req.body && req.body.data != null ? req.body.data : req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'data obyekti tələb olunur' });
  }
  const now = new Date().toISOString();
  db.prepare('INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)')
    .run(key, JSON.stringify(data), now);

  // Keep coupons table in sync when coupons CMS is saved
  if (key === 'coupons' && Array.isArray(data.coupons)) {
    const tx = db.transaction(() => {
      db.exec('DELETE FROM coupons');
      const ins = db.prepare(`
        INSERT INTO coupons (code, type, value, min_order, description, active)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      data.coupons.forEach((c) => {
        ins.run(
          String(c.code || '').toUpperCase(),
          c.type || 'percent',
          Number(c.value) || 0,
          Number(c.minOrder) || 0,
          c.description || ''
        );
      });
    });
    tx();
  }

  try {
    require('../catalog-persist').persistLiveCatalog();
  } catch (e) { /* ignore */ }

  return res.json({ ok: true, key, updatedAt: now });
});

module.exports = { router, ensureCmsSeed, ALLOWED };
