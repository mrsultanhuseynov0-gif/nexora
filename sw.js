/* NEXORA Service Worker — network-first for app shell, cache for offline */
const CACHE = 'nexora-v31';
const PRECACHE = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './js/shell.js',
  './js/main.js',
  './js/cart.js',
  './js/wishlist.js',
  './js/i18n.js',
  './pages/wishlist.html',
  './manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE.map(function (u) {
        return new Request(u, { cache: 'reload' });
      })).catch(function () { /* ignore individual failures */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer network for HTML/JS/CSS/JSON so updates show immediately
  const isAppAsset = /\.(html?|js|css|json|webmanifest)$/i.test(url.pathname) ||
    url.pathname.endsWith('/') ||
    url.pathname.includes('/data/');

  if (isAppAsset) {
    event.respondWith(
      fetch(event.request).then(function (res) {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (res) {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, clone); });
        }
        return res;
      });
    })
  );
});
