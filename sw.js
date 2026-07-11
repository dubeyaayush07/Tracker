const CACHE_NAME = 'tracker-v1102';
const ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/components.css',
  './css/views.css',
  './js/app.js',
  './js/db.js',
  './js/utils/time.js',
  './js/utils/charts.js',
  './js/views/today.js',
  './js/views/log.js',
  './js/views/reflect.js',
  './js/views/schedule.js',
  './js/views/plan.js',
  './js/views/insights.js',
  './js/views/settings.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network first for external resources, cache first for local
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }))
  );
});
