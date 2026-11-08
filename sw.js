const CACHE = 'camtracker-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './exporter.js',
  './manifest.json',
  './icon.svg',
  './lib/alva_ar.js',
  './lib/alva_ar.wasm',
  './lib/three.module.js',
  './lib/GLTFExporter.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});