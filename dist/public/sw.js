/**
 * Service Worker — Crypto Analyst Dashboard PWA v6
 * 策略：Cache-First for static assets, Network-First for API
 */

const CACHE_NAME = 'crypto-dashboard-v6';
const STATIC_CACHE = 'crypto-static-v6';

// 預緩存的靜態資源
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/splash-1080x1920.png',
];

// 安裝：預緩存核心資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 啟動：清除舊緩存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截請求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API 請求：Network-First（不緩存即時資料）
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/trpc/') || url.pathname === '/ws') {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // 靜態資源：Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      }).catch(() => {
        // 離線時返回緩存的首頁
        if (request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});

// 推送通知（預留）
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
