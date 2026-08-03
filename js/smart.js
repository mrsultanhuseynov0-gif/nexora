/**
 * NEXORA Smart features — AI consultant, XP, wheel, mystery, bundles, etc.
 */
const NexoraSmart = (function () {
  'use strict';

  const XP_KEY = 'nexora-xp';
  const WHEEL_KEY = 'nexora-wheel-done';
  const WISH_ALERTS = 'nexora-wish-alerts';
  const VIEW_KEY = 'nexora-view-stats';
  const CART_ABORT = 'nexora-cart-abort';

  const LEVELS = [
    { id: 'bronze', name: 'Bronze', min: 0, discount: 0 },
    { id: 'silver', name: 'Silver', min: 200, discount: 3 },
    { id: 'gold', name: 'Gold', min: 600, discount: 5 },
    { id: 'platinum', name: 'Platinum', min: 1500, discount: 8 },
    { id: 'diamond', name: 'Diamond', min: 3500, discount: 12 }
  ];

  const WHEEL_PRIZES = [
    { label: '5%', type: 'percent', value: 5 },
    { label: '10%', type: 'percent', value: 10 },
    { label: 'Pulsuz çatdırılma', type: 'shipping', value: 0 },
    { label: 'Yenidən cəhd', type: 'none', value: 0 },
    { label: '3%', type: 'percent', value: 3 },
    { label: 'Hədiyyə kuponu', type: 'percent', value: 7 }
  ];

  function getXp() {
    return NexoraApp.storageGet(XP_KEY, { points: 0, history: [] });
  }

  function setXp(data) {
    NexoraApp.storageSet(XP_KEY, data);
  }

  function getLevel(points) {
    let lvl = LEVELS[0];
    LEVELS.forEach(function (l) {
      if (points >= l.min) lvl = l;
    });
    return lvl;
  }

  function addXp(amount, reason) {
    const data = getXp();
    data.points = (data.points || 0) + amount;
    data.history = data.history || [];
    data.history.unshift({ amount: amount, reason: reason, at: new Date().toISOString() });
    data.history = data.history.slice(0, 40);
    setXp(data);
    return { points: data.points, level: getLevel(data.points) };
  }

  function levelDiscountCoupon() {
    const lvl = getLevel(getXp().points || 0);
    if (!lvl.discount) return null;
    return {
      code: 'LVL-' + lvl.id.toUpperCase(),
      type: 'percent',
      value: lvl.discount,
      minOrder: 0,
      description: lvl.name + ' səviyyə endirimi (' + lvl.discount + '%)'
    };
  }

  /* ---- AI consultant (rule-based) ---- */
  function parseQuery(text) {
    const t = String(text || '').toLowerCase()
      .replace(/kompuyuter|kompyuter|komputer|kompüter/g, 'komputer')
      .replace(/noutbuk|laptob|labtop/g, 'noutbuk');
    const budgetMatch = t.match(/(\d{2,6})\s*(azn|₼|manat)?/);
    const budget = budgetMatch ? Number(budgetMatch[1]) : 99999;
    let category = null;
    let tags = [];
    if (/oyun|gaming|komputer|noutbuk|laptop|pc/.test(t)) {
      category = 'electronics';
      tags = ['gaming', 'laptops', 'laptop'];
    } else if (/telefon|smartfon|iphone|samsung|galaxy/.test(t)) {
      category = 'electronics';
      tags = ['smartphones', 'smartfon'];
    } else if (/idman|fitness|yoga|qaçış/.test(t)) {
      category = 'sports';
    } else if (/ev|mətbəx|tozsoran|mebel/.test(t)) {
      category = 'home';
    } else if (/uşaq|oyuncaq|lego/.test(t)) {
      category = 'kids';
    } else if (/gözəllik|kosmetika|serum/.test(t)) {
      category = 'beauty';
    } else if (/avto|maşın|avtomobil/.test(t)) {
      category = 'auto';
    } else if (/kitab|hobi/.test(t)) {
      category = 'books';
    } else if (/moda|ayaqqabı|geyim/.test(t)) {
      category = 'fashion';
    }
    const gaming = /oyun|gaming|gamer/.test(t);
    return { budget: budget, category: category, tags: tags, gaming: gaming, raw: t };
  }

  function scoreForConsult(p, q) {
    let s = 0;
    if (p.price > q.budget) return -1;
    if (q.category && p.category === q.category) s += 5;
    if (q.gaming && (/gaming|oyun|laptop|noutbuk/i.test(p.name + p.subcategory + (p.tags || []).join(' ')))) s += 6;
    (q.tags || []).forEach(function (tag) {
      if ((p.subcategory || '') === tag || (p.tags || []).indexOf(tag) >= 0) s += 3;
      if (NexoraSearch && NexoraSearch.scoreProduct) s += Math.min(2, NexoraSearch.scoreProduct(p, tag) / 10);
    });
    s += (p.rating || 0);
    s += Math.min(3, (p.reviews || 0) / 50);
    if (p.isNew) s += 1;
    // prefer closer to budget (not too cheap for gaming PC ask)
    if (q.budget < 99999) {
      const ratio = p.price / q.budget;
      if (ratio > 0.45 && ratio <= 1) s += 4;
    }
    return s;
  }

  async function consult(text, opts) {
    opts = opts || {};
    // Prefer backend AI when available (live catalog + better ranking)
    if (typeof NexoraApi !== 'undefined') {
      try {
        var health = await fetch('/api/ai/health').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
        if (health && health.ok) {
          var apiRes = await NexoraApi.aiConsult(text, { limit: opts.limit || 8, history: opts.history || [] });
          if (apiRes) {
            return {
              query: apiRes.intent || {},
              products: apiRes.products || [],
              advice: apiRes.advice || '',
              questions: apiRes.questions || [],
              chips: apiRes.chips || [],
              source: 'api'
            };
          }
        }
      } catch (e) { /* fall back local */ }
    }

    const q = parseQuery(text);
    const products = await NexoraApp.loadProducts();
    const ranked = products
      .map(function (p) { return { p: p, s: scoreForConsult(p, q) }; })
      .filter(function (x) { return x.s >= 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8)
      .map(function (x) { return x.p; });

    let advice = 'Büdcənizə uyğun seçimləri topladım.';
    if (q.gaming) advice = 'Oyun üçün performans və soyutma vacibdir — aşağıdakı modelləri müqayisə edin.';
    if (!ranked.length) advice = 'Bu büdcə/filtrə uyğun məhsul tapılmadı. Büdcəni artırın və ya kateqoriyanı dəyişin.';

    return { query: q, products: ranked, advice: advice, source: 'local', questions: [], chips: [] };
  }

  async function addConsultCart(products) {
    for (let i = 0; i < products.length; i++) {
      try { await NexoraCart.add(products[i].id, 1); } catch (e) { /* skip OOS */ }
    }
  }

  /* ---- Bundles ---- */
  async function suggestBundle(product) {
    const all = await NexoraApp.loadProducts();
    const hints = [];
    const name = (product.name + ' ' + product.subcategory + ' ' + (product.tags || []).join(' ')).toLowerCase();
    const isLaptop = /laptop|noutbuk|macbook|notebook/.test(name) || product.subcategory === 'laptops';
    const isPhone = /telefon|iphone|galaxy|smartfon/.test(name) || product.subcategory === 'smartphones';

    function pick(pred, label) {
      const hit = all.find(function (p) {
        return p.id !== product.id && pred(p) && NexoraApp.isInStock(p);
      });
      if (hit) hints.push({ product: hit, label: label });
    }

    if (isLaptop) {
      pick(function (p) { return /mouse|siçan/i.test(p.name) || p.subcategory === 'gaming'; }, 'Siçan');
      pick(function (p) { return /keyboard|klaviatura/i.test(p.name); }, 'Klaviatura');
      pick(function (p) { return /backpack|çanta|bag/i.test(p.name); }, 'Çanta');
      pick(function (p) { return /monitor|ssd|hub|adapter/i.test(p.name); }, 'Aksessuar');
      pick(function (p) { return p.category === 'electronics' && /ssd|hub|speaker/i.test(p.name); }, 'Əlavə');
    } else if (isPhone) {
      pick(function (p) { return /case|qapaq|cover/i.test(p.name); }, 'Qapaq');
      pick(function (p) { return /earbuds|qulaqlıq|airpods|headphones/i.test(p.name); }, 'Qulaqlıq');
      pick(function (p) { return /charger|adapter|power bank|powerbank/i.test(p.name); }, 'Şarj');
      pick(function (p) { return /watch|saat/i.test(p.name); }, 'Saat');
    } else {
      pick(function (p) { return p.category === product.category && p.id !== product.id; }, 'Oxşar');
      pick(function (p) { return p.category === product.category && p.brandId === product.brandId; }, 'Eyni brend');
      pick(function (p) { return p.isNew && p.category === product.category; }, 'Yeni');
    }

    // fill up to 4
    all.filter(function (p) {
      return p.category === product.category && p.id !== product.id && NexoraApp.isInStock(p);
    }).slice(0, 6).forEach(function (p) {
      if (hints.length >= 4) return;
      if (hints.some(function (h) { return h.product.id === p.id; })) return;
      hints.push({ product: p, label: 'Tövsiyə' });
    });

    const items = hints.slice(0, 4);
    const sum = items.reduce(function (s, h) { return s + h.product.price; }, 0) + product.price;
    const discount = Math.round(sum * 0.08);
    return { items: items, total: sum, bundlePrice: sum - discount, discount: discount };
  }

  /* ---- Price history ---- */
  function priceHistory(product, days) {
    days = days || 60;
    const points = [];
    const base = product.oldPrice || product.price * 1.12;
    let price = base;
    const end = product.price;
    for (let i = days; i >= 0; i -= 3) {
      const t = Date.now() - i * 86400000;
      const drift = (Math.sin(i * 0.35 + product.id.length) * 0.04 + (Math.random() - 0.5) * 0.02);
      price = Math.max(end * 0.9, price * (1 + drift));
      if (i < 10) price = price * 0.7 + end * 0.3;
      if (i === 0) price = end;
      points.push({ date: new Date(t).toISOString().slice(0, 10), price: Math.round(price) });
    }
    return points;
  }

  function renderPriceChart(canvas, points) {
    if (!canvas || !points.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth || 320;
    const h = canvas.height = 160;
    const prices = points.map(function (p) { return p.price; });
    const min = Math.min.apply(null, prices) * 0.95;
    const max = Math.max.apply(null, prices) * 1.05;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border') || '#ddd';
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.lineTo(32, h - 24);
    ctx.lineTo(w - 8, h - 24);
    ctx.stroke();
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach(function (p, i) {
      const x = 32 + (i / (points.length - 1)) * (w - 48);
      const y = 10 + (1 - (p.price - min) / (max - min || 1)) * (h - 40);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,0,0,0.12)';
    ctx.lineTo(w - 8, h - 24);
    ctx.lineTo(32, h - 24);
    ctx.closePath();
    ctx.fill();
  }

  /* ---- Warehouses ---- */
  function warehouses(product) {
    const stock = product.stock || 0;
    const baku = Math.floor(stock * 0.55);
    const ganca = Math.floor(stock * 0.25);
    const sumq = Math.max(0, stock - baku - ganca);
    return [
      { city: 'Bakı Anbarı', qty: baku },
      { city: 'Gəncə', qty: ganca },
      { city: 'Sumqayıt', qty: sumq }
    ];
  }

  /* ---- Live activity ---- */
  function liveStats(product) {
    let h = 0;
    const id = product.id || '';
    for (let i = 0; i < id.length; i++) h += id.charCodeAt(i);
    const day = Math.floor(Date.now() / 86400000);
    return {
      ordered24h: 3 + ((h + day) % 27),
      viewing: 2 + ((h * 3 + day) % 14)
    };
  }

  function trackView(productId) {
    if (!productId) return;
    const stats = NexoraApp.storageGet(VIEW_KEY, {});
    stats[productId] = (stats[productId] || 0) + 1;
    NexoraApp.storageSet(VIEW_KEY, stats);
    if (typeof NexoraApi !== 'undefined' && NexoraApi.trackAnalytics) {
      NexoraApi.trackAnalytics({ type: 'view', productId: productId });
    }
  }

  function getViewStats() {
    return NexoraApp.storageGet(VIEW_KEY, {});
  }

  function trackCartAbort(productId) {
    const data = NexoraApp.storageGet(CART_ABORT, {});
    data[productId] = (data[productId] || 0) + 1;
    NexoraApp.storageSet(CART_ABORT, data);
  }

  /* ---- AI tips ---- */
  function aiTips(product) {
    const tips = [];
    const n = (product.name + ' ' + product.subcategory).toLowerCase();
    if (/laptop|noutbuk|macbook/.test(n)) {
      tips.push('Bu model proqramçılar və ofis işi üçün uyğundur.');
      tips.push('Video montaj üçün daha çox RAM / güclü GPU olan variantı düşünün.');
    }
    if (/gaming|oyun/.test(n)) tips.push('Oyun üçün soyuducu altlıq və 144Hz monitor tövsiyə olunur.');
    if (/telefon|iphone|galaxy|smartfon/.test(n)) tips.push('Ekran qoruyucu və orijinal adapter batareyanı qoruyur.');
    if (/tv|monitor/.test(n)) tips.push('Otaq işığına görə parlaqlıq və HDR rejimini yoxlayın.');
    if (product.category === 'sports') tips.push('İlk həftə yüngül temp ilə başlamaq zədələrin qarşısını alır.');
    if (product.category === 'beauty') tips.push('Patch test edin — yeni kosmetikanı əvvəlcə kiçik sahədə yoxlayın.');
    if (!tips.length) tips.push('Rəsmi zəmanət və 14 günlük qaytarma NEXORA-da keçərlidir.');
    if ((product.stock || 0) <= 5) tips.push('Stok azdır — tez qərar vermək faydalı ola bilər.');
    return tips;
  }

  /* ---- Mystery box ---- */
  function rollMystery(orderTotal) {
    if (orderTotal < 80) return null;
    const roll = Math.random();
    if (roll < 0.35) return { type: 'coupon', code: 'MYSTERY10', label: '10% endirim kuponu', coupon: { code: 'MYSTERY10', type: 'percent', value: 10, minOrder: 0, description: 'Mystery Box' } };
    if (roll < 0.55) return { type: 'shipping', label: 'Növbəti sifarişə pulsuz çatdırılma', coupon: { code: 'MYSTSHIP', type: 'shipping', value: 0, minOrder: 0, description: 'Mystery pulsuz çatdırılma' } };
    if (roll < 0.75) return { type: 'xp', label: '+150 XP bonus', xp: 150 };
    return { type: 'gift', label: 'Hədiyyə: REF10 kuponu', coupon: { code: 'REF10', type: 'percent', value: 10, minOrder: 0, description: 'Mystery hədiyyə' } };
  }

  /* ---- Wheel ---- */
  function hasSpunWheel() {
    return !!localStorage.getItem(WHEEL_KEY);
  }

  function spinWheel() {
    const prize = WHEEL_PRIZES[Math.floor(Math.random() * WHEEL_PRIZES.length)];
    localStorage.setItem(WHEEL_KEY, '1');
    if (prize.type === 'percent' || prize.type === 'shipping') {
      NexoraCart.setCoupon({
        code: 'WHEEL-' + prize.value,
        type: prize.type,
        value: prize.value,
        minOrder: 0,
        description: 'Çarx: ' + prize.label
      });
    }
    return prize;
  }

  /* ---- Smart wishlist alerts ---- */
  async function checkWishlistAlerts() {
    if (typeof NexoraWishlist === 'undefined') return [];
    const ids = NexoraWishlist.getIds ? NexoraWishlist.getIds() : (NexoraWishlist.list && NexoraWishlist.list()) || [];
    const list = Array.isArray(ids) ? ids : [];
    const products = await NexoraApp.loadProducts();
    const prev = NexoraApp.storageGet(WISH_ALERTS, {});
    const alerts = [];
    list.forEach(function (id) {
      const p = products.find(function (x) { return x.id === id; });
      if (!p) return;
      const snap = prev[id] || {};
      if (snap.price && p.price < snap.price) {
        alerts.push({ type: 'sale', product: p, message: p.name + ' endirimə düşdü!' });
      }
      if (snap.inStock === false && NexoraApp.isInStock(p)) {
        alerts.push({ type: 'stock', product: p, message: p.name + ' yenidən stokdadır!' });
      }
      prev[id] = { price: p.price, inStock: NexoraApp.isInStock(p) };
    });
    NexoraApp.storageSet(WISH_ALERTS, prev);
    return alerts;
  }

  /* ---- Warranty ---- */
  function warrantyDaysLeft(endIso) {
    const end = new Date(endIso);
    const now = new Date();
    const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((b - a) / 86400000);
  }

  function warrantiesFromOrders(orders) {
    const cards = [];
    (orders || []).forEach(function (o) {
      (o.items || []).forEach(function (item, idx) {
        const start = new Date(o.createdAt || Date.now());
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        const daysLeft = warrantyDaysLeft(end.toISOString());
        let status = 'active';
        if (daysLeft < 0) status = 'expired';
        else if (daysLeft <= 30) status = 'expiring';
        const productId = item.productId || item.id || ('item' + idx);
        cards.push({
          id: 'war_local_' + o.id + '_' + productId + '_' + idx,
          orderId: o.id,
          name: item.name,
          productName: item.name,
          productId: productId,
          brand: item.brand || '',
          sku: item.sku || productId,
          serial: 'NX-LOCAL-' + String(o.id).slice(-4).toUpperCase() + idx,
          months: 12,
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
          startAt: start.toISOString().slice(0, 10),
          endAt: end.toISOString().slice(0, 10),
          daysLeft: daysLeft,
          status: status,
          statusLabel: daysLeft < 0 ? 'Bitib' : (daysLeft <= 30 ? 'Bitmək üzrə' : 'Aktiv')
        });
      });
    });
    return cards.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
  }

  function buildLocalWarrantyPdf(w, customer) {
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    }
    function tr(s) {
      const map = { ə: 'e', Ə: 'E', ı: 'i', İ: 'I', ğ: 'g', Ğ: 'G', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U', ş: 'sh', Ş: 'Sh', ç: 'ch', Ç: 'Ch' };
      return String(s == null ? '' : s).replace(/[əƏıİğĞöÖüÜşŞçÇ]/g, function (c) { return map[c] || c; });
    }
    const lines = [
      'NEXORA — Resmi Zemanet Sertifikati',
      '====================================',
      '',
      'Sertifikat No: ' + (w.id || '—'),
      'Seriya No:    ' + (w.serial || '—'),
      '',
      'Musteri:  ' + tr((customer && customer.name) || '—'),
      'E-poct:   ' + ((customer && customer.email) || '—'),
      '',
      'Mehsul:   ' + tr(w.productName || w.name || '—'),
      'Brend:    ' + tr(w.brand || '—'),
      'SKU:      ' + (w.sku || '—'),
      'Sifaris:  ' + (w.orderId || '—'),
      '',
      'Zemanet muddeti: ' + (w.months || 12) + ' ay',
      'Baslama:         ' + (w.startAt || w.start || '—'),
      'Bitme:           ' + (w.endAt || w.end || '—'),
      'Qalan gun:       ' + (w.daysLeft < 0 ? 'bitib' : w.daysLeft + ' gun'),
      'Status:          ' + (w.status || '—'),
      '',
      'NEXORA Warranty Center',
      'Tarix: ' + new Date().toISOString().slice(0, 10)
    ];
    const parts = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL'];
    lines.forEach(function (line, i) {
      if (i === 0) {
        parts.push('/F1 16 Tf', '(' + esc(tr(line)) + ') Tj', 'T*', '/F1 11 Tf');
      } else {
        parts.push('(' + esc(tr(line)) + ') Tj', 'T*');
      }
    });
    parts.push('ET');
    const stream = parts.join('\n');
    const objs = [];
    objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
    objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
    objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n');
    objs.push('4 0 obj<< /Length ' + stream.length + ' >>stream\n' + stream + '\nendstream\nendobj\n');
    objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objs.forEach(function (o) {
      offsets.push(pdf.length);
      pdf += o;
    });
    const xref = pdf.length;
    pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    for (let i = 1; i <= objs.length; i++) {
      pdf += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    }
    pdf += 'trailer<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    return new Blob([pdf], { type: 'application/pdf' });
  }

  /* ---- Configurator ---- */
  function configuratorOptions(product) {
    const n = (product.name + product.subcategory).toLowerCase();
    if (!/laptop|noutbuk|macbook|kompüter|pc|gaming/.test(n) && product.subcategory !== 'laptops') {
      return null;
    }
    return {
      base: product.price,
      groups: [
        {
          id: 'ram',
          label: 'RAM',
          options: [
            { id: '16', label: '16 GB', delta: 0 },
            { id: '32', label: '32 GB', delta: 180 },
            { id: '64', label: '64 GB', delta: 420 }
          ]
        },
        {
          id: 'ssd',
          label: 'SSD',
          options: [
            { id: '512', label: '512 GB', delta: 0 },
            { id: '1tb', label: '1 TB', delta: 150 },
            { id: '2tb', label: '2 TB', delta: 320 }
          ]
        },
        {
          id: 'cpu',
          label: 'Prosessor',
          options: [
            { id: 'base', label: 'Standart', delta: 0 },
            { id: 'pro', label: 'Pro (daha güclü)', delta: 250 },
            { id: 'max', label: 'Max (yaradıcı / oyun)', delta: 550 }
          ]
        }
      ]
    };
  }

  function configPrice(base, selections, groups) {
    let total = base;
    const labels = [];
    groups.forEach(function (g) {
      const opt = g.options.find(function (o) { return o.id === selections[g.id]; }) || g.options[0];
      total += opt.delta;
      labels.push(g.label + ': ' + opt.label);
    });
    return { total: total, labels: labels };
  }

  function qrUrl(productId) {
    const path = NexoraApp.pageUrl('product.html?id=' + encodeURIComponent(productId));
    const abs = path.startsWith('http') ? path : (window.location.origin + '/' + path.replace(/^\.\.\//, '').replace(/^\//, ''));
    // Prefer absolute URL for QR
    let full = abs;
    try {
      full = new URL(path, window.location.href).href;
    } catch (e) { /* keep */ }
    return 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(full);
  }

  return {
    LEVELS: LEVELS,
    WHEEL_PRIZES: WHEEL_PRIZES,
    getXp: getXp,
    addXp: addXp,
    getLevel: getLevel,
    levelDiscountCoupon: levelDiscountCoupon,
    consult: consult,
    addConsultCart: addConsultCart,
    suggestBundle: suggestBundle,
    priceHistory: priceHistory,
    renderPriceChart: renderPriceChart,
    warehouses: warehouses,
    liveStats: liveStats,
    trackView: trackView,
    getViewStats: getViewStats,
    trackCartAbort: trackCartAbort,
    aiTips: aiTips,
    rollMystery: rollMystery,
    hasSpunWheel: hasSpunWheel,
    spinWheel: spinWheel,
    checkWishlistAlerts: checkWishlistAlerts,
    warrantiesFromOrders: warrantiesFromOrders,
    warrantyDaysLeft: warrantyDaysLeft,
    buildLocalWarrantyPdf: buildLocalWarrantyPdf,
    configuratorOptions: configuratorOptions,
    configPrice: configPrice,
    qrUrl: qrUrl
  };
})();
