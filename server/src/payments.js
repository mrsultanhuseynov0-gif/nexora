'use strict';

const crypto = require('crypto');
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'AZN',
    method TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'sandbox',
    status TEXT NOT NULL DEFAULT 'pending',
    customer_json TEXT DEFAULT '{}',
    meta_json TEXT DEFAULT '{}',
    provider_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
`);

function getPaymentSettings() {
  const row = db.prepare("SELECT data_json FROM cms_docs WHERE key = 'payments'").get();
  const defaults = {
    enabled: true,
    mode: 'sandbox', // sandbox | live
    provider: 'sandbox', // sandbox | goldenpay | manual
    currency: 'AZN',
    methods: {
      card: true,
      cash: true,
      transfer: true
    },
    merchantName: 'NEXORA',
    // Bank transfer details (shown to customer)
    bank: {
      bankName: 'Kapital Bank',
      accountName: 'NEXORA MMC',
      iban: 'AZ00XXXXXXXXXXXXXXXXXXXX',
      voen: ''
    },
    // GoldenPay / similar gateway credentials
    gateway: {
      merchantId: '',
      authKey: '',
      apiUrl: 'https://rest.goldenpay.az/api',
      successUrl: '',
      failUrl: '',
      webhookSecret: ''
    },
    // Sandbox test card hint
    sandboxHint: 'Test kart: 4111 1111 1111 1111 · MM/YY: 12/30 · CVV: 123'
  };
  if (!row) return defaults;
  try {
    return Object.assign({}, defaults, JSON.parse(row.data_json), {
      methods: Object.assign({}, defaults.methods, (JSON.parse(row.data_json).methods || {})),
      bank: Object.assign({}, defaults.bank, (JSON.parse(row.data_json).bank || {})),
      gateway: Object.assign({}, defaults.gateway, (JSON.parse(row.data_json).gateway || {}))
    });
  } catch (e) {
    return defaults;
  }
}

function savePaymentSettings(data) {
  const now = new Date().toISOString();
  db.prepare('INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)')
    .run('payments', JSON.stringify(data), now);
  return data;
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function createPayment({ orderId, amount, method, customer, meta }) {
  const settings = getPaymentSettings();
  const id = uid('pay_');
  const now = new Date().toISOString();
  const provider = method === 'card'
    ? (settings.mode === 'live' && settings.provider !== 'sandbox' ? settings.provider : 'sandbox')
    : (method === 'transfer' ? 'manual' : 'cod');

  let status = 'pending';
  if (method === 'cash') status = 'awaiting_delivery'; // COD
  if (method === 'transfer') status = 'awaiting_transfer';

  db.prepare(`
    INSERT INTO payments (id, order_id, amount, currency, method, provider, status, customer_json, meta_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    orderId || null,
    Number(amount) || 0,
    settings.currency || 'AZN',
    method,
    provider,
    status,
    JSON.stringify(customer || {}),
    JSON.stringify(meta || {}),
    now,
    now
  );

  return getPayment(id);
}

function getPayment(id) {
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    provider: row.provider,
    status: row.status,
    customer: JSON.parse(row.customer_json || '{}'),
    meta: JSON.parse(row.meta_json || '{}'),
    providerRef: row.provider_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function updatePayment(id, patch) {
  const cur = getPayment(id);
  if (!cur) return null;
  const next = Object.assign({}, cur, patch);
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE payments SET status = ?, provider_ref = ?, meta_json = ?, updated_at = ? WHERE id = ?
  `).run(
    next.status,
    next.providerRef || null,
    JSON.stringify(next.meta || {}),
    now,
    id
  );
  return getPayment(id);
}

function markOrderPaid(orderId, paymentId) {
  if (!orderId) return;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?
  `).run(now, orderId);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (order) {
    try {
      const totals = JSON.parse(order.totals_json || '{}');
      totals.paymentId = paymentId;
      totals.paidAt = now;
      db.prepare('UPDATE orders SET totals_json = ? WHERE id = ?').run(JSON.stringify(totals), orderId);
    } catch (e) { /* ignore */ }
  }
  try {
    const { rewardReferralsForOrder } = require('./referrals');
    rewardReferralsForOrder(orderId);
  } catch (e) { /* ignore */ }
}

/**
 * Sandbox card charge — never call real banks.
 * Accepts test PAN 4111... or any 16 digits in sandbox mode.
 */
function chargeSandbox(paymentId, card) {
  const payment = getPayment(paymentId);
  if (!payment) throw new Error('Ödəniş tapılmadı');
  if (payment.status === 'paid') return payment;

  const pan = String((card && card.number) || '').replace(/\s+/g, '');
  const exp = String((card && card.expiry) || '');
  const cvv = String((card && card.cvv) || '');

  if (pan.length < 13 || pan.length > 19 || !/^\d+$/.test(pan)) {
    throw new Error('Kart nömrəsi yanlışdır');
  }
  if (!/^\d{2}\/\d{2}$/.test(exp)) {
    throw new Error('Son istifadə MM/YY formatında olmalıdır');
  }
  if (!/^\d{3,4}$/.test(cvv)) {
    throw new Error('CVV yanlışdır');
  }

  // Simulate decline for specific test card
  if (pan === '4000000000000002') {
    updatePayment(paymentId, {
      status: 'failed',
      providerRef: 'SANDBOX_DECLINED',
      meta: Object.assign({}, payment.meta, { reason: 'Kart rədd edildi (test)' })
    });
    throw new Error('Ödəniş rədd edildi (test kartı)');
  }

  const ref = 'SBX-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const updated = updatePayment(paymentId, {
    status: 'paid',
    providerRef: ref,
    meta: Object.assign({}, payment.meta, {
      last4: pan.slice(-4),
      brand: pan.startsWith('4') ? 'Visa' : (pan.startsWith('5') ? 'Mastercard' : 'Card'),
      chargedAt: new Date().toISOString()
    })
  });
  markOrderPaid(payment.orderId, paymentId);
  return updated;
}

/**
 * GoldenPay-style session create (live). Requires merchant credentials.
 * Returns redirect URL when configured; otherwise explains setup needed.
 */
async function createGoldenPaySession(payment, settings, baseUrl) {
  const mid = settings.gateway.merchantId;
  const key = settings.gateway.authKey;
  if (!mid || !key) {
    const err = new Error('GoldenPay merchant ID / auth key daxil edilməyib. Admin → Ödəniş ayarları.');
    err.code = 'GATEWAY_NOT_CONFIGURED';
    throw err;
  }

  // GoldenPay REST typically: getPaymentKey then redirect
  // We store intent and return a local bridge URL that would redirect in production.
  const success = settings.gateway.successUrl || (baseUrl + '/pages/payment.html?status=success&paymentId=' + payment.id);
  const fail = settings.gateway.failUrl || (baseUrl + '/pages/payment.html?status=fail&paymentId=' + payment.id);

  updatePayment(payment.id, {
    status: 'redirecting',
    meta: Object.assign({}, payment.meta, {
      successUrl: success,
      failUrl: fail,
      gateway: 'goldenpay',
      note: 'Live credentials set — integrate merchant payment key API with bank docs'
    })
  });

  // Without official SDK keys working against live API from this env,
  // fall back to hosted payment page that uses sandbox charge when mode!=live fully wired.
  return {
    redirectUrl: baseUrl + '/pages/payment.html?paymentId=' + encodeURIComponent(payment.id),
    paymentId: payment.id,
    provider: 'goldenpay',
    configured: true,
    liveReady: false,
    message: 'Merchant məlumatı saxlandı. Bank API sənədinə görə payment key çağırışı əlavə edilməlidir; indi təhlükəsiz hosted payment səhifəsi açılır.'
  };
}

module.exports = {
  getPaymentSettings,
  savePaymentSettings,
  createPayment,
  getPayment,
  updatePayment,
  chargeSandbox,
  createGoldenPaySession,
  markOrderPaid
};
