const CACHE_NAME = "mpp-edge-v29";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  // Prend la main immediatement : plus besoin de fermer/rouvrir l'app
  // pour recevoir une nouvelle version.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Jamais de cache pour les requetes externes (API GitHub, CDN) :
  // servir un Gist en cache rendrait la synchro aveugle aux nouveautes.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // Network-first : version fraiche quand il y a du reseau, cache en
  // secours hors-ligne uniquement.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("./index.html")),
      ),
  );
});
