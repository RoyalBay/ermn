const CACHE_NAME = 'ermn-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/feed.html',
  '/userpage.html',
  '/profile.html',
  '/admin.html',
  '/app.js',
  '/config.js',
  '/theme.js',
  '/wicon.png',
  '/empty.jpg'
];

// Install event: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
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

  // Do not cache API requests to Supabase
  if (url.origin.includes('supabase.co')) {
    return;
  }

  // Determine if the request is for an HTML page
  const isHtml = event.request.mode === 'navigate' || 
                 (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'));

  if (isHtml) {
    // Network-first strategy for HTML pages to ensure freshness
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first strategy for everything else (JS, CSS, Images)
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(response => {
          // Optionally cache new assets dynamically
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
