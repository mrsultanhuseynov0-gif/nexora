/**
 * NEXORA Connectivity — hard offline lock
 * No internet → site does not open. Full-screen "Internet Xətası".
 * Must load early (before app shell).
 */
(function () {
  'use strict';

  var OFFLINE_ID = 'nexoraOfflineGate';
  var LOADER_ID = 'nexoraPageLoader';
  var healthTimer = null;
  var loadCount = 0;
  var offlineLocked = false;
  var lastReason = 'offline';

  function pathInfo() {
    var path = (location.pathname || '').replace(/\\/g, '/');
    var file = path.split('/').pop() || '';
    var inPages = path.indexOf('/pages/') !== -1;
    var isAdmin = path.indexOf('/admin') !== -1;
    var isHome = !file || file === 'index.html';
    var homeHref = inPages ? '../index.html' : 'index.html';
    return { path: path, file: file, inPages: inPages, isAdmin: isAdmin, isHome: isHome, homeHref: homeHref };
  }

  function redirectRefreshToHome() {
    var info = pathInfo();
    if (info.isAdmin || info.isHome) return;
    var isReload = false;
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'reload') isReload = true;
      else if (performance.navigation && performance.navigation.type === 1) isReload = true;
    } catch (e) { /* ignore */ }
    if (!isReload) return;
    try { sessionStorage.setItem('nexora-show-loader', '1'); } catch (e2) { /* ignore */ }
    location.replace(info.homeHref);
  }

  function bindExitToHome() {
    var info = pathInfo();
    if (info.isAdmin) return;
    var hiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (!hiddenAt) return;
      var awayMs = Date.now() - hiddenAt;
      hiddenAt = 0;
      if (awayMs > 20000 && !pathInfo().isHome) {
        try { sessionStorage.setItem('nexora-show-loader', '1'); } catch (e) { /* ignore */ }
        location.replace(pathInfo().homeHref);
      }
    });
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

  function purgeOfflineCaches() {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (r) { r.unregister(); });
        });
      }
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          keys.forEach(function (k) { caches.delete(k); });
        });
      }
    } catch (e) { /* ignore */ }
  }

  function showOffline(reason) {
    lastReason = reason || 'offline';
    ensureOfflineStyles();
    purgeOfflineCaches();
    lockInteraction();
    hideLoader(true);

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
          // Always refresh the page (like a normal retry)
          try { location.reload(); } catch (err) { location.href = location.href; }
        }
      });
    }

    var msg = el.querySelector('[data-offline-msg]');
    if (msg) {
      msg.textContent = lastReason === 'server'
        ? 'Serverə qoşulmaq olmadı. Bir az sonra yenidən yoxlayın.'
        : 'İnternet bağlantısı yoxdur. İnterneti yandırın və yenidən yoxlayın.';
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

  function apiBasePrefix() {
    try {
      var p = (location.pathname || '').replace(/\\/g, '/');
      if (p.indexOf('/pages/admin') !== -1) return '../../';
      if (p.indexOf('/pages/') !== -1) return '../';
    } catch (e) { /* ignore */ }
    return '';
  }

  async function probeAndSync(fromRetry) {
    if (!navigator.onLine) {
      showOffline('offline');
      return false;
    }
    try {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 4000) : null;
      var res = await fetch(apiBasePrefix() + 'api/health?_=' + Date.now(), {
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined
      });
      if (t) clearTimeout(t);
      if (!res.ok) throw new Error('health');
      hideOffline();
      if (fromRetry) {
        hideLoader(true);
        location.reload();
      }
      return true;
    } catch (e) {
      // Network / DNS / airplane mode → Internet Xətası
      // Server down while "online" still blocks the site (monolith needs API)
      var netFail = !navigator.onLine ||
        (e && (e.name === 'TypeError' || e.name === 'AbortError' || /fetch|network|failed/i.test(String(e.message || e))));
      showOffline(netFail ? 'offline' : 'server');
      return false;
    }
  }

  function startHealthWatch(fast) {
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = setInterval(function () {
      if (!navigator.onLine) showOffline('offline');
      else probeAndSync(false);
    }, fast ? 4000 : 20000);
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
      if (offlineLocked || !navigator.onLine) {
        e.preventDefault();
        showOffline('offline');
      }
    }, true);
  }

  function boot() {
    // Instant lock before any UI if already offline (phone airplane / Wi‑Fi off)
    ensureOfflineStyles();
    if (!navigator.onLine) {
      document.documentElement.classList.add('nexora-offline');
      showOffline('offline');
    }

    redirectRefreshToHome();
    bindExitToHome();

    try {
      if (sessionStorage.getItem('nexora-show-loader') === '1') {
        sessionStorage.removeItem('nexora-show-loader');
        if (navigator.onLine) {
          showLoader('Ana səhifə açılır…');
          setTimeout(function () { hideLoader(true); }, 180);
        }
      }
    } catch (e) { /* ignore */ }

    if (!navigator.onLine) {
      showOffline('offline');
    } else {
      // Verify real connectivity ASAP (not only navigator.onLine)
      probeAndSync(false);
    }

    window.addEventListener('offline', function () { showOffline('offline'); });
    window.addEventListener('online', function () { probeAndSync(true); });
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

  // Sync paint as early as this file runs
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
