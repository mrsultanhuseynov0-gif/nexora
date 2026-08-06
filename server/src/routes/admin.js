'use strict';

const express = require('express');
const { db, publicUser, rowToProduct, productToRow } = require('../db');
const { adminRequired } = require('../middleware/auth');
const { persistLiveCatalog, livePath } = require('../catalog-persist');

const router = express.Router();

router.get('/catalog-backup', adminRequired, (_req, res) => {
  const products = db.prepare('SELECT * FROM products').all().map(rowToProduct);
  let cms = [];
  try {
    cms = db.prepare('SELECT key, data_json, updated_at FROM cms_docs').all();
  } catch (e) { /* ignore */ }
  const payload = {
    version: Date.now(),
    savedAt: new Date().toISOString(),
    products: products,
    cms: cms
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nexora-catalog-backup.json"');
  return res.send(JSON.stringify(payload, null, 2));
});

router.post('/catalog-backup/restore', adminRequired, (req, res) => {
  const data = req.body || {};
  const products = Array.isArray(data.products) ? data.products : [];
  if (!products.length && !Array.isArray(data.cms)) {
    return res.status(400).json({ error: 'Backup-də məhsul yoxdur' });
  }
  const insertProduct = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, sku, name, brand, brand_id, category, subcategory, price, old_price, currency,
      rating, reviews, badge, badge_type, in_stock, stock, is_new, tags_json, description,
      specs_json, images_json, gradient, image, review_list_json, raw_json
    ) VALUES (
      @id, @sku, @name, @brand, @brand_id, @category, @subcategory, @price, @old_price, @currency,
      @rating, @reviews, @badge, @badge_type, @in_stock, @stock, @is_new, @tags_json, @description,
      @specs_json, @images_json, @gradient, @image, @review_list_json, @raw_json
    )
  `);
  const tx = db.transaction(function () {
    if (products.length) {
      db.exec('DELETE FROM products;');
      products.forEach(function (p) { insertProduct.run(productToRow(p)); });
    }
    if (Array.isArray(data.cms)) {
      const upsert = db.prepare(
        'INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)'
      );
      data.cms.forEach(function (doc) {
        if (!doc || !doc.key) return;
        upsert.run(doc.key, doc.data_json || '{}', doc.updated_at || new Date().toISOString());
      });
    }
  });
  tx();
  persistLiveCatalog();
  return res.json({
    ok: true,
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    livePath: livePath()
  });
});

router.post('/catalog-backup/persist', adminRequired, (_req, res) => {
  const r = persistLiveCatalog();
  return res.json(r);
});

router.get('/users', adminRequired, (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows.map(publicUser) });
});

router.patch('/users/:id/role', adminRequired, (req, res) => {
  const role = String(req.body.role || '');
  if (role !== 'admin' && role !== 'customer') {
    return res.status(400).json({ error: 'Rol yanlışdır' });
  }
  if (req.params.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'Öz admin rolunuzu silə bilməzsiniz' });
  }
  const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
  return res.json({ ok: true });
});

router.delete('/users/:id', adminRequired, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Öz hesabınızı silə bilməzsiniz' });
  }
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
  return res.json({ ok: true });
});

router.post('/coupons', adminRequired, (req, res) => {
  const c = req.body || {};
  const code = String(c.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Kod tələb olunur' });
  db.prepare(`
    INSERT OR REPLACE INTO coupons (code, type, value, min_order, description, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(code, c.type || 'percent', Number(c.value) || 0, Number(c.minOrder) || 0, c.description || '', c.active === false ? 0 : 1);
  return res.status(201).json({ ok: true, code });
});

router.delete('/coupons/:code', adminRequired, (req, res) => {
  const info = db.prepare('DELETE FROM coupons WHERE code = ?').run(String(req.params.code).toUpperCase());
  if (!info.changes) return res.status(404).json({ error: 'Kupon tapılmadı' });
  return res.json({ ok: true });
});

module.exports = router;
