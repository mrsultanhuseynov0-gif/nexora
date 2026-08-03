'use strict';

const crypto = require('crypto');
const { db } = require('./db');

function migrate() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('referral_code')) {
    db.exec('ALTER TABLE users ADD COLUMN referral_code TEXT');
  }
  if (!cols.includes('referred_by')) {
    db.exec('ALTER TABLE users ADD COLUMN referred_by TEXT');
  }
  if (!cols.includes('referral_credit')) {
    db.exec('ALTER TABLE users ADD COLUMN referral_credit REAL NOT NULL DEFAULT 0');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS referral_events (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referee_user_id TEXT,
      referee_email TEXT,
      order_id TEXT,
      code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      discount_amount REAL NOT NULL DEFAULT 0,
      reward_amount REAL NOT NULL DEFAULT 0,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      rewarded_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ref_events_referrer ON referral_events(referrer_id);
    CREATE INDEX IF NOT EXISTS idx_ref_events_order ON referral_events(order_id);
  `);
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)');
  } catch (e) { /* duplicates or partial unsupported */ }
}

migrate();

function defaultSettings() {
  return {
    enabled: true,
    friendDiscountPercent: 10,
    friendDiscountFixed: 0,
    minOrder: 30,
    referrerRewardAz: 5,
    maxFriendDiscount: 100,
    codePrefix: 'DOST',
    allowStackWithCoupon: false,
    applyCreditAtCheckout: true
  };
}

function getReferralSettings() {
  const row = db.prepare("SELECT data_json FROM cms_docs WHERE key = 'referrals'").get();
  const defaults = defaultSettings();
  if (!row) return defaults;
  try {
    return Object.assign({}, defaults, JSON.parse(row.data_json));
  } catch (e) {
    return defaults;
  }
}

function saveReferralSettings(data) {
  const now = new Date().toISOString();
  const next = Object.assign({}, defaultSettings(), data || {});
  db.prepare('INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)')
    .run('referrals', JSON.stringify(next), now);
  return getReferralSettings();
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function makeCode(prefix, seed) {
  const base = String(seed || crypto.randomBytes(4).toString('hex'))
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  const suffix = (base + crypto.randomBytes(2).toString('hex').toUpperCase()).slice(0, 6);
  return (prefix || 'DOST') + suffix;
}

function ensureUserCode(userId) {
  const row = db.prepare('SELECT id, name, email, referral_code FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  if (row.referral_code) return row.referral_code;
  const settings = getReferralSettings();
  let code = makeCode(settings.codePrefix, row.name || row.email);
  let tries = 0;
  while (db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code) && tries < 8) {
    code = makeCode(settings.codePrefix);
    tries += 1;
  }
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, userId);
  return code;
}

function ensureAllUserCodes() {
  const rows = db.prepare('SELECT id FROM users WHERE referral_code IS NULL OR referral_code = \'\'').all();
  rows.forEach((r) => ensureUserCode(r.id));
}

function findByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  return db.prepare('SELECT * FROM users WHERE referral_code = ? COLLATE NOCASE').get(c) || null;
}

function publicConfig() {
  const s = getReferralSettings();
  return {
    enabled: s.enabled !== false,
    friendDiscountPercent: Number(s.friendDiscountPercent) || 0,
    friendDiscountFixed: Number(s.friendDiscountFixed) || 0,
    minOrder: Number(s.minOrder) || 0,
    referrerRewardAz: Number(s.referrerRewardAz) || 0,
    maxFriendDiscount: Number(s.maxFriendDiscount) || 0,
    allowStackWithCoupon: !!s.allowStackWithCoupon,
    applyCreditAtCheckout: s.applyCreditAtCheckout !== false
  };
}

/**
 * Validate a friend code for a buyer. Returns discount preview + referrer info.
 */
function validateReferralCode(code, opts) {
  const settings = getReferralSettings();
  if (settings.enabled === false) {
    return { ok: false, error: 'Referral proqramı deaktivdir' };
  }
  const referrer = findByCode(code);
  if (!referrer) {
    // Fallback: treat known marketing coupons as ok but not personal referral
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(String(code || '').trim().toUpperCase());
    if (coupon && /^(REF|DOST)/i.test(coupon.code)) {
      return {
        ok: true,
        kind: 'coupon',
        code: coupon.code,
        coupon: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minOrder: coupon.min_order,
          description: coupon.description
        },
        message: coupon.description || 'Dost kuponu'
      };
    }
    return { ok: false, error: 'Dost kodu tapılmadı' };
  }

  const buyerId = opts && opts.userId;
  const buyerEmail = String((opts && opts.email) || '').trim().toLowerCase();
  if (buyerId && referrer.id === buyerId) {
    return { ok: false, error: 'Öz dost kodunuzu istifadə edə bilməzsiniz' };
  }
  if (buyerEmail && String(referrer.email || '').toLowerCase() === buyerEmail) {
    return { ok: false, error: 'Öz dost kodunuzu istifadə edə bilməzsiniz' };
  }

  const subtotal = Number((opts && opts.subtotal) || 0);
  if (subtotal > 0 && subtotal < Number(settings.minOrder || 0)) {
    return {
      ok: false,
      error: 'Minimum sifariş ' + settings.minOrder + ' ₼ olmalıdır'
    };
  }

  let discount = 0;
  if (settings.friendDiscountPercent > 0) {
    discount = subtotal * (Number(settings.friendDiscountPercent) / 100);
  }
  if (settings.friendDiscountFixed > 0) {
    discount += Number(settings.friendDiscountFixed);
  }
  if (settings.maxFriendDiscount > 0) {
    discount = Math.min(discount, Number(settings.maxFriendDiscount));
  }
  discount = Math.round(Math.min(discount, subtotal) * 100) / 100;

  return {
    ok: true,
    kind: 'personal',
    code: referrer.referral_code,
    referrerId: referrer.id,
    referrerName: referrer.name,
    discount,
    percent: Number(settings.friendDiscountPercent) || 0,
    rewardPreview: Number(settings.referrerRewardAz) || 0,
    message: referrer.name + ' dost kodu · ' + (settings.friendDiscountPercent || 0) + '% endirim'
  };
}

function attachReferralToUser(userId, code) {
  const settings = getReferralSettings();
  if (settings.enabled === false) return { ok: false, error: 'Deaktiv' };
  const referrer = findByCode(code);
  if (!referrer) return { ok: false, error: 'Dost kodu tapılmadı' };
  if (referrer.id === userId) return { ok: false, error: 'Öz kodunuz' };

  const user = db.prepare('SELECT id, referred_by FROM users WHERE id = ?').get(userId);
  if (!user) return { ok: false, error: 'İstifadəçi yoxdur' };
  if (user.referred_by) return { ok: true, already: true, referredBy: user.referred_by };

  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, userId);
  return { ok: true, referredBy: referrer.id, code: referrer.referral_code };
}

function recordCheckoutReferral({ orderId, code, buyerUserId, buyerEmail, discountAmount }) {
  const v = validateReferralCode(code, {
    userId: buyerUserId,
    email: buyerEmail,
    subtotal: 999999
  });
  if (!v.ok || v.kind !== 'personal') return null;

  const id = uid('ref_');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO referral_events
      (id, referrer_id, referee_user_id, referee_email, order_id, code, status, discount_amount, reward_amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(
    id,
    v.referrerId,
    buyerUserId || null,
    buyerEmail || null,
    orderId,
    v.code,
    Number(discountAmount) || 0,
    Number(getReferralSettings().referrerRewardAz) || 0,
    now
  );
  return id;
}

function rewardReferralsForOrder(orderId) {
  const settings = getReferralSettings();
  const rows = db.prepare(`
    SELECT * FROM referral_events WHERE order_id = ? AND status = 'pending'
  `).all(orderId);
  const now = new Date().toISOString();
  const rewarded = [];
  rows.forEach((row) => {
    const amount = Number(row.reward_amount) || Number(settings.referrerRewardAz) || 0;
    if (amount > 0) {
      db.prepare('UPDATE users SET referral_credit = COALESCE(referral_credit, 0) + ? WHERE id = ?')
        .run(amount, row.referrer_id);
    }
    db.prepare(`
      UPDATE referral_events SET status = 'rewarded', reward_amount = ?, rewarded_at = ? WHERE id = ?
    `).run(amount, now, row.id);
    rewarded.push({ id: row.id, referrerId: row.referrer_id, amount });
  });
  return rewarded;
}

function getMine(userId) {
  ensureUserCode(userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const events = db.prepare(`
    SELECT * FROM referral_events WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(userId);
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'rewarded' THEN 1 ELSE 0 END) AS rewarded,
      SUM(CASE WHEN status = 'rewarded' THEN reward_amount ELSE 0 END) AS earned
    FROM referral_events WHERE referrer_id = ?
  `).get(userId);
  return {
    code: user.referral_code,
    credit: Number(user.referral_credit) || 0,
    referredBy: user.referred_by || null,
    stats: {
      total: stats.total || 0,
      rewarded: stats.rewarded || 0,
      earned: Math.round((stats.earned || 0) * 100) / 100
    },
    events: events.map((e) => ({
      id: e.id,
      orderId: e.order_id,
      code: e.code,
      status: e.status,
      discountAmount: e.discount_amount,
      rewardAmount: e.reward_amount,
      refereeEmail: e.referee_email,
      createdAt: e.created_at,
      rewardedAt: e.rewarded_at
    })),
    config: publicConfig()
  };
}

function consumeCredit(userId, amount) {
  const user = db.prepare('SELECT referral_credit FROM users WHERE id = ?').get(userId);
  if (!user) return 0;
  const available = Number(user.referral_credit) || 0;
  const use = Math.min(available, Math.max(0, Number(amount) || 0));
  if (use <= 0) return 0;
  db.prepare('UPDATE users SET referral_credit = referral_credit - ? WHERE id = ?').run(use, userId);
  return Math.round(use * 100) / 100;
}

function listAdmin(limit) {
  ensureAllUserCodes();
  const events = db.prepare(`
    SELECT e.*, u.email AS referrer_email, u.name AS referrer_name
    FROM referral_events e
    LEFT JOIN users u ON u.id = e.referrer_id
    ORDER BY e.created_at DESC
    LIMIT ?
  `).all(limit || 100);
  const top = db.prepare(`
    SELECT u.id, u.name, u.email, u.referral_code, u.referral_credit,
      (SELECT COUNT(*) FROM referral_events r WHERE r.referrer_id = u.id AND r.status = 'rewarded') AS wins
    FROM users u
    WHERE u.referral_code IS NOT NULL
    ORDER BY wins DESC, u.referral_credit DESC
    LIMIT 20
  `).all();
  return { events, top, settings: getReferralSettings() };
}

module.exports = {
  getReferralSettings,
  saveReferralSettings,
  publicConfig,
  ensureUserCode,
  ensureAllUserCodes,
  validateReferralCode,
  attachReferralToUser,
  recordCheckoutReferral,
  rewardReferralsForOrder,
  getMine,
  consumeCredit,
  findByCode,
  listAdmin
};
