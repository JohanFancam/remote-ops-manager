/* Remote Ops Manager service worker — offline shell + Web Push */
const CACHE = 'rom-shell-v4';
const SHELL = ['/', '/index.html', '/rom-logo.png', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
}

const OFFLINE_RESPONSE = () => new Response(
  '<h1>Offline</h1><p>Reconnect and reload to use Remote Ops.</p>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  // Page loads must come from the network so a deploy is picked up immediately;
  // the cache is only a fallback when offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache('/index.html', response);
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || OFFLINE_RESPONSE())
    );
    return;
  }

  // Vite fingerprints filenames, so hashed assets can be served from cache safely
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        putInCache(request, response);
        return response;
      }))
    );
    return;
  }

  // Everything else stays uncached: synthesising a fallback here only turned
  // aborted requests into confusing error statuses in the console.
});

self.addEventListener('push', (event) => {
  let data = { title: 'Remote Ops', body: 'You have an update', url: '/Calendar' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      data.body = event.data.text();
    } catch {
      // ignore
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Remote Ops', {
      body: data.body || '',
      icon: '/rom-logo.png',
      badge: '/rom-logo.png',
      data: { url: data.url || '/Calendar' },
      tag: data.type || 'rom-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/Calendar';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
