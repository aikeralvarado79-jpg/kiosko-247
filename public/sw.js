/* eslint-env serviceworker */
// Service Worker: caché del app shell para que la app funcione instalada y
// offline en el móvil. Solo cachea estáticos (nunca /api, para no servir datos
// viejos). Al actualizar el versionado, reemplaza la caché vieja.
//
// APP_VERSION se reemplaza en el build por un hash de los assets generados
// (ver vite.config.js). Como sw.js cambia en cada deploy, los navegadores con
// una versión vieja detectan el nuevo service worker al chequear y se les
// muestra el aviso con el botón "Actualizar" (ver src/main.jsx).
const APP_VERSION = '__APP_VERSION__';
const CACHE = 'kiosko-app-shell-v6';
// Espejo del último /api/state conocido: permite mostrar el catálogo cuando
// no hay conexión. La app también lo escribe desde api.js por si el SW aún
// no controla la página.
const STATE_CACHE = 'kiosko-state-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // Registra la versión del build que quedó en caché (útil para depurar qué
      // versión tiene un dispositivo). La ruta __build-info__ nunca se pide
      // desde la app, así que no estorba al fetch handler.
      cache
        .put('/__build-info__', new Response(JSON.stringify({ version: APP_VERSION }), { headers: { 'Content-Type': 'application/json' } }))
        .catch(() => {});
      return cache.addAll(['/', '/manifest.webmanifest']).catch(() => {});
    }).catch(() => {})
  );
  // No se llama skipWaiting(): la versión nueva queda en "waiting" hasta que el
  // usuario confirme el aviso "Actualizar" (mensaje SKIP_WAITING), para no
  // recargar la app a mitad de un pedido.
});

// El botón "Actualizar" del aviso (src/App.jsx → src/main.jsx) manda este
// mensaje para que el service worker nuevo tome el control de inmediato.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const keep = [CACHE, STATE_CACHE];
        const stale = keys.filter((k) => !keep.includes(k));
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

  // Excepción: /api/state GET se sirve primero de red y queda espejado en
  // STATE_CACHE. Si la red falla, se responde con el último estado conocido
  // (catálogo offline).
  if (url.pathname.startsWith('/api/state')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(STATE_CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || Response.error()))
    );
    return;
  }

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
    data = { title: 'Empresas Alvarados', body: event.data ? event.data.text() : '' };
  }
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [120, 60, 120],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Empresas Alvarados', options));
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