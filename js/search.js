/**
 * NEXORA Smart Search — typo-tolerant (ayfon→iPhone, samung→Samsung)
 */
const NexoraSearch = (function () {
  'use strict';

  function tt(key, fallback) {
    return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(key) : (fallback || key);
  }

  /** Common AZ/RU/EN misspellings → canonical tokens */
  var ALIASES = {
    ayfon: 'iphone',
    aifon: 'iphone',
    ifone: 'iphone',
    iphon: 'iphone',
    iphonee: 'iphone',
    ayphone: 'iphone',
    eyfon: 'iphone',
    samung: 'samsung',
    samsong: 'samsung',
    samsug: 'samsung',
    samsing: 'samsung',
    samsungg: 'samsung',
    xiaomii: 'xiaomi',
    siomi: 'xiaomi',
    xiaom: 'xiaomi',
    redmii: 'redmi',
    huaweii: 'huawei',
    huavei: 'huawei',
    sony: 'sony',
    sonny: 'sony',
    noutbuk: 'laptop',
    notbuk: 'laptop',
    notebook: 'laptop',
    laptom: 'laptop',
    loptop: 'laptop',
    kompuyuter: 'komputer',
    komputer: 'computer',
    kompyuter: 'computer',
    televizor: 'tv',
    televizorlar: 'tv',
    telewizor: 'tv',
    qulaqliq: 'headphones',
    qulaqlıq: 'headphones',
    naushnik: 'headphones',
    airpod: 'airpods',
    erpods: 'airpods',
    erpod: 'airpods',
    playstation: 'playstation',
    pleystation: 'playstation',
    pleyistation: 'playstation',
    pleysteysn: 'playstation',
    ps5: 'playstation',
    ps4: 'playstation',
    xboxx: 'xbox',
    watches: 'watch',
    saat: 'watch',
    smartsaat: 'watch',
    'smart saat': 'watch',
    router: 'router',
    ruter: 'router',
    switch: 'switch',
    svitch: 'switch',
    monitor: 'monitor',
    monutor: 'monitor',
    klaviatura: 'keyboard',
    mouse: 'mouse',
    maus: 'mouse',
    mysh: 'mouse'
  };

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ə/g, 'e')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/[^a-z0-9+\s.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    a = String(a);
    b = String(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > 3) return 99;
    var prev = new Array(b.length + 1);
    var cur = new Array(b.length + 1);
    var i;
    var j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      var tmp = prev;
      prev = cur;
      cur = tmp;
    }
    return prev[b.length];
  }

  function maxEdit(len) {
    if (len <= 3) return 1;
    if (len <= 6) return 2;
    return 3;
  }

  function expandToken(token) {
    var t = normalize(token);
    if (!t) return [];
    var out = [t];
    if (ALIASES[t]) out.push(ALIASES[t]);
    // multi-word aliases already keyed without spaces mostly
    return out;
  }

  function expandQuery(query) {
    var nq = normalize(query);
    var tokens = nq.split(/\s+/).filter(Boolean);
    var expanded = [];
    var corrections = [];

    tokens.forEach(function (tok) {
      var variants = expandToken(tok);
      variants.forEach(function (v) {
        if (expanded.indexOf(v) === -1) expanded.push(v);
      });
      if (ALIASES[tok] && ALIASES[tok] !== tok) {
        corrections.push({ from: tok, to: ALIASES[tok] });
      }
    });

    // Whole-query alias (e.g. "smart saat")
    if (ALIASES[nq] && expanded.indexOf(ALIASES[nq]) === -1) {
      expanded.push(ALIASES[nq]);
      corrections.push({ from: nq, to: ALIASES[nq] });
    }

    return {
      raw: query,
      normalized: nq,
      tokens: tokens,
      expanded: expanded,
      corrections: corrections
    };
  }

  function fuzzyTokenScore(queryTok, targetTok) {
    if (!queryTok || !targetTok) return 0;
    if (queryTok === targetTok) return 40;
    if (targetTok.indexOf(queryTok) !== -1) return 28;
    if (queryTok.indexOf(targetTok) !== -1 && targetTok.length >= 3) return 18;

    // prefix soft match
    var pref = Math.min(queryTok.length, targetTok.length, 4);
    if (pref >= 3 && queryTok.slice(0, pref) === targetTok.slice(0, pref)) {
      return 14;
    }

    var dist = levenshtein(queryTok, targetTok);
    var allow = maxEdit(Math.min(queryTok.length, targetTok.length));
    if (dist <= allow) {
      return Math.max(6, 22 - dist * 5);
    }
    return 0;
  }

  function bestFuzzyAgainst(queryTok, haystackTokens) {
    var best = 0;
    for (var i = 0; i < haystackTokens.length; i++) {
      var s = fuzzyTokenScore(queryTok, haystackTokens[i]);
      if (s > best) best = s;
      if (best >= 40) break;
    }
    return best;
  }

  function tokenizeField() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var n = normalize(arguments[i]);
      if (!n) continue;
      n.split(/[\s\/+._-]+/).forEach(function (t) {
        if (t.length >= 2 && parts.indexOf(t) === -1) parts.push(t);
      });
    }
    return parts;
  }

  function scoreProduct(product, q) {
    var ctx = typeof q === 'object' && q.expanded ? q : expandQuery(q);
    if (!ctx.normalized) return 0;

    var name = normalize(product.name);
    var sku = normalize(product.sku);
    var brand = normalize(product.brand);
    var tags = (product.tags || []).map(normalize).join(' ');
    var sub = normalize(product.subcategory || '');
    var cat = normalize(product.category || '');
    var blob = [name, sku, brand, tags, sub, cat].join(' ');
    var fieldTokens = tokenizeField(product.name, product.brand, product.sku, (product.tags || []).join(' '), product.subcategory);

    var score = 0;
    var matchedVia = [];

    // Exact / substring on expanded tokens
    ctx.expanded.forEach(function (tok) {
      if (!tok) return;
      if (sku === tok) { score += 100; matchedVia.push(tok); }
      else if (sku.indexOf(tok) !== -1) { score += 55; matchedVia.push(tok); }
      if (brand === tok) { score += 70; matchedVia.push(tok); }
      else if (brand.indexOf(tok) !== -1) { score += 45; matchedVia.push(tok); }
      if (name.indexOf(tok) !== -1) { score += 40; matchedVia.push(tok); }
      if (tags.indexOf(tok) !== -1) { score += 22; matchedVia.push(tok); }
      if (sub.indexOf(tok) !== -1 || cat.indexOf(tok) !== -1) { score += 16; matchedVia.push(tok); }
    });

    // Fuzzy token match (typos not in alias table)
    ctx.tokens.forEach(function (tok) {
      if (tok.length < 3) return;
      var fuzzy = bestFuzzyAgainst(tok, fieldTokens);
      if (fuzzy > 0) {
        score += fuzzy;
        matchedVia.push(tok);
      }
      // Also fuzzy against expanded canonical forms already covered by substring;
      // fuzzy brand dictionary words
      ['iphone', 'samsung', 'xiaomi', 'huawei', 'laptop', 'airpods', 'playstation', 'sony', 'apple'].forEach(function (canon) {
        if (levenshtein(tok, canon) <= maxEdit(tok.length) && blob.indexOf(canon) !== -1) {
          score += 30;
          matchedVia.push(canon);
        }
      });
    });

    // Full-string fuzzy if still weak and query is one token
    if (score < 12 && ctx.tokens.length === 1 && ctx.normalized.length >= 4) {
      var brandDist = brand ? levenshtein(ctx.normalized, brand) : 99;
      if (brandDist <= maxEdit(ctx.normalized.length)) score += 35;
      var nameWords = name.split(/\s+/);
      for (var i = 0; i < nameWords.length; i++) {
        var d = levenshtein(ctx.normalized, nameWords[i]);
        if (d <= maxEdit(ctx.normalized.length)) {
          score += 28;
          break;
        }
      }
    }

    return score;
  }

  function suggestCorrection(query, products) {
    var ctx = expandQuery(query);
    if (ctx.corrections.length) {
      var to = ctx.corrections.map(function (c) { return c.to; });
      // Pretty labels
      var pretty = {
        iphone: 'iPhone',
        samsung: 'Samsung',
        xiaomi: 'Xiaomi',
        huawei: 'Huawei',
        laptop: 'Laptop',
        airpods: 'AirPods',
        playstation: 'PlayStation',
        headphones: 'Headphones',
        tv: 'TV',
        watch: 'Watch',
        computer: 'Computer',
        router: 'Router',
        switch: 'Switch',
        keyboard: 'Keyboard',
        mouse: 'Mouse',
        monitor: 'Monitor',
        sony: 'Sony',
        xbox: 'Xbox',
        redmi: 'Redmi',
        apple: 'Apple'
      };
      return to.map(function (t) { return pretty[t] || t; }).join(' ');
    }

    // Infer from top fuzzy brand hits
    var brands = {};
    (products || []).slice(0, 80).forEach(function (p) {
      var b = normalize(p.brand);
      if (b) brands[b] = p.brand;
    });
    var best = null;
    var bestDist = 99;
    ctx.tokens.forEach(function (tok) {
      if (tok.length < 3) return;
      Object.keys(brands).forEach(function (b) {
        var d = levenshtein(tok, b);
        if (d > 0 && d <= maxEdit(tok.length) && d < bestDist) {
          bestDist = d;
          best = brands[b];
        }
      });
    });
    return best;
  }

  async function searchDetailed(query, limit) {
    var ctx = expandQuery(query);
    var products = await NexoraApp.loadProducts();
    var scored = products
      .map(function (p) { return { product: p, score: scoreProduct(p, ctx) }; })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    var list = scored.map(function (x) { return x.product; });
    if (typeof limit === 'number') list = list.slice(0, limit);

    var suggestion = suggestCorrection(query, products);
    var showDidYouMean = false;
    if (suggestion) {
      var nSug = normalize(suggestion);
      var nQ = ctx.normalized;
      showDidYouMean = nSug !== nQ && nQ.indexOf(nSug) === -1;
      // Also show when alias fired
      if (ctx.corrections.length) showDidYouMean = true;
    }

    return {
      products: list,
      query: query,
      expanded: ctx.expanded,
      corrections: ctx.corrections,
      suggestion: suggestion,
      didYouMean: showDidYouMean ? suggestion : null,
      scores: scored.slice(0, typeof limit === 'number' ? limit : 20).map(function (x) {
        return { id: x.product.id, score: x.score };
      })
    };
  }

  async function search(query, limit) {
    var res = await searchDetailed(query, limit);
    return res.products;
  }

  async function renderPage() {
    var grid = document.getElementById('searchResults');
    var title = document.getElementById('searchTitle');
    var meta = document.getElementById('searchMeta');
    var input = document.getElementById('searchPageInput');
    var hint = document.getElementById('smartSearchHint');
    if (!grid) return;

    var q = NexoraApp.getQueryParam('q') || '';
    if (input) input.value = q;

    if (!q.trim()) {
      if (title) title.textContent = tt('search', 'Axtarış');
      if (meta) meta.textContent = tt('search_enter_query', 'Axtarış sorğusu daxil edin');
      if (hint) hint.hidden = true;
      grid.innerHTML = '<div class="empty-state"><p>' + tt('search_type_to_search', 'Axtarmaq üçün söz yazın') + '</p>' +
        '<p class="text-sm text-muted mt-2">' + tt('smart_search_hint', 'Smart Search: «ayfon» → iPhone, «samung» → Samsung') + '</p></div>';
      if (typeof NexoraI18n !== 'undefined') NexoraI18n.apply(document);
      return;
    }

    var detailed = await searchDetailed(q);
    var results = detailed.products;

    if (typeof NexoraApi !== 'undefined' && NexoraApi.trackAnalytics && q.trim().length >= 2) {
      NexoraApi.trackAnalytics({ type: 'search', query: q.trim() });
    }
    try {
      var local = NexoraApp.storageGet('nexora-search-stats', {});
      var key = q.trim().toLowerCase();
      if (key.length >= 2) {
        local[key] = (local[key] || 0) + 1;
        NexoraApp.storageSet('nexora-search-stats', local);
      }
    } catch (e) { /* ignore */ }

    if (title) title.textContent = tt('search_for', 'Nəticələr') + ': «' + q + '»';
    if (meta) {
      meta.textContent = results.length + ' ' + tt('products_found', 'məhsul tapıldı') +
        (detailed.didYouMean ? ' · Smart Search' : '');
    }

    if (hint) {
      if (detailed.didYouMean) {
        hint.hidden = false;
        hint.innerHTML =
          '<span class="smart-search-badge">🎯 Smart Search</span> ' +
          tt('did_you_mean', 'Bunu nəzərdə tuturdunuz:') + ' ' +
          '<a href="' + NexoraApp.pageUrl('search.html?q=' + encodeURIComponent(detailed.didYouMean)) + '"><strong>' +
          (typeof NexoraSecurity !== 'undefined' ? NexoraSecurity.escapeHtml(detailed.didYouMean) : detailed.didYouMean) +
          '</strong></a>' +
          ' <span class="text-muted">(' +
          (typeof NexoraSecurity !== 'undefined' ? NexoraSecurity.escapeHtml(q) : q) +
          ' → ' +
          (typeof NexoraSecurity !== 'undefined' ? NexoraSecurity.escapeHtml(detailed.didYouMean) : detailed.didYouMean) +
          ')</span>';
      } else {
        hint.hidden = true;
        hint.innerHTML = '';
      }
    }

    if (!results.length) {
      grid.innerHTML = '<div class="empty-state"><p>' + tt('no_results') + '</p>' +
        (detailed.didYouMean
          ? '<p class="mt-2">' + tt('did_you_mean', 'Bunu nəzərdə tuturdunuz:') +
            ' <a href="' + NexoraApp.pageUrl('search.html?q=' + encodeURIComponent(detailed.didYouMean)) + '"><strong>' +
            detailed.didYouMean + '</strong></a></p>'
          : '') +
        '<a class="btn btn-primary mt-4" href="' + NexoraApp.pageUrl('products.html') + '">' +
        tt('browse_products') + '</a></div>';
      return;
    }

    grid.innerHTML = results.map(function (p) { return NexoraApp.productCardHTML(p); }).join('');
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
    NexoraApp.bindProductActions(grid);
    if (typeof NexoraI18n !== 'undefined') NexoraI18n.apply(document);
  }

  return {
    search: search,
    searchDetailed: searchDetailed,
    scoreProduct: scoreProduct,
    renderPage: renderPage,
    normalize: normalize,
    expandQuery: expandQuery,
    ALIASES: ALIASES
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('searchResults')) {
    NexoraSearch.renderPage();
  }
});
window.addEventListener('nexora:lang-change', function () {
  if (document.getElementById('searchResults')) {
    NexoraSearch.renderPage();
  }
});
