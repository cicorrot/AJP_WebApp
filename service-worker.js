/* Cicor BLE PWA SW – v2 */
const CACHE_NAME = "cicor-ble-v2";
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // optional sofortige Aktivierung:
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Hilfsfunktion: sicher cachen (inkl. opaque)
async function putSafe(request, response) {
  try {
    // Nur GET und nur klonbare Antworten
    if (request.method !== "GET" || !response) return;
    const type = response.type; // basic | cors | opaque
    const ok = response.ok || type === "opaque"; // 200-299 ODER opaque
    if (!ok) return;
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  } catch (_) {}
}

// Offline-Fallback für Navigationsanfragen
async function navigationHandler(event) {
  try {
    const network = await fetch(event.request);
    // Antwort unter DER Request-URL ablegen (nicht fix "./")
    event.waitUntil(putSafe(event.request, network.clone()));
    return network;
  } catch (_) {
    // Fallback: HA.html (oder offline.html, wenn du magst)
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match("./HA.html")) || cache.match("./");
  }
}

// Statische Assets: stale-while-revalidate
async function assetHandler(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  const fetchPromise = fetch(event.request)
    .then(async (res) => {
      await putSafe(event.request, res.clone());
      return res;
    })
    .catch(() => null);
  // Sofort gecachte Antwort, sonst Netzwerk, sonst nichts
  return cached || (await fetchPromise) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nur same-origin behandeln (optional, aber oft sinnvoll)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(navigationHandler(event));
    return;
  }

  // Für Assets: stale-while-revalidate
  // (du kannst hier nach Pfaden/Endungen filtern, z.B. .png/.css/.js)
  event.respondWith(assetHandler(event));
});

// Optional: auf Messages reagieren, um Updates sofort zu aktivieren
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
