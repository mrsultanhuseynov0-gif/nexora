/**
 * NEXORA Social login — Google / Apple / Microsoft (ID token → API JWT)
 */
(function (global) {
  'use strict';

  var configCache = null;
  var configPromise = null;
  var msalApp = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing && existing.getAttribute('data-loaded') === '1') {
        resolve();
        return;
      }
      if (existing) {
        existing.addEventListener('load', function () { resolve(); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error('Skript yüklənmədi')); }, { once: true });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () {
        s.setAttribute('data-loaded', '1');
        resolve();
      };
      s.onerror = function () { reject(new Error('Skript yüklənmədi: ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function getConfig(force) {
    if (configCache && !force) return configCache;
    if (configPromise && !force) return configPromise;
    if (typeof NexoraApi === 'undefined') throw new Error('API mövcud deyil');
    configPromise = NexoraApi.request('/api/auth/oauth/config').then(function (cfg) {
      configCache = cfg || {};
      return configCache;
    }).catch(function (e) {
      configPromise = null;
      throw e;
    });
    return configPromise;
  }

  async function exchange(provider, payload) {
    if (typeof NexoraApi === 'undefined' || !NexoraApi.oauthLogin) {
      throw new Error('OAuth API hazır deyil');
    }
    return NexoraApi.oauthLogin(provider, payload);
  }

  function providerReady(cfg, provider) {
    return !!(cfg && cfg[provider] && cfg[provider].clientId);
  }

  async function signInGoogle() {
    var cfg = await getConfig();
    if (!providerReady(cfg, 'google')) {
      throw new Error('Google giriş aktiv deyil — GOOGLE_CLIENT_ID təyin edin');
    }
    await loadScript('https://accounts.google.com/gsi/client');
    if (!global.google || !google.accounts || !google.accounts.oauth2) {
      throw new Error('Google SDK yüklənmədi');
    }

    return new Promise(function (resolve, reject) {
      var settled = false;
      function done(err, data) {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve(data);
      }

      try {
        var client = google.accounts.oauth2.initTokenClient({
          client_id: cfg.google.clientId,
          scope: 'openid email profile',
          callback: function (resp) {
            if (!resp || resp.error) {
              done(new Error((resp && resp.error) || 'Google giriş ləğv edildi'));
              return;
            }
            exchange('google', { accessToken: resp.access_token })
              .then(function (data) { done(null, data); })
              .catch(function (e) { done(e); });
          },
          error_callback: function (err) {
            done(new Error((err && err.message) || 'Google giriş uğursuz oldu'));
          }
        });
        client.requestAccessToken({ prompt: '' });
      } catch (e) {
        done(e);
      }
    });
  }

  async function signInApple() {
    var cfg = await getConfig();
    if (!providerReady(cfg, 'apple')) {
      throw new Error('Apple giriş aktiv deyil — APPLE_CLIENT_ID təyin edin');
    }
    await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');
    if (!global.AppleID || !AppleID.auth) throw new Error('Apple SDK yüklənmədi');

    var redirectURI = cfg.apple.redirectUri || (location.origin + location.pathname);
    AppleID.auth.init({
      clientId: cfg.apple.clientId,
      scope: 'name email',
      redirectURI: redirectURI,
      usePopup: true
    });

    var result = await AppleID.auth.signIn();
    var idToken = result && result.authorization && result.authorization.id_token;
    if (!idToken) throw new Error('Apple token alınmadı');
    var name = '';
    try {
      if (result.user && result.user.name) {
        name = [result.user.name.firstName, result.user.name.lastName].filter(Boolean).join(' ');
      }
    } catch (e) { /* ignore */ }
    return exchange('apple', { idToken: idToken, name: name });
  }

  async function signInMicrosoft() {
    var cfg = await getConfig();
    if (!providerReady(cfg, 'microsoft')) {
      throw new Error('Microsoft giriş aktiv deyil — MICROSOFT_CLIENT_ID təyin edin');
    }
    await loadScript('https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js');
    if (!global.msal) throw new Error('Microsoft SDK yüklənmədi');

    if (!msalApp) {
      msalApp = new msal.PublicClientApplication({
        auth: {
          clientId: cfg.microsoft.clientId,
          authority: 'https://login.microsoftonline.com/common',
          redirectUri: location.origin + location.pathname
        },
        cache: { cacheLocation: 'sessionStorage' }
      });
      if (msalApp.initialize) await msalApp.initialize();
    }

    var result = await msalApp.loginPopup({
      scopes: ['openid', 'profile', 'email', 'User.Read']
    });
    var idToken = result && result.idToken;
    if (!idToken) throw new Error('Microsoft token alınmadı');
    return exchange('microsoft', {
      idToken: idToken,
      name: (result.account && result.account.name) || ''
    });
  }

  async function signIn(provider) {
    var p = String(provider || '').toLowerCase();
    if (p === 'google') return signInGoogle();
    if (p === 'apple') return signInApple();
    if (p === 'microsoft') return signInMicrosoft();
    throw new Error('Naməlum provayder');
  }

  function mountButtons(root, onSuccess, onError) {
    if (!root) return;
    root.innerHTML =
      '<div class="auth-social" data-auth-social>' +
        '<p class="auth-social-label">və ya davam et</p>' +
        '<div class="auth-social-grid">' +
          '<button type="button" class="auth-social-btn auth-social-btn--google" data-oauth="google" aria-label="Google ilə giriş">' +
            '<span class="auth-social-ico" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.5-5.1 3.5-3.1 0-5.6-2.5-5.6-5.6S8.9 6.1 12 6.1c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.8 3.7 14.6 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"/><path fill="#34A853" d="M3.2 7.4l3 2.2C7 7.3 9.3 6.1 12 6.1c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.8 3.7 14.6 2.7 12 2.7 8.3 2.7 5.1 4.8 3.2 7.4z"/><path fill="#4A90E2" d="M12 21.3c2.5 0 4.6-.8 6.1-2.2l-2.9-2.3c-.8.6-1.9 1-3.2 1-2.5 0-4.6-1.7-5.3-3.9l-3 2.3c1.8 3.5 5.1 5.1 8.3 5.1z"/><path fill="#FBBC05" d="M6.7 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3-2.3C3.2 9.1 3 10.5 3 12s.2 2.9.7 4.2l3-2.3z"/></svg>' +
            '</span><span>Google</span></button>' +
          '<button type="button" class="auth-social-btn auth-social-btn--apple" data-oauth="apple" aria-label="Apple ilə giriş">' +
            '<span class="auth-social-ico" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.4 12.6c0-2 1.6-3 1.7-3.1-0.9-1.3-2.4-1.5-2.9-1.5-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.3.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.2-.8-2.3-3.3zm-2.1-6.1c.6-.7 1-1.7.9-2.7-0.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.6-1 2.6 1 .1 1.9-.5 2.6-1.2z"/></svg>' +
            '</span><span>Apple</span></button>' +
          '<button type="button" class="auth-social-btn auth-social-btn--microsoft" data-oauth="microsoft" aria-label="Microsoft ilə giriş">' +
            '<span class="auth-social-ico" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#F25022" d="M3 3h8.5v8.5H3z"/><path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z"/><path fill="#00A4EF" d="M3 12.5h8.5V21H3z"/><path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z"/></svg>' +
            '</span><span>Microsoft</span></button>' +
        '</div>' +
        '<p class="auth-social-hint">E-poçt və şifrə ilə də daxil ola bilərsiniz</p>' +
      '</div>';

    getConfig().then(function (cfg) {
      ['google', 'apple', 'microsoft'].forEach(function (p) {
        var btn = root.querySelector('[data-oauth="' + p + '"]');
        if (!btn) return;
        if (!providerReady(cfg, p)) {
          btn.classList.add('is-disabled');
          btn.title = 'Admin paneldə / Render-də ' + p.toUpperCase() + '_CLIENT_ID təyin edin';
        }
      });
    }).catch(function () { /* keep buttons; click will error */ });

    root.querySelectorAll('[data-oauth]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var provider = btn.getAttribute('data-oauth');
        btn.disabled = true;
        btn.classList.add('is-loading');
        try {
          var data;
          if (global.NexoraAccount && typeof NexoraAccount.loginWithOAuth === 'function') {
            var user = await NexoraAccount.loginWithOAuth(provider);
            data = { user: user };
          } else {
            data = await signIn(provider);
          }
          if (typeof onSuccess === 'function') await onSuccess(data, provider);
        } catch (e) {
          if (typeof onError === 'function') onError(e, provider);
          else if (global.NexoraToast) NexoraToast.error((e && e.message) || 'Giriş uğursuz oldu');
        } finally {
          btn.disabled = false;
          btn.classList.remove('is-loading');
        }
      });
    });
  }

  global.NexoraOAuth = {
    getConfig: getConfig,
    signIn: signIn,
    mountButtons: mountButtons
  };
})(typeof window !== 'undefined' ? window : this);
