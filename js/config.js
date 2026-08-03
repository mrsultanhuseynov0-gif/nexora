/**
 * NEXORA runtime config — production API / site URLs (no hardcoded localhost)
 * Priority: window.NEXORA_API_BASE → meta[name=nexora-api-base] → /config.json → ''
 */
(function (global) {
  'use strict';

  var cfg = {
    apiBase: '',
    siteUrl: '',
    ready: null
  };

  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function fromMeta() {
    var el = document.querySelector('meta[name="nexora-api-base"]');
    return el ? trimSlash(el.getAttribute('content')) : '';
  }

  function applyBase(base) {
    cfg.apiBase = trimSlash(base);
    if (typeof global.NexoraApi !== 'undefined' && global.NexoraApi.setBase) {
      global.NexoraApi.setBase(cfg.apiBase);
    }
  }

  cfg.ready = (async function boot() {
    if (typeof global.NEXORA_API_BASE === 'string' && global.NEXORA_API_BASE) {
      applyBase(global.NEXORA_API_BASE);
    } else {
      var meta = fromMeta();
      if (meta) applyBase(meta);
    }

    try {
      var res = await fetch((cfg.apiBase || '') + '/config.json', { cache: 'no-store' });
      if (res.ok) {
        var data = await res.json();
        if (data && data.apiBase) applyBase(data.apiBase);
        if (data && data.siteUrl) cfg.siteUrl = trimSlash(data.siteUrl);
      }
    } catch (e) { /* same-origin or offline */ }

    // Dev-only fallback: local API when page is not on API origin
    if (!cfg.apiBase && typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
      var port = location.port || '';
      if (port && port !== '8787') {
        var candidates = [
          location.protocol + '//' + location.hostname + ':8787',
          'http://127.0.0.1:8787'
        ];
        for (var i = 0; i < candidates.length; i++) {
          try {
            var h = await fetch(candidates[i] + '/api/health', { cache: 'no-store' });
            if (h.ok) {
              applyBase(candidates[i]);
              break;
            }
          } catch (e2) { /* try next */ }
        }
      }
    }

    return cfg;
  })();

  global.NexoraConfig = cfg;
})(typeof window !== 'undefined' ? window : this);
