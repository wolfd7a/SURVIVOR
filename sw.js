// Network-first with cache fallback: deploys stay fresh when online, the
// whole game keeps working offline once it has been loaded once.
const CACHE = "nightfall-swarm-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./js/main.js",
  "./js/game.js",
  "./js/entities.js",
  "./js/boss.js",
  "./js/weapons.js",
  "./js/upgrades.js",
  "./js/characters.js",
  "./js/save.js",
  "./js/settings.js",
  "./js/audio.js",
  "./js/lore.js",
  "./js/ui.js",
  "./js/utils.js",
  "./js/fx.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
