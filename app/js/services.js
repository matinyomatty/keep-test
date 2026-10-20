// Keep till — services and staff pay (barbershops, salons, and any shop that sells services).
// A service is an item with no stock. Each service on a sale records who did it, so the owner
// sees every barber's clients and takings, and what each has earned from the share set on each service.
// Part of app/index.html; the parts load in order and share one global scope.

const isService = p => !!(p && p.service);
const isServiceShop = () => (S.tenantInfo || {}).type === 'barbershop' || S.products.some(isService);
// "Barber gets X" is set on each service. Each barber has one pay method:
//   service — earns the "barber gets" amount of every service they do (the default)
//   percent — earns a % of the money they bring in
//   salary  — a fixed monthly salary; Keep just counts their clients
//   rent    — keeps their takings and pays the shop chair rent per day worked
const shareOf = (p, qty) => Math.round((Number((p || {}).staffPay) || 0) * (Number(qty) || 0));
const PAY_TYPES = [
    ['service', 'Per service', 'Gets the "barber gets" amount set on each service'],
    ['percent', 'Percentage', 'Gets a % of the money they bring in'],
    ['salary', 'Salary', 'A fixed monthly salary — Keep counts their clients'],
    ['rent', 'Chair rent', 'Keeps their money and pays the shop rent per day worked']
];
const payOf = x => { const p = (x && x.pay) || {}; return PAY_TYPES.some(t => t[0] === p.type) ? { type: p.type, rate: Number(p.rate) || 0 } : { type: 'service', rate: 0 }; };
const payLabel = x => {
    const { type, rate } = payOf(x);
    return type === 'service' ? tl('Per service') + ' · ' + tl('share set on each service') : type === 'percent' ? `${tl('Percentage')} · ${rate}%`
        : type === 'salary' ? `${tl('Salary')} · ${n0(rate)} / ${tl('month')}` : `${tl('Chair rent')} · ${n0(rate)} / ${tl('day')}`;
};
// What a barber earned from some work: money brought in, service shares, days worked, salary months
function earnedBy(x, w) {
    const { type, rate } = payOf(x);
    return Math.round(type === 'service' ? w.shares : type === 'percent' ? w.money * rate / 100 : type === 'salary' ? rate * (w.months || 0) : w.money - rate * (w.days || 0));
}
async function setStaffPay(uid) {
    const x = (await doersList()).find(y => y.uid === uid) || (S.staff || []).find(y => y.uid === uid); if (!x) return;
    const cur = payOf(x);
    const type = await choose(`${tl('How is this person paid?')}<br><b class="notr">${esc(x.name)}</b>`, PAY_TYPES.map(([k, l, d]) => [k, `${tl(l)}<br><small style="font-weight:500;opacity:.85;">${tl(d)}</small>`, cur.type === k ? '#0b0d12' : '#1a56db']));
    if (!type) return;
    let rate = 0;
    if (type !== 'service') {
        const q = { percent: 'Their share (%)', salary: 'Monthly salary (TZS)', rent: 'Chair rent per day worked (TZS)' }[type];
        const v = await askValue(`<b class="notr">${esc(x.name)}</b><br><span style="font-size:.78rem;color:#6b7280;">${tl(q)}</span>`, type === 'percent' ? 'e.g. 40' : 'e.g. 5000', tl('Save'), { value: cur.type === type && cur.rate ? String(cur.rate) : '' });
        if (v === null) return;
        rate = Math.max(0, num(v));
        if (!(rate > 0)) return toast('⚠️ ' + tl('Enter an amount.'), 'err');
        if (type === 'percent' && rate > 100) return toast('⚠️ ' + tl('A share cannot be more than 100%.'), 'err');
    }
    x.pay = { type, rate };
    if (isBarberMode()) return saveBarbers(barbersAll().map(b => b.id === uid ? { ...b, pay: { type, rate } } : b), '✅ ' + tl('Pay method saved'));
    const b = db.batch();
    b.set(col('staff').doc(uid), { pay: { type, rate }, updatedAt: now() }, { merge: true });
    await commit(b, '✅ ' + tl('Pay method saved'));
}

// Labels and buttons that only make sense when the shop sells services
function applyServiceMode() {
    const on = isServiceShop();
    document.querySelectorAll('.shop-svc').forEach(e => e.classList.toggle('hidden', !on || !isAdmin()));
    document.body.classList.toggle('svc-shop', on);
    applyBarberShell();
}

// ── Staff list (names for "done by") ─────────────────
S.staffAll = null;
async function loadStaffOnce(force) {
    if (S.staffAll && !force) return S.staffAll;
    try {
        const s = await col('staff').get();
        S.staffAll = s.docs.map(d => ({ uid: d.id, ...d.data() })).filter(p => !p.replacedBy && p.active !== false)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) { S.staffAll = S.staffAll || [{ uid: S.me.uid, name: S.me.name }]; }
    return S.staffAll;
}
const staffName = uid => { const b = barbersAll().find(x => x.id === uid); return b ? b.name : ((S.staffAll || []).find(p => p.uid === uid) || (uid === S.me.uid ? S.me : {})).name || ''; };

// ── Barbers: the people who do the services ──
// In a barbershop these are just names with a pay method — no login, no phone needed.
// Logins (Team) are separate: they are for whoever uses the till.
const barbersAll = () => (((S.tenantInfo || {}).settings || {}).barbers) || [];
async function doersList(force) {
    if (isBarberMode()) return barbersAll().filter(b => b.active !== false).map(b => ({ uid: b.id, name: b.name, pay: b.pay, phone: b.phone || '' }));
    return loadStaffOnce(force);
}
function saveBarbers(list, msg) {
    S.tenantInfo.settings = S.tenantInfo.settings || {};
    S.tenantInfo.settings.barbers = list;
    const b = db.batch();
    b.update(tRef(), { 'settings.barbers': list });
    return commit(b, msg);
}

// Who did this service? Sellers default to themselves; the owner picks.
function defaultDoer() { return isBarberMode() ? (S.lastDoer || null) : !isAdmin() ? S.me.uid : (S.lastDoer || null); }
async function pickDoer(id) {
    const list = await doersList();
    const p = productById(id);
    const opts = list.map(x => [x.uid, (meta(id).by === x.uid ? '✓ ' : '') + esc(x.name), meta(id).by === x.uid ? '#0b0d12' : '#1a56db']);
    const k = await choose(`${tl('Who did')} <b>${esc(p ? p.name : '')}</b>?`, opts);
    if (!k) return;
    meta(id).by = k; S.lastDoer = k;
    renderCart();
}

// ── Item form: service on/off ────────────────────────
function serviceChanged() {
    const svc = $('itemService').checked;
    document.querySelectorAll('#sheetItem .goods-only').forEach(e => e.classList.toggle('hidden', svc));
    document.querySelectorAll('#sheetItem .svc-only').forEach(e => e.classList.toggle('hidden', !svc));
    $('sheetItem').classList.toggle('is-svc', svc);
    const bs = isBarberMode() && svc, nameLbl = $('itemName').previousElementSibling, payLbl = $('itemStaffPay').previousElementSibling;
    nameLbl.textContent = bs ? 'Service name' : 'Item name';
    $('itemName').placeholder = bs ? 'e.g. Haircut, Shave, Kids cut' : 'e.g. Samsung 25W charger, Bosch drill, Cement 50kg';
    payLbl.textContent = bs ? 'Barber gets from each one (TZS)' : 'Staff member gets from each one (TZS)';
    $('itemStaffPay').placeholder = 'e.g. 2000';
    shopKeeps();
    if ($('svcPayNote')) $('svcPayNote').classList.toggle('hidden', !bs);
    document.querySelector('#sheetItem .save-bar .primary-cta').textContent = bs ? 'SAVE SERVICE' : 'SAVE ITEM';
    $('itemDeleteBtn').textContent = bs ? 'DELETE SERVICE' : 'DELETE ITEM';
    if (isBarberMode() && svc && !$('itemCat').value) $('itemCat').value = 'Services';
    buildEmojiPicker();
    const editing = !!$('itemId').value;
    $('itemTitle').textContent = svc ? (editing ? 'Edit service' : 'Add a service') : isBarberMode() ? (editing ? 'Edit product' : 'Add a product') : (editing ? 'Edit Item' : 'Add New Item');
    if (isBarberMode() && !svc) {
        nameLbl.textContent = 'Product name'; $('itemName').placeholder = 'e.g. Hair oil, Shampoo, Wax';
        document.querySelector('#sheetItem .save-bar .primary-cta').textContent = 'SAVE PRODUCT';
        $('itemDeleteBtn').textContent = 'DELETE PRODUCT';
        if (!$('itemCat').value) $('itemCat').value = 'Products';
    }
    if ($('itemUnit').value) unitChanged(true);
}

// ── Staff pay & clients screen (owner) ───────────────
function spPreset(k) {
    const t = new Date(dayStr() + 'T12:00:00'), d = new Date(t);
    if (k === 'week') d.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    if (k === 'month') d.setDate(1);
    $('spFrom').value = k === 'today' ? dayStr() : d.toISOString().slice(0, 10);
    $('spTo').value = dayStr();
    loadStaffPay();
}
function openStaffPay() {
    if (!isAdmin()) return;
    openSheet('sheetStaffPay');
    spPreset('week');
}
async function loadStaffPay() {
    const from = $('spFrom').value, to = $('spTo').value, box = $('spBody');
    if (!from || !to || from > to) { box.innerHTML = `<div class="hint amber">${tl('Choose a date range.')}</div>`; return; }
    if (!navigator.onLine) { box.innerHTML = `<div class="hint amber">${tl('This needs internet.')}</div>`; return; }
    box.innerHTML = `<div class="hint gray">${tl('Loading…')}</div>`;
    let sales, entries, staff;
    try {
        [sales, entries, staff] = await Promise.all([
            col('sales').where('day', '>=', from).where('day', '<=', to).get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
            col('entries').where('day', '>=', from).where('day', '<=', to).get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
            doersList(true)
        ]);
    } catch (e) { box.innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; return; }
    S.spRange = { from, to };
    S.spRows = staffPayRows(sales, entries, staff);
    const R = S.spRows.filter(r => r.clients || r.paid || r.pay.type === 'salary');
    const tot = R.reduce((a, r) => ({ takings: a.takings + r.takings, earned: a.earned + r.earned, paid: a.paid + r.paid }), { takings: 0, earned: 0, paid: 0 });
    const unassigned = sales.filter(s => s.kind === 'pos' && !s.voided).reduce((n, s) => n + (s.items || []).filter(i => i.service && !i.by).length, 0);
    const noShare = R.some(r => r.pay.type === 'service') ? S.products.filter(p => isService(p) && !(Number(p.staffPay) > 0)) : [];
    box.innerHTML = (R.length ? R.map((r, i) => {
        const t = r.pay.type;
        const earnedLbl = t === 'service' ? 'Their share (from services)' : t === 'percent' ? `${r.pay.rate}% ${tl('of their money')}` : t === 'salary' ? 'Salary for these dates' : 'Their money minus chair rent';
        return `
        <div class="sum-box" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
                <div><b class="notr">${esc(r.p.name)}</b><div style="font-size:.7rem;color:var(--gray);">${esc(payLabel(r.p))}</div></div>
                <button class="tiny-btn" onclick="setStaffPay('${r.p.uid}').then(loadStaffPay)">✏️ ${tl('Change')}</button>
            </div>
            <div class="sum-row"><span>${tl('Clients')}</span><b>${r.clients}</b></div>
            <div class="sum-row"><span>${tl('Money from their work')}</span><b>${fmt(r.takings)}</b></div>
            ${t === 'rent' ? `<div class="sum-row"><span>${tl('Chair rent')} · ${r.days.size} ${tl('days')} × ${n0(r.pay.rate)}</span><span>−${n0(r.pay.rate * r.days.size)}</span></div>` : ''}
            <div class="sum-row"><span>${tl(earnedLbl)}</span><b>${fmt(r.earned)}</b></div>
            <div class="sum-row"><span>${tl('Already paid')}</span><span>${r.paid ? '−' + n0(r.paid) : '0'}</span></div>
            <div class="sum-row big"><span>${r.owed >= 0 ? tl('Owed to them') : t === 'rent' ? tl('They owe the shop') : tl('Paid too much')}</span><strong style="color:${r.owed > 0 ? 'var(--red)' : 'var(--green)'};">${fmt(Math.abs(r.owed))}</strong></div>
            ${r.owed > 0 ? `<button class="btn-sec wide" style="border-color:var(--green);color:var(--green);margin-top:8px;" onclick="payStaff(${i})">💵 ${tl('Pay')} ${n0(r.owed)}</button>` : ''}
        </div>`; }).join('') : `<div class="hint gray">${tl('No services recorded in these dates.')}</div>`)
        + (noShare.length ? `<div class="hint amber">⚠️ ${tl('No barber share set on')}: <span class="notr">${noShare.map(p => esc(p.name)).join(', ')}</span>. ${tl('Set it in Services.')}</div>` : '')
        + (unassigned ? `<div class="hint amber">⚠️ ${unassigned} ${tl('services were sold without choosing who did them.')}</div>` : '')
        + (R.length ? `<div class="sum-box"><div class="sum-row"><span>${tl('Total money from services')}</span><b>${fmt(tot.takings)}</b></div><div class="sum-row"><span>${tl('Barbers earned')}</span><b>${fmt(tot.earned)}</b></div><div class="sum-row"><span>${tl('Total paid to staff')}</span><b>${fmt(tot.paid)}</b></div></div>` : '');
}
// Works out each person's clients, takings and pay from the sales and payments in the range.
function staffPayRows(sales, entries, staff) {
    const rows = {};
    const row = uid => rows[uid] = rows[uid] || { p: staff.find(x => x.uid === uid) || { uid, name: staffName(uid) || '?' }, clients: 0, services: 0, takings: 0, shares: 0, days: new Set(), months: new Set(), paid: 0 };
    sales.filter(s => s.kind === 'pos' && !s.voided).forEach(s => {
        const items = s.items || [], gross = items.reduce((a, i) => a + (Number(i.subtotal) || 0), 0);
        const part = gross > 0 ? (Number(s.total) || 0) / gross : 1;        // spread the sale discount over the lines
        const back = s.returned || {};
        const seen = new Set();
        items.forEach((i, ix) => {
            if (!i.by) return;
            const r = row(i.by), qty = Number(i.qty) || 1, q = Math.max(0, qty - (Number(back[ix]) || 0));
            if (!q) return;
            r.takings += (Number(i.subtotal) || 0) * part * (q / qty);
            if (i.service) {
                r.services += q;
                // the share is kept on the sale, so changing a service's share later doesn't rewrite the past
                r.shares += (i.share != null ? Number(i.share) || 0 : shareOf(productById(i.productId), qty)) * (q / qty);
            }
            r.days.add(s.day);
            if (!seen.has(i.by)) { seen.add(i.by); r.clients++; }
        });
    });
    entries.filter(e => e.payee && e.type === 'expense').forEach(e => { row(e.payee).paid += Number(e.amount) || 0; });
    staff.forEach(p => row(p.uid));
    const range = S.spRange || {}, months = new Set();
    if (range.from && range.to) for (let m = range.from.slice(0, 7); m <= range.to.slice(0, 7); m = nextMonth(m)) months.add(m);
    return Object.values(rows).map(r => {
        r.takings = Math.round(r.takings); r.shares = Math.round(r.shares);
        r.pay = payOf(r.p);
        r.earned = earnedBy(r.p, { money: r.takings, shares: r.shares, days: r.days.size, months: months.size });
        r.owed = r.earned - r.paid;
        return r;
    }).sort((a, b) => b.takings - a.takings || (a.p.name || '').localeCompare(b.p.name || ''));
}
const nextMonth = m => { const [y, n] = m.split('-').map(Number); return n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, '0')}`; };
async function payStaff(i) {
    const r = S.spRows && S.spRows[i]; if (!r) return;
    const v = await askValue(`${tl('Pay')} <b>${esc(r.p.name)}</b><br><span style="font-size:.78rem;color:#6b7280;">${tl('Owed')}: ${n0(r.owed)}</span>`, String(r.owed), tl('Next'), { value: String(r.owed) });
    if (v === null) return;
    const amount = Math.round(num(v)); if (!(amount > 0)) return toast('⚠️ ' + tl('Enter an amount.'), 'err');
    const from = await choose(`${tl('Pay')} ${n0(amount)} ${tl('from')}`, [['cash', '💵 ' + tl('Cash'), '#0b0d12'], ['mobile', '📱 Lipa kwa Simu', '#1a56db'], ['bank', '🏦 ' + tl('Bank'), '#1a56db']]);
    if (!from) return;
    const b = db.batch();
    writeEntries(b, [{ type: 'expense', category: 'Salaries', from, to: null, amount, payee: r.p.uid, payeeName: r.p.name,
        note: `Pay ${r.p.name} · ${S.spRange.from}${S.spRange.from === S.spRange.to ? '' : ' to ' + S.spRange.to}`, day: dayStr() }]);
    await commit(b, `✅ ${tl('Paid')} ${r.p.name} ${n0(amount)}`, { label: `Staff pay ${r.p.name} ${n0(amount)}` });
    loadStaffPay();
    if (typeof loadBarberMonth === 'function') loadBarberMonth(dayStr().slice(0, 7), true);
}

// ── Barbershop till: tap a service → who did it → how they paid → done ──
// No cart. The same sale record as the shop till, so reports, cash-up and
// staff pay all keep working.
const isBarberMode = () => (S.tenantInfo || {}).type === 'barbershop';

function renderBarberList(list) {
    const row = p => {
        const svc = isService(p), out = !svc && (Number(p.stock) || 0) <= 0;
        return `<button class="svc-row ${out ? 'out' : ''}" ${out ? 'disabled' : ''} onclick="quickSell('${p.id}')">
            <span class="sr-emoji">${esc(p.emoji || (svc ? '✂️' : '📦'))}</span>
            <span class="sr-name"><span class="notr">${esc(p.name)}</span>${svc ? '' : `<small>${out ? '❌ Out of stock' : stockTxt(p)}</small>`}</span>
            <b class="sr-price">${n0(linePriceOf(p))}</b></button>`;
    };
    const svcs = list.filter(isService), goods = list.filter(p => !isService(p));
    return (svcs.length ? `<div class="sr-head">${tl('Services')}</div>` + svcs.map(row).join('') : '')
        + (goods.length ? `<div class="sr-head">${tl('Products')}</div>` + goods.map(row).join('') : '');
}
const linePriceOf = p => Number(p.sellPrice) || 0;

async function quickSell(id) {
    if (S.qsOpen) return;
    S.cart = {}; S.lineMeta = {}; S.saleDisc = null; S.saleCustomer = null; S.payTouched = false;
    if (!(await qsAdd(id))) { S.cart = {}; S.lineMeta = {}; return; }
    qsPay();
}

async function qsAdd(id) {
    const p = productById(id); if (!p) return false;
    if (isService(p)) {
        const who = await askWho(p); if (!who) return false;
        if (S.cart[id] && meta(id).by !== who) { toast(`⚠️ ${tl('Record that as a separate client.')}`, 'err'); return true; }
        S.cart[id] = (S.cart[id] || 0) + 1; meta(id).by = who; S.lastDoer = who;
    } else {
        const q = S.cart[id] || 0;
        if (q + 1 > (Number(p.stock) || 0) + 1e-9) { toast(`⚠️ Only ${qtyTxt(p.stock, p)} ${p.name} in stock`, 'err'); return !!Object.keys(S.cart).length; }
        S.cart[id] = q + 1;
    }
    return true;
}

async function askWho(p) {
    const list = (await doersList()).filter(x => x.active !== false);
    if (!list.length) {
        if (isBarberMode()) { toast('⚠️ ' + tl(isAdmin() ? 'Add your barbers first — Barbers tab.' : 'No barbers listed yet. Ask the owner to add them.'), 'err'); if (isAdmin()) switchTab('barbers'); return null; }
        return S.me.uid;
    }
    if (list.length === 1) return list[0].uid;
    const me = S.me.uid, last = S.lastDoer;
    list.sort((a, b) => (b.uid === me) - (a.uid === me));
    const opts = list.map(x => [x.uid, `<span class="notr">${esc(x.name)}</span>` + (x.uid === me ? ` (${tl('me')})` : ''), x.uid === last ? '#0b0d12' : '#1a56db']);
    return choose(`✂️ ${tl('Who did')} <b class="notr">${esc(p.name)}</b>?`, opts);
}

function qsPay() {
    S.qsOpen = true;
    const o = document.createElement('div'); o.id = 'qsBox';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9998;display:flex;align-items:flex-end;justify-content:center;';
    const draw = () => {
        const lines = Object.keys(S.cart).map(id => {
            const p = productById(id) || {}, by = meta(id).by;
            return `<div class="qs-line"><span class="sr-emoji">${esc(p.emoji || '✂️')}</span>
                <span class="qs-what"><b class="notr">${esc(p.name)}${S.cart[id] > 1 ? ' × ' + S.cart[id] : ''}</b>${by ? `<small>✂️ <span class="notr">${esc(staffName(by))}</span></small>` : ''}</span>
                <button class="qs-price" data-a="price" data-id="${id}">${n0(lineSub(id))} ✏️</button>
                <button class="qs-x" data-a="drop" data-id="${id}" aria-label="Remove">✕</button></div>`;
        }).join('');
        o.innerHTML = `<div class="qs-card">
            ${lines}
            <button class="qs-more" data-a="more">➕ ${tl('Add another service')}</button>
            <div class="qs-total"><span>${tl('Total')}</span><b>${fmt(cartTotal())}</b></div>
            <div class="qs-pay"><button data-a="cash" style="background:var(--pos);">💵 ${tl('Cash')}</button><button data-a="mobile" style="background:#1a56db;">📱 ${tl('Mobile money')}</button></div>
            <button class="qs-split" data-a="split">💵 + 📱 ${tl('Cash + Mobile')}</button>
            <button class="qs-cancel" data-a="cancel">${tl('Cancel')}</button></div>`;
    };
    // Check before saving: what was done, by whom, how much, how paid
    const drawConfirm = () => {
        const P = S.qsPaid, kind = P.cash && P.mobile ? 'split' : P.cash ? 'cash' : 'mobile';
        o.innerHTML = `<div class="qs-card">
            <div class="qs-confirm-title">${tl('Check before saving')}</div>
            ${Object.keys(S.cart).map(id => { const p = productById(id) || {}, by = meta(id).by; return `<div class="qs-line"><span class="sr-emoji">${esc(p.emoji || '✂️')}</span>
                <span class="qs-what"><b class="notr">${esc(p.name)}${S.cart[id] > 1 ? ' × ' + S.cart[id] : ''}</b>${by ? `<small>✂️ <span class="notr">${esc(staffName(by))}</span></small>` : ''}</span><b>${n0(lineSub(id))}</b></div>`; }).join('')}
            <div class="qs-total"><span>${tl('Total')}</span><b>${fmt(cartTotal())}</b></div>
            <div class="qs-method ${kind}">${kind === 'cash' ? '💵 ' + tl('Paid in cash') : kind === 'mobile' ? '📱 ' + tl('Paid by mobile money') : `💵 ${tl('Cash')} ${n0(P.cash)} + 📱 ${tl('Mobile')} ${n0(P.mobile)}`}</div>
            <button class="qs-ok" data-a="confirm">✅ ${tl('CONFIRM')}</button>
            <button class="qs-cancel" data-a="back">← ${tl('Back')}</button></div>`;
    };
    const close = () => { o.remove(); S.qsOpen = false; };
    draw(); document.body.appendChild(o);
    o.addEventListener('click', async e => {
        const t = e.target.closest('[data-a]'); if (!t && e.target === o) { close(); S.cart = {}; S.lineMeta = {}; return; }
        if (!t) return;
        const a = t.dataset.a, id = t.dataset.id;
        if (a === 'cancel') { close(); S.cart = {}; S.lineMeta = {}; renderPOS(); return; }
        if (a === 'price') { await editLinePrice(id); draw(); return; }
        if (a === 'drop') { delete S.cart[id]; delete S.lineMeta[id]; if (!Object.keys(S.cart).length) { close(); renderPOS(); return; } draw(); return; }
        if (a === 'more') {
            o.style.display = 'none';
            const items = S.products.filter(p => isService(p) || (Number(p.stock) || 0) > 0).sort((x, y) => isService(y) - isService(x));
            const k = await choose(tl('Add another service'), items.map(p => [p.id, `${esc(p.emoji || '')} <span class="notr">${esc(p.name)}</span> · ${n0(p.sellPrice)}`, isService(p) ? '#0b0d12' : '#5b6474']));
            if (k) await qsAdd(k);
            o.style.display = 'flex'; draw(); return;
        }
        if (a === 'cash' || a === 'mobile') { const t0 = cartTotal(); S.qsPaid = { cash: a === 'cash' ? t0 : 0, mobile: a === 'mobile' ? t0 : 0 }; drawConfirm(); return; }
        if (a === 'split') {
            const t0 = cartTotal();
            o.style.display = 'none';
            const v = await askValue(`${tl('Total')} <b>${fmt(t0)}</b><br><span style="font-size:.8rem;color:#6b7280;">${tl('How much in cash? The rest is mobile money.')}</span>`, '0', tl('Next'));
            o.style.display = 'flex';
            if (v === null || v === '') return;
            const c = Math.round(num(v));
            if (!(c > 0 && c < t0)) { toast('⚠️ ' + tl('The cash part must be more than 0 and less than the total.'), 'err'); return; }
            S.qsPaid = { cash: c, mobile: t0 - c }; drawConfirm(); return;
        }
        if (a === 'back') { draw(); return; }
        if (a === 'confirm') {
            const P = S.qsPaid;
            $('payCash').value = P.cash; $('payMobile').value = P.mobile; $('payCredit').value = 0;
            close();
            await confirmSale();
            if (Object.keys(S.cart).length) { qsPay(); }   // the sale was stopped (e.g. a price below the limit): keep the client open
        }
    });
}

// Under the price: what the barber gets and what the shop keeps
function shopKeeps() {
    const el = $('svcKeeps'); if (!el) return;
    const price = num($('itemSell').value), cut = num($('itemStaffPay').value);
    el.innerHTML = price > 0 && $('itemService').checked
        ? (cut > price ? `⚠️ ${tl('The barber cannot get more than the price.')}` : `${tl('Barber gets')} <b>${n0(cut)}</b> · ${tl('You keep')} <b>${n0(price - cut)}</b>`) : '';
}
