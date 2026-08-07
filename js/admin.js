/**
 * NEXORA Admin CMS — API-first panel with localStorage fallback
 */
(function () {
  'use strict';

  var VIEWS = [
    'dashboard', 'analytics', 'products', 'inventory', 'orders', 'coupons', 'users', 'business',
    'categories', 'brands', 'campaigns', 'hero', 'faq', 'site', 'payments', 'referrals', 'livechat'
  ];

  var PAGE_TITLES = {
    dashboard: { title: 'Dashboard', sub: 'Ümumi baxış və statistika' },
    analytics: { title: 'Analytics Dashboard', sub: 'Baxış, satış, səbət, axtarış və satılmayanlar' },
    products: { title: 'Məhsullar', sub: 'Kataloq idarəetməsi' },
    inventory: { title: 'Stok', sub: 'İnventar və stok səviyyələri' },
    orders: { title: 'Sifarişlər', sub: 'Sifariş statusları və detallar' },
    coupons: { title: 'Kuponlar', sub: 'Endirim kodları' },
    users: { title: 'İstifadəçilər', sub: 'Rollar və hesablar' },
    business: { title: 'Business / B2B', sub: 'Şirkətlər, təkliflər, müqavilələr, Excel & PDF' },
    categories: { title: 'Kateqoriyalar', sub: 'Kateqoriya strukturu' },
    brands: { title: 'Brendlər', sub: 'Brend kataloqu' },
    campaigns: { title: 'Kampaniyalar', sub: 'Promo və flash satışlar' },
    hero: { title: 'Hero / Banner', sub: 'Ana səhifə slaydları' },
    faq: { title: 'FAQ', sub: 'Tez-tez verilən suallar' },
    site: { title: 'Sayt ayarları', sub: 'Logo, nav, footer, əlaqə' },
    payments: { title: 'Ödəniş', sub: 'Kart, köçürmə, merchant ayarları' },
    referrals: { title: 'Dost kodu', sub: 'Referral proqramı və bonuslar' },
    livechat: { title: 'Live Chat', sub: 'Müştəri mesajları və cavablar' }
  };

  var CMS_FILES = {
    brands: 'data/brands.json',
    faq: 'data/faq.json',
    hero: 'data/hero-slides.json',
    campaigns: 'data/campaigns.json',
    categories: 'data/categories.json',
    coupons: 'data/coupons.json'
  };

  var ORDER_API = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  var ORDER_AZ_API = ['Qəbul edildi', 'Hazırlanır', 'Kuryerdədir', 'Çatdırıldı', 'Ləğv'];
  var ORDER_AZ_LOCAL = ['Qəbul edildi', 'Hazırlanır', 'Kuryerdədir', 'Çatdırıldı', 'Ləğv'];
  var LEGACY_TO_API = {
    'Təsdiqləndi': 'pending', 'Hazırlanır': 'paid', 'Göndərildi': 'shipped',
    'Çatdırıldı': 'delivered', 'Ləğv': 'cancelled',
    'Gözləmədə': 'pending', 'Ödənildi': 'paid'
  };

  var chatState = { threadId: '', poll: null, lastId: '' };

  var state = {
    view: 'dashboard',
    apiLive: false,
    currentUser: null,
    products: { page: 1, pageSize: 25, search: '', category: '' },
    inventory: { lowOnly: false, search: '' },
    orders: { search: '' },
    coupons: { search: '' },
    users: { search: '' },
    business: { tab: 'overview' }
  };

  var BIZ_QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
  var BIZ_CONTRACT_STATUSES = ['draft', 'sent', 'signed', 'active', 'cancelled'];

  function esc(s) {
    if (typeof NexoraSecurity !== 'undefined' && NexoraSecurity.escapeHtml) {
      return NexoraSecurity.escapeHtml(s);
    }
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(n, cur) {
    return NexoraApp.formatPrice(n, cur);
  }

  function showGate(show) {
    var gate = document.getElementById('adminGate');
    var app = document.getElementById('adminApp');
    if (gate) {
      gate.hidden = !show;
      gate.style.display = show ? '' : 'none';
    }
    if (app) {
      app.hidden = show;
      app.style.display = show ? 'none' : '';
    }
  }

  function openDrawer(title, bodyHtml, footHtml) {
    var drawer = document.getElementById('adminDrawer');
    var bg = document.getElementById('adminDrawerBg');
    document.getElementById('adminDrawerTitle').textContent = title || 'Redaktə';
    document.getElementById('adminDrawerBody').innerHTML = bodyHtml || '';
    document.getElementById('adminDrawerFoot').innerHTML = footHtml || '';
    if (drawer) drawer.classList.add('is-open');
    if (bg) bg.classList.add('is-open');
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
  }

  function closeDrawer() {
    var drawer = document.getElementById('adminDrawer');
    var bg = document.getElementById('adminDrawerBg');
    if (drawer) drawer.classList.remove('is-open');
    if (bg) bg.classList.remove('is-open');
  }

  function setTopbar(title, sub) {
    var t = document.getElementById('adminTopTitle');
    var s = document.getElementById('adminTopSub');
    if (t) t.textContent = title || '';
    if (s) s.textContent = sub || '';
  }

  function brandIdFrom(name) {
    if (typeof NexoraSearch !== 'undefined' && NexoraSearch.normalize) {
      return NexoraSearch.normalize(name).replace(/\s+/g, '');
    }
    return String(name || '').toLowerCase().replace(/\s+/g, '');
  }

  function orderToApi(status) {
    if (ORDER_API.indexOf(status) !== -1) return status;
    return LEGACY_TO_API[status] || 'pending';
  }

  function orderDisplay(status) {
    if (!state.apiLive) {
      if (ORDER_AZ_LOCAL.indexOf(status) !== -1) return status;
      var i = ORDER_API.indexOf(status);
      return i >= 0 ? ORDER_AZ_LOCAL[i] : status;
    }
    var idx = ORDER_API.indexOf(status);
    if (idx >= 0) return ORDER_AZ_API[idx];
    if (ORDER_AZ_LOCAL.indexOf(status) !== -1) return status;
    return status;
  }

  function orderStatusOptions(current) {
    var labels = state.apiLive ? ORDER_AZ_API : ORDER_AZ_LOCAL;
    var values = state.apiLive ? ORDER_API : ORDER_AZ_LOCAL;
    return values.map(function (v, i) {
      var sel = (current === v || orderToApi(current) === v || orderDisplay(current) === labels[i]) ? ' selected' : '';
      return '<option value="' + esc(v) + '"' + sel + '>' + esc(labels[i]) + '</option>';
    }).join('');
  }

  function confirmAction(opts) {
    if (typeof NexoraModal !== 'undefined' && NexoraModal.confirm) {
      NexoraModal.confirm(opts);
    } else if (window.confirm(opts.message || opts.title || 'Davam?')) {
      if (opts.onConfirm) opts.onConfirm();
    }
  }

  async function requireAdmin() {
    state.apiLive = await detectApi();
    if (state.apiLive && typeof NexoraApi !== 'undefined' && NexoraApi.getToken()) {
      try {
        var me = await NexoraApi.me();
        if (me && me.user && me.user.role === 'admin') {
          state.currentUser = me.user;
          showGate(false);
          updateMetaPills();
          return true;
        }
      } catch (e) { /* local fallback */ }
    }
    try {
      var session = await NexoraAccount.getSession();
      if (session && session.role === 'admin') {
        state.currentUser = session;
        showGate(false);
        updateMetaPills();
        return true;
      }
    } catch (e) { /* gate */ }
    showGate(true);
    return false;
  }

  async function detectApi() {
    if (typeof NexoraApi === 'undefined') return false;
    try {
      var h = await NexoraApi.health();
      return !!(h && h.ok);
    } catch (e) {
      return false;
    }
  }

  function updateMetaPills() {
    var apiPill = document.getElementById('adminApiPill');
    var userPill = document.getElementById('adminUserPill');
    if (apiPill) {
      apiPill.textContent = state.apiLive ? 'API canlı' : 'Offline (local)';
      apiPill.classList.toggle('is-live', state.apiLive);
      apiPill.classList.toggle('is-offline', !state.apiLive);
    }
    if (userPill && state.currentUser) {
      userPill.textContent = state.currentUser.name || state.currentUser.email || 'Admin';
    }
  }

  async function getAllProducts() {
    if (state.apiLive) {
      var res = await NexoraApi.getProducts({ limit: 500 });
      return res.products || [];
    }
    return NexoraApp.loadProducts();
  }

  async function getProducts() {
    var list = await getAllProducts();
    if (!state.apiLive) {
      var q = state.products.search.toLowerCase();
      var cat = state.products.category;
      list = list.filter(function (p) {
        if (cat && p.category !== cat) return false;
        if (!q) return true;
        var hay = [p.name, p.sku, p.brand, p.description].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    } else if (state.products.search || state.products.category) {
      var qs = { limit: 500 };
      if (state.products.search) qs.q = state.products.search;
      if (state.products.category) qs.category = state.products.category;
      var filtered = await NexoraApi.getProducts(qs);
      list = filtered.products || [];
    }
    return list;
  }

  async function saveProduct(p) {
    if (state.apiLive) {
      if (!p.id) p.id = 'p' + Date.now();
      p.brandId = p.brandId || brandIdFrom(p.brand);
      p.inStock = (p.stock || 0) > 0;
      var isNew = !!p._isNew;
      var body = Object.assign({}, p);
      delete body._isNew;
      if (isNew) body._isNew = true;
      var saved = await NexoraApi.saveProduct(body);
      return saved.product || saved;
    }
    var list = await NexoraApp.loadProducts();
    var idx = list.findIndex(function (x) { return x.id === p.id; });
    if (idx >= 0) list[idx] = p;
    else list.unshift(p);
    NexoraApp.storageSet('nexora-products', list);
    return p;
  }

  async function deleteProduct(id) {
    if (state.apiLive) {
      await NexoraApi.deleteProduct(id);
      return;
    }
    var list = (await NexoraApp.loadProducts()).filter(function (p) { return p.id !== id; });
    NexoraApp.storageSet('nexora-products', list);
  }

  async function getOrders() {
    if (state.apiLive) {
      var res = await NexoraApi.getOrders();
      return res.orders || [];
    }
    return NexoraAccount.getOrders();
  }

  async function setOrderStatus(id, status) {
    var apiStatus = state.apiLive ? orderToApi(status) : status;
    if (state.apiLive) {
      await NexoraApi.setOrderStatus(id, apiStatus);
      return;
    }
    var orders = NexoraAccount.getOrders();
    var o = orders.find(function (x) { return x.id === id; });
    if (o) {
      o.status = status;
      NexoraApp.storageSet('nexora-orders', orders);
    }
  }

  async function getUsers() {
    if (state.apiLive) {
      var res = await NexoraApi.getUsers();
      return res.users || [];
    }
    await NexoraAccount.seedUsers();
    return NexoraAccount.getUsers();
  }

  async function setUserRole(id, role, adminPassword) {
    if (state.apiLive) {
      await NexoraApi.setUserRole(id, role);
      return;
    }
    await NexoraAccount.setUserRole(id, role, adminPassword);
  }

  async function deleteUser(id) {
    if (state.apiLive) {
      await NexoraApi.deleteUser(id);
      return;
    }
    var users = await getUsers();
    NexoraApp.storageSet('nexora-users', users.filter(function (u) { return u.id !== id; }));
  }

  async function getCms(key) {
    if (key === 'site') {
      if (state.apiLive) {
        try {
          var siteRes = await NexoraApi.getCms('site');
          return siteRes.data || siteRes;
        } catch (e) { /* fallback */ }
      }
      return NexoraApp.loadSiteSettings();
    }
    if (state.apiLive) {
      var res = await NexoraApi.getCms(key);
      return res.data || res;
    }
    var storageKey = 'nexora-cms-' + key;
    var override = NexoraApp.storageGet(storageKey, null);
    if (override) return override;
    if (key === 'campaigns') {
      var camp = NexoraApp.storageGet('nexora-campaigns', null);
      if (camp) return camp;
    }
    return NexoraApp.fetchJSON(CMS_FILES[key]);
  }

  async function saveCms(key, data) {
    if (state.apiLive) {
      await NexoraApi.saveCms(key, data);
    }
    if (key === 'site') {
      NexoraApp.saveSiteSettings(data);
      return data;
    }
    NexoraApp.storageSet('nexora-cms-' + key, data);
    if (key === 'campaigns') NexoraApp.storageSet('nexora-campaigns', data);
    return data;
  }

  function paginate(list, page, pageSize) {
    var total = list.length;
    var pages = Math.max(1, Math.ceil(total / pageSize));
    var p = Math.min(Math.max(1, page), pages);
    var start = (p - 1) * pageSize;
    return { items: list.slice(start, start + pageSize), page: p, pages: pages, total: total };
  }

  function paginationHtml(pg, attr) {
    if (pg.pages <= 1) return '';
    var html = '<div class="admin-toolbar" style="margin-top:12px">';
    html += '<span class="text-sm text-muted">' + pg.total + ' nəticə · səhifə ' + pg.page + '/' + pg.pages + '</span>';
    html += '<div class="flex gap-2" style="margin-left:auto">';
    if (pg.page > 1) {
      html += '<button type="button" class="btn btn-outline btn-sm" data-' + attr + '-page="' + (pg.page - 1) + '">Əvvəl</button>';
    }
    if (pg.page < pg.pages) {
      html += '<button type="button" class="btn btn-outline btn-sm" data-' + attr + '-page="' + (pg.page + 1) + '">Sonra</button>';
    }
    html += '</div></div>';
    return html;
  }

  function bindPagination(attr, onPage) {
    document.querySelectorAll('[data-' + attr + '-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onPage(parseInt(btn.getAttribute('data-' + attr + '-page'), 10));
      });
    });
  }

  function specsEditorHtml(specs) {
    var rows = '';
    var obj = specs && typeof specs === 'object' ? specs : {};
    Object.keys(obj).forEach(function (k) {
      rows += '<div class="spec-row" data-spec-row>' +
        '<input class="input" data-spec-key placeholder="Açar" value="' + esc(k) + '">' +
        '<input class="input" data-spec-val placeholder="Dəyər" value="' + esc(obj[k]) + '">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-spec-rm>Sil</button></div>';
    });
    return '<div class="admin-specs-editor" id="specsEditor">' + rows +
      '</div><button type="button" class="btn btn-outline btn-sm mt-2" id="specsAddRow">+ Xüsusiyyət</button>';
  }

  function readSpecsFromEditor() {
    var specs = {};
    document.querySelectorAll('#specsEditor [data-spec-row]').forEach(function (row) {
      var k = row.querySelector('[data-spec-key]').value.trim();
      var v = row.querySelector('[data-spec-val]').value.trim();
      if (k) specs[k] = v;
    });
    return specs;
  }

  function bindSpecsEditor() {
    var add = document.getElementById('specsAddRow');
    if (add) {
      add.addEventListener('click', function () {
        document.getElementById('specsEditor').insertAdjacentHTML('beforeend',
          '<div class="spec-row" data-spec-row>' +
            '<input class="input" data-spec-key placeholder="Açar">' +
            '<input class="input" data-spec-val placeholder="Dəyər">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-spec-rm>Sil</button></div>');
        bindSpecsRemove();
      });
    }
    bindSpecsRemove();
  }

  function bindSpecsRemove() {
    document.querySelectorAll('[data-spec-rm]').forEach(function (btn) {
      btn.onclick = function () {
        var row = btn.closest('[data-spec-row]');
        if (row) row.remove();
      };
    });
  }

  function analyticsRowHtml(item, metricLabel) {
    var img = item.image ? NexoraApp.resolveMediaUrl(item.image) : '';
    var maxHint = item._max || item.count || 1;
    var pct = Math.max(4, Math.round((item.count / maxHint) * 100));
    return '<div class="analytics-row">' +
      '<div class="analytics-rank">' + esc(item.rank || '') + '</div>' +
      (img ? '<img class="admin-thumb" src="' + esc(img) + '" alt="">' : '<div class="admin-thumb analytics-thumb-empty"></div>') +
      '<div class="analytics-meta">' +
        '<strong>' + esc(item.name || item.query || '—') + '</strong>' +
        (item.brand ? '<div class="text-xs text-muted">' + esc(item.brand) + '</div>' : '') +
        '<div class="analytics-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      '</div>' +
      '<div class="analytics-count"><strong>' + esc(item.count) + '</strong>' +
        '<span>' + esc(metricLabel) + '</span></div>' +
    '</div>';
  }

  function analyticsListHtml(items, metricLabel, emptyText) {
    if (!items || !items.length) return '<p class="admin-empty">' + esc(emptyText) + '</p>';
    var max = items.reduce(function (m, x) { return Math.max(m, x.count || 0); }, 1);
    return items.map(function (item) {
      return analyticsRowHtml(Object.assign({}, item, { _max: max }), metricLabel);
    }).join('');
  }

  async function loadAnalyticsData() {
    if (state.apiLive && typeof NexoraApi !== 'undefined' && NexoraApi.getToken()) {
      try {
        return await NexoraApi.analyticsDashboard({ limit: 10, unsoldLimit: 25 });
      } catch (e) { /* fall through */ }
    }
    // Offline fallback from localStorage + orders
    var products = await getAllProducts();
    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });
    var views = (typeof NexoraSmart !== 'undefined' && NexoraSmart.getViewStats)
      ? NexoraSmart.getViewStats() : NexoraApp.storageGet('nexora-view-stats', {});
    var carts = NexoraApp.storageGet('nexora-cart-stats', {});
    var searches = NexoraApp.storageGet('nexora-search-stats', {});
    var orders = await getOrders();
    var soldMap = {};
    orders.forEach(function (o) {
      if (o.status === 'cancelled' || o.status === 'Ləğv') return;
      (o.items || []).forEach(function (i) {
        var id = i.productId || i.id;
        if (!id) return;
        soldMap[id] = (soldMap[id] || 0) + (i.qty || 1);
      });
    });
    function rankMap(map, limit) {
      return Object.keys(map).map(function (id) {
        var p = byId[id] || {};
        return {
          productId: id,
          name: p.name || id,
          brand: p.brand || '',
          image: p.image || '',
          count: map[id]
        };
      }).sort(function (a, b) { return b.count - a.count; })
        .slice(0, limit)
        .map(function (r, i) { return Object.assign({ rank: i + 1 }, r); });
    }
    var soldIds = new Set(Object.keys(soldMap));
    var unsold = products.filter(function (p) { return !soldIds.has(p.id); }).slice(0, 25).map(function (p) {
      return {
        productId: p.id,
        name: p.name,
        brand: p.brand || '',
        image: p.image || '',
        price: p.price,
        stock: p.stock || 0,
        views: views[p.id] || 0,
        carts: carts[p.id] || 0
      };
    });
    var topSearched = Object.keys(searches).map(function (q) {
      return { query: q, count: searches[q] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10)
      .map(function (r, i) { return Object.assign({ rank: i + 1 }, r); });

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        products: products.length,
        views: Object.keys(views).reduce(function (s, k) { return s + views[k]; }, 0),
        carts: Object.keys(carts).reduce(function (s, k) { return s + carts[k]; }, 0),
        searches: Object.keys(searches).reduce(function (s, k) { return s + searches[k]; }, 0),
        unsold: unsold.length,
        orders: orders.length
      },
      topViewed: rankMap(views, 10),
      topSold: rankMap(soldMap, 10),
      topCarted: rankMap(carts, 10),
      topSearched: topSearched,
      unsold: unsold
    };
  }

  async function renderAnalytics() {
    var data = await loadAnalyticsData();
    var t = data.totals || {};
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head">' +
        '<div><h1>📈 Analytics Dashboard</h1>' +
          '<p>Ən çox baxılan, satılan, səbətə atılan, axtarılan və satılmayan məhsullar</p></div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="analyticsRefresh">Yenilə</button>' +
      '</div>' +
      '<div class="admin-stats">' +
        '<div class="admin-stat"><div class="admin-stat-value">' + esc(t.views || 0) + '</div><div class="admin-stat-label">Baxış</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value">' + esc(t.carts || 0) + '</div><div class="admin-stat-label">Səbətə atılma</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value">' + esc(t.searches || 0) + '</div><div class="admin-stat-label">Axtarış</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value">' + esc(t.orders || 0) + '</div><div class="admin-stat-label">Sifariş</div></div>' +
        '<div class="admin-stat is-accent"><div class="admin-stat-value">' + esc(t.unsold || 0) + '</div><div class="admin-stat-label">Satılmayan (nümunə)</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value"><span class="admin-status ' +
          (state.apiLive ? 'is-ok' : 'is-warn') + '">' + (state.apiLive ? 'API' : 'Lokal') + '</span></div>' +
          '<div class="admin-stat-label">Mənbə</div></div>' +
      '</div>' +
      '<div class="analytics-grid">' +
        '<div class="admin-card"><div class="admin-card-head"><h3>👁 Ən çox baxılan</h3></div>' +
          '<div class="admin-card-body">' + analyticsListHtml(data.topViewed, 'baxış', 'Baxış yoxdur') + '</div></div>' +
        '<div class="admin-card"><div class="admin-card-head"><h3>🛒 Ən çox satılan</h3></div>' +
          '<div class="admin-card-body">' + analyticsListHtml(data.topSold, 'satış', 'Satış yoxdur') + '</div></div>' +
        '<div class="admin-card"><div class="admin-card-head"><h3>🧺 Ən çox səbətə atılan</h3></div>' +
          '<div class="admin-card-body">' + analyticsListHtml(data.topCarted, 'səbət', 'Səbət hadisəsi yoxdur') + '</div></div>' +
        '<div class="admin-card"><div class="admin-card-head"><h3>🔎 Ən çox axtarılan</h3></div>' +
          '<div class="admin-card-body">' + analyticsListHtml(
            (data.topSearched || []).map(function (s) {
              return { rank: s.rank, name: '«' + s.query + '»', count: s.count, image: '' };
            }), 'axtarış', 'Axtarış yoxdur') + '</div></div>' +
      '</div>' +
      '<div class="admin-card mt-4"><div class="admin-card-head"><h3>📭 Satılmayan məhsullar</h3>' +
        '<span class="text-sm text-muted">Heç bir sifarişdə olmayan SKU-lar</span></div>' +
        '<div class="admin-card-body">' +
          (data.unsold && data.unsold.length
            ? '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
                '<th></th><th>Məhsul</th><th>Brend</th><th>Qiymət</th><th>Stok</th><th>Baxış</th><th>Səbət</th>' +
              '</tr></thead><tbody>' +
              data.unsold.map(function (p) {
                var img = p.image ? NexoraApp.resolveMediaUrl(p.image) : '';
                return '<tr>' +
                  '<td>' + (img ? '<img class="admin-thumb" src="' + esc(img) + '" alt="">' : '—') + '</td>' +
                  '<td><strong>' + esc(p.name) + '</strong><div class="text-xs text-muted">' + esc(p.productId) + '</div></td>' +
                  '<td>' + esc(p.brand || '—') + '</td>' +
                  '<td>' + money(p.price) + '</td>' +
                  '<td>' + esc(p.stock != null ? p.stock : 0) + '</td>' +
                  '<td>' + esc(p.views || 0) + '</td>' +
                  '<td>' + esc(p.carts || 0) + '</td>' +
                '</tr>';
              }).join('') +
              '</tbody></table></div>'
            : '<p class="admin-empty">Satılmayan məhsul yoxdur (və ya bütün kataloq satılıb).</p>') +
        '</div></div>' +
      '<p class="text-xs text-muted mt-3">Yenilənmə: ' + esc(new Date(data.generatedAt || Date.now()).toLocaleString('az-AZ')) + '</p>';

    var refresh = document.getElementById('analyticsRefresh');
    if (refresh) refresh.addEventListener('click', function () { renderAnalytics(); });
  }

  async function renderDashboard() {
    var products = await getAllProducts();
    var orders = await getOrders();
    var users = await getUsers();
    var lowStock = products.filter(function (p) { return (p.stock || 0) <= 10; }).length;
    var revenue = orders.reduce(function (s, o) {
      var t = o.total != null ? o.total : (o.totals && o.totals.total);
      return s + (Number(t) || 0);
    }, 0);
    var analytics = null;
    try { analytics = await loadAnalyticsData(); } catch (e) { analytics = null; }
    var topSold = (analytics && analytics.topSold) ? analytics.topSold.slice(0, 5) : [];
    var quickLinks = [
      { nav: 'analytics', label: 'Analytics' }, { nav: 'products', label: 'Məhsullar' },
      { nav: 'orders', label: 'Sifarişlər' }, { nav: 'inventory', label: 'Stok' }
    ];
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-stats">' +
        '<div class="admin-stat"><div class="admin-stat-value">' + products.length + '</div><div class="admin-stat-label">Məhsul</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value">' + orders.length + '</div><div class="admin-stat-label">Sifariş</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value">' + money(revenue) + '</div><div class="admin-stat-label">Gəlir</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value">' + users.length + '</div><div class="admin-stat-label">İstifadəçi</div></div>' +
        '<div class="admin-stat is-accent"><div class="admin-stat-value">' + lowStock + '</div><div class="admin-stat-label">Aşağı stok</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-value"><span class="admin-status ' +
          (state.apiLive ? 'is-ok' : 'is-warn') + '">' + (state.apiLive ? 'Canlı' : 'Offline') + '</span></div>' +
          '<div class="admin-stat-label">API status</div></div>' +
      '</div>' +
      '<div class="admin-grid-2">' +
        '<div class="admin-card"><div class="admin-card-head"><h3>Ən çox satılan</h3>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-quick-nav="analytics">Hamısı →</button></div>' +
          '<div class="admin-card-body">' +
          (topSold.length ? analyticsListHtml(topSold, 'satış', 'Hələ satış yoxdur.') : '<p class="admin-empty">Hələ satış yoxdur.</p>') +
        '</div></div>' +
        '<div class="admin-card"><div class="admin-card-head"><h3>Sürətli keçidlər</h3></div><div class="admin-card-body">' +
          '<div class="flex gap-2 flex-wrap">' + quickLinks.map(function (l) {
            return '<button type="button" class="btn btn-outline btn-sm" data-quick-nav="' + l.nav + '">' + esc(l.label) + '</button>';
          }).join('') + '</div>' +
          '<p class="text-sm text-muted mt-4">Tam analitika: baxış, səbət, axtarış və satılmayan məhsullar üçün <strong>Analytics</strong> bölməsinə keçin.</p>' +
        '</div></div>' +
      '</div>';
    document.querySelectorAll('[data-quick-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () { setView(btn.getAttribute('data-quick-nav')); });
    });
  }

  async function renderProducts() {
    var all = await getProducts();
    var cats = await getCms('categories').catch(function () { return { categories: [] }; });
    var catList = cats.categories || [];
    var pg = paginate(all, state.products.page, state.products.pageSize);
    var rows = pg.items.map(function (p) {
      var img = NexoraApp.resolveMediaUrl(p.image || (p.images && p.images[0] && p.images[0].src) || '');
      return '<tr>' +
        '<td>' + (img ? '<img class="admin-thumb" src="' + esc(img) + '" alt="">' : '—') + '</td>' +
        '<td>' + esc(p.sku || p.id) + '</td>' +
        '<td>' + esc(p.name) + '</td>' +
        '<td>' + esc(p.brand || '') + '</td>' +
        '<td>' + money(p.price) + '</td>' +
        '<td>' + esc(p.stock != null ? p.stock : 0) + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-product="' + esc(p.id) + '">Redaktə</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-product="' + esc(p.id) + '">Sil</button>' +
        '</div></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head">' +
        '<div><h1>Məhsullar</h1><p>' + pg.total + ' məhsul</p></div>' +
        '<div class="flex gap-2 flex-wrap">' +
          '<button type="button" class="btn btn-outline" id="exportCatalog">Backup yüklə</button>' +
          '<label class="btn btn-outline" style="cursor:pointer;margin:0">Backup bərpa' +
            '<input type="file" id="importCatalog" accept="application/json,.json" hidden>' +
          '</label>' +
          '<button type="button" class="btn btn-primary" id="addProduct">+ Yeni məhsul</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-alert mb-3" style="padding:12px 14px;border-radius:12px;background:rgba(255,0,0,.06);border:1px solid rgba(255,0,0,.18);font-size:13px;line-height:1.45">' +
        '<strong>Vacib:</strong> Render pulsuz planda server yenilənəndə məlumat silinə bilər. Hər dəfə məhsul əlavə/redaktədən sonra <em>Backup yüklə</em> edin. ' +
        'Daimi saxlama üçün Render-də Disk əlavə edib <code>DATABASE_DIR</code> / <code>DATABASE_PATH</code> təyin edin.' +
      '</div>' +
      '<div class="admin-toolbar">' +
        '<input type="search" class="input" id="productSearch" placeholder="Axtar…" value="' + esc(state.products.search) + '">' +
        '<select class="input" id="productCatFilter"><option value="">Bütün kateqoriyalar</option>' +
          catList.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (state.products.category === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th></th><th>SKU</th><th>Ad</th><th>Brend</th><th>Qiymət</th><th>Stok</th><th></th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="admin-empty">Məhsul tapılmadı</td></tr>') + '</tbody></table></div>' +
      paginationHtml(pg, 'product');

    var exportBtn = document.getElementById('exportCatalog');
    if (exportBtn) {
      exportBtn.addEventListener('click', async function () {
        try {
          var blob = await NexoraApi.downloadCatalogBackup();
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'nexora-catalog-backup.json';
          a.click();
          URL.revokeObjectURL(a.href);
          NexoraToast.success('Backup yükləndi');
        } catch (e) {
          NexoraToast.error(e.message || 'Backup alınmadı');
        }
      });
    }
    var importInput = document.getElementById('importCatalog');
    if (importInput) {
      importInput.addEventListener('change', async function () {
        var file = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!file) return;
        try {
          var text = await file.text();
          var data = JSON.parse(text);
          var r = await NexoraApi.restoreCatalogBackup(data);
          NexoraToast.success('Bərpa olundu: ' + (r.products || 0) + ' məhsul');
          render();
        } catch (e) {
          NexoraToast.error(e.message || 'Backup bərpa olunmadı');
        }
      });
    }
    document.getElementById('productSearch').addEventListener('input', NexoraApp.debounce(function (e) {
      state.products.search = e.target.value;
      state.products.page = 1;
      render();
    }, 300));
    document.getElementById('productCatFilter').addEventListener('change', function (e) {
      state.products.category = e.target.value;
      state.products.page = 1;
      render();
    });
    bindPagination('product', function (p) { state.products.page = p; render(); });
    document.getElementById('addProduct').addEventListener('click', function () { openProductDrawer(null, catList); });
    document.querySelectorAll('[data-edit-product]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit-product');
        var p = all.find(function (x) { return x.id === id; });
        if (p) openProductDrawer(p, catList);
      });
    });
    document.querySelectorAll('[data-del-product]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-del-product');
        confirmAction({
          title: 'Məhsulu sil?',
          message: 'Bu məhsul silinəcək.',
          onConfirm: async function () {
            await deleteProduct(id);
            NexoraToast.success('Məhsul silindi');
            render();
          }
        });
      });
    });
  }

  function collectImageSlots() {
    var srcs = [];
    for (var i = 1; i <= 3; i++) {
      var el = document.getElementById('pImg' + i);
      var v = el ? el.value.trim() : '';
      if (v && srcs.indexOf(v) === -1) srcs.push(v);
    }
    return srcs;
  }

  function renderSlotPreview(slot, url) {
    var box = document.getElementById('pImgPreview' + slot);
    if (!box) return;
    if (!url) {
      box.innerHTML = '<span class="text-xs text-muted">Şəkil ' + slot + '</span>';
      return;
    }
    box.innerHTML = '<img src="' + esc(NexoraApp.resolveMediaUrl(url)) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">';
  }

  function bindImageSlots() {
    for (var i = 1; i <= 3; i++) {
      (function (slot) {
        var urlInput = document.getElementById('pImg' + slot);
        var fileInput = document.getElementById('pImgFile' + slot);
        var clearBtn = document.getElementById('pImgClear' + slot);
        if (urlInput) {
          urlInput.addEventListener('input', function () {
            renderSlotPreview(slot, urlInput.value.trim());
          });
        }
        if (clearBtn) {
          clearBtn.addEventListener('click', function () {
            if (urlInput) urlInput.value = '';
            if (fileInput) fileInput.value = '';
            renderSlotPreview(slot, '');
          });
        }
        if (fileInput) {
          fileInput.addEventListener('change', async function () {
            var file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!/^image\//.test(file.type)) {
              NexoraToast.error('Yalnız şəkil faylı seçin');
              return;
            }
            if (file.size > 6 * 1024 * 1024) {
              NexoraToast.error('Şəkil 6MB-dan böyük ola bilməz');
              return;
            }
            try {
              NexoraToast.info('Şəkil ' + slot + ' yüklənir…');
              var dataUrl = await new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              var uploaded = null;
              if (state.apiLive && typeof NexoraApi !== 'undefined' && NexoraApi.uploadImage) {
                uploaded = await NexoraApi.uploadImage(dataUrl);
              }
              var finalUrl = (uploaded && uploaded.url) || dataUrl;
              if (urlInput) urlInput.value = finalUrl;
              renderSlotPreview(slot, finalUrl);
              NexoraToast.success('Şəkil ' + slot + ' hazırdır');
            } catch (e) {
              NexoraToast.error(e.message || 'Şəkil yüklənmədi');
            }
          });
        }
      })(i);
    }
  }

  function openProductDrawer(product, catList) {
    var isNew = !product;
    var p = product || { stock: 10, category: 'electronics', badge: 'Yeni' };
    var existing = [];
    if (p.image) existing.push(p.image);
    (p.images || []).forEach(function (img) {
      var src = img && (img.src || img.url || img);
      if (src && existing.indexOf(src) === -1) existing.push(src);
    });
    while (existing.length < 3) existing.push('');
    existing = existing.slice(0, 3);

    var catOpts = (catList || []).map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (p.category === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');

    function slotHtml(n, url) {
      var prev = url
        ? '<img src="' + esc(NexoraApp.resolveMediaUrl(url)) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">'
        : '<span class="text-xs text-muted">Şəkil ' + n + '</span>';
      return '<div class="admin-img-slot" style="border:1px solid var(--color-border);border-radius:12px;padding:10px;flex:1;min-width:140px">' +
        '<div id="pImgPreview' + n + '" style="width:100%;aspect-ratio:1;background:var(--color-bg-alt);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px">' +
          prev +
        '</div>' +
        '<label class="btn btn-outline btn-sm w-full mb-2" style="cursor:pointer">' +
          'Fayldan seç' +
          '<input type="file" id="pImgFile' + n + '" accept="image/*" hidden>' +
        '</label>' +
        '<input class="input" id="pImg' + n + '" placeholder="və ya şəkil linki" value="' + esc(url) + '">' +
        '<button type="button" class="btn btn-ghost btn-sm w-full mt-2" id="pImgClear' + n + '">Təmizlə</button>' +
      '</div>';
    }

    var body =
      '<form id="productDrawerForm">' +
        '<input type="hidden" id="pId" value="' + esc(p.id || '') + '">' +
        '<div class="form-row"><div class="form-group"><label class="form-label">Ad *</label><input class="input" id="pName" required value="' + esc(p.name || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">SKU *</label><input class="input" id="pSku" required value="' + esc(p.sku || '') + '"></div></div>' +
        '<div class="form-row"><div class="form-group"><label class="form-label">Brend *</label><input class="input" id="pBrand" required value="' + esc(p.brand || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Kateqoriya</label><select class="input" id="pCat">' + catOpts + '</select></div></div>' +
        '<div class="form-group"><label class="form-label">Alt kateqoriya</label><input class="input" id="pSubcat" value="' + esc(p.subcategory || '') + '"></div>' +
        '<div class="form-row"><div class="form-group"><label class="form-label">Qiymət</label><input type="number" min="0" step="0.01" class="input" id="pPrice" value="' + esc(p.price != null ? p.price : '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Köhnə qiymət</label><input type="number" min="0" step="0.01" class="input" id="pOld" value="' + esc(p.oldPrice != null ? p.oldPrice : '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Stok</label><input type="number" min="0" class="input" id="pStock" value="' + esc(p.stock != null ? p.stock : 10) + '"></div></div>' +
        '<div class="form-group"><label class="form-label">Badge</label><input class="input" id="pBadge" value="' + esc(p.badge || 'Yeni') + '"></div>' +
        '<div class="form-group"><label class="form-label">Təsvir</label><textarea class="input" id="pDesc" rows="3">' + esc(p.description || '') + '</textarea></div>' +
        '<div class="form-group"><label class="form-label">Şəkillər (3 ədəd) — fayldan seçin, saytda görünəcək</label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:stretch">' +
            slotHtml(1, existing[0]) + slotHtml(2, existing[1]) + slotHtml(3, existing[2]) +
          '</div>' +
          '<p class="text-xs text-muted mt-2 mb-0">1-ci şəkil əsasdır. 2 və 3 məhsul səhifəsində qalereyada və 360° fırlanmada çıxır.</p>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Xüsusiyyətlər</label>' + specsEditorHtml(p.specs) + '</div>' +
      '</form>';
    var foot = '<button type="button" class="btn btn-ghost" id="drawerCancel">Ləğv</button>' +
      (isNew ? '' : '<button type="button" class="btn btn-outline" id="drawerDelete" style="margin-right:auto">Sil</button>') +
      '<button type="button" class="btn btn-primary" id="drawerSave">Yadda saxla</button>';
    openDrawer(isNew ? 'Yeni məhsul' : 'Məhsul redaktə', body, foot);
    bindSpecsEditor();
    bindImageSlots();
    document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
    if (!isNew) {
      document.getElementById('drawerDelete').addEventListener('click', function () {
        confirmAction({
          title: 'Məhsulu sil?',
          message: 'Bu məhsul silinəcək.',
          onConfirm: async function () {
            await deleteProduct(p.id);
            closeDrawer();
            NexoraToast.success('Silindi');
            render();
          }
        });
      });
    }
    document.getElementById('drawerSave').addEventListener('click', async function () {
      try {
        var name = document.getElementById('pName').value.trim();
        var sku = document.getElementById('pSku').value.trim();
        var brand = document.getElementById('pBrand').value.trim();
        if (!name || !sku || !brand) {
          NexoraToast.error('Ad, SKU və brend məcburidir');
          return;
        }
        var id = document.getElementById('pId').value || ('p' + Date.now());
        var allSrc = collectImageSlots();
        var gradient = p.gradient || 'linear-gradient(135deg,#111,#FF0000)';
        var images = allSrc.length
          ? allSrc.map(function (src, i) { return { src: src, alt: name + (i ? ' ' + (i + 1) : ''), gradient: gradient }; })
          : [{ gradient: gradient, alt: name }];
        var stock = Number(document.getElementById('pStock').value) || 0;
        var item = {
          id: id, sku: sku, name: name, brand: brand, brandId: brandIdFrom(brand),
          category: document.getElementById('pCat').value,
          subcategory: document.getElementById('pSubcat').value.trim(),
          price: Number(document.getElementById('pPrice').value) || 0,
          oldPrice: document.getElementById('pOld').value ? Number(document.getElementById('pOld').value) : null,
          currency: '₼', rating: p.rating || 0, reviews: p.reviews || 0,
          badge: document.getElementById('pBadge').value.trim() || 'Yeni',
          badgeType: p.badgeType || 'primary',
          inStock: stock > 0, stock: stock, isNew: p.isNew != null ? p.isNew : true,
          tags: p.tags || [], description: document.getElementById('pDesc').value,
          specs: readSpecsFromEditor(), image: allSrc[0] || '', images: images,
          gradient: gradient, reviewList: p.reviewList || []
        };
        if (isNew) item._isNew = true;
        await saveProduct(item);
        closeDrawer();
        NexoraToast.success('Məhsul saxlandı — saytda görünəcək');
        render();
      } catch (e) {
        NexoraToast.error(e.message || 'Saxlama alınmadı');
      }
    });
  }

  async function renderInventory() {
    var products = await getAllProducts();
    if (state.inventory.lowOnly) {
      products = products.filter(function (p) { return (p.stock || 0) <= 10; });
    }
    var q = state.inventory.search.toLowerCase();
    if (q) {
      products = products.filter(function (p) {
        return [p.name, p.sku, p.brand].join(' ').toLowerCase().indexOf(q) !== -1;
      });
    }
    var rows = products.map(function (p) {
      var low = (p.stock || 0) <= 10;
      return '<tr' + (low ? ' class="is-low"' : '') + '>' +
        '<td>' + esc(p.sku || p.id) + '</td><td>' + esc(p.name) + '</td>' +
        '<td><input type="number" min="0" class="input" style="width:90px" data-stock-id="' + esc(p.id) + '" value="' + esc(p.stock || 0) + '"></td>' +
        '<td><span class="admin-status ' + (low ? 'is-warn' : 'is-ok') + '">' + (low ? 'Aşağı' : 'OK') + '</span></td>' +
        '<td><button type="button" class="btn btn-outline btn-sm" data-stock-save="' + esc(p.id) + '">Saxla</button></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Stok / İnventar</h1><p>Stok səviyyələrini idarə edin</p></div>' +
        '<button type="button" class="btn btn-primary" id="saveAllStock">Hamısını saxla</button></div>' +
      '<div class="admin-toolbar">' +
        '<input type="search" class="input" id="invSearch" placeholder="Axtar…" value="' + esc(state.inventory.search) + '">' +
        '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="invLowOnly"' + (state.inventory.lowOnly ? ' checked' : '') + '> Yalnız aşağı stok</label>' +
      '</div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>SKU</th><th>Məhsul</th><th>Stok</th><th>Status</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="5" class="admin-empty">Məhsul yoxdur</td></tr>') + '</tbody></table></div>';

    document.getElementById('invSearch').addEventListener('input', NexoraApp.debounce(function (e) {
      state.inventory.search = e.target.value;
      render();
    }, 300));
    document.getElementById('invLowOnly').addEventListener('change', function (e) {
      state.inventory.lowOnly = e.target.checked;
      render();
    });
    async function saveStock(id) {
      var input = document.querySelector('[data-stock-id="' + id + '"]');
      if (!input) return;
      var stock = Number(input.value) || 0;
      if (state.apiLive) {
        var list = await getAllProducts();
        var p = list.find(function (x) { return x.id === id; });
        if (!p) return;
        p.stock = stock;
        p.inStock = stock > 0;
        await saveProduct(p);
      } else {
        var all = await NexoraApp.loadProducts();
        var prod = all.find(function (x) { return x.id === id; });
        if (prod) {
          prod.stock = stock;
          prod.inStock = stock > 0;
          NexoraApp.storageSet('nexora-products', all);
        }
      }
    }
    document.querySelectorAll('[data-stock-save]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        await saveStock(btn.getAttribute('data-stock-save'));
        NexoraToast.success('Stok yeniləndi');
        render();
      });
    });
    document.getElementById('saveAllStock').addEventListener('click', async function () {
      var ids = [];
      document.querySelectorAll('[data-stock-id]').forEach(function (el) { ids.push(el.getAttribute('data-stock-id')); });
      for (var i = 0; i < ids.length; i++) await saveStock(ids[i]);
      NexoraToast.success('Bütün stoklar saxlandı');
      render();
    });
  }

  async function renderOrders() {
    var orders = await getOrders();
    var q = state.orders.search.toLowerCase();
    if (q) {
      orders = orders.filter(function (o) {
        var email = (o.email || (o.customer && o.customer.email) || '').toLowerCase();
        return (o.id || '').toLowerCase().indexOf(q) !== -1 || email.indexOf(q) !== -1;
      });
    }
    var rows = orders.map(function (o) {
      var email = o.email || (o.customer && o.customer.email) || '—';
      var total = o.total != null ? o.total : (o.totals && o.totals.total);
      return '<tr><td>' + esc(o.id) + '</td>' +
        '<td>' + esc(new Date(o.createdAt).toLocaleString('az-AZ')) + '</td>' +
        '<td>' + esc(email) + '</td>' +
        '<td><select class="input" style="min-width:140px" data-order-id="' + esc(o.id) + '">' +
          orderStatusOptions(o.status) + '</select></td>' +
        '<td>' + money(total) + '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-order-detail="' + esc(o.id) + '">Detal</button></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Sifarişlər</h1><p>' + orders.length + ' sifariş</p></div></div>' +
      '<div class="admin-toolbar"><input type="search" class="input" id="orderSearch" placeholder="ID və ya e-poçt…" value="' + esc(state.orders.search) + '"></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>ID</th><th>Tarix</th><th>E-poçt</th><th>Status</th><th>Cəm</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6" class="admin-empty">Sifariş yoxdur</td></tr>') + '</tbody></table></div>';

    document.getElementById('orderSearch').addEventListener('input', NexoraApp.debounce(function (e) {
      state.orders.search = e.target.value;
      render();
    }, 300));
    document.querySelectorAll('[data-order-id]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        try {
          await setOrderStatus(sel.getAttribute('data-order-id'), sel.value);
          NexoraToast.success('Status yeniləndi');
        } catch (e) {
          NexoraToast.error(e.message || 'Status dəyişmədi');
          render();
        }
      });
    });
    document.querySelectorAll('[data-order-detail]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var o = orders.find(function (x) { return x.id === btn.getAttribute('data-order-detail'); });
        if (!o) return;
        var items = (o.items || []).map(function (i) {
          return '<li>' + esc(i.name || i.id) + ' × ' + (i.qty || 1) + ' — ' + money((i.price || 0) * (i.qty || 1)) + '</li>';
        }).join('');
        var total = o.total != null ? o.total : (o.totals && o.totals.total);
        var payHtml = '';
        var transferPay = null;
        if (state.apiLive) {
          try {
            var payRes = await NexoraApi.getPaymentsByOrder(o.id);
            var pays = (payRes && payRes.payments) || [];
            if (pays.length) {
              payHtml = '<h4 class="mt-4">Ödəniş</h4><ul class="text-sm">' + pays.map(function (p) {
                return '<li>' + esc(p.method) + ' · ' + esc(p.status) +
                  (p.providerRef ? ' · ' + esc(p.providerRef) : '') +
                  ' · ' + money(p.amount) + '</li>';
              }).join('') + '</ul>';
              transferPay = pays.find(function (p) {
                return p.method === 'transfer' && p.status !== 'paid';
              }) || null;
            }
          } catch (e) { /* ignore */ }
        }
        var phone = (o.customer && o.customer.phone) || o.phone || '';
        var notifyMsg = encodeURIComponent(
          'NEXORA sifariş #' + o.id + '\n' +
          'Status: ' + orderDisplay(o.status) + '\n' +
          'Cəm: ' + money(total) + '\n' +
          'Müştəri: ' + (o.email || (o.customer && o.customer.email) || '')
        );
        var waDigits = String(phone || '').replace(/\D/g, '');
        if (waDigits.indexOf('994') !== 0 && waDigits.length === 9) waDigits = '994' + waDigits;
        if (waDigits.charAt(0) === '0') waDigits = '994' + waDigits.slice(1);
        var waNotify = waDigits
          ? ('https://wa.me/' + waDigits + '?text=' + notifyMsg)
          : ('https://wa.me/?text=' + notifyMsg);
        var tgUser = '';
        try {
          var siteCfg = await getCms('site');
          tgUser = String((siteCfg && siteCfg.telegram) || '').replace(/^@/, '');
        } catch (e) { tgUser = ''; }
        var tgNotify = tgUser
          ? ('https://t.me/' + encodeURIComponent(tgUser) + '?text=' + notifyMsg)
          : ('https://t.me/share/url?url=' + encodeURIComponent('https://nexora.az') + '&text=' + notifyMsg);

        openDrawer('Sifariş ' + o.id,
          '<p><strong>Status:</strong> ' + esc(orderDisplay(o.status)) + '</p>' +
          '<p><strong>E-poçt:</strong> ' + esc(o.email || (o.customer && o.customer.email) || '') + '</p>' +
          '<p><strong>Telefon:</strong> ' + esc(phone || '—') + '</p>' +
          '<p><strong>Ünvan:</strong> ' + esc((o.customer && o.customer.address) || o.address || '—') + '</p>' +
          '<h4 class="mt-4">Məhsullar</h4><ul class="text-sm">' + (items || '<li>—</li>') + '</ul>' +
          '<p class="mt-3"><strong>Cəm:</strong> ' + money(total) + '</p>' + payHtml +
          '<div class="flex gap-2 flex-wrap mt-4">' +
            '<a class="btn btn-outline btn-sm" href="' + esc(waNotify) + '" target="_blank" rel="noopener">WhatsApp bildiriş</a>' +
            '<a class="btn btn-outline btn-sm" href="' + esc(tgNotify) + '" target="_blank" rel="noopener">Telegram bildiriş</a>' +
          '</div>',
          (transferPay
            ? '<button type="button" class="btn btn-outline" id="confirmTransferBtn">Köçürməni təsdiqlə</button>'
            : '') +
          '<button type="button" class="btn btn-primary" id="drawerCloseBtn">Bağla</button>');
        document.getElementById('drawerCloseBtn').addEventListener('click', closeDrawer);
        var cbtn = document.getElementById('confirmTransferBtn');
        if (cbtn && transferPay) {
          cbtn.addEventListener('click', async function () {
            try {
              await NexoraApi.confirmTransfer(transferPay.id, { note: 'Admin təsdiqi' });
              NexoraToast.success('Köçürmə təsdiqləndi · sifariş ödənildi');
              closeDrawer();
              render();
            } catch (err) {
              NexoraToast.error(err.message || 'Təsdiq alınmadı');
            }
          });
        }
      });
    });
  }

  async function renderCoupons() {
    var data = await getCms('coupons');
    var coupons = (data.coupons || []).slice();
    var q = state.coupons.search.toLowerCase();
    if (q) coupons = coupons.filter(function (c) { return (c.code || '').toLowerCase().indexOf(q) !== -1; });
    var rows = coupons.map(function (c) {
      return '<tr><td><strong>' + esc(c.code) + '</strong></td><td>' + esc(c.type) + '</td>' +
        '<td>' + esc(c.value) + '</td><td>' + money(c.minOrder || 0) + '</td>' +
        '<td>' + esc(c.description || '') + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-coupon="' + esc(c.code) + '">Redaktə</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-coupon="' + esc(c.code) + '">Sil</button>' +
        '</div></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Kuponlar</h1><p>Endirim kodları</p></div>' +
        '<button type="button" class="btn btn-primary" id="addCoupon">+ Yeni kupon</button></div>' +
      '<div class="admin-toolbar"><input type="search" class="input" id="couponSearch" placeholder="Kod axtar…" value="' + esc(state.coupons.search) + '"></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Kod</th><th>Tip</th><th>Dəyər</th><th>Min. sifariş</th><th>Təsvir</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6" class="admin-empty">Kupon yoxdur</td></tr>') + '</tbody></table></div>';
    document.getElementById('couponSearch').addEventListener('input', NexoraApp.debounce(function (e) {
      state.coupons.search = e.target.value;
      render();
    }, 300));
    document.getElementById('addCoupon').addEventListener('click', function () { openCouponDrawer(null, coupons); });
    document.querySelectorAll('[data-edit-coupon]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = coupons.find(function (x) { return x.code === btn.getAttribute('data-edit-coupon'); });
        if (c) openCouponDrawer(c, coupons);
      });
    });
    document.querySelectorAll('[data-del-coupon]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-del-coupon');
        confirmAction({
          title: 'Kuponu sil?',
          message: code + ' silinəcək.',
          onConfirm: async function () {
            if (state.apiLive) await NexoraApi.deleteCoupon(code);
            var d = await getCms('coupons');
            d.coupons = (d.coupons || []).filter(function (c) { return c.code !== code; });
            await saveCms('coupons', d);
            NexoraToast.success('Kupon silindi');
            render();
          }
        });
      });
    });
  }

  function openCouponDrawer(coupon, allCoupons) {
    var isNew = !coupon;
    var c = coupon || { type: 'percent', value: 10, minOrder: 0 };
    var body = '<form id="couponForm">' +
      '<div class="form-group"><label class="form-label">Kod *</label><input class="input" id="cpCode" ' + (isNew ? '' : 'readonly') + ' value="' + esc(c.code || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Tip</label><select class="input" id="cpType">' +
        ['percent', 'fixed', 'shipping'].map(function (t) {
          return '<option value="' + t + '"' + (c.type === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') + '</select></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label">Dəyər</label><input type="number" class="input" id="cpValue" value="' + esc(c.value != null ? c.value : 0) + '"></div>' +
      '<div class="form-group"><label class="form-label">Min. sifariş</label><input type="number" class="input" id="cpMin" value="' + esc(c.minOrder != null ? c.minOrder : 0) + '"></div></div>' +
      '<div class="form-group"><label class="form-label">Təsvir</label><input class="input" id="cpDesc" value="' + esc(c.description || '') + '"></div></form>';
    openDrawer(isNew ? 'Yeni kupon' : 'Kupon redaktə', body,
      '<button type="button" class="btn btn-ghost" id="drawerCancel">Ləğv</button>' +
      '<button type="button" class="btn btn-primary" id="drawerSave">Yadda saxla</button>');
    document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
    document.getElementById('drawerSave').addEventListener('click', async function () {
      try {
        var code = document.getElementById('cpCode').value.trim().toUpperCase();
        if (!code) { NexoraToast.error('Kod məcburidir'); return; }
        var item = {
          code: code,
          type: document.getElementById('cpType').value,
          value: Number(document.getElementById('cpValue').value) || 0,
          minOrder: Number(document.getElementById('cpMin').value) || 0,
          description: document.getElementById('cpDesc').value.trim()
        };
        if (state.apiLive) await NexoraApi.saveCoupon(item);
        var d = await getCms('coupons');
        var list = (d.coupons || []).filter(function (x) { return x.code !== code; });
        list.push(item);
        d.coupons = list;
        await saveCms('coupons', d);
        closeDrawer();
        NexoraToast.success('Kupon saxlandı');
        render();
      } catch (e) { NexoraToast.error(e.message || 'Saxlama alınmadı'); }
    });
  }

  async function renderUsers() {
    var users = await getUsers();
    var q = state.users.search.toLowerCase();
    if (q) {
      users = users.filter(function (u) {
        return (u.name || '').toLowerCase().indexOf(q) !== -1 || (u.email || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    var selfId = state.currentUser && state.currentUser.id;
    var rows = users.map(function (u) {
      var ip = u.registerIp || u.register_ip || u.lastIp || u.last_ip || '—';
      var lastIp = u.lastIp || u.last_ip || '';
      var ipCell = esc(ip);
      if (lastIp && lastIp !== ip && ip !== '—') ipCell += '<div class="text-xs text-muted">Son: ' + esc(lastIp) + '</div>';
      return '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td>' +
        '<td><select class="input" data-user-role="' + esc(u.id) + '" data-prev="' + esc(u.role) + '">' +
          '<option value="customer"' + (u.role === 'customer' ? ' selected' : '') + '>customer</option>' +
          '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>admin</option></select></td>' +
        '<td>' + esc(u.phone || '—') + '</td>' +
        '<td class="text-sm"><code>' + ipCell + '</code></td>' +
        '<td class="text-xs text-muted">' + esc((u.createdAt || u.created_at || '').slice(0, 19).replace('T', ' ') || '—') + '</td>' +
        '<td>' + (u.id === selfId ? '—' : '<button type="button" class="btn btn-ghost btn-sm" data-del-user="' + esc(u.id) + '">Sil</button>') + '</td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>İstifadəçilər</h1><p>' + users.length + ' hesab</p></div></div>' +
      '<div class="admin-toolbar"><input type="search" class="input" id="userSearch" placeholder="Ad və ya e-poçt…" value="' + esc(state.users.search) + '"></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Ad</th><th>E-poçt</th><th>Rol</th><th>Telefon</th><th>IP</th><th>Qeydiyyat</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="7" class="admin-empty">İstifadəçi yoxdur</td></tr>') + '</tbody></table></div>';
    document.getElementById('userSearch').addEventListener('input', NexoraApp.debounce(function (e) {
      state.users.search = e.target.value;
      render();
    }, 300));
    document.querySelectorAll('[data-user-role]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var id = sel.getAttribute('data-user-role');
        var prev = sel.getAttribute('data-prev');
        var next = sel.value;
        var pass = null;
        if (!state.apiLive) {
          pass = window.prompt('Rol dəyişimi üçün admin şifrənizi yazın:');
          if (!pass) { sel.value = prev; return; }
        }
        try {
          await setUserRole(id, next, pass);
          sel.setAttribute('data-prev', next);
          NexoraToast.success('Rol yeniləndi');
        } catch (e) {
          sel.value = prev;
          NexoraToast.error(e.message || 'Rol dəyişmədi');
        }
      });
    });
    document.querySelectorAll('[data-del-user]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-del-user');
        if (id === selfId) { NexoraToast.error('Öz hesabınızı silə bilməzsiniz'); return; }
        confirmAction({
          title: 'İstifadəçini sil?',
          message: 'Bu hesab silinəcək.',
          onConfirm: async function () {
            if (!state.apiLive) {
              var pass = window.prompt('Silmək üçün admin şifrənizi yazın:');
              if (!pass) return;
              await NexoraAccount.requireAdmin();
            }
            await deleteUser(id);
            NexoraToast.success('İstifadəçi silindi');
            render();
          }
        });
      });
    });
  }

  async function renderCategories() {
    var data = await getCms('categories');
    var categories = data.categories || [];
    var rows = categories.map(function (c, idx) {
      var subs = (c.subcategories || []).map(function (s) { return s.name || s.id; }).join(', ');
      return '<tr><td>' + esc(c.id) + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.count != null ? c.count : 0) + '</td>' +
        '<td>' + esc(c.icon || '') + '</td><td class="text-sm">' + esc(subs) + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-cat="' + idx + '">Redaktə</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-cat="' + idx + '">Sil</button>' +
        '</div></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Kateqoriyalar</h1><p>Kataloq strukturu</p></div>' +
        '<button type="button" class="btn btn-primary" id="addCategory">+ Əlavə et</button></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>ID</th><th>Ad</th><th>Say</th><th>İkon</th><th>Alt kateqoriyalar</th><th></th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
    document.getElementById('addCategory').addEventListener('click', function () { openCategoryDrawer(null, categories); });
    document.querySelectorAll('[data-edit-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-edit-cat'), 10);
        openCategoryDrawer(categories[idx], categories, idx);
      });
    });
    document.querySelectorAll('[data-del-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-del-cat'), 10);
        confirmAction({
          title: 'Kateqoriyanı sil?',
          message: 'Bu kateqoriya silinəcək.',
          onConfirm: async function () {
            categories.splice(idx, 1);
            await saveCms('categories', { categories: categories });
            NexoraToast.success('Silindi');
            render();
          }
        });
      });
    });
  }

  function openCategoryDrawer(cat, all, idx) {
    var isNew = cat == null;
    var c = cat || { id: '', name: '', count: 0, icon: 'grid' };
    var subs = (c.subcategories || []).map(function (s) { return s.name || s.id; }).join(', ');
    var body = '<form><div class="form-group"><label class="form-label">ID</label><input class="input" id="catId" value="' + esc(c.id || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Ad</label><input class="input" id="catName" value="' + esc(c.name || '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label">Say</label><input type="number" class="input" id="catCount" value="' + esc(c.count != null ? c.count : 0) + '"></div>' +
      '<div class="form-group"><label class="form-label">İkon (data-icon)</label><input class="input" id="catIcon" value="' + esc(c.icon || 'grid') + '"></div></div>' +
      '<div class="form-group"><label class="form-label">Alt kateqoriyalar (vergüllə)</label><input class="input" id="catSubs" value="' + esc(subs) + '"></div></form>';
    openDrawer(isNew ? 'Yeni kateqoriya' : 'Kateqoriya redaktə', body,
      '<button type="button" class="btn btn-ghost" id="drawerCancel">Ləğv</button>' +
      '<button type="button" class="btn btn-primary" id="drawerSave">Yadda saxla</button>');
    document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
    document.getElementById('drawerSave').addEventListener('click', async function () {
      var item = {
        id: document.getElementById('catId').value.trim(),
        name: document.getElementById('catName').value.trim(),
        count: Number(document.getElementById('catCount').value) || 0,
        icon: document.getElementById('catIcon').value.trim() || 'grid',
        subcategories: document.getElementById('catSubs').value.split(',').map(function (s) {
          s = s.trim();
          if (!s) return null;
          var id = brandIdFrom(s);
          return { id: id, name: s };
        }).filter(Boolean)
      };
      if (!item.id || !item.name) { NexoraToast.error('ID və ad məcburidir'); return; }
      if (isNew) all.push(item);
      else all[idx] = Object.assign({}, c, item);
      await saveCms('categories', { categories: all });
      closeDrawer();
      NexoraToast.success('Kateqoriya saxlandı');
      render();
    });
  }

  async function renderBrands() {
    var data = await getCms('brands');
    var brands = data.brands || [];
    var rows = brands.map(function (b, idx) {
      return '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.name) + '</td>' +
        '<td>' + esc(b.logo || '') + '</td>' +
        '<td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:' + esc(b.color || '#ccc') + '"></span></td>' +
        '<td>' + (b.featured ? 'Bəli' : 'Xeyr') + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-brand="' + idx + '">Redaktə</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-brand="' + idx + '">Sil</button></div></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Brendlər</h1></div>' +
        '<button type="button" class="btn btn-primary" id="addBrand">+ Əlavə et</button></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>ID</th><th>Ad</th><th>Logo</th><th>Rəng</th><th>Seçilmiş</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    document.getElementById('addBrand').addEventListener('click', function () { openBrandDrawer(null, brands); });
    document.querySelectorAll('[data-edit-brand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openBrandDrawer(brands[parseInt(btn.getAttribute('data-edit-brand'), 10)], brands, parseInt(btn.getAttribute('data-edit-brand'), 10));
      });
    });
    document.querySelectorAll('[data-del-brand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-del-brand'), 10);
        confirmAction({
          title: 'Brendi sil?',
          onConfirm: async function () {
            brands.splice(idx, 1);
            await saveCms('brands', { brands: brands });
            NexoraToast.success('Silindi');
            render();
          }
        });
      });
    });
  }

  function openBrandDrawer(brand, all, idx) {
    var isNew = !brand;
    var b = brand || { featured: false, color: '#111111' };
    var body = '<form><div class="form-group"><label class="form-label">ID</label><input class="input" id="brId" value="' + esc(b.id || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Ad</label><input class="input" id="brName" value="' + esc(b.name || '') + '"></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label">Logo mətni</label><input class="input" id="brLogo" value="' + esc(b.logo || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Rəng</label><input type="color" class="input" id="brColor" value="' + esc(b.color || '#111111') + '" style="height:44px"></div></div>' +
      '<label class="flex items-center gap-2 mb-3"><input type="checkbox" id="brFeatured"' + (b.featured ? ' checked' : '') + '> Seçilmiş brend</label>' +
      '<div class="form-group"><label class="form-label">Şəkil URL</label><input class="input" id="brImage" value="' + esc(b.image || '') + '"></div></form>';
    openDrawer(isNew ? 'Yeni brend' : 'Brend redaktə', body,
      '<button type="button" class="btn btn-ghost" id="drawerCancel">Ləğv</button>' +
      '<button type="button" class="btn btn-primary" id="drawerSave">Yadda saxla</button>');
    document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
    document.getElementById('drawerSave').addEventListener('click', async function () {
      var item = {
        id: document.getElementById('brId').value.trim(),
        name: document.getElementById('brName').value.trim(),
        logo: document.getElementById('brLogo').value.trim(),
        color: document.getElementById('brColor').value,
        featured: document.getElementById('brFeatured').checked,
        image: document.getElementById('brImage').value.trim()
      };
      if (!item.id || !item.name) { NexoraToast.error('ID və ad məcburidir'); return; }
      if (isNew) all.push(item);
      else all[idx] = Object.assign({}, b, item);
      await saveCms('brands', { brands: all });
      closeDrawer();
      NexoraToast.success('Brend saxlandı');
      render();
    });
  }

  async function renderCampaigns() {
    var data = await getCms('campaigns');
    var campaigns = data.campaigns || [];
    var rows = campaigns.map(function (c, idx) {
      return '<tr><td>' + esc(c.title) + '</td><td>' + esc(c.discount) + '%</td>' +
        '<td>' + esc(c.endDate ? new Date(c.endDate).toLocaleDateString('az-AZ') : '') + '</td>' +
        '<td>' + esc(c.type || '') + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-camp="' + idx + '">Redaktə</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-camp="' + idx + '">Sil</button></div></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Kampaniyalar</h1></div>' +
        '<button type="button" class="btn btn-primary" id="addCamp">+ Əlavə et</button></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Başlıq</th><th>Endirim</th><th>Bitmə</th><th>Tip</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    document.getElementById('addCamp').addEventListener('click', function () { openCampaignDrawer(null, campaigns); });
    document.querySelectorAll('[data-edit-camp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openCampaignDrawer(campaigns[parseInt(btn.getAttribute('data-edit-camp'), 10)], campaigns, parseInt(btn.getAttribute('data-edit-camp'), 10));
      });
    });
    document.querySelectorAll('[data-del-camp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-del-camp'), 10);
        confirmAction({
          title: 'Kampaniyanı sil?',
          onConfirm: async function () {
            campaigns.splice(idx, 1);
            await saveCms('campaigns', { campaigns: campaigns });
            NexoraToast.success('Silindi');
            render();
          }
        });
      });
    });
  }

  function openCampaignDrawer(camp, all, idx) {
    var isNew = !camp;
    var c = camp || { type: 'promo', discount: 20 };
    var endVal = c.endDate ? c.endDate.slice(0, 16) : '';
    var body = '<form><div class="form-group"><label class="form-label">Başlıq</label><input class="input" id="cmTitle" value="' + esc(c.title || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Təsvir</label><textarea class="input" id="cmDesc" rows="2">' + esc(c.description || '') + '</textarea></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label">Endirim %</label><input type="number" class="input" id="cmDisc" value="' + esc(c.discount != null ? c.discount : 0) + '"></div>' +
      '<div class="form-group"><label class="form-label">Bitmə</label><input type="datetime-local" class="input" id="cmEnd" value="' + esc(endVal) + '"></div></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label">Tip</label><input class="input" id="cmType" value="' + esc(c.type || 'promo') + '"></div>' +
      '<div class="form-group"><label class="form-label">Link</label><input class="input" id="cmLink" value="' + esc(c.link || 'pages/campaigns.html') + '"></div></div>' +
      '<div class="form-group"><label class="form-label">Gradient</label><input class="input" id="cmGrad" value="' + esc(c.gradient || 'linear-gradient(135deg,#FF0000,#990000)') + '"></div></form>';
    openDrawer(isNew ? 'Yeni kampaniya' : 'Kampaniya redaktə', body,
      '<button type="button" class="btn btn-ghost" id="drawerCancel">Ləğv</button>' +
      '<button type="button" class="btn btn-primary" id="drawerSave">Yadda saxla</button>');
    document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
    document.getElementById('drawerSave').addEventListener('click', async function () {
      var item = {
        id: c.id || ('camp-' + Date.now()),
        title: document.getElementById('cmTitle').value.trim(),
        subtitle: c.subtitle || 'Admin',
        description: document.getElementById('cmDesc').value.trim(),
        discount: Number(document.getElementById('cmDisc').value) || 0,
        endDate: document.getElementById('cmEnd').value ? new Date(document.getElementById('cmEnd').value).toISOString() : new Date().toISOString(),
        type: document.getElementById('cmType').value.trim() || 'promo',
        link: document.getElementById('cmLink').value.trim(),
        gradient: document.getElementById('cmGrad').value.trim(),
        productIds: c.productIds || []
      };
      if (!item.title) { NexoraToast.error('Başlıq məcburidir'); return; }
      if (isNew) all.push(item);
      else all[idx] = Object.assign({}, c, item);
      await saveCms('campaigns', { campaigns: all });
      closeDrawer();
      NexoraToast.success('Kampaniya saxlandı');
      render();
    });
  }

  async function renderHero() {
    var data = await getCms('hero');
    var slides = data.slides || [];
    var rows = slides.map(function (s, idx) {
      return '<tr><td>' + esc(s.title) + '</td><td>' + esc(s.subtitle || '') + '</td>' +
        '<td>' + esc(s.badge || '') + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-hero="' + idx + '">Redaktə</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-hero="' + idx + '">Sil</button></div></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Hero slaydları</h1></div>' +
        '<button type="button" class="btn btn-primary" id="addHero">+ Slayd</button></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Başlıq</th><th>Alt başlıq</th><th>Badge</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    document.getElementById('addHero').addEventListener('click', function () { openHeroDrawer(null, slides); });
    document.querySelectorAll('[data-edit-hero]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openHeroDrawer(slides[parseInt(btn.getAttribute('data-edit-hero'), 10)], slides, parseInt(btn.getAttribute('data-edit-hero'), 10));
      });
    });
    document.querySelectorAll('[data-del-hero]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-del-hero'), 10);
        confirmAction({
          title: 'Slaydı sil?',
          onConfirm: async function () {
            slides.splice(idx, 1);
            await saveCms('hero', { slides: slides });
            NexoraToast.success('Silindi');
            render();
          }
        });
      });
    });
  }

  function openHeroDrawer(slide, all, idx) {
    var isNew = !slide;
    var s = slide || {};
    var body = '<form><div class="form-group"><label class="form-label">Başlıq</label><input class="input" id="hTitle" value="' + esc(s.title || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Alt başlıq</label><input class="input" id="hSub" value="' + esc(s.subtitle || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Təsvir</label><textarea class="input" id="hDesc" rows="2">' + esc(s.description || '') + '</textarea></div>' +
      '<div class="form-row"><div class="form-group"><label class="form-label">CTA mətn</label><input class="input" id="hCta" value="' + esc(s.ctaText || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">CTA link</label><input class="input" id="hLink" value="' + esc(s.ctaLink || '') + '"></div></div>' +
      '<div class="form-group"><label class="form-label">Badge</label><input class="input" id="hBadge" value="' + esc(s.badge || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Şəkil URL</label><input class="input" id="hImage" value="' + esc(s.image || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Gradient</label><input class="input" id="hGrad" value="' + esc(s.gradient || 'linear-gradient(135deg,#111,#FF0000)') + '"></div></form>';
    openDrawer(isNew ? 'Yeni slayd' : 'Slayd redaktə', body,
      '<button type="button" class="btn btn-ghost" id="drawerCancel">Ləğv</button>' +
      '<button type="button" class="btn btn-primary" id="drawerSave">Yadda saxla</button>');
    document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
    document.getElementById('drawerSave').addEventListener('click', async function () {
      var item = {
        id: s.id || Date.now(),
        title: document.getElementById('hTitle').value.trim(),
        subtitle: document.getElementById('hSub').value.trim(),
        description: document.getElementById('hDesc').value.trim(),
        ctaText: document.getElementById('hCta').value.trim(),
        ctaLink: document.getElementById('hLink').value.trim(),
        badge: document.getElementById('hBadge').value.trim(),
        image: document.getElementById('hImage').value.trim(),
        gradient: document.getElementById('hGrad').value.trim()
      };
      if (!item.title) { NexoraToast.error('Başlıq məcburidir'); return; }
      if (isNew) all.push(item);
      else all[idx] = Object.assign({}, s, item);
      await saveCms('hero', { slides: all });
      closeDrawer();
      NexoraToast.success('Slayd saxlandı');
      render();
    });
  }

  async function renderFaq() {
    var data = await getCms('faq');
    var faqs = data.faqs || [];
    var rows = faqs.map(function (f, idx) {
      return '<tr><td>' + esc(f.category || '') + '</td><td>' + esc(f.question) + '</td>' +
        '<td class="text-sm">' + esc((f.answer || '').length > 80 ? (f.answer || '').slice(0, 80) + '…' : (f.answer || '')) + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-faq="' + idx + '">Redaktə</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-faq="' + idx + '">Sil</button></div></td></tr>';
    }).join('');
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>FAQ</h1></div>' +
        '<button type="button" class="btn btn-primary" id="addFaq">+ Sual</button></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Kateqoriya</th><th>Sual</th><th>Cavab</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    document.getElementById('addFaq').addEventListener('click', function () { openFaqDrawer(null, faqs); });
    document.querySelectorAll('[data-edit-faq]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openFaqDrawer(faqs[parseInt(btn.getAttribute('data-edit-faq'), 10)], faqs, parseInt(btn.getAttribute('data-edit-faq'), 10));
      });
    });
    document.querySelectorAll('[data-del-faq]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-del-faq'), 10);
        confirmAction({
          title: 'Sualı sil?',
          onConfirm: async function () {
            faqs.splice(idx, 1);
            await saveCms('faq', { faqs: faqs });
            NexoraToast.success('Silindi');
            render();
          }
        });
      });
    });
  }

  function openFaqDrawer(faq, all, idx) {
    var isNew = !faq;
    var f = faq || { category: 'Ümumi' };
    var body = '<form><div class="form-group"><label class="form-label">Kateqoriya</label><input class="input" id="fqCat" value="' + esc(f.category || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Sual</label><input class="input" id="fqQ" value="' + esc(f.question || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Cavab</label><textarea class="input" id="fqA" rows="4">' + esc(f.answer || '') + '</textarea></div></form>';
    openDrawer(isNew ? 'Yeni sual' : 'FAQ redaktə', body,
      '<button type="button" class="btn btn-ghost" id="drawerCancel">Ləğv</button>' +
      '<button type="button" class="btn btn-primary" id="drawerSave">Yadda saxla</button>');
    document.getElementById('drawerCancel').addEventListener('click', closeDrawer);
    document.getElementById('drawerSave').addEventListener('click', async function () {
      var item = {
        id: f.id || ('f' + Date.now()),
        category: document.getElementById('fqCat').value.trim(),
        question: document.getElementById('fqQ').value.trim(),
        answer: document.getElementById('fqA').value.trim()
      };
      if (!item.question) { NexoraToast.error('Sual məcburidir'); return; }
      if (isNew) all.push(item);
      else all[idx] = Object.assign({}, f, item);
      await saveCms('faq', { faqs: all });
      closeDrawer();
      NexoraToast.success('FAQ saxlandı');
      render();
    });
  }

  function downloadApiFile(file) {
    var blob = file.blob || file;
    var name = file.filename || 'nexora-export.bin';
    var a = document.createElement('a');
    var href = URL.createObjectURL(blob);
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
    return name;
  }

  async function renderBusiness() {
    if (!state.apiLive) {
      document.getElementById('adminContent').innerHTML =
        '<div class="admin-card"><div class="admin-card-body"><p class="text-muted">API server lazımdır (8787).</p></div></div>';
      return;
    }
    var data;
    try {
      data = await NexoraApi.businessAdminOverview();
    } catch (e) {
      document.getElementById('adminContent').innerHTML =
        '<div class="admin-card"><div class="admin-card-body"><p>' + esc(e.message || 'Xəta') + '</p></div></div>';
      return;
    }
    var st = data.stats || {};
    var tab = state.business.tab || 'overview';
    var tabs = [
      ['overview', 'Ümumi'],
      ['companies', 'Şirkətlər'],
      ['quotes', 'Təkliflər'],
      ['contracts', 'Müqavilələr'],
      ['orders', 'B2B sifarişlər']
    ];
    var tabBtns = tabs.map(function (t) {
      return '<button type="button" class="btn btn-sm ' + (tab === t[0] ? 'btn-primary' : 'btn-outline') +
        '" data-biz-admin-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join(' ');

    var body = '';
    if (tab === 'overview' || tab === 'companies') {
      body +=
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Şirkət hesabları</h3></div>' +
        '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Şirkət</th><th>VÖEN</th><th>Əlaqə</th><th>E-poçt</th><th>Təklif</th><th>Müqavilə</th><th>Sifariş</th>' +
        '</tr></thead><tbody>' +
        ((data.companies || []).map(function (c) {
          return '<tr><td><strong>' + esc(c.companyName) + '</strong></td><td>' + esc(c.voen) + '</td>' +
            '<td>' + esc(c.contactPerson) + '<div class="text-xs text-muted">' + esc(c.contactPhone) + '</div></td>' +
            '<td class="text-sm">' + esc(c.contactEmail || c.userEmail) + '</td>' +
            '<td>' + (c.quotesCount || 0) + '</td><td>' + (c.contractsCount || 0) + '</td><td>' + (c.ordersCount || 0) + '</td></tr>';
        }).join('') || '<tr><td colspan="7" class="admin-empty">Şirkət yoxdur</td></tr>') +
        '</tbody></table></div></div>';
    }
    if (tab === 'overview' || tab === 'quotes') {
      body +=
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Təkliflər</h3><span class="text-sm text-muted">PDF + status</span></div>' +
        '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>ID</th><th>Şirkət</th><th>Yekun</th><th>Status</th><th>Tarix</th><th>Əməliyyat</th>' +
        '</tr></thead><tbody>' +
        ((data.quotes || []).map(function (q) {
          var opts = BIZ_QUOTE_STATUSES.map(function (s) {
            return '<option value="' + s + '"' + (q.status === s ? ' selected' : '') + '>' + s + '</option>';
          }).join('');
          return '<tr><td><code class="text-xs">' + esc(q.id) + '</code></td>' +
            '<td>' + esc(q.companyName || q.userEmail) + '</td>' +
            '<td>' + money(q.totals && q.totals.total) + '</td>' +
            '<td><select class="input input-sm" data-quote-status="' + esc(q.id) + '">' + opts + '</select></td>' +
            '<td class="text-sm">' + esc(String(q.createdAt || '').slice(0, 10)) + '</td>' +
            '<td><button type="button" class="btn btn-primary btn-sm" data-admin-quote-pdf="' + esc(q.id) +
            '">PDF</button></td></tr>';
        }).join('') || '<tr><td colspan="6" class="admin-empty">Təklif yoxdur</td></tr>') +
        '</tbody></table></div></div>';
    }
    if (tab === 'overview' || tab === 'contracts') {
      body +=
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Müqavilələr</h3>' +
        '<span class="text-sm text-muted">draft → sent → signed → active</span></div>' +
        '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>ID</th><th>Şirkət</th><th>Təklif</th><th>Yekun</th><th>Status</th><th>Tarix</th><th>Əməliyyat</th>' +
        '</tr></thead><tbody>' +
        ((data.contracts || []).map(function (c) {
          var opts = BIZ_CONTRACT_STATUSES.map(function (s) {
            return '<option value="' + s + '"' + (c.status === s ? ' selected' : '') + '>' + s + '</option>';
          }).join('');
          var total = c.body && c.body.totals ? c.body.totals.total : 0;
          return '<tr><td><code class="text-xs">' + esc(c.id) + '</code></td>' +
            '<td>' + esc(c.companyName || c.userEmail) + '</td>' +
            '<td class="text-xs">' + esc(c.quoteId || '—') + '</td>' +
            '<td>' + money(total) + '</td>' +
            '<td><select class="input input-sm" data-contract-status="' + esc(c.id) + '">' + opts + '</select></td>' +
            '<td class="text-sm">' + esc(String(c.createdAt || '').slice(0, 10)) + '</td>' +
            '<td><button type="button" class="btn btn-primary btn-sm" data-admin-contract-pdf="' + esc(c.id) +
            '">PDF</button></td></tr>';
        }).join('') || '<tr><td colspan="7" class="admin-empty">Müqavilə yoxdur</td></tr>') +
        '</tbody></table></div></div>';
    }
    if (tab === 'overview' || tab === 'orders') {
      body +=
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>B2B sifarişlər</h3></div>' +
        '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Sifariş</th><th>Şirkət</th><th>Status</th><th>Məhsul</th><th>Yekun</th><th>Tarix</th>' +
        '</tr></thead><tbody>' +
        ((data.orders || []).map(function (o) {
          return '<tr><td><code class="text-xs">' + esc(o.id) + '</code></td>' +
            '<td>' + esc(o.companyName || o.userEmail) + '</td>' +
            '<td>' + esc(o.status) + '</td><td>' + (o.itemCount || 0) + '</td>' +
            '<td>' + money(o.totals && o.totals.total) + '</td>' +
            '<td class="text-sm">' + esc(String(o.createdAt || '').slice(0, 10)) + '</td></tr>';
        }).join('') || '<tr><td colspan="6" class="admin-empty">B2B sifariş yoxdur</td></tr>') +
        '</tbody></table></div></div>';
    }

    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Business / B2B</h1>' +
        '<p>Bütün şirkət hesabları, təkliflər, müqavilələr və Excel export — business panelin admin tərəfi</p></div>' +
        '<div class="flex gap-2 flex-wrap">' +
          '<button type="button" class="btn btn-primary btn-sm" data-biz-export="all">Excel (hamısı)</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-biz-export="quotes">Excel təkliflər</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-biz-export="contracts">Excel müqavilələr</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-biz-export="companies">Excel şirkətlər</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-biz-export="orders">Excel sifarişlər</button>' +
          '<a class="btn btn-ghost btn-sm" href="../business.html" target="_blank" rel="noopener">Business panel →</a>' +
        '</div></div>' +
      '<div class="admin-stats mb-4">' +
        '<div class="admin-stat"><div class="admin-stat-label">Şirkətlər</div><div class="admin-stat-value">' + (st.companies || 0) + '</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-label">Təkliflər</div><div class="admin-stat-value">' + (st.quotes || 0) + '</div>' +
          '<div class="text-xs text-muted">' + money(st.quoteVolume || 0) + '</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-label">Müqavilələr</div><div class="admin-stat-value">' + (st.contracts || 0) + '</div>' +
          '<div class="text-xs text-muted">imzalı: ' + (st.contractsSigned || 0) + '</div></div>' +
        '<div class="admin-stat"><div class="admin-stat-label">B2B sifariş</div><div class="admin-stat-value">' + (st.orders || 0) + '</div>' +
          '<div class="text-xs text-muted">' + money(st.orderVolume || 0) + '</div></div>' +
      '</div>' +
      '<div class="flex gap-2 flex-wrap mb-4">' + tabBtns + '</div>' +
      body;

    document.querySelectorAll('[data-biz-admin-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.business.tab = btn.getAttribute('data-biz-admin-tab');
        renderBusiness();
      });
    });

    document.querySelectorAll('[data-biz-export]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var kind = btn.getAttribute('data-biz-export');
        try {
          NexoraToast.info('Excel hazırlanır…');
          var file = await NexoraApi.businessAdminExport(kind, 'xls');
          var name = downloadApiFile(file);
          NexoraToast.success('Excel yükləndi: ' + name);
        } catch (err) {
          NexoraToast.error(err.message || 'Export xətası');
        }
      });
    });

    document.querySelectorAll('[data-admin-quote-pdf]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          NexoraToast.info('PDF təklif hazırlanır…');
          var file = await NexoraApi.businessAdminQuotePdf(btn.getAttribute('data-admin-quote-pdf'));
          NexoraToast.success('PDF: ' + downloadApiFile(file));
        } catch (err) {
          NexoraToast.error(err.message || 'PDF xətası');
        }
      });
    });

    document.querySelectorAll('[data-admin-contract-pdf]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          NexoraToast.info('PDF müqavilə hazırlanır…');
          var file = await NexoraApi.businessAdminContractPdf(btn.getAttribute('data-admin-contract-pdf'));
          NexoraToast.success('PDF: ' + downloadApiFile(file));
        } catch (err) {
          NexoraToast.error(err.message || 'PDF xətası');
        }
      });
    });

    document.querySelectorAll('[data-quote-status]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        try {
          await NexoraApi.businessAdminSetQuoteStatus(sel.getAttribute('data-quote-status'), sel.value);
          NexoraToast.success('Təklif statusu: ' + sel.value);
        } catch (err) {
          NexoraToast.error(err.message || 'Status xətası');
          renderBusiness();
        }
      });
    });

    document.querySelectorAll('[data-contract-status]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        try {
          await NexoraApi.businessAdminSetContractStatus(sel.getAttribute('data-contract-status'), sel.value);
          NexoraToast.success('Müqavilə statusu: ' + sel.value);
        } catch (err) {
          NexoraToast.error(err.message || 'Status xətası');
          renderBusiness();
        }
      });
    });
  }

  async function renderReferrals() {
    if (!state.apiLive) {
      document.getElementById('adminContent').innerHTML =
        '<div class="admin-card"><div class="admin-card-body"><p class="text-muted">API server lazımdır.</p></div></div>';
      return;
    }
    var settingsRes;
    var listRes;
    try {
      settingsRes = await NexoraApi.getReferralSettings();
      listRes = await NexoraApi.listReferrals();
    } catch (e) {
      document.getElementById('adminContent').innerHTML =
        '<div class="admin-card"><div class="admin-card-body"><p>' + esc(e.message || 'Xəta') + '</p></div></div>';
      return;
    }
    var s = settingsRes.referral || {};
    var top = (listRes.top || []).map(function (u) {
      return '<tr><td>' + esc(u.name) + '</td><td><code>' + esc(u.referral_code) + '</code></td>' +
        '<td>' + (u.wins || 0) + '</td><td>' + money(u.referral_credit || 0) + '</td></tr>';
    }).join('');
    var events = (listRes.events || []).slice(0, 40).map(function (e) {
      return '<tr><td>' + esc(e.code) + '</td><td>' + esc(e.referrer_name || e.referrer_id) + '</td>' +
        '<td>' + esc(e.referee_email || '—') + '</td><td>' + esc(e.status) + '</td>' +
        '<td>' + money(e.discount_amount) + '</td><td>' + money(e.reward_amount) + '</td>' +
        '<td class="text-sm">' + esc(e.order_id || '') + '</td></tr>';
    }).join('');

    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Dost kodu</h1><p>Referral endirim və bonus ayarları</p></div></div>' +
      '<form id="refSettingsForm" class="mb-4">' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Ayarlar</h3></div><div class="admin-card-body">' +
          '<label class="flex items-center gap-2 mb-3"><input type="checkbox" id="refEnabled"' + (s.enabled !== false ? ' checked' : '') + '> Proqram aktiv</label>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Dost endirimi %</label><input class="input" type="number" id="refPct" value="' + esc(s.friendDiscountPercent) + '"></div>' +
            '<div class="form-group"><label class="form-label">Sabit endirim ₼</label><input class="input" type="number" id="refFixed" value="' + esc(s.friendDiscountFixed) + '"></div>' +
            '<div class="form-group"><label class="form-label">Max endirim ₼</label><input class="input" type="number" id="refMax" value="' + esc(s.maxFriendDiscount) + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Min. sifariş ₼</label><input class="input" type="number" id="refMin" value="' + esc(s.minOrder) + '"></div>' +
            '<div class="form-group"><label class="form-label">Referrer bonus ₼</label><input class="input" type="number" id="refReward" value="' + esc(s.referrerRewardAz) + '"></div>' +
            '<div class="form-group"><label class="form-label">Kod prefiksi</label><input class="input" id="refPrefix" value="' + esc(s.codePrefix || 'DOST') + '"></div>' +
          '</div>' +
          '<label class="flex items-center gap-2 mb-2"><input type="checkbox" id="refStack"' + (s.allowStackWithCoupon ? ' checked' : '') + '> Kuponla birlikdə (stack)</label>' +
          '<label class="flex items-center gap-2 mb-3"><input type="checkbox" id="refCredit"' + (s.applyCreditAtCheckout !== false ? ' checked' : '') + '> Checkout-da referral balansı</label>' +
          '<button type="submit" class="btn btn-primary">Yadda saxla</button>' +
        '</div></div></form>' +
      '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Top dəvət edənlər</h3></div>' +
        '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Ad</th><th>Kod</th><th>Uğur</th><th>Balans</th></tr></thead><tbody>' +
        (top || '<tr><td colspan="4" class="admin-empty">Hələ yoxdur</td></tr>') + '</tbody></table></div></div>' +
      '<div class="admin-card"><div class="admin-card-head"><h3>Son eventlər</h3></div>' +
        '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
        '<th>Kod</th><th>Referrer</th><th>Dost</th><th>Status</th><th>Endirim</th><th>Bonus</th><th>Sifariş</th></tr></thead><tbody>' +
        (events || '<tr><td colspan="7" class="admin-empty">Event yoxdur</td></tr>') + '</tbody></table></div></div>';

    document.getElementById('refSettingsForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await NexoraApi.saveReferralSettings({
          enabled: document.getElementById('refEnabled').checked,
          friendDiscountPercent: Number(document.getElementById('refPct').value) || 0,
          friendDiscountFixed: Number(document.getElementById('refFixed').value) || 0,
          maxFriendDiscount: Number(document.getElementById('refMax').value) || 0,
          minOrder: Number(document.getElementById('refMin').value) || 0,
          referrerRewardAz: Number(document.getElementById('refReward').value) || 0,
          codePrefix: document.getElementById('refPrefix').value.trim() || 'DOST',
          allowStackWithCoupon: document.getElementById('refStack').checked,
          applyCreditAtCheckout: document.getElementById('refCredit').checked
        });
        NexoraToast.success('Referral ayarları saxlandı');
        render();
      } catch (err) {
        NexoraToast.error(err.message || 'Xəta');
      }
    });
  }

  async function renderPayments() {
    if (!state.apiLive) {
      document.getElementById('adminContent').innerHTML =
        '<div class="admin-page-head"><div><h1>Ödəniş</h1><p>API server lazımdır</p></div></div>' +
        '<div class="admin-card"><div class="admin-card-body">' +
          '<p class="text-muted">Ödəniş ayarları yalnız API ilə işləyir. <code>server/</code> qovluğunda <code>npm start</code> işə salın.</p>' +
        '</div></div>';
      return;
    }
    var res;
    try {
      res = await NexoraApi.getPaymentSettings();
    } catch (e) {
      document.getElementById('adminContent').innerHTML =
        '<div class="admin-card"><div class="admin-card-body"><p class="text-muted">' + esc(e.message || 'Yüklənmədi') + '</p></div></div>';
      return;
    }
    var p = res.payment || {};
    var methods = p.methods || {};
    var bank = p.bank || {};
    var gw = p.gateway || {};
    var liveReady = !!(gw.merchantId && gw.authKey);

    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Ödəniş ayarları</h1>' +
        '<p>Sandbox indi işləyir · Live üçün bank / GoldenPay merchant açın</p></div>' +
        '<span class="admin-pill ' + (p.mode === 'live' ? 'is-offline' : 'is-live') + '">' +
          esc((p.mode || 'sandbox').toUpperCase()) + '</span></div>' +
      '<form id="paySettingsForm">' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Ümumi</h3></div><div class="admin-card-body">' +
          '<label class="flex items-center gap-2 mb-3"><input type="checkbox" id="payEnabled"' + (p.enabled !== false ? ' checked' : '') + '> Ödəniş aktiv</label>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Rejim</label>' +
              '<select class="input" id="payMode">' +
                '<option value="sandbox"' + (p.mode !== 'live' ? ' selected' : '') + '>Sandbox (test)</option>' +
                '<option value="live"' + (p.mode === 'live' ? ' selected' : '') + '>Live (real pul)</option>' +
              '</select></div>' +
            '<div class="form-group"><label class="form-label">Provayder</label>' +
              '<select class="input" id="payProvider">' +
                '<option value="sandbox"' + ((p.provider || 'sandbox') === 'sandbox' ? ' selected' : '') + '>Sandbox</option>' +
                '<option value="goldenpay"' + (p.provider === 'goldenpay' ? ' selected' : '') + '>GoldenPay</option>' +
                '<option value="manual"' + (p.provider === 'manual' ? ' selected' : '') + '>Manual / köçürmə</option>' +
              '</select></div>' +
            '<div class="form-group"><label class="form-label">Merchant adı</label>' +
              '<input class="input" id="payMerchant" value="' + esc(p.merchantName || 'NEXORA') + '"></div>' +
          '</div>' +
          '<div class="flex gap-4 flex-wrap mt-2">' +
            '<label class="flex items-center gap-2"><input type="checkbox" id="mCard"' + (methods.card !== false ? ' checked' : '') + '> Kart</label>' +
            '<label class="flex items-center gap-2"><input type="checkbox" id="mCash"' + (methods.cash !== false ? ' checked' : '') + '> Nağd</label>' +
            '<label class="flex items-center gap-2"><input type="checkbox" id="mTransfer"' + (methods.transfer !== false ? ' checked' : '') + '> Bank köçürməsi</label>' +
          '</div>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Bank rekvizitləri (köçürmə)</h3></div><div class="admin-card-body">' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Bank</label><input class="input" id="bankName" value="' + esc(bank.bankName || '') + '"></div>' +
            '<div class="form-group"><label class="form-label">Alan ad</label><input class="input" id="bankAccount" value="' + esc(bank.accountName || '') + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">IBAN</label><input class="input" id="bankIban" value="' + esc(bank.iban || '') + '" placeholder="AZ00…"></div>' +
            '<div class="form-group"><label class="form-label">VÖEN</label><input class="input" id="bankVoen" value="' + esc(bank.voen || '') + '"></div>' +
          '</div>' +
          '<p class="text-sm text-muted mb-0">Bu məlumatlar müştəriyə köçürmə səhifəsində göstərilir. Pul birbaşa bu hesaba gəlir.</p>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Gateway (GoldenPay / bank)</h3></div><div class="admin-card-body">' +
          '<p class="text-sm text-muted mb-3">Live kart ödənişi üçün bankdan aldığınız merchant açarlarını yazın. ' +
            (liveReady ? '<strong style="color:var(--color-success)">Açarlar var.</strong>' : '<strong>Hələ konfiqurasiya olunmayıb.</strong>') + '</p>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Merchant ID</label><input class="input" id="gwMerchantId" value="' + esc(gw.merchantId || '') + '" autocomplete="off"></div>' +
            '<div class="form-group"><label class="form-label">Auth Key</label><input class="input" id="gwAuthKey" type="password" value="' + esc(gw.authKey || '') + '" autocomplete="new-password"></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">API URL</label><input class="input" id="gwApiUrl" value="' + esc(gw.apiUrl || 'https://rest.goldenpay.az/api') + '"></div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Success URL</label><input class="input" id="gwSuccess" value="' + esc(gw.successUrl || '') + '" placeholder="boş = avtomatik"></div>' +
            '<div class="form-group"><label class="form-label">Fail URL</label><input class="input" id="gwFail" value="' + esc(gw.failUrl || '') + '"></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Webhook secret</label><input class="input" id="gwWebhook" value="' + esc(gw.webhookSecret || '') + '"></div>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Sandbox ipucu</h3></div><div class="admin-card-body">' +
          '<div class="form-group"><label class="form-label">Müştəriyə göstərilən test mətni</label>' +
            '<input class="input" id="payHint" value="' + esc(p.sandboxHint || '') + '"></div>' +
          '<p class="text-sm text-muted mb-0">Test kart: <code>4111 1111 1111 1111</code> · 12/30 · 123 · Rədd: <code>4000000000000002</code></p>' +
        '</div></div>' +
        '<button type="submit" class="btn btn-primary">Yadda saxla</button>' +
      '</form>';

    document.getElementById('paySettingsForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await NexoraApi.savePaymentSettings({
          enabled: document.getElementById('payEnabled').checked,
          mode: document.getElementById('payMode').value,
          provider: document.getElementById('payProvider').value,
          merchantName: document.getElementById('payMerchant').value.trim() || 'NEXORA',
          methods: {
            card: document.getElementById('mCard').checked,
            cash: document.getElementById('mCash').checked,
            transfer: document.getElementById('mTransfer').checked
          },
          bank: {
            bankName: document.getElementById('bankName').value.trim(),
            accountName: document.getElementById('bankAccount').value.trim(),
            iban: document.getElementById('bankIban').value.trim(),
            voen: document.getElementById('bankVoen').value.trim()
          },
          gateway: {
            merchantId: document.getElementById('gwMerchantId').value.trim(),
            authKey: document.getElementById('gwAuthKey').value.trim(),
            apiUrl: document.getElementById('gwApiUrl').value.trim(),
            successUrl: document.getElementById('gwSuccess').value.trim(),
            failUrl: document.getElementById('gwFail').value.trim(),
            webhookSecret: document.getElementById('gwWebhook').value.trim()
          },
          sandboxHint: document.getElementById('payHint').value.trim()
        });
        NexoraToast.success('Ödəniş ayarları saxlandı');
        render();
      } catch (err) {
        NexoraToast.error(err.message || 'Saxlanılmadı');
      }
    });
  }

  async function renderLiveChat() {
    if (!state.apiLive || typeof NexoraApi === 'undefined' || !NexoraApi.chatAdminThreads) {
      document.getElementById('adminContent').innerHTML =
        '<div class="admin-page-head"><div><h1>Live Chat</h1><p>API lazımdır</p></div></div>' +
        '<p class="text-muted">Chat üçün server API aktiv olmalıdır.</p>';
      return;
    }

    var data = await NexoraApi.chatAdminThreads();
    var threads = data.threads || [];
    if (!chatState.threadId && threads.length) chatState.threadId = threads[0].id;

    var listHtml = threads.map(function (t) {
      var active = t.id === chatState.threadId ? ' is-active' : '';
      var unread = t.unreadAdmin ? (' <span class="admin-pill is-warn">' + t.unreadAdmin + '</span>') : '';
      var pend = !t.approved ? ' <span class="admin-pill is-warn">gözləyir</span>' : '';
      return '<button type="button" class="admin-chat-thread' + active + '" data-chat-thread="' + esc(t.id) + '">' +
        '<strong>' + esc(t.name || t.phone || 'İstifadəçi') + unread + pend + '</strong>' +
        '<span>' + esc(t.topic ? ('Mövzu: ' + t.topic) : (t.lastMessage || '—')) + '</span></button>';
    }).join('') || '<p class="text-muted p-3">Hələ mesaj yoxdur.</p>';

    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Live Chat</h1><p>' +
        (data.unread ? (data.unread + ' oxunmamış') : 'Müştəri yazışmaları') +
      '</p></div>' +
        '<button type="button" class="btn btn-outline" id="chatRefresh">Yenilə</button></div>' +
      '<div class="admin-chat-layout">' +
        '<div class="admin-chat-list">' + listHtml + '</div>' +
        '<div class="admin-chat-main" id="adminChatMain"><p class="text-muted">Söhbət seçin</p></div>' +
      '</div>' +
      '<style>' +
        '.admin-chat-layout{display:grid;grid-template-columns:280px 1fr;gap:12px;min-height:520px}' +
        '.admin-chat-list{border:1px solid var(--color-border,#e5e5e5);border-radius:12px;overflow:auto;background:var(--color-bg,#fff)}' +
        '.admin-chat-thread{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eee;background:transparent;padding:12px;cursor:pointer}' +
        '.admin-chat-thread strong{display:flex;justify-content:space-between;gap:8px;font-size:13px}' +
        '.admin-chat-thread span{display:block;color:#777;font-size:12px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.admin-chat-thread.is-active{background:rgba(255,0,0,.06)}' +
        '.admin-chat-main{border:1px solid var(--color-border,#e5e5e5);border-radius:12px;display:flex;flex-direction:column;min-height:520px;background:var(--color-bg,#fff)}' +
        '.admin-chat-msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f7f7f8}' +
        '.admin-chat-bubble{max-width:80%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.4;white-space:pre-wrap}' +
        '.admin-chat-bubble.is-visitor{align-self:flex-start;background:#fff;border:1px solid #e8e8ea}' +
        '.admin-chat-bubble.is-admin{align-self:flex-end;background:#FF0000;color:#fff}' +
        '.admin-chat-bubble.is-system{align-self:center;color:#888;background:transparent}' +
        '.admin-chat-compose{display:flex;gap:8px;padding:12px;border-top:1px solid #eee}' +
        '.admin-chat-compose input{flex:1}' +
        '@media(max-width:900px){.admin-chat-layout{grid-template-columns:1fr}}' +
      '</style>';

    async function openThread(id) {
      chatState.threadId = id;
      chatState.lastId = '';
      var detail = await NexoraApi.chatAdminThread(id);
      var t = detail.thread || {};
      var msgs = detail.messages || [];
      var main = document.getElementById('adminChatMain');
      main.innerHTML =
        '<div class="p-3" style="border-bottom:1px solid #eee;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<div><strong>' + esc(t.name || 'İstifadəçi') +
            (t.approved ? '' : ' <span class="admin-pill is-warn">təsdiq gözləyir</span>') + '</strong>' +
            '<div class="text-xs text-muted">' + esc([t.phone, t.email].filter(Boolean).join(' · ') || t.id) + '</div>' +
            (t.topic ? '<div class="text-xs" style="margin-top:4px"><strong>Mövzu:</strong> ' + esc(t.topic) + '</div>' : '') +
          '</div>' +
          '<div class="flex gap-2">' +
            (!t.approved
              ? '<button type="button" class="btn btn-primary btn-sm" id="chatApprove">Təsdiqlə</button>'
              : '') +
            '<button type="button" class="btn btn-outline btn-sm" id="chatToggleStatus">' +
              (t.status === 'closed' ? 'Yenidən aç' : 'Bağla') + '</button>' +
            '<button type="button" class="btn btn-outline btn-sm" id="chatDelete" style="color:#c00;border-color:#f0b0b0">Sil</button>' +
          '</div>' +
        '</div>' +
        '<div class="admin-chat-msgs" id="adminChatMsgs"></div>' +
        '<form class="admin-chat-compose" id="adminChatForm">' +
          '<input class="input" id="adminChatInput" placeholder="Cavab yazın…" maxlength="2000" ' +
            (t.status === 'closed' ? 'disabled' : '') + '>' +
          '<button class="btn btn-primary" type="submit"' + (t.status === 'closed' ? ' disabled' : '') + '>Göndər</button>' +
        '</form>';

      var box = document.getElementById('adminChatMsgs');
      msgs.forEach(function (m) {
        var div = document.createElement('div');
        div.className = 'admin-chat-bubble is-' + (m.sender || 'system');
        div.id = 'acm-' + m.id;
        div.textContent = m.body || '';
        box.appendChild(div);
        chatState.lastId = m.id;
      });
      box.scrollTop = box.scrollHeight;

      document.getElementById('adminChatForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var input = document.getElementById('adminChatInput');
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        try {
          var r = await NexoraApi.chatAdminReply(id, text);
          if (r && r.message) {
            var div = document.createElement('div');
            div.className = 'admin-chat-bubble is-admin';
            div.id = 'acm-' + r.message.id;
            div.textContent = r.message.body;
            box.appendChild(div);
            chatState.lastId = r.message.id;
            box.scrollTop = box.scrollHeight;
          }
        } catch (err) {
          NexoraToast.error(err.message || 'Göndərilmədi');
        }
      });

      var approveBtn = document.getElementById('chatApprove');
      if (approveBtn) {
        approveBtn.addEventListener('click', async function () {
          try {
            await NexoraApi.chatAdminApprove(id);
            NexoraToast.success('Söhbət təsdiqləndi');
            renderLiveChat();
          } catch (err) {
            NexoraToast.error(err.message || 'Təsdiq alınmadı');
          }
        });
      }

      document.getElementById('chatToggleStatus').addEventListener('click', async function () {
        var next = t.status === 'closed' ? 'open' : 'closed';
        await NexoraApi.chatAdminSetStatus(id, next);
        NexoraToast.success(next === 'closed' ? 'Söhbət bağlandı' : 'Söhbət açıldı');
        renderLiveChat();
      });

      document.getElementById('chatDelete').addEventListener('click', async function () {
        var label = t.name || t.phone || 'bu söhbəti';
        if (!confirm('«' + label + '» söhbətini silmək istəyirsiniz? Mesajlar da silinəcək.')) return;
        try {
          await NexoraApi.chatAdminDelete(id);
          chatState.threadId = '';
          chatState.lastId = '';
          NexoraToast.success('Söhbət silindi');
          renderLiveChat();
        } catch (err) {
          NexoraToast.error(err.message || 'Silinmədi');
        }
      });

      document.querySelectorAll('[data-chat-thread]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-chat-thread') === id);
      });
    }

    document.querySelectorAll('[data-chat-thread]').forEach(function (btn) {
      btn.addEventListener('click', function () { openThread(btn.getAttribute('data-chat-thread')); });
    });
    document.getElementById('chatRefresh').addEventListener('click', function () { renderLiveChat(); });

    if (chatState.threadId) {
      try { await openThread(chatState.threadId); } catch (e) { /* ignore */ }
    }

    if (chatState.poll) clearInterval(chatState.poll);
    chatState.poll = setInterval(async function () {
      if (state.view !== 'livechat' || !chatState.threadId) return;
      try {
        var detail = await NexoraApi.chatAdminThread(chatState.threadId, chatState.lastId);
        var box = document.getElementById('adminChatMsgs');
        if (!box || !detail.messages) return;
        detail.messages.forEach(function (m) {
          if (document.getElementById('acm-' + m.id)) return;
          var div = document.createElement('div');
          div.className = 'admin-chat-bubble is-' + (m.sender || 'system');
          div.id = 'acm-' + m.id;
          div.textContent = m.body || '';
          box.appendChild(div);
          chatState.lastId = m.id;
        });
        box.scrollTop = box.scrollHeight;
      } catch (e) { /* ignore */ }
    }, 4000);
  }

  async function renderSite() {
    var s = await getCms('site');
    var nav = (s.nav || []).slice();
    document.getElementById('adminContent').innerHTML =
      '<div class="admin-page-head"><div><h1>Sayt redaktoru</h1><p>Logo, nav, footer, səhifə mətnləri</p></div></div>' +
      '<form id="siteForm">' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Brend</h3></div><div class="admin-card-body">' +
          '<div class="form-row"><div class="form-group"><label class="form-label">Logo mətni</label><input class="input" id="sLogoText" value="' + esc(s.logoText || s.brandName || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Logo şəkil URL</label><input class="input" id="sLogoImg" value="' + esc(s.logoImage || '') + '"></div></div>' +
          '<div class="form-row"><div class="form-group"><label class="form-label">Tagline</label><input class="input" id="sTagline" value="' + esc(s.tagline || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Accent rəng</label><input type="color" class="input" id="sAccent" value="' + esc(s.accentColor || '#FF0000') + '" style="height:44px;padding:4px"></div></div>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Əlaqə</h3></div><div class="admin-card-body">' +
          '<div class="form-row"><div class="form-group"><label class="form-label">WhatsApp</label><input class="input" id="sWa" value="' + esc(s.whatsapp || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Telegram</label><input class="input" id="sTg" value="' + esc(s.telegram || '') + '"></div></div>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Live Chat</h3></div><div class="admin-card-body">' +
          '<label class="flex items-center gap-2 mb-3"><input type="checkbox" id="lcEnabled"' +
            (!(s.liveChat && s.liveChat.enabled === false) ? ' checked' : '') + '> Live chat aktiv</label>' +
          '<label class="flex items-center gap-2 mb-3"><input type="checkbox" id="lcWaOn"' +
            (!(s.liveChat && s.liveChat.whatsappEnabled === false) ? ' checked' : '') + '> WhatsApp düyməsi (sağ alt)</label>' +
          '<div class="form-group"><label class="form-label">WhatsApp ilk mesaj</label>' +
            '<input class="input" id="lcWaMsg" value="' + esc((s.liveChat && s.liveChat.whatsappMessage) || 'Salam! NEXORA-dan yazıram.') + '"></div>' +
          '<div class="form-group"><label class="form-label">Tawk.to Property ID</label>' +
            '<input class="input" id="lcTawk" placeholder="xxxxxxxxxxxxxxxx/yyyyyyyyyyyy" value="' +
            esc((s.liveChat && s.liveChat.tawkPropertyId) || '') + '">' +
            '<p class="text-xs text-muted mt-1 mb-0">tawk.to → Admin → Channels → Chat Widget → Direct Chat Link / Property ID (məs: <code>62f.../1ga...</code>)</p></div>' +
          '<div class="form-group"><label class="form-label">Crisp Website ID (opsional)</label>' +
            '<input class="input" id="lcCrisp" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="' +
            esc((s.liveChat && s.liveChat.crispWebsiteId) || '') + '">' +
            '<p class="text-xs text-muted mt-1 mb-0">Tawk dolu olsa Crisp işləmir. Birini seçin.</p></div>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Promo bar</h3></div><div class="admin-card-body">' +
          '<label class="flex items-center gap-2 mb-3"><input type="checkbox" id="sPromoOn"' + (s.promoBar && s.promoBar.enabled ? ' checked' : '') + '> Aktiv</label>' +
          '<div class="form-group"><label class="form-label">Mətn</label><input class="input" id="sPromoText" value="' + esc((s.promoBar && s.promoBar.text) || '') + '"></div>' +
          '<div class="form-row"><div class="form-group"><label class="form-label">Link</label><input class="input" id="sPromoLink" value="' + esc((s.promoBar && s.promoBar.link) || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Link mətni</label><input class="input" id="sPromoLinkText" value="' + esc((s.promoBar && s.promoBar.linkText) || '') + '"></div></div>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Navbar</h3></div><div class="admin-card-body">' +
          '<div id="navEditor">' + nav.map(function (n, i) {
            return '<div class="form-row mb-2" data-nav-row="' + i + '">' +
              '<div class="form-group"><label class="form-label">Ad</label><input class="input" data-nav-label value="' + esc(n.label || '') + '"></div>' +
              '<div class="form-group"><label class="form-label">URL</label><input class="input" data-nav-href value="' + esc(n.href || '') + '"></div>' +
              '<div class="form-group" style="max-width:100px"><label class="form-label">ID</label><input class="input" data-nav-id value="' + esc(n.id || '') + '"></div>' +
              '<label class="flex items-center gap-2" style="padding-top:28px"><input type="checkbox" data-nav-vis' + (n.visible !== false ? ' checked' : '') + '> Görünür</label></div>';
          }).join('') + '</div>' +
          '<button type="button" class="btn btn-outline btn-sm mt-2" id="addNavItem">+ Nav link</button>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Footer</h3></div><div class="admin-card-body">' +
          '<div class="form-group"><label class="form-label">Təsvir</label><textarea class="input" id="sFootDesc" rows="2">' + esc((s.footer && s.footer.desc) || '') + '</textarea></div>' +
          '<div class="form-row"><div class="form-group"><label class="form-label">Facebook</label><input class="input" id="sFb" value="' + esc((s.footer && s.footer.facebook) || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Instagram</label><input class="input" id="sIg" value="' + esc((s.footer && s.footer.instagram) || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">YouTube</label><input class="input" id="sYt" value="' + esc((s.footer && s.footer.youtube) || '') + '"></div></div>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Ana səhifə hero</h3></div><div class="admin-card-body">' +
          '<div class="form-group"><label class="form-label">Hero başlıq</label><input class="input" id="sHeroHeadline" value="' +
            esc((s.home && s.home.heroHeadline) || '') + '" placeholder="Premium alış-veriş — NEXORA"></div>' +
          '<div class="form-group"><label class="form-label">Hero CTA mətn</label><input class="input" id="sHeroCta" value="' +
            esc((s.home && s.home.heroCta) || '') + '" placeholder="Kataloqa bax"></div>' +
          '<p class="text-xs text-muted mb-0">Boş buraxsanız hero-slides.json-dakı default mətnlər istifadə olunur.</p>' +
        '</div></div>' +
        '<div class="admin-card mb-4"><div class="admin-card-head"><h3>Səhifə mətnləri</h3></div><div class="admin-card-body">' +
          '<div class="form-group"><label class="form-label">Haqqımızda — başlıq</label><input class="input" id="sAboutTitle" value="' + esc((s.pages && s.pages.about && s.pages.about.title) || '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Haqqımızda — mətn</label><textarea class="input" id="sAboutBody" rows="4">' + esc((s.pages && s.pages.about && s.pages.about.body) || '') + '</textarea></div>' +
          '<div class="form-group"><label class="form-label">Əlaqə — mətn</label><textarea class="input" id="sContactBody" rows="3">' + esc((s.pages && s.pages.contact && s.pages.contact.body) || '') + '</textarea></div>' +
          '<div class="form-group"><label class="form-label">FAQ — mətn</label><textarea class="input" id="sFaqBody" rows="3">' + esc((s.pages && s.pages.faq && s.pages.faq.body) || '') + '</textarea></div>' +
        '</div></div>' +
        '<div class="flex gap-2 flex-wrap">' +
          '<button type="submit" class="btn btn-primary">Yadda saxla</button>' +
          '<button type="button" class="btn btn-outline" id="exportSite">Export site.json</button>' +
        '</div></form>';

    document.getElementById('addNavItem').addEventListener('click', function () {
      var wrap = document.getElementById('navEditor');
      var i = wrap.querySelectorAll('[data-nav-row]').length;
      wrap.insertAdjacentHTML('beforeend',
        '<div class="form-row mb-2" data-nav-row="' + i + '">' +
          '<div class="form-group"><label class="form-label">Ad</label><input class="input" data-nav-label value="Yeni"></div>' +
          '<div class="form-group"><label class="form-label">URL</label><input class="input" data-nav-href value="pages/"></div>' +
          '<div class="form-group" style="max-width:100px"><label class="form-label">ID</label><input class="input" data-nav-id value="custom' + i + '"></div>' +
          '<label class="flex items-center gap-2" style="padding-top:28px"><input type="checkbox" data-nav-vis checked> Görünür</label></div>');
    });

    document.getElementById('siteForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var nextNav = [];
      document.querySelectorAll('#navEditor [data-nav-row]').forEach(function (row) {
        nextNav.push({
          id: row.querySelector('[data-nav-id]').value.trim() || ('n' + Date.now()),
          label: row.querySelector('[data-nav-label]').value.trim(),
          href: row.querySelector('[data-nav-href]').value.trim(),
          visible: row.querySelector('[data-nav-vis]').checked
        });
      });
      var data = {
        brandName: document.getElementById('sLogoText').value.trim() || 'NEXORA',
        logoText: document.getElementById('sLogoText').value.trim(),
        logoImage: document.getElementById('sLogoImg').value.trim(),
        tagline: document.getElementById('sTagline').value.trim(),
        accentColor: document.getElementById('sAccent').value,
        whatsapp: document.getElementById('sWa').value.trim(),
        telegram: document.getElementById('sTg').value.trim(),
        liveChat: {
          enabled: document.getElementById('lcEnabled').checked,
          whatsappEnabled: document.getElementById('lcWaOn').checked,
          whatsappMessage: document.getElementById('lcWaMsg').value.trim() || 'Salam! NEXORA-dan yazıram.',
          tawkPropertyId: document.getElementById('lcTawk').value.trim(),
          crispWebsiteId: document.getElementById('lcCrisp').value.trim()
        },
        promoBar: {
          enabled: document.getElementById('sPromoOn').checked,
          text: document.getElementById('sPromoText').value.trim(),
          link: document.getElementById('sPromoLink').value.trim(),
          linkText: document.getElementById('sPromoLinkText').value.trim()
        },
        nav: nextNav,
        footer: {
          desc: document.getElementById('sFootDesc').value.trim(),
          facebook: document.getElementById('sFb').value.trim(),
          instagram: document.getElementById('sIg').value.trim(),
          youtube: document.getElementById('sYt').value.trim()
        },
        pages: {
          about: {
            title: document.getElementById('sAboutTitle').value.trim(),
            subtitle: (s.pages && s.pages.about && s.pages.about.subtitle) || '',
            body: document.getElementById('sAboutBody').value
          },
          contact: {
            title: (s.pages && s.pages.contact && s.pages.contact.title) || 'Əlaqə',
            subtitle: (s.pages && s.pages.contact && s.pages.contact.subtitle) || '',
            body: document.getElementById('sContactBody').value
          },
          faq: {
            title: (s.pages && s.pages.faq && s.pages.faq.title) || 'FAQ',
            subtitle: (s.pages && s.pages.faq && s.pages.faq.subtitle) || '',
            body: document.getElementById('sFaqBody').value
          }
        },
        home: {
          heroHeadline: document.getElementById('sHeroHeadline').value.trim(),
          heroCta: document.getElementById('sHeroCta').value.trim()
        }
      };
      await saveCms('site', data);
      NexoraToast.success('Sayt parametrləri saxlandı');
    });

    document.getElementById('exportSite').addEventListener('click', async function () {
      var data = await getCms('site');
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'site.json';
      a.click();
      NexoraToast.info('Export olundu — data/site.json əvəz edib deploy edin');
    });
  }

  function setView(name) {
    if (VIEWS.indexOf(name) === -1) name = 'dashboard';
    state.view = name;
    closeDrawer();
    document.querySelectorAll('[data-admin-nav]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-admin-nav') === name);
    });
    var meta = PAGE_TITLES[name] || PAGE_TITLES.dashboard;
    setTopbar(meta.title, meta.sub);
    var sidebar = document.getElementById('adminSidebar');
    if (sidebar) sidebar.classList.remove('is-open');
    render();
  }

  async function render() {
    if (!(await requireAdmin())) return;
    state.apiLive = await detectApi();
    updateMetaPills();
    var map = {
      dashboard: renderDashboard,
      analytics: renderAnalytics,
      products: renderProducts,
      inventory: renderInventory,
      orders: renderOrders,
      coupons: renderCoupons,
      users: renderUsers,
      categories: renderCategories,
      brands: renderBrands,
      campaigns: renderCampaigns,
      hero: renderHero,
      faq: renderFaq,
      site: renderSite,
      payments: renderPayments,
      referrals: renderReferrals,
      business: renderBusiness,
      livechat: renderLiveChat
    };
    await (map[state.view] || renderDashboard)();
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
  }

  async function bootAdmin() {
    try {
      if (typeof NexoraAccount !== 'undefined') await NexoraAccount.seedUsers();
    } catch (e) { /* ignore */ }
    state.apiLive = await detectApi();
    await render();
  }

  window.NexoraAdminBoot = bootAdmin;

  document.addEventListener('nexora:admin-login', function () {
    bootAdmin();
  });

  document.addEventListener('DOMContentLoaded', async function () {
    if (!document.getElementById('adminApp')) return;

    showGate(true);

    var drawerBg = document.getElementById('adminDrawerBg');
    var drawerClose = document.getElementById('adminDrawerClose');
    if (drawerBg) drawerBg.addEventListener('click', closeDrawer);
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);

    var menuBtn = document.getElementById('adminMenuBtn');
    var sidebar = document.getElementById('adminSidebar');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', function () {
        sidebar.classList.toggle('is-open');
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    document.querySelectorAll('[data-admin-nav]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        setView(link.getAttribute('data-admin-nav'));
      });
    });

    var logoutBtn = document.getElementById('adminLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (typeof NexoraApi !== 'undefined') NexoraApi.clearToken();
        if (typeof NexoraAccount !== 'undefined') NexoraAccount.logout();
        state.currentUser = null;
        if (typeof NexoraToast !== 'undefined') NexoraToast.info('Çıxış');
        showGate(true);
      });
    }

    try {
      if (typeof NexoraAccount !== 'undefined') await NexoraAccount.seedUsers();
    } catch (e) { /* ignore */ }

    try {
      state.apiLive = await detectApi();
      if (state.apiLive && typeof NexoraApi !== 'undefined' && NexoraApi.getToken()) {
        var me = await NexoraApi.me();
        if (me && me.user && me.user.role === 'admin') {
          state.currentUser = me.user;
          await bootAdmin();
          return;
        }
      }
      var session = await NexoraAccount.getSession();
      if (session && session.role === 'admin') {
        state.currentUser = session;
        await bootAdmin();
      }
    } catch (e) { /* stay on gate */ }
  });
})();
