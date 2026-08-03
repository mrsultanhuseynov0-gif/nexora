'use strict';

const express = require('express');
const { db, publicUser } = require('../db');
const { authRequired, adminRequired, authOptional } = require('../middleware/auth');
const biz = require('../business');

const router = express.Router();

function sendPdf(res, buf, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('X-Nexora-Doc', filename);
  res.setHeader('X-Nexora-Doc-Type', 'pdf');
  res.setHeader('Content-Length', buf.length);
  return res.send(buf);
}

function sendDownload(res, file) {
  res.setHeader('Content-Type', file.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="' + file.filename + '"');
  res.setHeader('X-Nexora-Doc', file.filename);
  res.setHeader('Content-Length', file.buf.length);
  return res.send(file.buf);
}

function loadParty(userId) {
  const profile = biz.getProfile(userId);
  const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
  return { profile, user };
}

/* ---------- Admin (must be before :id routes) ---------- */

router.get('/admin/overview', adminRequired, (_req, res) => {
  try {
    biz.ensureDemoBusiness();
    return res.json(biz.adminOverview());
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/admin/companies', adminRequired, (_req, res) => {
  try {
    return res.json({ companies: biz.adminListCompanies() });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/admin/quotes', adminRequired, (_req, res) => {
  try {
    return res.json({ quotes: biz.adminListQuotes() });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/admin/contracts', adminRequired, (_req, res) => {
  try {
    return res.json({ contracts: biz.adminListContracts() });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/admin/orders', adminRequired, (_req, res) => {
  try {
    return res.json({ orders: biz.adminListB2bOrders() });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

router.patch('/admin/quotes/:id/status', adminRequired, (req, res) => {
  try {
    const quote = biz.adminSetQuoteStatus(req.params.id, String((req.body && req.body.status) || ''));
    return res.json({ quote });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.patch('/admin/contracts/:id/status', adminRequired, (req, res) => {
  try {
    const contract = biz.adminSetContractStatus(req.params.id, String((req.body && req.body.status) || ''));
    return res.json({ contract });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/admin/quotes/:id/pdf', adminRequired, (req, res) => {
  try {
    const quote = biz.adminGetQuote(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Təklif tapılmadı' });
    const { profile, user } = loadParty(quote.userId);
    if (!profile) return res.status(404).json({ error: 'Şirkət profili tapılmadı' });
    const pdf = biz.buildQuotePdf(quote, profile, user || { email: quote.userEmail, name: quote.userName });
    const company = String(profile.companyName || 'sirket').replace(/[^\w\-]+/g, '_').slice(0, 24);
    return sendPdf(res, pdf, 'NEXORA_Teklif_' + company + '_' + quote.id + '.pdf');
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/admin/contracts/:id/pdf', adminRequired, (req, res) => {
  try {
    const contract = biz.adminGetContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Müqavilə tapılmadı' });
    const { profile, user } = loadParty(contract.userId);
    if (!profile) return res.status(404).json({ error: 'Şirkət profili tapılmadı' });
    const pdf = biz.buildContractPdf(contract, profile, user || { email: contract.userEmail, name: contract.userName });
    const company = String(profile.companyName || 'sirket').replace(/[^\w\-]+/g, '_').slice(0, 24);
    return sendPdf(res, pdf, 'NEXORA_Muqavile_' + company + '_' + contract.id + '.pdf');
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/admin/export/:kind', adminRequired, (req, res) => {
  try {
    const format = String(req.query.format || 'xls').toLowerCase();
    const file = format === 'csv'
      ? biz.adminExportCsv(req.params.kind)
      : biz.adminExportExcel(req.params.kind);
    return sendDownload(res, file);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

/* ---------- Business user ---------- */

router.get('/me', authRequired, (req, res) => {
  biz.ensureDemoBusiness();
  const profile = biz.getProfile(req.user.id);
  return res.json({
    user: biz.enrichUser(req.user),
    profile,
    settings: {
      discountPercent: biz.B2B_DISCOUNT_PERCENT,
      minTotal: biz.B2B_MIN_TOTAL
    }
  });
});

router.post('/register', authRequired, (req, res) => {
  try {
    const profile = biz.upsertProfile(req.user.id, req.body || {});
    return res.status(201).json({ profile, user: biz.enrichUser(req.user) });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.put('/profile', authRequired, (req, res) => {
  try {
    if (!biz.getProfile(req.user.id)) {
      return res.status(403).json({ error: 'Əvvəlcə biznes hesabı yaradın' });
    }
    const profile = biz.upsertProfile(req.user.id, req.body || {});
    return res.json({ profile });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/quotes', authRequired, (req, res) => {
  try {
    const quote = biz.createQuote(req.user.id, req.body || {});
    return res.status(201).json({ quote });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/quotes', authRequired, (req, res) => {
  try {
    return res.json({ quotes: biz.listQuotes(req.user.id) });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/quotes/:id/pdf', authRequired, (req, res) => {
  try {
    const quote = biz.getQuote(req.user.id, req.params.id);
    if (!quote) return res.status(404).json({ error: 'Təklif tapılmadı' });
    const profile = biz.requireBusiness(req.user.id);
    const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
    const pdf = biz.buildQuotePdf(quote, profile, user);
    const company = String(profile.companyName || 'sirket').replace(/[^\w\-]+/g, '_').slice(0, 24);
    return sendPdf(res, pdf, 'NEXORA_Teklif_' + company + '_' + quote.id + '.pdf');
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/quotes/:id/excel', authRequired, (req, res) => {
  try {
    const quote = biz.getQuote(req.user.id, req.params.id);
    if (!quote) return res.status(404).json({ error: 'Təklif tapılmadı' });
    const profile = biz.requireBusiness(req.user.id);
    const { buildWorkbook } = require('../excel-simple');
    const buf = buildWorkbook([{
      name: 'Teklif',
      widths: [40, 90, 200, 60, 90, 90],
      rows: [
        ['#', 'SKU', 'Mehsul', 'Eded', 'Qiymet', 'Cem'],
        ...(quote.items || []).map((it, i) => [
          i + 1, it.sku || '', it.name || '', it.qty,
          { v: Number(it.unitPrice) || 0, t: 'Number' },
          { v: Number(it.lineTotal) || 0, t: 'Number' }
        ]),
        [],
        ['', '', '', '', 'Ara cem', { v: Number(quote.totals.subtotal) || 0, t: 'Number' }],
        ['', '', '', '', 'Endirim', { v: Number(quote.totals.discount) || 0, t: 'Number' }],
        ['', '', '', '', 'EDV', { v: Number(quote.totals.tax) || 0, t: 'Number' }],
        ['', '', '', '', 'YEKUN', { v: Number(quote.totals.total) || 0, t: 'Number' }],
        [],
        ['Sirket', profile.companyName],
        ['Teklif No', quote.id],
        ['Tarix', String(quote.createdAt || '').slice(0, 10)]
      ]
    }]);
    const company = String(profile.companyName || 'sirket').replace(/[^\w\-]+/g, '_').slice(0, 24);
    return sendDownload(res, {
      buf,
      filename: 'NEXORA_Teklif_' + company + '_' + quote.id + '.xls',
      mime: 'application/vnd.ms-excel'
    });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/contracts', authRequired, (req, res) => {
  try {
    const contract = biz.createContract(req.user.id, req.body || {});
    return res.status(201).json({ contract });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/contracts', authRequired, (req, res) => {
  try {
    return res.json({ contracts: biz.listContracts(req.user.id) });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.get('/contracts/:id/pdf', authRequired, (req, res) => {
  try {
    const contract = biz.getContract(req.user.id, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Müqavilə tapılmadı' });
    const profile = biz.requireBusiness(req.user.id);
    const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
    const pdf = biz.buildContractPdf(contract, profile, user);
    const company = String(profile.companyName || 'sirket').replace(/[^\w\-]+/g, '_').slice(0, 24);
    return sendPdf(res, pdf, 'NEXORA_Muqavile_' + company + '_' + contract.id + '.pdf');
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/bulk-order', authRequired, (req, res) => {
  try {
    const order = biz.placeBulkOrder(req.user.id, req.body || {});
    return res.status(201).json({ order });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/preview-totals', authRequired, (req, res) => {
  try {
    biz.requireBusiness(req.user.id);
    const items = biz.resolveItems((req.body && req.body.items) || []);
    const totals = biz.calcB2bTotals(items);
    return res.json({ items, totals });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

/** Public / one-click PDF Offer Generator (auth optional; save requires business) */
router.post('/offers/preview-pdf', authOptional, (req, res) => {
  try {
    const out = biz.generateOfferPdf(req.body || {}, req.user);
    return sendPdf(res, out.buf, out.filename);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

router.post('/offers/preview', authOptional, (req, res) => {
  try {
    const items = biz.resolveItems(((req.body && req.body.items) || []).slice(0, 40));
    const totals = biz.calcB2bTotals(items);
    return res.json({ items, totals });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
});

module.exports = router;
