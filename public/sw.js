'use strict';

var CACHE_NAME = 'worldview-v4';

var APP_SHELL = [
  '/',
  '/assets/css/worldview.css',
  '/assets/js/config.js',
  '/assets/js/ui.js',
  '/assets/js/worldview.js',
  '/assets/js/pins.js',
  '/assets/js/kml.js',
  '/assets/js/co2.js',
  '/assets/js/co2-model.js',
  '/assets/js/heatmap.js',
  '/assets/js/smoke.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(APP_SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  if (url.hostname.endsWith('.tile.openstreetmap.org') && /\.png$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request, { opaque: true }));
    return;
  }

  if (url.origin === 'https://unpkg.com' && url.pathname.indexOf('/leaflet@') === 0) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf('/assets/') === 0) {
      event.respondWith(staleWhileRevalidate(event.request));
      return;
    }
    if (url.pathname === '/' || url.pathname === '') {
      event.respondWith(networkFirst(event.request));
      return;
    }
  }
});

function cacheFirst(request, opts) {
  var opaque = opts && opts.opaque;
  var url = request.url;
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(url).then(function (hit) {
      if (hit) return hit;
      return fetch(request, opaque ? { mode: 'no-cors' } : undefined).then(function (response) {
        if (response && (response.ok || (opaque && response.type === 'opaque'))) {
          cache.put(url, response.clone());
        }
        return response;
      });
    });
  });
}

function staleWhileRevalidate(request) {
  var url = request.url;
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(url).then(function (cached) {
      var network = fetch(request).then(function (response) {
        if (response && response.ok) cache.put(url, response.clone());
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || network;
    });
  });
}

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request.url, clone); });
    }
    return response;
  }).catch(function () {
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request.url);
    });
  });
}
