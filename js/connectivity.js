/**
 * NEXORA Connectivity — offline gate, page loading, refresh → home
 * Must load early (before shell). Site requires a live network.
 */
(function () {
  'use strict';

  var OFFLINE_ID = 'nexoraOfflineGate';
  var LOADER_ID = 'nexoraPageLoader';
  var healthTimer = null;
  var loadCount = 0;

  function pathInfo() {
    var path = (location.pathname || '').replace(/\\/g, '/');
    var file = path.split('/').pop() || '';
    var inPages = path.indexOf('/pages/') !== -1;
    var isAdmin = path.indexOf('/admin') !== -1;
    var isHome = !file || file === 'index.html';
    var homeHref = inPages ? '../index.html' : 'index.html';
    return { path: path, file: file, inPages: inPages, isAdmin: isAdmin, isHome: isHome, homeHref: homeHref };
  }

  /** Refresh / pull-to-refresh → always open home (storefront only) */
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

  /** After leaving the app long enough, return opens home */
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
      // Away 20s+ (app switch / lock) → straight to home
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
      '#' + OFFLINE_ID + '{' +
        'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;background:#111;color:#fff;text-align:center;font-family:system-ui,sans-serif' +
      '}' +
      '#' + OFFLINE_ID + '[hidden]{display:none!important}' +
      '#' + OFFLINE_ID + ' .og-box{max-width:360px}' +
      '#' + OFFLINE_ID + ' .og-logo{font-weight:900;letter-spacing:.16em;color:#FF0000;font-size:1.4rem;margin-bottom:12px}' +
      '#' + OFFLINE_ID + ' h2{margin:0 0 8px;font-size:1.25rem}' +
      '#' + OFFLINE_ID + ' p{margin:0 0 18px;color:#bbb;line-height:1.45;font-size:.95rem}' +
      '#' + OFFLINE_ID + ' button{min-height:46px;padding:0 18px;border:0;border-radius:12px;background:#FF0000;color:#fff;font-weight:700;width:100%;cursor:pointer}' +
      '#' + LOADER_ID + '{' +
        'position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:12px;background:rgba(255,255,255,.92);backdrop-filter:blur(6px);transition:opacity .25s ease' +
      '}' +
      '#' + LOADER_ID + '[hidden]{display:none!important}' +
      '#' + LOADER_ID + ' .pl-logo{font-weight:900;letter-spacing:.16em;color:#FF0000;font-size:1.35rem}' +
      '#' + LOADER_ID + ' .pl-bar{width:110px;height:3px;border-radius:99px;background:#eee;overflow:hidden}' +
      '#' + LOADER_ID + ' .pl-bar>i{display:block;height:100%;width:40%;background:#FF0000;animation:nexoraLoadSlide 1s ease-in-out infinite}' +
      '#' + LOADER_ID + ' .pl-text{font-size:13px;color:#666}' +
      '@keyframes nexoraLoadSlide{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}' +
      '[data-theme="dark"] #' + LOADER_ID + '{background:rgba(17,17,17,.92)}' +
      '[data-theme="dark"] #' + LOADER_ID + ' .pl-bar{background:#333}' +
      '[data-theme="dark"] #' + LOADER_ID + ' .pl-text{color:#aaa}';
    (document.head || document.documentElement).appendChild(style);
  }

  function showOffline() {
    ensureOfflineStyles();
    var el = document.getElementById(OFFLINE_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = OFFLINE_ID;
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-modal', 'true');
      el.innerHTML =
        '<div class="og-box">' +
          '<div class="og-logo">NEXORA</div>' +
          '<h2>İnternet yoxdur</h2>' +
          '<p>Sayt yalnız onlayn işləyir. Wi‑Fi və ya mobil interneti yandırın, sonra yenidən cəhd edin.</p>' +
          '<button type="button" data-offline-retry>Yenidən yoxla</button>' +
        '</div>';
      (document.body || document.documentElement).appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target && e.target.getAttribute('data-offline-retry') !== null) {
          probeAndSync(true);
        }
      });
    }
    el.hidden = false;
    document.documentElement.classList.add('nexora-offline');
  }

  function hideOffline() {
    var el = document.getElementById(OFFLINE_ID);
    if (el) el.hidden = true;
    document.documentElement.classList.remove('nexora-offline');
  }

  function showLoader(msg) {
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

  async function probeAndSync(fromRetry) {
    if (!navigator.onLine) {
      showOffline();
      return false;
    }
    try {
      var base = '';
      try {
        var p = (location.pathname || '').replace(/\\/g, '/');
        if (p.indexOf('/pages/admin') !== -1) base = '../../';
        else if (p.indexOf('/pages/') !== -1) base = '../';
      } catch (e) { /* ignore */ }
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
      var res = await fetch(base + 'api/health?_=' + Date.now(), {
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
      showOffline();
      return false;
    }
  }

  function startHealthWatch() {
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = setInterval(function () {
      if (!navigator.onLine) {
        showOffline();
        return;
      }
      probeAndSync(false);
    }, 45000);
  }

  function bindLinkLoader() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (!navigator.onLine) {
        e.preventDefault();
        showOffline();
        return;
      }
      // Same-origin page navigation → show loading
      try {
        var url = new URL(href, location.href);
        if (url.origin === location.origin && !/\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(url.pathname)) {
          showLoader('Keçid edilir…');
        }
      } catch (err) { /* ignore */ }
    }, true);
  }

  function boot() {
    redirectRefreshToHome();
    bindExitToHome();
    ensureOfflineStyles();

    try {
      if (sessionStorage.getItem('nexora-show-loader') === '1') {
        sessionStorage.removeItem('nexora-show-loader');
        showLoader('Ana səhifə açılır…');
        setTimeout(function () { hideLoader(true); }, 1200);
      }
    } catch (e) { /* ignore */ }

    if (!navigator.onLine) showOffline();
    else probeAndSync(false);

    window.addEventListener('offline', function () { showOffline(); });
    window.addEventListener('online', function () { probeAndSync(true); });
    startHealthWatch();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindLinkLoader);
    } else {
      bindLinkLoader();
    }

    window.addEventListener('pageshow', function (ev) {
      if (ev.persisted) hideLoader(true);
    });
    window.addEventListener('load', function () {
      setTimeout(function () { hideLoader(true); }, 300);
    });
  }

  boot();

  window.NexoraConnectivity = {
    showOffline: showOffline,
    hideOffline: hideOffline,
    showLoader: showLoader,
    hideLoader: hideLoader,
    probe: probeAndSync,
    isOnline: function () { return navigator.onLine && !document.documentElement.classList.contains('nexora-offline'); }
  };
})();
