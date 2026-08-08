/**
 * NEXORA Connectivity — soft online guard
 * True offline → full-screen lock.
 * Server wake / 502 → banner only (site stays usable).
 * Must load early (before app shell).
 */
(function () {
  'use strict';

  var OFFLINE_ID = 'nexoraOfflineGate';
  var BANNER_ID = 'nexoraServerBanner';
  var LOADER_ID = 'nexoraPageLoader';
  var healthTimer = null;
  var loadCount = 0;
  var offlineLocked = false;
  var lastReason = 'offline';
  var lastReloadAt = 0;
  var probeInFlight = false;
  var firstProbeDone = false;

  function pathInfo() {
    var path = (location.pathname || '').replace(/\\/g, '/');
    var file = path.split('/').pop() || '';
    var inPages = path.indexOf('/pages/') !== -1;
    var isAdmin = path.indexOf('/admin') !== -1;
    var isHome = !file || file === 'index.html';
    var homeHref = inPages ? '../index.html' : 'index.html';
    return { path: path, file: file, inPages: inPages, isAdmin: isAdmin, isHome: isHome, homeHref: homeHref };
  }

  function ensureOfflineStyles() {
    if (document.getElementById('nexoraConnectivityCss')) return;
    var style = document.createElement('style');
    style.id = 'nexoraConnectivityCss';
    style.textContent =
      'html.nexora-offline,html.nexora-offline body{background:#0b0b0b!important;overflow:hidden!important;height:100%!important}' +
      'html.nexora-offline body > *:not(#' + OFFLINE_ID + '){display:none!important;visibility:hidden!important;pointer-events:none!important}' +
      '#' + OFFLINE_ID + '{' +
        'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;background:radial-gradient(ellipse at 50% 30%,#1a1a1a 0%,#0b0b0b 70%);' +
        'color:#fff;text-align:center;font-family:system-ui,-apple-system,sans-serif' +
      '}' +
      '#' + OFFLINE_ID + '[hidden]{display:none!important}' +
      '#' + OFFLINE_ID + ' .og-box{max-width:380px;width:100%;padding:28px 22px;' +
        'border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(20,20,20,.92)}' +
      '#' + OFFLINE_ID + ' .og-logo{font-weight:900;letter-spacing:.16em;color:#FF0000;font-size:1.45rem;margin-bottom:18px}' +
      '#' + OFFLINE_ID + ' .og-icon{font-size:2.4rem;line-height:1;margin-bottom:12px;opacity:.95}' +
      '#' + OFFLINE_ID + ' h2{margin:0 0 10px;font-size:1.5rem;font-weight:800;letter-spacing:.02em}' +
      '#' + OFFLINE_ID + ' p{margin:0 0 22px;color:#bdbdbd;line-height:1.55;font-size:1rem}' +
      '#' + OFFLINE_ID + ' button{min-height:50px;padding:0 18px;border:0;border-radius:12px;' +
        'background:#FF0000;color:#fff;font-weight:700;width:100%;cursor:pointer;font-size:1rem}' +
      '#' + OFFLINE_ID + ' button:active{transform:scale(.98)}' +
      '#' + BANNER_ID + '{' +
        'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483000;' +
        'display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;' +
        'background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.12);' +
        'font:600 13px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)' +
      '}' +
      '#' + BANNER_ID + '[hidden]{display:none!important}' +
      '#' + BANNER_ID + ' button{margin-left:auto;border:0;border-radius:8px;padding:8px 12px;' +
        'background:#FF0000;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap}' +
      'body.has-mobile-tabbar #' + BANNER_ID + '{bottom:calc(72px + env(safe-area-inset-bottom,0px))}' +
      '#' + LOADER_ID + '{' +
        'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:12px;background:rgba(255,255,255,.94);backdrop-filter:blur(6px)' +
      '}' +
      '#' + LOADER_ID + '[hidden]{display:none!important}' +
      '#' + LOADER_ID + ' .pl-logo{font-weight:900;letter-spacing:.16em;color:#FF0000;font-size:1.35rem}' +
      '#' + LOADER_ID + ' .pl-bar{width:110px;height:3px;border-radius:99px;background:#eee;overflow:hidden}' +
      '#' + LOADER_ID + ' .pl-bar>i{display:block;height:100%;width:40%;background:#FF0000;animation:nexoraLoadSlide 1s ease-in-out infinite}' +
      '#' + LOADER_ID + ' .pl-text{font-size:13px;color:#666}' +
      '@keyframes nexoraLoadSlide{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}' +
      '[data-theme="dark"] #' + LOADER_ID + '{background:rgba(17,17,17,.94)}' +
      '[data-theme="dark"] #' + LOADER_ID + ' .pl-bar{background:#333}' +
      '[data-theme="dark"] #' + LOADER_ID + ' .pl-text{color:#aaa}';
    (document.head || document.documentElement).appendChild(style);
  }

  function blockOfflineEvent(e) {
    if (!offlineLocked) return;
    if (e.target && e.target.closest && e.target.closest('#' + OFFLINE_ID)) return;
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  function lockInteraction() {
    if (offlineLocked) return;
    offlineLocked = true;
    ['click', 'submit', 'keydown', 'keyup', 'touchstart', 'touchmove', 'pointerdown', 'contextmenu', 'wheel'].forEach(function (type) {
      document.addEventListener(type, blockOfflineEvent, true);
    });
    window.addEventListener('scroll', blockOfflineEvent, true);
  }

  function unlockInteraction() {
    if (!offlineLocked) return;
    offlineLocked = false;
    ['click', 'submit', 'keydown', 'keyup', 'touchstart', 'touchmove', 'pointerdown', 'contextmenu', 'wheel'].forEach(function (type) {
      document.removeEventListener(type, blockOfflineEvent, true);
    });
    window.removeEventListener('scroll', blockOfflineEvent, true);
  }

  function showServerBanner() {
    ensureOfflineStyles();
    var el = document.getElementById(BANNER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = BANNER_ID;
      el.setAttribute('role', 'status');
      el.innerHTML =
        '<span>Server oyanır / müvəqqəti əlçatmazdır. Səhifə açıq qalır…</span>' +
        '<button type="button" data-server-retry>Yenidən yoxla</button>';
      (document.body || document.documentElement).appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target && e.target.getAttribute('data-server-retry') !== null) {
          probeAndSync(true);
        }
      });
    }
    el.hidden = false;
  }

  function hideServerBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el) el.hidden = true;
  }

  function showOffline(reason) {
    lastReason = reason || 'offline';
    // Only hard-lock when the browser itself reports offline.
    // Server wake / timeout / 502 must not blank the whole storefront.
    if (lastReason !== 'offline' && navigator.onLine) {
      showServerBanner();
      startHealthWatch(true);
      return;
    }

    ensureOfflineStyles();
    lockInteraction();
    hideLoader(true);
    hideServerBanner();

    var el = document.getElementById(OFFLINE_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = OFFLINE_ID;
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'nexoraOfflineTitle');
      el.innerHTML =
        '<div class="og-box">' +
          '<div class="og-logo">NEXORA</div>' +
          '<div class="og-icon" aria-hidden="true">📡</div>' +
          '<h2 id="nexoraOfflineTitle">Internet Xətası</h2>' +
          '<p data-offline-msg>İnternet bağlantısı yoxdur. İnterneti yandırın və yenidən yoxlayın.</p>' +
          '<button type="button" data-offline-retry>Yenidən yoxla</button>' +
        '</div>';
      (document.body || document.documentElement).appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target && e.target.getAttribute('data-offline-retry') !== null) {
          probeAndSync(true);
        }
      });
    }

    var msg = el.querySelector('[data-offline-msg]');
    if (msg) {
      msg.textContent = 'İnternet bağlantısı yoxdur. İnterneti yandırın və yenidən yoxlayın.';
    }

    el.hidden = false;
    document.documentElement.classList.add('nexora-offline');
    try {
      var early = document.getElementById('nexoraEarlyOffline');
      if (early && early.parentNode) early.parentNode.removeChild(early);
    } catch (e3) { /* ignore */ }
    try { document.title = 'Internet Xətası | NEXORA'; } catch (e2) { /* ignore */ }
    startHealthWatch(true);
  }

  function hideOffline() {
    var el = document.getElementById(OFFLINE_ID);
    if (el) el.hidden = true;
    document.documentElement.classList.remove('nexora-offline');
    unlockInteraction();
    hideServerBanner();
    startHealthWatch(false);
  }

  function showLoader(msg) {
    if (document.documentElement.classList.contains('nexora-offline')) return;
    ensureOfflineStyles();
    loadCount += 1;
    var el = document.getElementById(LOADER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = LOADER_ID;
      el.innerHTML =
        '<div class="pl-logo">NEXORA</div>' +
        '<div class="pl-bar" aria-hidden="true"><i></i></div>' +
        '<div class="pl-text" data-loader-text>Yüklənir…</div>';
      (document.body || document.documentElement).appendChild(el);
    }
    var text = el.querySelector('[data-loader-text]');
    if (text && msg) text.textContent = msg;
    el.hidden = false;
  }

  function hideLoader(force) {
    if (!force) {
      loadCount = Math.max(0, loadCount - 1);
      if (loadCount > 0) return;
    } else {
      loadCount = 0;
    }
    var el = document.getElementById(LOADER_ID);
    if (el) el.hidden = true;
  }

  function relativeApiPrefix() {
    try {
      var p = (location.pathname || '').replace(/\\/g, '/');
      if (p.indexOf('/pages/admin') !== -1) return '../../';
      if (p.indexOf('/pages/') !== -1) return '../';
    } catch (e) { /* ignore */ }
    return '';
  }

  function configuredApiBase() {
    try {
      if (typeof window.NEXORA_API_BASE === 'string' && window.NEXORA_API_BASE) {
        return String(window.NEXORA_API_BASE).replace(/\/+$/, '');
      }
      var meta = document.querySelector('meta[name="nexora-api-base"]');
      if (meta && meta.getAttribute('content')) {
        return String(meta.getAttribute('content')).replace(/\/+$/, '');
      }
      var stored = localStorage.getItem('nexora-api-base');
      if (stored) return String(stored).replace(/\/+$/, '');
      if (typeof NexoraConfig !== 'undefined' && NexoraConfig.apiBase) {
        return String(NexoraConfig.apiBase).replace(/\/+$/, '');
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  function healthUrls() {
    var urls = [];
    var base = configuredApiBase();
    if (base) urls.push(base + '/api/health');
    urls.push(relativeApiPrefix() + 'api/health');
    // de-dupe
    var seen = Object.create(null);
    return urls.filter(function (u) {
      if (seen[u]) return false;
      seen[u] = 1;
      return true;
    });
  }

  function safeReload() {
    var now = Date.now();
    if (now - lastReloadAt < 30000) {
      hideOffline();
      return;
    }
    lastReloadAt = now;
    try { location.reload(); } catch (err) { location.href = location.href; }
  }

  async function probeAndSync(fromRetry) {
    if (probeInFlight) return false;
    if (!navigator.onLine) {
      showOffline('offline');
      return false;
    }

    probeInFlight = true;
    var timeoutMs = firstProbeDone ? 12000 : 25000;
    try {
      var urls = healthUrls();
      var lastErr = null;
      for (var i = 0; i < urls.length; i++) {
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
        try {
          var res = await fetch(urls[i] + (urls[i].indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), {
            cache: 'no-store',
            signal: ctrl ? ctrl.signal : undefined
          });
          if (t) clearTimeout(t);
          if (!res.ok) {
            lastErr = new Error('health-' + res.status);
            continue;
          }
          firstProbeDone = true;
          hideOffline();
          if (fromRetry) {
            hideLoader(true);
            // Soft recovery: avoid reload loops; only reload if still gated
            if (document.documentElement.classList.contains('nexora-offline')) safeReload();
          }
          return true;
        } catch (e) {
          if (t) clearTimeout(t);
          lastErr = e;
        }
      }
      throw lastErr || new Error('health');
    } catch (e) {
      // Hard lock only when browser is offline. Otherwise soft banner.
      if (!navigator.onLine) {
        showOffline('offline');
      } else {
        showOffline('server');
      }
      return false;
    } finally {
      probeInFlight = false;
      firstProbeDone = true;
    }
  }

  function startHealthWatch(fast) {
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = setInterval(function () {
      if (!navigator.onLine) showOffline('offline');
      else probeAndSync(false);
    }, fast ? 8000 : 30000);
  }

  function bindGuards() {
    var prefetchDone = Object.create(null);
    function prefetchHref(href) {
      if (offlineLocked || !navigator.onLine) return;
      try {
        var url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        if (/\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(url.pathname)) return;
        var key = url.pathname + url.search;
        if (prefetchDone[key]) return;
        prefetchDone[key] = 1;
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url.pathname + url.search;
        link.as = 'document';
        document.head.appendChild(link);
      } catch (err) { /* ignore */ }
    }

    document.addEventListener('pointerover', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
      prefetchHref(href);
    }, true);

    document.addEventListener('click', function (e) {
      if (!navigator.onLine) {
        e.preventDefault();
        showOffline('offline');
      }
    }, true);
  }

  function boot() {
    ensureOfflineStyles();
    if (!navigator.onLine) {
      document.documentElement.classList.add('nexora-offline');
      showOffline('offline');
    }

    // NOTE: no refresh→home / tab-away→home redirects — those felt like page crashes.

    try {
      if (sessionStorage.getItem('nexora-show-loader') === '1') {
        sessionStorage.removeItem('nexora-show-loader');
        if (navigator.onLine) {
          showLoader('Yüklənir…');
          setTimeout(function () { hideLoader(true); }, 180);
        }
      }
    } catch (e) { /* ignore */ }

    if (!navigator.onLine) {
      showOffline('offline');
    } else {
      probeAndSync(false);
    }

    window.addEventListener('offline', function () { showOffline('offline'); });
    window.addEventListener('online', function () {
      // Recover without forced reload loops
      probeAndSync(false);
    });
    startHealthWatch(false);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        bindGuards();
        if (!navigator.onLine) showOffline('offline');
        else hideLoader(true);
      });
    } else {
      bindGuards();
      if (!navigator.onLine) showOffline('offline');
      else hideLoader(true);
    }

    window.addEventListener('pageshow', function () {
      if (!navigator.onLine) showOffline('offline');
      else hideLoader(true);
    });
    window.addEventListener('load', function () {
      if (!navigator.onLine) showOffline('offline');
      else hideLoader(true);
    });
  }

  if (!navigator.onLine) {
    try {
      document.documentElement.classList.add('nexora-offline');
      ensureOfflineStyles();
    } catch (e) { /* ignore */ }
  }

  boot();

  window.NexoraConnectivity = {
    showOffline: showOffline,
    hideOffline: hideOffline,
    showLoader: showLoader,
    hideLoader: hideLoader,
    probe: probeAndSync,
    isOnline: function () {
      return navigator.onLine && !document.documentElement.classList.contains('nexora-offline');
    }
  };
})();
