// Keep till — Money entries, manual sales and the day detail.
// Part of app/index.html; the parts load in order and share one global scope.
//  MONEY ENTRIES  (expenses, banking, transfers, savings, balance fixes)
//  Each entry moves money between accounts. Running balances and the
//  day totals are updated in the same save, so the dashboard never has
//  to re-read history.
// ════════════════════════════════════════════════
function entryDayField(e) {
    if (e.type === 'expense') return e.category === 'Supplier' ? 'supplier' : 'expense';
    return { banking: 'bankIn', withdrawal: 'bankOut', savings: 'toSavings' }[e.type] || null;
}
// sign = +1 to apply an entry, -1 to undo it
function writeEntries(b, entries, sign = 1, refs) {
    const bal = {}, days = {}, made = [];
    entries.forEach((e, i) => {
        const a = (Number(e.amount) || 0) * sign;
        if (e.from) bal[e.from] = (bal[e.from] || 0) - a;
        if (e.to) bal[e.to] = (bal[e.to] || 0) + a;
        const f = entryDayField(e);
        if (f) { days[e.day] = days[e.day] || {}; days[e.day][f] = (days[e.day][f] || 0) + a; }
        if (sign > 0) { const r = col('entries').doc(); made.push(r.id); b.set(r, { ...e, month: e.day.slice(0, 7), staffUid: S.me.uid, staffName: S.me.name, createdAt: now() }); }
        else if (refs && refs[i]) b.delete(col('entries').doc(refs[i]));
    });
    const why = made.length === 1 ? { src: src('entries', made[0]) } : {};
    const bu = {}; Object.entries(bal).forEach(([k, v]) => { if (v) bu[k] = inc(v); });
    if (Object.keys(bu).length) b.set(col('meta').doc('balances'), { ...bu, ...why, updatedAt: now() }, { merge: true });
    Object.entries(days).forEach(([d, f]) => {
        const du = {}; Object.entries(f).forEach(([k, v]) => du[k] = inc(v));
        b.set(col('days').doc(d), { day: d, month: d.slice(0, 7), ...du, ...why, updatedAt: now() }, { merge: true });
    });
}

function openEntry(date) {
    $('expCat').innerHTML = '<option value="">— Choose category —</option>' + EXPENSE_CATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    $('entryDate').value = date || dayStr();
    $('entryAmt').value = ''; $('entryNote').value = '';
    entryTab('expense');
    openSheet('sheetEntry');
    watchEntryDay();
}
function entryTab(t) {
    S.entryType = t;
    document.querySelectorAll('#entryTabs button').forEach(b => {
        const on = b.dataset.t === t;
        b.classList.toggle('on', on);
        b.style.background = on ? ENTRY_COLORS[b.dataset.t][0] : '#eef2f7';
        b.style.borderColor = on ? ENTRY_COLORS[b.dataset.t][0] : '#c7cfdb';
        b.style.color = on ? (b.dataset.t === 'expense' ? 'var(--ink)' : '#fff') : '#1f2937';
    });
    document.querySelectorAll('#sheetEntry .ef').forEach(el => el.classList.toggle('hidden', el.dataset.for !== t));
    $('entryAmtLbl').textContent = t === 'adjust' ? 'Real balance now (TZS)' : 'Amount (TZS)';
    if (t === 'adjust') adjHint();
}
function adjHint() { const a = $('adjAcct').value; $('adjNow').textContent = `System says ${ACCT[a]} holds ${fmt(S.balances[a] || 0)}.`; }

function saveEntry() {
    const day = $('entryDate').value;
    if (!day) return toast('⚠️ Choose a date.', 'err');
    const amt = num($('entryAmt').value), note = $('entryNote').value.trim(), t = S.entryType;
    let e;
    if (t === 'adjust') {
        const a = $('adjAcct').value, delta = amt - (Number(S.balances[a]) || 0);
        if ($('entryAmt').value.trim() === '') return toast('⚠️ Type the real balance.', 'err');
        if (Math.abs(delta) < 1) return toast('Balance already matches 👍');
        e = { type: 'adjust', category: 'Balance correction', from: delta < 0 ? a : null, to: delta > 0 ? a : null, amount: Math.abs(delta), note: note || `${ACCT[a]} set to ${n0(amt)}`, day };
    } else {
        if (amt <= 0) return toast('⚠️ Enter an amount.', 'err');
        if (t === 'expense') {
            const cat = $('expCat').value;
            if (!cat) return toast('⚠️ Choose a category.', 'err');
            e = { type: 'expense', category: cat, from: $('expFrom').value, to: null };
        } else if (t === 'banking') e = { type: 'banking', category: 'Bank In', from: $('bankFrom').value, to: 'bank' };
        else if (t === 'withdrawal') e = { type: 'withdrawal', category: 'Bank Out', from: 'bank', to: $('wdTo').value };
        else if (t === 'transfer') { const [f, to] = $('trDir').value.split('>'); e = { type: 'transfer', category: 'Transfer', from: f, to }; }
        else if (t === 'savings') e = { type: 'savings', category: 'Savings', from: $('savFrom').value, to: 'savings' };
        Object.assign(e, { amount: amt, note, day });
    }
    const b = db.batch();
    writeEntries(b, [e]);
    commit(b, '✅ Entry added');
    navigator.vibrate?.(40);
    $('entryAmt').value = ''; $('entryNote').value = '';
    if (t === 'adjust') setTimeout(adjHint, 300);
}

function entryLabel(e) {
    const a = k => ACCT[k] || '';
    switch (e.type) {
        case 'expense': return `💸 ${esc(e.category)} · ${a(e.from)}`;
        case 'banking': return `🏦 Bank in ← ${a(e.from)}`;
        case 'withdrawal': return `💳 Bank out → ${a(e.to)}`;
        case 'transfer': return `🔄 ${a(e.from)} → ${a(e.to)}`;
        case 'savings': return `💰 To savings ← ${a(e.from)}`;
        case 'adjust': return `⚖️ ${e.to ? a(e.to) + ' +' : a(e.from) + ' −'} correction`;
        default: return esc(e.type);
    }
}
function entryLine(e) {
    const [bar, bg] = ENTRY_COLORS[e.type] || ENTRY_COLORS.expense;
    return `<div class="list-line" style="background:${bg};border-left-color:${bar};">
        <div class="ll-main"><div class="ll-title">${entryLabel(e)}</div>
            <div class="ll-sub">${timeOf(e.createdAt)}${e.note ? ' · ' + esc(e.note) : ''}${e.staffName ? ' · ' + esc(e.staffName) : ''}</div></div>
        <div class="ll-amt">${n0(e.amount)}</div>
        <button class="tiny-btn red" onclick="deleteEntry('${e.id}')">🗑️</button>
    </div>`;
}
S.entryCache = {};
function watchEntryDay() {
    S.sheetListeners.forEach(u => u()); S.sheetListeners = [];
    const d = $('entryDate').value; if (!d) return;
    $('entryDayList').innerHTML = '<div style="font-size:0.75rem;color:var(--gray);text-align:center;padding:8px;">Loading…</div>';
    S.sheetListeners.push(col('entries').where('day', '==', d).onSnapshot(s => {
        const list = s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (a.createdAt?.toMillis?.() || 9e15) - (b.createdAt?.toMillis?.() || 9e15));
        list.forEach(e => S.entryCache[e.id] = e);
        $('entryDayList').innerHTML = list.length ? list.map(entryLine).join('') : '<div style="font-size:0.75rem;color:var(--gray);text-align:center;padding:8px;">No entries for this date yet</div>';
    }, e => { $('entryDayList').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }));
}
async function deleteEntry(id) {
    const e = S.entryCache[id]; if (!e) return;
    if (!await showConfirm(`Delete this entry?<br><b>${entryLabel(e)} · ${fmt(e.amount)}</b><br><span style="font-size:0.75rem;color:#6b7280;">Balances will be corrected.</span>`)) return;
    const b = db.batch();
    writeEntries(b, [e], -1, [id]);
    commit(b, '🗑️ Entry deleted');
}

// ════════════════════════════════════════════════
//  MANUAL SALE
// ════════════════════════════════════════════════
function openManualSale() {
    if (!canManual()) return toast('⚠️ The owner has not allowed sellers to record manual sales.', 'err');
    $('msDate').disabled = !isAdmin();
    $('msDate').value = dayStr(); $('msCash').value = ''; $('msMobile').value = ''; $('msNote').value = '';
    msTotal(); openSheet('sheetManual');
    setTimeout(() => $('msCash').focus(), 250);
}
function msTotal() { $('msTotalLbl').textContent = fmt(num($('msCash').value) + num($('msMobile').value)); }
function saveManualSale() {
    if (!isAdmin()) $('msDate').value = dayStr();
    const day = $('msDate').value, cash = num($('msCash').value), mobile = num($('msMobile').value), total = cash + mobile;
    if (!day) return toast('⚠️ Choose a date.', 'err');
    if (total <= 0) return toast('⚠️ Enter an amount.', 'err');
    const month = day.slice(0, 7), b = db.batch(), ref = col('sales').doc(), why = src('sales', ref.id);
    b.set(ref, {
        kind: 'manual', items: [], total, cash, mobile, day, month, note: $('msNote').value.trim() || 'Manual sale', voided: false,
        staffUid: S.me.uid, staffName: S.me.name, createdAt: now()
    });
    b.set(col('days').doc(day), { day, month, sales: inc(total), cash: inc(cash), mobile: inc(mobile), src: why, updatedAt: now() }, { merge: true });
    b.set(col('meta').doc('balances'), { cash: inc(cash), mobile: inc(mobile), src: why, updatedAt: now() }, { merge: true });
    closeModals();
    b.update(tRef(), { lastSaleAt: now() });   // so Keep HQ sees the shop is trading
    commit(b, `✅ Manual sale of ${fmt(total)} recorded`);
}

// ════════════════════════════════════════════════
//  DAY DETAIL  (find date — view, void sales, delete entries)
// ════════════════════════════════════════════════
S.saleCache = {};
function openDay(d) { $('dayPick').value = d || dayStr(); openSheet('sheetDay'); watchDay(); }
function watchDay() {
    S.sheetListeners.forEach(u => u()); S.sheetListeners = [];
    const d = $('dayPick').value; if (!d) return;
    const state = { sales: null, entries: null };
    const draw = () => { if (state.sales && state.entries) renderDayBody(d, state.sales, state.entries); };
    $('dayBody').innerHTML = '<div class="empty-state">Loading…</div>';
    const fail = e => { $('dayBody').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; };
    S.sheetListeners.push(col('sales').where('day', '==', d).onSnapshot(s => { state.sales = s.docs.map(x => ({ id: x.id, ...x.data() })); draw(); }, fail));
    S.sheetListeners.push(col('entries').where('day', '==', d).onSnapshot(s => { state.entries = s.docs.map(x => ({ id: x.id, ...x.data() })); draw(); }, fail));
}
function renderDayBody(d, sales, entries) {
    const byTime = (a, b) => (a.createdAt?.toMillis?.() || 9e15) - (b.createdAt?.toMillis?.() || 9e15);
    sales.sort(byTime); entries.sort(byTime);
    sales.forEach(s => S.saleCache[s.id] = s); entries.forEach(e => S.entryCache[e.id] = e);
    const x = dayFig(d);
    const cut = barberCut(sales, entries);
    const c = x.closing;
    let html = `<div style="font-size:0.7rem;font-weight:800;color:var(--gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${prettyDay(d)}</div>
        <div class="sum-box">
            <div class="sum-row"><span>${isBarberMode() ? '💈 ' + tl('Money in') : '🛒 Sales'}</span><strong style="color:var(--green);">${fmt(x.sales)}</strong></div>
            <div class="sum-row"><span>&nbsp;&nbsp;💵 Cash / 📱 Simu received</span><span>${n0(x.cash)} / ${n0(x.mobile)}</span></div>
            ${x.credit ? `<div class="sum-row"><span>&nbsp;&nbsp;📒 On credit</span><span style="color:var(--amber);">${n0(x.credit)}</span></div>` : ''}
            ${x.discount ? `<div class="sum-row"><span>&nbsp;&nbsp;🏷️ Discounts given</span><span>${n0(x.discount)}</span></div>` : ''}
            ${x.returns ? `<div class="sum-row"><span>&nbsp;&nbsp;↩️ Returns refunded</span><span style="color:#7c3aed;">−${n0(x.returns)}</span></div>` : ''}
            ${x.debtPaid ? `<div class="sum-row"><span>💰 Debts paid by customers</span><strong style="color:var(--pos);">${fmt(x.debtPaid)}</strong></div>` : ''}
            <div class="sum-row"><span>📦 ${tl(stockWord())}</span><strong style="color:var(--red);">${fmt(x.supplier)}</strong></div>
            ${cut.cost || cut.paidOut ? `<div class="sum-row"><span>💈 ${tl('Barbers earned')}</span><strong style="color:var(--red);">${fmt(cut.cost)}</strong></div>` : ''}
            <div class="sum-row"><span>💸 ${isBarberMode() ? tl('Other expenses') : 'Expenses'}</span><strong style="color:var(--red);">${fmt(x.expense - cut.paidOut)}</strong></div>
            <div class="sum-row"><span>🏦 Banked (net)</span><strong style="color:var(--blue);">${fmt(x.bankIn - x.bankOut)}</strong></div>
            <div class="sum-row big"><span>📈 Day profit</span><strong style="color:${barberProfit(x, cut) >= 0 ? 'var(--green)' : 'var(--red)'};">${fmt(barberProfit(x, cut))}</strong></div>
        </div>`;
    if (c) html += `<div class="hint green">🔒 Closed by ${esc(c.by || '')}${c.bySeller ? ' (seller)' : ''}${c.countedCash != null ? ` · cash counted ${n0(c.countedCash)}` + (c.systemCash != null ? ` (${signed(c.countedCash - c.systemCash)})` : ' — see their cash-up for the difference') : ''}${afterClose(x) ? `<br>⚠️ ${fmt(afterClose(x))} of sales came in after the day was closed.` : ''}</div>`;
    html += `<button class="btn-sec wide" onclick="openEntry('${d}')">➕ Add expense / banking for this date</button>`;
    if (entries.length) html += `<span class="section-label" style="margin-top:12px;">📒 Money entries (${entries.length})</span>` + entries.map(entryLine).join('');
    if (sales.length) {
        html += `<span class="section-label" style="margin-top:12px;">${isBarberMode() ? '💈 ' + tl('Clients') : '🛒 Sales'} (${sales.filter(s => !s.voided).length})</span>`;
        html += sales.map(s => {
            const pays = [s.cash ? '💵 ' + n0(s.cash) : '', s.mobile ? '📱 ' + n0(s.mobile) : '', s.credit ? '📒 credit ' + n0(s.credit) : ''].filter(Boolean).join(' · ');
            const manual = s.kind === 'manual', repay = s.kind === 'repay', ret = s.kind === 'return';
            const label = ret ? `↩️ Return of ${esc(s.refReceipt || '')}` : repay ? '💰 Debt payment' : manual ? '✍️ Manual' : '🛒 Sale';
            return `<div class="list-line ${s.voided ? 'voided' : ''}" style="background:${ret ? '#eff6ff' : repay ? '#e6f6f0' : manual ? '#fefce8' : '#f0fdf4'};border-left-color:${ret ? '#7c3aed' : repay ? 'var(--blue)' : manual ? 'var(--yellow)' : 'var(--pos)'};display:block;">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                    <div class="ll-title">${label} · ${timeOf(s.createdAt)} · ${esc(s.staffName || '')}${s.voided ? ' · VOIDED' : ''}</div>
                    <div class="ll-amt">${ret ? '−' : ''}${n0(s.total)}</div>
                </div>
                <div class="ll-sub">${ret ? 'Refunded ' + [s.cash ? '💵 ' + n0(-s.cash) : '', s.mobile ? '📱 ' + n0(-s.mobile) : '', s.credit ? '📒 off debt ' + n0(-s.credit) : ''].filter(Boolean).join(' · ') + (s.reason ? ' · ' + esc(s.reason) : '') : pays}${s.returnedTotal ? ` · <span style="color:#7c3aed;">↩️ ${n0(s.returnedTotal)} returned</span>` : ''}${s.customer ? ' · 👤 ' + esc(s.customer.name) : ''}${s.discount ? ' · 🏷️ −' + n0(s.discount) : ''}${s.receiptNo ? ' · ' + esc(s.receiptNo) : ''}${s.note ? ' · ' + esc(s.note) : ''}</div>
                ${(s.items || []).map(i => `<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#444;padding:1px 0;"><span>${esc(i.emoji || '')} ${esc(i.name)} × ${qtyTxt(i.qty, { unit: i.unit })}${i.listPrice && Math.abs(i.listPrice - i.unitPrice) >= 0.5 ? ` <span style="color:var(--amber);">@${n0(i.unitPrice)} (was ${n0(i.listPrice)})</span>` : ''}${(i.serials || []).length ? `<br><span style="color:var(--gray);">S/N ${esc(i.serials.join(', '))}</span>` : ''}</span><span>${n0(i.subtotal)}</span></div>`).join('')}
                <div style="text-align:right;margin-top:6px;display:flex;gap:6px;justify-content:flex-end;">
                    ${s.kind === 'pos' || ret ? `<button class="tiny-btn" onclick="receiptMenu(S.saleCache['${s.id}'])">🧾 Receipt</button>` : ''}
                    ${s.kind === 'pos' && !s.voided && canReturn() ? `<button class="tiny-btn" onclick="openReturn('${s.id}')">↩️ Return</button>` : ''}
                    ${s.voided || ret || s.returnedTotal ? '' : `<button class="tiny-btn red" onclick="voidSale('${s.id}')">✖ Void</button>`}
                </div>
            </div>`;
        }).join('');
    }
    if (!sales.length && !entries.length) html += '<div class="empty-state" style="padding:16px;">Nothing recorded on this date.</div>';
    $('dayBody').innerHTML = html;
}
async function voidSale(id) {
    const s = S.saleCache[id]; if (!s || s.voided) return;
    if (s.kind === 'return') return toast('A return cannot be voided. If it was a mistake, sell the items again.', 'err');
    if (s.returnedTotal) return toast('Part of this sale was already returned. Use ↩️ Return for the rest instead of voiding.', 'err');
    const repay = s.kind === 'repay';
    if (s.day !== dayStr()) {
        let closed = null;
        try { closed = ((await col('days').doc(s.day).get()).data() || {}).closing; } catch (e) {}
        if (closed && s.kind === 'pos') return toast(`${prettyDay(s.day)} is already closed. Use ↩️ Return instead — the refund is then recorded today.`, 'err');
        if (closed && !await showConfirm(`⚠️ ${prettyDay(s.day)} was already closed${closed.by ? ' by ' + esc(closed.by) : ''}. Voiding changes that day's figures after the cash was counted.<br><br>Continue?`, 'Continue')) return;
    }
    const msg = repay ? `Void this debt payment of <b>${fmt(s.total)}</b> from ${esc(s.customer.name)}?<br><span style="font-size:0.78rem;color:#6b7280;">The amount goes back onto what they owe.</span>`
        : `Void this sale of <b>${fmt(s.total)}</b>?<br><span style="font-size:0.78rem;color:#6b7280;">The money is taken off the day's sales and the items go back into stock${s.credit ? `, and ${n0(s.credit)} is removed from ${esc(s.customer.name)}'s debt` : ''}. The sale stays visible, marked VOIDED.</span>`;
    if (!await showConfirm(msg, 'Void')) return;
    const b = db.batch();
    b.update(col('sales').doc(id), { voided: true, voidedAt: now(), voidedBy: S.me.name });
    (s.items || []).forEach(i => { if (!i.service && productById(i.productId)) b.update(col('products').doc(i.productId), { stock: inc(i.qty), updatedAt: now() }); });
    const dayUp = { day: s.day, month: s.day.slice(0, 7), cash: inc(-(s.cash || 0)), mobile: inc(-(s.mobile || 0)), updatedAt: now() };
    if (repay) dayUp.debtPaid = inc(-s.total);
    else {
        dayUp.sales = inc(-s.total); dayUp.txCount = inc(s.kind === 'manual' ? 0 : -1);
        if (s.credit) dayUp.credit = inc(-s.credit);
        if (s.discount) dayUp.discount = inc(-s.discount);
    }
    b.set(col('days').doc(s.day), dayUp, { merge: true });
    b.set(col('meta').doc('balances'), { cash: inc(-(s.cash || 0)), mobile: inc(-(s.mobile || 0)), updatedAt: now() }, { merge: true });
    (s.items || []).forEach(i => (i.serials || []).forEach(sn => b.set(col('serials').doc(serialId(sn)), {
        serial: sn, productId: i.productId, name: i.name, status: 'in', saleId: null, soldAt: null, soldBy: null, customerName: null, updatedAt: now() }, { merge: true })));
    if (s.customer && s.customer.id) {
        if (repay) b.update(col('customers').doc(s.customer.id), { balance: inc(s.total), updatedAt: now() });
        else b.update(col('customers').doc(s.customer.id), { balance: inc(-(s.credit || 0)), totalBought: inc(-s.total), updatedAt: now() });
    }
    commit(b, '↩️ Voided');
}

// ════════════════════════════════════════════════
