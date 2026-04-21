const V = 'tcplants-v12';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png'];
const CDN_CACHE = 'tcplants-cdn-v2';
const CDN_HOSTS = ['cdn.jsdelivr.net'];

// Install: cache shell files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: clean up old caches, claim all clients immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== V && k !== CDN_CACHE).map(k => caches.delete(k)))
    ).then(() => {
      // Notify all open tabs that a new version is live
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
  self.clients.claim();
});

// Fetch: intelligent caching strategy
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip API calls entirely
  if (
    url.includes('api.github.com') ||
    url.includes('api.groq.com') ||
    url.includes('api.anthropic.com') ||
    url.includes('plantking.ape.workers.dev')
  ) return;

  // Cache-first for CDN assets (fonts, libraries — rarely change)
  if (CDN_HOSTS.some(h => url.includes(h))) {
    e.respondWith(
      caches.match(e.request).then(r => r ||
        fetch(e.request).then(res => {
          if (res.ok) caches.open(CDN_CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => caches.match(e.request))
      )
    );
    return;
  }

  // Network-first for main app — bypass HTTP cache so GitHub deploys are seen immediately
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) caches.open(V).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() =>
      caches.match(e.request).then(r => r || caches.match('/index.html'))
    )
  );
});
