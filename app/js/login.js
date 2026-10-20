// Keep till — Sign-in, live data from the database, tabs and day figures.
// Part of app/index.html; the parts load in order and share one global scope.
//  LOGIN  — phone number (or email) + PIN
//  Owners sign in with their real email (so "Forgot PIN" can email them).
//  Sellers sign in with their phone number. A small public lookup
//  (logins/<phone>) turns the phone number into the hidden login behind it.
// ════════════════════════════════════════════════
const isSellerEmail = e => (e || '').toLowerCase().endsWith('@' + SHOP_DOMAIN);
function normPhone(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('0') && d.length === 10) d = '255' + d.slice(1);
    else if (d.length === 9 && /^[67]/.test(d)) d = '255' + d;
    return d;
}
// WhatsApp links need the number in international form (2557XXXXXXXX), never 07XX…
// With no number, WhatsApp opens and lets you pick who to send it to.
function openWa(number, text) {
    const n = normPhone(number);
    window.open(`https://wa.me/${/^\d{10,15}$/.test(n) ? n : ''}?text=${encodeURIComponent(text)}`, '_blank');
}
function normLoginId(v) {
    v = String(v || '').trim().toLowerCase();
    return v.includes('@') ? v : normPhone(v);
}
const prettyPhone = p => p && p.startsWith('255') && p.length === 12 ? '0' + p.slice(3, 6) + ' ' + p.slice(6, 9) + ' ' + p.slice(9) : p;
const maskEmail = e => { const [a, b] = String(e).split('@'); return (a.length <= 2 ? a[0] + '*' : a.slice(0, 2) + '***' + a.slice(-1)) + '@' + b; };

// Turn what the person typed into { email } for Firebase sign-in
async function resolveLogin(id) {
    if (id.includes('@')) return { email: id, owner: !isSellerEmail(id) };
    if (id.length < 9) throw new Error('Enter a valid phone number.');
    const snap = await db.collection('logins').doc(id).get({ source: 'server' }).catch(() => db.collection('logins').doc(id).get());
    if (!snap.exists) throw new Error('No account uses that phone number.');
    const d = snap.data();
    return { email: d.email, owner: !isSellerEmail(d.email) };
}

function savedUsers() {
    try { return JSON.parse(sGet('matinyo.users2') || '[]').filter(u => u && u.id); } catch (e) { return []; }
}
function rememberUser(id, name, shopName) {
    const list = savedUsers().filter(u => u.id !== id);
    list.unshift({ id, name, shop: shopName });
    sSet('matinyo.users2', JSON.stringify(list.slice(0, 8)));
}
function forgetUser(i, ev) {
    ev.stopPropagation();
    const list = savedUsers(); list.splice(i, 1);
    sSet('matinyo.users2', JSON.stringify(list));
    S.loginPick = null; S.manualLogin = list.length === 0;
    renderLogin();
}
function loginError(msg, ok) { try { if (msg && !ok) sessionStorage.setItem('keep.msg', msg); } catch (x) {} const e = $('loginError'); e.textContent = msg || ''; e.style.color = ok ? 'var(--green)' : 'var(--red)'; }

function renderLogin() {
    const list = savedUsers();
    const showManual = !S.loginPick && (S.manualLogin || !list.length);
    $('quickBlock').classList.toggle('hidden', !list.length || !!S.loginPick || showManual);
    $('quickUsers').innerHTML = list.map((u, i) => `
        <div class="qu" onclick="pickUser(${i})">
            <button class="qu-x" title="Remove from this device" onclick="forgetUser(${i}, event)">×</button>
            <div class="qu-av">${esc((u.name || '?').charAt(0).toUpperCase())}</div>
            <div class="qu-name">${esc(u.name || u.id)}</div>
            <div class="qu-shop">${esc(u.shop || '')}</div>
        </div>`).join('');
    $('manualFields').classList.toggle('hidden', !showManual);
    $('pickedHello').classList.toggle('hidden', !S.loginPick);
    if (S.loginPick) $('pickedHello').textContent = `Hi ${S.loginPick.name.split(' ')[0]} 👋 enter your PIN`;
    const canType = !!S.loginPick || showManual;
    ['loginPin', 'loginBtn', 'forgotBtn'].forEach(id => $(id).classList.toggle('hidden', !canType));
    $('otherAccountBtn').classList.toggle('hidden', !list.length);
    $('otherAccountBtn').textContent = S.loginPick ? 'Not you?' : showManual ? '← Saved accounts' : 'Use another account';
}
function otherAccount() {
    if (S.loginPick) { S.loginPick = null; S.manualLogin = false; }
    else S.manualLogin = !S.manualLogin;
    loginError(''); renderLogin();
    if (S.manualLogin) setTimeout(() => $('loginId').focus(), 50);
}
function pickUser(i) {
    loginError('');
    S.loginPick = savedUsers()[i] || null; S.manualLogin = false;
    renderLogin();
    setTimeout(() => $('loginPin').focus(), 50);
}
const typedLoginId = () => S.loginPick ? S.loginPick.id : normLoginId($('loginId').value);

async function doLogin() {
    loginError('');
    const id = typedLoginId(), pin = $('loginPin').value.trim();
    if (!id) return loginError('Enter your phone number or email.');
    if (pin.length < 6) return loginError('PIN must be at least 6 digits.');
    if (!navigator.onLine) return loginError('Signing in needs internet. Connect and try again — selling works offline once you are in.');
    const btn = $('loginBtn'); btn.disabled = true; btn.textContent = 'CHECKING...';
    try {
        const { email } = await resolveLogin(id);
        S.pendingLoginId = id;
        await auth.signInWithEmailAndPassword(email, pin);
    } catch (e) {
        const c = e.code || '';
        loginError(c.includes('too-many') ? 'Too many tries. Wait a few minutes and try again.'
            : c.includes('network') ? 'No connection. Check your internet.'
            : c.startsWith('auth/') ? 'Wrong phone/email or PIN.'
            : (e.message || 'Could not sign in.'));
        $('loginPin').value = '';
    } finally { btn.disabled = false; btn.textContent = 'UNLOCK'; }
}

async function forgotPin() {
    const id = typedLoginId();
    if (!id) return loginError('Type your phone number or email first, then tap Forgot PIN.');
    if (!navigator.onLine) return loginError('Resetting a PIN needs internet.');
    try {
        const { email, owner } = await resolveLogin(id);
        if (!owner) return loginError('Ask your shop owner to reset your PIN — they can do it from 👥 Team.');
        await auth.sendPasswordResetEmail(email, { url: window.KEEP_ENV.site });
        loginError(`📧 We sent a link to ${maskEmail(email)}. Open it to set a new PIN (check spam too).`, true);
    } catch (e) {
        loginError(e.code === 'auth/user-not-found' ? 'No account uses that email.' : (e.message || 'Could not send the reset email.'));
    }
}

async function rejectLogin(msg) {
    stopListeners();
    await auth.signOut();
    loginError(msg);
}

// ── Set-PIN link from the email (Firebase sends ?mode=resetPassword&oobCode=…) ──
S.resetCode = (() => { const q = new URLSearchParams(location.search); return q.get('mode') === 'resetPassword' ? q.get('oobCode') : null; })();
if (new URLSearchParams(location.search).get('mode')) history.replaceState(null, '', location.pathname);
async function openSetPin() {
    $('loginPage').style.display = 'none'; $('setPinPage').style.display = 'flex';
    try {
        S.resetEmail = await auth.verifyPasswordResetCode(S.resetCode);
        $('spWho').innerHTML = `Choose a PIN for <b>${esc(S.resetEmail)}</b>.<br>You will use it with this email or your phone number to open the till.`;
        $('spFields').classList.remove('hidden'); setTimeout(() => $('spPin').focus(), 200);
    } catch (e) {
        $('spWho').innerHTML = '⚠️ This link has expired or was already used.<br>On the sign-in page, type your email and tap <b>Forgot PIN?</b> to get a new one.';
    }
}
async function saveNewPin() {
    const pin = $('spPin').value.trim(); $('spError').textContent = '';
    if (!/^\d{6,12}$/.test(pin)) return $('spError').textContent = 'The PIN must be 6 to 12 digits (numbers only).';
    if (pin !== $('spPin2').value.trim()) return $('spError').textContent = 'The two PINs do not match.';
    const btn = $('spBtn'); btn.disabled = true; btn.textContent = 'SAVING...';
    try {
        await auth.confirmPasswordReset(S.resetCode, pin);
        S.resetCode = null; $('setPinPage').style.display = 'none';
        if (auth.currentUser) await auth.signOut();
        S.pendingLoginId = S.resetEmail;
        loader(true, 'OPENING SHOP...');
        await auth.signInWithEmailAndPassword(S.resetEmail, pin);
        setTimeout(() => toast('✅ PIN saved — welcome!'), 800);
    } catch (e) {
        loader(false);
        $('spError').textContent = (e.code || '').includes('expired') || (e.code || '').includes('invalid-action') ? 'This link has expired. Use Forgot PIN on the sign-in page.' : 'Could not save: ' + friendlyErr(e);
    } finally { btn.disabled = false; btn.textContent = 'SAVE PIN & OPEN MY SHOP'; }
}
function leaveSetPin() { S.resetCode = null; $('setPinPage').style.display = 'none'; if (!auth.currentUser) showLogin(); else location.reload(); }

auth.onAuthStateChanged(async user => {
    stopListeners();
    if (S.resetCode) { loader(false); if ($('setPinPage').style.display !== 'flex') openSetPin(); return; }
    if (!user) { location.replace('../' + (location.search.includes('mode=') ? location.search : '')); return; }
    loader(true, 'OPENING SHOP...');
    try {
        const link = await db.collection('users').doc(user.uid).get();
        if (!link.exists || !link.data().shop) return rejectLogin('This login is not linked to any shop. Contact Keep support.');
        // Owners with several branches: open the branch they used last on this device.
        S.branches = link.data().shops || null;
        let pick = null; try { pick = localStorage.getItem('keep.branch.' + user.uid); } catch (e) {}
        S.tenant = S.branches && pick && S.branches[pick] ? pick : link.data().shop;
        const [tSnap, stSnap] = await Promise.all([tRef().get(), col('staff').doc(user.uid).get()]);
        if (!tSnap.exists) return rejectLogin('Shop not found. Contact Keep support.');
        if (!stSnap.exists) return rejectLogin('Your staff account is not set up. Ask the shop owner.');
        const st = stSnap.data();
        if (st.replacedBy) return rejectLogin('Your PIN was reset. Sign in with your new PIN.');
        if (st.active === false) return rejectLogin('Your account has been switched off. Ask the shop owner.');
        if (st.inviteCode) {
            const inv = await db.collection('invites').doc(st.inviteCode).get().catch(() => null);
            if (inv && inv.exists) { stopListeners(); await auth.signOut(); location.replace('../?setup=' + st.inviteCode); return; }
        }
        S.tenantInfo = tSnap.data();
        S.me = { uid: user.uid, email: user.email, loginId: st.loginId || '', name: st.name || 'Staff', role: st.role === 'admin' ? 'admin' : 'cashier' };
        rememberUser(S.pendingLoginId || st.loginId || user.email, S.me.name, S.tenantInfo.name || S.tenant);
        if (!isSellerEmail(user.email || '') && S.tenantInfo.name && user.displayName !== S.tenantInfo.name && user.updateProfile) user.updateProfile({ displayName: S.tenantInfo.name }).catch(() => {});
        S.pendingLoginId = null;
        S.platform = await db.collection('platform').doc('config').get().then(d => d.data() || {}).catch(() => ({}));
        if (subState(S.tenantInfo).locked) showLocked(); else enterApp();
    } catch (e) {
        rejectLogin('Could not open the shop: ' + friendlyErr(e));
    } finally { loader(false); }
});

function showLogin() {
    if (SC.on) closeScanner();
    stopLockWatch(); $('lockPage').style.display = 'none';
    S.me = null; S.cart = {}; S.loginPick = null; S.manualLogin = false;
    document.body.classList.remove('unlocked', 'is-admin', 'is-cashier');
    $('mainApp').style.display = 'none';
    $('loginPage').style.display = 'flex';
    $('loginPin').value = '';
    syncCartDock();
    renderLogin();
}

function enterApp() {
    loginError('');
    stopLockWatch();
    $('lockPage').style.display = 'none';
    $('loginPage').style.display = 'none';
    $('mainApp').style.display = 'block';
    document.body.classList.add('unlocked');
    document.body.classList.toggle('is-admin', isAdmin());
    document.body.classList.toggle('is-cashier', !isAdmin());
    document.querySelectorAll('.me-name').forEach(e => e.textContent = S.me.name.split(' ')[0]);
    document.querySelectorAll('.me-av').forEach(e => e.textContent = (S.me.name || '?').trim().charAt(0).toUpperCase());
    renderShopName();
    S.today = dayStr();
    startListeners();
    switchTab(isAdmin() ? 'dashboard' : 'pos');
    renderSellerTools();
    applyServiceMode();
    detectDevice();
    touch();
    prewarmScanner();
    checkClock();
    setTimeout(pingHealth, 4000);
}
async function checkClock() {
    try {
        const r = await fetch(location.pathname + '?clock=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
        const d = Date.parse(r.headers.get('date') || '');
        if (!d) return;
        const off = Math.round((Date.now() - d) / 60000);
        S.clockOff = Math.abs(off) >= 10 ? off : 0;
        renderNotices();
    } catch (e) {}
}

async function unsyncedCount() {
    if (S.pending > 0) return S.pending;
    if (typeof db.waitForPendingWrites !== 'function') return 0;
    const done = await Promise.race([db.waitForPendingWrites().then(() => true), new Promise(r => setTimeout(() => r(false), 1500))]);
    return done ? 0 : 1;
}
async function logout(msg, force) {
    if (!force && S.me && await unsyncedCount()) {
        const ok = await showConfirm(`⏳ <b>Some sales or changes have not reached the internet yet.</b><br><br>If you sign out now they stay on this phone and are only sent when <b>${esc(S.me.name.split(' ')[0])}</b> signs in here again — the owner won't see them.<br><br>Connect to the internet and wait for “waiting to sync” to clear.`, 'Sign out anyway');
        if (!ok) return;
    }
    if (Object.keys(S.cart).length && !msg) {
        showConfirm('There are items in the cart. Sign out anyway?', 'Sign out').then(ok => { if (ok) { S.cart = {}; auth.signOut(); } });
        return;
    }
    closeModals();
    auth.signOut();
    if (msg) setTimeout(() => toast(msg), 300);
}

// Change my own PIN (anyone)
function openPin() { ['pinOld', 'pinNew', 'pinNew2'].forEach(id => $(id).value = ''); openSheet('sheetPin'); setTimeout(() => $('pinOld').focus(), 250); }
async function changeMyPin() {
    const old = $('pinOld').value.trim(), nw = $('pinNew').value.trim();
    if (!/^\d{6,12}$/.test(nw)) return toast('⚠️ New PIN must be 6 to 12 digits.', 'err');
    if (nw !== $('pinNew2').value.trim()) return toast('⚠️ The two new PINs do not match.', 'err');
    if (!navigator.onLine) return toast('⚠️ Changing your PIN needs internet.', 'err');
    const btn = $('pinBtn'); btn.disabled = true; btn.textContent = 'SAVING...';
    try {
        const u = auth.currentUser;
        await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, old));
        await u.updatePassword(nw);
        closeModals(); toast('✅ PIN changed');
    } catch (e) {
        toast((e.code || '').includes('wrong-password') || (e.code || '').includes('credential') ? '⚠️ Current PIN is wrong.' : '⚠️ ' + friendlyErr(e), 'err');
    } finally { btn.disabled = false; btn.textContent = 'SAVE NEW PIN'; }
}

// Sign out automatically after a period with no taps
let lastTouch = Date.now();
function touch() { lastTouch = Date.now(); }
['click', 'touchstart', 'keyup', 'scroll'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));
setInterval(() => {
    // Only when online: signing back in needs internet, and the till must keep working offline.
    if (S.me && navigator.onLine && Date.now() - lastTouch > IDLE_LIMIT) logout('🔒 Signed out after 10 minutes idle');
    if (S.me && dayStr() !== S.today) { S.today = dayStr(); stopListeners(); startListeners(); renderAll(); }
    if (S.me && $('mainApp').style.display === 'block' && subState(S.tenantInfo).locked) showLocked();
}, 15000);

// ════════════════════════════════════════════════
//  LIVE DATA
// ════════════════════════════════════════════════
function startListeners() {
    const onErr = e => { console.warn(e); if (e.code === 'permission-denied') toast('⚠️ Access problem: ' + friendlyErr(e), 'err'); };
    const L = (q, fn) => S.listeners.push(q.onSnapshot(fn, onErr));

    L(tRef(), s => {
        S.tenantInfo = s.data() || {};
        if (subState(S.tenantInfo).locked) { showLocked(); return; }
        renderShopName(); renderNotices(); renderSellerTools(); applyServiceMode(); renderPOS(); if (isAdmin()) renderDashboard();
    });
    L(col('staff').doc(S.me.uid), s => {
        const d = s.data();
        if (d && d.replacedBy) rejectLogin('Your PIN was reset. Sign in with your new PIN.');
        else if (!d || d.active === false) rejectLogin('Your account has been switched off. Ask the shop owner.');
    });
    L(col('products'), s => {
        S.products = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        applyServiceMode();
        Object.keys(S.cart).forEach(id => { if (!productById(id)) delete S.cart[id]; });
        renderPOS(); renderInventory(); renderServicesPage(); renderNotices(); if (isAdmin()) renderDashboard();
    });
    L(col('sales').where('day', '==', S.today), s => {
        S.todaySales = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPosStrip(); renderBarberToday(); if ($('page-barbers').classList.contains('active')) renderBarbersPage(); if (isAdmin()) renderDashboard();
    });
    L(db.collection('announcements').where('active', '==', true), s => {
        S.announcements = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNotices();
    });
    L(db.collection('platform').doc('config'), s => { S.platform = s.data() || {}; });
    S.listeners.push(usageRef().onSnapshot(s => { S.usage = s.exists ? s.data() : null; }, e => {
        // Not on the plan's staff list (switched off, or over the plan limit)
        if (e.code === 'permission-denied') setTimeout(() => { if (S.me && !subState(S.tenantInfo || {}).locked) rejectLogin('Your login is not active on this shop. Ask the shop owner to switch you on.'); }, 2500);
    }));
    L(col('serials').where('status', '==', 'in'), s => {
        S.serialsIn = {}; s.docs.forEach(d => S.serialsIn[d.id] = { id: d.id, ...d.data() });
        renderInventory();
        if ($('sheetSerials').classList.contains('active')) renderSerialList();
    });
    if (isAdmin()) {
        L(col('costs'), s => { S.costs = {}; s.docs.forEach(d => S.costs[d.id] = Number(d.data().costPrice) || 0); renderInventory(); });
        L(col('meta').doc('balances'), s => { S.balances = { cash: 0, mobile: 0, bank: 0, savings: 0, ...(s.data() || {}) }; renderDashboard(); });
        const from = dayStr(new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1));
        L(col('days').where('day', '>=', from), s => { S.days = {}; s.docs.forEach(d => S.days[d.id] = d.data()); renderDashboard(); });
        L(col('months'), s => { S.months = {}; s.docs.forEach(d => S.months[d.id] = d.data()); renderDashboard(); });
        L(col('staff'), s => { S.staffAll = s.docs.map(d => ({ uid: d.id, ...d.data() })); });
        L(col('customers').where('balance', '>', 0), s => {
            const owed = s.docs.reduce((a, d) => a + (d.data().balance || 0), 0);
            $('dashOwed').textContent = owed ? '· owed ' + n0(owed) : '';
        });
        L(col('receipts').where('status', '==', 'pending'), s => {
            S.pendingReceipts = s.docs.map(d => ({ id: d.id, ...d.data() }));
            renderNotices();
        });
        L(col('cashups').where('status', '==', 'pending'), s => {
            S.pendingCashups = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (tms(a.createdAt) || 9e15) - (tms(b.createdAt) || 9e15));
            const n = S.pendingCashups.length, bd = $('cuBadge');
            bd.textContent = n; bd.classList.toggle('hidden', !n);
            renderNotices();
            if ($('sheetCashups').classList.contains('active')) renderCashupList();
        });
    }
}
function stopListeners() {
    S.listeners.forEach(u => u()); S.listeners = [];
    stopLockWatch();
    S.sheetListeners.forEach(u => u()); S.sheetListeners = [];
}

function renderAll() { renderPOS(); renderInventory(); renderPosStrip(); if (isAdmin()) renderDashboard(); }
function renderShopName() {
    const n = (S.tenantInfo.name || S.tenant || 'KEEP').toUpperCase();
    document.querySelectorAll('.shop-name').forEach(e => e.textContent = n);
    document.querySelectorAll('.today-label').forEach(e => e.textContent = shortDay(dayStr()));
}

// ════════════════════════════════════════════════
//  TABS
// ════════════════════════════════════════════════
function switchTab(tab) {
    if (tab === 'dashboard' && !isAdmin()) tab = 'pos';
    if ((tab === 'services' || tab === 'barbers') && (!isAdmin() || !isBarberMode())) tab = 'pos';
    if (tab === 'inventory' && isBarberMode()) tab = isAdmin() ? 'services' : 'pos';
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    $('page-' + tab).classList.add('active');
    $('tab-' + tab).classList.add('active');
    $('cartBar').style.visibility = tab === 'pos' ? 'visible' : 'hidden';
    window.scrollTo(0, 0);
    syncCartDock();
    if (tab === 'pos') renderPOS();
    if (tab === 'inventory') renderInventory();
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'services') renderServicesPage();
    if (tab === 'barbers') renderBarbersPage();
}

// ════════════════════════════════════════════════
//  FIGURES
// ════════════════════════════════════════════════
function dayFig(d) {
    const x = S.days[d] || {};
    return {
        sales: +x.sales || 0, cash: +x.cash || 0, mobile: +x.mobile || 0, tx: +x.txCount || 0,
        supplier: +x.supplier || 0, expense: +x.expense || 0, bankIn: +x.bankIn || 0, bankOut: +x.bankOut || 0,
        toSavings: +x.toSavings || 0, credit: +x.credit || 0, discount: +x.discount || 0, debtPaid: +x.debtPaid || 0, returns: +x.returns || 0,
        closing: x.closing || null, exists: !!S.days[d]
    };
}
// Sales recorded on a day after the owner closed it (e.g. a seller kept selling)
function afterClose(x) {
    if (!x.closing || x.closing.sales == null) return 0;
    return Math.max(0, x.sales - x.closing.sales);
}
function monthFig(m) {
    const f = { sales: 0, cash: 0, mobile: 0, tx: 0, supplier: 0, expense: 0, bankIn: 0, bankOut: 0, toSavings: 0, credit: 0, discount: 0, debtPaid: 0, returns: 0, days: 0 };
    Object.keys(S.days).forEach(d => {
        if (d.slice(0, 7) !== m) return;
        const x = dayFig(d);
        ['sales', 'cash', 'mobile', 'tx', 'supplier', 'expense', 'bankIn', 'bankOut', 'toSavings', 'credit', 'discount', 'debtPaid', 'returns'].forEach(k => f[k] += x[k]);
        if (x.sales) f.days++;
    });
    f.profit = f.sales - f.supplier - f.expense;
    f.hasData = !!(f.sales || f.supplier || f.expense);
    return f;
}
function trendBadge(curr, prev, label) {
    if (!prev) return '';
    const diff = (curr - prev) / Math.abs(prev) * 100;
    return `<span class="trend-badge ${diff >= 0 ? 'trend-up' : 'trend-down'}">${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(0)}% ${label}</span>`;
}

// ════════════════════════════════════════════════
