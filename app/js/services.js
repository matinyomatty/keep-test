// Keep till — services and staff pay (barbershops, salons, and any shop that sells services).
// A service is an item with no stock. Each service on a sale records who did it, so the owner
// sees every barber's clients and takings and what each is owed, by their own pay rule.
// Part of app/index.html; the parts load in order and share one global scope.

const isService = p => !!(p && p.service);
const isServiceShop = () => (S.tenantInfo || {}).type === 'barbershop' || S.products.some(isService);
const PAY_TYPES = [
    ['client', 'Per client', 'A fixed amount for every client they serve'],
    ['service', 'Per service', 'An amount for each service (set on each service)'],
    ['percent', 'Percentage', 'A share of the money from their work'],
    ['rent', 'Chair rent', 'They keep their takings and pay the shop a daily rent'],
    ['salary', 'Salary', 'Paid a fixed salary — just track their clients']
];
const payLabel = p => {
    const pay = p && p.pay; if (!pay || !pay.type) return tl('Pay not set');
    const t = PAY_TYPES.find(x => x[0] === pay.type), r = Number(pay.rate) || 0;
    return pay.type === 'percent' ? `${tl(t[1])} · ${r}%` : pay.type === 'salary' ? tl(t[1]) : pay.type === 'service' ? `${tl(t[1])}${r ? ' · ' + n0(r) + ' ' + tl('default') : ''}` : `${tl(t[1])} · ${n0(r)}`;
};

// Labels and buttons that only make sense when the shop sells services
function applyServiceMode() {
    const on = isServiceShop();
    document.querySelectorAll('.shop-svc').forEach(e => e.classList.toggle('hidden', !on || !isAdmin()));
    document.body.classList.toggle('svc-shop', on);
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
const staffName = uid => ((S.staffAll || []).find(p => p.uid === uid) || (uid === S.me.uid ? S.me : {})).name || '';

// Who did this service? Sellers default to themselves; the owner picks.
function defaultDoer() { return !isAdmin() ? S.me.uid : (S.lastDoer || null); }
async function pickDoer(id) {
    const list = await loadStaffOnce();
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
    const editing = !!$('itemId').value;
    $('itemTitle').textContent = svc ? (editing ? 'Edit service' : 'Add a service') : (editing ? 'Edit Item' : 'Add New Item');
    if ($('itemUnit').value) unitChanged(true);
}

// ── Pay rule for one staff member (owner) ────────────
async function setStaffPay(uid) {
    const p = (S.staff || []).find(x => x.uid === uid) || (S.staffAll || []).find(x => x.uid === uid); if (!p) return;
    const type = await choose(`${tl('How is')} <b>${esc(p.name)}</b> ${tl('paid?')}`, PAY_TYPES.map(([k, l, d]) => [k, `${tl(l)}<br><small style="font-weight:500;opacity:.85;">${tl(d)}</small>`, (p.pay || {}).type === k ? '#0b0d12' : '#1a56db']));
    if (!type) return;
    let rate = 0;
    if (type !== 'salary') {
        const q = { client: 'Amount per client (TZS)', service: 'Default amount per service (TZS) — used when a service has none of its own', percent: 'Their share (%)', rent: 'Chair rent per day worked (TZS)' }[type];
        const v = await askValue(`${esc(p.name)}<br><span style="font-size:.78rem;color:#6b7280;">${tl(q)}</span>`, type === 'percent' ? 'e.g. 40' : 'e.g. 3000', 'Save', { value: String((p.pay || {}).type === type ? (p.pay.rate || '') : '') });
        if (v === null) return;
        rate = Math.max(0, num(v));
        if (type === 'percent' && rate > 100) return toast('⚠️ ' + tl('A share cannot be more than 100%.'), 'err');
    }
    const b = db.batch();
    b.set(col('staff').doc(uid), { pay: { type, rate }, updatedAt: now() }, { merge: true });
    commit(b, '✅ ' + tl('Pay rule saved'));
    if (S.staffAll) S.staffAll = null;
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
            loadStaffOnce(true)
        ]);
    } catch (e) { box.innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; return; }
    S.spRows = staffPayRows(sales, entries, staff);
    S.spRange = { from, to };
    const R = S.spRows.filter(r => r.clients || r.paid || r.p.pay);
    const tot = R.reduce((a, r) => ({ takings: a.takings + r.takings, earned: a.earned + r.earned, paid: a.paid + r.paid }), { takings: 0, earned: 0, paid: 0 });
    const unassigned = sales.filter(s => s.kind === 'pos' && !s.voided).reduce((n, s) => n + (s.items || []).filter(i => i.service && !i.by).length, 0);
    box.innerHTML = (R.length ? R.map((r, i) => `
        <div class="sum-box" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
                <div><b class="notr">${esc(r.p.name)}</b><div style="font-size:.7rem;color:var(--gray);">${esc(payLabel(r.p))}</div></div>
                <button class="tiny-btn" onclick="setStaffPay('${r.p.uid}').then(loadStaffPay)">✏️ ${tl('Pay rule')}</button>
            </div>
            <div class="sum-row"><span>${tl('Clients')}</span><b>${r.clients}</b></div>
            <div class="sum-row"><span>${tl('Services done')}</span><b>${q3(r.services)}</b></div>
            <div class="sum-row"><span>${tl('Money from their work')}</span><b>${fmt(r.takings)}</b></div>
            ${r.p.pay && r.p.pay.type !== 'salary' ? `<div class="sum-row"><span>${r.p.pay.type === 'rent' ? tl('Takings minus chair rent') : tl('Earned')}</span><b>${fmt(r.earned)}</b></div>
            ${r.p.pay.type === 'rent' ? `<div class="sum-row"><span>${tl('Days worked')} × ${n0(r.p.pay.rate)}</span><span>−${n0(r.rentDue)}</span></div>` : ''}
            <div class="sum-row"><span>${tl('Already paid')}</span><span>${r.paid ? '−' + n0(r.paid) : '0'}</span></div>
            <div class="sum-row big"><span>${r.owed >= 0 ? tl('Owed to them') : tl('They owe the shop')}</span><strong style="color:${r.owed > 0 ? 'var(--red)' : 'var(--green)'};">${fmt(Math.abs(r.owed))}</strong></div>
            ${r.owed > 0 ? `<button class="btn-sec wide" style="border-color:var(--green);color:var(--green);margin-top:8px;" onclick="payStaff(${i})">💵 ${tl('Pay')} ${n0(r.owed)}</button>` : ''}`
            : r.p.pay ? '' : `<div class="hint amber" style="margin-top:6px;">${tl('Set how this person is paid to see what they are owed.')}</div>`}
        </div>`).join('') : `<div class="hint gray">${tl('No services recorded in these dates.')}</div>`)
        + (unassigned ? `<div class="hint amber">⚠️ ${unassigned} ${tl('services were sold without choosing who did them.')}</div>` : '')
        + (R.length ? `<div class="sum-box"><div class="sum-row"><span>${tl('Total money from services')}</span><b>${fmt(tot.takings)}</b></div><div class="sum-row"><span>${tl('Total paid to staff')}</span><b>${fmt(tot.paid)}</b></div></div>` : '');
}
// Works out each person's clients, takings and pay from the sales and payments in the range.
function staffPayRows(sales, entries, staff) {
    const prodPay = Object.fromEntries(S.products.map(p => [p.id, Number(p.staffPay) || 0]));
    const rows = {};
    const row = uid => rows[uid] = rows[uid] || { p: staff.find(x => x.uid === uid) || { uid, name: staffName(uid) || '?' }, clients: 0, services: 0, takings: 0, perService: 0, days: new Set(), paid: 0 };
    sales.filter(s => s.kind === 'pos' && !s.voided).forEach(s => {
        const items = s.items || [], gross = items.reduce((a, i) => a + (Number(i.subtotal) || 0), 0);
        const share = gross > 0 ? (Number(s.total) || 0) / gross : 1;        // spread the sale discount over the lines
        const back = s.returned || {};
        const seen = new Set();
        items.forEach((i, ix) => {
            if (!i.by) return;
            const r = row(i.by), q = Math.max(0, (Number(i.qty) || 0) - (Number(back[ix]) || 0));
            if (!q) return;
            const value = (Number(i.subtotal) || 0) * share * (q / (Number(i.qty) || 1));
            if (i.service) { r.services += q; r.perService += q * (prodPay[i.productId] || (r.p.pay && r.p.pay.type === 'service' ? Number(r.p.pay.rate) || 0 : 0)); }
            r.takings += value;
            r.days.add(s.day);
            if (!seen.has(i.by)) { seen.add(i.by); r.clients++; }
        });
    });
    entries.filter(e => e.payee && e.type === 'expense').forEach(e => { row(e.payee).paid += Number(e.amount) || 0; });
    staff.forEach(p => row(p.uid));
    return Object.values(rows).map(r => {
        const pay = r.p.pay || {}, rate = Number(pay.rate) || 0;
        r.rentDue = pay.type === 'rent' ? rate * r.days.size : 0;
        r.earned = Math.round(pay.type === 'client' ? rate * r.clients : pay.type === 'service' ? r.perService : pay.type === 'percent' ? r.takings * rate / 100 : pay.type === 'rent' ? r.takings - r.rentDue : 0);
        r.takings = Math.round(r.takings);
        r.owed = pay.type && pay.type !== 'salary' ? r.earned - r.paid : 0;
        return r;
    }).sort((a, b) => b.takings - a.takings || (a.p.name || '').localeCompare(b.p.name || ''));
}
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
    const list = (await loadStaffOnce()).filter(x => x.active !== false);
    if (!list.length) return S.me.uid;
    if (list.length === 1) return list[0].uid;
    const me = S.me.uid, last = S.lastDoer;
    list.sort((a, b) => (b.uid === me) - (a.uid === me));
    const opts = list.map(x => [x.uid, esc(x.name) + (x.uid === me ? ` (${tl('me')})` : ''), x.uid === last ? '#0b0d12' : '#1a56db']);
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
            <button class="qs-cancel" data-a="cancel">${tl('Cancel')}</button></div>`;
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
        if (a === 'cash' || a === 'mobile') {
            const t0 = cartTotal();
            $('payCash').value = a === 'cash' ? t0 : 0; $('payMobile').value = a === 'mobile' ? t0 : 0; $('payCredit').value = 0;
            close();
            await confirmSale();
            if (Object.keys(S.cart).length) { qsPay(); }   // the sale was stopped (e.g. a price below the limit): keep the client open
        }
    });
}
