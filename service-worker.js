/* service-worker.js */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

/* Sofort aktiv werden */
self.skipWaiting();
workbox.core.clientsClaim();

/* === 1) APP-SHELL PRE-CACHEN ============================================== */
/* Liste DEINER Dateien: bitte anpassen/erweitern und revision bei Änderungen bumpen */
workbox.precaching.precacheAndRoute([
  { url: '/',                    revision: '1' },
  { url: '/index.html',          revision: '1' },
  { url: '/manifest.json',       revision: '1' },
  { url: '/favicon.ico',         revision: '1' },
  { url: '/icons/HA_Ohr.png',    revision: '1' },

  /* PWA-Icons (Beispiele – ersetze durch deine tatsächlichen Dateien) */
  { url: '/icons/pwa-64x64.png',         revision: '1' },
  { url: '/icons/pwa-192x192.png',       revision: '1' },
  { url: '/icons/pwa-512x512.png',       revision: '1' },
  { url: '/icons/maskable-icon-512x512.png', revision: '1' },
], {
  /* Query-Parameter (z. B. ?source=pwa) ignorieren, damit Treffer gefunden werden */
  ignoreURLParametersMatching: [/.*/],
});

/* Optional: Offline-Fallback-Seite verwenden (wenn du z.B. /offline.html anlegst) */
// const OFFLINE_FALLBACK = '/offline.html';
// workbox.precaching.precacheAndRoute([{ url: OFFLINE_FALLBACK, revision: '1' }], {});

/* === 2) SEITEN/NAVIGATION: OFFLINE-FÄHIG ================================== */
/* Für SPA/Seiten: zuerst Netzwerk, offline dann gecachte /index.html (oder OFFLINE_FALLBACK) */
const pageHandler = new workbox.strategies.NetworkFirst({
  cacheName: 'pages-v1',
  networkTimeoutSeconds: 4, // fühlt sich snappier an, wenn Netz lahm ist
  plugins: [
    new workbox.expiration.ExpirationPlugin({ maxEntries: 50 }),
  ],
});

workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      return await pageHandler.handle({ event });
    } catch (err) {
      // Fallback auf App-Shell
      // return caches.match(OFFLINE_FALLBACK) || caches.match('/index.html');
      return caches.match('/index.html');
    }
  }
);

/* === 3) STATIC ASSETS (JS/CSS/Workers) ==================================== */
workbox.routing.registerRoute(
  ({request}) => ['script', 'style', 'worker'].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-assets-v1',
  })
);

/* === 4) BILDER ============================================================= */
/* Bilder gern langfristig cachen, offline verfügbar machen */
workbox.routing.registerRoute(
  ({request}) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'images-v1',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Tage
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

/* === 5) OPTIONAL: MANIFEST & ICONS AGGRESSIVER CACHEN ===================== */
workbox.routing.registerRoute(
  ({url}) => url.pathname.endsWith('/manifest.json'),
  new workbox.strategies.StaleWhileRevalidate({ cacheName: 'manifest-v1' })
);
