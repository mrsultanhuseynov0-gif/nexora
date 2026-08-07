/**
 * NEXORA Live Chat — WhatsApp FAB + Tawk.to / Crisp embed
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'nexoraLiveChatCss';
  var WA_ID = 'nexoraWaFab';
  var mounted = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '#' + WA_ID + '{' +
        'position:fixed;right:18px;bottom:18px;z-index:99990;' +
        'display:inline-flex;align-items:center;gap:10px;' +
        'min-height:52px;padding:0 16px 0 12px;border:0;border-radius:999px;' +
        'background:#25D366;color:#fff;font-weight:700;font-size:14px;' +
        'box-shadow:0 10px 28px rgba(0,0,0,.22);cursor:pointer;text-decoration:none;' +
        'font-family:system-ui,-apple-system,sans-serif;transition:transform .15s ease,box-shadow .15s ease' +
      '}' +
      '#' + WA_ID + ':hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(0,0,0,.28);color:#fff}' +
      '#' + WA_ID + ' .wa-ico{' +
        'width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.18);' +
        'display:grid;place-items:center;flex:0 0 auto' +
      '}' +
      '#' + WA_ID + ' svg{display:block}' +
      'body.has-mobile-tabbar #' + WA_ID + '{bottom:78px}' +
      '@media (max-width:640px){' +
        '#' + WA_ID + '{right:14px;bottom:72px}' +
        '#' + WA_ID + ' .wa-label{display:none}' +
        '#' + WA_ID + '{padding:0;width:54px;height:54px;justify-content:center;border-radius:50%}' +
        '#' + WA_ID + ' .wa-ico{width:54px;height:54px;background:transparent}' +
      '}';
    (document.head || document.documentElement).appendChild(style);
  }

  function waSvg() {
    return '<span class="wa-ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M20.52 3.48A11.78 11.78 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.82c0 2.08.55 4.11 1.6 5.9L0 24l6.45-1.69a11.8 11.8 0 0 0 5.59 1.42h.01c6.54 0 11.84-5.3 11.84-11.82 0-3.16-1.23-6.13-3.37-8.43zM12.05 21.5h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.83 1 1.02-3.73-.23-.38a9.76 9.76 0 0 1-1.5-5.2c0-5.4 4.4-9.8 9.82-9.8 2.62 0 5.09 1.02 6.94 2.88a9.72 9.72 0 0 1 2.87 6.93c0 5.41-4.4 9.81-9.82 9.81zm5.38-7.35c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/>' +
      '</svg></span>';
  }

  function isAdminPage() {
    try {
      return /\/pages\/admin\//i.test(location.pathname || '');
    } catch (e) {
      return false;
    }
  }

  function mountWhatsApp(site, cfg) {
    if (cfg.whatsappEnabled === false) return;
    var existing = document.getElementById(WA_ID);
    if (existing) existing.remove();

    var msg = cfg.whatsappMessage || 'Salam! NEXORA-dan yazıram.';
    var href = (typeof NexoraApp !== 'undefined' && NexoraApp.whatsappLink)
      ? NexoraApp.whatsappLink(msg)
      : '#';
    if (!href || href === '#') return;

    ensureStyles();
    if (document.querySelector('.mobile-tabbar')) {
      document.body.classList.add('has-mobile-tabbar');
    }

    var a = document.createElement('a');
    a.id = WA_ID;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'WhatsApp ilə yaz');
    a.innerHTML = waSvg() + '<span class="wa-label">WhatsApp</span>';
    document.body.appendChild(a);
  }

  function loadTawk(propertyId) {
    if (!propertyId || document.getElementById('nexoraTawkScript')) return;
    var id = String(propertyId).trim().replace(/^https?:\/\/embed\.tawk\.to\//i, '');
    if (!id || id.indexOf('/') === -1) {
      // allow bare property id like "xxxx/yyyy"
      if (!/^[a-zA-Z0-9]+\/[a-zA-Z0-9]+$/.test(id)) return;
    }
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    var s1 = document.createElement('script');
    s1.id = 'nexoraTawkScript';
    s1.async = true;
    s1.src = 'https://embed.tawk.to/' + id;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    var s0 = document.getElementsByTagName('script')[0];
    if (s0 && s0.parentNode) s0.parentNode.insertBefore(s1, s0);
    else document.head.appendChild(s1);
  }

  function loadCrisp(websiteId) {
    if (!websiteId || window.$crisp) return;
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = String(websiteId).trim();
    var s = document.createElement('script');
    s.id = 'nexoraCrispScript';
    s.async = true;
    s.src = 'https://client.crisp.chat/l.js';
    document.head.appendChild(s);
  }

  async function mount(site) {
    if (mounted || isAdminPage()) return;
    if (document.documentElement.classList.contains('nexora-offline')) return;

    var settings = site;
    if (!settings && typeof NexoraApp !== 'undefined' && NexoraApp.loadSiteSettings) {
      try { settings = await NexoraApp.loadSiteSettings(); } catch (e) { settings = {}; }
    }
    settings = settings || {};
    var cfg = settings.liveChat || {};

    // Defaults: WhatsApp on, chat widgets only if IDs set
    if (cfg.enabled === false) return;

    mounted = true;
    mountWhatsApp(settings, cfg);

    if (cfg.tawkPropertyId) loadTawk(cfg.tawkPropertyId);
    else if (cfg.crispWebsiteId) loadCrisp(cfg.crispWebsiteId);
  }

  function boot() {
    function run() {
      if (typeof NexoraApp === 'undefined') {
        setTimeout(run, 50);
        return;
      }
      mount(null);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
    document.addEventListener('nexora:shell-ready', function () {
      mounted = false;
      mount(null);
    });
  }

  global.NexoraLiveChat = { mount: mount };
  boot();
})(typeof window !== 'undefined' ? window : global);
