// Keep — lets the installed app open even when the internet is down.
// The till (/app/) and barbershop (/barber/) have their own workers; this one covers sign-in and HQ.
// Firebase keeps its own offline copy of the data; this file only saves the app's pages.
const CACHE = 'keep-root-v4';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/lang.js', '/lang-sw.js', '/env.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('keep-root-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('googleapis.com') && !url.hostname.startsWith('fonts.')) return;
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('firebaseapp.com')) return;
  if (url.hostname.includes('identitytoolkit') || url.hostname.includes('securetoken')) return;

  // Pages: network first so updates arrive; saved copy when offline.
  if (req.mode === 'navigate' || /^\/(lang(-\w+)?|env)\.js$/.test(url.pathname)) {
    e.respondWith(fetch(req)
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('/') : undefined))));
    return;
  }
  // Libraries, fonts, icons: saved copy first, refreshed in the background.
  e.respondWith(caches.match(req).then(cached => {
    const fresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
