'use strict';

const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const {
  listForUser,
  getForUser,
  buildWarrantyPdf
} = require('../warranties');

const router = express.Router();

router.get('/mine', authRequired, (req, res) => {
  const items = listForUser(req.user);
  const summary = {
    total: items.length,
    active: items.filter((w) => w.status === 'active').length,
    expiring: items.filter((w) => w.status === 'expiring').length,
    expired: items.filter((w) => w.status === 'expired').length
  };
  return res.json({ warranties: items, summary });
});

router.get('/:id', authRequired, (req, res) => {
  const w = getForUser(req.user.id, req.params.id);
  if (!w) return res.status(404).json({ error: 'Zəmanət tapılmadı' });
  return res.json({ warranty: w });
});

router.get('/:id/pdf', authRequired, (req, res) => {
  const w = getForUser(req.user.id, req.params.id);
  if (!w) return res.status(404).json({ error: 'Zəmanət tapılmadı' });

  const user = db.prepare('SELECT name, email, phone FROM users WHERE id = ?').get(req.user.id) || {};
  const pdf = buildWarrantyPdf(w, {
    name: user.name || req.user.name,
    email: user.email || req.user.email,
    phone: user.phone || req.user.phone
  });

  const filename = 'nexora-warranty-' + w.id.replace(/[^\w.-]+/g, '_') + '.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
});

module.exports = router;
