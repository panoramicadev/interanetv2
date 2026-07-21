const CACHE_VERSION = 'v4.1.0';
const CACHE_NAME = `panoramica-cache-${CACHE_VERSION}`;
const ASSETS_CACHE = `panoramica-assets-${CACHE_VERSION}`;

const OFFLINE_ASSETS = [
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2.0.0 - lighter caching strategy');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching minimal offline assets');
      return cache.addAll(OFFLINE_ASSETS);
    }).then(() => {
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

  // Skip cross-origin requests entirely (e.g., Supabase storage, Google Fonts, external CDNs)
  // These should be handled by the browser directly, not cached by our service worker
  if (url.origin !== self.location.origin) {
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

// ==================== WEB PUSH (PWA) ====================
// En iOS (16.4+) esto solo corre si la app está instalada en la pantalla de inicio.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Pinturas Panorámica', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Pinturas Panorámica';
  const options = {
    body: data.body || '',
    icon: '/panoramica-icon.png',
    badge: '/favicon.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/notificaciones' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notificaciones';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app ya está abierta, enfocarla y navegar a la URL de la notificación
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(url);
          }
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
