/**
 * NEXORA Tech News — Apple, Samsung, NVIDIA, Intel, AMD, Sony
 */
(function () {
  'use strict';

  var BRAND_META = {};
  var articles = [];
  var activeBrand = 'all';
  var activeId = null;

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined'
      ? NexoraSecurity.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function shopHref(brand) {
    var b = BRAND_META[brand] || {};
    if (b.shopBrandId) return 'brands.html?brand=' + encodeURIComponent(b.shopBrandId);
    if (b.shopQuery) return 'search.html?q=' + encodeURIComponent(b.shopQuery);
    return 'products.html';
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('az-AZ', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      return iso;
    }
  }

  function sorted(list) {
    return list.slice().sort(function (a, b) {
      return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
    });
  }

  function filtered() {
    var list = sorted(articles);
    if (activeBrand && activeBrand !== 'all') {
      list = list.filter(function (a) { return a.brand === activeBrand; });
    }
    return list;
  }

  function renderChips() {
    var el = document.getElementById('newsBrandChips');
    if (!el) return;
    var brands = Object.keys(BRAND_META).map(function (id) { return BRAND_META[id]; });
    el.innerHTML =
      '<button type="button" class="news-chip' + (activeBrand === 'all' ? ' is-active' : '') +
        '" data-news-brand="all">Hamısı</button>' +
      brands.map(function (b) {
        return '<button type="button" class="news-chip' + (activeBrand === b.id ? ' is-active' : '') +
          '" data-news-brand="' + esc(b.id) + '" style="--news-brand:' + esc(b.color || '#111') + '">' +
          esc(b.name) + '</button>';
      }).join('');

    el.querySelectorAll('[data-news-brand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeBrand = btn.getAttribute('data-news-brand');
        activeId = null;
        history.replaceState(null, '', activeBrand === 'all' ? 'news.html' : ('news.html?brand=' + activeBrand));
        render();
      });
    });
  }

  function cardHTML(a, large) {
    var brand = BRAND_META[a.brand] || { name: a.brand, color: '#111' };
    var cls = 'news-card' + (large ? ' news-card--hero' : '');
    return (
      '<article class="' + cls + '" style="--news-brand:' + esc(brand.color || '#111') + '">' +
        '<a class="news-card-media" href="news.html?id=' + esc(a.id) + '" aria-label="' + esc(a.title) + '">' +
          '<img src="' + esc(a.image) + '" alt="" loading="lazy">' +
          '<span class="news-card-brand">' + esc(brand.name) + '</span>' +
        '</a>' +
        '<div class="news-card-body">' +
          '<div class="news-card-meta">' +
            '<time datetime="' + esc(a.publishedAt) + '">' + esc(formatDate(a.publishedAt)) + '</time>' +
            (a.source ? '<span>' + esc(a.source) + '</span>' : '') +
          '</div>' +
          '<h2 class="news-card-title"><a href="news.html?id=' + esc(a.id) + '">' + esc(a.title) + '</a></h2>' +
          '<p class="news-card-summary">' + esc(a.summary) + '</p>' +
          '<div class="news-card-actions">' +
            '<a class="btn btn-primary btn-sm" href="news.html?id=' + esc(a.id) + '">Oxu</a>' +
            '<a class="btn btn-outline btn-sm" href="' + shopHref(a.brand) + '">Mağazada bax</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderList() {
    var listRoot = document.getElementById('newsList');
    var detailRoot = document.getElementById('newsDetail');
    var relatedRoot = document.getElementById('newsRelated');
    if (!listRoot) return;

    if (detailRoot) detailRoot.hidden = true;
    listRoot.hidden = false;
    if (relatedRoot) relatedRoot.innerHTML = '';

    var list = filtered();
    var featured = list.filter(function (a) { return a.featured; })[0] || list[0];
    var rest = list.filter(function (a) { return !featured || a.id !== featured.id; });

    listRoot.innerHTML =
      (featured ? '<div class="news-hero-slot">' + cardHTML(featured, true) + '</div>' : '') +
      '<div class="news-grid">' +
        (rest.map(function (a) { return cardHTML(a, false); }).join('') ||
          '<p class="text-muted" style="grid-column:1/-1">Bu brend üzrə xəbər yoxdur.</p>') +
      '</div>';
  }

  async function renderDetail(article) {
    var listRoot = document.getElementById('newsList');
    var detailRoot = document.getElementById('newsDetail');
    var relatedRoot = document.getElementById('newsRelated');
    if (!detailRoot) return;

    if (listRoot) listRoot.hidden = true;
    detailRoot.hidden = false;

    var brand = BRAND_META[article.brand] || { name: article.brand, color: '#111' };
    var paragraphs = String(article.body || '').split(/\n\n+/).filter(Boolean);
    var tags = (article.tags || []).map(function (t) {
      return '<span class="news-tag">' + esc(t) + '</span>';
    }).join('');

    detailRoot.innerHTML =
      '<article class="news-article" style="--news-brand:' + esc(brand.color || '#111') + '">' +
        '<a class="btn btn-ghost btn-sm mb-4" href="news.html' +
          (activeBrand !== 'all' ? ('?brand=' + encodeURIComponent(activeBrand)) : '') +
          '">← Bütün xəbərlər</a>' +
        '<div class="news-article-kicker">' +
          '<span class="news-card-brand">' + esc(brand.name) + '</span>' +
          '<time datetime="' + esc(article.publishedAt) + '">' + esc(formatDate(article.publishedAt)) + '</time>' +
        '</div>' +
        '<h1 class="news-article-title">' + esc(article.title) + '</h1>' +
        '<p class="news-article-lead">' + esc(article.summary) + '</p>' +
        '<div class="news-article-media"><img src="' + esc(article.image) + '" alt=""></div>' +
        '<div class="news-article-body">' +
          paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '</div>' +
        '<div class="news-article-tags">' + tags + '</div>' +
        '<div class="news-article-cta">' +
          '<div><strong>' + esc(brand.name) + ' yenilikləri</strong>' +
            '<p class="text-sm text-muted mb-0">Məhsulları mağazada araşdırın və müqayisə edin.</p></div>' +
          '<div class="flex gap-2 flex-wrap">' +
            '<a class="btn btn-primary" href="' + shopHref(article.brand) + '">Mağazada bax</a>' +
            '<a class="btn btn-outline" href="compare.html">Müqayisə</a>' +
          '</div>' +
        '</div>' +
      '</article>';

    if (relatedRoot) {
      var related = sorted(articles)
        .filter(function (a) { return a.brand === article.brand && a.id !== article.id; })
        .slice(0, 3);
      relatedRoot.innerHTML = related.length
        ? '<h2 class="section-title mb-4">Eyni brendən digər xəbərlər</h2><div class="news-grid">' +
          related.map(function (a) { return cardHTML(a, false); }).join('') + '</div>'
        : '';
    }

    // Related products strip
    try {
      var products = await NexoraApp.loadProducts();
      var brandMeta = BRAND_META[article.brand] || {};
      var hits = products.filter(function (p) {
        if (brandMeta.shopBrandId && p.brandId === brandMeta.shopBrandId) return true;
        var q = String(brandMeta.shopQuery || brandMeta.name || '').toLowerCase();
        if (!q) return false;
        return (p.name + ' ' + (p.brand || '') + ' ' + JSON.stringify(p.specs || {})).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 4);
      var prodEl = document.getElementById('newsProducts');
      if (prodEl) {
        prodEl.innerHTML = hits.length
          ? '<h2 class="section-title mb-4">Kataloqdan seçimlər</h2><div class="product-grid">' +
            hits.map(function (p) { return NexoraApp.productCardHTML(p); }).join('') + '</div>'
          : '';
        if (hits.length) NexoraApp.bindProductActions(prodEl);
      }
    } catch (e) { /* optional */ }
  }

  function render() {
    renderChips();
    var list = filtered();
    if (activeId) {
      var article = articles.find(function (a) { return a.id === activeId; });
      if (article) {
        activeBrand = article.brand;
        renderChips();
        renderDetail(article);
        document.title = article.title + ' | NEXORA Xəbərlər';
        return;
      }
    }
    document.title = 'Texnologiya xəbərləri | NEXORA';
    renderList();
    var meta = document.getElementById('newsMeta');
    if (meta) {
      meta.textContent = list.length + ' xəbər' +
        (activeBrand !== 'all' && BRAND_META[activeBrand]
          ? ' · ' + BRAND_META[activeBrand].name
          : '');
    }
  }

  async function boot() {
    var data = await NexoraApp.loadTechNews();
    (data.brands || []).forEach(function (b) { BRAND_META[b.id] = b; });
    articles = data.articles || [];

    activeBrand = NexoraApp.getQueryParam('brand') || 'all';
    activeId = NexoraApp.getQueryParam('id') || null;
    if (activeBrand !== 'all' && !BRAND_META[activeBrand]) activeBrand = 'all';

    render();
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
