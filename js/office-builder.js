/**
 * NEXORA Office Builder — headcount → Laptop / Printer / Router / UPS / Monitor kit
 */
(function () {
  'use strict';

  var ROLES = [
    {
      id: 'laptop',
      label: 'Laptop',
      icon: '💻',
      qty: function (n) { return Math.max(1, n); },
      note: function (n) { return n + ' nəfər × 1 noutbuk'; }
    },
    {
      id: 'monitor',
      label: 'Monitor',
      icon: '🖥',
      qty: function (n) { return Math.max(1, n); },
      note: function (n) { return n + ' iş yeri × 1 monitor'; }
    },
    {
      id: 'printer',
      label: 'Printer',
      icon: '🖨',
      qty: function (n) { return Math.max(1, Math.ceil(n / 10)); },
      note: function (n) { return 'Hər 10 nəfərə 1 printer'; }
    },
    {
      id: 'router',
      label: 'Router',
      icon: '📡',
      qty: function (n) { return Math.max(1, Math.ceil(n / 25)); },
      note: function (n) { return 'Hər 25 nəfərə 1 router'; }
    },
    {
      id: 'ups',
      label: 'UPS',
      icon: '🔋',
      qty: function (n) { return Math.max(1, Math.ceil(n / 10)); },
      note: function (n) { return 'Kritik avadanlıq / klaster üçün'; }
    }
  ];

  var TIERS = {
    economy: { id: 'economy', label: 'Ekonom', hint: 'Büdcəyə uyğun' },
    standard: { id: 'standard', label: 'Standart', hint: 'Balanslı ofis' },
    premium: { id: 'premium', label: 'Premium', hint: 'Yüksək sinif' }
  };

  var state = {
    headcount: 20,
    tier: 'standard',
    prompt: '',
    products: [],
    pools: {},
    picks: {},
    qtyOverride: {},
    built: false
  };

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined'
      ? NexoraSecurity.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function clampHead(n) {
    if (!n || isNaN(n)) return 20;
    return Math.min(500, Math.max(1, Math.round(n)));
  }

  function parseHeadcount(text) {
    var t = String(text || '').toLowerCase()
      .replace(/ə/g, 'e').replace(/ı/g, 'i');
    var m = t.match(/(\d{1,4})\s*(nefer|nəfər|person|people|isci|işçi|staff|user|istifadeci)/i);
    if (m) return clampHead(Number(m[1]));
    m = t.match(/(\d{1,4})\s*(neferlik|nəfərlik|kisilik|kişilik)/i);
    if (m) return clampHead(Number(m[1]));
    m = t.match(/\b(\d{1,4})\b/);
    if (m && /ofis|office|is\s*yeri|iş\s*yeri|qurmaq|setup/i.test(t)) {
      return clampHead(Number(m[1]));
    }
    return null;
  }

  function parseTier(text) {
    var t = String(text || '').toLowerCase();
    if (/premium|yuksək|yüksək|\bpro\b|enterprise/.test(t)) return 'premium';
    if (/ekonom|ucuz|budget|büdcə|budce/.test(t)) return 'economy';
    return null;
  }

  function matchRole(p, roleId) {
    var name = String(p.name || '');
    var sub = String(p.subcategory || '');
    var tags = (p.tags || []).join(' ').toLowerCase();
    var blob = (name + ' ' + tags).toLowerCase();

    if (roleId === 'laptop') {
      return sub === 'laptops' || tags.indexOf('laptops') >= 0;
    }
    if (roleId === 'router') {
      return sub === 'routers' || tags.indexOf('routers') >= 0;
    }
    if (roleId === 'printer') {
      return sub === 'printers' || /printer|laserjet|mfp|inkjet|çap/.test(blob);
    }
    if (roleId === 'ups') {
      return sub === 'ups' || /\bups\b|smart-?ups|uninterrupt|back-ups/.test(blob);
    }
    if (roleId === 'monitor') {
      if (/studio\s*monitor|headphone/.test(blob)) return false;
      return /monitor/i.test(name) && (sub === 'tv' || p.category === 'electronics');
    }
    return false;
  }

  function officeScore(p, roleId, tier) {
    var s = 0;
    var name = String(p.name || '');
    var price = Number(p.price) || 0;
    if (typeof NexoraApp !== 'undefined' && NexoraApp.isInStock && !NexoraApp.isInStock(p)) s -= 50;

    if (roleId === 'laptop') {
      if (/thinkpad|latitude|elitebook|probook|vostro|business|office/i.test(name)) s += 8;
      if (/macbook|gaming|rog|predator|legion/i.test(name)) s -= 2;
      if (tier === 'premium' && price >= 1800) s += 4;
      if (tier === 'economy' && price <= 1400) s += 4;
      if (tier === 'standard' && price >= 900 && price <= 2200) s += 5;
    }
    if (roleId === 'monitor') {
      if (/office|business|24|27/i.test(name)) s += 4;
      if (/gaming|ultrawide|49/i.test(name)) s -= (tier === 'premium' ? 0 : 3);
      if (tier === 'economy' && price <= 200) s += 3;
      if (tier === 'premium' && price >= 250) s += 3;
    }
    if (roleId === 'printer') {
      if (/mfp|multifunction|imageclass|m428|mf455/i.test(name)) s += (tier === 'economy' ? 1 : 4);
      if (tier === 'economy' && price <= 350) s += 4;
      if (tier === 'standard' && price >= 350 && price <= 700) s += 4;
      if (tier === 'premium' && price >= 600) s += 4;
    }
    if (roleId === 'router') {
      if (/mikrotik|tp-?link|archer|rv340/i.test(name)) s += 3;
      if (/cisco isr|enterprise/i.test(name)) s += (tier === 'premium' ? 5 : -1);
      if (tier === 'economy' && price <= 250) s += 4;
      if (tier === 'standard' && price >= 150 && price <= 800) s += 4;
      if (tier === 'premium' && price >= 500) s += 4;
    }
    if (roleId === 'ups') {
      if (/1500|pro/i.test(name)) s += (tier === 'economy' ? 0 : 3);
      if (tier === 'economy' && price <= 200) s += 4;
      if (tier === 'standard' && price >= 150 && price <= 350) s += 4;
      if (tier === 'premium' && price >= 300) s += 4;
    }

    s += Math.min(3, (p.rating || 0));
    return s;
  }

  function pickPool(products, roleId, tier) {
    return products
      .filter(function (p) { return matchRole(p, roleId); })
      .map(function (p) { return { p: p, s: officeScore(p, roleId, tier) }; })
      .sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        return (a.p.price || 0) - (b.p.price || 0);
      })
      .map(function (x) { return x.p; })
      .slice(0, 8);
  }

  function pickForTier(pool, tier) {
    if (!pool.length) return null;
    if (tier === 'economy') {
      return pool.slice().sort(function (a, b) { return a.price - b.price; })[0];
    }
    if (tier === 'premium') {
      return pool.slice().sort(function (a, b) { return b.price - a.price; })[0];
    }
    var mid = pool.slice().sort(function (a, b) { return a.price - b.price; });
    return mid[Math.min(mid.length - 1, Math.floor(mid.length / 2))] || mid[0];
  }

  function buildKit() {
    var n = clampHead(state.headcount);
    state.headcount = n;
    var tier = state.tier || 'standard';
    state.pools = {};

    ROLES.forEach(function (role) {
      var pool = pickPool(state.products, role.id, tier);
      state.pools[role.id] = pool;
      var currentId = state.picks[role.id] && state.picks[role.id].id;
      var keep = currentId && pool.find(function (p) { return p.id === currentId; });
      state.picks[role.id] = keep || pickForTier(pool, tier);
    });
    state.built = true;
  }

  function lines() {
    return ROLES.map(function (role) {
      var product = state.picks[role.id];
      var qty = state.qtyOverride[role.id] != null
        ? state.qtyOverride[role.id]
        : role.qty(state.headcount);
      var unit = product ? Number(product.price) || 0 : 0;
      return {
        role: role,
        product: product,
        qty: qty,
        unit: unit,
        total: unit * qty,
        note: role.note(state.headcount),
        pool: state.pools[role.id] || []
      };
    });
  }

  function grandTotal(list) {
    return list.reduce(function (sum, L) { return sum + L.total; }, 0);
  }

  async function addAllToCart() {
    var list = lines().filter(function (L) { return L.product && L.qty > 0; });
    if (!list.length) {
      NexoraToast.error('Əlavə ediləcək məhsul yoxdur');
      return;
    }
    var btn = document.getElementById('obAddAll');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Əlavə edilir…';
    }
    try {
      for (var i = 0; i < list.length; i++) {
        await NexoraCart.add(list[i].product.id, list[i].qty);
      }
      NexoraToast.success(list.length + ' kateqoriya səbətə əlavə olundu');
      if (typeof NexoraApp !== 'undefined' && NexoraApp.updateBadges) NexoraApp.updateBadges();
    } catch (err) {
      NexoraToast.error(err.message || 'Səbətə əlavə alınmadı');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Hamısını səbətə at';
      }
    }
  }

  function render() {
    var root = document.getElementById('officeBuilder');
    if (!root || !state.built) return;

    var list = lines();
    var total = grandTotal(list);
    var tierMeta = TIERS[state.tier] || TIERS.standard;

    var rows = list.map(function (L) {
      var p = L.product;
      if (!p) {
        return '<div class="ob-row is-missing">' +
          '<div class="ob-role"><span class="ob-role-icon">' + L.role.icon + '</span>' +
          '<div><strong>' + esc(L.role.label) + '</strong>' +
          '<div class="text-sm text-muted">' + esc(L.note) + '</div></div></div>' +
          '<div class="text-muted">Kataloqda uyğun məhsul yoxdur</div></div>';
      }
      var opts = L.pool.map(function (opt) {
        return '<option value="' + esc(opt.id) + '"' +
          (opt.id === p.id ? ' selected' : '') + '>' +
          esc(opt.name) + ' — ' + NexoraApp.formatPrice(opt.price, opt.currency) +
          '</option>';
      }).join('');

      var thumb = NexoraApp.productThumbHTML(p, 'ob-thumb');
      return '<div class="ob-row" data-role="' + esc(L.role.id) + '">' +
        '<div class="ob-role">' +
          '<span class="ob-role-icon" aria-hidden="true">' + L.role.icon + '</span>' +
          '<div>' +
            '<strong>' + esc(L.role.label) + '</strong>' +
            '<div class="text-sm text-muted">' + esc(L.note) + ' · ' + esc(L.qty) + ' ədəd</div>' +
          '</div>' +
        '</div>' +
        '<div class="ob-product">' +
          '<a class="ob-product-link" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
            thumb +
            '<span class="ob-product-name">' + esc(p.name) + '</span>' +
          '</a>' +
          '<label class="ob-swap text-sm">' +
            '<span class="text-muted">Alternativ</span>' +
            '<select class="input input-sm" data-ob-swap="' + esc(L.role.id) + '">' + opts + '</select>' +
          '</label>' +
        '</div>' +
        '<div class="ob-qty">' +
          '<label class="text-sm text-muted">Ədəd</label>' +
          '<input type="number" class="input input-sm" min="1" max="500" data-ob-qty="' +
            esc(L.role.id) + '" value="' + esc(L.qty) + '">' +
        '</div>' +
        '<div class="ob-line-price">' +
          '<div class="text-sm text-muted">' + NexoraApp.formatPrice(L.unit) + ' × ' + esc(L.qty) + '</div>' +
          '<strong class="price">' + NexoraApp.formatPrice(L.total) + '</strong>' +
        '</div>' +
      '</div>';
    }).join('');

    var summaryBits = list.map(function (L) {
      return '<li><span>' + L.role.icon + ' ' + esc(L.role.label) + '</span>' +
        '<strong>' + esc(L.qty) + ' × ' + NexoraApp.formatPrice(L.unit) + '</strong></li>';
    }).join('');

    root.innerHTML =
      '<div class="ob-result-head">' +
        '<div>' +
          '<h2 class="heading-3 mb-1">' + esc(state.headcount) + ' nəfərlik ofis paketi</h2>' +
          '<p class="text-muted mb-0">' + esc(tierMeta.label) + ' · ' + esc(tierMeta.hint) +
            ' — Laptop, Monitor, Printer, Router, UPS</p>' +
        '</div>' +
        '<div class="ob-total-box">' +
          '<div class="text-sm text-muted">Ümumi məbləğ</div>' +
          '<div class="ob-total-price">' + NexoraApp.formatPrice(total) + '</div>' +
          '<div class="text-sm text-muted">~ ' +
            NexoraApp.formatPrice(Math.round(total / Math.max(1, state.headcount))) +
          ' / nəfər</div>' +
        '</div>' +
      '</div>' +
      '<div class="ob-rows">' + rows + '</div>' +
      '<div class="ob-footer">' +
        '<ul class="ob-summary">' + summaryBits + '</ul>' +
        '<div class="ob-actions">' +
          '<button type="button" class="btn btn-primary" id="obAddAll">Hamısını səbətə at</button>' +
          '<button type="button" class="btn btn-outline" id="obPdfOffer">PDF təklif</button>' +
          '<a class="btn btn-ghost" href="cart.html">Səbətə keç</a>' +
          '<a class="btn btn-ghost" href="business.html">Business Panel</a>' +
        '</div>' +
      '</div>';

    root.querySelectorAll('[data-ob-swap]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var role = sel.getAttribute('data-ob-swap');
        var pool = state.pools[role] || [];
        var next = pool.find(function (p) { return p.id === sel.value; });
        if (next) {
          state.picks[role] = next;
          render();
        }
      });
    });

    root.querySelectorAll('[data-ob-qty]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var roleId = inp.getAttribute('data-ob-qty');
        state.qtyOverride[roleId] = Math.min(500, Math.max(1, Number(inp.value) || 1));
        render();
      });
    });

    var addBtn = document.getElementById('obAddAll');
    if (addBtn) addBtn.addEventListener('click', addAllToCart);
    var pdfBtn = document.getElementById('obPdfOffer');
    if (pdfBtn) pdfBtn.addEventListener('click', exportPdfOffer);
  }

  function exportPdfOffer() {
    var list = lines().filter(function (L) { return L.product && L.qty > 0; });
    if (!list.length) {
      NexoraToast.error('Təklif üçün məhsul yoxdur');
      return;
    }
    var draft = {
      source: 'office-builder',
      title: state.headcount + ' nəfərlik ofis paketi',
      notes: state.prompt || '',
      items: list.map(function (L) {
        return {
          productId: L.product.id,
          qty: L.qty,
          name: L.product.name,
          sku: L.product.sku,
          unitPrice: L.unit
        };
      })
    };
    try {
      sessionStorage.setItem('nexora-offer-draft', JSON.stringify(draft));
    } catch (e) { /* ignore */ }
    window.location.href = 'offer-generator.html?from=office';
  }

  function syncForm() {
    var headEl = document.getElementById('obHeadcount');
    var tierEl = document.getElementById('obTier');
    var promptEl = document.getElementById('obPrompt');
    if (headEl) headEl.value = String(state.headcount);
    if (tierEl) tierEl.value = state.tier;
    if (promptEl && state.prompt) promptEl.value = state.prompt;
  }

  function runFromForm() {
    var promptEl = document.getElementById('obPrompt');
    var headEl = document.getElementById('obHeadcount');
    var tierEl = document.getElementById('obTier');
    var text = (promptEl && promptEl.value) || '';
    state.prompt = text;

    var parsedN = parseHeadcount(text);
    var parsedTier = parseTier(text);
    if (parsedN) state.headcount = parsedN;
    else if (headEl) state.headcount = clampHead(Number(headEl.value) || 20);
    if (parsedTier) state.tier = parsedTier;
    else if (tierEl) state.tier = tierEl.value || 'standard';

    state.qtyOverride = {};
    syncForm();
    buildKit();
    render();

    var out = document.getElementById('officeBuilder');
    if (out) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!document.getElementById('officeBuilderForm')) return;

    try {
      state.products = await NexoraApp.loadProducts();
    } catch (e) {
      state.products = [];
    }

    document.getElementById('officeBuilderForm').addEventListener('submit', function (e) {
      e.preventDefault();
      runFromForm();
    });

    document.querySelectorAll('[data-ob-suggest]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var promptEl = document.getElementById('obPrompt');
        if (promptEl) promptEl.value = btn.getAttribute('data-ob-suggest') || '';
        runFromForm();
      });
    });

    var headEl = document.getElementById('obHeadcount');
    var tierEl = document.getElementById('obTier');
    if (headEl) {
      headEl.addEventListener('change', function () {
        state.headcount = clampHead(Number(headEl.value) || 20);
        state.qtyOverride = {};
        if (state.built) {
          buildKit();
          render();
        }
      });
    }
    if (tierEl) {
      tierEl.addEventListener('change', function () {
        state.tier = tierEl.value || 'standard';
        state.picks = {};
        if (state.built) {
          buildKit();
          render();
        }
      });
    }

    var promptEl = document.getElementById('obPrompt');
    if (promptEl && !promptEl.value) {
      promptEl.value = '20 nəfərlik ofis qurmaq istəyirəm.';
    }
    runFromForm();
  });
})();
