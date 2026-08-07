/**
 * NEXORA Account — register/login, profile, orders, addresses
 * Passwords: PBKDF2 · Sessions: HMAC-signed · Roles: sealed
 */
const NexoraAccount = (function () {
  'use strict';

  const USERS_KEY = 'nexora-users';
  const SESSION_KEY = 'nexora-session';
  const ORDERS_KEY = 'nexora-orders';

  const DEMO_PLAIN = [
    {
      id: 'u001',
      email: 'demo@nexora.az',
      password: 'Demo1234',
      name: 'Sultan',
      phone: '+994 50 123 45 67',
      role: 'customer',
      addresses: [],
      createdAt: '2026-01-15T10:00:00'
    },
    {
      id: 'u002',
      email: 'admin@nexora.az',
      password: 'Admin1234',
      name: 'Admin NEXORA',
      phone: '+994 12 555 00 00',
      role: 'admin',
      addresses: [],
      createdAt: '2025-12-01T09:00:00'
    }
  ];

  function sec() {
    if (typeof NexoraSecurity === 'undefined') {
      throw new Error('NexoraSecurity yüklənməyib');
    }
    return NexoraSecurity;
  }

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined' ? NexoraSecurity.escapeHtml(s) : String(s || '');
  }

  async function hardenUser(user) {
    const S = sec();
    const u = Object.assign({}, user);
    // Migrate plaintext → hash
    if (typeof u.password === 'string' && u.password.length) {
      // Legacy short demos: allow verify but force upgrade path via policy on change
      u.password = await S.hashPassword(u.password);
    } else if (!S.isHashedPassword(u.password)) {
      throw new Error('İstifadəçi şifrəsi etibarsızdır');
    }
    delete u.passwordPlain;
    u.role = u.role === 'admin' ? 'admin' : 'customer';
    u.roleSeal = await S.createRoleSeal(u);
    u.updatedAt = new Date().toISOString();
    return u;
  }

  async function ensureSeedUsers(list) {
    let users = Array.isArray(list) ? list.slice() : [];
    const byEmail = function (email) {
      return users.findIndex(function (u) {
        return String(u.email || '').toLowerCase() === email;
      });
    };

    for (let i = 0; i < DEMO_PLAIN.length; i++) {
      const seed = DEMO_PLAIN[i];
      const idx = byEmail(seed.email);
      if (idx === -1) {
        users.push(Object.assign(await hardenUser(seed), { authVersion: 2 }));
      } else {
        const cur = users[idx];
        const hasHash = sec().isHashedPassword(cur.password);
        const sealOk = hasHash && cur.roleSeal ? await sec().verifyRoleSeal(cur) : false;
        const email = String(cur.email || '').toLowerCase();

        if (typeof cur.password === 'string' || !hasHash) {
          const plain = typeof cur.password === 'string' && cur.password ? cur.password : seed.password;
          const isSeedAdmin = seed.role === 'admin' && email === seed.email &&
            (plain === seed.password || plain === 'admin123');
          users[idx] = Object.assign(await hardenUser(Object.assign({}, cur, {
            password: plain,
            role: isSeedAdmin ? 'admin' : 'customer'
          })), { authVersion: 2 });
        } else if (!sealOk) {
          // Promote to sealed admin only if password matches known admin secrets
          let role = 'customer';
          if (email === 'admin@nexora.az') {
            const candidates = [seed.password, 'Admin1234', 'admin123'];
            for (let c = 0; c < candidates.length; c++) {
              if (await sec().verifyPassword(candidates[c], cur.password)) {
                role = 'admin';
                break;
              }
            }
          }
          users[idx] = Object.assign(
            await hardenUser(Object.assign({}, cur, { role: role })),
            { authVersion: 2 }
          );
        } else if (!cur.authVersion) {
          users[idx] = Object.assign({}, cur, { authVersion: 2 });
        }

        // Keep demo customer display name in sync with seed (welcome dashboard)
        if (email === 'demo@nexora.az' && seed.name &&
            (!cur.name || cur.name === 'Demo İstifadəçi')) {
          users[idx] = Object.assign({}, users[idx], { name: seed.name });
        }
      }
    }
    return users;
  }

  async function seedUsers() {
    let users = NexoraApp.storageGet(USERS_KEY, null);
    if (!users || !users.length) {
      try {
        const data = await NexoraApp.fetchJSON('data/users.json');
        users = data.users || DEMO_PLAIN.slice();
      } catch (e) {
        users = DEMO_PLAIN.slice();
      }
    }
    users = await ensureSeedUsers(users);
    // Strip any lingering plaintext fields
    users = await Promise.all(users.map(async function (u) {
      if (typeof u.password === 'string' || !u.roleSeal) return hardenUser(u);
      return u;
    }));
    NexoraApp.storageSet(USERS_KEY, users);
    return users;
  }

  async function resetAuthStore() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem('nexora-auth-lock');
    return seedUsers();
  }

  function getUsers() {
    return NexoraApp.storageGet(USERS_KEY, []);
  }

  function saveUsers(users) {
    // Never persist plaintext passwords
    const safe = (users || []).map(function (u) {
      const copy = Object.assign({}, u);
      if (typeof copy.password === 'string') {
        delete copy.password;
      }
      return copy;
    });
    NexoraApp.storageSet(USERS_KEY, safe);
  }

  function getSessionSync() {
    return NexoraApp.storageGet(SESSION_KEY, null);
  }

  async function getSession() {
    const raw = getSessionSync();
    if (!raw) {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken() && NexoraApi.me) {
        try {
          const me = await NexoraApi.me();
          if (me && me.user) {
            await upsertLocalUserFromApi(me.user);
            await setSession(me.user);
            return {
              id: me.user.id,
              email: me.user.email,
              name: me.user.name,
              phone: me.user.phone || '',
              role: me.user.role
            };
          }
        } catch (e) { /* token invalid */ }
      }
      return null;
    }
    const verified = await sec().verifySession(raw);
    if (!verified) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    let user = getUsers().find(function (u) { return u.id === verified.id; });
    if (!user) {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken() && NexoraApi.me) {
        try {
          const me = await NexoraApi.me();
          if (me && me.user && me.user.id === verified.id) {
            user = await upsertLocalUserFromApi(me.user);
          }
        } catch (e) { /* ignore */ }
      }
      if (!user) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
    }
    const sealOk = await sec().verifyRoleSeal(user);
    if (!sealOk || user.role !== verified.role) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return verified;
  }

  /** Sync helper for UI badges — may return stale; prefer getSession() */
  function getSessionCached() {
    const raw = getSessionSync();
    if (!raw || raw.v !== 2 || !raw.sig) return null;
    if (!raw.exp || Date.now() > Number(raw.exp)) return null;
    return {
      id: raw.id,
      email: raw.email,
      name: raw.name,
      phone: raw.phone,
      role: raw.role
    };
  }

  async function setSession(user) {
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const session = await sec().createSession(user);
    NexoraApp.storageSet(SESSION_KEY, session);
  }

  function validateEmail(email) {
    const mail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      throw new Error('E-poçt formatı yanlışdır');
    }
    return mail;
  }

  async function upsertLocalUserFromApi(apiUser, passwordHint) {
    const users = getUsers();
    const mail = String(apiUser.email || '').toLowerCase();
    let idx = users.findIndex(function (u) {
      return u.id === apiUser.id || String(u.email || '').toLowerCase() === mail;
    });
    const prev = idx >= 0 ? users[idx] : null;
    const base = {
      id: apiUser.id,
      email: apiUser.email,
      name: apiUser.name || (prev && prev.name) || 'User',
      phone: apiUser.phone || (prev && prev.phone) || '',
      role: apiUser.role || 'customer',
      addresses: apiUser.addresses || (prev && prev.addresses) || [],
      createdAt: apiUser.createdAt || (prev && prev.createdAt) || new Date().toISOString(),
      password: (prev && prev.password) || passwordHint || ('ApiLogin!' + String(apiUser.id || Date.now()).slice(-8) + 'x1')
    };
    const hardened = await hardenUser(base);
    if (prev && prev.password) hardened.password = prev.password;
    if (idx >= 0) users[idx] = Object.assign({}, prev, hardened);
    else users.push(hardened);
    NexoraApp.storageSet(USERS_KEY, users);
    return hardened;
  }

  async function register(payload) {
    if (typeof NexoraApi !== 'undefined') {
      try {
        var health = await NexoraApi.health();
        if (health && health.ok) {
          var data = await NexoraApi.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              password: payload.password,
              referralCode: payload.referralCode || ''
            })
          });
          if (data && data.token) NexoraApi.setToken(data.token);
          if (data && data.user) {
            await upsertLocalUserFromApi(data.user, payload.password);
            await setSession({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              phone: data.user.phone || '',
              role: data.user.role,
              addresses: data.user.addresses || [],
              referralCode: data.user.referralCode,
              referralCredit: data.user.referralCredit,
              createdAt: data.user.createdAt
            });
            try { document.dispatchEvent(new CustomEvent('nexora:auth-changed', { detail: { loggedIn: true } })); } catch (ev) { /* ignore */ }
            return data.user;
          }
        }
      } catch (e) {
        if (e && e.message) throw e;
      }
    }

    const S = sec();
    const mail = validateEmail(payload.email);
    const passCheck = S.validatePassword(payload.password, { minLength: 8 });
    if (!passCheck.ok) throw new Error(passCheck.message);
    const name = String(payload.name || '').trim();
    if (name.length < 2) throw new Error('Ad ən azı 2 simvol olmalıdır');

    const users = getUsers();
    if (users.some(function (u) { return String(u.email || '').toLowerCase() === mail; })) {
      throw new Error('Bu e-poçt artıq qeydiyyatdan keçib');
    }

    const user = await hardenUser({
      id: 'u' + Date.now(),
      email: mail,
      password: payload.password,
      name: name.slice(0, 80),
      phone: String(payload.phone || '').slice(0, 40),
      role: 'customer',
      addresses: [],
      createdAt: new Date().toISOString()
    });
    users.push(user);
    NexoraApp.storageSet(USERS_KEY, users);
    await setSession(user);
    return publicUser(user);
  }

  function publicUser(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      addresses: user.addresses || [],
      createdAt: user.createdAt
    };
  }

  async function login(email, password) {
    // Prefer API when available (needed for referral credit / JWT checkout)
    if (typeof NexoraApi !== 'undefined') {
      try {
        var health = await NexoraApi.health();
        if (health && health.ok) {
          var api = await NexoraApi.login(email, password);
          if (api && api.token) NexoraApi.setToken(api.token);
          if (api && api.user) {
            await upsertLocalUserFromApi(api.user, password);
            await setSession({
              id: api.user.id,
              email: api.user.email,
              name: api.user.name,
              phone: api.user.phone || '',
              role: api.user.role,
              addresses: api.user.addresses || [],
              referralCode: api.user.referralCode,
              referralCredit: api.user.referralCredit,
              createdAt: api.user.createdAt
            });
            try { document.dispatchEvent(new CustomEvent('nexora:auth-changed', { detail: { loggedIn: true } })); } catch (ev) { /* ignore */ }
            return api.user;
          }
        }
      } catch (e) {
        if (e && e.message && /yanlış|401|Unauthorized/i.test(e.message)) throw e;
        /* fall through to local */
      }
    }

    const S = sec();
    const mail = validateEmail(email);
    const pass = String(password || '');
    S.assertNotLocked(mail);

    await seedUsers();
    const users = getUsers();
    const user = users.find(function (u) {
      return String(u.email || '').toLowerCase() === mail;
    });

    if (!user) {
      S.recordFail(mail);
      throw new Error('E-poçt və ya şifrə yanlışdır');
    }

    const ok = await S.verifyPassword(pass, user.password);
    if (!ok) {
      S.recordFail(mail);
      throw new Error('E-poçt və ya şifrə yanlışdır');
    }

    let current = user;
    const sealOk = S.isHashedPassword(user.password) && user.roleSeal
      ? await S.verifyRoleSeal(user)
      : false;

    if (typeof user.password === 'string') {
      const email = String(user.email).toLowerCase();
      const isSeedAdmin = email === 'admin@nexora.az' &&
        (pass === 'Admin1234' || pass === 'admin123');
      current = Object.assign(
        await hardenUser(Object.assign({}, user, { password: pass, role: isSeedAdmin ? 'admin' : 'customer' })),
        { authVersion: 2 }
      );
      const idx = users.findIndex(function (u) { return u.id === user.id; });
      users[idx] = current;
      NexoraApp.storageSet(USERS_KEY, users);
    } else if (!sealOk) {
      // Broken / forged seal — do not trust role field; allow admin only for seed credentials
      const email = String(user.email).toLowerCase();
      const role = (email === 'admin@nexora.az' && (pass === 'Admin1234' || pass === 'admin123'))
        ? 'admin'
        : 'customer';
      current = Object.assign(
        await hardenUser(Object.assign({}, user, { role: role })),
        { authVersion: 2 }
      );
      const idx = users.findIndex(function (u) { return u.id === user.id; });
      users[idx] = current;
      NexoraApp.storageSet(USERS_KEY, users);
    }

    S.clearFails(mail);
    await setSession(current);
    try { document.dispatchEvent(new CustomEvent('nexora:auth-changed', { detail: { loggedIn: true } })); } catch (ev) { /* ignore */ }
    return publicUser(current);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    if (typeof NexoraApi !== 'undefined' && NexoraApi.clearToken) {
      NexoraApi.clearToken();
    }
    try { document.dispatchEvent(new CustomEvent('nexora:auth-changed', { detail: { loggedIn: false } })); } catch (ev) { /* ignore */ }
  }

  function isLoggedIn() {
    if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken()) return true;
    const cached = getSessionCached();
    return !!(cached && cached.id);
  }

  function authRequiredError(message) {
    const err = new Error(message || 'Davam etmək üçün qeydiyyatdan keçin və ya daxil olun');
    err.code = 'AUTH_REQUIRED';
    return err;
  }

  function ttAuth(key, fallback) {
    return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(key) : (fallback || key);
  }

  function promptLogin(opts) {
    opts = opts || {};
    const tab = opts.tab === 'login' ? 'login' : 'register';
    let next = opts.next;
    if (!next && typeof location !== 'undefined') {
      next = location.pathname + location.search + location.hash;
    }
    if (next && next.charAt(0) !== '/' && next.indexOf('http') !== 0 && typeof location !== 'undefined') {
      try {
        const abs = new URL(next, location.href);
        next = abs.pathname + abs.search + abs.hash;
      } catch (e) { /* keep relative */ }
    }
    let url = typeof NexoraApp !== 'undefined' ? NexoraApp.pageUrl('account.html') : 'account.html';
    url += (url.indexOf('?') === -1 ? '?' : '&') + 'tab=' + tab;
    if (next) url += '&next=' + encodeURIComponent(next);
    if (opts.redirect === false) return url;
    if (typeof location !== 'undefined') location.href = url;
    return url;
  }

  /** Friendly gate: side/bottom sheet instead of abrupt redirect */
  function showAuthGate(opts) {
    opts = opts || {};
    const title = opts.title || ttAuth('auth_gate_title', 'Əvvəlcə hesab yaradın');
    const message = opts.message || ttAuth('auth_gate_cart',
      'Səbətə məhsul əlavə etmək üçün qeydiyyatdan keçin və ya daxil olun. Cəmi 20 saniyə çəkir!');
    const next = opts.next;

    let el = document.getElementById('nexoraAuthGate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nexoraAuthGate';
      el.className = 'auth-gate';
      el.setAttribute('hidden', '');
      el.innerHTML =
        '<div class="auth-gate-backdrop" data-auth-gate-close></div>' +
        '<div class="auth-gate-panel" role="dialog" aria-modal="true" aria-labelledby="authGateTitle">' +
          '<button type="button" class="auth-gate-close" data-auth-gate-close aria-label="Bağla">×</button>' +
          '<div class="auth-gate-icon" aria-hidden="true">🛒</div>' +
          '<h3 id="authGateTitle" class="auth-gate-title"></h3>' +
          '<p class="auth-gate-text"></p>' +
          '<div class="auth-gate-actions">' +
            '<a class="btn btn-primary w-full" data-auth-gate-register>Qeydiyyatdan keç</a>' +
            '<a class="btn btn-outline w-full" data-auth-gate-login>Giriş et</a>' +
          '</div>' +
          '<p class="auth-gate-hint">Qonaqlar məhsullara baxa bilər — alış üçün hesab lazımdır.</p>' +
        '</div>';
      document.body.appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-auth-gate-close]')) {
          el.setAttribute('hidden', '');
          document.body.classList.remove('auth-gate-open');
        }
      });
    }

    el.querySelector('.auth-gate-title').textContent = title;
    el.querySelector('.auth-gate-text').textContent = message;
    const reg = el.querySelector('[data-auth-gate-register]');
    const log = el.querySelector('[data-auth-gate-login]');
    reg.textContent = ttAuth('register', 'Qeydiyyatdan keç');
    log.textContent = ttAuth('login', 'Giriş et');
    reg.href = promptLogin({ tab: 'register', next: next, redirect: false });
    log.href = promptLogin({ tab: 'login', next: next, redirect: false });
    el.removeAttribute('hidden');
    document.body.classList.add('auth-gate-open');
    return el;
  }

  async function requireShopAuth(opts) {
    opts = opts || {};
    if (isLoggedIn()) {
      const session = await getSession();
      if (session) return session;
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken()) {
        return { id: 'api', email: '' };
      }
    }
    const message = opts.message || ttAuth('auth_gate_cart',
      'Səbətə məhsul əlavə etmək üçün qeydiyyatdan keçin və ya daxil olun. Cəmi 20 saniyə çəkir!');
    if (opts.redirect !== false) {
      showAuthGate({
        title: opts.title || ttAuth('auth_gate_title', 'Əvvəlcə hesab yaradın'),
        message: message,
        next: opts.next
      });
    }
    throw authRequiredError(message);
  }

  async function requireUser() {
    const session = await getSession();
    if (!session) throw new Error('Daxil olmamısınız');
    return session;
  }

  async function requireAdmin() {
    const session = await requireUser();
    if (session.role !== 'admin') throw new Error('Admin hüququ yoxdur');
    return session;
  }

  async function updateProfile(fields) {
    const session = await requireUser();
    const users = getUsers();
    const idx = users.findIndex(function (u) { return u.id === session.id; });
    if (idx === -1) throw new Error('İstifadəçi tapılmadı');

    const allowed = {};
    if (fields.name != null) allowed.name = String(fields.name).trim().slice(0, 80);
    if (fields.phone != null) allowed.phone = String(fields.phone).trim().slice(0, 40);
    if (fields.addresses != null) allowed.addresses = fields.addresses;

    // Role / email / password cannot be changed here
    users[idx] = Object.assign({}, users[idx], allowed);
    users[idx].roleSeal = await sec().createRoleSeal(users[idx]);
    NexoraApp.storageSet(USERS_KEY, users);
    await setSession(users[idx]);
    return publicUser(users[idx]);
  }

  async function changePassword(currentPassword, newPassword) {
    const session = await requireUser();
    const S = sec();
    const users = getUsers();
    const idx = users.findIndex(function (u) { return u.id === session.id; });
    if (idx === -1) throw new Error('İstifadəçi tapılmadı');

    const ok = await S.verifyPassword(currentPassword, users[idx].password);
    if (!ok) throw new Error('Cari şifrə yanlışdır');

    const check = S.validatePassword(newPassword, { minLength: 8 });
    if (!check.ok) throw new Error(check.message);

    users[idx] = await hardenUser(Object.assign({}, users[idx], { password: newPassword }));
    NexoraApp.storageSet(USERS_KEY, users);
    await setSession(users[idx]);
    return true;
  }

  async function getCurrentUser() {
    const session = await getSession();
    if (!session) return null;
    const user = getUsers().find(function (u) { return u.id === session.id; });
    if (user) return publicUser(user);
    if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken() && NexoraApi.me) {
      try {
        const me = await NexoraApi.me();
        if (me && me.user) {
          await upsertLocalUserFromApi(me.user);
          return publicUser(Object.assign({}, me.user));
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  function getOrders() {
    return NexoraApp.storageGet(ORDERS_KEY, []);
  }

  function saveOrder(order) {
    const orders = getOrders();
    orders.unshift(order);
    NexoraApp.storageSet(ORDERS_KEY, orders);
    return order;
  }

  async function getUserOrders() {
    const user = await getSession();
    if (!user) return [];

    if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken()) {
      try {
        const res = await NexoraApi.myOrders();
        if (res && Array.isArray(res.orders)) {
          return res.orders.map(function (o) {
            const totals = o.totals || {};
            return {
              id: o.id,
              userId: o.userId || user.id,
              email: (o.customer && o.customer.email) || user.email,
              status: o.status,
              items: o.items || [],
              total: o.total != null ? o.total : totals.total,
              totals: totals,
              timeline: o.timeline,
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
              customer: o.customer
            };
          });
        }
      } catch (e) { /* fall through */ }
    }

    return getOrders().filter(function (o) { return o.userId === user.id || o.email === user.email; });
  }

  async function addAddress(address) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Daxil olmamısınız');
    const addr = {
      id: 'a' + Date.now(),
      title: String(address.title || '').slice(0, 40),
      fullName: String(address.fullName || '').slice(0, 80),
      phone: String(address.phone || '').slice(0, 40),
      city: String(address.city || '').slice(0, 60),
      district: String(address.district || '').slice(0, 60),
      address: String(address.address || '').slice(0, 200),
      postalCode: String(address.postalCode || '').slice(0, 20),
      isDefault: !!address.isDefault
    };
    const full = getUsers().find(function (u) { return u.id === user.id; });
    const addresses = (full && full.addresses ? full.addresses.slice() : []);
    if (addr.isDefault) addresses.forEach(function (a) { a.isDefault = false; });
    addresses.push(addr);
    return updateProfile({ addresses: addresses });
  }

  async function setUserRole(targetId, role, adminPassword) {
    await requireAdmin();
    const S = sec();
    if (role !== 'admin' && role !== 'customer') throw new Error('Rol etibarsızdır');

    const session = await getSession();
    const users = getUsers();
    const admin = users.find(function (u) { return u.id === session.id; });
    const passOk = await S.verifyPassword(adminPassword, admin.password);
    if (!passOk) throw new Error('Təsdiq şifrəsi yanlışdır');

    const idx = users.findIndex(function (u) { return u.id === targetId; });
    if (idx === -1) throw new Error('İstifadəçi tapılmadı');
    if (users[idx].id === session.id && role !== 'admin') {
      throw new Error('Öz admin rolunuzu silə bilməzsiniz');
    }

    users[idx] = await hardenUser(Object.assign({}, users[idx], { role: role }));
    NexoraApp.storageSet(USERS_KEY, users);
    return publicUser(users[idx]);
  }

  return {
    seedUsers: seedUsers,
    resetAuthStore: resetAuthStore,
    getUsers: getUsers,
    getSession: getSession,
    getSessionCached: getSessionCached,
    isLoggedIn: isLoggedIn,
    promptLogin: promptLogin,
    showAuthGate: showAuthGate,
    requireShopAuth: requireShopAuth,
    requireUser: requireUser,
    register: register,
    login: login,
    logout: logout,
    updateProfile: updateProfile,
    changePassword: changePassword,
    getCurrentUser: getCurrentUser,
    getOrders: getOrders,
    saveOrder: saveOrder,
    getUserOrders: getUserOrders,
    addAddress: addAddress,
    requireAdmin: requireAdmin,
    setUserRole: setUserRole,
    escape: esc,
    DEMO_HINT: {
      admin: { email: 'admin@nexora.az', password: 'Admin1234' },
      demo: { email: 'demo@nexora.az', password: 'Demo1234' }
    }
  };
})();

(function () {
  'use strict';

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined' ? NexoraSecurity.escapeHtml(s) : String(s || '');
  }

  function showPanel(name) {
    document.querySelectorAll('.account-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-panel') === name);
    });
    document.querySelectorAll('[data-account-nav]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-account-nav') === name);
    });
    if (name === 'service') {
      bindServiceUi();
      renderServiceHistory(false);
    }
    if (name === 'overview' && overviewCache.profile) {
      renderOverviewDashboard(overviewCache.profile, overviewCache.orders);
    }
    if (name === 'digital-twin' && typeof NexoraDigitalTwin !== 'undefined') {
      NexoraDigitalTwin.render({
        orders: overviewCache.orders,
        selectId: overviewCache.twinSelectId || null
      });
      overviewCache.twinSelectId = null;
    }
  }

  window.__nexoraShowAccountPanel = showPanel;

  var overviewCache = { profile: null, orders: [] };

  function firstNameOf(name) {
    var n = String(name || '').trim().split(/\s+/)[0];
    return n || 'dost';
  }

  function dashProductChip(p) {
    if (!p) return '';
    var href = '../pages/product.html?id=' + encodeURIComponent(p.id);
    var thumb = typeof NexoraApp !== 'undefined' && NexoraApp.productThumbHTML
      ? NexoraApp.productThumbHTML(p, 'dash-chip-thumb')
      : '';
    var price = typeof NexoraApp !== 'undefined'
      ? NexoraApp.formatPrice(p.price, p.currency)
      : String(p.price || '');
    var old = p.oldPrice && p.oldPrice > p.price
      ? '<span class="price-old">' + NexoraApp.formatPrice(p.oldPrice, p.currency) + '</span>'
      : '';
    return '<a class="dash-chip" href="' + href + '">' + thumb +
      '<span class="dash-chip-body">' +
        '<strong>' + esc(p.name) + '</strong>' +
        '<span class="dash-chip-price"><span class="price">' + price + '</span>' + old + '</span>' +
      '</span></a>';
  }

  function dashEmpty(msg, href, cta) {
    return '<div class="dash-empty">' +
      '<p class="text-muted mb-2">' + esc(msg) + '</p>' +
      (href ? '<a class="btn btn-outline btn-sm" href="' + href + '">' + esc(cta || 'Bax') + '</a>' : '') +
      '</div>';
  }

  async function collectWarranties(orders) {
    var cards = [];
    try {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken()) {
        var res = await NexoraApi.myWarranties();
        cards = (res.warranties || []).map(function (w) {
          return Object.assign({}, w, {
            name: w.productName || w.name,
            start: w.startAt || w.start,
            end: w.endAt || w.end
          });
        });
      }
    } catch (e) { /* local fallback */ }
    if (!cards.length && typeof NexoraSmart !== 'undefined') {
      cards = NexoraSmart.warrantiesFromOrders(orders || []);
    }
    return cards;
  }

  async function renderOverviewDashboard(profile, orders) {
    var root = document.getElementById('overviewDash');
    if (!root) return;
    overviewCache.profile = profile;
    overviewCache.orders = orders || [];

    var first = firstNameOf(profile && profile.name);
    root.innerHTML = '<p class="text-muted">Yüklənir…</p>';

    var products = [];
    try {
      products = await NexoraApp.loadProducts();
    } catch (e) {
      products = [];
    }
    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });

    var wishCount = (typeof NexoraWishlist !== 'undefined') ? NexoraWishlist.count() : 0;
    var wishIds = (typeof NexoraWishlist !== 'undefined' && NexoraWishlist.getIds)
      ? NexoraWishlist.getIds()
      : [];

    var warranties = await collectWarranties(orders);
    var invoiceOrders = (orders || []).filter(function (o) {
      return !/cancel|cancelled|ləğv/i.test(String(o.status || ''));
    });

    var bonusXp = 0;
    if (typeof NexoraSmart !== 'undefined') {
      bonusXp = (NexoraSmart.getXp().points || 0);
    }
    var refCredit = 0;
    try {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken()) {
        var mine = await NexoraApi.myReferral();
        refCredit = (mine.referral && mine.referral.credit) || 0;
      }
    } catch (e2) { /* ignore */ }
    var bonusDisplay = bonusXp + Math.round(Number(refCredit) || 0);

    var views = (typeof NexoraSmart !== 'undefined') ? NexoraSmart.getViewStats() : {};
    var recentIds = Object.keys(views).sort(function (a, b) {
      return (views[b] || 0) - (views[a] || 0);
    }).slice(0, 8);
    var recentProducts = recentIds.map(function (id) { return byId[id]; }).filter(Boolean);

    var ownedIds = {};
    warranties.forEach(function (w) {
      if (w.productId) ownedIds[w.productId] = true;
    });
    (orders || []).forEach(function (o) {
      (o.items || []).forEach(function (i) {
        var pid = i.productId || i.id;
        if (pid) ownedIds[pid] = true;
      });
    });

    var catScore = {};
    var subScore = {};
    recentIds.forEach(function (id) {
      var p = byId[id];
      if (!p) return;
      catScore[p.category] = (catScore[p.category] || 0) + (views[id] || 1) * 2;
      if (p.subcategory) subScore[p.subcategory] = (subScore[p.subcategory] || 0) + 3;
    });
    (wishIds || []).forEach(function (id) {
      var p = byId[id];
      if (!p) return;
      catScore[p.category] = (catScore[p.category] || 0) + 3;
      if (p.subcategory) subScore[p.subcategory] = (subScore[p.subcategory] || 0) + 2;
    });

    var aiRecs = products
      .filter(function (p) {
        return !ownedIds[p.id] && (wishIds || []).indexOf(p.id) < 0;
      })
      .map(function (p) {
        var s = (catScore[p.category] || 0) + (subScore[p.subcategory] || 0) + (p.rating || 0);
        if (p.isNew) s += 1;
        if (p.oldPrice && p.oldPrice > p.price) s += 2;
        return { p: p, s: s };
      })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 6)
      .map(function (x) { return x.p; });

    if (!aiRecs.length) {
      aiRecs = products
        .filter(function (p) { return !ownedIds[p.id]; })
        .sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); })
        .slice(0, 6);
    }

    var deals = products
      .filter(function (p) { return p.oldPrice && p.oldPrice > p.price; })
      .sort(function (a, b) {
        var da = (a.oldPrice - a.price) / a.oldPrice;
        var db = (b.oldPrice - b.price) / b.oldPrice;
        return db - da;
      })
      .slice(0, 6);

    var serviceDue = warranties
      .filter(function (w) {
        var d = typeof w.daysLeft === 'number' ? w.daysLeft : 9999;
        return d >= 0 && d <= 90;
      })
      .sort(function (a, b) { return a.daysLeft - b.daysLeft; })
      .slice(0, 6);

    var devices = [];
    var seenDev = {};
    warranties.forEach(function (w) {
      var key = w.productId || w.serial || w.name || w.productName;
      if (!key || seenDev[key]) return;
      seenDev[key] = true;
      devices.push(w);
    });
    try {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.serviceHistory && NexoraApi.getToken()) {
        var hist = await NexoraApi.serviceHistory();
        (hist.purchases || hist.orders || []).forEach(function (row) {
          (row.items || [row]).forEach(function (it) {
            var key = it.productId || it.id || it.name;
            if (!key || seenDev[key]) return;
            seenDev[key] = true;
            devices.push({
              productId: it.productId || it.id,
              name: it.name || it.productName,
              productName: it.name || it.productName,
              brand: it.brand || '',
              serial: it.serial || '',
              daysLeft: typeof it.daysLeft === 'number' ? it.daysLeft : null,
              endAt: it.endAt || it.warrantyEnd || ''
            });
          });
        });
      }
    } catch (e3) { /* ignore */ }

    var stats = [
      { icon: '📦', label: 'sifariş', value: (orders || []).length, go: 'orders' },
      { icon: '❤️', label: 'wishlist', value: wishCount, href: 'wishlist.html' },
      { icon: '🛡', label: 'zəmanət', value: warranties.length, go: 'warranty' },
      { icon: '📄', label: 'faktura', value: invoiceOrders.length, go: 'orders' },
      { icon: '🎁', label: 'bonus', value: bonusDisplay, go: 'rewards' }
    ];

    var statsHtml = stats.map(function (s) {
      var attr = s.go
        ? ' data-dash-go="' + esc(s.go) + '"'
        : (s.href ? ' href="' + esc(s.href) + '"' : '');
      var tag = s.href ? 'a' : 'button';
      var type = s.href ? '' : ' type="button"';
      return '<' + tag + type + ' class="dash-stat"' + attr + '>' +
        '<span class="dash-stat-icon" aria-hidden="true">' + s.icon + '</span>' +
        '<span class="dash-stat-n">' + esc(s.value) + '</span>' +
        '<span class="dash-stat-label">' + esc(s.label) + '</span>' +
        '</' + tag + '>';
    }).join('');

    var recentHtml = recentProducts.length
      ? '<div class="dash-chip-row">' + recentProducts.map(dashProductChip).join('') + '</div>'
      : dashEmpty('Hələ baxış yoxdur — kataloqda gəzin.', 'products.html', 'Kataloqa keç');

    var aiHtml = aiRecs.length
      ? '<div class="dash-chip-row">' + aiRecs.map(dashProductChip).join('') + '</div>'
      : dashEmpty('Tövsiyə üçün məhsullara baxın.', 'products.html', 'Kəşf et');

    var dealsHtml = deals.length
      ? '<div class="dash-chip-row">' + deals.map(dashProductChip).join('') + '</div>'
      : dashEmpty('Hazırda aktiv endirim yoxdur.', 'products.html', 'Kataloq');

    var dueHtml = serviceDue.length
      ? '<div class="dash-list">' + serviceDue.map(function (w) {
          var name = w.productName || w.name || 'Məhsul';
          var left = typeof w.daysLeft === 'number' ? daysLabel(w.daysLeft) : '—';
          return '<button type="button" class="dash-list-item" data-dash-go="service">' +
            '<span class="dash-list-title">' + esc(name) + '</span>' +
            '<span class="dash-list-meta text-muted">' + esc(left) + '</span>' +
            '</button>';
        }).join('') + '</div>'
      : dashEmpty('Yaxınlaşan servis vaxtı yoxdur.', null, null);

    var devicesHtml = devices.length
      ? '<div class="dash-list">' + devices.slice(0, 8).map(function (w) {
          var name = w.productName || w.name || 'Cihaz';
          var meta = [w.brand, w.serial].filter(Boolean).join(' · ') ||
            (w.endAt ? 'Zəmanət: ' + w.endAt : 'Zəmanətli cihaz');
          var twinKey = w.id || w.productId || '';
          return '<button type="button" class="dash-list-item" data-dash-twin="' + esc(twinKey) + '">' +
            '<span class="dash-list-title">' + esc(name) + '</span>' +
            '<span class="dash-list-meta text-muted">' + esc(meta) + '</span>' +
            '</button>';
        }).join('') +
        '<button type="button" class="btn btn-outline btn-sm mt-3" data-dash-go="digital-twin">Digital Twin — hamısına bax</button></div>'
      : dashEmpty('Alışlardan sonra rəqəmsal əkizləriniz burada görünəcək.', 'products.html', 'Alış-verişə başla');

    root.innerHTML =
      '<header class="dash-welcome">' +
        '<h2 class="dash-welcome-title">👋 Xoş gəlmisiniz, ' + esc(first) + '</h2>' +
        '<p class="dash-welcome-sub text-muted">Şəxsi kabinetiniz — sifarişlər, zəmanət və tövsiyələr bir yerdə.</p>' +
      '</header>' +
      '<div class="dash-stats">' + statsHtml + '</div>' +
      '<div class="dash-sections">' +
        '<section class="dash-section">' +
          '<h3 class="dash-section-title">📈 Son baxılanlar</h3>' + recentHtml +
        '</section>' +
        '<section class="dash-section">' +
          '<h3 class="dash-section-title">🤖 AI tövsiyələri</h3>' + aiHtml +
        '</section>' +
        '<section class="dash-section">' +
          '<h3 class="dash-section-title">🔥 Aktiv endirimlər</h3>' + dealsHtml +
        '</section>' +
        '<section class="dash-section">' +
          '<h3 class="dash-section-title">📅 Servis vaxtı yaxınlaşan məhsullar</h3>' + dueHtml +
        '</section>' +
        '<section class="dash-section dash-section-wide">' +
          '<h3 class="dash-section-title">🔥 Digital Twin — cihazlarım</h3>' + devicesHtml +
        '</section>' +
      '</div>';

    root.querySelectorAll('[data-dash-go]').forEach(function (el) {
      el.addEventListener('click', function () {
        showPanel(el.getAttribute('data-dash-go'));
      });
    });
    root.querySelectorAll('[data-dash-twin]').forEach(function (el) {
      el.addEventListener('click', function () {
        overviewCache.twinSelectId = el.getAttribute('data-dash-twin') || null;
        showPanel('digital-twin');
      });
    });
  }

  function warrantyStatusMeta(status) {
    if (status === 'expired') return { label: 'Bitib', cls: 'badge-dark', bar: 'is-expired' };
    if (status === 'expiring') return { label: 'Bitmək üzrə', cls: 'badge-warning', bar: 'is-expiring' };
    return { label: 'Aktiv', cls: 'badge-primary', bar: 'is-active' };
  }

  function daysLabel(daysLeft) {
    if (daysLeft < 0) return Math.abs(daysLeft) + ' gün əvvəl bitib';
    if (daysLeft === 0) return 'Bu gün bitir';
    return 'Bitməsinə ' + daysLeft + ' gün qalıb';
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    const href = URL.createObjectURL(blob);
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
  }

  async function renderWarrantyCenter(profile, orders) {
    const war = document.getElementById('warrantyPanel');
    const summaryEl = document.getElementById('warrantySummary');
    if (!war) return;

    war.innerHTML = '<p class="text-muted">Yüklənir…</p>';
    let cards = [];
    let fromApi = false;

    try {
      if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken()) {
        const res = await NexoraApi.myWarranties();
        cards = (res.warranties || []).map(function (w) {
          return Object.assign({}, w, {
            name: w.productName,
            start: w.startAt,
            end: w.endAt
          });
        });
        fromApi = true;
        if (summaryEl && res.summary) {
          summaryEl.innerHTML =
            '<div class="warranty-stat"><span class="warranty-stat-n">' + esc(res.summary.total) + '</span><span>Cəmi</span></div>' +
            '<div class="warranty-stat is-ok"><span class="warranty-stat-n">' + esc(res.summary.active) + '</span><span>Aktiv</span></div>' +
            '<div class="warranty-stat is-warn"><span class="warranty-stat-n">' + esc(res.summary.expiring) + '</span><span>Bitmək üzrə</span></div>' +
            '<div class="warranty-stat is-bad"><span class="warranty-stat-n">' + esc(res.summary.expired) + '</span><span>Bitib</span></div>';
        }
      }
    } catch (e) {
      fromApi = false;
    }

    if (!cards.length && typeof NexoraSmart !== 'undefined') {
      cards = NexoraSmart.warrantiesFromOrders(orders || []);
      if (summaryEl) {
        const active = cards.filter(function (c) { return c.status === 'active'; }).length;
        const expiring = cards.filter(function (c) { return c.status === 'expiring'; }).length;
        const expired = cards.filter(function (c) { return c.status === 'expired'; }).length;
        summaryEl.innerHTML =
          '<div class="warranty-stat"><span class="warranty-stat-n">' + cards.length + '</span><span>Cəmi</span></div>' +
          '<div class="warranty-stat is-ok"><span class="warranty-stat-n">' + active + '</span><span>Aktiv</span></div>' +
          '<div class="warranty-stat is-warn"><span class="warranty-stat-n">' + expiring + '</span><span>Bitmək üzrə</span></div>' +
          '<div class="warranty-stat is-bad"><span class="warranty-stat-n">' + expired + '</span><span>Bitib</span></div>';
      }
    }

    if (!cards.length) {
      if (summaryEl) summaryEl.innerHTML = '';
      war.innerHTML =
        '<div class="card"><div class="card-body">' +
          '<p class="mb-3">Hələ zəmanət kartı yoxdur. Sifariş verdikdə burada görünəcək.</p>' +
          '<a class="btn btn-primary" href="products.html">Kataloqa keç</a>' +
        '</div></div>';
      return;
    }

    war.innerHTML = cards.map(function (c) {
      const meta = warrantyStatusMeta(c.status);
      const months = c.months || 12;
      const days = typeof c.daysLeft === 'number' ? c.daysLeft : 0;
      const pct = Math.max(0, Math.min(100, days < 0 ? 0 : Math.round((days / Math.max(1, months * 30)) * 100)));
      return '<div class="card warranty-card mb-3" data-warranty-id="' + esc(c.id) + '"><div class="card-body">' +
        '<div class="flex justify-between items-start gap-3 flex-wrap">' +
          '<div>' +
            '<div class="text-sm text-muted">' + esc(c.brand || 'NEXORA') +
              (c.sku ? ' · ' + esc(c.sku) : '') + '</div>' +
            '<strong class="warranty-title">' + esc(c.productName || c.name) + '</strong>' +
          '</div>' +
          '<span class="badge ' + meta.cls + '">' + meta.label + '</span>' +
        '</div>' +
        '<p class="warranty-countdown mt-3 ' + meta.bar + '">' + esc(daysLabel(days)) + '</p>' +
        '<div class="warranty-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
        '<div class="warranty-meta text-sm text-muted mt-3">' +
          '<span>Başlama: <strong>' + esc(c.startAt || c.start) + '</strong></span>' +
          '<span>Bitmə: <strong>' + esc(c.endAt || c.end) + '</strong></span>' +
          '<span>' + esc(months) + ' ay</span>' +
          (c.orderId ? '<span>Sifariş: ' + esc(c.orderId) + '</span>' : '') +
          (c.serial ? '<span>Seriya: ' + esc(c.serial) + '</span>' : '') +
        '</div>' +
        '<div class="flex gap-2 flex-wrap mt-4">' +
          '<button type="button" class="btn btn-primary btn-sm" data-warranty-pdf="' + esc(c.id) + '">PDF zəmanət</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-warranty-service="' + esc(c.id) +
            '">Servis müraciəti</button>' +
        '</div>' +
      '</div></div>';
    }).join('') +
      '<p class="text-xs text-muted mt-2">' +
        (fromApi
          ? 'Mənbə: NEXORA Warranty Center API · PDF rəsmi sertifikat kimi yüklənir.'
          : 'Lokal sifarişlərdən hesablanıb. Tam mərkəz üçün demo@nexora.az ilə API-yə daxil olun.') +
      '</p>';

    war.querySelectorAll('[data-warranty-pdf]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const id = btn.getAttribute('data-warranty-pdf');
        const card = cards.find(function (x) { return x.id === id; });
        btn.disabled = true;
        try {
          let blob = null;
          if (fromApi && typeof NexoraApi !== 'undefined' && NexoraApi.downloadWarrantyPdf) {
            blob = await NexoraApi.downloadWarrantyPdf(id);
          } else if (typeof NexoraSmart !== 'undefined' && NexoraSmart.buildLocalWarrantyPdf && card) {
            blob = NexoraSmart.buildLocalWarrantyPdf(card, profile || {});
          }
          if (!blob) throw new Error('PDF yaradıla bilmədi');
          downloadBlob(blob, 'nexora-warranty-' + id + '.pdf');
          if (typeof NexoraToast !== 'undefined') NexoraToast.success('PDF zəmanət yükləndi');
        } catch (err) {
          if (typeof NexoraToast !== 'undefined') NexoraToast.error(err.message || 'PDF xətası');
        } finally {
          btn.disabled = false;
        }
      });
    });

    war.querySelectorAll('[data-warranty-service]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPanel('service');
        openServiceTicketForm(btn.getAttribute('data-warranty-service'));
      });
    });
  }

  var serviceState = { tab: 'purchases', history: null };

  function ticketStatusMeta(status) {
    if (status === 'completed') return { label: 'Tamamlandı', cls: 'badge-success' };
    if (status === 'cancelled') return { label: 'Ləğv', cls: 'badge-dark' };
    if (status === 'waiting_parts') return { label: 'Hissə gözlənilir', cls: 'badge-warning' };
    if (status === 'in_progress') return { label: 'İşlənir', cls: 'badge-primary' };
    return { label: 'Açıq', cls: 'badge-primary' };
  }

  function typeLabel(type) {
    if (type === 'warranty_claim') return 'Zəmanət';
    if (type === 'diagnostic') return 'Diaqnostika';
    if (type === 'other') return 'Digər';
    return 'Təmir';
  }

  function fillWarrantySelect(selectedId) {
    var sel = document.getElementById('svcWarranty');
    if (!sel) return;
    var wars = (serviceState.history && serviceState.history.warranties) || [];
    if (!wars.length) {
      sel.innerHTML = '<option value="">Zəmanət yoxdur — əvvəlcə sifariş verin</option>';
      return;
    }
    sel.innerHTML = wars.map(function (w) {
      return '<option value="' + esc(w.id) + '"' + (selectedId === w.id ? ' selected' : '') + '>' +
        esc(w.productName) + ' · ' + esc(w.startAt) + ' → ' + esc(w.endAt) + '</option>';
    }).join('');
  }

  function openServiceTicketForm(warrantyId) {
    var formWrap = document.getElementById('serviceTicketForm');
    if (!formWrap) return;
    formWrap.hidden = false;
    fillWarrantySelect(warrantyId || '');
    var subject = document.getElementById('svcSubject');
    if (subject) subject.focus();
    formWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderServiceTab() {
    var panel = document.getElementById('servicePanel');
    if (!panel || !serviceState.history) return;
    var h = serviceState.history;
    var tab = serviceState.tab;

    document.querySelectorAll('[data-service-tab]').forEach(function (btn) {
      var on = btn.getAttribute('data-service-tab') === tab;
      btn.classList.toggle('is-active', on);
      btn.classList.toggle('btn-primary', on);
      btn.classList.toggle('btn-outline', !on);
    });

    if (tab === 'purchases') {
      var list = h.purchases || [];
      if (!list.length) {
        panel.innerHTML = '<div class="card"><div class="card-body"><p class="mb-0">Hələ alış yoxdur.</p></div></div>';
        return;
      }
      panel.innerHTML = list.map(function (p) {
        var w = p.warranty;
        var wMeta = w ? warrantyStatusMeta(w.status) : null;
        return '<div class="card service-card mb-3"><div class="card-body">' +
          '<div class="flex justify-between flex-wrap gap-2 items-start">' +
            '<div>' +
              '<div class="text-sm text-muted">' + esc(p.brand || 'NEXORA') +
                (p.orderId ? ' · sifariş ' + esc(p.orderId) : '') + '</div>' +
              '<strong>' + esc(p.productName) + '</strong>' +
            '</div>' +
            (wMeta ? '<span class="badge ' + wMeta.cls + '">Zəmanət: ' + wMeta.label + '</span>' : '') +
          '</div>' +
          '<div class="service-meta text-sm mt-3">' +
            '<div><span class="text-muted">Alınıb</span><strong>' + esc(p.purchasedAt) + '</strong></div>' +
            (w
              ? '<div><span class="text-muted">Zəmanət</span><strong>' + esc(w.months) + ' ay · ' +
                esc(w.startAt) + ' → ' + esc(w.endAt) + '</strong></div>' +
                '<div><span class="text-muted">Qalan</span><strong>' + esc(daysLabel(w.daysLeft)) + '</strong></div>'
              : '<div><span class="text-muted">Zəmanət</span><strong>Qeyd yoxdur</strong></div>') +
            (p.serial || (w && w.serial)
              ? '<div><span class="text-muted">Seriya</span><strong>' + esc(p.serial || w.serial) + '</strong></div>'
              : '') +
          '</div>' +
          (w
            ? '<div class="flex gap-2 flex-wrap mt-3">' +
                '<button type="button" class="btn btn-outline btn-sm" data-svc-from-purchase="' + esc(w.id) +
                  '">Servis müraciəti</button>' +
              '</div>'
            : '') +
        '</div></div>';
      }).join('');

      panel.querySelectorAll('[data-svc-from-purchase]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openServiceTicketForm(btn.getAttribute('data-svc-from-purchase'));
        });
      });
      return;
    }

    if (tab === 'tickets') {
      var tickets = h.tickets || [];
      if (!tickets.length) {
        panel.innerHTML = '<div class="card"><div class="card-body">' +
          '<p class="mb-3">Servis müraciəti yoxdur.</p>' +
          '<button type="button" class="btn btn-primary btn-sm" id="svcEmptyNew">Yeni müraciət</button>' +
          '</div></div>';
        var emptyBtn = document.getElementById('svcEmptyNew');
        if (emptyBtn) emptyBtn.addEventListener('click', function () { openServiceTicketForm(); });
        return;
      }
      panel.innerHTML = tickets.map(function (t) {
        var meta = ticketStatusMeta(t.status);
        var events = (t.events || []).slice().reverse().slice(0, 5);
        return '<div class="card service-card mb-3"><div class="card-body">' +
          '<div class="flex justify-between flex-wrap gap-2">' +
            '<div>' +
              '<div class="text-sm text-muted">' + esc(typeLabel(t.type)) + ' · ' + esc(t.brand || '') + '</div>' +
              '<strong>' + esc(t.subject) + '</strong>' +
              '<div class="text-sm mt-1">' + esc(t.productName) + '</div>' +
            '</div>' +
            '<span class="badge ' + meta.cls + '">' + meta.label + '</span>' +
          '</div>' +
          (t.description ? '<p class="text-sm text-muted mt-3 mb-0">' + esc(t.description) + '</p>' : '') +
          '<ol class="service-timeline mt-4">' +
            events.map(function (ev) {
              return '<li>' +
                '<div class="service-timeline-dot" data-kind="' + esc(ev.kind) + '"></div>' +
                '<div><strong>' + esc(ev.title) + '</strong>' +
                  (ev.detail ? '<div class="text-sm text-muted">' + esc(ev.detail) + '</div>' : '') +
                  '<div class="text-xs text-muted">' + esc(new Date(ev.createdAt).toLocaleString('az-AZ')) + '</div>' +
                '</div></li>';
            }).join('') +
          '</ol>' +
          '<div class="flex gap-2 flex-wrap mt-3">' +
            (t.status !== 'completed' && t.status !== 'cancelled'
              ? '<button type="button" class="btn btn-ghost btn-sm" data-svc-cancel="' + esc(t.id) + '">Ləğv et</button>'
              : '') +
            '<span class="text-xs text-muted align-self-center">№ ' + esc(t.id) + '</span>' +
          '</div>' +
        '</div></div>';
      }).join('');

      panel.querySelectorAll('[data-svc-cancel]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await NexoraApi.setServiceTicketStatus(btn.getAttribute('data-svc-cancel'), 'cancelled', 'İstifadəçi ləğv etdi');
            NexoraToast.info('Müraciət ləğv edildi');
            await renderServiceHistory(true);
          } catch (e) {
            NexoraToast.error(e.message || 'Xəta');
          }
        });
      });
      return;
    }

    // repairs
    var repairs = h.repairs || [];
    if (!repairs.length) {
      panel.innerHTML = '<div class="card"><div class="card-body"><p class="mb-0">Təmir tarixçəsi hələ boşdur.</p></div></div>';
      return;
    }
    panel.innerHTML = '<ol class="service-timeline service-timeline--full">' +
      repairs.map(function (r) {
        return '<li>' +
          '<div class="service-timeline-dot" data-kind="' + esc(r.kind) + '"></div>' +
          '<div class="card service-repair-card"><div class="card-body">' +
            '<div class="flex justify-between flex-wrap gap-2">' +
              '<strong>' + esc(r.title) + '</strong>' +
              '<span class="badge ' + ticketStatusMeta(r.status).cls + '">' + ticketStatusMeta(r.status).label + '</span>' +
            '</div>' +
            '<div class="text-sm text-muted mt-1">' + esc(r.productName) +
              (r.brand ? ' · ' + esc(r.brand) : '') + '</div>' +
            (r.detail ? '<p class="text-sm mt-2 mb-0">' + esc(r.detail) + '</p>' : '') +
            '<div class="text-xs text-muted mt-2">' + esc(new Date(r.createdAt).toLocaleString('az-AZ')) +
              ' · müraciət ' + esc(r.ticketId) + '</div>' +
          '</div></div></li>';
      }).join('') +
    '</ol>';
  }

  async function renderServiceHistory(force) {
    var panel = document.getElementById('servicePanel');
    var summaryEl = document.getElementById('serviceSummary');
    if (!panel) return;

    if (!force && serviceState.history) {
      renderServiceTab();
      return;
    }

    panel.innerHTML = '<p class="text-muted">Yüklənir…</p>';
    try {
      if (typeof NexoraApi === 'undefined' || !NexoraApi.getToken || !NexoraApi.getToken()) {
        panel.innerHTML = '<div class="card"><div class="card-body">' +
          '<p>Servis tarixçəsi üçün API ilə daxil olun (<code>demo@nexora.az</code> / <code>Demo1234</code>).</p>' +
          '</div></div>';
        if (summaryEl) summaryEl.innerHTML = '';
        return;
      }
      var data = await NexoraApi.serviceHistory();
      serviceState.history = data;
      if (summaryEl) {
        var s = data.summary || {};
        summaryEl.innerHTML =
          '<div class="warranty-stat"><span class="warranty-stat-n">' + esc(s.purchases || 0) + '</span><span>Alış</span></div>' +
          '<div class="warranty-stat is-ok"><span class="warranty-stat-n">' + esc(s.activeWarranties || 0) + '</span><span>Aktiv zəmanət</span></div>' +
          '<div class="warranty-stat is-warn"><span class="warranty-stat-n">' + esc(s.openTickets || 0) + '</span><span>Açıq müraciət</span></div>' +
          '<div class="warranty-stat"><span class="warranty-stat-n">' + esc(s.repairs || 0) + '</span><span>Təmir qeydi</span></div>';
      }
      fillWarrantySelect();
      renderServiceTab();
    } catch (e) {
      panel.innerHTML = '<div class="card"><div class="card-body"><p>' + esc(e.message || 'Xəta') + '</p></div></div>';
    }
  }

  function bindServiceUi() {
    document.querySelectorAll('[data-service-tab]').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        serviceState.tab = btn.getAttribute('data-service-tab');
        renderServiceTab();
      });
    });

    var newBtn = document.getElementById('serviceNewTicket');
    if (newBtn && !newBtn.dataset.bound) {
      newBtn.dataset.bound = '1';
      newBtn.addEventListener('click', function () { openServiceTicketForm(); });
    }

    var cancelBtn = document.getElementById('svcTicketCancel');
    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.dataset.bound = '1';
      cancelBtn.addEventListener('click', function () {
        var wrap = document.getElementById('serviceTicketForm');
        if (wrap) wrap.hidden = true;
      });
    }

    var form = document.getElementById('svcTicketForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        try {
          await NexoraApi.createServiceTicket({
            warrantyId: document.getElementById('svcWarranty').value,
            type: document.getElementById('svcType').value,
            subject: document.getElementById('svcSubject').value.trim(),
            description: document.getElementById('svcDesc').value.trim()
          });
          NexoraToast.success('Servis müraciəti yaradıldı');
          document.getElementById('serviceTicketForm').hidden = true;
          form.reset();
          serviceState.tab = 'tickets';
          await renderServiceHistory(true);
        } catch (err) {
          NexoraToast.error(err.message || 'Müraciət alınmadı');
        }
      });
    }
  }

  async function renderAuth() {
    const auth = document.getElementById('accountAuth');
    const dash = document.getElementById('accountDash');
    if (!auth || !dash) return;

    const user = await NexoraAccount.getSession();
    if (!user) {
      auth.hidden = false;
      dash.hidden = true;
      const heroGuest = document.getElementById('accountHeroSub');
      if (heroGuest) heroGuest.textContent = 'Hesabınıza daxil olun və ya qeydiyyatdan keçin';
      return;
    }
    auth.hidden = true;
    dash.hidden = false;

    const heroSub = document.getElementById('accountHeroSub');
    if (heroSub) heroSub.textContent = 'Şəxsi kabinetiniz — Digital Twin, sifarişlər və zəmanət';

    const profile = (await NexoraAccount.getCurrentUser()) || user;
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('profileEmail').value = profile.email || '';
    document.getElementById('profilePhone').value = profile.phone || '';

    const ordersEl = document.getElementById('ordersList');
    const orders = await NexoraAccount.getUserOrders();
    await renderOverviewDashboard(profile, orders);
    ordersEl.innerHTML = orders.length
      ? orders.map(function (o) {
          const tl = typeof NexoraOrderTimeline !== 'undefined'
            ? NexoraOrderTimeline.ensureTimeline(o)
            : null;
          const statusLabel = tl
            ? ((tl.currentStep && tl.currentStep.label) || NexoraOrderTimeline.labelForStatus(o.status))
            : o.status;
          return '<div class="card mb-4 order-card" data-order-id="' + esc(o.id) + '"><div class="card-body">' +
            '<div class="flex justify-between mb-2 flex-wrap gap-2"><strong>' + esc(o.id) + '</strong>' +
            '<span class="badge badge-primary">' + esc(statusLabel) + '</span></div>' +
            '<div class="text-sm text-muted mb-2">' + esc(new Date(o.createdAt).toLocaleString('az-AZ')) + '</div>' +
            '<div class="price mb-3">' + NexoraApp.formatPrice(o.total) + '</div>' +
            '<div class="text-sm mb-3">' + esc((o.items || []).map(function (i) { return i.name + ' ×' + i.qty; }).join(', ')) + '</div>' +
            (tl && typeof NexoraOrderTimeline !== 'undefined'
              ? NexoraOrderTimeline.render(tl)
              : '') +
            '<a class="btn btn-outline btn-sm mt-3" href="track.html?id=' + encodeURIComponent(o.id) +
              '&email=' + encodeURIComponent(o.email || profile.email || '') + '">Canlı izlə</a>' +
            '</div></div>';
        }).join('')
      : '<p class="text-muted">Sifariş yoxdur.</p>';

    const addrEl = document.getElementById('addressesList');
    const addresses = (profile.addresses || []);
    addrEl.innerHTML = addresses.length
      ? addresses.map(function (a) {
          return '<div class="card mb-3"><div class="card-body">' +
            '<strong>' + esc(a.title) + '</strong>' + (a.isDefault ? ' <span class="badge badge-primary">Əsas</span>' : '') +
            '<p class="text-sm text-muted mt-2">' + esc(a.fullName) + '<br>' + esc(a.phone) + '<br>' +
            esc(a.city) + ', ' + esc(a.district || '') + '<br>' + esc(a.address) + '</p></div></div>';
        }).join('')
      : '<p class="text-muted mb-4">Ünvan əlavə edilməyib.</p>';

    if (typeof NexoraSmart !== 'undefined') {
      const xp = NexoraSmart.getXp();
      const lvl = NexoraSmart.getLevel(xp.points || 0);
      const next = NexoraSmart.LEVELS.find(function (l) { return l.min > (xp.points || 0); });
      const badgeBody = document.getElementById('xpBadgeBody');
      if (badgeBody) {
        badgeBody.innerHTML =
          '<div class="flex justify-between items-center flex-wrap gap-3">' +
            '<div><div class="text-sm text-muted">Səviyyə</div>' +
            '<strong class="heading-3 mb-0">' + esc(lvl.name) + '</strong></div>' +
            '<div><div class="text-sm text-muted">XP</div>' +
            '<strong>' + esc(xp.points || 0) + '</strong>' +
            (next ? ' <span class="text-sm text-muted">/ ' + esc(next.min) + ' → ' + esc(next.name) + '</span>' : '') +
            '</div>' +
            '<div><div class="text-sm text-muted">Endirim</div><strong>' + esc(lvl.discount) + '%</strong></div>' +
          '</div>';
      }
      const rewards = document.getElementById('rewardsPanel');
      if (rewards) {
        rewards.innerHTML =
          '<p class="mb-4">Alış-veriş etdikcə XP qazanırsan. Yüksək səviyyə = daha çox endirim.</p>' +
          '<ul class="mb-4">' + NexoraSmart.LEVELS.map(function (l) {
            return '<li class="mb-2">' + (l.id === lvl.id ? '<strong>' : '') + esc(l.name) +
              ' — ' + esc(l.min) + ' XP — ' + esc(l.discount) + '% endirim' + (l.id === lvl.id ? ' ← sən</strong>' : '') + '</li>';
          }).join('') + '</ul>' +
          '<button type="button" class="btn btn-outline btn-sm" id="applyLevelCoupon">Səviyyə endirimini səbətə tətbiq et</button>' +
          '<h3 class="card-title mt-6">Son XP</h3>' +
          ((xp.history || []).slice(0, 8).map(function (h) {
            return '<div class="text-sm mb-1">+' + esc(h.amount) + ' — ' + esc(h.reason) + '</div>';
          }).join('') || '<p class="text-muted text-sm">Hələ XP yoxdur.</p>');
        const applyBtn = document.getElementById('applyLevelCoupon');
        if (applyBtn) {
          applyBtn.addEventListener('click', function () {
            const c = NexoraSmart.levelDiscountCoupon();
            if (!c) {
              NexoraToast.info('Bronze səviyyədə endirim yoxdur — alış-verişə davam et');
              return;
            }
            NexoraCart.setCoupon(c);
            NexoraToast.success(esc(c.description) + ' tətbiq olundu');
          });
        }
      }
    }

    // Warranty Center + Service History + Digital Twin
    await renderWarrantyCenter(profile, orders);
    bindServiceUi();
    await renderServiceHistory(true);
    if (typeof NexoraDigitalTwin !== 'undefined') {
      var warForTwin = await collectWarranties(orders);
      NexoraDigitalTwin.render({
        warranties: warForTwin,
        orders: orders,
        history: (typeof serviceState !== 'undefined' && serviceState.history) ? serviceState.history : null
      });
    }

    // Referral / dost kodu panel
    var refPanel = document.getElementById('referralPanel');
    if (refPanel) {
      refPanel.innerHTML = '<p class="text-muted">Yüklənir…</p>';
      try {
        if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken()) {
          var mineRes = await NexoraApi.myReferral();
          var r = mineRes.referral || {};
          var shareUrl = location.origin + '/pages/checkout.html?ref=' + encodeURIComponent(r.code || '');
          var eventsHtml = (r.events || []).slice(0, 10).map(function (ev) {
            return '<li class="text-sm">' + esc(ev.status) + ' · ' + esc(ev.refereeEmail || ev.orderId || '—') +
              ' · +' + NexoraApp.formatPrice(ev.rewardAmount || 0) + '</li>';
          }).join('');
          refPanel.innerHTML =
            '<p class="text-sm text-muted mb-2">Dostlarınıza bu kodu göndərin. Onlar alış-verişdə yazanda endirim alır; sifariş ödəniləndə sizə bonus düşür.</p>' +
            '<div class="flex gap-2 items-center flex-wrap mb-3">' +
              '<code style="font-size:1.25rem;font-weight:700;letter-spacing:.04em" id="myRefCode">' + esc(r.code || '—') + '</code>' +
              '<button type="button" class="btn btn-outline btn-sm" id="copyRefCode">Kopyala</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" id="copyRefLink">Linki kopyala</button>' +
            '</div>' +
            '<div class="flex gap-4 flex-wrap mb-3 text-sm">' +
              '<div><div class="text-muted">Balans</div><strong>' + NexoraApp.formatPrice(r.credit || 0) + '</strong></div>' +
              '<div><div class="text-muted">Uğurlu dəvət</div><strong>' + (r.stats && r.stats.rewarded || 0) + '</strong></div>' +
              '<div><div class="text-muted">Qazanılan</div><strong>' + NexoraApp.formatPrice((r.stats && r.stats.earned) || 0) + '</strong></div>' +
            '</div>' +
            (r.config ? '<p class="text-xs text-muted mb-3">Dost endirimi: ' + (r.config.friendDiscountPercent || 0) +
              '% · Sizin bonus: ' + NexoraApp.formatPrice(r.config.referrerRewardAz || 0) +
              ' · Min. sifariş: ' + NexoraApp.formatPrice(r.config.minOrder || 0) + '</p>' : '') +
            '<h3 class="heading-4 mb-2">Son dəvətlər</h3>' +
            (eventsHtml ? '<ul class="mb-0">' + eventsHtml + '</ul>' : '<p class="text-muted text-sm mb-0">Hələ dəvət yoxdur.</p>');
          var copyBtn = document.getElementById('copyRefCode');
          if (copyBtn) {
            copyBtn.addEventListener('click', function () {
              navigator.clipboard.writeText(r.code || '').then(function () {
                NexoraToast.success('Kod kopyalandı');
              }).catch(function () {
                NexoraToast.info(r.code || '');
              });
            });
          }
          var linkBtn = document.getElementById('copyRefLink');
          if (linkBtn) {
            linkBtn.addEventListener('click', function () {
              navigator.clipboard.writeText(shareUrl).then(function () {
                NexoraToast.success('Link kopyalandı');
              }).catch(function () {
                NexoraToast.info(shareUrl);
              });
            });
          }
        } else {
          refPanel.innerHTML = '<p class="text-muted">Dost kodu üçün API serverə daxil olun (demo@nexora.az).</p>';
        }
      } catch (e) {
        refPanel.innerHTML = '<p class="text-muted">' + esc(e.message || 'Yüklənmədi') + '</p>';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!document.getElementById('accountAuth')) return;
    // Prefill register ref from URL
    var urlRef = new URLSearchParams(window.location.search).get('ref');
    if (urlRef && document.getElementById('regReferral')) {
      document.getElementById('regReferral').value = urlRef;
    }
    await NexoraAccount.seedUsers();
    await renderAuth();

    document.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-auth-tab]').forEach(function (b) {
          b.classList.remove('is-active', 'btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('is-active', 'btn-primary');
        btn.classList.remove('btn-outline');
        document.getElementById('loginForm').hidden = btn.getAttribute('data-auth-tab') !== 'login';
        document.getElementById('registerForm').hidden = btn.getAttribute('data-auth-tab') !== 'register';
      });
    });

    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await NexoraAccount.login(
          document.getElementById('loginEmail').value,
          document.getElementById('loginPassword').value
        );
        NexoraToast.success('Xoş gəldiniz!');
        if (consumeAuthNextRedirect()) return;
        await renderAuth();
        NexoraApp.initAuthUI();
      } catch (err) {
        NexoraToast.error(err.message);
      }
    });

    document.getElementById('registerForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await NexoraAccount.register({
          name: document.getElementById('regName').value,
          email: document.getElementById('regEmail').value,
          phone: document.getElementById('regPhone').value,
          password: document.getElementById('regPassword').value,
          referralCode: (document.getElementById('regReferral') || {}).value || ''
        });
        NexoraToast.success('Qeydiyyat tamamlandı');
        if (consumeAuthNextRedirect()) return;
        await renderAuth();
        NexoraApp.initAuthUI();
      } catch (err) {
        NexoraToast.error(err.message);
      }
    });

    document.querySelectorAll('[data-account-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPanel(btn.getAttribute('data-account-nav'));
      });
    });

    document.getElementById('profileForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await NexoraAccount.updateProfile({
          name: document.getElementById('profileName').value,
          phone: document.getElementById('profilePhone').value
        });
        NexoraToast.success('Profil yeniləndi');
        await renderAuth();
      } catch (err) {
        NexoraToast.error(err.message);
      }
    });

    document.getElementById('addressForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await NexoraAccount.addAddress({
          title: document.getElementById('addrTitle').value,
          fullName: document.getElementById('addrName').value,
          phone: document.getElementById('addrPhone').value,
          city: document.getElementById('addrCity').value,
          district: document.getElementById('addrDistrict').value,
          address: document.getElementById('addrLine').value,
          postalCode: document.getElementById('addrPostal').value,
          isDefault: document.getElementById('addrDefault').checked
        });
        NexoraToast.success('Ünvan əlavə olundu');
        e.target.reset();
        await renderAuth();
      } catch (err) {
        NexoraToast.error(err.message);
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', function () {
      NexoraAccount.logout();
      NexoraToast.info('Çıxış edildi');
      renderAuth();
      NexoraApp.initAuthUI();
    });

    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        try {
          const next = document.getElementById('newPassword').value;
          const confirm = document.getElementById('confirmPassword').value;
          if (next !== confirm) throw new Error('Yeni şifrələr uyğun gəlmir');
          await NexoraAccount.changePassword(
            document.getElementById('currentPassword').value,
            next
          );
          passwordForm.reset();
          NexoraToast.success('Şifrə yeniləndi');
        } catch (err) {
          NexoraToast.error(err.message);
        }
      });
    }

    function consumeAuthNextRedirect() {
      try {
        const params = new URLSearchParams(location.search || '');
        const next = params.get('next');
        if (!next) return false;
        if (next.indexOf('javascript:') === 0 || next.indexOf('data:') === 0) return false;
        if (next.charAt(0) === '/') {
          location.href = next;
          return true;
        }
        // Relative paths like ../pages/checkout.html or checkout.html
        if (next.indexOf('://') === -1) {
          location.href = new URL(next, location.href).href;
          return true;
        }
        if (next.indexOf(location.origin) === 0) {
          location.href = next;
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    }

    try {
      const params = new URLSearchParams(location.search || '');
      const tab = params.get('tab');
      if (tab === 'register' || tab === 'login') {
        const btn = document.querySelector('[data-auth-tab="' + tab + '"]');
        if (btn) btn.click();
      }
    } catch (e) { /* ignore */ }
  });
})();
