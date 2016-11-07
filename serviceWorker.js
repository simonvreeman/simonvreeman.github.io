self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting()
    //console.log("SW installed");
    //caches.delete('content-v1');
    //caches.delete('staticv2');
    //console.log("Caches deleted");
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
  clients.claim().then(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
              return caches.delete(cacheName);
          })
        );
      })
  )
  )
});