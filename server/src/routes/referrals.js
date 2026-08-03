'use strict';

const express = require('express');
const {
  publicConfig,
  getReferralSettings,
  saveReferralSettings,
  validateReferralCode,
  getMine,
  ensureUserCode,
  listAdmin,
  attachReferralToUser
} = require('../referrals');
const { authRequired, adminRequired, authOptional } = require('../middleware/auth');

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({ referral: publicConfig() });
});

router.post('/validate', authOptional, (req, res) => {
  const body = req.body || {};
  const result = validateReferralCode(body.code, {
    userId: req.user && req.user.id,
    email: body.email || (req.user && req.user.email),
    subtotal: Number(body.subtotal) || 0
  });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.get('/mine', authRequired, (req, res) => {
  ensureUserCode(req.user.id);
  res.json({ referral: getMine(req.user.id) });
});

router.post('/attach', authRequired, (req, res) => {
  const result = attachReferralToUser(req.user.id, req.body && req.body.code);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.get('/admin/settings', adminRequired, (_req, res) => {
  res.json({ referral: getReferralSettings() });
});

router.put('/admin/settings', adminRequired, (req, res) => {
  const body = req.body || {};
  const cur = getReferralSettings();
  const next = Object.assign({}, cur, body);
  ['friendDiscountPercent', 'friendDiscountFixed', 'minOrder', 'referrerRewardAz', 'maxFriendDiscount'].forEach((k) => {
    if (body[k] != null) next[k] = Number(body[k]);
  });
  if (body.enabled != null) next.enabled = !!body.enabled;
  if (body.allowStackWithCoupon != null) next.allowStackWithCoupon = !!body.allowStackWithCoupon;
  if (body.applyCreditAtCheckout != null) next.applyCreditAtCheckout = !!body.applyCreditAtCheckout;
  if (body.codePrefix) next.codePrefix = String(body.codePrefix).trim().toUpperCase().slice(0, 8);
  res.json({ ok: true, referral: saveReferralSettings(next) });
});

router.get('/admin/list', adminRequired, (req, res) => {
  res.json(listAdmin(Number(req.query.limit) || 100));
});

module.exports = router;
