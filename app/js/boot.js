// Keep till — Device layout, offline, updates and install.
// Part of app/index.html; the parts load in order and share one global scope.
//  DEVICE-AWARE LAYOUT
//  phone  (< 640px)  — one column, cart opens from the bottom bar
//  tablet (640–1023) — more columns, screens open as centred windows
//  computer / tablet sideways (≥ 900px wide) — cart stays open on the right
//  A mouse/keyboard also turns on shortcuts and barcode-scanner support.
// ════════════════════════════════════════════════
function detectDevice() {
    const w = window.innerWidth, fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
    const dev = w >= 1024 ? 'desktop' : w >= 640 ? 'tablet' : 'phone';
    if (S.device !== dev) {
        document.body.classList.remove('dev-phone', 'dev-tablet', 'dev-desktop');
        document.body.classList.add('dev-' + dev);
        S.device = dev;
    }
    document.body.classList.toggle('has-keyboard', !!fine);
    S.dockCart = w >= 900;
    const nav = document.querySelector('.tab-nav');
    document.documentElement.style.setProperty('--navH', (nav && nav.offsetHeight ? nav.offsetHeight : 0) + 'px');
    syncCartDock();
}
function syncCartDock() {
    const c = $('sheetCart');
    const want = !!(S.dockCart && S.me && $('mainApp').style.display === 'block' && $('page-pos').classList.contains('active'));
    if (want) { c.classList.add('docked', 'active'); renderCart(); }
    else if (c.classList.contains('docked')) c.classList.remove('docked', 'active');
    document.body.classList.toggle('cart-docked', want);
}
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(detectDevice, 120); });
window.addEventListener('orientationchange', () => setTimeout(detectDevice, 300));

// Keyboard & barcode scanner (computers)
function posSearchEnter() {
    const q = $('posSearch').value.trim(); if (!q) return;
    if (!productByCode(q) && S.serialsIn[serialId(q)]) { sellByCode(q); $('posSearch').value = ''; renderPOS(); return; }
    const byCode = productByCode(q);
    const shown = [...document.querySelectorAll('#posGrid .item-card:not(.out)')];
    const pick = byCode || (shown.length === 1 ? productById((shown[0].getAttribute('onclick') || '').match(/'([^']+)'/)?.[1]) : null);
    if (!pick) return toast(shown.length ? 'Several items match — keep typing or tap one' : 'No item with that name or barcode', 'err');
    addToCart(pick.id);
    $('posSearch').value = ''; renderPOS();
}
document.addEventListener('keydown', e => {
    if (SC.on && e.key === 'Escape') { closeScanner(); return; }
    if (!S.me || $('mainApp').style.display !== 'block') return;
    const tag = (e.target.tagName || '').toLowerCase(), typing = ['input', 'textarea', 'select'].includes(tag);
    const modalOpen = !!document.querySelector('.modal-overlay.active:not(.docked)');
    if (e.key === 'Escape' && modalOpen) { closeModals(); return; }
    if (e.target.id === 'posSearch' && e.key === 'Enter') { e.preventDefault(); posSearchEnter(); return; }
    if (e.key === 'F2' && $('page-pos').classList.contains('active') && cartCount()) { e.preventDefault(); S.dockCart ? confirmSale() : openCart(); return; }
    if (typing || modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$('page-pos').classList.contains('active')) return;
    if (e.key === '/') { e.preventDefault(); $('posSearch').focus(); return; }
    // A barcode scanner "types" fast: send stray keys straight into the search box
    if (e.key.length === 1) { e.preventDefault(); $('posSearch').focus(); $('posSearch').value += e.key; renderPOS(); }
});

// ════════════════════════════════════════════════
//  OFFLINE, UPDATE & INSTALL
// ════════════════════════════════════════════════
function setOnline() { $('offlineBanner').classList.toggle('show', !navigator.onLine); updatePending(); }
window.addEventListener('online', () => { setOnline(); if (S.pending) toast('✅ Back online — syncing…'); });
window.addEventListener('offline', setOnline);
setOnline();

async function forceUpdate() {
    try {
        if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); }
        if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
    } catch (e) {}
    location.reload();
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e)));
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installPrompt = e;
    if (!sGet('matinyo.installDismissed')) setTimeout(() => $('installBanner').classList.add('show'), 4000);
});
function doInstall() { $('installBanner').classList.remove('show'); if (installPrompt) { installPrompt.prompt(); installPrompt = null; } }
function dismissInstall() { $('installBanner').classList.remove('show'); sSet('matinyo.installDismissed', '1'); }

renderLogin();
detectDevice();
loader(true, 'STARTING...');
