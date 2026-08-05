'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();
const ROOT = path.join(__dirname, '..', '..', '..');
const UPLOAD_DIR = path.join(ROOT, 'uploads', 'products');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function ensureDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

router.post('/', adminRequired, (req, res) => {
  try {
    const dataUrl = String((req.body && req.body.dataUrl) || '');
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) {
      return res.status(400).json({ error: 'dataUrl (image base64) tələb olunur' });
    }
    const mime = m[1].toLowerCase();
    const ext = MIME_EXT[mime];
    if (!ext) {
      return res.status(400).json({ error: 'Yalnız JPG, PNG, WEBP, GIF qəbul olunur' });
    }
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return res.status(400).json({ error: 'Boş fayl' });
    if (buf.length > 6 * 1024 * 1024) {
      return res.status(400).json({ error: 'Şəkil 6MB-dan böyük ola bilməz' });
    }

    ensureDir();
    const name = 'img_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex') + ext;
    const full = path.join(UPLOAD_DIR, name);
    fs.writeFileSync(full, buf);

    const url = '/uploads/products/' + name;
    return res.status(201).json({ ok: true, url: url, mime: mime, size: buf.length });
  } catch (e) {
    console.error('upload failed', e);
    return res.status(500).json({ error: 'Yükləmə alınmadı' });
  }
});

module.exports = router;
