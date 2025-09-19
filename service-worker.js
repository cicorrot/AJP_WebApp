/* Cicor BLE PWA SW – v1 */
const CACHE_NAME = "cicor-ble-v1";
const APP_SHELL = [
  "./",
  "./HA.html",
  "./HA_Ohr.png",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

// Install: App-Shell cachen
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: alte Caches aufräumen
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch-Strategie:
// - Navigationsanfragen: network-first (damit Updates ankommen), Fallback Cache
// - Sonst: cache-first (schnell + offline)
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put("./", copy));
        return res;
      }).catch(() => caches.match("./"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      // Nur GETs cachen
      if (req.method === "GET" && res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
