'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, publicUser } = require('./db');
const cfg = require('./config');

const JWKS_CACHE = Object.create(null);

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function b64urlJson(part) {
  const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4));
  const raw = Buffer.from(String(part).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
  return JSON.parse(raw);
}

async function fetchJwks(url) {
  const hit = JWKS_CACHE[url];
  if (hit && hit.exp > Date.now()) return hit.keys;
  const res = await fetch(url);
  if (!res.ok) throw httpError(502, 'OAuth açarı yüklənmədi');
  const data = await res.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  JWKS_CACHE[url] = { keys: keys, exp: Date.now() + 60 * 60 * 1000 };
  return keys;
}

function keyFromJwk(keys, kid) {
  const jwk = (kid && keys.find((k) => k.kid === kid)) || keys[0];
  if (!jwk) throw httpError(401, 'OAuth açarı tapılmadı');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

async function verifyJwtWithJwks(idToken, jwksUrl, options) {
  const header = b64urlJson(String(idToken).split('.')[0]);
  const keys = await fetchJwks(jwksUrl);
  const key = keyFromJwk(keys, header.kid);
  return jwt.verify(idToken, key, Object.assign({ algorithms: ['RS256'] }, options || {}));
}

function publicOauthConfig() {
  const site = cfg.publicSiteUrl || '';
  const appleRedirect = cfg.appleRedirectUri || (site ? site + '/pages/account.html' : '');
  return {
    google: cfg.googleClientId ? { clientId: cfg.googleClientId } : null,
    apple: cfg.appleClientId
      ? { clientId: cfg.appleClientId, redirectUri: appleRedirect }
      : null,
    microsoft: cfg.microsoftClientId ? { clientId: cfg.microsoftClientId } : null
  };
}

async function verifyGoogleIdToken(idToken) {
  if (!cfg.googleClientId) throw httpError(503, 'Google giriş aktiv deyil');
  const payload = await verifyJwtWithJwks(
    idToken,
    'https://www.googleapis.com/oauth2/v3/certs',
    {
      audience: cfg.googleClientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com']
    }
  );
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw httpError(400, 'Google hesabında e-poçt yoxdur');
  if (payload.email_verified === false || payload.email_verified === 'false') {
    throw httpError(400, 'Google e-poçtu təsdiqlənməyib');
  }
  return {
    provider: 'google',
    sub: String(payload.sub),
    email: email,
    name: String(payload.name || payload.given_name || email.split('@')[0]).trim()
  };
}

async function verifyGoogleAccessToken(accessToken) {
  if (!cfg.googleClientId) throw httpError(503, 'Google giriş aktiv deyil');
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  if (!res.ok) throw httpError(401, 'Google token etibarsızdır');
  const payload = await res.json();
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw httpError(400, 'Google hesabında e-poçt yoxdur');
  if (payload.email_verified === false) throw httpError(400, 'Google e-poçtu təsdiqlənməyib');
  return {
    provider: 'google',
    sub: String(payload.sub || payload.id),
    email: email,
    name: String(payload.name || payload.given_name || email.split('@')[0]).trim()
  };
}

async function verifyAppleIdToken(idToken) {
  if (!cfg.appleClientId) throw httpError(503, 'Apple giriş aktiv deyil');
  const payload = await verifyJwtWithJwks(
    idToken,
    'https://appleid.apple.com/auth/keys',
    {
      audience: cfg.appleClientId,
      issuer: 'https://appleid.apple.com'
    }
  );
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw httpError(400, 'Apple e-poçtu alınmadı — ilk girişdə e-poçtu paylaşın');
  return {
    provider: 'apple',
    sub: String(payload.sub),
    email: email,
    name: String(email.split('@')[0]).trim()
  };
}

async function verifyMicrosoftIdToken(idToken) {
  if (!cfg.microsoftClientId) throw httpError(503, 'Microsoft giriş aktiv deyil');
  const payload = await verifyJwtWithJwks(
    idToken,
    'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    {
      audience: cfg.microsoftClientId
    }
  );
  const iss = String(payload.iss || '');
  if (!/^https:\/\/login\.microsoftonline\.com\/[0-9a-fA-F-]+\/v2\.0\/?$/.test(iss) &&
      !/^https:\/\/sts\.windows\.net\//.test(iss)) {
    throw httpError(401, 'Microsoft issuer etibarsızdır');
  }
  const email = String(payload.email || payload.preferred_username || payload.upn || '')
    .trim()
    .toLowerCase();
  if (!email || email.indexOf('@') === -1) {
    throw httpError(400, 'Microsoft hesabında e-poçt yoxdur');
  }
  return {
    provider: 'microsoft',
    sub: String(payload.sub || payload.oid),
    email: email,
    name: String(payload.name || email.split('@')[0]).trim()
  };
}

async function verifyProvider(provider, body) {
  const idToken = String((body && (body.idToken || body.credential || body.identityToken)) || '').trim();
  const accessToken = String((body && (body.accessToken || body.access_token)) || '').trim();
  const nameHint = String((body && body.name) || '').trim();

  let profile;
  if (provider === 'google') {
    if (idToken) profile = await verifyGoogleIdToken(idToken);
    else if (accessToken) profile = await verifyGoogleAccessToken(accessToken);
    else throw httpError(400, 'Google token tələb olunur');
  } else if (provider === 'apple') {
    if (!idToken) throw httpError(400, 'Apple token tələb olunur');
    profile = await verifyAppleIdToken(idToken);
  } else if (provider === 'microsoft') {
    if (!idToken) throw httpError(400, 'Microsoft token tələb olunur');
    profile = await verifyMicrosoftIdToken(idToken);
  } else {
    throw httpError(400, 'Naməlum OAuth provayder');
  }

  if (nameHint && (!profile.name || profile.name === profile.email.split('@')[0])) {
    profile.name = nameHint.slice(0, 80);
  }
  return profile;
}

function upsertOauthUser(profile, ip) {
  const provider = profile.provider;
  const sub = profile.sub;
  const email = profile.email;
  const name = String(profile.name || email.split('@')[0]).slice(0, 80);
  const now = new Date().toISOString();
  const ipAddr = String(ip || '').slice(0, 64);

  let row = db.prepare(
    'SELECT * FROM users WHERE oauth_provider = ? AND oauth_sub = ?'
  ).get(provider, sub);

  if (!row) {
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (row) {
      db.prepare(`
        UPDATE users
        SET oauth_provider = ?, oauth_sub = ?, name = COALESCE(NULLIF(?, ''), name),
            last_ip = COALESCE(NULLIF(?, ''), last_ip), last_seen_at = ?
        WHERE id = ?
      `).run(provider, sub, name, ipAddr, now, row.id);
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
    }
  }

  if (!row) {
    const id = uid('u');
    const passwordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, name, phone, role, addresses_json, created_at,
        oauth_provider, oauth_sub, register_ip, last_ip, last_seen_at
      ) VALUES (?, ?, ?, ?, '', 'customer', '[]', ?, ?, ?, ?, ?, ?)
    `).run(id, email, passwordHash, name, now, provider, sub, ipAddr, ipAddr, now);

    try {
      const { ensureUserCode } = require('./referrals');
      ensureUserCode(id);
    } catch (e) { /* ignore */ }

    row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (ipAddr) {
    db.prepare('UPDATE users SET last_ip = ?, last_seen_at = ? WHERE id = ?')
      .run(ipAddr, now, row.id);
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
  }

  return publicUser(row);
}

module.exports = {
  publicOauthConfig,
  verifyProvider,
  upsertOauthUser
};
