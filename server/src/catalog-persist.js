'use strict';

/**
 * Persist admin catalog next to SQLite so restarts can restore it.
 * On Render free, pair with a Persistent Disk (DATABASE_DIR) — otherwise
 * the whole filesystem (DB + this file) is wiped on redeploy.
 */

const fs = require('fs');
const path = require('path');
const { db, dbPath, rowToProduct, productToRow } = require('./db');

function livePath() {
  return path.join(path.dirname(dbPath), 'catalog-live.json');
}

function readCategories() {
  try {
    const rows = db.prepare('SELECT id, data_json FROM categories').all();
    return rows.map(function (r) {
      try { return JSON.parse(r.data_json); } catch (e) { return { id: r.id }; }
    });
  } catch (e) {
    return [];
  }
}

function persistLiveCatalog() {
  try {
    const products = db.prepare('SELECT * FROM products').all().map(rowToProduct);
    const categories = readCategories();
    let cms = [];
    try {
      cms = db.prepare('SELECT key, data_json, updated_at FROM cms_docs').all();
    } catch (e) { /* optional */ }
    const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'catalog_version'").get();
    const payload = {
      version: Number((versionRow && versionRow.value) || Date.now()),
      savedAt: new Date().toISOString(),
      products: products,
      categories: categories,
      cms: cms
    };
    const dest = livePath();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(payload));
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'catalog_live_saved_at',
      payload.savedAt
    );
    return { ok: true, path: dest, products: products.length, cms: cms.length };
  } catch (e) {
    console.warn('persistLiveCatalog failed:', e && e.message ? e.message : e);
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function restoreLiveCatalog() {
  const dest = livePath();
  if (!fs.existsSync(dest)) {
    return { restored: false, reason: 'no-backup' };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(dest, 'utf8'));
  } catch (e) {
    return { restored: false, reason: 'invalid-backup' };
  }

  const products = Array.isArray(data.products) ? data.products : [];
  const dbCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  const shouldRestoreProducts = dbCount === 0 && products.length > 0;

  if (!shouldRestoreProducts && !(Array.isArray(data.cms) && data.cms.length)) {
    return { restored: false, reason: dbCount > 0 ? 'db-has-products' : 'empty-backup', products: dbCount };
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
  const insertCategory = db.prepare(
    'INSERT OR REPLACE INTO categories (id, data_json) VALUES (@id, @data_json)'
  );

  db.pragma('foreign_keys = OFF');
  try {
    const tx = db.transaction(function () {
      if (shouldRestoreProducts) {
        for (let i = 0; i < products.length; i++) {
          insertProduct.run(productToRow(products[i]));
        }
        const cats = Array.isArray(data.categories) ? data.categories : [];
        for (let i = 0; i < cats.length; i++) {
          const cat = cats[i];
          if (!cat) continue;
          const id = cat.id || cat.slug;
          if (!id) continue;
          insertCategory.run({ id: id, data_json: JSON.stringify(cat) });
        }
        if (data.version != null) {
          db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
            'catalog_version',
            String(data.version)
          );
        }
      }

      if (Array.isArray(data.cms)) {
        try {
          const upsert = db.prepare(
            'INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)'
          );
          for (let i = 0; i < data.cms.length; i++) {
            const doc = data.cms[i];
            if (!doc || !doc.key) continue;
            upsert.run(doc.key, doc.data_json || '{}', doc.updated_at || new Date().toISOString());
          }
        } catch (e) { /* cms table may be missing */ }
      }

      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
        'catalog_restored_at',
        new Date().toISOString()
      );
    });
    tx();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  const n = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  console.log('Catalog restored from live backup:', n, 'products');
  return { restored: true, products: n, path: dest };
}

module.exports = {
  livePath,
  persistLiveCatalog,
  restoreLiveCatalog
};
