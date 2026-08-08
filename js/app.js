/**
 * NEXORA App Core — path helpers, data loading, formatting, storage merge
 */
const NexoraApp = (function () {
  'use strict';

  function getBasePath() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    if (path.includes('/pages/admin')) return '../../';
    if (path.includes('/pages/')) return '../';
    return '';
  }

  function url(relative) {
    if (!relative) return getBasePath();
    if (/^https?:|mailto:|tel:|#/.test(relative)) return relative;
    return getBasePath() + relative.replace(/^\//, '');
  }

  function pageUrl(page) {
    return url('pages/' + page.replace(/^pages\//, ''));
  }

  async function fetchJSON(path) {
    const res = await fetch(url(path));
    if (!res.ok) throw new Error('Failed to load ' + path);
    return res.json();
  }

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* private mode / quota */ }
  }

  function mergeProductOverrides(seed, catalogVer) {
    const savedVer = storageGet('nexora-catalog-ver', null);
    if (savedVer !== catalogVer) {
      localStorage.removeItem('nexora-products');
      localStorage.removeItem('nexora-cart');
      localStorage.removeItem('nexora-cart-coupon');
      localStorage.removeItem('nexora-wishlist');
      storageSet('nexora-catalog-ver', catalogVer);
    }
    const override = storageGet('nexora-products', null);
    if (!override || !Array.isArray(override) || !override.length) return seed;

    const byId = {};
    seed.forEach(function (p) { byId[p.id] = p; });
    return override.map(function (p) {
      const base = byId[p.id];
      if (!base) return p;
      return Object.assign({}, p, {
        image: base.image || p.image,
        images: (base.images && base.images.length) ? base.images : p.images,
        gradient: p.gradient || base.gradient
      });
    });
  }

  async function loadProducts() {
    // Prefer API — including empty catalog (do not resurrect old localStorage demos)
    // Do not await ensureApi/health first — that adds an extra RTT before every catalog paint
    try {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getProducts) {
        const apiData = await NexoraApi.getProducts({ limit: 1000 });
        if (apiData && Array.isArray(apiData.products)) {
          const seed = apiData.products;
          const ver = apiData.version || seed.length || 1;
          if (!seed.length) {
            localStorage.removeItem('nexora-products');
            storageSet('nexora-catalog-ver', ver);
            return [];
          }
          return mergeProductOverrides(seed, ver);
        }
      }
    } catch (e) {
      console.warn('API products failed, falling back to JSON', e);
    }

    const data = await fetchJSON('data/products.json');
    const seed = data.products || [];
    const ver = data.version || seed.length || 1;
    if (!seed.length) {
      localStorage.removeItem('nexora-products');
      storageSet('nexora-catalog-ver', ver);
      return [];
    }
    return mergeProductOverrides(seed, ver);
  }

  async function loadCategories() {
    const data = await fetchJSON('data/categories.json');
    return data.categories || [];
  }

  async function loadBrands() {
    const data = await fetchJSON('data/brands.json');
    return data.brands || [];
  }

  async function loadCampaigns() {
    const override = storageGet('nexora-campaigns', null);
    if (override) return override;
    return fetchJSON('data/campaigns.json');
  }

  async function loadTechNews() {
    try {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getCms) {
        var cms = await NexoraApi.getCms('tech-news');
        if (cms && cms.data && Array.isArray(cms.data.articles)) return cms.data;
      }
    } catch (e) { /* fall through */ }
    return fetchJSON('data/tech-news.json');
  }

  const SITE_KEY = 'nexora-site';
  let _siteCache = null;

  function defaultSiteSettings() {
    return {
      brandName: 'NEXORA',
      logoText: 'NEXORA',
      logoImage: '',
      tagline: 'Premium alış-veriş',
      accentColor: '#FF0000',
      whatsapp: '+994501234567',
      telegram: 'nexora_az',
      liveChat: {
        enabled: true,
        whatsappEnabled: true,
        whatsappMessage: 'Salam! NEXORA-dan yazıram.',
        tawkPropertyId: '',
        crispWebsiteId: ''
      },
      promoBar: { enabled: true, text: '', link: 'pages/campaigns.html', linkText: '' },
      nav: [],
      footer: { desc: '', facebook: '', instagram: '', youtube: '' },
      pages: { about: {}, contact: {}, faq: {} },
      home: {}
    };
  }

  function ensureNavExtras(site) {
    const nav = Array.isArray(site.nav) ? site.nav.slice() : [];
    const have = {};
    nav.forEach(function (n) { have[n.id] = true; });
    const extras = [
      { id: 'lookbook', label: 'Lookbook', href: 'pages/lookbook.html', visible: true },
      { id: 'consultant', label: 'AI Məsləhətçi', href: 'pages/consultant.html', visible: true },
      { id: 'office_builder', label: 'Office Builder', href: 'pages/office-builder.html', visible: true },
      { id: 'offer_generator', label: 'PDF Offer', href: 'pages/offer-generator.html', visible: true },
      { id: 'compare', label: 'Müqayisə', href: 'pages/compare.html', visible: true },
      { id: 'news', label: 'Xəbərlər', href: 'pages/news.html', visible: true },
      { id: 'track', label: 'Sifariş izlə', href: 'pages/track.html', visible: true }
    ];
    extras.forEach(function (n) {
      if (!have[n.id]) {
        nav.push(n);
        have[n.id] = true;
      }
    });
    site.nav = nav;
    return site;
  }

  async function loadSiteSettings(force) {
    if (!force && _siteCache) return _siteCache;

    // Prefer live CMS so admin "Sayt ayarları" applies for all visitors
    if (typeof NexoraApi !== 'undefined' && NexoraApi.getCms) {
      try {
        var online = true;
        if (NexoraApi.health) {
          var h = await NexoraApi.health();
          online = !!(h && h.ok);
        }
        if (online) {
          var cms = await NexoraApi.getCms('site');
          var cmsData = cms && (cms.data || cms);
          if (cmsData && typeof cmsData === 'object') {
            _siteCache = Object.assign(defaultSiteSettings(), cmsData);
            ensureNavExtras(_siteCache);
            try { storageSet(SITE_KEY, _siteCache); } catch (e0) { /* ignore */ }
            return _siteCache;
          }
        }
      } catch (e1) { /* fall through to local seed */ }
    }

    let seed = null;
    try { seed = await fetchJSON('data/site.json'); } catch (e) { seed = null; }
    const override = storageGet(SITE_KEY, null);
    if (override && typeof override === 'object') {
      _siteCache = Object.assign(defaultSiteSettings(), seed || {}, override);
    } else {
      _siteCache = Object.assign(defaultSiteSettings(), seed || {});
    }
    ensureNavExtras(_siteCache);
    return _siteCache;
  }

  function saveSiteSettings(data) {
    _siteCache = Object.assign(defaultSiteSettings(), data || {});
    ensureNavExtras(_siteCache);
    storageSet(SITE_KEY, _siteCache);
    applySiteTheme(_siteCache);
    return _siteCache;
  }

  function applySiteTheme(site) {
    const s = site || _siteCache;
    if (!s || !s.accentColor) return;
    document.documentElement.style.setProperty('--color-primary', s.accentColor);
    document.documentElement.style.setProperty('--color-brand', s.accentColor);
  }

  function whatsappLink(message) {
    const site = _siteCache || storageGet(SITE_KEY, null) || {};
    const raw = String(site.whatsapp || '+994501234567').replace(/[^\d+]/g, '');
    const phone = raw.replace(/^\+/, '');
    const text = encodeURIComponent(message || 'Salam! NEXORA sifarişi.');
    return 'https://wa.me/' + phone + '?text=' + text;
  }

  function telegramLink(message) {
    const site = _siteCache || storageGet(SITE_KEY, null) || {};
    const user = String(site.telegram || 'nexora_az').replace(/^@/, '');
    return 'https://t.me/' + user + (message ? '?text=' + encodeURIComponent(message) : '');
  }

  function isInStock(product) {
    if (!product) return false;
    if (product.stock != null && Number(product.stock) <= 0) return false;
    return product.inStock !== false;
  }

  const CURRENCY_KEY = 'nexora-currency';
  const RATES_FROM_AZN = { AZN: 1, USD: 1 / 1.7, EUR: 1 / 1.85 };
  const CURRENCY_SYMBOLS = { AZN: '₼', USD: '$', EUR: '€' };

  function getCurrency() {
    try {
      const c = localStorage.getItem(CURRENCY_KEY) || 'AZN';
      if (RATES_FROM_AZN[c]) return c;
    } catch (e) { /* ignore */ }
    return 'AZN';
  }

  function setCurrency(code) {
    let c = String(code || 'AZN').toUpperCase();
    if (!RATES_FROM_AZN[c]) c = 'AZN';
    try { localStorage.setItem(CURRENCY_KEY, c); } catch (e) { /* ignore */ }
    return c;
  }

  function formatPrice(amount, currency) {
    // Catalog amounts are AZN; display currency from navbar switcher
    const display = getCurrency();
    const n = (Number(amount) || 0) * (RATES_FROM_AZN[display] || 1);
    const sym = CURRENCY_SYMBOLS[display] || '₼';
    if (display === 'USD' || display === 'EUR') {
      return sym + n.toLocaleString(display === 'EUR' ? 'de-DE' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    let cur = currency || '₼';
    if (!cur || cur === 'AZN' || cur === 'azn' || cur.charCodeAt(0) === 0xFFFD) cur = '₼';
    if (display === 'AZN') {
      return n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + cur;
    }
    return n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + sym;
  }

  function discountPercent(price, oldPrice) {
    if (!oldPrice || oldPrice <= price) return 0;
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  function starsHTML(rating) {
    const r = Math.round(Number(rating) || 0);
    let html = '<span class="rating-stars" aria-label="' + rating + ' ulduz">';
    for (let i = 1; i <= 5; i++) {
      html += '<span class="icon icon-xs" style="color:' + (i <= r ? '#f5a623' : '#ccc') + '" data-icon="star"></span>';
    }
    html += '</span>';
    return html;
  }

  function resolveMediaUrl(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    // Allow assets/images/... from any page depth
    const clean = src.replace(/^\.\.\//, '').replace(/^\.\//, '').replace(/^\//, '');
    return url(clean);
  }

  function productImage(product) {
    if (!product) return '';
    const raw = product.image ||
      (product.images && product.images.length
        ? (product.images[0].src || product.images[0].url || '')
        : '');
    return resolveMediaUrl(raw);
  }

  function productThumbHTML(product, className) {
    const g = product.gradient || 'linear-gradient(135deg,#1E1E1E,#333)';
    const src = productImage(product);
    const alt = (product.name || 'NEXORA').replace(/"/g, '&quot;');
    const fallback = resolveMediaUrl('assets/products/p0001.svg');
    const imgSrc = src || fallback;
    return '<div class="product-thumb has-image ' + (className || '') + '" style="background:' + g + '">' +
      '<img src="' + imgSrc + '" alt="' + alt + '" loading="lazy" decoding="async" ' +
      'onerror="this.style.display=\'none\'">' +
      '</div>';
  }

  function productCardHTML(product, opts) {
    opts = opts || {};
    const base = getBasePath();
    const href = base + 'pages/product.html?id=' + encodeURIComponent(product.id);
    const stockOk = isInStock(product);
    const tt = function (k) {
      return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(k) : k;
    };
    const badgeText = !stockOk
      ? tt('sold_out')
      : (product.badge
        ? (typeof NexoraI18n !== 'undefined' ? NexoraI18n.translateBadge(product.badge) : product.badge)
        : '');
    const badge = badgeText
      ? '<span class="badge badge-' + (!stockOk ? 'dark' : (product.badgeType || 'primary')) +
        ' card-product-badge">' + badgeText + '</span>'
      : '';
    const old = product.oldPrice
      ? '<span class="price-old">' + formatPrice(product.oldPrice, product.currency) + '</span>'
      : '';
    const stockClass = stockOk ? '' : ' opacity-50';

    return (
      '<article class="card card-product' + stockClass + '" data-product-id="' + product.id + '">' +
        '<div class="card-product-image">' +
          '<a href="' + href + '" class="product-card-link">' + productThumbHTML(product) + '</a>' +
          badge +
          '<div class="card-product-actions">' +
            '<button type="button" class="icon-btn icon-btn-circle" data-wishlist-toggle="' + product.id +
              '" aria-label="' + tt('wishlist') + '">' +
              '<span class="icon icon-sm" data-icon="heart"></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-product-content">' +
          '<div class="card-product-brand">' + (product.brand || '') + '</div>' +
          '<a href="' + href + '" class="product-card-link"><h3 class="card-product-name">' + product.name + '</h3></a>' +
          '<div class="mb-2">' + starsHTML(product.rating) +
            '<span class="rating-count">(' + (product.reviews || 0) + ')</span></div>' +
          '<div class="card-product-price">' +
            '<span class="price">' + formatPrice(product.price, product.currency) + '</span>' + old +
          '</div>' +
          (opts.hideCart ? '' :
            '<button type="button" class="btn btn-primary btn-sm mt-4 w-full" data-add-cart="' + product.id + '"' +
              (stockOk ? '' : ' disabled') + '>' +
              (stockOk ? tt('add_cart') : tt('out_of_stock')) +
            '</button>') +
        '</div>' +
      '</article>'
    );
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function updateBadges() {
    const cartCount = (typeof NexoraCart !== 'undefined') ? NexoraCart.count() : 0;
    const wishCount = (typeof NexoraWishlist !== 'undefined') ? NexoraWishlist.count() : 0;

    document.querySelectorAll('[data-cart-badge]').forEach(function (el) {
      el.textContent = cartCount > 0 ? String(cartCount) : '';
      el.setAttribute('data-count', String(cartCount));
    });
    document.querySelectorAll('[data-wishlist-badge]').forEach(function (el) {
      el.textContent = wishCount > 0 ? String(wishCount) : '';
      el.setAttribute('data-count', String(wishCount));
    });
  }

  function bindProductActions(root) {
    const scope = root || document;

    scope.querySelectorAll('[data-add-cart]').forEach(function (btn) {
      if (btn._nexoraBound) return;
      btn._nexoraBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-add-cart');
        if (typeof NexoraCart !== 'undefined') {
          NexoraCart.add(id, 1).then(function () {
            if (typeof NexoraToast !== 'undefined') {
              NexoraToast.success(typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('added_cart') : 'Səbətə əlavə olundu');
            }
            updateBadges();
            if (typeof NexoraSmart !== 'undefined') NexoraSmart.trackCartAbort(id);
          }).catch(function (err) {
            if (err && err.code === 'AUTH_REQUIRED') return;
            if (typeof NexoraToast !== 'undefined') {
              NexoraToast.error((err && err.message) || (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('sold_out') : 'Stokda yoxdur'));
            }
          });
        }
      });
    });

    scope.querySelectorAll('[data-wishlist-toggle]').forEach(function (btn) {
      if (btn._nexoraBound) return;
      btn._nexoraBound = true;
      const id = btn.getAttribute('data-wishlist-toggle');
      if (typeof NexoraWishlist !== 'undefined' && NexoraWishlist.has(id)) {
        btn.classList.add('is-active');
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof NexoraWishlist === 'undefined') return;
        try {
          const added = NexoraWishlist.toggle(id);
          btn.classList.toggle('is-active', added);
          if (typeof NexoraToast !== 'undefined') {
            const msg = typeof NexoraI18n !== 'undefined'
              ? NexoraI18n.t(added ? 'added_wish' : 'removed_wish')
              : (added ? 'Seçilmişlərə əlavə olundu' : 'Seçilmişlərdən silindi');
            NexoraToast[added ? 'success' : 'info'](msg);
          }
          updateBadges();
        } catch (err) {
          if (err && err.code === 'AUTH_REQUIRED') return;
          if (typeof NexoraToast !== 'undefined') {
            NexoraToast.error((err && err.message) || 'Xəta');
          }
        }
      });
    });
  }

  function initAuthUI() {
    function apply(user) {
      document.querySelectorAll('[data-auth-label]').forEach(function (el) {
        el.textContent = user ? (user.name || 'Hesab') : 'Hesab';
      });
    }
    if (typeof NexoraAccount !== 'undefined' && NexoraAccount.getSession) {
      Promise.resolve(NexoraAccount.getSession()).then(apply).catch(function () { apply(null); });
      return;
    }
    const raw = storageGet('nexora-session', null);
    if (!raw || raw.v !== 2 || !raw.sig || (raw.exp && Date.now() > Number(raw.exp))) {
      apply(null);
    } else {
      apply(raw);
    }
  }

  return {
    getBasePath,
    url,
    pageUrl,
    fetchJSON,
    storageGet,
    storageSet,
    loadProducts,
    loadCategories,
    loadBrands,
    loadCampaigns,
    loadTechNews,
    loadSiteSettings,
    saveSiteSettings,
    applySiteTheme,
    whatsappLink,
    telegramLink,
    isInStock,
    formatPrice,
    getCurrency,
    setCurrency,
    discountPercent,
    starsHTML,
    resolveMediaUrl,
    productImage,
    productThumbHTML,
    productCardHTML,
    getQueryParam,
    debounce,
    updateBadges,
    bindProductActions,
    initAuthUI
  };
})();
