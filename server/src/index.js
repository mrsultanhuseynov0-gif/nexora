'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cfg = require('./config');
const { db } = require('./db');
const { seed } = require('./seed');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const catalogRoutes = require('./routes/catalog');
const adminRoutes = require('./routes/admin');
const { router: cmsRoutes, ensureCmsSeed } = require('./routes/cms');
const paymentRoutes = require('./routes/payments');
const referralRoutes = require('./routes/referrals');
const aiRoutes = require('./routes/ai');
const warrantyRoutes = require('./routes/warranties');
const serviceRoutes = require('./routes/service');
const analyticsRoutes = require('./routes/analytics');
const businessRoutes = require('./routes/business');

const app = express();
const ROOT = path.join(__dirname, '..', '..');

if (cfg.trustProxy) app.set('trust proxy', 1);

/* ---------- Security + performance headers ---------- */
app.use(function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  if (cfg.isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(compression());

const corsOrigin = cfg.corsOrigins === true
  ? true
  : function (origin, cb) {
      if (!origin) return cb(null, true);
      if (cfg.corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    };

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

/* Public runtime config for storefront (no secrets) */
app.get('/config.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    apiBase: cfg.publicApiUrl || '',
    siteUrl: cfg.publicSiteUrl || '',
    env: cfg.isProd ? 'production' : 'development'
  });
});

app.get('/api/health', (_req, res) => {
  // Always 200 so Render/host health checks pass even during cold seed.
  let products = null;
  let users = null;
  try {
    products = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
    users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  } catch (e) {
    /* DB may still be initializing */
  }
  res.status(200).json({
    ok: true,
    service: 'nexora-api',
    products,
    users,
    time: new Date().toISOString(),
    env: cfg.isProd ? 'production' : 'development'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/warranties', warrantyRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/business', businessRoutes);
app.use('/api', catalogRoutes);

/* Dynamic sitemap (SEO) */
app.get('/sitemap.xml', (_req, res) => {
  const base = cfg.publicSiteUrl || '';
  const pages = [
    '/',
    '/pages/products.html',
    '/pages/categories.html',
    '/pages/campaigns.html',
    '/pages/brands.html',
    '/pages/news.html',
    '/pages/about.html',
    '/pages/contact.html',
    '/pages/faq.html',
    '/pages/consultant.html',
    '/pages/office-builder.html',
    '/pages/offer-generator.html',
    '/pages/lookbook.html',
    '/pages/compare.html',
    '/pages/track.html'
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map((p) => {
      const normalized = base
        ? (base + (p === '/' ? '/' : p))
        : p;
      return '<url><loc>' + normalized.replace(/&/g, '&amp;') + '</loc><changefreq>daily</changefreq></url>';
    }),
    '</urlset>'
  ].join('\n');
  res.type('application/xml').send(body);
});

// Static storefront (same origin as API)
app.use(express.static(ROOT, {
  extensions: ['html'],
  etag: true,
  lastModified: true,
  maxAge: 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/\.(js|css)$/i.test(filePath)) {
      // Short cache + revalidate so deploys show up without hard-refresh forever
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (/\.(svg|png|jpg|webp|woff2)$/i.test(filePath)) {
      res.setHeader('Cache-Control', cfg.isProd ? 'public, max-age=86400' : 'no-cache');
    }
  }
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server xətası' });
});

function ensureSeeded() {
  const n = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (n === 0) {
    console.log('DB empty — seeding from data/*.json ...');
    seed();
  }
  try {
    db.prepare(
      "UPDATE users SET name = 'Sultan' WHERE email = 'demo@nexora.az' AND (name IS NULL OR name = '' OR name = 'Demo İstifadəçi')"
    ).run();
  } catch (e) { /* ignore */ }
  ensureCmsSeed();
}

function runBootTasks() {
  try {
    ensureSeeded();
  } catch (e) {
    console.error('Seed failed:', e && e.stack ? e.stack : e);
  }

  try {
    const { getPaymentSettings, savePaymentSettings } = require('./payments');
    const row = db.prepare("SELECT key FROM cms_docs WHERE key = 'payments'").get();
    if (!row) savePaymentSettings(getPaymentSettings());
  } catch (e) {
    console.warn('Payment settings seed:', e.message);
  }

  try {
    const { ensureAllUserCodes, getReferralSettings, saveReferralSettings } = require('./referrals');
    const row = db.prepare("SELECT key FROM cms_docs WHERE key = 'referrals'").get();
    if (!row) saveReferralSettings(getReferralSettings());
    ensureAllUserCodes();
  } catch (e) {
    console.warn('Referral seed:', e.message);
  }

  try {
    require('./business').ensureDemoBusiness();
  } catch (e) {
    console.warn('Business demo seed:', e.message);
  }
}

if (cfg.isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'nexora-dev-secret-change-me')) {
  console.warn('[WARN] Set a strong JWT_SECRET in production environment variables.');
}

// Listen first so host health checks succeed; seed after bind.
app.listen(cfg.port, cfg.host, () => {
  console.log(`NEXORA API + storefront: http://${cfg.host}:${cfg.port}`);
  console.log(`Health: http://${cfg.host}:${cfg.port}/api/health`);
  console.log('Demo: demo@nexora.az / Demo1234 | admin@nexora.az / Admin1234');
  setImmediate(runBootTasks);

  // Keep free-tier hosts awake with a light self-ping (every 12 min)
  if (cfg.isProd) {
    const pingUrl = (cfg.publicSiteUrl || ('http://127.0.0.1:' + cfg.port)) + '/api/health';
    setInterval(function () {
      fetch(pingUrl).catch(function () { /* ignore */ });
    }, 12 * 60 * 1000);
  }
});
