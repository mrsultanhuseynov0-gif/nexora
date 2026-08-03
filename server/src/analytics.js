'use strict';

const crypto = require('crypto');
const { db, rowToProduct } = require('./db');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      product_id TEXT,
      query TEXT,
      qty INTEGER NOT NULL DEFAULT 1,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(type);
    CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

    CREATE TABLE IF NOT EXISTS analytics_counters (
      key TEXT NOT NULL,
      ref TEXT NOT NULL DEFAULT '',
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (key, ref)
    );
  `);
}

migrate();

function uid() {
  return 'ev_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function bumpCounter(key, ref, by) {
  const n = Math.max(1, Number(by) || 1);
  const now = new Date().toISOString();
  const r = String(ref || '');
  db.prepare(`
    INSERT INTO analytics_counters (key, ref, count, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key, ref) DO UPDATE SET
      count = count + excluded.count,
      updated_at = excluded.updated_at
  `).run(key, r, n, now);
}

function trackEvent(payload) {
  const type = String(payload.type || '').toLowerCase();
  const allowed = ['view', 'cart', 'search'];
  if (!allowed.includes(type)) {
    const err = new Error('Hadisə tipi yanlışdır');
    err.status = 400;
    throw err;
  }

  const productId = payload.productId ? String(payload.productId).slice(0, 64) : null;
  const query = payload.query ? String(payload.query).trim().slice(0, 120).toLowerCase() : null;
  const qty = Math.max(1, Math.min(99, parseInt(payload.qty, 10) || 1));
  const now = new Date().toISOString();

  if (type === 'search' && !query) {
    const err = new Error('Axtarış sorğusu tələb olunur');
    err.status = 400;
    throw err;
  }
  if ((type === 'view' || type === 'cart') && !productId) {
    const err = new Error('Məhsul ID tələb olunur');
    err.status = 400;
    throw err;
  }

  db.prepare(`
    INSERT INTO analytics_events (id, type, product_id, query, qty, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?, '{}', ?)
  `).run(uid(), type, productId, query, qty, now);

  if (type === 'view') bumpCounter('views', productId, 1);
  if (type === 'cart') bumpCounter('carts', productId, qty);
  if (type === 'search') bumpCounter('searches', query, 1);

  return { ok: true };
}

function productMap() {
  const rows = db.prepare('SELECT * FROM products').all();
  const map = {};
  rows.forEach((r) => {
    const p = rowToProduct(r);
    if (p) map[p.id] = p;
  });
  return map;
}

function topCounters(key, limit, products) {
  const rows = db.prepare(`
    SELECT ref, count FROM analytics_counters
    WHERE key = ? AND ref != ''
    ORDER BY count DESC LIMIT ?
  `).all(key, limit);
  return rows.map((r, i) => {
    const p = products[r.ref];
    return {
      rank: i + 1,
      productId: r.ref,
      name: p ? p.name : r.ref,
      brand: p ? (p.brand || '') : '',
      image: p ? (p.image || '') : '',
      price: p ? p.price : null,
      count: r.count
    };
  });
}

function topSearches(limit) {
  return db.prepare(`
    SELECT ref AS query, count FROM analytics_counters
    WHERE key = 'searches' AND ref != ''
    ORDER BY count DESC LIMIT ?
  `).all(limit).map((r, i) => ({
    rank: i + 1,
    query: r.query,
    count: r.count
  }));
}

function topSold(limit, products) {
  const orders = db.prepare(`
    SELECT items_json, status FROM orders
    WHERE status != 'cancelled'
  `).all();
  const sold = {};
  orders.forEach((o) => {
    let items = [];
    try { items = JSON.parse(o.items_json || '[]'); } catch (e) { items = []; }
    items.forEach((item) => {
      const id = item.productId || item.id;
      if (!id) return;
      sold[id] = (sold[id] || 0) + (Number(item.qty) || 1);
    });
  });
  return Object.keys(sold)
    .map((id) => {
      const p = products[id];
      return {
        productId: id,
        name: p ? p.name : id,
        brand: p ? (p.brand || '') : '',
        image: p ? (p.image || '') : '',
        price: p ? p.price : null,
        count: sold[id]
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row, i) => Object.assign({ rank: i + 1 }, row));
}

function unsoldProducts(limit, products) {
  const soldIds = new Set();
  db.prepare(`SELECT items_json FROM orders WHERE status != 'cancelled'`).all()
    .forEach((o) => {
      let items = [];
      try { items = JSON.parse(o.items_json || '[]'); } catch (e) { items = []; }
      items.forEach((item) => {
        const id = item.productId || item.id;
        if (id) soldIds.add(id);
      });
    });

  return Object.keys(products)
    .filter((id) => !soldIds.has(id))
    .map((id) => {
      const p = products[id];
      const views = db.prepare(
        "SELECT count FROM analytics_counters WHERE key = 'views' AND ref = ?"
      ).get(id);
      const carts = db.prepare(
        "SELECT count FROM analytics_counters WHERE key = 'carts' AND ref = ?"
      ).get(id);
      return {
        productId: id,
        name: p.name,
        brand: p.brand || '',
        image: p.image || '',
        price: p.price,
        stock: p.stock || 0,
        views: views ? views.count : 0,
        carts: carts ? carts.count : 0
      };
    })
    .sort((a, b) => (b.views + b.carts) - (a.views + a.carts) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function seedDemoIfSparse(products) {
  const n = db.prepare("SELECT COUNT(*) AS c FROM analytics_counters WHERE key = 'views'").get().c;
  if (n >= 20) return;

  const ids = Object.keys(products);
  if (!ids.length) return;

  // Deterministic pseudo-popularity from product id
  ids.slice(0, 80).forEach((id, i) => {
    let h = 0;
    for (let c = 0; c < id.length; c++) h += id.charCodeAt(c) * (c + 1);
    const views = 5 + (h % 120) + (i < 10 ? 80 : 0);
    const carts = 1 + (h % 40) + (i < 8 ? 25 : 0);
    bumpCounter('views', id, views);
    bumpCounter('carts', id, carts);
  });

  const queries = [
    'iphone', 'samsung', 'laptop', 'tv 55', 'airpods', 'playstation',
    'monitor', 'noutbuk', 'smart watch', 'router', 'switch 24', 'ssd'
  ];
  queries.forEach((q, i) => bumpCounter('searches', q, 12 + i * 7 + (i % 3) * 5));
}

function getDashboard(opts) {
  const limit = Math.min(50, Math.max(5, parseInt(opts && opts.limit, 10) || 10));
  const unsoldLimit = Math.min(100, Math.max(5, parseInt(opts && opts.unsoldLimit, 10) || 20));
  const products = productMap();
  seedDemoIfSparse(products);

  const viewed = topCounters('views', limit, products);
  const carted = topCounters('carts', limit, products);
  const sold = topSold(limit, products);
  const searched = topSearches(limit);
  const unsold = unsoldProducts(unsoldLimit, products);

  const totals = {
    products: Object.keys(products).length,
    views: db.prepare("SELECT COALESCE(SUM(count),0) AS c FROM analytics_counters WHERE key = 'views'").get().c,
    carts: db.prepare("SELECT COALESCE(SUM(count),0) AS c FROM analytics_counters WHERE key = 'carts'").get().c,
    searches: db.prepare("SELECT COALESCE(SUM(count),0) AS c FROM analytics_counters WHERE key = 'searches'").get().c,
    soldSkus: sold.length,
    unsold: unsold.length,
    orders: db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status != 'cancelled'").get().c
  };

  return {
    generatedAt: new Date().toISOString(),
    totals,
    topViewed: viewed,
    topSold: sold,
    topCarted: carted,
    topSearched: searched,
    unsold
  };
}

module.exports = {
  trackEvent,
  getDashboard,
  seedDemoIfSparse
};
