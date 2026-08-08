'use strict';

const express = require('express');
const {
  getPaymentSettings,
  savePaymentSettings,
  createPayment,
  getPayment,
  updatePayment,
  chargeSandbox,
  createGoldenPaySession,
  markOrderPaid
} = require('../payments');
const {
  validateReferralCode,
  recordCheckoutReferral,
  getReferralSettings,
  consumeCredit
} = require('../referrals');
const { authOptional, authRequired, adminRequired } = require('../middleware/auth');
const { db, rowToProduct } = require('../db');

const router = express.Router();

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calcTotals(items, coupon, referralDiscount, creditUse) {
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  let discount = 0;
  let shipping = subtotal >= 100 ? 0 : 5;
  if (coupon) {
    if (coupon.type === 'percent') discount = subtotal * (Number(coupon.value) / 100);
    if (coupon.type === 'fixed') discount = Number(coupon.value) || 0;
    if (coupon.type === 'shipping') shipping = 0;
  }
  const refDisc = Number(referralDiscount) || 0;
  const settings = getReferralSettings();
  if (refDisc > 0) {
    if (settings.allowStackWithCoupon) discount += refDisc;
    else discount = Math.max(discount, refDisc);
  }
  discount = Math.min(discount, subtotal);
  let credit = Math.min(Number(creditUse) || 0, Math.max(subtotal - discount, 0));
  credit = Math.round(credit * 100) / 100;
  const taxable = Math.max(subtotal - discount - credit, 0);
  const tax = Math.round(taxable * 0.18 * 100) / 100;
  const total = Math.round((taxable + tax + shipping) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    referralDiscount: Math.round(refDisc * 100) / 100,
    credit: credit,
    tax,
    shipping,
    total
  };
}

function publicSettings() {
  const s = getPaymentSettings();
  return {
    enabled: s.enabled !== false,
    mode: s.mode || 'sandbox',
    provider: s.provider || 'sandbox',
    currency: s.currency || 'AZN',
    methods: s.methods || { card: true, cash: true, transfer: true },
    merchantName: s.merchantName || 'NEXORA',
    bank: s.bank || {},
    sandboxHint: s.mode === 'sandbox' ? s.sandboxHint : null,
    liveConfigured: !!(s.gateway && s.gateway.merchantId && s.gateway.authKey)
  };
}

router.get('/config', (_req, res) => {
  res.json({ payment: publicSettings() });
});

router.get('/admin/settings', adminRequired, (_req, res) => {
  res.json({ payment: getPaymentSettings() });
});

router.put('/admin/settings', adminRequired, (req, res) => {
  const cur = getPaymentSettings();
  const body = req.body || {};
  const next = Object.assign({}, cur, body, {
    methods: Object.assign({}, cur.methods, body.methods || {}),
    bank: Object.assign({}, cur.bank, body.bank || {}),
    gateway: Object.assign({}, cur.gateway, body.gateway || {})
  });
  savePaymentSettings(next);
  res.json({ ok: true, payment: getPaymentSettings() });
});

router.get('/admin/by-order/:orderId', adminRequired, (req, res) => {
  const rows = db.prepare('SELECT id FROM payments WHERE order_id = ? ORDER BY created_at DESC').all(req.params.orderId);
  res.json({ payments: rows.map((r) => getPayment(r.id)).filter(Boolean) });
});

/**
 * Create order + payment session in one step (preferred checkout path)
 */
router.post('/checkout', authRequired, async (req, res) => {
  try {
    const settings = getPaymentSettings();
    if (settings.enabled === false) {
      return res.status(503).json({ error: 'Ödəniş müvəqqəti deaktivdir' });
    }

    const body = req.body || {};
    const method = String(body.paymentMethod || 'card');
    if (method === 'card' && settings.methods && settings.methods.card === false) {
      return res.status(400).json({ error: 'Kart ödənişi deaktivdir' });
    }
    if (method === 'cash' && settings.methods && settings.methods.cash === false) {
      return res.status(400).json({ error: 'Nağd ödəniş deaktivdir' });
    }
    if (method === 'transfer' && settings.methods && settings.methods.transfer === false) {
      return res.status(400).json({ error: 'Köçürmə deaktivdir' });
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) return res.status(400).json({ error: 'Səbət boşdur' });

    const items = [];
    for (const line of rawItems) {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(line.productId || line.id);
      if (!row) return res.status(400).json({ error: 'Məhsul tapılmadı: ' + (line.productId || line.id) });
      const product = rowToProduct(row);
      const qty = Math.max(1, parseInt(line.qty, 10) || 1);
      if (!product.inStock || product.stock < qty) {
        return res.status(400).json({ error: product.name + ' stokda yoxdur' });
      }
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty,
        image: product.image,
        variant: line.variant || null
      });
    }

    // Coupons are UI-only for now — never required, never discount, never block checkout
    const coupon = null;

    const customer = {
      name: (body.customer && body.customer.name) || (req.user && req.user.name) || '',
      email: (body.customer && body.customer.email) || (req.user && req.user.email) || '',
      phone: (body.customer && body.customer.phone) || (req.user && req.user.phone) || '',
      address: (body.customer && body.customer.address) || '',
      city: (body.customer && body.customer.city) || 'Bakı',
      district: (body.customer && body.customer.district) || '',
      postalCode: (body.customer && body.customer.postalCode) || ''
    };

    if (!customer.email || !customer.name || !customer.phone) {
      return res.status(400).json({ error: 'Ad, email və telefon tələb olunur' });
    }

    const subtotalPreview = items.reduce((s, i) => s + i.price * i.qty, 0);
    const referralCode = String(body.referralCode || body.friendCode || '').trim();
    let referralDiscount = 0;
    let referralMeta = null;
    // Friend code is optional — invalid/empty codes never block checkout
    if (referralCode) {
      const v = validateReferralCode(referralCode, {
        userId: req.user && req.user.id,
        email: customer.email,
        subtotal: subtotalPreview
      });
      if (v && v.ok && v.kind === 'personal') {
        referralDiscount = Number(v.discount) || 0;
        referralMeta = v;
      }
    }

    let creditWanted = 0;
    const refSettings = getReferralSettings();
    if (refSettings.applyCreditAtCheckout !== false && req.user && body.useReferralCredit) {
      const row = db.prepare('SELECT referral_credit FROM users WHERE id = ?').get(req.user.id);
      creditWanted = Math.min(Number(row && row.referral_credit) || 0, Number(body.useReferralCredit) || 0);
    }

    const totals = calcTotals(items, coupon, referralDiscount, creditWanted);
    if (totals.referralDiscount) totals.referralCode = referralMeta ? referralMeta.code : referralCode;

    const orderId = uid('ord');
    const now = new Date().toISOString();
    const initialStatus = method === 'card' ? 'pending' : (method === 'cash' ? 'pending' : 'pending');

    const tx = db.transaction(() => {
      for (const item of items) {
        const info = db.prepare(`
          UPDATE products SET stock = stock - ?, in_stock = CASE WHEN stock - ? <= 0 THEN 0 ELSE 1 END
          WHERE id = ? AND stock >= ?
        `).run(item.qty, item.qty, item.productId, item.qty);
        if (!info.changes) throw new Error('STOCK:' + item.productId);
        const row = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
        const p = rowToProduct(row);
        p.stock = row.stock;
        p.inStock = !!row.in_stock;
        db.prepare('UPDATE products SET raw_json = ? WHERE id = ?').run(JSON.stringify(p), item.productId);
      }

      if (totals.credit > 0 && req.user) {
        const used = consumeCredit(req.user.id, totals.credit);
        totals.credit = used;
        // recompute total if credit changed
        const taxable = Math.max(totals.subtotal - totals.discount - used, 0);
        totals.tax = Math.round(taxable * 0.18 * 100) / 100;
        totals.total = Math.round((taxable + totals.tax + totals.shipping) * 100) / 100;
      }

      db.prepare(`
        INSERT INTO orders (id, user_id, status, customer_json, items_json, totals_json, coupon_code, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        req.user ? req.user.id : null,
        initialStatus,
        JSON.stringify(customer),
        JSON.stringify(items),
        JSON.stringify(totals),
        coupon ? coupon.code : (referralMeta ? referralMeta.code : null),
        String(body.notes || ''),
        now,
        now
      );

      if (referralMeta) {
        recordCheckoutReferral({
          orderId,
          code: referralMeta.code,
          buyerUserId: req.user ? req.user.id : null,
          buyerEmail: customer.email,
          discountAmount: totals.referralDiscount || referralDiscount
        });
      }
    });

    try {
      tx();
    } catch (e) {
      if (String(e.message).startsWith('STOCK:')) {
        return res.status(400).json({ error: 'Stok kifayət etmir' });
      }
      throw e;
    }

    const payment = createPayment({
      orderId,
      amount: totals.total,
      method: method === 'installment' ? 'card' : method,
      customer,
      meta: {
        installment: method === 'installment',
        referralCode: referralMeta ? referralMeta.code : null
      }
    });

    const baseUrl = String(req.protocol + '://' + req.get('host'));
    let next = {
      orderId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      payUrl: baseUrl + '/pages/payment.html?paymentId=' + encodeURIComponent(payment.id)
    };

    if (method === 'card' || method === 'installment') {
      if (settings.mode === 'live' && settings.provider === 'goldenpay') {
        try {
          const gp = await createGoldenPaySession(payment, settings, baseUrl);
          next = Object.assign(next, gp, { payUrl: gp.redirectUrl });
        } catch (e) {
          if (e.code === 'GATEWAY_NOT_CONFIGURED') {
            return res.status(400).json({ error: e.message, code: e.code });
          }
          throw e;
        }
      }
    }

    if (method === 'transfer') {
      next.bank = settings.bank;
      next.message = 'Köçürmə rekvizitləri ödəniş səhifəsində göstərilir. Ödənişdən sonra admin təsdiqləyəcək.';
    }
    if (method === 'cash') {
      next.message = 'Nağd ödəniş çatdırılma zamanı alınacaq.';
      next.payUrl = null;
    }

    return res.status(201).json({
      ok: true,
      order: { id: orderId, status: initialStatus, totals, customer, items },
      payment: next,
      config: publicSettings()
    });
  } catch (e) {
    console.error('checkout error:', e && e.stack ? e.stack : e);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Server xətası' });
  }
});

router.get('/:id', (req, res) => {
  const payment = getPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Ödəniş tapılmadı' });
  const settings = publicSettings();
  let bank = null;
  if (payment.method === 'transfer') bank = getPaymentSettings().bank;
  res.json({ payment, config: settings, bank });
});

router.post('/:id/charge', async (req, res) => {
  const payment = getPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Ödəniş tapılmadı' });
  if (payment.method !== 'card') {
    return res.status(400).json({ error: 'Bu üsul üçün kart ödənişi deyil' });
  }
  if (payment.status === 'paid') {
    return res.json({ ok: true, payment, alreadyPaid: true });
  }

  const settings = getPaymentSettings();
  try {
    // Even in "live" until real gateway redirect is wired, sandbox charge on hosted page
    // when provider is sandbox OR mode is sandbox.
    if (settings.mode === 'sandbox' || payment.provider === 'sandbox' || !settings.gateway.merchantId) {
      const updated = chargeSandbox(req.params.id, req.body.card || {});
      return res.json({ ok: true, payment: updated });
    }
    return res.status(400).json({
      error: 'Live gateway redirect gözlənilir. Sandbox rejimə keçin və ya bank API-ni tamamlayın.'
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Ödəniş alınmadı' });
  }
});

router.post('/:id/confirm-transfer', adminRequired, (req, res) => {
  const payment = getPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Ödəniş tapılmadı' });
  if (payment.method !== 'transfer') {
    return res.status(400).json({ error: 'Bu ödəniş köçürmə deyil' });
  }
  const updated = updatePayment(req.params.id, {
    status: 'paid',
    providerRef: String(req.body.ref || ('TRF-' + Date.now())),
    meta: Object.assign({}, payment.meta, { confirmedBy: req.user.id, note: req.body.note || '' })
  });
  markOrderPaid(payment.orderId, payment.id);
  res.json({ ok: true, payment: updated });
});

router.post('/webhook/:provider', express.json(), (req, res) => {
  // Placeholder for bank webhooks (GoldenPay etc.)
  const provider = req.params.provider;
  const body = req.body || {};
  const paymentId = body.paymentId || body.merchant_order_id || body.orderId;
  if (!paymentId) return res.status(400).json({ error: 'paymentId yoxdur' });
  const payment = getPayment(paymentId);
  if (!payment) return res.status(404).json({ error: 'tapılmadı' });

  const status = String(body.status || body.payment_status || '').toLowerCase();
  if (status === 'success' || status === 'paid' || status === '1') {
    updatePayment(paymentId, {
      status: 'paid',
      providerRef: String(body.transaction_id || body.rrn || body.ref || provider),
      meta: Object.assign({}, payment.meta, { webhook: body })
    });
    markOrderPaid(payment.orderId, paymentId);
  } else if (status === 'failed' || status === 'cancel' || status === '0') {
    updatePayment(paymentId, { status: 'failed', meta: Object.assign({}, payment.meta, { webhook: body }) });
  }
  res.json({ ok: true });
});

module.exports = router;
