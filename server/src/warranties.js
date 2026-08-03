'use strict';

const crypto = require('crypto');
const { db, rowToProduct } = require('./db');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS warranties (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      order_id TEXT,
      product_id TEXT,
      product_name TEXT NOT NULL,
      brand TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      serial TEXT DEFAULT '',
      months INTEGER NOT NULL DEFAULT 12,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      meta_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_warranties_user ON warranties(user_id);
    CREATE INDEX IF NOT EXISTS idx_warranties_end ON warranties(end_at);
  `);
}

migrate();

function parseWarrantyMonths(product, item) {
  const specs = (product && product.specs) || {};
  const text = [
    specs['Zəmanət'], specs.Warranty, specs.warranty, specs['Гарантия'],
    item && item.warranty, product && product.warrantyMonths
  ].filter(Boolean).join(' ');
  const m = String(text).match(/(\d+)\s*(ay|month|месяц|il|year|год)/i);
  if (m) {
    let n = Number(m[1]);
    if (/il|year|год/i.test(m[2])) n *= 12;
    if (n >= 1 && n <= 60) return n;
  }
  if (product && Number(product.warrantyMonths) > 0) return Number(product.warrantyMonths);
  const cat = String((product && product.category) || '').toLowerCase();
  if (cat === 'electronics' || cat === 'computers') return 24;
  if (cat === 'server') return 36;
  return 12;
}

function daysBetween(from, to) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

function enrich(row) {
  const now = new Date();
  const end = new Date(row.end_at);
  const start = new Date(row.start_at);
  const daysLeft = daysBetween(now, end);
  let status = row.status || 'active';
  if (status === 'active' && daysLeft < 0) status = 'expired';
  if (status === 'active' && daysLeft <= 30) status = 'expiring';
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    brand: row.brand || '',
    sku: row.sku || '',
    serial: row.serial || '',
    months: row.months,
    startAt: row.start_at.slice(0, 10),
    endAt: row.end_at.slice(0, 10),
    daysLeft,
    status,
    createdAt: row.created_at
  };
}

function makeSerial(seed) {
  const h = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 10).toUpperCase();
  return 'NX-' + h.slice(0, 4) + '-' + h.slice(4, 10);
}

function ensureFromOrder(order, userId) {
  const created = [];
  const items = typeof order.items_json === 'string'
    ? JSON.parse(order.items_json)
    : (order.items || []);
  const startAt = order.created_at || order.createdAt || new Date().toISOString();
  const start = new Date(startAt);

  items.forEach((item, idx) => {
    const productId = item.productId || item.id || null;
    const wid = 'war_' + (order.id || 'x') + '_' + (productId || idx) + '_' + idx;
    const existing = db.prepare('SELECT id FROM warranties WHERE id = ?').get(wid);
    if (existing) return;

    let product = null;
    if (productId) {
      const prow = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      product = rowToProduct(prow);
    }
    const months = parseWarrantyMonths(product, item);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO warranties (
        id, user_id, order_id, product_id, product_name, brand, sku, serial,
        months, start_at, end_at, status, meta_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '{}', ?)
    `).run(
      wid,
      userId,
      order.id,
      productId,
      item.name || (product && product.name) || 'Məhsul',
      (product && product.brand) || item.brand || '',
      (product && product.sku) || item.sku || productId || '',
      makeSerial(wid),
      months,
      start.toISOString(),
      end.toISOString(),
      now
    );
    created.push(wid);
  });
  return created;
}

function syncUserWarranties(userId) {
  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ? AND status IN ('pending','paid','shipped','delivered')
    ORDER BY created_at DESC
  `).all(userId);
  orders.forEach((o) => ensureFromOrder(o, userId));
}

function seedDemoIfEmpty(userId, email) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM warranties WHERE user_id = ?').get(userId).c;
  // Top up demo/admin so the center shows active / expiring / expired examples
  if (n >= 3) return;
  // Prefer phone + laptop for Digital Twin demos, then fill
  const preferred = [];
  const phone = db.prepare(`
    SELECT * FROM products WHERE subcategory = 'smartphones' ORDER BY rating DESC LIMIT 1
  `).get();
  const laptop = db.prepare(`
    SELECT * FROM products WHERE subcategory = 'laptops' ORDER BY rating DESC LIMIT 1
  `).get();
  if (phone) preferred.push(phone);
  if (laptop) preferred.push(laptop);
  let extra = [];
  if (preferred.length) {
    extra = db.prepare(`
      SELECT * FROM products
      WHERE (category IN ('electronics','computers','phones','server') OR subcategory IN ('tv','printers'))
        AND id NOT IN (${preferred.map(() => '?').join(',')})
      ORDER BY rating DESC LIMIT 4
    `).all(...preferred.map((p) => p.id));
  } else {
    extra = db.prepare(`
      SELECT * FROM products
      WHERE category IN ('electronics','computers','phones','server') OR subcategory IN ('tv','printers')
      ORDER BY rating DESC LIMIT 4
    `).all();
  }
  const products = preferred.concat(extra).slice(0, 4);
  if (!products.length) return;

  const now = new Date();
  products.forEach((row, i) => {
    const p = rowToProduct(row);
    const months = parseWarrantyMonths(p, null);
    const start = new Date(now);
    start.setMonth(start.getMonth() - (i === 0 ? 10 : i === 1 ? 2 : i * 3));
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    if (i === 0) end.setTime(now.getTime() + 18 * 86400000);
    if (i === 3) end.setTime(now.getTime() - 40 * 86400000);
    const wid = 'war_demo_' + userId.slice(-6) + '_' + p.id;
    db.prepare(`
      INSERT OR IGNORE INTO warranties (
        id, user_id, order_id, product_id, product_name, brand, sku, serial,
        months, start_at, end_at, status, meta_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      wid,
      userId,
      'demo-order-' + (i + 1),
      p.id,
      p.name,
      p.brand || '',
      p.sku || p.id,
      makeSerial(wid),
      months,
      start.toISOString(),
      end.toISOString(),
      JSON.stringify({ seeded: true, email: email || '' }),
      now.toISOString()
    );
  });
}

function listForUser(user) {
  syncUserWarranties(user.id);
  const email = String(user.email || '').toLowerCase();
  if (email === 'demo@nexora.az' || email === 'admin@nexora.az') {
    seedDemoIfEmpty(user.id, email);
  }
  const rows = db.prepare(`
    SELECT * FROM warranties WHERE user_id = ? ORDER BY end_at ASC
  `).all(user.id);
  return rows.map(enrich);
}

function getForUser(userId, warrantyId) {
  const row = db.prepare('SELECT * FROM warranties WHERE id = ? AND user_id = ?')
    .get(warrantyId, userId);
  return row ? enrich(row) : null;
}

/** Minimal PDF 1.4 text document (Latin + transliterated AZ content) */
function escapePdfText(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7EğüşöçıİĞÜŞÖÇƏə]/g, function (ch) {
      // Keep common AZ letters; strip other non-ASCII for Helvetica
      if (/[ğüşöçıİĞÜŞÖÇƏə]/.test(ch)) return ch;
      return '?';
    });
}

function translitAz(s) {
  const map = {
    ə: 'e', Ə: 'E', ı: 'i', İ: 'I', ğ: 'g', Ğ: 'G',
    ö: 'o', Ö: 'O', ü: 'u', Ü: 'U', ş: 'sh', Ş: 'Sh',
    ç: 'ch', Ç: 'Ch'
  };
  return String(s == null ? '' : s).replace(/[əƏıİğĞöÖüÜşŞçÇ]/g, (c) => map[c] || c);
}

function buildWarrantyPdf(w, customer) {
  const lines = [
    'NEXORA — Resmi Zemanet Sertifikati',
    '====================================',
    '',
    'Sertifikat No: ' + w.id,
    'Seriya No:    ' + (w.serial || '—'),
    '',
    'Musteri:  ' + translitAz((customer && customer.name) || '—'),
    'E-poct:   ' + ((customer && customer.email) || '—'),
    'Telefon:  ' + ((customer && customer.phone) || '—'),
    '',
    'Mehsul:   ' + translitAz(w.productName),
    'Brend:    ' + translitAz(w.brand || '—'),
    'SKU:      ' + (w.sku || '—'),
    'Sifaris:  ' + (w.orderId || '—'),
    '',
    'Zemanet muddeti: ' + w.months + ' ay',
    'Baslama:         ' + w.startAt,
    'Bitme:           ' + w.endAt,
    'Qalan gun:       ' + (w.daysLeft < 0 ? 'bitib (' + Math.abs(w.daysLeft) + ' gun evvel)' : w.daysLeft + ' gun'),
    'Status:          ' + w.status,
    '',
    'Bu sened NEXORA demo zemanet merkezinden yaradilib.',
    'Servis ucun: support@nexora.az | +994 12 555 00 00',
    '',
    'Tarix: ' + new Date().toISOString().slice(0, 10)
  ];

  const contentParts = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL'];
  lines.forEach((line, i) => {
    if (i === 0) {
      contentParts.push('/F1 16 Tf', '(' + escapePdfText(translitAz(line)) + ') Tj', 'T*', '/F1 11 Tf');
    } else {
      contentParts.push('(' + escapePdfText(translitAz(line)) + ') Tj', 'T*');
    }
  });
  contentParts.push('ET');
  const stream = contentParts.join('\n');

  const objs = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n');
  objs.push('4 0 obj<< /Length ' + Buffer.byteLength(stream, 'utf8') + ' >>stream\n' + stream + '\nendstream\nendobj\n');
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((o) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += o;
  });
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n0 ' + (objs.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objs.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n' + xrefPos + '\n%%EOF\n';
  return Buffer.from(pdf, 'utf8');
}

module.exports = {
  listForUser,
  getForUser,
  ensureFromOrder,
  syncUserWarranties,
  buildWarrantyPdf,
  parseWarrantyMonths
};
