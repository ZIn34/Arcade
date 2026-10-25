// Keeps a copy of the whole arcade on the phone so it opens offline.
// Bump VERSION whenever any file changes, so phones fetch the new copy.
const VERSION = "arcade-v10";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/arcade.css",
  "js/audio.js",
  "js/scores.js",
  "js/coins.js",
  "js/pixel.js",
  "js/cabinets.js",
  "js/shell.js",
  "js/kit.js",
  "js/games/starlance.js",
  "js/games/gloworm.js",
  "js/games/brickquake.js",
  "js/games/vaultrunner.js",
  "js/games/duckdash.js",
  "js/games/pixelpile.js",
  "js/games/cometcrush.js",
  "js/games/skyhopper.js",
  "js/games/turbolane.js",
  "js/games/pulsetap.js",
  "js/hall.js",
  "js/main.js",
  "assets/logo.png",
  "assets/intro-sound.wav",
  "assets/PressStart2P-Regular.ttf",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/favicon-32.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cached copy first (fast and offline); fall back to the network, then to the main page.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).catch(() =>
      e.request.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});
