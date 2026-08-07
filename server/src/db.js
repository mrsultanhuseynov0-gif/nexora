'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(dataDir, 'nexora.db');

const dbParent = path.dirname(dbPath);
if (!fs.existsSync(dbParent)) fs.mkdirSync(dbParent, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
    addresses_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    brand TEXT,
    brand_id TEXT,
    category TEXT,
    subcategory TEXT,
    price REAL NOT NULL DEFAULT 0,
    old_price REAL,
    currency TEXT DEFAULT '₼',
    rating REAL DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    badge TEXT,
    badge_type TEXT,
    in_stock INTEGER NOT NULL DEFAULT 1,
    stock INTEGER NOT NULL DEFAULT 0,
    is_new INTEGER NOT NULL DEFAULT 0,
    tags_json TEXT DEFAULT '[]',
    description TEXT DEFAULT '',
    specs_json TEXT DEFAULT '{}',
    images_json TEXT DEFAULT '[]',
    gradient TEXT,
    image TEXT,
    review_list_json TEXT DEFAULT '[]',
    raw_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY COLLATE NOCASE,
    type TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    min_order REAL NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    customer_json TEXT NOT NULL,
    items_json TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    coupon_code TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_threads (
    id TEXT PRIMARY KEY,
    visitor_key TEXT NOT NULL,
    user_id TEXT DEFAULT '',
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    topic TEXT DEFAULT '',
    approved INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    unread_admin INTEGER NOT NULL DEFAULT 0,
    unread_visitor INTEGER NOT NULL DEFAULT 0,
    last_message TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_chat_threads_updated ON chat_threads(updated_at);
  CREATE INDEX IF NOT EXISTS idx_chat_threads_visitor ON chat_threads(visitor_key);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK(sender IN ('visitor','admin','system')),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(thread_id) REFERENCES chat_threads(id)
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
`);

(function ensureChatThreadColumns() {
  const cols = db.prepare('PRAGMA table_info(chat_threads)').all().map((c) => c.name);
  if (!cols.includes('user_id')) db.exec("ALTER TABLE chat_threads ADD COLUMN user_id TEXT DEFAULT ''");
  if (!cols.includes('topic')) db.exec("ALTER TABLE chat_threads ADD COLUMN topic TEXT DEFAULT ''");
  if (!cols.includes('approved')) db.exec('ALTER TABLE chat_threads ADD COLUMN approved INTEGER NOT NULL DEFAULT 0');
})();

function rowToProduct(row) {
  if (!row) return null;
  if (row.raw_json) {
    try { return JSON.parse(row.raw_json); } catch (e) { /* fall through */ }
  }
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    brandId: row.brand_id,
    category: row.category,
    subcategory: row.subcategory,
    price: row.price,
    oldPrice: row.old_price,
    currency: row.currency,
    rating: row.rating,
    reviews: row.reviews,
    badge: row.badge,
    badgeType: row.badge_type,
    inStock: !!row.in_stock,
    stock: row.stock,
    isNew: !!row.is_new,
    tags: JSON.parse(row.tags_json || '[]'),
    description: row.description,
    specs: JSON.parse(row.specs_json || '{}'),
    images: JSON.parse(row.images_json || '[]'),
    gradient: row.gradient,
    image: row.image,
    reviewList: JSON.parse(row.review_list_json || '[]')
  };
}

function productToRow(p) {
  return {
    id: p.id,
    sku: p.sku || '',
    name: p.name,
    brand: p.brand || '',
    brand_id: p.brandId || '',
    category: p.category || '',
    subcategory: p.subcategory || '',
    price: Number(p.price) || 0,
    old_price: p.oldPrice == null ? null : Number(p.oldPrice),
    currency: p.currency || '₼',
    rating: Number(p.rating) || 0,
    reviews: Number(p.reviews) || 0,
    badge: p.badge || '',
    badge_type: p.badgeType || '',
    in_stock: p.inStock === false ? 0 : 1,
    stock: Number(p.stock) || 0,
    is_new: p.isNew ? 1 : 0,
    tags_json: JSON.stringify(p.tags || []),
    description: p.description || '',
    specs_json: JSON.stringify(p.specs || {}),
    images_json: JSON.stringify(p.images || []),
    gradient: p.gradient || '',
    image: p.image || '',
    review_list_json: JSON.stringify(p.reviewList || []),
    raw_json: JSON.stringify(p)
  };
}

function publicUser(row) {
  if (!row) return null;
  let referralCode = row.referral_code || null;
  try {
    if (!referralCode && row.id) {
      const { ensureUserCode } = require('./referrals');
      referralCode = ensureUserCode(row.id);
    }
  } catch (e) { /* referrals module may not be ready during early boot */ }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || '',
    role: row.role,
    addresses: JSON.parse(row.addresses_json || '[]'),
    referralCode: referralCode,
    referredBy: row.referred_by || null,
    referralCredit: Number(row.referral_credit) || 0,
    createdAt: row.created_at
  };
}

module.exports = {
  db,
  dbPath,
  rowToProduct,
  productToRow,
  publicUser
};
