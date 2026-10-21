// Keep till — keeps the app opening when the internet is down.
// Sales themselves are stored offline by Firebase; this file only caches the app's own files.
const CACHE = 'keep-app-v53';
const PARTS = ['core', 'login', 'sell', 'stock', 'money', 'deliveries', 'reports-centre', 'returns', 'scanner', 'customers', 'closing', 'account', 'excel-labels', 'services', 'barbershop', 'boot'];
const SHELL = ['./', './index.html', './app.css', ...PARTS.map(p => './js/' + p + '.js'), './icon-192.png', './icon-512.png', '../lang.js', '../lang-sw.js', '../env.js'];

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

    // Keep's own files (page, styles, the till's parts, language, settings): always ask the server
    // first, so every part comes from the same version; use the saved copy only when offline.
    if (req.mode === 'navigate' || url.origin === location.origin) {
        e.respondWith(fetch(req, { cache: 'no-cache' })
            .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
            .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
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
