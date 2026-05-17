/**
 * Service Worker — Crypto Analyst Dashboard PWA v6.4.1
 * 策略：HTML 與 JS/CSS 一律 Network-First，避免重新 build 後手機仍載入舊 chunk。
 */

const CACHE_NAME = 'crypto-dashboard-v641';
const STATIC_CACHE = 'crypto-static-v641';
const OLD_CACHE_PREFIXES = ['crypto-dashboard-', 'crypto-static-'];

const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/splash-1080x1920.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => {
            if (name === CACHE_NAME || name === STATIC_CACHE) return false;
            return OLD_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));
          })
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/trpc/') || url.pathname === '/ws') {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  const isHtmlDocument = request.destination === 'document';
  const isVersionedAsset = url.pathname.startsWith('/assets/') || ['script', 'style', 'worker'].includes(request.destination);

  if (isHtmlDocument || isVersionedAsset) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok && !isVersionedAsset) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Crypto Analyst Dashboard';
  const options = {
    body: data.body || '有新的市場訊號',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
