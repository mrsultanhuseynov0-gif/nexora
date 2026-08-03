'use strict';

const express = require('express');
const { db, rowToProduct } = require('../db');
const { authRequired, adminRequired, authOptional } = require('../middleware/auth');
const {
  buildTimeline,
  serializeOrder,
  getOrderRow
} = require('../order-timeline');

const router = express.Router();

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calcTotals(items, coupon) {
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  let discount = 0;
  let shipping = subtotal >= 100 ? 0 : 5;
  if (coupon) {
    if (coupon.type === 'percent') discount = subtotal * (Number(coupon.value) / 100);
    if (coupon.type === 'fixed') discount = Number(coupon.value) || 0;
    if (coupon.type === 'shipping') shipping = 0;
  }
  discount = Math.min(discount, subtotal);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round(taxable * 0.18 * 100) / 100;
  const total = Math.round((taxable + tax + shipping) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    tax,
    shipping,
    total
  };
}

router.post('/', authRequired, (req, res) => {
  const body = req.body || {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) {
    return res.status(400).json({ error: 'Səbət boşdur' });
  }

  const items = [];
  for (const line of rawItems) {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(line.productId || line.id);
    if (!row) {
      return res.status(400).json({ error: 'Məhsul tapılmadı: ' + (line.productId || line.id) });
    }
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

  let coupon = null;
  const code = String(body.couponCode || body.coupon || '').trim().toUpperCase();
  if (code) {
    coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code);
    if (!coupon) return res.status(400).json({ error: 'Kupon etibarsızdır' });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    if (subtotal < Number(coupon.min_order || 0)) {
      return res.status(400).json({ error: 'Kupon üçün minimum sifariş məbləği çatmır' });
    }
  }

  const totals = calcTotals(items, coupon);
  const customer = {
    name: body.customer && body.customer.name ? body.customer.name : req.user.name,
    email: body.customer && body.customer.email ? body.customer.email : req.user.email,
    phone: body.customer && body.customer.phone ? body.customer.phone : req.user.phone,
    address: (body.customer && body.customer.address) || body.address || '',
    city: (body.customer && body.customer.city) || body.city || 'Bakı',
    paymentMethod: body.paymentMethod || 'card'
  };

  const id = uid('ord');
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    for (const item of items) {
      const info = db.prepare(`
        UPDATE products SET stock = stock - ?, in_stock = CASE WHEN stock - ? <= 0 THEN 0 ELSE 1 END
        WHERE id = ? AND stock >= ?
      `).run(item.qty, item.qty, item.productId, item.qty);
      if (!info.changes) throw new Error('STOCK:' + item.productId);
      // refresh raw_json stock mirror
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
      const p = rowToProduct(row);
      p.stock = row.stock;
      p.inStock = !!row.in_stock;
      db.prepare('UPDATE products SET raw_json = ? WHERE id = ?').run(JSON.stringify(p), item.productId);
    }

    db.prepare(`
      INSERT INTO orders (id, user_id, status, customer_json, items_json, totals_json, coupon_code, notes, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      JSON.stringify(customer),
      JSON.stringify(items),
      JSON.stringify(totals),
      coupon ? coupon.code : null,
      String(body.notes || ''),
      now,
      now
    );
  });

  try {
    tx();
  } catch (e) {
    if (String(e.message).startsWith('STOCK:')) {
      return res.status(400).json({ error: 'Stok kifayət etmir' });
    }
    throw e;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  try {
    const { ensureFromOrder } = require('../warranties');
    ensureFromOrder(order, req.user.id);
  } catch (e) { /* non-fatal */ }

  return res.status(201).json({
    order: serializeOrder(order, true)
  });
});

router.get('/mine', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  return res.json({
    orders: rows.map((o) => serializeOrder(o, true))
  });
});

/** Public track by order id + email */
router.get('/track', (req, res) => {
  const id = String(req.query.id || '').trim();
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!id || !email) {
    return res.status(400).json({ error: 'Sifariş nömrəsi və e-poçt tələb olunur' });
  }
  const row = getOrderRow(id);
  if (!row) return res.status(404).json({ error: 'Sifariş tapılmadı' });
  const customer = JSON.parse(row.customer_json || '{}');
  const mail = String(customer.email || '').toLowerCase();
  if (mail !== email) {
    return res.status(404).json({ error: 'Sifariş tapılmadı' });
  }
  return res.json({ order: serializeOrder(row, true) });
});

router.get('/:id/timeline', authOptional, (req, res) => {
  const row = getOrderRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Sifariş tapılmadı' });
  const customer = JSON.parse(row.customer_json || '{}');
  const email = String(req.query.email || '').trim().toLowerCase();
  const owns =
    (req.user && req.user.id === row.user_id) ||
    (req.user && req.user.role === 'admin') ||
    (email && email === String(customer.email || '').toLowerCase());
  if (!owns) return res.status(403).json({ error: 'İcazə yoxdur' });
  return res.json({
    order: serializeOrder(row, true),
    timeline: buildTimeline(row)
  });
});

router.get('/', adminRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all();
  return res.json({
    orders: rows.map((o) => serializeOrder(o, true))
  });
});

router.patch('/:id/status', adminRequired, (req, res) => {
  const status = String(req.body.status || '').trim();
  const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Status yanlışdır' });
  }
  const info = db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Sifariş tapılmadı' });
  const fresh = getOrderRow(req.params.id);
  return res.json({
    ok: true,
    id: req.params.id,
    status: fresh.status,
    order: serializeOrder(fresh, true)
  });
});

module.exports = router;
