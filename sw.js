const CACHE_NAME = 'ermn-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './feed.html',
  './userpage.html',
  './profile.html',
  './app.js',
  './config.js',
  './theme.js',
  './global.css',
  './wicon.png',
  './empty.jpg'
];

// Install event: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW install cache failed:', err))
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network first for HTML and API, cache first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Do not cache API requests to Supabase or external CDN
  if (url.origin.includes('supabase.co') || url.origin.includes('cdn.jsdelivr.net')) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const accept = event.request.headers.get('accept') || '';
  const isHtml = event.request.mode === 'navigate' || accept.includes('text/html');

  if (isHtml) {
    // Network-first strategy for HTML pages to ensure freshness
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Stale-while-revalidate for everything else (JS, CSS, Images)
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
  }
});
