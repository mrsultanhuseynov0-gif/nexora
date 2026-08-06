'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, productToRow } = require('./db');

function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    path.join(__dirname, '..', 'catalog-data'),
    path.join(process.cwd(), 'catalog-data'),
    path.join(__dirname, '..', '..', 'data'),
    path.join(process.cwd(), '..', 'data'),
    path.join(process.cwd(), 'data')
  ].filter(Boolean).map((p) => path.resolve(p));

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'products.json'))) return dir;
  }
  throw new Error('Catalog data not found. Tried: ' + candidates.join(' | '));
}

function readJson(name) {
  const full = path.join(resolveDataDir(), name);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function seed() {
  const productsData = readJson('products.json');
  const usersData = readJson('users.json');
  const couponsData = readJson('coupons.json');
  const categoriesData = readJson('categories.json');

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

  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, email, password_hash, name, phone, role, addresses_json, created_at)
    VALUES (@id, @email, @password_hash, @name, @phone, @role, @addresses_json, @created_at)
  `);

  const insertCoupon = db.prepare(`
    INSERT OR REPLACE INTO coupons (code, type, value, min_order, description, active)
    VALUES (@code, @type, @value, @min_order, @description, 1)
  `);

  const insertCategory = db.prepare(`
    INSERT OR REPLACE INTO categories (id, data_json) VALUES (@id, @data_json)
  `);

  db.pragma('foreign_keys = OFF');
  try {
    const tx = db.transaction(() => {
      // Child tables (orders, business_*, etc.) may already reference users.
      const diskProducts = productsData.products || [];
      db.exec(`
        DELETE FROM users;
        DELETE FROM coupons;
        DELETE FROM categories;
      `);
      // Only replace products when the seed file actually contains a catalog
      if (diskProducts.length) {
        db.exec('DELETE FROM products;');
        for (const p of diskProducts) {
          insertProduct.run(productToRow(p));
        }
      }

      for (const u of usersData.users || []) {
        insertUser.run({
          id: u.id,
          email: String(u.email).toLowerCase(),
          password_hash: bcrypt.hashSync(String(u.password), 10),
          name: u.name || 'User',
          phone: u.phone || '',
          role: u.role === 'admin' ? 'admin' : 'customer',
          addresses_json: JSON.stringify(u.addresses || []),
          created_at: u.createdAt || new Date().toISOString()
        });
      }

      for (const c of couponsData.coupons || []) {
        insertCoupon.run({
          code: String(c.code).toUpperCase(),
          type: c.type,
          value: Number(c.value) || 0,
          min_order: Number(c.minOrder) || 0,
          description: c.description || ''
        });
      }

      const cats = categoriesData.categories || categoriesData;
      if (Array.isArray(cats)) {
        for (const cat of cats) {
          insertCategory.run({ id: cat.id || cat.slug || uid('c'), data_json: JSON.stringify(cat) });
        }
      } else if (cats && typeof cats === 'object') {
        insertCategory.run({ id: 'all', data_json: JSON.stringify(categoriesData) });
      }

      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
        'catalog_version',
        String(productsData.version || 1)
      );
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
        'seeded_at',
        new Date().toISOString()
      );
    });

    tx();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  const counts = {
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    coupons: db.prepare('SELECT COUNT(*) AS n FROM coupons').get().n,
    categories: db.prepare('SELECT COUNT(*) AS n FROM categories').get().n
  };

  console.log('Seed complete:', counts);
  return counts;
}

/**
 * Sync products + categories from disk when catalog version changes.
 * Never wipes a live DB catalog with an empty products.json (admin data must survive deploys).
 */
function syncCatalogFromDisk() {
  const productsData = readJson('products.json');
  const categoriesData = readJson('categories.json');
  const fileVer = String(productsData.version || 0);
  const row = db.prepare("SELECT value FROM meta WHERE key = 'catalog_version'").get();
  const dbVer = row ? String(row.value) : '';
  const diskProducts = productsData.products || [];
  const dbCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;

  if (dbVer === fileVer) {
    return { synced: false, version: fileVer, products: dbCount };
  }

  // Critical: empty disk catalog must NOT delete admin-added products
  if (!diskProducts.length) {
    if (dbCount > 0) {
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('catalog_version', fileVer);
      console.log('Catalog sync skipped — empty products.json, keeping', dbCount, 'DB products');
      return { synced: false, skipped: 'empty-disk-keep-db', version: fileVer, products: dbCount };
    }
    // Both empty: only sync categories + version stamp
    const insertCategory = db.prepare(
      'INSERT OR REPLACE INTO categories (id, data_json) VALUES (@id, @data_json)'
    );
    const tx = db.transaction(function () {
      const cats = categoriesData.categories || categoriesData;
      if (Array.isArray(cats)) {
        db.exec('DELETE FROM categories;');
        for (const cat of cats) {
          insertCategory.run({ id: cat.id || cat.slug || uid('c'), data_json: JSON.stringify(cat) });
        }
      }
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('catalog_version', fileVer);
    });
    tx();
    return { synced: true, skipped: 'empty-products-categories-only', version: fileVer, products: 0 };
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
  const insertCategory = db.prepare(`
    INSERT OR REPLACE INTO categories (id, data_json) VALUES (@id, @data_json)
  `);

  db.pragma('foreign_keys = OFF');
  try {
    const tx = db.transaction(() => {
      db.exec('DELETE FROM products; DELETE FROM categories;');

      for (const p of diskProducts) {
        insertProduct.run(productToRow(p));
      }

      const cats = categoriesData.categories || categoriesData;
      if (Array.isArray(cats)) {
        for (const cat of cats) {
          insertCategory.run({ id: cat.id || cat.slug || uid('c'), data_json: JSON.stringify(cat) });
        }
      }

      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('catalog_version', fileVer);
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
        'catalog_synced_at',
        new Date().toISOString()
      );

      try {
        db.prepare('INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)').run(
          'categories',
          JSON.stringify(categoriesData),
          new Date().toISOString()
        );
      } catch (e) { /* cms_docs may not exist yet on very early boot */ }
    });
    tx();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  const counts = {
    synced: true,
    version: fileVer,
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    categories: db.prepare('SELECT COUNT(*) AS n FROM categories').get().n
  };
  console.log('Catalog synced from disk:', counts);
  return counts;
}

/**
 * Always ensure demo + admin accounts exist with known passwords.
 * Fixes production DBs that lost admin after catalog wipes / partial seeds.
 */
function ensureCoreUsers() {
  const usersData = readJson('users.json');
  const list = usersData.users || [];
  let fixed = 0;

  for (const u of list) {
    const email = String(u.email || '').trim().toLowerCase();
    if (!email || !u.password) continue;
    const role = u.role === 'admin' ? 'admin' : 'customer';
    const hash = bcrypt.hashSync(String(u.password), 10);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      db.prepare(`
        UPDATE users
        SET password_hash = ?, name = ?, phone = ?, role = ?
        WHERE email = ?
      `).run(hash, u.name || 'User', u.phone || '', role, email);
    } else {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, phone, role, addresses_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        u.id || uid('u'),
        email,
        hash,
        u.name || 'User',
        u.phone || '',
        role,
        JSON.stringify(u.addresses || []),
        u.createdAt || new Date().toISOString()
      );
    }
    fixed += 1;
  }

  console.log('Core users ensured:', fixed);
  return { ok: true, fixed };
}

if (require.main === module) {
  seed();
}

module.exports = { seed, syncCatalogFromDisk, ensureCoreUsers };
