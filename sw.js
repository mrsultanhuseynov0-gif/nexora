/* NEXORA Service Worker — network only (site must not work offline) */
const CACHE = 'nexora-v32-net';

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always network — no offline cache fallback for HTML/app
  event.respondWith(
    fetch(event.request).catch(function () {
      const accepts = event.request.headers.get('accept') || '';
      if (event.request.mode === 'navigate' || accepts.indexOf('text/html') !== -1) {
        return new Response(
          '<!DOCTYPE html><html lang="az"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>İnternet yoxdur | NEXORA</title>' +
            '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
            'background:#111;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}' +
            'h1{color:#FF0000;letter-spacing:.16em}p{color:#bbb;max-width:320px;line-height:1.45}</style></head>' +
            '<body><div><h1>NEXORA</h1><h2>Internet Xətası</h2>' +
            '<p>İnternet bağlantısı yoxdur.</p>' +
            '<p><button onclick="location.reload()" style="min-height:48px;padding:0 18px;border:0;border-radius:12px;background:#FF0000;color:#fff;font-weight:700;font-size:1rem;cursor:pointer">Yenidən yoxla</button></p></div></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
