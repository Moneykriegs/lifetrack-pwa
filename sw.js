const CACHE = 'lifetrack-v14';
const SHELL = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Open Food Facts: network-first, fallback to empty
  if (url.hostname.includes('openfoodfacts')) {
    e.respondWith(
      fetch(e.request, { signal: AbortSignal.timeout(8000) })
        .catch(() => new Response(JSON.stringify({ products: [] }), {
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // App shell: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const view = e.notification.data?.view || '';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', view });
          return;
        }
      }
      return clients.openWindow('./index.html' + (view ? `#${view}` : ''));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
