// This service worker exists only to unregister itself and nuke all caches.
// Vyaya.vg never caches anything — data lives in localStorage.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SW_CLEARED' }));
        return self.registration.unregister();
      })
      .then(() => self.clients.claim())
  );
});
// Passthrough — never cache, never intercept
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
