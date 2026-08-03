'use strict';

const express = require('express');
const { db, rowToProduct, productToRow } = require('../db');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const subcategory = String(req.query.subcategory || '').trim();
  const brand = String(req.query.brand || req.query.brandId || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const sort = String(req.query.sort || 'name');

  const where = [];
  const params = {};

  if (q) {
    where.push('(lower(name) LIKE @q OR lower(brand) LIKE @q OR lower(description) LIKE @q OR lower(sku) LIKE @q)');
    params.q = '%' + q + '%';
  }
  if (category) {
    where.push('category = @category');
    params.category = category;
  }
  if (subcategory) {
    where.push('subcategory = @subcategory');
    params.subcategory = subcategory;
  }
  if (brand) {
    where.push('(brand_id = @brand OR lower(brand) = lower(@brand))');
    params.brand = brand;
  }

  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  let orderSql = 'ORDER BY name ASC';
  if (sort === 'price_asc') orderSql = 'ORDER BY price ASC';
  if (sort === 'price_desc') orderSql = 'ORDER BY price DESC';
  if (sort === 'rating') orderSql = 'ORDER BY rating DESC';
  if (sort === 'newest') orderSql = 'ORDER BY is_new DESC, name ASC';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM products ${whereSql}`).get(params).n;
  const rows = db.prepare(`
    SELECT * FROM products ${whereSql} ${orderSql} LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  const version = db.prepare("SELECT value FROM meta WHERE key = 'catalog_version'").get();

  return res.json({
    version: Number((version && version.value) || 1),
    total,
    limit,
    offset,
    products: rows.map(rowToProduct)
  });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ? OR sku = ?').get(req.params.id, req.params.id);
  if (!row) return res.status(404).json({ error: 'Məhsul tapılmadı' });
  return res.json({ product: rowToProduct(row) });
});

router.post('/', adminRequired, (req, res) => {
  const p = req.body || {};
  if (!p.id || !p.name) {
    return res.status(400).json({ error: 'id və name tələb olunur' });
  }
  const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(p.id);
  if (exists) return res.status(409).json({ error: 'Bu id artıq var' });

  const row = productToRow(p);
  db.prepare(`
    INSERT INTO products (
      id, sku, name, brand, brand_id, category, subcategory, price, old_price, currency,
      rating, reviews, badge, badge_type, in_stock, stock, is_new, tags_json, description,
      specs_json, images_json, gradient, image, review_list_json, raw_json
    ) VALUES (
      @id, @sku, @name, @brand, @brand_id, @category, @subcategory, @price, @old_price, @currency,
      @rating, @reviews, @badge, @badge_type, @in_stock, @stock, @is_new, @tags_json, @description,
      @specs_json, @images_json, @gradient, @image, @review_list_json, @raw_json
    )
  `).run(row);

  return res.status(201).json({ product: rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id)) });
});

router.put('/:id', adminRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Məhsul tapılmadı' });

  const current = rowToProduct(existing);
  const merged = { ...current, ...req.body, id: req.params.id };
  const row = productToRow(merged);

  db.prepare(`
    UPDATE products SET
      sku=@sku, name=@name, brand=@brand, brand_id=@brand_id, category=@category,
      subcategory=@subcategory, price=@price, old_price=@old_price, currency=@currency,
      rating=@rating, reviews=@reviews, badge=@badge, badge_type=@badge_type,
      in_stock=@in_stock, stock=@stock, is_new=@is_new, tags_json=@tags_json,
      description=@description, specs_json=@specs_json, images_json=@images_json,
      gradient=@gradient, image=@image, review_list_json=@review_list_json, raw_json=@raw_json
    WHERE id=@id
  `).run(row);

  return res.json({ product: rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)) });
});

router.delete('/:id', adminRequired, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Məhsul tapılmadı' });
  return res.json({ ok: true });
});

module.exports = router;
