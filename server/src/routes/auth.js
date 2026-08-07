'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db, publicUser } = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const { publicOauthConfig, verifyProvider, upsertOauthUser } = require('../oauth');

const router = express.Router();

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (xf) return xf.slice(0, 64);
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real.slice(0, 64);
  return String((req.socket && req.socket.remoteAddress) || '').slice(0, 64);
}

function touchUserIp(userId, ip) {
  if (!userId || !ip) return;
  try {
    db.prepare(`
      UPDATE users SET last_ip = ?, last_seen_at = ? WHERE id = ?
    `).run(ip, new Date().toISOString(), userId);
  } catch (e) { /* ignore */ }
}

router.get('/oauth/config', (_req, res) => {
  return res.json(publicOauthConfig());
});

router.post('/oauth/:provider', async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  if (!['google', 'apple', 'microsoft'].includes(provider)) {
    return res.status(400).json({ error: 'Provayder dəstəklənmir' });
  }
  try {
    const profile = await verifyProvider(provider, req.body || {});
    const user = upsertOauthUser(profile, clientIp(req));
    const token = signToken(user);
    return res.json({ token, user, provider: provider });
  } catch (e) {
    const status = e && e.status ? e.status : 401;
    return res.status(status).json({ error: (e && e.message) || 'OAuth giriş uğursuz oldu' });
  }
});

router.post('/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Ad, email və şifrə tələb olunur' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Şifrə ən azı 8 simvol olmalıdır' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email düzgün deyil' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    return res.status(409).json({ error: 'Bu email artıq qeydiyyatdan keçib' });
  }

  const id = uid('u');
  const createdAt = new Date().toISOString();
  const ip = clientIp(req);
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, name, phone, role, addresses_json, created_at,
      register_ip, last_ip, last_seen_at
    )
    VALUES (?, ?, ?, ?, ?, 'customer', '[]', ?, ?, ?, ?)
  `).run(id, email, bcrypt.hashSync(password, 10), name, phone, createdAt, ip, ip, createdAt);

  try {
    const { ensureUserCode, attachReferralToUser } = require('../referrals');
    ensureUserCode(id);
    const refCode = String(req.body.referralCode || req.body.ref || '').trim();
    if (refCode) attachReferralToUser(id, refCode);
  } catch (e) { /* ignore */ }

  const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  const token = signToken(user);
  return res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Email və ya şifrə yanlışdır' });
  }

  touchUserIp(row.id, clientIp(req));
  const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(row.id));
  const token = signToken(user);
  return res.json({ token, user });
});

router.get('/me', authRequired, (req, res) => {
  try {
    const { enrichUser, ensureDemoBusiness } = require('../business');
    ensureDemoBusiness();
    return res.json({ user: enrichUser(req.user) });
  } catch (e) {
    return res.json({ user: req.user });
  }
});

router.put('/me', authRequired, (req, res) => {
  const name = String(req.body.name || req.user.name).trim();
  const phone = String(req.body.phone != null ? req.body.phone : req.user.phone).trim();
  const addresses = Array.isArray(req.body.addresses) ? req.body.addresses : req.user.addresses;

  db.prepare(`
    UPDATE users SET name = ?, phone = ?, addresses_json = ? WHERE id = ?
  `).run(name, phone, JSON.stringify(addresses), req.user.id);

  const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
  return res.json({ user });
});

module.exports = router;
