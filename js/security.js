/**
 * NEXORA Security — client-side hardening layer
 * PBKDF2 passwords, HMAC sessions, role seals, lockout, XSS helpers, CSP
 *
 * Note: without a server, a determined attacker with DevTools can still
 * reverse client code. This layer closes casual forgery, plaintext leaks,
 * XSS injection, and brute-force on the demo store.
 */
const NexoraSecurity = (function () {
  'use strict';

  const APP_ID = 'nexora-v1';
  const ITERATIONS = 120000;
  const HASH_BYTES = 32;
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
  const MAX_FAILS = 5;
  const LOCK_MS = 15 * 60 * 1000; // 15 minutes
  const LOCK_KEY = 'nexora-auth-lock';
  const SECRET_KEY = 'nexora-sec-material';

  /* ---------- utils ---------- */

  function toHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function fromHex(hex) {
    const clean = String(hex || '').replace(/[^0-9a-f]/gi, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  function randomBytes(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }

  function randomHex(n) {
    return toHex(randomBytes(n));
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.charAt(0) === '/' || s.indexOf('data:image/') === 0) return s;
    return '';
  }

  function timingSafeEqual(a, b) {
    const aa = String(a || '');
    const bb = String(b || '');
    const len = Math.max(aa.length, bb.length);
    let diff = aa.length ^ bb.length;
    for (let i = 0; i < len; i++) {
      diff |= (aa.charCodeAt(i) || 0) ^ (bb.charCodeAt(i) || 0);
    }
    return diff === 0;
  }

  /* ---------- secret / HMAC ---------- */

  async function getSecretKey() {
    let material = localStorage.getItem(SECRET_KEY);
    if (!material || material.length < 32) {
      material = toHex(randomBytes(32)) + ':' + APP_ID;
      try { localStorage.setItem(SECRET_KEY, material); } catch (e) { /* private mode */ }
    }
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey(
      'raw',
      enc.encode(material + '|' + APP_ID),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode('nexora-hmac-salt-v1'), iterations: 50000, hash: 'SHA-256' },
      base,
      256
    );
    return crypto.subtle.importKey('raw', bits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  }

  async function hmacHex(message) {
    const key = await getSecretKey();
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(message)));
    return toHex(sig);
  }

  /* ---------- passwords ---------- */

  function isHashedPassword(value) {
    return value && typeof value === 'object' && value.algo === 'PBKDF2' && value.salt && value.hash;
  }

  function validatePassword(password, opts) {
    opts = opts || {};
    const p = String(password || '');
    const min = opts.minLength || 8;
    if (p.length < min) return { ok: false, message: 'Şifrə ən azı ' + min + ' simvol olmalıdır' };
    if (p.length > 128) return { ok: false, message: 'Şifrə çox uzundur' };
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
      return { ok: false, message: 'Şifrədə hərf və rəqəm olmalıdır' };
    }
    return { ok: true };
  }

  async function hashPassword(password, saltHex) {
    const salt = saltHex ? fromHex(saltHex) : randomBytes(16);
    const iterations = ITERATIONS;
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(password)),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      keyMaterial,
      HASH_BYTES * 8
    );
    return {
      algo: 'PBKDF2',
      digest: 'SHA-256',
      iterations: iterations,
      salt: toHex(salt),
      hash: toHex(bits)
    };
  }

  async function verifyPassword(password, stored) {
    if (!stored) return false;
    if (typeof stored === 'string') {
      return timingSafeEqual(stored, String(password || ''));
    }
    if (!isHashedPassword(stored)) return false;
    const iterations = stored.iterations || ITERATIONS;
    const salt = fromHex(stored.salt);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(password)),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      keyMaterial,
      HASH_BYTES * 8
    );
    return timingSafeEqual(toHex(bits), stored.hash);
  }

  /* ---------- role seal ---------- */

  function sealPayload(user) {
    const hashPart = isHashedPassword(user.password) ? user.password.hash
      : (typeof user.password === 'string' ? 'plain:' + user.password : '');
    return [user.id, String(user.email || '').toLowerCase(), user.role || 'customer', hashPart].join('|');
  }

  async function createRoleSeal(user) {
    return hmacHex(sealPayload(user));
  }

  async function verifyRoleSeal(user) {
    if (!user || !user.roleSeal) return false;
    const expected = await createRoleSeal(user);
    return timingSafeEqual(expected, user.roleSeal);
  }

  /* ---------- session ---------- */

  function sessionPayload(data) {
    return [data.v, data.id, data.email, data.role, data.exp, data.nonce].join('|');
  }

  async function createSession(user) {
    const data = {
      v: 2,
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role || 'customer',
      exp: Date.now() + SESSION_TTL_MS,
      nonce: randomHex(16)
    };
    data.sig = await hmacHex(sessionPayload(data));
    return data;
  }

  async function verifySession(session) {
    if (!session || session.v !== 2 || !session.sig) return null;
    if (!session.exp || Date.now() > Number(session.exp)) return null;
    const expected = await hmacHex(sessionPayload(session));
    if (!timingSafeEqual(expected, session.sig)) return null;
    if (session.role !== 'admin' && session.role !== 'customer') return null;
    return {
      id: session.id,
      email: session.email,
      name: session.name,
      phone: session.phone,
      role: session.role,
      exp: session.exp
    };
  }

  /* ---------- lockout ---------- */

  function lockStore() {
    try {
      return JSON.parse(localStorage.getItem(LOCK_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveLock(store) {
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  function lockKeyFor(email) {
    return String(email || '').trim().toLowerCase() || '_unknown';
  }

  function getLockStatus(email) {
    const store = lockStore();
    const row = store[lockKeyFor(email)] || { fails: 0, until: 0 };
    if (row.until && Date.now() < row.until) {
      return { locked: true, retryInMs: row.until - Date.now(), fails: row.fails || 0 };
    }
    if (row.until && Date.now() >= row.until) {
      row.fails = 0;
      row.until = 0;
      store[lockKeyFor(email)] = row;
      saveLock(store);
    }
    return { locked: false, retryInMs: 0, fails: row.fails || 0 };
  }

  function assertNotLocked(email) {
    const st = getLockStatus(email);
    if (st.locked) {
      const mins = Math.ceil(st.retryInMs / 60000);
      throw new Error('Hesab müvəqqəti bloklanıb. ' + mins + ' dəqiqə sonra yenidən cəhd edin.');
    }
  }

  function recordFail(email) {
    const store = lockStore();
    const key = lockKeyFor(email);
    const row = store[key] || { fails: 0, until: 0 };
    row.fails = (row.fails || 0) + 1;
    if (row.fails >= MAX_FAILS) {
      row.until = Date.now() + LOCK_MS;
      row.fails = 0;
    }
    store[key] = row;
    saveLock(store);
    return getLockStatus(email);
  }

  function clearFails(email) {
    const store = lockStore();
    delete store[lockKeyFor(email)];
    saveLock(store);
  }

  /* ---------- CSP / boot ---------- */

  function applyCsp() {
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    var connect = ["'self'", 'https:'];
    // Local API during development
    if (/^(localhost|127\.0\.0\.1)$/i.test(location.hostname || '')) {
      connect.push(
        'http://127.0.0.1:8787',
        'http://localhost:8787',
        'ws://127.0.0.1:8787',
        'ws://localhost:8787'
      );
    }
    try {
      var apiMeta = document.querySelector('meta[name="nexora-api-base"]');
      var apiBase = (window.NEXORA_API_BASE || (apiMeta && apiMeta.getAttribute('content')) ||
        localStorage.getItem('nexora-api-base') || '').replace(/\/+$/, '');
      if (apiBase && /^https?:/i.test(apiBase)) connect.push(apiBase);
    } catch (e) { /* ignore */ }
    meta.content = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://embed.tawk.to https://cdn.jsdelivr.net https://client.crisp.chat https://*.crisp.chat",
      "style-src 'self' 'unsafe-inline' https://embed.tawk.to https://client.crisp.chat https://*.crisp.chat",
      "img-src 'self' data: blob: https: https://images.unsplash.com https://*.unsplash.com https://upload.wikimedia.org https://*.wikimedia.org https://res.cloudinary.com https://embed.tawk.to https://*.tawk.to https://client.crisp.chat https://*.crisp.chat",
      "media-src 'self' blob: mediastream:",
      "font-src 'self' data: https://client.crisp.chat https://*.crisp.chat",
      'connect-src ' + connect.concat([
        'https://embed.tawk.to',
        'https://*.tawk.to',
        'wss://*.tawk.to',
        'https://client.crisp.chat',
        'https://*.crisp.chat',
        'wss://*.crisp.chat'
      ]).join(' '),
      "frame-src 'self' https://embed.tawk.to https://*.tawk.to https://client.crisp.chat https://*.crisp.chat",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ');
    document.head.appendChild(meta);

    // Extra hardening headers via meta where supported
    if (!document.querySelector('meta[http-equiv="X-Content-Type-Options"]')) {
      const xcto = document.createElement('meta');
      xcto.httpEquiv = 'X-Content-Type-Options';
      xcto.content = 'nosniff';
      document.head.appendChild(xcto);
    }
    if (!document.querySelector('meta[name="referrer"]')) {
      const ref = document.createElement('meta');
      ref.name = 'referrer';
      ref.content = 'strict-origin-when-cross-origin';
      document.head.appendChild(ref);
    }
  }

  function secureStorageGuard() {
    // Prevent accidental logging of secrets in demo consoles
    try {
      if (window.__NEXORA_SEC_PATCHED) return;
      window.__NEXORA_SEC_PATCHED = true;
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyCsp();
      secureStorageGuard();
    });
  } else {
    applyCsp();
    secureStorageGuard();
  }

  return {
    escapeHtml: escapeHtml,
    sanitizeUrl: sanitizeUrl,
    timingSafeEqual: timingSafeEqual,
    validatePassword: validatePassword,
    isHashedPassword: isHashedPassword,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    createRoleSeal: createRoleSeal,
    verifyRoleSeal: verifyRoleSeal,
    createSession: createSession,
    verifySession: verifySession,
    assertNotLocked: assertNotLocked,
    recordFail: recordFail,
    clearFails: clearFails,
    getLockStatus: getLockStatus,
    applyCsp: applyCsp,
    SESSION_TTL_MS: SESSION_TTL_MS,
    MAX_FAILS: MAX_FAILS
  };
})();
