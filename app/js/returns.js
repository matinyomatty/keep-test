// Keep till — Seller tools and returns.
// Part of app/index.html; the parts load in order and share one global scope.
//  SELLER TOOLS — the owner decides if sellers may record manual sales
//  and expenses. Balances, profit and banking stay with the owner.
// ════════════════════════════════════════════════
const canCloseDay = () => !isAdmin() && !!(S.tenantInfo.settings || {}).cashierCloseDay;
// What a seller can see of today: all sales rung up today (not money entries or balances)
function todaySalesFig() {
    const L = (S.todaySales || []).filter(x => !x.voided), f = { n: 0, sales: 0, cash: 0, mobile: 0, credit: 0, debt: 0, returns: 0 };
    L.forEach(x => {
        if (x.kind === 'pos' || x.kind === 'manual') { f.sales += x.total; f.credit += x.credit || 0; if (x.kind === 'pos') f.n++; }
        if (x.kind === 'return') { f.sales -= x.total; f.returns += x.total; }
        if (x.kind === 'repay') f.debt += x.total;
        f.cash += x.cash || 0; f.mobile += x.mobile || 0;
    });
    return f;
}
const canManual = () => isAdmin() || !!(S.tenantInfo.settings || {}).cashierManual;
const canExpense = () => isAdmin() || !!(S.tenantInfo.settings || {}).cashierExpenses;
function renderSellerTools() {
    const box = $('sellerTools'); if (!box || !S.me) return;
    const show = !isAdmin() && (canManual() || canExpense());
    box.classList.toggle('hidden', !show);
    $('stManual').classList.toggle('hidden', !canManual());
    $('stExpense').classList.toggle('hidden', !canExpense());
}
function openSellerExpense() {
    if (!canExpense()) return toast('⚠️ The owner has not allowed sellers to record expenses.', 'err');
    $('seCat').innerHTML = EXPENSE_CATS.map(([v, l]) => `<option value="${v}" ${v === 'Other' ? 'selected' : ''}>${l}</option>`).join('');
    ['seAmt', 'seNote'].forEach(id => $(id).value = ''); $('seFrom').value = 'cash';
    openSheet('sheetSellerExp'); setTimeout(() => $('seAmt').focus(), 250);
    $('seMine').innerHTML = '';
    S.sheetListeners.push(col('entries').where('staffUid', '==', S.me.uid).where('day', '==', dayStr()).onSnapshot(s => {
        const L = s.docs.map(d => d.data()).filter(e => e.type === 'expense').sort((a, b) => (tms(b.createdAt) || 9e15) - (tms(a.createdAt) || 9e15));
        $('seMine').innerHTML = L.length ? `<span class="section-label" style="margin-top:12px;">Your expenses today · ${fmt(L.reduce((a, e) => a + e.amount, 0))}</span>` +
            L.map(e => `<div class="list-line"><div class="ll-main"><div class="ll-title">${esc(catName(e.category))}${e.note ? ' · ' + esc(e.note) : ''}</div><div class="ll-sub">${timeOf(e.createdAt)} · ${e.from === 'mobile' ? '📱 Simu' : '💵 Cash'}</div></div><div class="ll-amt">${n0(e.amount)}</div></div>`).join('') : '';
    }, () => {}));
}
async function saveSellerExpense() {
    const amount = Math.round(num($('seAmt').value)), category = $('seCat').value, from = $('seFrom').value, note = $('seNote').value.trim();
    if (!(amount > 0)) return toast('⚠️ Enter the amount paid.', 'err');
    if (!note) return toast('⚠️ Say what it was for.', 'err');
    if (!await showConfirm(`Record <b>${fmt(amount)}</b> for ${esc(catName(category))}, paid from ${from === 'mobile' ? '📱 Lipa kwa Simu' : '💵 the drawer'}?`, 'Save', 'var(--pos)')) return;
    const b = db.batch();
    writeEntries(b, [{ type: 'expense', category, from, to: null, amount, note, day: dayStr() }]);
    ['seAmt', 'seNote'].forEach(id => $(id).value = '');
    commit(b, `✅ Expense of ${fmt(amount)} recorded`, { label: `Expense ${fmt(amount)} · ${catName(category)} · ${note}` });
}

// ════════════════════════════════════════════════
//  RETURNS — give back part (or all) of a sale
// ════════════════════════════════════════════════
const canReturn = () => isAdmin() || !!(S.tenantInfo.settings || {}).cashierReturns;
function openReturn(saleId) {
    const s = S.saleCache[saleId];
    if (!s || s.kind !== 'pos' || s.voided) return;
    if (!canReturn()) return toast('⚠️ Only the owner can take returns. Ask them, or they can allow sellers in 👥 Settings.', 'err');
    S.ret = { s };
    const gross = (s.items || []).reduce((a, i) => a + (i.subtotal || 0), 0);
    S.ret.factor = gross ? s.total / gross : 1;
    const done = s.returned || {}, doneSer = s.returnedSerials || [];
    $('retBody').innerHTML = `
        <div style="text-align:center;font-size:.78rem;color:var(--gray);margin-bottom:10px;">${esc(s.receiptNo || '')} · ${prettyDay(s.day)} ${timeOf(s.createdAt)}${s.customer ? ' · 👤 ' + esc(s.customer.name) : ''} · paid ${fmt(s.total)}</div>
        ${(s.items || []).map((i, k) => {
            const left = q3(i.qty - (done[k] || 0));
            const p = { unit: i.unit, partQty: !Number.isInteger(i.qty) || ['m', 'ft', 'kg', 'l'].includes(i.unit) };
            const sers = (i.serials || []).filter(x => !doneSer.includes(x));
            return `<div class="ret-line ${left <= 0 ? 'voided' : ''}" data-k="${k}">
                <div style="display:flex;justify-content:space-between;gap:8px;">
                    <div><b>${esc(i.emoji || '')} ${esc(i.name)}</b><div class="cl-price">${qtyTxt(i.qty, p)} sold @ ${n0(i.unitPrice)}${done[k] ? ` · ${qtyTxt(done[k], p)} already returned` : ''}</div></div>
                    ${left > 0 && !sers.length ? `<input class="ret-qty" type="number" inputmode="decimal" step="${partOk(p) ? '0.1' : '1'}" min="0" max="${left}" placeholder="0" oninput="retTotal()" title="Quantity to return (max ${left})">` : ''}
                </div>
                ${left > 0 && sers.length ? sers.map(x => `<label class="check" style="padding:4px 0;"><input type="checkbox" class="ret-ser" value="${esc(x)}" onchange="retTotal()"><span style="font-family:monospace;">${esc(x)}</span></label>`).join('') : ''}
                ${left > 0 ? `<select class="ret-where" style="margin-top:6px;padding:8px;font-size:.78rem;"><option value="restock">📦 Put back in stock</option><option value="damaged">🛠️ Damaged / faulty — don't put back</option></select>` : '<div class="cl-price">Fully returned</div>'}
            </div>`;
        }).join('')}
        <div class="form-row" style="margin-top:12px;">
            <div class="field-group"><span class="field-label">Give the money back as</span>
                <select id="retHow" onchange="retTotal()">
                    <option value="cash">💵 Cash</option><option value="mobile">📱 Lipa kwa Simu</option>
                    ${s.customer ? `<option value="debt" ${s.credit ? 'selected' : ''}>📒 Take it off what ${esc(s.customer.name.split(' ')[0])} owes</option>` : ''}
                </select></div>
            <div class="field-group"><span class="field-label">Reason</span><input type="text" id="retReason" placeholder="e.g. Faulty, wrong size, not needed"></div>
        </div>
        <div class="diff-big" style="background:#eff6ff;color:var(--blue);"><small>Refund</small><span id="retAmt">0 TZS</span></div>
        <button class="primary-cta" id="retBtn" onclick="confirmReturn()">↩️ CONFIRM RETURN</button>`;
    openSheet('sheetReturn');
    retTotal();
}
function retPicked() {
    const s = S.ret.s, out = [];
    document.querySelectorAll('#retBody .ret-line').forEach(el => {
        const k = +el.dataset.k, i = s.items[k];
        const sers = [...el.querySelectorAll('.ret-ser:checked')].map(x => x.value);
        const qIn = el.querySelector('.ret-qty');
        const qty = sers.length ? sers.length : qIn ? q3(num(qIn.value)) : 0;
        if (qty > 0) out.push({ k, i, qty, serials: sers, where: (el.querySelector('.ret-where') || {}).value || 'restock' });
    });
    return out;
}
function retTotal() {
    const f = S.ret.factor;
    S.ret.refund = Math.round(retPicked().reduce((a, x) => a + x.qty * x.i.unitPrice * f, 0));
    $('retAmt').textContent = fmt(S.ret.refund);
}
async function confirmReturn() {
    const s = S.ret.s, picked = retPicked(), done = s.returned || {};
    if (!picked.length) return toast('⚠️ Choose what is being returned.', 'err');
    for (const x of picked) if (x.qty > q3(x.i.qty - (done[x.k] || 0)) + 1e-9) return toast(`⚠️ Only ${q3(x.i.qty - (done[x.k] || 0))} of ${x.i.name} can still be returned.`, 'err');
    retTotal();
    const refund = S.ret.refund, how = $('retHow').value;
    if (how === 'debt' && !s.customer) return toast('⚠️ No customer on this sale.', 'err');
    // Taking it off their debt can only go down to zero — anything above that is given back in cash.
    let owed = 0;
    if (how === 'debt') { try { owed = Math.max(0, ((await col('customers').doc(s.customer.id).get()).data() || {}).balance || 0); } catch (e) { owed = 0; } }
    const debt = how === 'debt' ? Math.min(refund, owed) : 0;
    const cash = how === 'cash' ? refund : how === 'debt' ? refund - debt : 0, mobile = how === 'mobile' ? refund : 0;
    const howTxt = [debt ? `<b>${fmt(debt)}</b> off what they owe` : '', cash ? `<b>${fmt(cash)}</b> cash back` : '', mobile ? `<b>${fmt(mobile)}</b> by Lipa kwa Simu` : ''].filter(Boolean).join(' + ');
    if (!await showConfirm(`Return ${picked.map(x => qtyTxt(x.qty, { unit: x.i.unit }) + ' × ' + esc(x.i.name)).join(', ')}?<br><br>Refund ${fmt(refund)}: ${howTxt}.${how === 'debt' && debt < refund ? `<br><span style="font-size:.75rem;color:#6b7280;">They only owed ${fmt(owed)}.</span>` : ''}`, 'Return', 'var(--blue)')) return;
    const restockIds = new Set(picked.filter(x => x.where === 'restock' && productById(x.i.productId)).map(x => x.i.productId));
    if (restockIds.size > 10) return toast('⚠️ Put back at most 10 different items per return — do the rest as a second return.', 'err');
    const day = dayStr(), ref = col('sales').doc(), b = db.batch(), why = src('sales', ref.id);
    const receiptNo = 'RT' + day.slice(2).replace(/-/g, '') + '-' + ref.id.slice(0, 4).toUpperCase();
    const items = picked.map(x => ({ productId: x.i.productId, name: x.i.name, emoji: x.i.emoji || '', unit: x.i.unit || 'pc', qty: x.qty,
        unitPrice: Math.round(x.i.unitPrice * S.ret.factor), subtotal: Math.round(x.qty * x.i.unitPrice * S.ret.factor), serials: x.serials, restock: x.where === 'restock' }));
    b.set(ref, {
        kind: 'return', refOf: s.id, refReceipt: s.receiptNo || '', items, serials: picked.flatMap(x => x.serials), total: refund, cash: -cash, mobile: -mobile, credit: -debt,
        customer: s.customer || null, reason: $('retReason').value.trim(), receiptNo, day, month: day.slice(0, 7), voided: false,
        staffUid: S.me.uid, staffName: S.me.name, createdAt: now()
    });
    const saleUp = { returnedTotal: inc(refund), updatedAt: now() };
    picked.forEach(x => saleUp['returned.' + x.k] = inc(x.qty));
    const allSer = picked.flatMap(x => x.serials);
    if (allSer.length) saleUp.returnedSerials = FV.arrayUnion(...allSer);
    b.update(col('sales').doc(s.id), saleUp);
    // One stock change per item (added up if the same item is returned from two lines), each linked to its movement record
    const back = {};
    picked.forEach(x => { if (x.where === 'restock' && productById(x.i.productId)) back[x.i.productId] = { name: x.i.name, qty: q3((back[x.i.productId] ? back[x.i.productId].qty : 0) + x.qty) }; });
    Object.entries(back).forEach(([pid, r]) => {
        const mv = col('movements').doc();
        b.update(col('products').doc(pid), { stock: inc(r.qty), src: src('movements', mv.id), updatedAt: now() });
        b.set(mv, { productId: pid, name: r.name, type: 'return', qty: r.qty, saleId: ref.id, day, staffUid: S.me.uid, staffName: S.me.name, createdAt: now() });
    });
    picked.forEach(x => {
        x.serials.forEach(sn => b.set(col('serials').doc(serialId(sn)), {
            serial: sn, productId: x.i.productId, name: x.i.name, status: x.where === 'restock' ? 'in' : 'damaged',
            returnedAt: now(), returnSaleId: ref.id, updatedAt: now()
        }, { merge: true }));
    });
    const dayUp = { day, month: day.slice(0, 7), sales: inc(-refund), returns: inc(refund), src: why, updatedAt: now() };
    if (cash) dayUp.cash = inc(-cash);
    if (mobile) dayUp.mobile = inc(-mobile);
    if (debt) dayUp.credit = inc(-debt);
    b.set(col('days').doc(day), dayUp, { merge: true });
    if (cash || mobile) b.set(col('meta').doc('balances'), { cash: inc(-cash), mobile: inc(-mobile), src: why, updatedAt: now() }, { merge: true });
    if (s.customer && s.customer.id) b.update(col('customers').doc(s.customer.id), { balance: inc(-debt), totalBought: inc(-refund), src: why, updatedAt: now() });
    closeModals();
    commit(b, `↩️ Return recorded · ${fmt(refund)} refunded`, { label: `Return ${receiptNo} of ${s.receiptNo || ''} · ${fmt(refund)}` });
    const doc = { id: ref.id, kind: 'return', refReceipt: s.receiptNo, items, total: refund, cash: -cash, mobile: -mobile, credit: -debt, customer: s.customer, receiptNo, day, staffName: S.me.name, createdAt: { toDate: () => new Date(), toMillis: () => Date.now() } };
    S.saleCache[ref.id] = doc;
    if (await showConfirm(`Give the customer a return receipt (${receiptNo})?`, '🧾 Receipt', 'var(--pos)')) receiptMenu(doc);
}

// ════════════════════════════════════════════════
