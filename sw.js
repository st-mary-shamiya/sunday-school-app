/**
 * sw.js — Service Worker
 * مدارس الأحد — كنيسة السيدة العذراء مريم بالشامية
 */
const CACHE_NAME = 'sunday-school-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './pdf-export.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Firebase & Google Fonts — network only
  if (e.request.url.includes('firestore') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('gstatic.com') ||
      e.request.url.includes('googleapis.com')) {
    return;
  }
  // Network-First strategy
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200 && e.request.method === 'GET') {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

