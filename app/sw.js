// Matinyo POS — keeps the app opening when the internet is down.
// Sales themselves are stored offline by Firebase; this file only caches the app's own files.
const CACHE = 'keep-app-v27';
const SHELL = ['./', './index.html', './icon-192.png', './icon-512.png', '../lang.js', '../lang-sw.js', '../env.js'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => (k.startsWith('keep-app-') || k.startsWith('matinyo-pos-')) && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    // Never cache Firebase traffic — Firebase handles its own offline storage.
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com')) return;

    // The app page: try the network first so updates arrive, fall back to the saved copy.
    if (req.mode === 'navigate' || url.pathname.endsWith('.html') || /\/(lang(-\w+)?|env)\.js$/.test(url.pathname)) {
        e.respondWith(fetch(req)
            .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
            .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
        return;
    }

    // Libraries, fonts and icons: use the saved copy, refresh it in the background.
    e.respondWith(caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
            if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
            return res;
        }).catch(() => cached);
        return cached || fresh;
    }));
});
