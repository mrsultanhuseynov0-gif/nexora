/**
 * NEXORA Home page
 */
(function () {
  'use strict';

  let slideIndex = 0;
  let slideTimer = null;
  let slides = [];

  function renderHero(slideData) {
    slides = slideData.slides || [];
    const root = document.getElementById('heroSlides');
    const dots = document.getElementById('heroDots');
    if (!root || !slides.length) return;

    root.innerHTML = slides.map(function (s, i) {
      return (
        '<div class="hero-slide' + (i === 0 ? ' is-active' : '') + '" style="background:' + s.gradient + '" data-slide="' + i + '">' +
          (s.image ? '<img class="hero-bg-img" src="' + s.image + '" alt="" aria-hidden="true">' : '') +
          '<div class="hero-overlay"></div>' +
          '<div class="container">' +
            '<div class="hero-content">' +
              (s.badge ? '<span class="badge badge-primary hero-badge">' + s.badge + '</span>' : '') +
              '<p class="hero-subtitle">' + s.subtitle + '</p>' +
              '<h1 class="hero-title">' + s.title + '</h1>' +
              '<p class="hero-desc">' + s.description + '</p>' +
              '<div class="hero-actions">' +
                '<a href="' + NexoraApp.url(s.ctaLink) + '" class="btn btn-primary btn-lg">' + s.ctaText + '</a>' +
                '<a href="' + NexoraApp.url(s.secondaryCtaLink) + '" class="btn btn-outline btn-lg" style="color:#fff;border-color:rgba(255,255,255,.4)">' +
                  s.secondaryCtaText + '</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    if (dots) {
      dots.innerHTML = slides.map(function (_, i) {
        return '<button type="button" class="hero-dot' + (i === 0 ? ' is-active' : '') + '" data-hero-dot="' + i + '" aria-label="Slayd ' + (i + 1) + '"></button>';
      }).join('');
    }

    document.querySelectorAll('[data-hero-dot]').forEach(function (btn) {
      btn.onclick = function () {
        goTo(parseInt(btn.getAttribute('data-hero-dot'), 10));
      };
    });
    document.querySelectorAll('[data-hero-prev]').forEach(function (btn) {
      btn.onclick = function () { goTo(slideIndex - 1); };
    });
    document.querySelectorAll('[data-hero-next]').forEach(function (btn) {
      btn.onclick = function () { goTo(slideIndex + 1); };
    });

    startAuto();
  }

  function goTo(index) {
    if (!slides.length) return;
    slideIndex = (index + slides.length) % slides.length;
    document.querySelectorAll('.hero-slide').forEach(function (el, i) {
      el.classList.toggle('is-active', i === slideIndex);
    });
    document.querySelectorAll('[data-hero-dot]').forEach(function (el, i) {
      el.classList.toggle('is-active', i === slideIndex);
    });
    startAuto();
  }

  function startAuto() {
    clearInterval(slideTimer);
    slideTimer = setInterval(function () { goTo(slideIndex + 1); }, 6000);
  }

  function renderCategories(categories) {
    const el = document.getElementById('homeCategories');
    if (!el) return;
    el.innerHTML = categories.slice(0, 8).map(function (c) {
      const cname = typeof NexoraI18n !== 'undefined' ? NexoraI18n.categoryName(c.id, c.name) : c.name;
      return (
        '<a class="cat-card" href="' + NexoraApp.url(c.link) + '" style="background:' + c.gradient + '">' +
          (c.image ? '<img class="cat-card-img" src="' + c.image + '" alt="' + cname + '" loading="lazy">' : '') +
          '<span class="cat-card-shade"></span>' +
          '<span class="cat-card-icon icon icon-lg" data-icon="' + c.icon + '"></span>' +
          '<div><div class="cat-card-title">' + cname + '</div>' +
          '<div class="cat-card-count">' + c.count + ' ' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('products_count') : 'məhsul') +
            '</div></div>' +
        '</a>'
      );
    }).join('');
  }

  function fillGrid(id, list) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = list.map(function (p) { return NexoraApp.productCardHTML(p); }).join('');
    NexoraApp.bindProductActions(el);
  }

  function renderProducts(products) {
    const newest = products.filter(function (p) { return p.isNew; });
    const pool = newest.length >= 8 ? newest : products.slice().sort(function () { return 0.5 - Math.random(); });
    fillGrid('homeProducts', pool.slice(0, 12));

    const best = products.slice().sort(function (a, b) {
      return (b.reviews || 0) * (b.rating || 0) - (a.reviews || 0) * (a.rating || 0);
    }).slice(0, 12);
    fillGrid('homeBestsellers', best);

    const deals = products.filter(function (p) { return p.oldPrice && p.oldPrice > p.price; }).slice(0, 12);
    fillGrid('homeDeals', deals.length ? deals : best.slice(0, 8));

    const ticker = document.getElementById('homeTicker');
    if (ticker) {
      const bits = products.filter(function (p) { return p.isNew || p.badge; }).slice(0, 16);
      const html = bits.map(function (p) {
        return '<span class="home-ticker-item"><strong>' + p.name + '</strong> · ' +
          NexoraApp.formatPrice(p.price, p.currency) + '</span>';
      }).join('');
      ticker.innerHTML = html + html;
    }
  }

  function renderCampaign(data) {
    const el = document.getElementById('homeCampaign');
    if (!el || !data.campaigns || !data.campaigns.length) return;
    const c = data.campaigns[0];
    el.innerHTML =
      '<div class="campaign-banner" style="background:' + c.gradient + '">' +
        (c.image ? '<img class="campaign-banner-img" src="' + c.image + '" alt="" aria-hidden="true">' : '') +
        '<span class="campaign-banner-shade"></span>' +
        '<div class="campaign-banner-content">' +
          '<p class="text-overline mb-2" style="color:rgba(255,255,255,.8)">' + c.subtitle + '</p>' +
          '<h2 class="heading-2 mb-2" style="color:#fff">' + c.title + '</h2>' +
          '<p style="color:rgba(255,255,255,.85);max-width:420px">' + c.description + '</p>' +
          '<a href="' + NexoraApp.url(c.link) + '" class="btn btn-secondary mt-4">' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('view_campaign') : 'Kampaniyaya bax') + '</a>' +
        '</div>' +
        '<div class="campaign-countdown" data-countdown="' + c.endDate + '"></div>' +
      '</div>';
    startCountdown(el.querySelector('[data-countdown]'));
  }

  function startCountdown(el) {
    if (!el) return;
    const end = new Date(el.getAttribute('data-countdown')).getTime();
    if (el._countdownTimer) clearInterval(el._countdownTimer);

    function labels() {
      if (typeof NexoraI18n === 'undefined') return ['Gün', 'Saat', 'Dəq', 'San'];
      return [NexoraI18n.t('day'), NexoraI18n.t('hour'), NexoraI18n.t('min'), NexoraI18n.t('sec')];
    }

    function tick() {
      const diff = Math.max(0, end - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const L = labels();
      el.innerHTML = [
        [L[0], d], [L[1], h], [L[2], m], [L[3], s]
      ].map(function (u) {
        return '<div class="countdown-unit"><span class="countdown-value">' +
          String(u[1]).padStart(2, '0') + '</span><span class="countdown-label">' + u[0] + '</span></div>';
      }).join('');
    }
    tick();
    el._countdownTimer = setInterval(tick, 1000);
  }

  function renderBrands(brands) {
    const el = document.getElementById('homeBrands');
    if (!el) return;
    el.innerHTML = brands.filter(function (b) { return b.featured !== false; }).slice(0, 6).map(function (b) {
      return '<a class="brand-tile brand-tile--media" href="' + NexoraApp.pageUrl('brands.html?brand=' + b.id) + '">' +
        (b.image ? '<img src="' + b.image + '" alt="' + b.name + '" loading="lazy">' : '') +
        '<span style="color:' + b.color + '">' + (b.logo || b.name) + '</span></a>';
    }).join('');
  }

  function renderNews(data) {
    const el = document.getElementById('homeNews');
    if (!el) return;
    const brandMap = {};
    (data.brands || []).forEach(function (b) { brandMap[b.id] = b.name; });
    const list = (data.articles || []).slice().sort(function (a, b) {
      return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
    }).slice(0, 3);
    if (!list.length) {
      el.innerHTML = '';
      return;
    }
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    el.innerHTML = list.map(function (a) {
      return '<a class="home-news-item" href="' + NexoraApp.pageUrl('news.html?id=' + encodeURIComponent(a.id)) + '">' +
        '<img src="' + esc(a.image) + '" alt="" loading="lazy">' +
        '<div><strong>' + esc(a.title) + '</strong>' +
          '<span>' + esc(brandMap[a.brand] || a.brand) + ' · ' + esc(String(a.publishedAt || '').slice(0, 10)) + '</span>' +
        '</div></a>';
    }).join('');
  }

  function renderFeatures(features) {
    const el = document.getElementById('homeFeatures');
    if (!el || !features) return;
    const map = {
      truck: ['free_ship', 'free_ship_desc'],
      shield: ['warranty', 'warranty_desc'],
      refresh: ['returns', 'returns_desc'],
      creditCard: ['installments', 'installments_desc'],
      'credit-card': ['installments', 'installments_desc']
    };
    el.innerHTML = features.map(function (f) {
      const keys = map[f.icon];
      const title = (keys && typeof NexoraI18n !== 'undefined') ? NexoraI18n.t(keys[0]) : f.title;
      const desc = (keys && typeof NexoraI18n !== 'undefined') ? NexoraI18n.t(keys[1]) : f.description;
      return (
        '<div class="feature-item">' +
          '<div class="feature-icon"><span class="icon icon-lg" data-icon="' + f.icon + '"></span></div>' +
          '<h3 class="feature-title">' + title + '</h3>' +
          '<p class="feature-desc">' + desc + '</p>' +
        '</div>'
      );
    }).join('');
  }

  async function safeLoad(label, fn, fallback) {
    try {
      return await fn();
    } catch (err) {
      console.warn('[home]', label, err);
      return fallback;
    }
  }

  async function init() {
    if (!document.getElementById('homeProducts')) return;
    document.body.classList.add('is-booting');

    // Load independently — one slow/failing request must not blank the whole page
    const hero = await safeLoad('hero', function () {
      return NexoraApp.fetchJSON('data/hero-slides.json');
    }, { slides: [] });
    renderHero(hero);
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();

    const categories = await safeLoad('categories', function () {
      return NexoraApp.loadCategories();
    }, []);
    renderCategories(categories);
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();

    // Home only needs a small slice — avoid pulling the full catalog at once
    const products = await safeLoad('products', async function () {
      try {
        if (typeof NexoraApi !== 'undefined') {
          if (NexoraApi.ensureApi) await NexoraApi.ensureApi();
          if (NexoraApi.getProducts) {
            const d = await NexoraApi.getProducts({ limit: 48 });
            if (d && d.products && d.products.length) return d.products;
          }
        }
      } catch (e) { /* fall through */ }
      return NexoraApp.loadProducts();
    }, []);
    if (products.length) {
      renderProducts(products);
    } else {
      ['homeProducts', 'homeBestsellers', 'homeDeals'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.innerHTML = '<p class="text-muted" style="grid-column:1/-1;padding:12px 0">Hal-hazırda məhsul yoxdur. Tezliklə yenilənəcək.</p>';
        }
      });
    }

    await new Promise(function (r) { setTimeout(r, 60); });

    const campaigns = await safeLoad('campaigns', function () {
      return NexoraApp.loadCampaigns();
    }, { campaigns: [], features: [] });
    renderCampaign(campaigns);
    renderFeatures(campaigns.features || []);

    await new Promise(function (r) { setTimeout(r, 60); });

    const brands = await safeLoad('brands', function () {
      return NexoraApp.loadBrands();
    }, []);
    renderBrands(brands);

    await new Promise(function (r) { setTimeout(r, 60); });

    const news = await safeLoad('news', function () {
      return NexoraApp.loadTechNews();
    }, { articles: [], brands: [] });
    renderNews(news);

    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
    document.body.classList.remove('is-booting');
    document.body.classList.add('is-ready');
    document.dispatchEvent(new CustomEvent('nexora:home-ready'));
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('nexora:lang-change', function () {
    if (!document.getElementById('homeProducts')) return;
    init();
    if (typeof NexoraI18n !== 'undefined') NexoraI18n.apply(document);
  });
})();
