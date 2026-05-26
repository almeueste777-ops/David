/* ═══════════════════════════════════════════════
   Psaltirea Mea — Service Worker v2.0
   Strategie: Cache-First cu fallback la network
   ═══════════════════════════════════════════════ */

const CACHE_NAME = 'psaltirea-mea-v2';
const BASE = '/David/';

const CORE_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'style.css',
  BASE + 'app.js',
  BASE + 'psaltire_data.json',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'icon-180.png',
  'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap'
];

// INSTALL — cache all core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          CORE_ASSETS.map(url => cache.add(url).catch(e => console.warn('Cache miss:', url, e)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH — Cache-First strategy
self.addEventListener('fetch', event => {
  // Skip non-GET and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // Offline fallback for navigation
          if (event.request.destination === 'document') {
            return caches.match(BASE + 'index.html');
          }
        });
    })
  );
});

// MESSAGE — force update
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
