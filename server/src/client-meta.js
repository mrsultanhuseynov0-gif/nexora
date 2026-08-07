'use strict';

/**
 * Real client IP + device (computer / phone) for admin audit.
 * Works behind Render / Cloudflare when trust proxy is enabled.
 */

function normalizeIp(raw) {
  let ip = String(raw || '').trim();
  if (!ip) return '';
  // Node often gives IPv4-mapped IPv6
  if (ip.indexOf('::ffff:') === 0) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  // Drop port if present (rare)
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(':')[0];
  // Take first of a list
  if (ip.indexOf(',') !== -1) ip = ip.split(',')[0].trim();
  return ip.slice(0, 64);
}

function isLikelyIp(ip) {
  if (!ip) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return true;
  if (ip.indexOf(':') !== -1) return true; // IPv6
  return false;
}

function clientIp(req) {
  // Prefer Express req.ip when trust proxy is on
  const fromExpress = normalizeIp(req && req.ip);
  if (isLikelyIp(fromExpress) && fromExpress !== '127.0.0.1') return fromExpress;

  const headers = (req && req.headers) || {};
  const candidates = [
    headers['cf-connecting-ip'],
    headers['true-client-ip'],
    headers['x-real-ip'],
    headers['x-client-ip'],
    headers['x-forwarded-for']
  ];

  for (let i = 0; i < candidates.length; i++) {
    const n = normalizeIp(candidates[i]);
    if (isLikelyIp(n)) return n;
  }

  const sock = normalizeIp(
    (req && req.socket && req.socket.remoteAddress) ||
    (req && req.connection && req.connection.remoteAddress) ||
    ''
  );
  return sock || fromExpress || '';
}

function detectDevice(req, bodyHint) {
  const hint = String((bodyHint && (bodyHint.device || bodyHint.clientDevice)) || '').toLowerCase();
  if (hint === 'phone' || hint === 'mobile' || hint === 'telefon') return 'phone';
  if (hint === 'computer' || hint === 'desktop' || hint === 'komputer' || hint === 'pc') return 'computer';
  if (hint === 'tablet') return 'tablet';

  const ua = String((req && req.headers && req.headers['user-agent']) || '').toLowerCase();
  if (!ua) return 'unknown';

  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/.test(ua)) {
    return 'phone';
  }
  return 'computer';
}

function deviceLabel(device) {
  if (device === 'phone') return 'Telefon';
  if (device === 'tablet') return 'Planşet';
  if (device === 'computer') return 'Kompüter';
  return 'Naməlum';
}

function clientMeta(req, body) {
  return {
    ip: clientIp(req),
    device: detectDevice(req, body || {})
  };
}

module.exports = {
  normalizeIp,
  clientIp,
  detectDevice,
  deviceLabel,
  clientMeta
};
