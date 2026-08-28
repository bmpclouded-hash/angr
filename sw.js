// ANGR service worker — caches only the app shell (this page) so the app
// still opens (with whatever data was last loaded) if you lose signal on
// the water. It deliberately does NOT cache Supabase, weather, tide, or
// CDN library requests — those always go to the network, since caching
// live data or npm packages here would risk serving stale code or stale
// fishing data without you knowing.

const CACHE_NAME = "angr-shell-v1";
const SHELL_ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Only handle same-origin requests for the app shell itself — everything
  // else (Supabase, esm.sh, unpkg, weather/tide APIs) bypasses the service
  // worker entirely and goes straight to the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
