// Service worker: caches every game file so the installed app runs offline at the booth.
// Bump VERSION whenever files change so headsets pick up the new build.
const VERSION = 'pi-vr-games-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './game.css',
  './sorter.html', './game.js', './coal.html', './coal.js', './dock.html', './dock.js', './common.js',
  './lib/three.module.js', './lib/VRButton.js',
  './assets/bgm.mp3', './assets/beats.json', './assets/ted_white.png', './assets/genco_white.png',
  './assets/a_ship.png', './assets/a_unloader.png', './assets/a_coal_pile.png', './assets/a_stacker_reclaimer.png',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-192.png', './assets/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// network first (so updates show up when online), cache as fallback (offline at the booth)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
