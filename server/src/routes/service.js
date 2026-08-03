'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const svc = require('../service-history');

const router = express.Router();

router.get('/history', authRequired, (req, res) => {
  try {
    return res.json(svc.getHistory(req.user));
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/tickets', authRequired, (req, res) => {
  try {
    return res.json({ tickets: svc.listTickets(req.user.id) });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/tickets', authRequired, (req, res) => {
  try {
    const ticket = svc.createTicket(req.user.id, req.body || {});
    return res.status(201).json({ ticket });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/tickets/:id', authRequired, (req, res) => {
  try {
    const ticket = svc.getTicket(req.user.id, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Müraciət tapılmadı' });
    return res.json({ ticket });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.patch('/tickets/:id/status', authRequired, (req, res) => {
  try {
    const status = String((req.body && req.body.status) || '');
    // Users may cancel; other transitions allowed for demo convenience
    const ticket = svc.setTicketStatus(
      req.user.id,
      req.params.id,
      status,
      (req.body && req.body.note) || ''
    );
    return res.json({ ticket });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

module.exports = router;
