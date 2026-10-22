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
    if (typeof syncCartDock === 'function') syncCartDock();
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
    box.innerHTML = `<div class="sr-head">${tl('Clients today')} · ${list.filter(x => !isCancelled(x)).length}</div>` + (list.length ? list.slice(0, 40).map(s => {
        const what = (s.items || []).map(i => esc(i.name) + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ');
        const who = [...new Set((s.items || []).filter(i => i.by).map(i => i.byName || staffName(i.by)))].map(esc).join(', ');
        const gone = isCancelled(s), canUndo = !gone && (isAdmin() || canReturn());
        return `<div class="bt-row ${gone ? 'cancelled' : ''}"><span class="bt-time">${time(s)}</span>
            <span class="bt-what"><b class="notr">${what}</b>${who ? `<small>✂️ <span class="notr">${who}</span></small>` : ''}</span>
            <span class="bt-amt">${n0(s.total)}<small>${gone ? tl('Cancelled') : s.mobile > 0 && !s.cash ? '📱' : s.cash > 0 && !s.mobile ? '💵' : '💵📱'}</small></span>
            ${gone ? '' : `<button class="bt-rcpt" onclick="S.saleCache['${s.id}']=(S.todaySales||[]).find(x=>x.id==='${s.id}');receiptMenu(S.saleCache['${s.id}'])" title="${tl('Receipt')}">🧾</button>`}
            ${canUndo ? `<button class="bt-undo" onclick="cancelClient('${s.id}')" title="${tl('Cancel')}">↩️</button>` : ''}</div>`;
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
            const mine = liveItems(s).filter(i => i.service && i.by === x.uid);
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
        liveItems(s).filter(i => i.service && i.by).forEach(i => {
            const r = by[i.by] = by[i.by] || { uid: i.by, name: i.byName || staffName(i.by) || '?', clients: 0, money: 0, share: 0 };
            if (!seen.has(i.by)) { seen.add(i.by); r.clients++; }
            r.money += Number(i.subtotal) || 0;
            r.share += itemShare(i, i.qty);
        });
    });
    return Object.values(by).sort((a, b) => b.money - a.money);
}
function renderDashBarbers() {
    renderBarberSetup();
    renderPayDue();
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
// ════════════════════════════════════════════════
//  PROFIT (every shop)
//  Profit = sales − cost of the goods sold − expenses (− what barbers earned).
//  Buying stock is not a cost until the goods are sold: it is shown on its own.
//  Cost of goods = each item's cost price × the quantity sold.
//  Returns put back on the shelf take their cost off again.
// ════════════════════════════════════════════════
function cogsOf(sales) {
    let cogs = 0; const missing = {};
    (sales || []).forEach(s => {
        if (s.voided) return;
        const ret = s.kind === 'return';
        (s.items || []).forEach(i => {
            if (i.service) return;
            const p = productById(i.productId);
            if (p && isService(p)) return;
            if (!i.productId && !p) return;
            if (ret && i.restock === false) return;
            const q = Number(i.qty) || 0, c = lineCost(i, tms(s.createdAt) || Date.parse((s.day || dayStr()) + 'T23:59:59'));
            if (c == null) { if (!ret) missing[i.name || '?'] = (missing[i.name || '?'] || 0) + q; return; }
            cogs += (ret ? -1 : 1) * c;
        });
    });
    return { cogs: Math.round(cogs), missing: Object.keys(missing) };
}
// x = dayFig/monthFig figures; sales/entries = the same period's records
function fullProfit(x, sales, entries) {
    const cut = barberCut(sales, entries), otherExpense = x.expense - cut.paidOut;
    // Barbershop: supplies (shampoo, blades…) are used up, so they count when bought
    if (isBarberMode()) return { cogs: 0, missing: [], supplies: x.supplier || 0, barbers: cut.cost, barberPaid: cut.paidOut, otherExpense,
        profit: x.sales - (x.supplier || 0) - otherExpense - cut.cost };
    const g = cogsOf(sales);
    return { cogs: g.cogs, missing: g.missing, barbers: cut.cost, barberPaid: cut.paidOut, otherExpense,
        profit: x.sales - g.cogs - otherExpense - cut.cost };
}
// Kept for older callers
const barberProfit = (x, cut) => x.sales - (x.cogs || 0) - (x.expense - cut.paidOut) - cut.cost;

// ── Barbershop: the month's clients and payments, loaded once a day (owner, online) and kept fresh with today's live sales ──
S.bm = {};
async function loadBarberMonth(m, force) {
    if (!isAdmin() || !navigator.onLine) return;
    const c = S.bm[m], today = dayStr();
    if (c && c.loading) return c.loading;
    if (c && !force && c.sales && c.day === today) return;          // already have it today
    if (c && !force && !c.sales && Date.now() - c.at < 60e3) return; // failed a moment ago
    let done; const wait = new Promise(r => done = r);
    S.bm[m] = { ...(c || {}), loading: wait, at: Date.now() };
    try {
        const [s, e] = await Promise.all([col('sales').where('month', '==', m).get(), col('entries').where('month', '==', m).get()]);
        S.bm[m] = { sales: s.docs.map(d => ({ id: d.id, ...d.data() })), entries: e.docs.map(d => ({ id: d.id, ...d.data() })), at: Date.now(), day: today };
    } catch (err) { S.bm[m] = { ...(c || {}), loading: null, at: Date.now() }; }
    done(); afterMonthLoad();
}
function barberMonthData(m) {
    const c = S.bm[m]; if (!c || !c.sales) return null;
    const today = dayStr();
    const sales = m === today.slice(0, 7) ? c.sales.filter(s => s.day !== today).concat(S.todaySales || []) : c.sales;
    return { sales, entries: c.entries || [] };
}
function afterMonthLoad() {
    renderDashboard();
    if ($('sheetMonth') && $('sheetMonth').classList.contains('active')) renderMonthHistory();
}

// ── Shop: cost of goods per day, worked out once and remembered ──
// Each finished day's cost of goods is saved on the month record (months/{m}.pd), so opening Keep
// does not read every sale again. A day is worked out again if its sales total changes (e.g. a void).
// Today is always worked out live from today's sales.
S.dayCalc = {}; S.dayLoading = {};
function shopDayCalc(d) {
    const today = dayStr();
    if (d === today) { const g = cogsOf(S.todaySales || []); return { c: g.cogs, m: g.missing }; }
    const sv = Math.round(dayFig(d).sales || 0), ok = c => c && Math.round(c.s) === sv;
    const mem = S.dayCalc[d]; if (ok(mem)) return mem;
    const st = ((S.months[d.slice(0, 7)] || {}).pd || {})[d]; if (ok(st)) return st;
    return null;
}
function monthDays(m) { return Object.keys(S.days).filter(d => d.slice(0, 7) === m && d <= dayStr()); }
// Reads the sales of the days not worked out yet (one day at a time, or the whole month when many are missing)
function ensureShopDays(days) {
    days = days.filter(d => d < dayStr() && !shopDayCalc(d));
    if (!days.length || !isAdmin() || !navigator.onLine) return Promise.resolve();
    const key = days.join(','); if (S.dayLoading[key]) return S.dayLoading[key];
    const byMonth = {}; days.forEach(d => (byMonth[d.slice(0, 7)] = byMonth[d.slice(0, 7)] || []).push(d));
    const job = (async () => {
        try {
            for (const [m, ds] of Object.entries(byMonth)) {
                const snaps = ds.length > 3 ? [await col('sales').where('month', '==', m).get()] : await Promise.all(ds.map(d => col('sales').where('day', '==', d).get()));
                const all = snaps.flatMap(sn => sn.docs.map(x => ({ id: x.id, ...x.data() })));
                const save = {};
                ds.forEach(d => {
                    const g = cogsOf(all.filter(x => x.day === d));
                    const calc = { s: Math.round(dayFig(d).sales || 0), c: g.cogs, m: g.missing.slice(0, 10) };
                    S.dayCalc[d] = calc; save[d] = calc;
                });
                col('months').doc(m).set({ month: m, pd: save }, { merge: true }).catch(() => {});
            }
        } catch (e) { /* offline or no permission: try again later */ }
        delete S.dayLoading[key];
        afterMonthLoad();
    })();
    return (S.dayLoading[key] = job);
}
function shopMonthAdjust(m, f) {
    const days = monthDays(m), calcs = days.map(shopDayCalc);
    const need = days.filter((d, i) => !calcs[i]);
    if (need.length) { ensureShopDays(need); f.pending = true; return; }
    const missing = [...new Set(calcs.flatMap(c => c.m || []))];
    const cogs = calcs.reduce((a, c) => a + (Number(c.c) || 0), 0);
    Object.assign(f, { cogs, missing, barbers: 0, barberPaid: 0, otherExpense: f.expense, profit: f.sales - cogs - f.expense });
}

// Called by monthFig: works out the month's real profit
function barberMonthAdjust(m, f) {
    if (!isBarberMode()) return shopMonthAdjust(m, f);
    const d = barberMonthData(m);
    if (!d) { loadBarberMonth(m); f.barbersPending = true; f.pending = true; return; }
    Object.assign(f, fullProfit(f, d.sales, d.entries));
}
// Month figures with real profit; waits for what is missing when online
async function monthFigFull(m) {
    try {
        if (isBarberMode()) { if (!barberMonthData(m)) await loadBarberMonth(m, true); }
        else await ensureShopDays(monthDays(m));
    } catch (e) {}
    return monthFig(m);
}
// One day's profit (null while it is still being worked out)
function dayProfit(day, x) {
    x = x || dayFig(day);
    if (!isBarberMode()) {
        const c = shopDayCalc(day); if (!c) { ensureShopDays([day]); return null; }
        return { cogs: c.c || 0, missing: c.m || [], barbers: 0, barberPaid: 0, otherExpense: x.expense, profit: x.sales - (c.c || 0) - x.expense };
    }
    const d = barberMonthData(day.slice(0, 7));
    if (!d) { loadBarberMonth(day.slice(0, 7)); return null; }
    return fullProfit(x, d.sales.filter(s => s.day === day), d.entries.filter(e => e.day === day));
}
async function dayProfitFull(day, x) {
    try {
        if (isBarberMode()) { if (!barberMonthData(day.slice(0, 7))) await loadBarberMonth(day.slice(0, 7), true); }
        else await ensureShopDays([day]);
    } catch (e) {}
    return dayProfit(day, x);
}
function barberDayCut(day) {
    const d = barberMonthData(day.slice(0, 7));
    if (!d) { loadBarberMonth(day.slice(0, 7)); return { cost: 0, paidOut: 0 }; }
    return barberCut(d.sales.filter(s => s.day === day), d.entries.filter(e => e.day === day));
}
const costWord = () => isBarberMode() ? tl(stockWord()) : tl('Cost of goods sold');
const costOf = f => isBarberMode() ? (f.supplies != null ? f.supplies : f.supplier || 0) : (f.cogs || 0);
// Short warning when items were sold with no cost price (profit would look too high)
function missingCostNote(missing) {
    if (!missing || !missing.length) return '';
    const names = missing.slice(0, 3).join(', ') + (missing.length > 3 ? ' +' + (missing.length - 3) : '');
    return tl('No cost price for') + ': ' + names + ' — ' + tl('profit may look too high');
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
                        : r.earned > 0 || r.paid > 0 ? `<div class="pt-ok">✅ ${tl('Paid')}</div>` : `<div class="pt-ok" style="color:var(--gray);">${tl('Nothing to pay yet')}</div>`}
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

// ── First steps for a new barbershop (owner) ──
function renderBarberSetup() {
    const box = $('barberSetup'); if (!box) return;
    const svcs = S.products.filter(isService), barbers = barbersAll().filter(b => b.active !== false);
    const noShare = svcs.filter(p => !(Number(p.staffPay) > 0) && p.staffPay !== 0);
    const steps = [
        [svcs.length > 0, '✂️', 'Add your services and prices', "services"],
        [barbers.length > 0, '💈', 'Add your barbers and how they are paid', 'barbers'],
        [(S.todaySales || []).length > 0 || Object.keys(S.days || {}).length > 0, '✅', 'Record your first client on Today', 'pos']
    ];
    const done = steps.filter(x => x[0]).length;
    if (!isBarberMode() || !isAdmin() || done === steps.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="setup-card"><div class="setup-head">🚀 ${tl('Set up your barbershop')} <span>${done}/${steps.length}</span></div>
        ${steps.map(([ok, ic, t, tab], k) => `<button class="setup-step ${ok ? 'ok' : ''}" onclick="switchTab('${tab}')"><span class="ss-n">${ok ? '✓' : k + 1}</span><span>${ic} ${tl(t)}</span><span class="ss-go">${ok ? '' : '→'}</span></button>`).join('')}<a class="setup-guide" href="help.html?m=barbershop&lang=${KeepLang.lang === 'sw' ? 'sw' : 'en'}">📘 ${tl('Read the barbershop guide')}</a></div>`;
}

// ════════════════════════════════════════════════
//  CANCEL A CLIENT (a mistake at the till)
//  Recorded as a full return of that visit: the money goes back the way it was
//  paid, the barber's share comes off, products go back on the shelf.
//  Front desk can do it for today's clients when the owner allows it.
// ════════════════════════════════════════════════
// The items of a sale minus anything already given back
function liveItems(s) {
    const back = s.returned || {};
    return (s.items || []).map((i, k) => {
        const q = q3((Number(i.qty) || 0) - (Number(back[k]) || 0));
        if (q <= 0) return null;
        const f = q / (Number(i.qty) || 1);
        return { ...i, qty: q, subtotal: Math.round((Number(i.subtotal) || 0) * f), ...(Number(i.share) > 0 ? { share: Math.round(i.share * f) } : {}) };
    }).filter(Boolean);
}
const isCancelled = s => (s.items || []).length > 0 && liveItems(s).length === 0;

async function cancelClient(id) {
    const s = (S.todaySales || []).find(x => x.id === id);
    if (!s || s.kind !== 'pos' || s.voided || isCancelled(s)) return;
    if (!isAdmin() && !canReturn()) return toast('⚠️ ' + tl('The owner has not allowed front desk to cancel clients (Settings → Permissions).'), 'err');
    if (s.day !== dayStr() && !isAdmin()) return toast('⚠️ ' + tl('Only today\'s clients can be cancelled here.'), 'err');
    const done = s.returned || {}, gross = (s.items || []).reduce((a, i) => a + (Number(i.subtotal) || 0), 0), f = gross ? (Number(s.total) || 0) / gross : 1;
    const picked = (s.items || []).map((i, k) => ({ k, i, qty: q3((Number(i.qty) || 0) - (done[k] || 0)) })).filter(x => x.qty > 0);
    const refund = Math.round(picked.reduce((a, x) => a + x.qty * (Number(x.i.unitPrice) || 0) * f, 0));
    const paid = (Number(s.cash) || 0) + (Number(s.mobile) || 0);
    const cash = paid > 0 ? Math.round(refund * (Number(s.cash) || 0) / paid) : refund, mobile = refund - cash;
    const who = [...new Set(picked.filter(x => x.i.by).map(x => x.i.byName || staffName(x.i.by)))].join(', ');
    const howTxt = [cash ? `💵 ${tl('Cash')} <b>${n0(cash)}</b>` : '', mobile ? `📱 ${tl('Mobile')} <b>${n0(mobile)}</b>` : ''].filter(Boolean).join(' + ');
    if (!await showConfirm(`${tl('Cancel this client?')}<br><br><b class="notr">${picked.map(x => esc(x.i.name)).join(', ')}</b>${who ? `<br>✂️ <span class="notr">${esc(who)}</span>` : ''}<br><br>${tl('Give back')} ${howTxt}`, tl('Cancel client'), 'var(--red)')) return;
    const day = dayStr(), ref = col('sales').doc(), b = db.batch(), why = src('sales', ref.id);
    const receiptNo = 'RT' + day.slice(2).replace(/-/g, '') + '-' + ref.id.slice(0, 4).toUpperCase();
    const items = picked.map(x => ({ productId: x.i.productId, name: x.i.name, emoji: x.i.emoji || '', unit: x.i.unit || 'pc', qty: x.qty,
        unitPrice: Math.round((Number(x.i.unitPrice) || 0) * f), subtotal: Math.round(x.qty * (Number(x.i.unitPrice) || 0) * f), serials: [], restock: !x.i.service && !!productById(x.i.productId),
        ...(x.i.service ? { service: true } : {}), ...(x.i.by ? { by: x.i.by, byName: x.i.byName || '' } : {}) }));
    b.set(ref, { kind: 'return', refOf: s.id, refReceipt: s.receiptNo || '', items, serials: [], total: refund, cash: -cash, mobile: -mobile, credit: 0,
        customer: null, reason: 'Client cancelled at the till', receiptNo, day, month: day.slice(0, 7), voided: false, staffUid: S.me.uid, staffName: S.me.name, createdAt: now() });
    const saleUp = { returnedTotal: inc(refund), updatedAt: now() };
    picked.forEach(x => saleUp['returned.' + x.k] = inc(x.qty));
    b.update(col('sales').doc(s.id), saleUp);
    items.filter(i => i.restock).forEach(i => {
        const mv = col('movements').doc();
        b.update(col('products').doc(i.productId), { stock: inc(i.qty), src: src('movements', mv.id), updatedAt: now() });
        b.set(mv, { productId: i.productId, name: i.name, type: 'return', qty: i.qty, saleId: ref.id, day, staffUid: S.me.uid, staffName: S.me.name, createdAt: now() });
    });
    const dayUp = { day, month: day.slice(0, 7), sales: inc(-refund), returns: inc(refund), src: why, updatedAt: now() };
    if (cash) dayUp.cash = inc(-cash);
    if (mobile) dayUp.mobile = inc(-mobile);
    b.set(col('days').doc(day), dayUp, { merge: true });
    b.set(col('meta').doc('balances'), { cash: inc(-cash), mobile: inc(-mobile), src: why, updatedAt: now() }, { merge: true });
    // show it straight away on this phone
    s.returned = { ...(s.returned || {}) }; picked.forEach(x => s.returned[x.k] = (s.returned[x.k] || 0) + x.qty);
    commit(b, `↩️ ${tl('Client cancelled')} · ${fmt(refund)} ${tl('given back')}`, { label: `Cancel ${s.receiptNo || ''} · ${fmt(refund)}` });
    if (S.bm) delete S.bm[day.slice(0, 7)];
    renderBarberToday(); renderPosStrip();
}

// ════════════════════════════════════════════════
//  BARBER PAY DUE — reminders for the owner
//  Weekly: due 7 days after their last payment (or their first client).
//  Monthly and salary: due from the last day of the month until paid.
// ════════════════════════════════════════════════
function barberPayDue() {
    if (!isBarberMode() || !isAdmin()) return null;
    const today = dayStr(), m = today.slice(0, 7), pm = prevMonth(m);
    const cur = barberMonthData(m), prev = barberMonthData(pm);
    if (!cur) { loadBarberMonth(m); return null; }
    if (!prev) { loadBarberMonth(pm); return null; }
    const last = new Date(today + 'T12:00:00'); const lastDay = new Date(last.getFullYear(), last.getMonth() + 1, 0).getDate() === last.getDate();
    const dayOfMonth = +today.slice(8, 10);
    const sales = prev.sales.concat(cur.sales), entries = prev.entries.concat(cur.entries);
    const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
    const out = [];
    barbersAll().filter(b => b.active !== false).forEach(b => {
        const pay = payOf(b); if (pay.every === 'day' && pay.type !== 'salary') return;
        const one = [{ uid: b.id, name: b.name, pay: b.pay }];
        const rowFor = (sl, en, months) => { const keep = S.spRange; S.spRange = {}; const r = staffPayRows(sl, en, one).find(x => x.p.uid === b.id); S.spRange = keep; if (pay.type === 'salary') { r.earned = pay.rate * months; r.owed = r.earned - r.paid; } return r; };
        if (pay.every === 'week') {
            const paidDays = entries.filter(e => e.payee === b.id && e.type === 'expense').map(e => e.day).sort();
            const workDays = sales.filter(s => s.kind === 'pos' && !s.voided && liveItems(s).some(i => i.by === b.id)).map(s => s.day).sort();
            const since = paidDays.length ? paidDays[paidDays.length - 1] : workDays[0];
            if (!since) return;
            const r = rowFor(sales, entries, 0);   // what they earned minus what they were paid, over the last two months
            if (r.owed > 0 && daysBetween(since, today) >= 7) out.push({ b, r, why: `${tl('Weekly')} · ${daysBetween(since, today)} ${tl('days since last pay')}` });
        } else {
            // monthly (or salary): this month on its last day; last month in the first days of the new month
            if (lastDay) { const r = rowFor(cur.sales, cur.entries, 1); if (r.owed > 0) out.push({ b, r, why: `${tl('Monthly')} · ${monthName(m)}` }); }
            else if (dayOfMonth <= 10) {
                const r = rowFor(prev.sales, prev.entries.concat(cur.entries.filter(e => +e.day.slice(8, 10) <= 10)), 1);
                if (r.owed > 0) out.push({ b, r, why: `${tl('Monthly')} · ${monthName(pm)}`, forMonth: pm });
            }
        }
    });
    return out;
}
function renderPayDue() {
    const box = $('payDue'); if (!box) return;
    const due = barberPayDue() || [];
    const badge = $('tab-barbers');
    if (badge) { let n = badge.querySelector('.tab-badge'); if (!n) { n = document.createElement('span'); n.className = 'tab-badge'; badge.appendChild(n); } n.textContent = due.length || ''; n.style.display = due.length ? 'flex' : 'none'; }
    S.payDue = due;
    box.innerHTML = due.length ? `<div class="due-card"><div class="db-head"><span>💵 ${tl('Barber pay due')}</span></div>
        ${due.map((d, i) => `<div class="due-row"><div style="flex:1;"><b class="notr">${esc(d.b.name)}</b><small>${esc(d.why)}</small></div><b>${fmt(d.r.owed)}</b><button class="due-pay" onclick="payDue(${i})">${tl('Pay')}</button></div>`).join('')}</div>` : '';
}
async function payDue(i) {
    const d = (S.payDue || [])[i]; if (!d) return;
    const v = await askValue(`${tl('Pay')} <b class="notr">${esc(d.b.name)}</b><br><span style="font-size:.78rem;color:#6b7280;">${esc(d.why)}</span>`, String(d.r.owed), tl('Next'), { value: String(d.r.owed) });
    if (v === null) return;
    const amount = Math.round(num(v)); if (!(amount > 0)) return toast('⚠️ ' + tl('Enter an amount.'), 'err');
    const from = await choose(`${tl('Pay')} ${n0(amount)} ${tl('from')}`, [['cash', '💵 ' + tl('Cash'), '#0b0d12'], ['mobile', '📱 Lipa kwa Simu', '#1a56db'], ['bank', '🏦 ' + tl('Bank'), '#1a56db']]);
    if (!from) return;
    const b = db.batch();
    writeEntries(b, [{ type: 'expense', category: 'Salaries', from, to: null, amount, payee: d.b.id, payeeName: d.b.name, note: `Pay ${d.b.name} · ${d.why}`, day: dayStr(), ...(d.forMonth ? { payFor: d.forMonth } : {}) }]);
    await commit(b, `✅ ${tl('Paid')} ${d.b.name} ${n0(amount)}`, { label: `Barber pay ${d.b.name} ${n0(amount)}` });
    delete S.bm[dayStr().slice(0, 7)];
    renderDashboard();
}
