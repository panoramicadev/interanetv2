const CACHE_VERSION = 'v2.2.0';
const CACHE_NAME = `panoramica-cache-${CACHE_VERSION}`;
const ASSETS_CACHE = `panoramica-assets-${CACHE_VERSION}`;

const OFFLINE_ASSETS = [
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2.2.0 - Added Por segmento to sucursal-detail');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching minimal offline assets');
      return cache.addAll(OFFLINE_ASSETS);
    }).then(() => {
      console.log('[SW] Skipping waiting to activate immediately');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            '<!DOCTYPE html><html><body><h1>Sin conexión</h1><p>La aplicación no está disponible sin conexión a internet.</p></body></html>',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/html'
              })
            }
          );
        })
    );
    return;
  }

  if (url.pathname.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/)) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            const fetchPromise = fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }

          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            }
            return new Response('Asset no disponible', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          }).catch(() => {
            return new Response('Asset no disponible', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        });
      })
    );
    return;
  }

  event.respondWith(fetch(request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
