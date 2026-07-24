const CACHE = "la-casita-v25-table-layout-speakers";
const BASE = "/truco";
// Las cartas se guardan al usarse. Evitamos descargar ~60 MB durante la instalación de la PWA.
const CORE = [`${BASE}/`, `${BASE}/manifest.webmanifest`, `${BASE}/app-icon-192.png`, `${BASE}/app-icon-512.png`, `${BASE}/apple-touch-icon.png`, `${BASE}/favicon-32.png`, `${BASE}/splash-mobile.png`];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(`${BASE}/`))));
});
