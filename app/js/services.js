// Keep till — services and staff pay (barbershops, salons, and any shop that sells services).
// A service is an item with no stock. Each service on a sale records who did it, so the owner
// sees every barber's clients and takings, and what each has earned from the share set on each service.
// Part of app/index.html; the parts load in order and share one global scope.

const isService = p => !!(p && p.service);
const isServiceShop = () => (S.tenantInfo || {}).type === 'barbershop' || S.products.some(isService);
// One rule, set on each service: "Barber gets X". Whoever does that service earns X.
const shareOf = (p, qty) => Math.round((Number((p || {}).staffPay) || 0) * (Number(qty) || 0));

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
    $('sheetItem').classList.toggle('is-svc', svc);
    const bs = isBarberMode() && svc, nameLbl = $('itemName').previousElementSibling, payLbl = $('itemStaffPay').previousElementSibling;
    nameLbl.textContent = bs ? 'Service name' : 'Item name';
    $('itemName').placeholder = bs ? 'e.g. Haircut, Shave, Kids cut' : 'e.g. Samsung 25W charger, Bosch drill, Cement 50kg';
    payLbl.textContent = bs ? 'Barber gets from each one (TZS)' : 'Staff member gets from each one (TZS)';
    $('itemStaffPay').placeholder = 'e.g. 2000';
    shopKeeps();
    document.querySelector('#sheetItem .save-bar .primary-cta').textContent = bs ? 'SAVE SERVICE' : 'SAVE ITEM';
    $('itemDeleteBtn').textContent = bs ? 'DELETE SERVICE' : 'DELETE ITEM';
    if (isBarberMode() && svc && !$('itemCat').value) $('itemCat').value = 'Services';
    buildEmojiPicker();
    const editing = !!$('itemId').value;
    $('itemTitle').textContent = svc ? (editing ? 'Edit service' : 'Add a service') : (editing ? 'Edit Item' : 'Add New Item');
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
            loadStaffOnce(true)
        ]);
    } catch (e) { box.innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; return; }
    S.spRows = staffPayRows(sales, entries, staff);
    S.spRange = { from, to };
    const R = S.spRows.filter(r => r.clients || r.paid);
    const tot = R.reduce((a, r) => ({ takings: a.takings + r.takings, earned: a.earned + r.earned, paid: a.paid + r.paid }), { takings: 0, earned: 0, paid: 0 });
    const unassigned = sales.filter(s => s.kind === 'pos' && !s.voided).reduce((n, s) => n + (s.items || []).filter(i => i.service && !i.by).length, 0);
    const noShare = S.products.filter(p => isService(p) && !(Number(p.staffPay) > 0));
    box.innerHTML = (R.length ? R.map((r, i) => `
        <div class="sum-box" style="margin-bottom:10px;">
            <div style="margin-bottom:6px;"><b class="notr">${esc(r.p.name)}</b></div>
            <div class="sum-row"><span>${tl('Clients')}</span><b>${r.clients}</b></div>
            <div class="sum-row"><span>${tl('Money from their work')}</span><b>${fmt(r.takings)}</b></div>
            <div class="sum-row"><span>${tl('Their share')}</span><b>${fmt(r.earned)}</b></div>
            <div class="sum-row"><span>${tl('Already paid')}</span><span>${r.paid ? '−' + n0(r.paid) : '0'}</span></div>
            <div class="sum-row big"><span>${r.owed >= 0 ? tl('Owed to them') : tl('Paid too much')}</span><strong style="color:${r.owed > 0 ? 'var(--red)' : 'var(--green)'};">${fmt(Math.abs(r.owed))}</strong></div>
            ${r.owed > 0 ? `<button class="btn-sec wide" style="border-color:var(--green);color:var(--green);margin-top:8px;" onclick="payStaff(${i})">💵 ${tl('Pay')} ${n0(r.owed)}</button>` : ''}
        </div>`).join('') : `<div class="hint gray">${tl('No services recorded in these dates.')}</div>`)
        + (noShare.length ? `<div class="hint amber">⚠️ ${tl('No barber share set on')}: <span class="notr">${noShare.map(p => esc(p.name)).join(', ')}</span>. ${tl('Set it in Services.')}</div>` : '')
        + (unassigned ? `<div class="hint amber">⚠️ ${unassigned} ${tl('services were sold without choosing who did them.')}</div>` : '')
        + (R.length ? `<div class="sum-box"><div class="sum-row"><span>${tl('Total money from services')}</span><b>${fmt(tot.takings)}</b></div><div class="sum-row"><span>${tl('Barbers\' shares')}</span><b>${fmt(tot.earned)}</b></div><div class="sum-row"><span>${tl('Shop keeps')}</span><b>${fmt(tot.takings - tot.earned)}</b></div><div class="sum-row"><span>${tl('Total paid to staff')}</span><b>${fmt(tot.paid)}</b></div></div>` : '');
}
// Works out each person's clients, takings and pay from the sales and payments in the range.
function staffPayRows(sales, entries, staff) {
    const rows = {};
    const row = uid => rows[uid] = rows[uid] || { p: staff.find(x => x.uid === uid) || { uid, name: staffName(uid) || '?' }, clients: 0, services: 0, takings: 0, earned: 0, paid: 0 };
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
                r.earned += (i.share != null ? Number(i.share) || 0 : shareOf(productById(i.productId), qty)) * (q / qty);
            }
            if (!seen.has(i.by)) { seen.add(i.by); r.clients++; }
        });
    });
    entries.filter(e => e.payee && e.type === 'expense').forEach(e => { row(e.payee).paid += Number(e.amount) || 0; });
    staff.forEach(p => row(p.uid));
    return Object.values(rows).map(r => {
        r.takings = Math.round(r.takings); r.earned = Math.round(r.earned); r.owed = r.earned - r.paid;
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

// Under the price: what the barber gets and what the shop keeps
function shopKeeps() {
    const el = $('svcKeeps'); if (!el) return;
    const price = num($('itemSell').value), cut = num($('itemStaffPay').value);
    el.innerHTML = price > 0 && $('itemService').checked
        ? (cut > price ? `⚠️ ${tl('The barber cannot get more than the price.')}` : `${tl('Barber gets')} <b>${n0(cut)}</b> · ${tl('Shop keeps')} <b>${n0(price - cut)}</b>`) : '';
}
