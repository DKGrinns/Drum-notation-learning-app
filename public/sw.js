// Offline support. Network first, so you always get the newest version when
// online; the cached copy is used when the network isn't there.
const CACHE = 'drum-reader-v14';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'css/app.css',
  'js/main.js', 'js/audio.js', 'js/backup.js', 'js/calibrate.js', 'js/curriculum.js', 'js/diag.js', 'js/export.js', 'js/grooves.js', 'js/kit.js', 'js/kitsetup.js', 'js/library.js', 'js/mic.js', 'js/mic-worklet.js', 'js/micsetup.js', 'js/midi.js',
  'js/notation.js', 'js/progress.js', 'js/store.js', 'js/tap.js', 'js/tour.js', 'js/ui.js',
  'js/views/build.js', 'js/views/learn.js', 'js/views/listen.js', 'js/views/play.js', 'js/views/quiz.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
