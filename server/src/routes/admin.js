'use strict';

const express = require('express');
const { db, publicUser } = require('../db');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/users', adminRequired, (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows.map(publicUser) });
});

router.patch('/users/:id/role', adminRequired, (req, res) => {
  const role = String(req.body.role || '');
  if (role !== 'admin' && role !== 'customer') {
    return res.status(400).json({ error: 'Rol yanlışdır' });
  }
  if (req.params.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'Öz admin rolunuzu silə bilməzsiniz' });
  }
  const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
  return res.json({ ok: true });
});

router.delete('/users/:id', adminRequired, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Öz hesabınızı silə bilməzsiniz' });
  }
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
  return res.json({ ok: true });
});

router.post('/coupons', adminRequired, (req, res) => {
  const c = req.body || {};
  const code = String(c.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Kod tələb olunur' });
  db.prepare(`
    INSERT OR REPLACE INTO coupons (code, type, value, min_order, description, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(code, c.type || 'percent', Number(c.value) || 0, Number(c.minOrder) || 0, c.description || '', c.active === false ? 0 : 1);
  return res.status(201).json({ ok: true, code });
});

router.delete('/coupons/:code', adminRequired, (req, res) => {
  const info = db.prepare('DELETE FROM coupons WHERE code = ?').run(String(req.params.code).toUpperCase());
  if (!info.changes) return res.status(404).json({ error: 'Kupon tapılmadı' });
  return res.json({ ok: true });
});

module.exports = router;
