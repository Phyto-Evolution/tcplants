const V = 'tcplants-v11';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png'];
const CDN_CACHE = 'tcplants-cdn-v1';
const CDN_URLS = [
  'https://cdn.jsdelivr.net',
  'https://telegram.org/js/telegram-web-app.js'
];

// Install: cache shell files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(SHELL)).then(() => {
      // Pre-cache critical CDN assets for offline support
      return caches.open(CDN_CACHE).then(c => {
        c.addAll(CDN_URLS).catch(() => {
          // Ignore if some fail
        });
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== V && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: intelligent caching strategy
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip API calls (let them fail naturally offline)
  if (url.includes('api.github.com') || url.includes('api.groq.com') || url.includes('api.anthropic.com')) {
    return;
  }

  // Cache-first for CDN assets
  if (url.includes('cdn.jsdelivr.net') || url.includes('telegram.org')) {
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

  // Network-first for main app
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) caches.open(V).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() =>
      caches.match(e.request).then(r => r || caches.match('/index.html'))
    )
  );
});
