importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

self.skipWaiting();
workbox.core.clientsClaim();


workbox.precaching.precacheAndRoute([

  { url: './index.html',          revision: '3' },
  { url: './manifest.json',       revision: '2' },
  { url: './favicon.ico',         revision: '1' },
  { url: './icons/HA_Ohr.png',    revision: '1' },
  { url: './icons/pwa-64x64.png', revision: '1' },
  { url: './icons/pwa-192x192.png', revision: '1' },
  { url: './icons/pwa-512x512.png', revision: '1' },
  { url: './icons/maskable-icon-512x512.png', revision: '1' },
], {
  ignoreURLParametersMatching: [/.*/],
});

/* Navigation-Fallback: bei Offline auf index.html zurückfallen */
const pageHandler = new workbox.strategies.NetworkFirst({
  cacheName: 'pages-v1',
  networkTimeoutSeconds: 4,
});
workbox.routing.registerRoute(
  ({request}) => request.mode === 'navigate',
  async ({event}) => {
    try {
      return await pageHandler.handle({event});
    } catch {
      return caches.match('./index.html');
    }
  }
);

/* Assets: relativ lassen */
workbox.routing.registerRoute(
  ({request}) => ['script', 'style', 'worker'].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({ cacheName: 'static-v1' })
);

workbox.routing.registerRoute(
  ({request}) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'images-v1',
    plugins: [
      new workbox.expiration.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60*60*24*30 }),
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
    ],
  })
);
