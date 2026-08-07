/**
 * NEXORA Live Chat — built-in widget (API) + WhatsApp FAB
 * No third-party account required.
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'nexoraLiveChatCss';
  var ROOT_ID = 'nexoraLiveChat';
  var WA_ID = 'nexoraWaFab';
  var KEY = 'nexora-chat-visitor';
  var mounted = false;
  var pollTimer = null;
  var state = {
    open: false,
    visitorKey: '',
    threadId: '',
    lastMsgId: '',
    busy: false
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isAdminPage() {
    try { return /\/pages\/admin\//i.test(location.pathname || ''); } catch (e) { return false; }
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveLocal(patch) {
    var cur = loadLocal();
    Object.keys(patch || {}).forEach(function (k) { cur[k] = patch[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* ignore */ }
    return cur;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '#' + ROOT_ID + '{position:fixed;right:18px;bottom:18px;z-index:99991;font-family:system-ui,-apple-system,sans-serif}' +
      '#' + ROOT_ID + ' .lc-fab{' +
        'display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 16px;' +
        'border:0;border-radius:999px;background:#FF0000;color:#fff;font-weight:700;font-size:14px;' +
        'box-shadow:0 10px 28px rgba(0,0,0,.22);cursor:pointer' +
      '}' +
      '#' + ROOT_ID + ' .lc-fab:hover{transform:translateY(-1px)}' +
      '#' + ROOT_ID + ' .lc-panel{' +
        'position:absolute;right:0;bottom:64px;width:min(360px,calc(100vw - 28px));height:460px;' +
        'display:none;flex-direction:column;background:#fff;color:#111;border-radius:16px;' +
        'border:1px solid rgba(0,0,0,.08);box-shadow:0 18px 50px rgba(0,0,0,.22);overflow:hidden' +
      '}' +
      '#' + ROOT_ID + '.is-open .lc-panel{display:flex}' +
      '#' + ROOT_ID + ' .lc-head{padding:14px 16px;background:#111;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px}' +
      '#' + ROOT_ID + ' .lc-head strong{font-size:14px}' +
      '#' + ROOT_ID + ' .lc-head span{display:block;font-size:11px;color:#bbb;margin-top:2px}' +
      '#' + ROOT_ID + ' .lc-close{border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer;line-height:1}' +
      '#' + ROOT_ID + ' .lc-msgs{flex:1;overflow:auto;padding:14px;background:#f6f6f7;display:flex;flex-direction:column;gap:8px}' +
      '#' + ROOT_ID + ' .lc-bubble{max-width:85%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word}' +
      '#' + ROOT_ID + ' .lc-bubble.is-visitor{align-self:flex-end;background:#FF0000;color:#fff;border-bottom-right-radius:4px}' +
      '#' + ROOT_ID + ' .lc-bubble.is-admin{align-self:flex-start;background:#fff;border:1px solid #e8e8ea;border-bottom-left-radius:4px}' +
      '#' + ROOT_ID + ' .lc-bubble.is-system{align-self:center;background:transparent;color:#777;font-size:12px;text-align:center}' +
      '#' + ROOT_ID + ' .lc-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}' +
      '#' + ROOT_ID + ' .lc-form input{flex:1;min-height:42px;border:1px solid #ddd;border-radius:10px;padding:0 12px;font-size:14px}' +
      '#' + ROOT_ID + ' .lc-form button{min-height:42px;padding:0 14px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:700;cursor:pointer}' +
      '#' + ROOT_ID + ' .lc-meta{display:none;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}' +
      '#' + ROOT_ID + ' .lc-meta.is-show{display:grid;grid-template-columns:1fr 1fr}' +
      '#' + ROOT_ID + ' .lc-meta input{min-height:38px;border:1px solid #ddd;border-radius:10px;padding:0 10px;font-size:13px}' +
      '#' + WA_ID + '{' +
        'position:fixed;right:18px;bottom:78px;z-index:99990;' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'width:48px;height:48px;border-radius:50%;background:#25D366;color:#fff;' +
        'box-shadow:0 8px 22px rgba(0,0,0,.2);text-decoration:none' +
      '}' +
      '#' + WA_ID + ':hover{transform:translateY(-1px);color:#fff}' +
      'body.has-mobile-tabbar #' + ROOT_ID + '{bottom:72px}' +
      'body.has-mobile-tabbar #' + WA_ID + '{bottom:132px}' +
      '@media (max-width:640px){' +
        '#' + ROOT_ID + '{right:12px;bottom:72px}' +
        '#' + ROOT_ID + ' .lc-fab .lc-label{display:none}' +
        '#' + ROOT_ID + ' .lc-fab{width:54px;height:54px;padding:0;justify-content:center;border-radius:50%}' +
        '#' + WA_ID + '{right:12px;bottom:134px}' +
      '}';
    (document.head || document.documentElement).appendChild(style);
  }

  function api() {
    return typeof NexoraApi !== 'undefined' ? NexoraApi : null;
  }

  function appendMessages(list, replace) {
    var box = document.querySelector('#' + ROOT_ID + ' .lc-msgs');
    if (!box) return;
    if (replace) box.innerHTML = '';
    (list || []).forEach(function (m) {
      if (!m || !m.id) return;
      if (document.getElementById('lcm-' + m.id)) return;
      var div = document.createElement('div');
      div.id = 'lcm-' + m.id;
      var cls = 'lc-bubble is-' + (m.sender === 'visitor' ? 'visitor' : (m.sender === 'admin' ? 'admin' : 'system'));
      div.className = cls;
      div.textContent = m.body || '';
      box.appendChild(div);
      state.lastMsgId = m.id;
    });
    box.scrollTop = box.scrollHeight;
  }

  async function ensureSession() {
    var A = api();
    if (!A || !A.chatSession) throw new Error('Chat API yoxdur');
    var local = loadLocal();
    state.visitorKey = local.visitorKey || '';
    var res = await A.chatSession({
      visitorKey: state.visitorKey,
      name: local.name || '',
      email: local.email || '',
      phone: local.phone || ''
    });
    state.visitorKey = res.visitorKey || state.visitorKey;
    state.threadId = res.thread && res.thread.id;
    saveLocal({ visitorKey: state.visitorKey, threadId: state.threadId });
    appendMessages(res.messages || [], true);
    return res;
  }

  async function poll() {
    var A = api();
    if (!A || !A.chatPoll || !state.threadId || !state.visitorKey) return;
    try {
      var res = await A.chatPoll(state.threadId, state.visitorKey, state.lastMsgId);
      if (res && res.messages && res.messages.length) appendMessages(res.messages, false);
    } catch (e) { /* ignore transient */ }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(poll, 3500);
  }

  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function sendMessage(text) {
    var A = api();
    if (!A || !text || state.busy) return;
    state.busy = true;
    try {
      if (!state.threadId) await ensureSession();
      var nameEl = document.getElementById('lcName');
      var phoneEl = document.getElementById('lcPhone');
      if (nameEl || phoneEl) {
        saveLocal({
          name: nameEl ? nameEl.value.trim() : '',
          phone: phoneEl ? phoneEl.value.trim() : ''
        });
        await A.chatSession({
          visitorKey: state.visitorKey,
          name: (nameEl && nameEl.value.trim()) || '',
          phone: (phoneEl && phoneEl.value.trim()) || ''
        });
      }
      var res = await A.chatSend(state.threadId, state.visitorKey, text);
      if (res && res.message) appendMessages([res.message], false);
    } catch (e) {
      if (typeof NexoraToast !== 'undefined') NexoraToast.error(e.message || 'Mesaj getmədi');
    } finally {
      state.busy = false;
    }
  }

  function mountWhatsApp(site, cfg) {
    if (cfg.whatsappEnabled === false) return;
    var old = document.getElementById(WA_ID);
    if (old) old.remove();
    var msg = cfg.whatsappMessage || 'Salam! NEXORA-dan yazıram.';
    var href = (typeof NexoraApp !== 'undefined' && NexoraApp.whatsappLink)
      ? NexoraApp.whatsappLink(msg) : '';
    if (!href) return;
    var a = document.createElement('a');
    a.id = WA_ID;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'WhatsApp');
    a.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.78 11.78 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.82c0 2.08.55 4.11 1.6 5.9L0 24l6.45-1.69a11.8 11.8 0 0 0 5.59 1.42h.01c6.54 0 11.84-5.3 11.84-11.82 0-3.16-1.23-6.13-3.37-8.43zM12.05 21.5a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.83 1 1.02-3.73-.23-.38a9.76 9.76 0 0 1-1.5-5.2c0-5.4 4.4-9.8 9.82-9.8 2.62 0 5.09 1.02 6.94 2.88a9.72 9.72 0 0 1 2.87 6.93c0 5.41-4.4 9.81-9.82 9.81z"/></svg>';
    document.body.appendChild(a);
  }

  function buildWidget() {
    var root = document.getElementById(ROOT_ID);
    if (root) root.remove();
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML =
      '<button type="button" class="lc-fab" data-lc-toggle aria-label="Live chat">' +
        '<span aria-hidden="true">💬</span><span class="lc-label">Live Chat</span>' +
      '</button>' +
      '<div class="lc-panel" role="dialog" aria-label="NEXORA Live Chat">' +
        '<div class="lc-head"><div><strong>NEXORA Live Chat</strong><span>Adətən bir neçə dəqiqəyə cavab</span></div>' +
          '<button type="button" class="lc-close" data-lc-toggle aria-label="Bağla">×</button></div>' +
        '<div class="lc-meta is-show">' +
          '<input id="lcName" placeholder="Adınız" maxlength="80">' +
          '<input id="lcPhone" placeholder="Telefon" maxlength="40">' +
        '</div>' +
        '<div class="lc-msgs"></div>' +
        '<form class="lc-form">' +
          '<input id="lcInput" placeholder="Mesaj yazın…" maxlength="2000" autocomplete="off">' +
          '<button type="submit">Göndər</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(root);

    var local = loadLocal();
    if (local.name) document.getElementById('lcName').value = local.name;
    if (local.phone) document.getElementById('lcPhone').value = local.phone;

    root.querySelectorAll('[data-lc-toggle]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        state.open = !state.open;
        root.classList.toggle('is-open', state.open);
        if (state.open) {
          try {
            await ensureSession();
            startPoll();
          } catch (e) {
            appendMessages([{ id: 'err1', sender: 'system', body: 'Chat indi açıla bilmədi. Bir az sonra yenidən cəhd edin.' }], true);
          }
        } else {
          stopPoll();
        }
      });
    });

    root.querySelector('.lc-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var input = document.getElementById('lcInput');
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      await sendMessage(text);
    });
  }

  async function mount(site) {
    if (isAdminPage()) return;
    if (document.documentElement.classList.contains('nexora-offline')) return;

    var settings = site;
    if (!settings && typeof NexoraApp !== 'undefined' && NexoraApp.loadSiteSettings) {
      try { settings = await NexoraApp.loadSiteSettings(); } catch (e) { settings = {}; }
    }
    settings = settings || {};
    var cfg = settings.liveChat || {};
    if (cfg.enabled === false) return;

    ensureStyles();
    if (document.querySelector('.mobile-tabbar')) document.body.classList.add('has-mobile-tabbar');

    if (!mounted) {
      buildWidget();
      mounted = true;
    }
    mountWhatsApp(settings, cfg);

    // Optional third-party still supported if configured
    if (cfg.tawkPropertyId && !document.getElementById('nexoraTawkScript')) {
      var id = String(cfg.tawkPropertyId).trim().replace(/^https?:\/\/embed\.tawk\.to\//i, '');
      if (/^[a-zA-Z0-9]+\/[a-zA-Z0-9]+$/.test(id)) {
        window.Tawk_API = window.Tawk_API || {};
        var s1 = document.createElement('script');
        s1.id = 'nexoraTawkScript';
        s1.async = true;
        s1.src = 'https://embed.tawk.to/' + id;
        document.head.appendChild(s1);
      }
    }
  }

  function boot() {
    function run() {
      if (typeof NexoraApp === 'undefined') { setTimeout(run, 40); return; }
      mount(null);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
    document.addEventListener('nexora:shell-ready', function () { mount(null); });
  }

  global.NexoraLiveChat = { mount: mount };
  boot();
})(typeof window !== 'undefined' ? window : global);
