// Keep till — Settings, shared state, small helpers, health reports, bottom sheets.
// Part of app/index.html; the parts load in order and share one global scope.
// ════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════
const firebaseConfig = window.KEEP_ENV.firebaseConfig;   // live or test — see /env.js
// Sellers' hidden logins live on this domain. Nobody types it — they use their phone number.
const SHOP_DOMAIN = 'tenants.matinyopos.app';
const IDLE_LIMIT = 10 * 60 * 1000; // sign out after 10 minutes without a tap
// Icons for any kind of shop: gadgets, tools & hardware, electrical, household, general goods
const EMOJIS = ['📦','📱','💻','🖥️','⌨️','🖱️','🎧','🔌','🔋','💡','📷','⌚','🖨️','📺','🎮','💾','📡','🔧','🔨','🪛','🪚','⚙️','🔩','🧰','🪜','🧱','🪣','🎨','🚿','🚰','🔦','🧯','⛓️','📏','🪝','🧴','🧼','🧹','🛋️','🛏️','👕','👟','✏️','📚','💊','🍞','🥤','🍚','🛍️','🎁'];
const EXPENSE_CATS = [
    ['Supplier', '📦 Supplier / Restock'], ['Electricity', '⚡ Electricity (LUKU)'], ['Transport', '🚗 Transport'],
    ['Rent', '🏠 Rent'], ['Salaries', '👷 Salaries / Labour'], ['Repairs', '🔧 Repairs & Maintenance'],
    ['Taxes', '🧾 Taxes & Licences'], ['Other', '📝 Other']
];
const ACCT = { cash: '💵 Cash', mobile: '📱 Lipa kwa Simu', bank: '🏦 Bank', savings: '💰 Savings' };
const ENTRY_COLORS = {
    expense: ['var(--yellow)', '#fffbeb'], banking: ['var(--blue)', '#eff6ff'], withdrawal: ['#854d0e', '#fefce8'],
    transfer: ['#7c3aed', '#f3e8ff'], savings: ['#a16207', '#fef9c3'], adjust: ['#6b7280', '#f3f4f6']
};

firebase.initializeApp(firebaseConfig);
// App version — shown on the sign-in screen and saved on each sale, so you can tell when every till has updated.
const APP_VERSION = 53;
// App Check: proves requests come from the real Keep app, not a script. Paste your reCAPTCHA v3 SITE key
// between the quotes to switch it on (see the setup guide). Empty = off.
const APP_CHECK_SITE_KEY = '';
if (APP_CHECK_SITE_KEY && firebase.appCheck) {
    try { firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(APP_CHECK_SITE_KEY), true); }
    catch (e) { console.warn('App Check not started:', e); }
}
const auth = firebase.auth();
const db = firebase.firestore();
// Keep data on the device so the till keeps working when the internet drops.
db.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('Offline storage unavailable:', e.code));
const FV = firebase.firestore.FieldValue;
const inc = n => FV.increment(n);
// Plan usage list — the database checks it against the plan's limits.
// Only written once Keep HQ has set it up for the shop.
const usageRef = () => col('plan').doc('usage');
function usageAdd(b, kind, id) { if (S.usage) b.update(usageRef(), { [`${kind}.${id}`]: true, updatedAt: now() }); }
function usageDel(b, kind, id) { if (S.usage) b.update(usageRef(), { [`${kind}.${id}`]: FV.delete(), updatedAt: now() }); }
const usedItems = () => S.usage ? Object.keys(S.usage.products || {}).length : S.products.length;
const usedStaff = () => S.usage ? Object.keys(S.usage.staff || {}).length : (S.staff || []).filter(p => p.active !== false).length;
const now = () => FV.serverTimestamp();
// Every change a seller makes to stock, a customer's debt, the cash/mobile balances or the day totals
// carries a link to the record that caused it (a sale, a stock movement, a delivery or an expense).
// The database rules check the amounts against that record, so numbers can't be edited on their own.
const src = (c, id) => ({ c, id });

// ════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════
const S = {
    saleCache: {},
    tenant: null, tenantInfo: {}, me: null,
    products: [], costs: {}, balances: { cash: 0, mobile: 0, bank: 0, savings: 0 },
    days: {}, months: {}, todaySales: [], today: null,
    cart: {}, payTouched: false, activeCat: 'All', emoji: '📦',
    historyAll: false, historyLimit: 7,
    listeners: [], sheetListeners: [], pending: 0,
    loginPick: null, entryType: 'expense', reportCache: {}, closeDayMsg: '', mc: null
};

// ════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const n0 = v => Math.round(Number(v) || 0).toLocaleString('en-US');
const fmt = v => n0(v) + ' TZS';
const signed = v => (v >= 0 ? '+' : '') + n0(v);
const dayStr = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shiftDay = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return dayStr(x); };
const monthName = m => new Date(m + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const monthShort = m => new Date(m + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'short' });
const prevMonth = m => { const [y, mo] = m.split('-').map(Number); return dayStr(new Date(y, mo - 2, 15)).slice(0, 7); };
const prettyDay = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const timeOf = t => t && t.toDate ? t.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'saving…';
const isAdmin = () => !!(S.me && S.me.role === 'admin');
const tRef = () => db.collection('tenants').doc(S.tenant);
const col = name => tRef().collection(name);
const productById = id => S.products.find(p => p.id === id);
const sGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const sSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

function toast(msg, type) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type === 'err' ? ' err' : '');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), type === 'err' ? 4500 : 2600);
}
function loader(on, text) {
    $('loadingOverlay').style.display = on ? 'flex' : 'none';
    $('loadingText').textContent = text || 'LOADING...';
}
function friendlyErr(e) {
    const c = (e && e.code) || '';
    if (c.includes('permission-denied')) return 'your account is not allowed to do this';
    if (c.includes('unavailable')) return 'no connection to the server';
    return (e && e.message) || String(e);
}

// Save a batch. It is applied on this device straight away (works offline) and
// synced to the cloud in the background. A badge shows anything still waiting.
function commit(batch, okMsg, what) {
    S.pending++; updatePending();
    const p = batch.commit()
        .catch(err => {
            console.error(err); toast('⚠️ Not saved: ' + friendlyErr(err), 'err');
            reportProblem('save', err, what && what.label);
            if (what) { const l = failedSaves(); l.push({ ...what, at: Date.now(), by: S.me ? S.me.name : '', why: friendlyErr(err) }); sSet('matinyo.failed', JSON.stringify(l.slice(-30))); renderNotices(); }
            throw err;
        })
        .finally(() => { S.pending--; updatePending(); });
    if (okMsg) toast(okMsg);
    return p.catch(() => {});
}
// ════════════════════════════════════════════════
//  HEALTH: problems and app version, so Keep HQ sees trouble before the shop calls
// ════════════════════════════════════════════════
const RP_SENT = {};
let rpCount = 0;
function reportProblem(kind, err, note) {
    try {
        if (!S.me || !S.tenant || rpCount >= 8) return;
        const msg = String((err && (err.code ? err.code + ': ' : '') + (err.message || err)) || 'unknown').slice(0, 300);
        if (RP_SENT[msg]) return;
        RP_SENT[msg] = 1; rpCount++;
        db.collection('errors').add({
            shop: S.tenant, uid: S.me.uid, name: S.me.name || '', kind: String(kind).slice(0, 20), msg,
            stack: String((err && err.stack) || '').slice(0, 900), note: String(note || '').slice(0, 200),
            appV: APP_VERSION, screen: (document.querySelector('.tab-page.active') || {}).id || '', online: navigator.onLine,
            ua: navigator.userAgent.slice(0, 160), day: dayStr(), at: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
    } catch (e) {}
}
window.addEventListener('error', e => { if (e && e.message && !/ResizeObserver|Script error/.test(e.message)) reportProblem('crash', e.error || e.message, (e.filename || '').split('/').pop() + ':' + e.lineno); });
window.addEventListener('unhandledrejection', e => reportProblem('promise', e.reason));
// One small record per person per device: which version they run and when they were last seen.
function pingHealth() {
    try {
        if (!S.me || !S.tenant) return;
        const key = 'keep.ping.' + S.tenant + '.' + S.me.uid;
        if (Date.now() - (Number(sGet(key)) || 0) < 3 * 3600e3) return;
        sSet(key, String(Date.now()));
        db.collection('pings').doc(S.tenant + '_' + S.me.uid).set({
            shop: S.tenant, uid: S.me.uid, name: S.me.name || '', role: S.me.role, appV: APP_VERSION,
            lang: (window.KeepLang && KeepLang.lang) || 'en', ua: navigator.userAgent.slice(0, 160), at: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
    } catch (e) {}
}
function failedSaves() { try { return JSON.parse(sGet('matinyo.failed') || '[]'); } catch (e) { return []; } }
async function showFailedSaves() {
    const l = failedSaves(); if (!l.length) return;
    const ok = await showConfirm(`<b>These were NOT saved</b> — please enter them again:<br><br>` + l.map(x => `• ${new Date(x.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} — ${esc(x.label)} <span style="color:#6b7280;">(${esc(x.by)})</span><br><span style="font-size:.72rem;color:#b91c1c;">${esc(x.why)}</span>`).join('<br>'), 'I have re-entered them');
    if (ok) { sSet('matinyo.failed', '[]'); renderNotices(); }
}
function updatePending() {
    const b = $('pendingBadge');
    b.textContent = `⏳ ${S.pending} waiting to sync`;
    b.classList.toggle('show', S.pending > 0 && !navigator.onLine);
}

// Mobile-safe confirm dialog
function showConfirm(message, yesLabel = 'Delete', yesColor = 'var(--red)') {
    return new Promise(resolve => {
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        o.innerHTML = `<div style="background:#fff;border-radius:20px;padding:22px;max-width:330px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="font-size:1.5rem;margin-bottom:10px;">⚠️</div>
            <div style="font-size:0.88rem;font-weight:600;margin-bottom:18px;line-height:1.45;">${message}</div>
            <div style="display:flex;gap:10px;">
                <button data-a="no" style="flex:1;padding:12px;border-radius:12px;border:2px solid #e3e8ef;background:#fff;font-weight:800;cursor:pointer;">Cancel</button>
                <button data-a="yes" style="flex:1;padding:12px;border-radius:12px;border:none;background:${yesColor};color:#fff;font-weight:800;cursor:pointer;">${yesLabel}</button>
            </div></div>`;
        document.body.appendChild(o);
        o.addEventListener('click', e => {
            const a = e.target.dataset && e.target.dataset.a;
            if (!a) return;
            o.remove(); resolve(a === 'yes');
        });
    });
}

// ════════════════════════════════════════════════
//  SHEETS (bottom modals)
// ════════════════════════════════════════════════
function openSheet(id) {
    closeModals();
    $(id).classList.add('active');
    document.body.classList.add('modal-open'); document.documentElement.classList.add('modal-open');
}
function closeModals() {
    document.querySelectorAll('.modal-overlay:not(.docked)').forEach(o => o.classList.remove('active'));
    document.body.classList.remove('modal-open'); document.documentElement.classList.remove('modal-open');
    S.sheetListeners.forEach(u => u()); S.sheetListeners = [];
}
function overlayClose(e) { if (e.target.classList.contains('modal-overlay') && !e.target.classList.contains('docked')) closeModals(); }
(function swipeToClose() {
    let y0 = 0, x0 = 0;
    document.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', e => {
        const dy = e.changedTouches[0].clientY - y0, dx = Math.abs(e.changedTouches[0].clientX - x0);
        if (dy < 80 || dx > 60) return;
        const o = document.querySelector('.modal-overlay.active'); if (!o) return;
        const m = o.querySelector('.modal'); if (m && y0 < m.getBoundingClientRect().top + 70) closeModals();
    }, { passive: true });
})();

// ════════════════════════════════════════════════
