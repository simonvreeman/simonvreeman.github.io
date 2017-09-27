var cacheName = 'tools';
var cacheFiles = [
  '/',
  '/index.html',
  '/tools.html',
  '/calc.html',
  '/growth.html',
  '/hypothesis.html',
  '/simple.html',
  '/utm.html',
  '/dencoder.html'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(cacheName)
    .then(function(cache) {
      return cache.addAll(cacheFiles);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Grab the asset from SW cache.
        if (response) {
          return response;
        }
        return fetch(event.request);
    }).catch(function() {
      // Can't access the network return an offline page from the cache
      return caches.match('/tools.html');
    })
  );
});

// Empty out any caches that don’t match the ones listed.
self.addEventListener('activate', function(event) {
  var cacheWhitelist = ['tools'];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});