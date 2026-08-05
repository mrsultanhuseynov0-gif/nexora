'use strict';

const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = String(req.query.data || req.query.text || '').trim();
    if (!data) {
      return res.status(400).json({ error: 'data parametri tələb olunur' });
    }
    if (data.length > 1200) {
      return res.status(400).json({ error: 'Mətn çox uzundur' });
    }
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 180, 80), 512);
    const png = await QRCode.toBuffer(data, {
      type: 'png',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#FFFFFF' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(png);
  } catch (e) {
    console.error('QR error', e);
    return res.status(500).json({ error: 'QR yaradıla bilmədi' });
  }
});

module.exports = router;
