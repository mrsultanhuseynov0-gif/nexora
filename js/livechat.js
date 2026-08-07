/**
 * NEXORA Live Chat — registered users only.
 * Gate: name + AZ phone + topic required. 1 message until admin approves.
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
    started: false,
    approved: false,
    canSend: true,
    visitorKey: '',
    threadId: '',
    lastMsgId: '',
    busy: false
  };

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

  function clearDraft() {
    var cur = loadLocal();
    saveLocal({
      visitorKey: cur.visitorKey || '',
      threadId: '',
      name: '',
      phone: '',
      topic: '',
      started: false,
      approved: false
    });
  }

  function normalizePhone(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.indexOf('994') === 0 && digits.length === 12) return digits;
    if (digits.charAt(0) === '0' && digits.length === 10) return '994' + digits.slice(1);
    if (digits.length === 9) return '994' + digits;
    return digits;
  }

  function isValidPhone(phone) {
    var digits = normalizePhone(phone);
    if (!/^994(50|51|55|70|77|99|10|60)\d{7}$/.test(digits)) return false;
    var local = digits.slice(3);
    if (/^(\d)\1{8}$/.test(local)) return false;
    if (/^(012345678|123456789|987654321)/.test(local)) return false;
    return true;
  }

  function formatPhoneInput(phone) {
    var d = normalizePhone(phone);
    return d ? ('+' + d) : '';
  }

  function isLoggedIn() {
    // Chat API requires JWT — only show widget for API-authenticated users
    return !!(typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken());
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
        'position:absolute;right:0;bottom:64px;width:min(360px,calc(100vw - 28px));height:480px;' +
        'display:none;flex-direction:column;background:#fff;color:#111;border-radius:16px;' +
        'border:1px solid rgba(0,0,0,.08);box-shadow:0 18px 50px rgba(0,0,0,.22);overflow:hidden' +
      '}' +
      '#' + ROOT_ID + '.is-open .lc-panel{display:flex}' +
      '#' + ROOT_ID + ' .lc-head{padding:14px 16px;background:#111;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px}' +
      '#' + ROOT_ID + ' .lc-head strong{font-size:14px}' +
      '#' + ROOT_ID + ' .lc-head span{display:block;font-size:11px;color:#bbb;margin-top:2px}' +
      '#' + ROOT_ID + ' .lc-close{border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer;line-height:1}' +
      '#' + ROOT_ID + ' .lc-gate{flex:1;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:20px;background:linear-gradient(180deg,#fff 0%,#f7f7f8 100%)}' +
      '#' + ROOT_ID + ' .lc-gate h3{margin:0;font-size:17px;text-align:center}' +
      '#' + ROOT_ID + ' .lc-gate p{margin:0 0 4px;font-size:13px;color:#666;line-height:1.4;text-align:center}' +
      '#' + ROOT_ID + ' .lc-gate label{font-size:12px;font-weight:600;color:#333}' +
      '#' + ROOT_ID + ' .lc-gate input,#' + ROOT_ID + ' .lc-gate textarea{min-height:42px;border:1px solid #ddd;border-radius:10px;padding:0 12px;font-size:14px;width:100%;box-sizing:border-box}' +
      '#' + ROOT_ID + ' .lc-gate textarea{min-height:72px;padding:10px 12px;resize:vertical}' +
      '#' + ROOT_ID + ' .lc-gate input.is-error,#' + ROOT_ID + ' .lc-gate textarea.is-error{border-color:#FF0000}' +
      '#' + ROOT_ID + ' .lc-gate .lc-err{display:none;color:#FF0000;font-size:12px;text-align:center}' +
      '#' + ROOT_ID + ' .lc-gate .lc-err.is-show{display:block}' +
      '#' + ROOT_ID + ' .lc-gate button{min-height:44px;border:0;border-radius:10px;background:#FF0000;color:#fff;font-weight:700;cursor:pointer;margin-top:4px}' +
      '#' + ROOT_ID + ' .lc-gate button:disabled{opacity:.6;cursor:not-allowed}' +
      '#' + ROOT_ID + ' .lc-chat{display:none;flex:1;flex-direction:column;min-height:0}' +
      '#' + ROOT_ID + '.is-started .lc-gate{display:none}' +
      '#' + ROOT_ID + '.is-started .lc-chat{display:flex}' +
      '#' + ROOT_ID + ' .lc-msgs{flex:1;overflow:auto;padding:14px;background:#f6f6f7;display:flex;flex-direction:column;gap:8px}' +
      '#' + ROOT_ID + ' .lc-bubble{max-width:85%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word}' +
      '#' + ROOT_ID + ' .lc-bubble.is-visitor{align-self:flex-end;background:#FF0000;color:#fff;border-bottom-right-radius:4px}' +
      '#' + ROOT_ID + ' .lc-bubble.is-admin{align-self:flex-start;background:#fff;border:1px solid #e8e8ea;border-bottom-left-radius:4px}' +
      '#' + ROOT_ID + ' .lc-bubble.is-system{align-self:center;background:transparent;color:#777;font-size:12px;text-align:center}' +
      '#' + ROOT_ID + ' .lc-wait{display:none;padding:8px 12px;font-size:12px;color:#8a5a00;background:#fff8e6;border-top:1px solid #f0e0b8;text-align:center}' +
      '#' + ROOT_ID + ' .lc-wait.is-show{display:block}' +
      '#' + ROOT_ID + ' .lc-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}' +
      '#' + ROOT_ID + ' .lc-form input{flex:1;min-height:42px;border:1px solid #ddd;border-radius:10px;padding:0 12px;font-size:14px}' +
      '#' + ROOT_ID + ' .lc-form input:disabled{background:#f3f3f3;color:#999}' +
      '#' + ROOT_ID + ' .lc-form button{min-height:42px;padding:0 14px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:700;cursor:pointer}' +
      '#' + ROOT_ID + ' .lc-form button:disabled{opacity:.5;cursor:not-allowed}' +
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

  function applyThreadFlags(thread) {
    if (!thread) return;
    state.approved = !!thread.approved;
    state.canSend = thread.canSend !== false;
    var wait = document.getElementById('lcWait');
    var input = document.getElementById('lcInput');
    var btn = document.querySelector('#' + ROOT_ID + ' .lc-form button');
    if (wait) wait.classList.toggle('is-show', !state.approved && !state.canSend);
    if (input) {
      input.disabled = !state.canSend;
      input.placeholder = state.canSend
        ? (state.approved ? 'Mesaj yazın…' : 'Bir mesaj yazın…')
        : 'Admin təsdiqini gözləyin…';
    }
    if (btn) btn.disabled = !state.canSend;
  }

  function setStarted(on) {
    state.started = !!on;
    var root = document.getElementById(ROOT_ID);
    if (root) root.classList.toggle('is-started', state.started);
  }

  function showGateError(msg) {
    var err = document.getElementById('lcGateErr');
    if (err) {
      err.textContent = msg || '';
      err.classList.toggle('is-show', !!msg);
    }
  }

  function markFieldError(id, on) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('is-error', !!on);
  }

  function readGate() {
    return {
      name: (document.getElementById('lcName') && document.getElementById('lcName').value.trim()) || '',
      phone: (document.getElementById('lcPhone') && document.getElementById('lcPhone').value.trim()) || '',
      topic: (document.getElementById('lcTopic') && document.getElementById('lcTopic').value.trim()) || ''
    };
  }

  function validateGate(g) {
    markFieldError('lcName', false);
    markFieldError('lcPhone', false);
    markFieldError('lcTopic', false);
    if (!g.name || g.name.length < 2) {
      markFieldError('lcName', true);
      return 'Ad mütləqdir';
    }
    if (!isValidPhone(g.phone)) {
      markFieldError('lcPhone', true);
      return 'Düzgün Azərbaycan mobil nömrəsi yazın (məs: +994501234567)';
    }
    if (!g.topic || g.topic.length < 3) {
      markFieldError('lcTopic', true);
      return 'Problem / mövzu mütləqdir';
    }
    return '';
  }

  async function ensureSession(name, phone, topic) {
    var A = api();
    if (!A || !A.chatSession) throw new Error('Chat API yoxdur');
    if (!isLoggedIn()) throw new Error('Chat üçün hesabınıza daxil olun');

    var err = validateGate({ name: name, phone: phone, topic: topic });
    if (err) throw new Error(err);

    var phoneFmt = formatPhoneInput(phone);
    var res = await A.chatSession({
      name: name,
      phone: phoneFmt,
      topic: topic
    });
    state.visitorKey = res.visitorKey || '';
    state.threadId = res.thread && res.thread.id;
    applyThreadFlags(res.thread);
    saveLocal({
      visitorKey: state.visitorKey,
      threadId: state.threadId,
      name: name,
      phone: phoneFmt,
      topic: topic,
      started: true,
      approved: state.approved
    });
    appendMessages(res.messages || [], true);
    setStarted(true);
    return res;
  }

  async function poll() {
    var A = api();
    if (!A || !A.chatPoll || !state.threadId || !state.started) return;
    try {
      var res = await A.chatPoll(state.threadId, state.visitorKey, state.lastMsgId);
      if (res && res.thread) applyThreadFlags(res.thread);
      if (res && res.messages && res.messages.length) appendMessages(res.messages, false);
      if (res && res.thread && res.thread.approved) {
        saveLocal({ approved: true });
      }
    } catch (e) {
      if (e && e.status === 401) {
        stopPoll();
        destroyWidget();
      }
    }
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
    if (!state.started || !state.threadId) {
      showGateError('Əvvəlcə formu doldurun');
      return;
    }
    if (!state.canSend) {
      if (typeof NexoraToast !== 'undefined') {
        NexoraToast.error('Admin təsdiq edənə qədər yalnız 1 mesaj');
      }
      return;
    }
    state.busy = true;
    try {
      var res = await A.chatSend(state.threadId, state.visitorKey, text);
      if (res && res.message) appendMessages([res.message], false);
      if (res && res.thread) applyThreadFlags(res.thread);
      else if (!state.approved) {
        state.canSend = false;
        applyThreadFlags({ approved: false, canSend: false });
      }
    } catch (e) {
      if (typeof NexoraToast !== 'undefined') NexoraToast.error(e.message || 'Mesaj getmədi');
      if (e && /təsdiq|1 mesaj/i.test(e.message || '')) {
        applyThreadFlags({ approved: false, canSend: false });
      }
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

  function destroyWidget() {
    stopPoll();
    var root = document.getElementById(ROOT_ID);
    if (root) root.remove();
    mounted = false;
    state.open = false;
    state.started = false;
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
        '<div class="lc-head"><div><strong>NEXORA Live Chat</strong><span>Yalnız qeydiyyatlı istifadəçilər</span></div>' +
          '<button type="button" class="lc-close" data-lc-toggle aria-label="Bağla">×</button></div>' +
        '<div class="lc-gate" id="lcGate">' +
          '<h3>Söhbətə başla</h3>' +
          '<p>Ad, telefon və mövzu mütləqdir. Admin təsdiqinə qədər 1 mesaj.</p>' +
          '<label for="lcName">Adınız *</label>' +
          '<input id="lcName" placeholder="Adınız" maxlength="80" autocomplete="name" required>' +
          '<label for="lcPhone">Telefon *</label>' +
          '<input id="lcPhone" type="tel" placeholder="+994501234567" maxlength="40" autocomplete="tel" required>' +
          '<label for="lcTopic">Problem nə ilə bağlıdır? *</label>' +
          '<textarea id="lcTopic" placeholder="Məs: sifariş, çatdırılma, məhsul…" maxlength="200" required></textarea>' +
          '<div class="lc-err" id="lcGateErr"></div>' +
          '<button type="button" id="lcStartBtn">Söhbətə başla</button>' +
        '</div>' +
        '<div class="lc-chat" id="lcChat">' +
          '<div class="lc-msgs"></div>' +
          '<div class="lc-wait" id="lcWait">Admin təsdiqini gözləyirsiniz. Əlavə mesaj göndərə bilməzsiniz.</div>' +
          '<form class="lc-form">' +
            '<input id="lcInput" placeholder="Mesaj yazın…" maxlength="2000" autocomplete="off">' +
            '<button type="submit">Göndər</button>' +
          '</form>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    var local = loadLocal();
    // Refresh: if chat not started → wipe name/phone/topic
    if (!local.started || !local.threadId) {
      clearDraft();
      local = loadLocal();
      setStarted(false);
    } else {
      document.getElementById('lcName').value = local.name || '';
      document.getElementById('lcPhone').value = local.phone || '';
      document.getElementById('lcTopic').value = local.topic || '';
      state.visitorKey = local.visitorKey || '';
      state.threadId = local.threadId || '';
      state.approved = !!local.approved;
      setStarted(true);
    }

    root.querySelectorAll('[data-lc-toggle]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!isLoggedIn()) {
          if (typeof NexoraAccount !== 'undefined' && NexoraAccount.promptLogin) {
            NexoraAccount.promptLogin({ tab: 'login' });
          } else if (typeof NexoraToast !== 'undefined') {
            NexoraToast.error('Chat üçün hesabınıza daxil olun');
          }
          return;
        }
        state.open = !state.open;
        root.classList.toggle('is-open', state.open);
        if (state.open) {
          if (state.started && state.threadId) {
            try {
              var g = readGate();
              var local2 = loadLocal();
              await ensureSession(
                g.name || local2.name,
                g.phone || local2.phone,
                g.topic || local2.topic
              );
              startPoll();
            } catch (e) {
              setStarted(false);
              clearDraft();
              showGateError(e.message || 'Yenidən formu doldurun');
            }
          } else {
            stopPoll();
            setTimeout(function () {
              var n = document.getElementById('lcName');
              if (n) n.focus();
            }, 50);
          }
        } else {
          stopPoll();
        }
      });
    });

    document.getElementById('lcStartBtn').addEventListener('click', async function () {
      if (!isLoggedIn()) {
        showGateError('Chat üçün hesabınıza daxil olun');
        return;
      }
      var g = readGate();
      showGateError('');
      var vErr = validateGate(g);
      if (vErr) {
        showGateError(vErr);
        return;
      }
      var btn = document.getElementById('lcStartBtn');
      btn.disabled = true;
      btn.textContent = 'Başlanır…';
      try {
        await ensureSession(g.name, g.phone, g.topic);
        startPoll();
        var input = document.getElementById('lcInput');
        if (input) input.focus();
      } catch (e) {
        showGateError(e.message || 'Söhbət açıla bilmədi');
        setStarted(false);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Söhbətə başla';
      }
    });

    ['lcName', 'lcPhone', 'lcTopic'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () { showGateError(''); markFieldError(id, false); });
    });

    root.querySelector('.lc-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!state.started) {
        showGateError('Əvvəlcə formu doldurun');
        return;
      }
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
    if (cfg.enabled === false) {
      destroyWidget();
      var waOff = document.getElementById(WA_ID);
      if (waOff) waOff.remove();
      return;
    }

    ensureStyles();
    if (document.querySelector('.mobile-tabbar')) document.body.classList.add('has-mobile-tabbar');

    // Live chat widget only for registered / logged-in users
    if (!isLoggedIn()) {
      destroyWidget();
    } else if (!mounted) {
      buildWidget();
      mounted = true;
    }

    mountWhatsApp(settings, cfg);
  }

  function boot() {
    function run() {
      if (typeof NexoraApp === 'undefined') { setTimeout(run, 40); return; }
      mount(null);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
    document.addEventListener('nexora:shell-ready', function () { mount(null); });
    document.addEventListener('nexora:auth-changed', function () { mounted = false; mount(null); });
    // Re-check after login/logout storage changes
    window.addEventListener('storage', function (e) {
      if (e.key === 'nexora-api-token' || e.key === 'nexora-session') {
        mounted = false;
        mount(null);
      }
    });
  }

  global.NexoraLiveChat = { mount: mount };
  boot();
})(typeof window !== 'undefined' ? window : global);
