// Service worker: кэширует файлы приложения, чтобы оно открывалось без интернета.
// ВАЖНО: после любых изменений в файлах подними номер CACHE,
// иначе на телефоне останется старая версия.
const CACHE = 'kosmetichka-v3';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/config.js',
  './js/icons.js',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Сначала сеть (чтобы обновления приходили сразу), при отсутствии сети — кэш
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
