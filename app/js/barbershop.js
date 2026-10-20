// ════════════════════════════════════════════════
//  BARBERSHOP LAYOUT
//  A barbershop sees its own app: Business · Today · Services · Barbers.
//  No stock, no cart, no shop words. Underneath it is the same data
//  (services are items with service:true, a client is a sale), so
//  reports, cash-ups, closing the day and staff pay all keep working.
// ════════════════════════════════════════════════
const BARBER_ICONS = ['💈', '✂️', '💇', '💇‍♀️', '🧔', '🪒', '👦', '👧', '🎨', '💆', '🧖', '💅', '🪮', '🧴', '🧼', '⭐'];
const TAB_LABELS = {
    shop: { dashboard: ['📊', 'Dashboard'], pos: ['🛒', 'Point of Sale'] },
    barber: { dashboard: ['📊', 'Business'], pos: ['💈', 'Today'] }
};

function applyBarberShell() {
    const on = isBarberMode();
    document.body.classList.toggle('barber', on);
    const L = TAB_LABELS[on ? 'barber' : 'shop'];
    Object.entries(L).forEach(([k, [ic, t]]) => { const b = $('tab-' + k); if (b) b.innerHTML = `<span class="tab-icon">${ic}</span>${t}`; });
    document.querySelectorAll('[data-bw]').forEach(el => {
        if (el.dataset.shop == null) el.dataset.shop = el.textContent;
        const want = on ? el.dataset.bw : el.dataset.shop;
        if (el.textContent !== want) el.textContent = want;
    });
    const sup = EXPENSE_CATS.find(c => c[0] === 'Supplier'); if (sup) sup[1] = on ? '🧴 Supplies (products, blades…)' : '📦 Supplier / Restock';
    if (on && $('page-inventory').classList.contains('active')) switchTab('pos');
    if (!on && ($('page-services').classList.contains('active') || $('page-barbers').classList.contains('active'))) switchTab('pos');
}

// ── Today: clients served today, under the services list ──
function renderBarberToday() {
    renderDashBarbers();
    const box = $('barberToday'); if (!box) return;
    if (!isBarberMode()) { box.innerHTML = ''; return; }
    let list = (S.todaySales || []).filter(s => s.kind === 'pos' && !s.voided);
    if (!isAdmin()) list = list.filter(s => s.staffUid === S.me.uid || (s.items || []).some(i => i.by === S.me.uid));
    list.sort((a, b) => (tms(b.createdAt) || 0) - (tms(a.createdAt) || 0));
    const time = s => { const t = tms(s.createdAt); return t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''; };
    box.innerHTML = `<div class="sr-head">${tl('Clients today')} · ${list.length}</div>` + (list.length ? list.slice(0, 40).map(s => {
        const what = (s.items || []).map(i => esc(i.name) + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ');
        const who = [...new Set((s.items || []).filter(i => i.by).map(i => i.byName || staffName(i.by)))].map(esc).join(', ');
        return `<div class="bt-row"><span class="bt-time">${time(s)}</span>
            <span class="bt-what"><b class="notr">${what}</b>${who ? `<small>✂️ <span class="notr">${who}</span></small>` : ''}</span>
            <span class="bt-amt">${n0(s.total)}<small>${s.mobile > 0 && !s.cash ? '📱' : s.cash > 0 && !s.mobile ? '💵' : '💵📱'}</small></span></div>`;
    }).join('') : `<div class="hint gray" style="margin-top:6px;">${tl('Tap a service above when a client is done.')}</div>`);
}

// ── Services tab (owner) ──
function renderServicesPage() {
    if (!$('svcList')) return;
    const svcs = S.products.filter(isService), goods = S.products.filter(p => !isService(p));
    $('svcList').innerHTML = svcs.length ? svcs.map(p => `
        <button class="svc-row" onclick="openItem('${p.id}')">
            <span class="sr-emoji">${esc(p.emoji || '✂️')}</span>
            <span class="sr-name"><span class="notr">${esc(p.name)}</span>${p.staffPay ? `<small>${tl('Barber gets')} ${n0(p.staffPay)} · ${tl('You keep')} ${n0((Number(p.sellPrice) || 0) - p.staffPay)}</small>` : `<small style="color:var(--red);">${tl('Barber share not set')}</small>`}</span>
            <b class="sr-price">${n0(p.sellPrice)}</b><span class="sr-edit">✏️</span></button>`).join('')
        : `<div class="empty-state"><div class="icon">✂️</div>${tl('No services yet.')}<br><span style="font-size:.78rem;">${tl('Add your services and prices — haircut, shave, kids cut…')}</span></div>`;
    $('svcGoods').innerHTML = goods.map(p => `
        <button class="svc-row small" onclick="openItem('${p.id}')">
            <span class="sr-emoji">${esc(p.emoji || '🧴')}</span>
            <span class="sr-name"><span class="notr">${esc(p.name)}</span><small>${stockTxt(p)}</small></span>
            <b class="sr-price">${n0(p.sellPrice)}</b><span class="sr-edit">✏️</span></button>`).join('');
}
function newService() { openItem(); $('itemService').checked = true; serviceChanged(); }
function newProduct() { openItem(); $('itemService').checked = false; serviceChanged(); }

// ── Barbers tab (owner) ──
async function renderBarbersPage() {
    const box = $('barberList'); if (!box) return;
    const staff = await doersList();
    const today = (S.todaySales || []).filter(s => s.kind === 'pos' && !s.voided);
    const rows = staff.filter(x => x.active !== false).map(x => {
        let clients = 0, money = 0, earned = 0;
        today.forEach(s => {
            const mine = (s.items || []).filter(i => i.service && i.by === x.uid);
            if (mine.length) clients++;
            mine.forEach(i => { money += Number(i.subtotal) || 0; earned += itemShare(i, i.qty); });
        });
        return `<div class="barber-card">
            <div class="bc-top"><span class="bc-av">${esc((x.name || '?').trim()[0] || '?').toUpperCase()}</span>
                <div style="flex:1;"><b class="notr">${esc(x.name)}</b>${x.phone ? `<small class="notr">${esc(x.phone)}</small>` : ''}</div>
                <button class="tiny-btn" onclick="editBarber('${x.uid}')">✏️</button></div>
            <button class="bc-pay" onclick="setStaffPay('${x.uid}').then(renderBarbersPage)">💵 ${tl('Pay method')}: <b>${esc(payLabel(x))}</b></button>
            <div class="bc-stats three"><div><b>${clients}</b><small>${tl('Clients today')}</small></div><div><b>${n0(money)}</b><small>${tl('Money today')}</small></div><div><b>${todayShareTxt(x, { money, shares: earned, clients })}</b><small>${tl('Their share')}</small></div></div>
        </div>`;
    });
    box.innerHTML = (rows.join('') || `<div class="empty-state"><div class="icon">💈</div>${tl('No barbers yet.')}<br><span style="font-size:.78rem;">${tl('Add the people who cut hair — just a name and how they are paid.')}</span></div>`)
        + `<div class="hint gray" style="margin-top:4px;">${tl('Barbers paid per service earn the "barber gets" amount set on each service. Tap Pay method to use a percentage, a salary or chair rent instead.')}</div>`;
}
// Today's share for one barber, by their pay method
function todayShareTxt(x, w) {
    const t = payOf(x).type;
    if (t === 'salary') return `<span style="font-size:.8rem;">${tl('Salary')}</span>`;
    return n0(earnedBy(x, { money: w.money, shares: w.shares, days: w.clients ? 1 : 0, months: 0 }));
}
// Add a barber: a name and how they are paid. No login.
async function addBarber() {
    const name = await askValue(`💈 ${tl('Barber name')}`, tl('e.g. Baraka'), tl('Next'), { type: 'text' });
    if (!name) return;
    if (barbersAll().some(b => b.active !== false && (b.name || '').toLowerCase() === name.toLowerCase())) return toast('⚠️ ' + tl('A barber with that name is already listed.'), 'err');
    const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    await saveBarbers([...barbersAll(), { id, name, pay: { type: 'service', rate: 0, every: 'day' }, active: true }], `✅ ${name} ${tl('added')}`);
    renderBarbersPage();
    await setStaffPay(id);                         // straight on to how they are paid
    renderBarbersPage();
}
async function editBarber(id) {
    const x = barbersAll().find(b => b.id === id); if (!x) return;
    const k = await choose(`<b class="notr">${esc(x.name)}</b>`, [['name', '✏️ ' + tl('Change name'), '#1a56db'], ['phone', '📞 ' + tl('Phone number (optional)'), '#1a56db'], ['off', '⛔ ' + tl('Remove from the list'), '#e02424']]);
    if (k === 'name') {
        const v = await askValue(tl('Barber name'), '', tl('Save'), { type: 'text', value: x.name }); if (!v) return;
        await saveBarbers(barbersAll().map(b => b.id === id ? { ...b, name: v } : b), '✅ ' + tl('Saved'));
    } else if (k === 'phone') {
        const v = await askValue(tl('Phone number (optional)'), '07…', tl('Save'), { value: x.phone || '' }); if (v === null) return;
        await saveBarbers(barbersAll().map(b => b.id === id ? { ...b, phone: v } : b), '✅ ' + tl('Saved'));
    } else if (k === 'off') {
        if (!(await showConfirm(`${tl('Remove')} <b class="notr">${esc(x.name)}</b>?<br><small>${tl('Their past clients and pay stay in the records.')}</small>`, tl('Remove')))) return;
        await saveBarbers(barbersAll().map(b => b.id === id ? { ...b, active: false } : b), '✅ ' + tl('Removed'));
    }
    renderBarbersPage();
}

// ── Business page: what each barber did today — clients, money brought in, their share ──
function barberDay(sales) {
    const by = {};
    sales.filter(s => s.kind === 'pos' && !s.voided).forEach(s => {
        const seen = new Set();
        (s.items || []).filter(i => i.service && i.by).forEach(i => {
            const r = by[i.by] = by[i.by] || { uid: i.by, name: i.byName || staffName(i.by) || '?', clients: 0, money: 0, share: 0 };
            if (!seen.has(i.by)) { seen.add(i.by); r.clients++; }
            r.money += Number(i.subtotal) || 0;
            r.share += itemShare(i, i.qty);
        });
    });
    return Object.values(by).sort((a, b) => b.money - a.money);
}
function renderDashBarbers() {
    const box = $('dashBarbers'); if (!box) return;
    if (!isBarberMode() || !isAdmin()) { box.innerHTML = ''; return; }
    const R = barberDay(S.todaySales || []);
    R.forEach(r => {
        const x = (barbersAll().find(y => y.id === r.uid)) || {};
        r.salary = payOf(x).type === 'salary';
        r.share = r.salary ? 0 : earnedBy(x, { money: r.money, shares: r.share, days: r.clients ? 1 : 0, months: 0 });
    });
    const t = R.reduce((a, r) => ({ c: a.c + r.clients, m: a.m + r.money, s: a.s + r.share }), { c: 0, m: 0, s: 0 });
    box.innerHTML = `<div class="dash-barbers">
        <div class="db-head"><span>💈 ${tl('Barbers today')}</span><button class="link-btn" style="margin:0;" onclick="switchTab('barbers')">${tl('See all')} →</button></div>
        <div class="db-row db-cols"><span></span><span>${tl('Clients')}</span><span>${tl('Money')}</span><span>${tl('Their share')}</span></div>
        ${R.length ? R.map(r => `<div class="db-row"><b class="notr">${esc(r.name)}</b><span>${r.clients}</span><span>${n0(r.money)}</span><span class="db-share">${r.salary ? `<small>${tl('Salary')}</small>` : n0(r.share)}</span></div>`).join('')
            : `<div class="hint gray" style="margin:6px 0 0;">${tl('No clients yet today.')}</div>`}
        ${R.length ? `<div class="db-row db-total"><b>${tl('Total')}</b><span>${t.c}</span><span>${n0(t.m)}</span><span class="db-share">${n0(t.s)}</span></div>
        <div class="db-keep">${tl('You keep')} <b>${n0(t.m - t.s)}</b></div>` : ''}
    </div>`;
}

// Words that change in a barbershop
const stockWord = () => isBarberMode() ? 'Supplies bought' : 'Stock bought';
const roleWord = r => r === 'admin' ? 'Admin' : isBarberMode() ? 'Front desk' : 'Seller';

// ════════════════════════════════════════════════
//  PROFIT IN A BARBERSHOP
//  Profit = money in − what the barbers earned − other expenses.
//  Barbers paid per service, by percentage or chair rent: what they earn
//  is a cost the day they work; paying them later is not counted again.
//  Salaried barbers: their salary is an ordinary expense when paid.
// ════════════════════════════════════════════════
function barberCut(sales, entries) {
    if (!isBarberMode()) return { cost: 0, paidOut: 0 };
    const staff = barbersAll().map(b => ({ uid: b.id, name: b.name, pay: b.pay }));
    const keep = S.spRange; S.spRange = {};
    const rows = staffPayRows(sales || [], entries || [], staff);
    S.spRange = keep;
    let cost = 0, paidOut = 0;
    rows.forEach(r => { if (r.pay.type === 'salary') return; cost += r.earned; paidOut += r.paid; });
    return { cost, paidOut };
}
const barberProfit = (x, cut) => x.sales - x.supplier - (x.expense - cut.paidOut) - cut.cost;

// The month's clients and payments, loaded once (owner, online) and kept fresh with today's live sales
S.bm = {};
async function loadBarberMonth(m, force) {
    if (!isBarberMode() || !isAdmin() || !navigator.onLine) return;
    const c = S.bm[m];
    if (c && (c.loading || (!force && Date.now() - c.at < 5 * 60e3))) return;
    S.bm[m] = { ...(c || {}), loading: true, at: Date.now() };
    try {
        const [s, e] = await Promise.all([col('sales').where('month', '==', m).get(), col('entries').where('month', '==', m).get()]);
        S.bm[m] = { sales: s.docs.map(d => ({ id: d.id, ...d.data() })), entries: e.docs.map(d => ({ id: d.id, ...d.data() })), at: Date.now() };
    } catch (err) { S.bm[m] = { ...(c || {}), at: Date.now() }; }
    renderDashboard();
}
function barberMonthData(m) {
    const c = S.bm[m]; if (!c || !c.sales) return null;
    const today = dayStr();
    const sales = m === today.slice(0, 7) ? c.sales.filter(s => s.day !== today).concat(S.todaySales || []) : c.sales;
    return { sales, entries: c.entries || [] };
}
// Called by monthFig: puts the barbers' earnings into the month's profit
function barberMonthAdjust(m, f) {
    if (!isBarberMode()) return;
    const d = barberMonthData(m);
    if (!d) { loadBarberMonth(m); f.barbersPending = true; return; }
    const cut = barberCut(d.sales, d.entries);
    f.barbers = cut.cost; f.barberPaid = cut.paidOut; f.otherExpense = f.expense - cut.paidOut;
    f.profit = barberProfit(f, cut);
}
function barberDayCut(day) {
    const d = barberMonthData(day.slice(0, 7));
    if (!d) { loadBarberMonth(day.slice(0, 7)); return { cost: 0, paidOut: 0 }; }
    return barberCut(d.sales.filter(s => s.day === day), d.entries.filter(e => e.day === day));
}

// ════════════════════════════════════════════════
//  PICK SEVERAL SERVICES AT ONCE
//  Tap services to tick them, then Next → who did it (once) → pay.
// ════════════════════════════════════════════════
S.qsSel = [];
function toggleSvc(id) {
    const p = productById(id); if (!p) return;
    if (!isService(p) && (Number(p.stock) || 0) <= 0) return toast(`⚠️ ${p.name} — ${tl('none left')}`, 'err');
    const i = S.qsSel.indexOf(id);
    if (i >= 0) S.qsSel.splice(i, 1); else S.qsSel.push(id);
    navigator.vibrate?.(15);
    renderPOS();
}
function renderSvcBar() {
    let bar = $('svcBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'svcBar'; bar.className = 'svc-bar'; $('page-pos').appendChild(bar); }
    S.qsSel = S.qsSel.filter(id => productById(id));
    const on = isBarberMode() && S.qsSel.length > 0 && $('page-pos').classList.contains('active');
    bar.classList.toggle('show', on);
    if (!on) return;
    const total = S.qsSel.reduce((a, id) => a + (Number(productById(id).sellPrice) || 0), 0);
    bar.innerHTML = `<button class="sb-clear" onclick="S.qsSel=[];renderPOS()">✕</button>
        <div class="sb-info"><b>${S.qsSel.length} ${tl(S.qsSel.length === 1 ? 'chosen' : 'chosen')}</b><small>${fmt(total)}</small></div>
        <button class="sb-next" onclick="qsNext()">${tl('Next')} →</button>`;
}
async function qsNext() {
    if (S.qsOpen || !S.qsSel.length) return;
    const ids = S.qsSel.slice();
    S.cart = {}; S.lineMeta = {}; S.saleDisc = null; S.saleCustomer = null; S.payTouched = false;
    const svcs = ids.filter(id => isService(productById(id)));
    let who = null;
    if (svcs.length) {
        who = await askWho(productById(svcs[0]), svcs.length > 1 ? svcs.length : 0);
        if (!who) { S.cart = {}; S.lineMeta = {}; return; }
        S.lastDoer = who;
    }
    ids.forEach(id => { S.cart[id] = 1; if (isService(productById(id))) meta(id).by = who; });
    S.qsSel = [];
    renderPOS();
    qsPay();
}

// ════════════════════════════════════════════════
//  PAY THE BARBERS BEFORE CLOSING THE DAY
//  Barbers on commission, percentage, a fixed amount per service or chair rent
//  are paid what they earned today before the day can be closed.
//  Salaried barbers never appear here — only the owner pays them (Barbers → Pay).
// ════════════════════════════════════════════════
async function barbersOwedToday() {
    if (!isBarberMode()) return [];
    const today = dayStr();
    let entries = [];
    try {
        const q = isAdmin() ? col('entries').where('day', '==', today) : col('entries').where('staffUid', '==', S.me.uid).where('day', '==', today);
        entries = (await q.get()).docs.map(d => d.data());
    } catch (e) {}
    const list = barbersAll().filter(b => b.active !== false && payOf(b).type !== 'salary' && payOf(b).every === 'day');
    const ids = new Set(list.map(b => b.id));
    const keep = S.spRange; S.spRange = {};
    const rows = staffPayRows(S.todaySales || [], entries, list.map(b => ({ uid: b.id, name: b.name, pay: b.pay })));
    S.spRange = keep;
    return rows.filter(r => ids.has(r.p.uid) && (r.clients > 0 || r.earned > 0 || r.paid > 0));
}
// Shows the list; resolves true once everyone is paid (or nobody is owed)
async function payBarbersToday(forClosing, what) {
    const rows = await barbersOwedToday();
    // services sold today with no "barber gets" amount, done by a barber paid per service
    const perSvc = new Set(barbersAll().filter(b => payOf(b).type === 'service').map(b => b.id));
    const noShare = [...new Set((S.todaySales || []).filter(s => s.kind === 'pos' && !s.voided).flatMap(s => s.items || [])
        .filter(i => i.service && perSvc.has(i.by) && !(Number(i.share) > 0) && !(Number((productById(i.productId) || {}).staffPay) > 0)).map(i => i.name))];
    if (!rows.some(r => r.owed > 0) && !noShare.length && forClosing) return true;
    return new Promise(resolve => {
        const o = document.createElement('div'); o.id = 'payTodayBox';
        o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9997;display:flex;align-items:flex-end;justify-content:center;';
        const draw = () => {
            const left = rows.filter(r => r.owed > 0);
            o.innerHTML = `<div class="qs-card" style="max-height:88vh;overflow:auto;">
                <div class="qs-confirm-title">💈 ${tl('Pay barbers for today')}</div>
                ${noShare.length ? `<div class="hint amber" style="margin:4px 0 8px;">⚠️ ${tl('No "barber gets" amount on')}: <b class="notr">${noShare.map(esc).join(', ')}</b>. ${tl(isAdmin() ? 'Set it in Services, then come back.' : 'Ask the owner to set it in Services.')}</div>` : ''}
                <div class="hint gray" style="margin:4px 0 10px;">${tl(!forClosing ? 'Barbers paid daily — what they earned today. Weekly, monthly and salaried barbers are paid by the owner.' : what === 'shift' ? 'Pay each barber paid daily what they earned today before ending the shift. Weekly, monthly and salaried barbers are paid by the owner.' : 'Pay each barber paid daily what they earned today before closing the day. Weekly, monthly and salaried barbers are paid by the owner.')}</div>
                ${rows.length ? rows.map((r, i) => `<div class="pt-row ${r.owed > 0 ? '' : 'done'}">
                    <div class="pt-top"><b class="notr">${esc(r.p.name)}</b><small>${esc(payLabel(r.p))}</small></div>
                    <div class="pt-nums"><span>${tl('Clients')} <b>${r.clients}</b></span><span>${tl('Earned')} <b>${n0(r.earned)}</b></span><span>${tl('Paid')} <b>${n0(r.paid)}</b></span></div>
                    ${r.owed > 0 ? `<div class="pt-pay"><span>${tl('To pay')} <b>${fmt(r.owed)}</b></span>
                        <button data-a="cash" data-i="${i}" style="background:var(--pos);">💵 ${tl('Cash')}</button><button data-a="mobile" data-i="${i}" style="background:#1a56db;">📱 ${tl('Mobile')}</button></div>`
                        : `<div class="pt-ok">✅ ${tl('Paid')}</div>`}
                </div>`).join('') : `<div class="hint gray">${tl('No barber earnings today.')}</div>`}
                ${forClosing ? `<button class="qs-ok" data-a="go" ${left.length ? 'disabled style="opacity:.45;"' : ''}>${left.length ? tl('Pay everyone first') : '✅ ' + tl(what === 'shift' ? 'Continue to end the shift' : 'Continue closing the day')}</button>` : ''}
                ${isAdmin() && noShare.length ? `<button class="qs-cancel" data-a="svc" style="color:var(--blue);">✂️ ${tl('Open Services')}</button>` : ''}
                <button class="qs-cancel" data-a="x">${tl(forClosing ? 'Cancel' : 'Close')}</button></div>`;
        };
        draw(); document.body.appendChild(o);
        o.addEventListener('click', async e => {
            const t = e.target.closest('[data-a]'); if (!t) return;
            const a = t.dataset.a;
            if (a === 'x') { o.remove(); return resolve(false); }
            if (a === 'svc') { o.remove(); closeModals(); switchTab('services'); return resolve(false); }
            if (a === 'go') { if (rows.some(r => r.owed > 0)) return; o.remove(); return resolve(true); }
            if (a === 'cash' || a === 'mobile') {
                const r = rows[+t.dataset.i]; if (!r || !(r.owed > 0)) return;
                if (!canExpense()) return toast('⚠️ ' + tl('The owner must allow Expenses for front desk, so you can pay barbers.'), 'err');
                o.style.display = 'none';
                const yes = await showConfirm(`${tl('Pay')} <b class="notr">${esc(r.p.name)}</b> <b>${fmt(r.owed)}</b> ${a === 'cash' ? '💵 ' + tl('from the drawer') : '📱 ' + tl('by mobile money')}?`, tl('Pay'), 'var(--pos)');
                o.style.display = 'flex';
                if (!yes) return;
                const amount = r.owed, b = db.batch();
                writeEntries(b, [{ type: 'expense', category: 'Salaries', from: a, to: null, amount, payee: r.p.uid, payeeName: r.p.name, note: `Pay ${r.p.name} · ${dayStr()}`, day: dayStr() }]);
                commit(b, `✅ ${tl('Paid')} ${r.p.name} ${n0(amount)}`, { label: `Barber pay ${r.p.name} ${n0(amount)}` });
                r.paid += amount; r.owed = 0;
                if (S.bm) delete S.bm[dayStr().slice(0, 7)];
                draw();
            }
        });
    });
}
