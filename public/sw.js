/* Remote Ops Manager service worker — offline shell + Web Push */
const CACHE = 'rom-shell-v6';
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

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        putInCache(request, response);
        return response;
      }))
    );
  }
});

function absoluteUrl(path) {
  const raw = String(path || '/');
  if (/^https?:\/\//i.test(raw)) return raw;
  return new URL(raw.startsWith('/') ? raw : `/${raw}`, self.location.origin).href;
}

self.addEventListener('push', (event) => {
  let data = { title: 'Remote Ops', body: 'You have an update', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      data.body = event.data.text();
    } catch {
      // ignore
    }
  }

  const icon = absoluteUrl('/icon-192.png');
  const tag = [data.type || 'rom-notification', data.shootId || data.url || Date.now()].join(':');

  event.waitUntil(
    self.registration.showNotification(data.title || 'Remote Ops', {
      body: data.body || 'You have an update',
      icon,
      badge: icon,
      image: undefined,
      data: { url: data.url || '/' },
      tag,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = absoluteUrl(event.notification?.data?.url || '/');
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        try {
          if (typeof client.navigate === 'function') await client.navigate(targetUrl);
        } catch {
          // ignore
        }
        try {
          client.postMessage({ type: 'rom-notification-click', url: targetUrl });
        } catch {
          // ignore
        }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
