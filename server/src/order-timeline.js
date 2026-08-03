'use strict';

const { db } = require('./db');

/** Customer-facing timeline steps (mapped from DB status) */
const STEPS = [
  { id: 'accepted', status: 'pending', label: 'Qəbul edildi', labelRu: 'Принят', labelEn: 'Accepted' },
  { id: 'preparing', status: 'paid', label: 'Hazırlanır', labelRu: 'Готовится', labelEn: 'Preparing' },
  { id: 'courier', status: 'shipped', label: 'Kuryerdədir', labelRu: 'У курьера', labelEn: 'Out for delivery' },
  { id: 'delivered', status: 'delivered', label: 'Çatdırıldı', labelRu: 'Доставлен', labelEn: 'Delivered' }
];

const FLOW = ['pending', 'paid', 'shipped', 'delivered'];

/** Demo live progression delays from order creation */
const AUTO_MS = [
  { status: 'pending', afterMs: 0 },
  { status: 'paid', afterMs: 45 * 1000 },
  { status: 'shipped', afterMs: 2.5 * 60 * 1000 },
  { status: 'delivered', afterMs: 5 * 60 * 1000 }
];

function statusIndex(status) {
  const i = FLOW.indexOf(status);
  return i >= 0 ? i : -1;
}

function expectedStatus(createdAt, current) {
  if (current === 'cancelled') return 'cancelled';
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return current || 'pending';
  const age = Date.now() - start;
  let next = 'pending';
  for (let i = 0; i < AUTO_MS.length; i++) {
    if (age >= AUTO_MS[i].afterMs) next = AUTO_MS[i].status;
  }
  // Never move backwards if admin set a later status manually
  const curIdx = statusIndex(current);
  const nextIdx = statusIndex(next);
  if (curIdx > nextIdx) return current;
  return next;
}

function maybeAutoAdvance(row) {
  if (!row || row.status === 'cancelled') return row;
  const next = expectedStatus(row.created_at, row.status);
  if (next !== row.status && FLOW.includes(next)) {
    const now = new Date().toISOString();
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .run(next, now, row.id);
    row.status = next;
    row.updated_at = now;
  }
  return row;
}

function stepTimestamps(createdAt, status) {
  const start = new Date(createdAt).getTime();
  const idx = statusIndex(status);
  return STEPS.map((step, i) => {
    const atMs = start + AUTO_MS[i].afterMs;
    const done = idx >= i;
    const current = idx === i;
    return {
      id: step.id,
      status: step.status,
      label: step.label,
      labelRu: step.labelRu,
      labelEn: step.labelEn,
      done: done,
      current: current && status !== 'cancelled',
      at: done || current ? new Date(Math.min(atMs, Date.now())).toISOString() : null
    };
  });
}

function buildTimeline(row) {
  const order = maybeAutoAdvance(row);
  const status = order.status;
  const steps = status === 'cancelled'
    ? STEPS.map((s, i) => ({
        id: s.id,
        status: s.status,
        label: s.label,
        labelRu: s.labelRu,
        labelEn: s.labelEn,
        done: false,
        current: false,
        at: null
      }))
    : stepTimestamps(order.created_at, status);

  const idx = statusIndex(status);
  const currentStep = status === 'cancelled'
    ? { id: 'cancelled', label: 'Ləğv edilib' }
    : STEPS[Math.max(0, idx)] || STEPS[0];

  return {
    orderId: order.id,
    status: status,
    currentStep: currentStep,
    live: status !== 'cancelled' && status !== 'delivered',
    progress: status === 'cancelled' ? 0 : Math.round(((idx + 1) / STEPS.length) * 100),
    steps: steps,
    updatedAt: order.updated_at,
    createdAt: order.created_at
  };
}

function serializeOrder(row, withTimeline) {
  const o = maybeAutoAdvance(row);
  const totals = JSON.parse(o.totals_json || '{}');
  const base = {
    id: o.id,
    userId: o.user_id,
    status: o.status,
    customer: JSON.parse(o.customer_json || '{}'),
    items: JSON.parse(o.items_json || '[]'),
    totals: totals,
    total: totals.total != null ? totals.total : 0,
    couponCode: o.coupon_code,
    createdAt: o.created_at,
    updatedAt: o.updated_at
  };
  if (withTimeline) base.timeline = buildTimeline(o);
  return base;
}

function getOrderRow(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

module.exports = {
  STEPS,
  FLOW,
  buildTimeline,
  serializeOrder,
  maybeAutoAdvance,
  getOrderRow,
  expectedStatus
};
