/* eslint-env serviceworker */
// Service Worker: caché del app shell para que la app funcione instalada y
// offline en el móvil. Solo cachea estáticos (nunca /api, para no servir datos
// viejos). Al actualizar el versionado, reemplaza la caché vieja.
const CACHE = 'kiosko-app-shell-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/manifest.webmanifest'])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const stale = keys.filter((k) => k !== CACHE);
        return Promise.all(stale.map((k) => caches.delete(k))).then(() => {
          self.clients.claim();
          // Si había una versión de caché anterior, las pestañas abiertas pueden
          // estar mostrando el app shell viejo (que apunta a bundles ya borrados
          // del servidor). Se recargan una vez para que tomen el build actual.
          if (stale.length > 0) {
            return self.clients.matchAll({ type: 'window' }).then((clients) => {
              clients.forEach((c) => c.navigate(c.url).catch(() => {}));
            });
          }
        });
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Nunca cachear llamadas a la API ni métodos que no sean GET.
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') return;

  // Para navegaciones: red primero, caché como respaldo (offline).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Para estáticos: caché primero, red como actualización en segundo plano.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

// ---------------------------------------------------------------------------
// Notificaciones push: muestra la notificación y abre la app al tocarla.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Kiosko 247', body: event.data ? event.data.text() : '' };
  }
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [120, 60, 120],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Kiosko 247', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.navigate(url).then(() => client.focus());
      }
      return clients.openWindow(url);
    })
  );
});
