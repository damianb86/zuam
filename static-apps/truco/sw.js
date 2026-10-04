const CACHE = "la-casita-v43-punta-announcements";
const BASE = "/truco";
// Las cartas se guardan al usarse. Evitamos descargar ~60 MB durante la instalación de la PWA.
const CORE = [`${BASE}/`, `${BASE}/manifest.webmanifest`, `${BASE}/app-icon-192.png`, `${BASE}/app-icon-512.png`, `${BASE}/apple-touch-icon.png`, `${BASE}/favicon-32.png`, `${BASE}/splash-mobile.png`, `${BASE}/table/table-4.png`, `${BASE}/table/table-6.png`, `${BASE}/table/deck.png`, `${BASE}/table/name-wood.png`];
const SCORE_AUDIO = [...Array.from({length:31},(_,n) => `${BASE}/audio/score/${n}.mp3`), `${BASE}/audio/score/a.mp3`, `${BASE}/audio/score/dealer.mp3`, `${BASE}/audio/score/minus.mp3`, `${BASE}/audio/score/total.mp3`, `${BASE}/audio/score/punta-start.mp3`, `${BASE}/audio/score/punta-end.mp3`];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...CORE, ...SCORE_AUDIO])).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isCardArt = url.origin === self.location.origin && url.pathname.startsWith(`${BASE}/cards/deck/`);
  if (isCardArt) {
    event.respondWith(caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
        return response;
      });
    }));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(`${BASE}/`))));
});
