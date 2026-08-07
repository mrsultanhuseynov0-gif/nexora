/**
 * NEXORA API client — talks to Express backend when available,
 * falls back to localStorage / JSON seed otherwise.
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'nexora-api-token';
  var API_BASE = '';
  var _configLoaded = false;

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* ignore */ }
  }

  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function url(path) {
    if (/^https?:/i.test(path)) return path;
    return API_BASE + path;
  }

  async function loadRuntimeConfig() {
    if (_configLoaded) return API_BASE;
    _configLoaded = true;

    if (typeof global.NEXORA_API_BASE === 'string' && global.NEXORA_API_BASE) {
      API_BASE = trimSlash(global.NEXORA_API_BASE);
      return API_BASE;
    }
    var meta = typeof document !== 'undefined'
      ? document.querySelector('meta[name="nexora-api-base"]')
      : null;
    if (meta && meta.getAttribute('content')) {
      API_BASE = trimSlash(meta.getAttribute('content'));
      return API_BASE;
    }
    try {
      var stored = localStorage.getItem('nexora-api-base');
      if (stored) {
        API_BASE = trimSlash(stored);
        return API_BASE;
      }
    } catch (e) { /* ignore */ }

    try {
      var res = await fetch('/config.json', { cache: 'no-store' });
      if (res.ok) {
        var data = await res.json();
        if (data && data.apiBase) API_BASE = trimSlash(data.apiBase);
      }
    } catch (e2) { /* same-origin offline */ }

    return API_BASE;
  }

  async function request(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    var res = await fetch(url(path), Object.assign({}, options, { headers: headers }));
    var data = null;
    var text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      var err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function probeHealth(base) {
    var prev = API_BASE;
    if (base != null) API_BASE = trimSlash(base);
    try {
      var data = await request('/api/health');
      return data && data.ok ? data : null;
    } catch (e) {
      API_BASE = prev;
      return null;
    }
  }

  var _healthCache = null;
  var _healthAt = 0;

  async function health() {
    var now = Date.now();
    if (_healthCache && (now - _healthAt) < 30000) return _healthCache;

    await loadRuntimeConfig();

    var same = await probeHealth(API_BASE || '');
    if (same) {
      _healthCache = same;
      _healthAt = now;
      return same;
    }

    // Local development only: try sibling API port when storefront ≠ API origin
    if (typeof location !== 'undefined' &&
        location.protocol.indexOf('http') === 0 &&
        /^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
      var host = location.hostname;
      var candidates = [
        location.protocol + '//' + host + ':8787',
        'http://127.0.0.1:8787',
        'http://localhost:8787'
      ];
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] === location.origin) continue;
        var hit = await probeHealth(candidates[i]);
        if (hit) {
          try { localStorage.setItem('nexora-api-base', API_BASE); } catch (e3) { /* ignore */ }
          _healthCache = hit;
          _healthAt = now;
          return hit;
        }
      }
    }
    return null;
  }

  async function ensureApi() {
    var h = await health();
    return !!(h && h.ok);
  }

  async function login(email, password) {
    var data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password })
    });
    setToken(data.token);
    return data;
  }

  async function me() {
    return request('/api/auth/me');
  }

  global.NexoraApi = {
    TOKEN_KEY: TOKEN_KEY,
    setBase: function (b) { API_BASE = trimSlash(b || ''); },
    getBase: function () { return API_BASE; },
    getToken: token,
    setToken: setToken,
    clearToken: function () { setToken(''); },
    request: request,
    health: health,
    ensureApi: ensureApi,
    login: login,
    register: function (body) {
      return request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body || {})
      }).then(function (data) {
        if (data && data.token) setToken(data.token);
        return data;
      });
    },
    me: me,
    getProducts: function (qs) {
      var q = qs ? ('?' + new URLSearchParams(qs).toString()) : '';
      return request('/api/products' + q);
    },
    getProduct: function (id) { return request('/api/products/' + encodeURIComponent(id)); },
    saveProduct: function (p) {
      if (p && p._isNew) {
        var body = Object.assign({}, p);
        delete body._isNew;
        return request('/api/products', { method: 'POST', body: JSON.stringify(body) });
      }
      return request('/api/products/' + encodeURIComponent(p.id), {
        method: 'PUT',
        body: JSON.stringify(p)
      });
    },
    deleteProduct: function (id) {
      return request('/api/products/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    uploadImage: function (dataUrl) {
      return request('/api/uploads', {
        method: 'POST',
        body: JSON.stringify({ dataUrl: dataUrl })
      });
    },
    getOrders: function () { return request('/api/orders'); },
    myOrders: function () { return request('/api/orders/mine'); },
    trackOrder: function (id, email) {
      return request('/api/orders/track?id=' + encodeURIComponent(id) +
        '&email=' + encodeURIComponent(email || ''));
    },
    orderTimeline: function (id, email) {
      var q = email ? ('?email=' + encodeURIComponent(email)) : '';
      return request('/api/orders/' + encodeURIComponent(id) + '/timeline' + q);
    },
    setOrderStatus: function (id, status) {
      return request('/api/orders/' + encodeURIComponent(id) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: status })
      });
    },
    getCms: function (key) { return request('/api/cms/' + encodeURIComponent(key)); },
    saveCms: function (key, data) {
      return request('/api/cms/' + encodeURIComponent(key), {
        method: 'PUT',
        body: JSON.stringify({ data: data })
      });
    },
    getUsers: function () { return request('/api/admin/users'); },
    setUserRole: function (id, role) {
      return request('/api/admin/users/' + encodeURIComponent(id) + '/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: role })
      });
    },
    deleteUser: function (id) {
      return request('/api/admin/users/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    saveCoupon: function (c) {
      return request('/api/admin/coupons', { method: 'POST', body: JSON.stringify(c) });
    },
    deleteCoupon: function (code) {
      return request('/api/admin/coupons/' + encodeURIComponent(code), { method: 'DELETE' });
    },
    downloadCatalogBackup: async function () {
      var t = token();
      var res = await fetch(url('/api/admin/catalog-backup'), {
        headers: t ? { Authorization: 'Bearer ' + t } : {}
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || ('Backup xətası (' + res.status + ')'));
      }
      return res.blob();
    },
    restoreCatalogBackup: function (data) {
      return request('/api/admin/catalog-backup/restore', {
        method: 'POST',
        body: JSON.stringify(data || {})
      });
    },
    persistCatalogBackup: function () {
      return request('/api/admin/catalog-backup/persist', { method: 'POST', body: '{}' });
    },
    chatSession: function (body) {
      return request('/api/chat/session', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    chatSend: function (threadId, visitorKey, body) {
      return request('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ threadId: threadId, visitorKey: visitorKey, body: body })
      });
    },
    chatPoll: function (threadId, visitorKey, after) {
      var q = '?threadId=' + encodeURIComponent(threadId) +
        '&visitorKey=' + encodeURIComponent(visitorKey) +
        (after ? '&after=' + encodeURIComponent(after) : '');
      return request('/api/chat/messages' + q);
    },
    chatAdminThreads: function (status) {
      var q = status ? ('?status=' + encodeURIComponent(status)) : '';
      return request('/api/chat/admin/threads' + q);
    },
    chatAdminThread: function (id, after) {
      var q = after ? ('?after=' + encodeURIComponent(after)) : '';
      return request('/api/chat/admin/threads/' + encodeURIComponent(id) + q);
    },
    chatAdminReply: function (id, body) {
      return request('/api/chat/admin/threads/' + encodeURIComponent(id) + '/messages', {
        method: 'POST',
        body: JSON.stringify({ body: body })
      });
    },
    chatAdminSetStatus: function (id, status) {
      return request('/api/chat/admin/threads/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify({ status: status })
      });
    },
    chatAdminApprove: function (id) {
      return request('/api/chat/admin/threads/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify({ approved: true })
      });
    },
    chatAdminDelete: function (id) {
      return request('/api/chat/admin/threads/' + encodeURIComponent(id), {
        method: 'DELETE'
      });
    },
    getPaymentSettings: function () {
      return request('/api/payments/admin/settings');
    },
    savePaymentSettings: function (payment) {
      return request('/api/payments/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(payment || {})
      });
    },
    getPaymentsByOrder: function (orderId) {
      return request('/api/payments/admin/by-order/' + encodeURIComponent(orderId));
    },
    confirmTransfer: function (paymentId, body) {
      return request('/api/payments/' + encodeURIComponent(paymentId) + '/confirm-transfer', {
        method: 'POST',
        body: JSON.stringify(body || {})
      });
    },
    getReferralConfig: function () { return request('/api/referrals/config'); },
    validateReferral: function (body) {
      return request('/api/referrals/validate', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    myReferral: function () { return request('/api/referrals/mine'); },
    getReferralSettings: function () { return request('/api/referrals/admin/settings'); },
    saveReferralSettings: function (data) {
      return request('/api/referrals/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data || {})
      });
    },
    listReferrals: function () { return request('/api/referrals/admin/list'); },
    businessMe: function () { return request('/api/business/me'); },
    businessRegister: function (body) {
      return request('/api/business/register', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    businessSaveProfile: function (body) {
      return request('/api/business/profile', { method: 'PUT', body: JSON.stringify(body || {}) });
    },
    businessQuotes: function () { return request('/api/business/quotes'); },
    businessCreateQuote: function (body) {
      return request('/api/business/quotes', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    _downloadAuth: async function (path) {
      var t = token();
      var res = await fetch(url(path), {
        headers: t ? { Authorization: 'Bearer ' + t } : {}
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || ('Yükləmə xətası (' + res.status + ')'));
      }
      var blob = await res.blob();
      var cd = res.headers.get('Content-Disposition') || '';
      var match = /filename="?([^"]+)"?/i.exec(cd);
      var filename = (match && match[1]) || res.headers.get('X-Nexora-Doc') || 'nexora-download.bin';
      return { blob: blob, filename: filename, mime: res.headers.get('Content-Type') || blob.type };
    },
    businessQuotePdf: function (id) {
      return this._downloadAuth('/api/business/quotes/' + encodeURIComponent(id) + '/pdf');
    },
    businessQuoteExcel: function (id) {
      return this._downloadAuth('/api/business/quotes/' + encodeURIComponent(id) + '/excel');
    },
    businessContracts: function () { return request('/api/business/contracts'); },
    businessCreateContract: function (body) {
      return request('/api/business/contracts', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    businessContractPdf: function (id) {
      return this._downloadAuth('/api/business/contracts/' + encodeURIComponent(id) + '/pdf');
    },
    businessBulkOrder: function (body) {
      return request('/api/business/bulk-order', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    businessPreviewTotals: function (body) {
      return request('/api/business/preview-totals', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    businessOfferPreview: function (body) {
      return request('/api/business/offers/preview', { method: 'POST', body: JSON.stringify(body || {}) });
    },
    businessOfferPdf: async function (body) {
      var t = token();
      var headers = { 'Content-Type': 'application/json' };
      if (t) headers.Authorization = 'Bearer ' + t;
      var res = await fetch(url('/api/business/offers/preview-pdf'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body || {})
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || ('PDF xətası (' + res.status + ')'));
      }
      var blob = await res.blob();
      var cd = res.headers.get('Content-Disposition') || '';
      var match = /filename="?([^"]+)"?/i.exec(cd);
      var filename = (match && match[1]) || res.headers.get('X-Nexora-Doc') || 'NEXORA_Qiymet_Teklifi.pdf';
      return { blob: blob, filename: filename, mime: res.headers.get('Content-Type') || blob.type };
    },
    downloadBlob: function (blob, filename) {
      var a = document.createElement('a');
      var href = URL.createObjectURL(blob);
      a.href = href;
      a.download = filename || 'download.bin';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
    },
    businessAdminOverview: function () { return request('/api/business/admin/overview'); },
    businessAdminSetQuoteStatus: function (id, status) {
      return request('/api/business/admin/quotes/' + encodeURIComponent(id) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: status })
      });
    },
    businessAdminSetContractStatus: function (id, status) {
      return request('/api/business/admin/contracts/' + encodeURIComponent(id) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: status })
      });
    },
    businessAdminQuotePdf: function (id) {
      return this._downloadAuth('/api/business/admin/quotes/' + encodeURIComponent(id) + '/pdf');
    },
    businessAdminContractPdf: function (id) {
      return this._downloadAuth('/api/business/admin/contracts/' + encodeURIComponent(id) + '/pdf');
    },
    businessAdminExport: function (kind, format) {
      var q = format ? ('?format=' + encodeURIComponent(format)) : '';
      return this._downloadAuth('/api/business/admin/export/' + encodeURIComponent(kind) + q);
    },
    trackAnalytics: function (body) {
      return request('/api/analytics/event', {
        method: 'POST',
        body: JSON.stringify(body || {})
      }).catch(function () { return null; });
    },
    analyticsDashboard: function (opts) {
      opts = opts || {};
      var q = [];
      if (opts.limit) q.push('limit=' + encodeURIComponent(opts.limit));
      if (opts.unsoldLimit) q.push('unsoldLimit=' + encodeURIComponent(opts.unsoldLimit));
      return request('/api/analytics/dashboard' + (q.length ? '?' + q.join('&') : ''));
    },
    aiConsult: function (text, opts) {
      opts = opts || {};
      return request('/api/ai/consult', {
        method: 'POST',
        body: JSON.stringify({
          text: text,
          limit: opts.limit || 8,
          history: opts.history || []
        })
      });
    },
    myWarranties: function () { return request('/api/warranties/mine'); },
    getWarranty: function (id) {
      return request('/api/warranties/' + encodeURIComponent(id));
    },
    downloadWarrantyPdf: async function (id) {
      var t = token();
      var res = await fetch(url('/api/warranties/' + encodeURIComponent(id) + '/pdf'), {
        headers: t ? { Authorization: 'Bearer ' + t } : {}
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || ('PDF xətası (' + res.status + ')'));
      }
      return res.blob();
    },
    serviceHistory: function () { return request('/api/service/history'); },
    serviceTickets: function () { return request('/api/service/tickets'); },
    createServiceTicket: function (body) {
      return request('/api/service/tickets', {
        method: 'POST',
        body: JSON.stringify(body || {})
      });
    },
    setServiceTicketStatus: function (id, status, note) {
      return request('/api/service/tickets/' + encodeURIComponent(id) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: status, note: note || '' })
      });
    }
  };
})(typeof window !== 'undefined' ? window : global);
