// Keep till — Warranty lookup, cash-ups, close day, close month, insights.
// Part of app/index.html; the parts load in order and share one global scope.
//  SERIAL / IMEI & WARRANTY LOOKUP
// ════════════════════════════════════════════════
function serialLookup() { $('serialQ').value = ''; $('serialOut').innerHTML = '<div class="hint gray">Find who bought a phone, laptop or tool, when, and whether the warranty is still valid.</div>'; openSheet('sheetSerial'); setTimeout(() => $('serialQ').focus(), 250); }
async function runSerialLookup() {
    const q = $('serialQ').value.trim(); if (!q) return;
    $('serialOut').innerHTML = '<div class="empty-state">Searching…</div>';
    try {
        const [s, reg] = await Promise.all([col('sales').where('serials', 'array-contains', q).get(), col('serials').doc(serialId(q)).get()]);
        const L = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.kind === 'pos').sort((a, b) => (tms(b.createdAt) || 0) - (tms(a.createdAt) || 0));
        L.forEach(x => S.saleCache[x.id] = x);
        const r = reg.exists ? reg.data() : null;
        const regBox = r ? `<div class="hint ${r.status === 'in' ? 'green' : r.status === 'damaged' ? 'amber' : 'gray'}">${r.status === 'in' ? `📦 <b>On the shelf</b> — ${esc(r.name)}${tms(r.receivedAt) ? ', received ' + new Date(tms(r.receivedAt)).toLocaleDateString('en-GB') : ''}${r.receivedBy ? ' by ' + esc(r.receivedBy) : ''}${r.returnedAt ? ' (came back on a return)' : ''}`
            : r.status === 'damaged' ? `🛠️ <b>Returned as damaged / faulty</b> — ${esc(r.name)}` : `✅ <b>Sold</b> — ${esc(r.name)}${r.soldBy ? ' by ' + esc(r.soldBy) : ''}${r.customerName ? ' to ' + esc(r.customerName) : ''}`}</div>` : '';
        $('serialOut').innerHTML = regBox + (L.length ? L.map(x => {
            const it = (x.items || []).find(i => (i.serials || []).includes(q)) || {};
            const end = it.warrantyMonths ? warrantyEnd(x, it) : null, valid = end && end > new Date() && !x.voided;
            return `<div class="sum-box" style="${x.voided ? 'opacity:.6;' : ''}">
                <div class="sum-row"><span>Item</span><strong>${esc(it.emoji || '')} ${esc(it.name || '')}</strong></div>
                <div class="sum-row"><span>Serial / IMEI</span><strong>${esc(q)}</strong></div>
                <div class="sum-row"><span>Sold</span><strong>${prettyDay(x.day)} ${timeOf(x.createdAt)}</strong></div>
                <div class="sum-row"><span>Price</span><strong>${fmt(it.unitPrice)}</strong></div>
                <div class="sum-row"><span>Customer</span><strong>${x.customer ? esc(x.customer.name) + (x.customer.phone ? ' · ' + esc(prettyPhone(x.customer.phone)) : '') : '—'}</strong></div>
                <div class="sum-row"><span>Sold by</span><strong>${esc(x.staffName || '')} · ${esc(x.receiptNo || '')}</strong></div>
                <div class="sum-row"><span>Warranty</span><strong class="${valid ? 'warranty-ok' : 'warranty-no'}">${x.voided ? 'Sale was voided' : !end ? 'No warranty' : (valid ? '✅ Valid until ' : '❌ Ended ') + end.toLocaleDateString('en-GB')}</strong></div>
                ${(x.returnedSerials || []).includes(q) ? '<div class="hint gray" style="margin:8px 0 0;">↩️ This unit was returned.</div>' : ''}
                <div class="row-btns" style="margin:8px 0 0;">
                    <button class="btn-sec" onclick="receiptMenu(S.saleCache['${x.id}'])">🧾 Receipt</button>
                    ${!x.voided && canReturn() && !(x.returnedSerials || []).includes(q) ? `<button class="btn-sec" onclick="openReturn('${x.id}')">↩️ Return</button>` : ''}
                </div>
            </div>`;
        }).join('') : r ? '' : `<div class="hint amber">No record of serial <b>${esc(q)}</b> in this shop. Check the number.</div>`);
    } catch (e) { $('serialOut').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }
}

// ════════════════════════════════════════════════
//  SHIFT CASH-UPS  — built for an owner who is NOT at the shop
//  1. The seller ends their shift: counts the drawer (blind — the app never
//     shows them what it expects) and lists any money paid out of the drawer.
//  2. The owner reviews each cash-up from anywhere: counted vs expected,
//     approves the paid-outs as expenses, and records any shortage.
//  3. The owner closes the day remotely.
// ════════════════════════════════════════════════
S.pendingCashups = [];
const TSms = m => firebase.firestore.Timestamp.fromMillis(m);
const nowMs = () => Date.now();

function myShiftStart() {
    const mine = (S.myCashups || []).filter(c => tms(c.createdAt)).map(c => tms(c.createdAt));
    return mine.length ? Math.max(...mine) : null;
}
function poRowHtml() {
    return `<div class="po-row">
        <select data-k="category">${EXPENSE_CATS.map(([v, l]) => `<option value="${v}" ${v === 'Other' ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input data-k="amount" type="number" inputmode="decimal" placeholder="Amount">
        <button class="tiny-btn red" onclick="this.parentElement.remove()">✕</button>
        <input data-k="note" type="text" placeholder="What for? e.g. LUKU token" style="grid-column:1/-1;">
    </div>`;
}
function addPaidOut() { $('poRows').insertAdjacentHTML('beforeend', poRowHtml()); }

async function openShiftEnd() {
    if (isBarberMode() && !(await payBarbersToday(true, 'shift'))) return;
    ['shCash', 'shMobile', 'shNote'].forEach(id => $(id).value = '');
    $('poRows').innerHTML = '';
    openSheet('sheetShift');
    $('shCloseWrap').classList.toggle('hidden', !canCloseDay()); $('shCloseDay').checked = false; $('shBtn').textContent = '✅ SUBMIT CASH-UP';
    renderShiftInfo(); S.shiftDeliveries = []; $('shDeliveries').innerHTML = ''; loadShiftDeliveries();
    S.sheetListeners.push(col('cashups').where('staffUid', '==', S.me.uid).where('day', '==', dayStr()).onSnapshot(s => {
        S.myCashups = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderShiftInfo();
        const list = [...S.myCashups].sort((a, b) => (tms(b.createdAt) || 9e15) - (tms(a.createdAt) || 9e15));
        $('shMine').innerHTML = list.length ? `<span class="section-label" style="margin-top:12px;">Your cash-ups today</span>` + list.map(c => `
            <div class="list-line" style="background:#f8fafc;border-left-color:${c.status === 'confirmed' ? 'var(--pos)' : 'var(--yellow)'};">
                <div class="ll-main"><div class="ll-title">${timeOf(c.createdAt)} · counted ${n0(c.countedCash)}</div>
                <div class="ll-sub">${c.status === 'confirmed' ? '✅ Checked by ' + esc(c.reviewedBy || 'owner') : '⏳ Waiting for the owner'}</div></div>
            </div>`).join('') : '';
    }, () => {}));
    setTimeout(() => $('shCash').focus(), 250);
}
async function loadShiftDeliveries() {
    S.shiftDeliveries = await myDrawerDeliveries();
    $('shDeliveries').innerHTML = S.shiftDeliveries.length ? `<div class="hint gray" style="margin:0 0 8px;">🚚 Deliveries you paid from the drawer (added automatically):<br>` +
        S.shiftDeliveries.map(d => `• ${esc(d.receiptNo)}${d.supplier ? ' · ' + esc(d.supplier) : ''} — <b>${n0(d.total)}</b>`).join('<br>') + '</div>' : '';
}
function renderShiftInfo() {
    const since = myShiftStart();
    const mine = S.todaySales.filter(x => !x.voided && (!x.kind || x.kind === 'pos') && x.staffUid === S.me.uid && (!since || (tms(x.createdAt) || 9e15) > since));
    $('shiftInfo').innerHTML = `👤 <b>${esc(S.me.name)}</b> · ${since ? 'since your last cash-up at ' + new Date(since).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'today'}<br>
        ${isBarberMode() ? `${tl('You recorded')} <b>${mine.length}</b> ${tl(mine.length === 1 ? 'client' : 'clients')}. ${tl('Count all the cash in the drawer, including change.')}` : `You made <b>${mine.length}</b> sale${mine.length === 1 ? '' : 's'}. Count <b>all</b> the cash in the drawer, including change.`}`;
}

async function submitShift() {
    if ($('shCash').value.trim() === '') return toast('⚠️ Count the cash in the drawer and type it.', 'err');
    if (isBarberMode()) {
        const owed = (await barbersOwedToday()).filter(r => r.owed > 0);
        if (owed.length) { toast('⚠️ ' + tl('Pay the barbers first, then count the drawer again.'), 'err'); payBarbersToday(true); return; }
    }
    const countedCash = num($('shCash').value);
    const countedMobile = $('shMobile').value.trim() === '' ? null : num($('shMobile').value);
    const paidOuts = [];
    for (const r of document.querySelectorAll('#poRows .po-row')) {
        const amount = num(r.querySelector('[data-k=amount]').value), note = r.querySelector('[data-k=note]').value.trim();
        if (!amount && !note) continue;
        if (amount <= 0) return toast('⚠️ Enter the amount for each payment.', 'err');
        if (!note) return toast('⚠️ Say what each payment was for.', 'err');
        paidOuts.push({ category: r.querySelector('[data-k=category]').value, amount, note });
    }
    (S.shiftDeliveries || []).forEach(d => paidOuts.push({ category: 'Supplier', amount: d.total, note: `Delivery ${d.receiptNo}${d.supplier ? ' · ' + d.supplier : ''}`, deliveryId: d.id }));
    const paidOutTotal = paidOuts.reduce((a, p) => a + p.amount, 0);
    const since = myShiftStart();
    const salesCount = S.todaySales.filter(x => !x.voided && (!x.kind || x.kind === 'pos') && x.staffUid === S.me.uid && (!since || (tms(x.createdAt) || 9e15) > since)).length;
    const msg = `Submit your cash-up?<br><br>💵 Cash counted: <b>${fmt(countedCash)}</b>${countedMobile !== null ? `<br>📱 Lipa kwa Simu: <b>${fmt(countedMobile)}</b>` : ''}${paidOuts.length ? `<br>💸 Paid out: <b>${fmt(paidOutTotal)}</b>` : ''}`;
    if (!await showConfirm(msg, 'Submit', 'var(--pos)')) return;
    const day = dayStr(), b = db.batch();
    b.set(col('cashups').doc(), {
        staffUid: S.me.uid, staffName: S.me.name, day, month: day.slice(0, 7),
        countedCash, countedMobile, paidOuts, paidOutTotal, note: $('shNote').value.trim(), salesCount,
        status: 'pending', createdAt: now()
    });
    const closeDay = canCloseDay() && $('shCloseDay').checked, df = todaySalesFig();
    if (closeDay) b.set(col('days').doc(day), { day, month: day.slice(0, 7), closing: { by: S.me.name, bySeller: true, at: now(), countedCash, countedMobile, paidOut: paidOutTotal, sales: df.sales }, updatedAt: now() }, { merge: true });
    commit(b, closeDay ? '🔒 Day closed — summary ready for the owner' : '✅ Cash-up sent to the owner', { label: `${closeDay ? 'Close day + cash-up' : 'Cash-up'}: counted ${n0(countedCash)}` });
    closeModals();
    const wa = String((S.tenantInfo.settings || {}).whatsapp || '').replace(/\D/g, '');
    const text = closeDay ? `🔒 *Day closed — ${(S.tenantInfo.name || S.tenant)}*\n📅 ${prettyDay(day)} · closed by ${S.me.name} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}\n\n🛒 Sales today: ${n0(df.sales)} (${df.n} POS sales)\n💵 Cash taken: ${n0(df.cash)} · 📱 Simu: ${n0(df.mobile)}${df.credit ? `\n📒 On credit: ${n0(df.credit)}` : ''}${df.debt ? `\n💰 Debts collected: ${n0(df.debt)}` : ''}${df.returns ? `\n↩️ Returns: ${n0(df.returns)}` : ''}\n\n🧾 My cash-up\n💵 Cash counted: ${n0(countedCash)}${countedMobile !== null ? `\n📱 Simu balance: ${n0(countedMobile)}` : ''}${paidOuts.length ? '\n💸 Paid out:\n' + paidOuts.map(p => `• ${p.note} — ${n0(p.amount)}`).join('\n') : ''}${$('shNote').value.trim() ? '\n\n' + KEEP_RAW + '📝 ' + $('shNote').value.trim() : ''}\n\nCheck the cash-up in Keep POS to see if the drawer matches.` : `🧾 *Cash-up — ${(S.tenantInfo.name || S.tenant)}*\n👤 ${S.me.name} · ${prettyDay(day)} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}\n\n💵 Cash counted: ${n0(countedCash)}${countedMobile !== null ? `\n📱 Lipa kwa Simu: ${n0(countedMobile)}` : ''}\n🛒 My sales this shift: ${salesCount}${paidOuts.length ? '\n\n💸 Paid out of the drawer:\n' + paidOuts.map(p => `• ${p.note} — ${n0(p.amount)}`).join('\n') : ''}${$('shNote').value.trim() ? '\n\n' + KEEP_RAW + '📝 ' + $('shNote').value.trim() : ''}\n\nPlease review it in Keep POS.`;
    if (wa && await showConfirm(closeDay ? 'Send the day summary to the owner on WhatsApp?' : 'Also send the cash-up to the owner on WhatsApp?', '📲 WhatsApp', 'var(--pos)')) await waAuto(wa, 'cashup', [S.tenantInfo.name || S.tenant, S.me.name, tl(prettyDay(day)), n0(countedCash), closeDay ? tl('Day closed') : tl('Cash-up')], text);
    if (await showConfirm('Your shift is done. Sign out now so the next person can sign in?', 'Sign out', 'var(--blue)')) logout('👋 Shift ended');
}

// ── Owner side ───────────────────────────────────────────
// What the system says the shop held at a past moment t:
// today's balance minus every money movement recorded after t.
async function balanceAt(t) {
    const ts = TSms(t);
    const [after, voided, ents] = await Promise.all([
        col('sales').where('createdAt', '>', ts).get(),
        col('sales').where('voidedAt', '>', ts).get(),
        col('entries').where('createdAt', '>', ts).get()
    ]);
    const b = { cash: +S.balances.cash || 0, mobile: +S.balances.mobile || 0, bank: +S.balances.bank || 0, savings: +S.balances.savings || 0 };
    after.docs.forEach(d => { const x = d.data(); if (x.voided) return; b.cash -= x.cash || 0; b.mobile -= x.mobile || 0; });
    voided.docs.forEach(d => { const x = d.data(); if ((tms(x.createdAt) || 0) > t) return; b.cash += x.cash || 0; b.mobile += x.mobile || 0; });
    ents.docs.forEach(d => {
        const e = d.data(), a = +e.amount || 0;
        // Entries made when reviewing an EARLIER cash-up describe money that moved before t — keep them.
        if (tms(e.cashupAt) && tms(e.cashupAt) < t) return;
        if (e.from) b[e.from] = (b[e.from] || 0) + a;
        if (e.to) b[e.to] = (b[e.to] || 0) - a;
    });
    return b;
}
function diffWord(v) {
    if (Math.abs(v) < 1) return ['✓ Exact', 'var(--green)', '#e6f6f0'];
    return v < 0 ? ['Short ' + n0(-v), 'var(--red)', '#fee2e2'] : ['Over ' + n0(v), '#1d4ed8', '#eff6ff'];
}

S.cashupCache = {};
function openCashups() {
    openSheet('sheetCashups');
    renderCashupList();
    const since = TSms(nowMs() - 14 * 864e5);
    S.sheetListeners.push(col('cashups').where('createdAt', '>=', since).onSnapshot(s => {
        S.recentCashups = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCashupList();
    }, e => { $('cuList').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }));
}
function cashupLine(c) {
    S.cashupCache[c.id] = c;
    const done = c.status === 'confirmed';
    const [w, col_] = done ? diffWord(c.diffCash || 0) : ['⏳ To review', 'var(--amber)'];
    return `<div class="entry-item" style="padding:11px 13px;border-left-color:${done ? (Math.abs(c.diffCash || 0) < 1 ? 'var(--pos)' : 'var(--red)') : 'var(--yellow)'};" onclick="openCashup('${c.id}')">
        <div style="min-width:0;flex:1;"><div class="entry-date" style="font-size:.84rem;">${esc(c.staffName)} · ${shortDay(c.day)} ${timeOf(c.createdAt)}</div>
            <div class="entry-meta">💵 counted ${n0(c.countedCash)}${c.paidOutTotal ? ' · 💸 paid out ' + n0(c.paidOutTotal) : ''}${c.note ? ' · 📝' : ''}</div></div>
        <div style="font-size:.72rem;font-weight:800;color:${col_};white-space:nowrap;">${w}</div>
    </div>`;
}
function renderCashupList() {
    const pend = S.pendingCashups || [];
    const done = (S.recentCashups || []).filter(c => c.status === 'confirmed').sort((a, b) => (tms(b.createdAt) || 0) - (tms(a.createdAt) || 0));
    const short = done.filter(c => (c.diffCash || 0) < -1).reduce((a, c) => a + c.diffCash, 0);
    $('cuList').innerHTML = `
        <span class="section-label">To review${pend.length ? ' (oldest first)' : ''}</span>
        ${pend.length ? pend.map(cashupLine).join('') : '<div class="empty-state" style="padding:12px;">✅ Nothing waiting.</div>'}
        <span class="section-label" style="margin-top:10px;">Checked · last 14 days${short ? ` · <span style="color:var(--red);">short ${n0(-short)} total</span>` : ''}</span>
        ${done.length ? done.map(cashupLine).join('') : '<div class="empty-state" style="padding:12px;">None yet.</div>'}`;
}

async function openCashup(id) {
    const c = S.cashupCache[id]; if (!c) return;
    openSheet('sheetCashup');
    const box = $('cuBody');
    box.innerHTML = '<div class="empty-state">Working out what should be in the drawer…</div>';
    let exp;
    try {
        exp = c.status === 'confirmed' ? { cash: c.expectedCash, mobile: c.expectedMobile } : await balanceAt(tms(c.createdAt) || nowMs());
    } catch (e) { box.innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; return; }
    const po = c.paidOutTotal || 0, expAfter = exp.cash - po;
    const dCash = c.countedCash - expAfter, dMob = c.countedMobile == null || exp.mobile == null ? null : c.countedMobile - exp.mobile;
    const [w, colr, bg] = diffWord(dCash);
    S.review = { c, exp, dCash, dMob };
    const done = c.status === 'confirmed';
    box.innerHTML = `
        <div style="text-align:center;font-size:.8rem;color:var(--gray);margin-bottom:10px;">👤 <b style="color:var(--ink);">${esc(c.staffName)}</b> · ${prettyDay(c.day)} · ${timeOf(c.createdAt)} · ${c.salesCount || 0} sales</div>
        <div class="diff-big" style="background:${bg};color:${colr};"><small>Cash in drawer</small><span>${w}</span></div>
        <div class="sum-box">
            <div class="sum-row"><span>💵 System expected</span><strong>${fmt(exp.cash)}</strong></div>
            ${po ? `<div class="sum-row"><span>💸 Paid out by ${esc(c.staffName.split(' ')[0])}</span><strong style="color:var(--red);">−${fmt(po)}</strong></div>
            <div class="sum-row"><span>Should be in the drawer</span><strong>${fmt(expAfter)}</strong></div>` : ''}
            <div class="sum-row big"><span>Counted</span><strong>${fmt(c.countedCash)}</strong></div>
        </div>
        ${dMob !== null ? `<div class="sum-box">
            <div class="sum-row"><span>📱 Lipa kwa Simu expected</span><strong>${fmt(exp.mobile)}</strong></div>
            <div class="sum-row"><span>📱 Balance seen</span><strong style="color:${diffWord(dMob)[1]};">${fmt(c.countedMobile)} · ${diffWord(dMob)[0]}</strong></div>
        </div>` : ''}
        ${(c.paidOuts || []).length ? `<span class="section-label">Paid out of the drawer</span>` + c.paidOuts.map(p => `
            <div class="list-line"><div class="ll-main"><div class="ll-title">${esc(p.note)}</div><div class="ll-sub">${esc((EXPENSE_CATS.find(x => x[0] === p.category) || [, p.category])[1])}</div></div><div class="ll-amt">${n0(p.amount)}</div></div>`).join('') : ''}
        ${c.note ? `<div class="hint gray">📝 “${esc(c.note)}”</div>` : ''}
        ${done ? `<div class="hint green">✅ Checked by ${esc(c.reviewedBy || '')}${c.ownerNote ? '<br>📝 ' + esc(c.ownerNote) : ''}${c.corrected ? '<br>Balances were corrected to the count.' : ''}${c.paidOutsRecorded ? '<br>Paid-outs recorded as expenses.' : ''}</div>` : `
        <span class="section-label">Your decision</span>
        ${po ? `<label class="check"><input type="checkbox" id="cuRecordPo" checked><span>Record the paid-outs (${fmt(po)}) as expenses from cash</span></label>` : ''}
        ${Math.abs(dCash) >= 1 || (dMob !== null && Math.abs(dMob) >= 1) ? `<label class="check"><input type="checkbox" id="cuCorrect" checked><span>Set the system balance to what was counted — the ${dCash < 0 ? 'shortage' : 'difference'} is kept on record against ${esc(c.staffName.split(' ')[0])}</span></label>` : ''}
        <div class="field-group" style="margin-top:6px;"><span class="field-label">Note (optional)</span><input type="text" id="cuOwnerNote" placeholder="e.g. Juma will refund 2,000"></div>
        <button class="primary-cta green" id="cuBtn" onclick="confirmCashup()">✅ CONFIRM CASH-UP</button>`}`;
}

async function confirmCashup() {
    const { c, exp, dCash, dMob } = S.review;
    const recordPo = $('cuRecordPo') ? $('cuRecordPo').checked : false;
    const correct = $('cuCorrect') ? $('cuCorrect').checked : false;
    const ownerNote = $('cuOwnerNote').value.trim();
    const at = c.createdAt, first = c.staffName.split(' ')[0], entries = [];
    if (recordPo) (c.paidOuts || []).forEach(p => entries.push({ type: 'expense', category: p.category, from: 'cash', to: null, amount: p.amount, note: `${p.note} (paid by ${first})`, day: c.day }));
    if (correct) {
        if (Math.abs(dCash) >= 1) entries.push({ type: 'adjust', category: 'Cash-up difference', from: dCash < 0 ? 'cash' : null, to: dCash > 0 ? 'cash' : null, amount: Math.abs(dCash), note: `Cash-up ${first}: ${dCash < 0 ? 'short' : 'over'} ${n0(Math.abs(dCash))}`, day: c.day });
        if (dMob !== null && Math.abs(dMob) >= 1) entries.push({ type: 'adjust', category: 'Cash-up difference', from: dMob < 0 ? 'mobile' : null, to: dMob > 0 ? 'mobile' : null, amount: Math.abs(dMob), note: `Cash-up ${first}: Lipa kwa Simu ${dMob < 0 ? 'short' : 'over'} ${n0(Math.abs(dMob))}`, day: c.day });
    }
    entries.forEach(e => { e.cashupId = c.id; e.cashupAt = at; });
    const b = db.batch();
    if (entries.length) writeEntries(b, entries);
    b.update(col('cashups').doc(c.id), {
        status: 'confirmed', expectedCash: exp.cash, expectedMobile: exp.mobile ?? null, diffCash: dCash, diffMobile: dMob,
        paidOutsRecorded: recordPo, corrected: correct, ownerNote, reviewedBy: S.me.name, reviewedAt: now()
    });
    $('cuBtn').disabled = true;
    await commit(b, '✅ Cash-up confirmed');
    const seller = (S.staffAll || []).find(x => x.uid === c.staffUid);
    const phone = seller && /^\d+$/.test(seller.loginId || '') ? seller.loginId : '';
    if (phone && Math.abs(dCash) >= 1 && await showConfirm(`Tell ${esc(first)} about the ${dCash < 0 ? 'shortage' : 'difference'} on WhatsApp?`, '📲 WhatsApp', 'var(--pos)')) {
        const should = n0(exp.cash - (c.paidOutTotal || 0)), note = ownerNote ? '\n\n' + KEEP_RAW + ownerNote : '';
        const text = isSw()
            ? KEEP_RAW + `Habari ${first}, nimekagua hesabu yako ya ${tl(prettyDay(c.day))} ${timeOf(c.createdAt)}.\n${KEEP_RAW}Uliyohesabu: ${n0(c.countedCash)}\n${KEEP_RAW}Ilipaswa kuwa: ${should}\n${KEEP_RAW}${dCash < 0 ? 'Upungufu' : 'Ziada'}: ${n0(Math.abs(dCash))}${note}`
            : `Habari ${first}, I checked your cash-up of ${prettyDay(c.day)} ${timeOf(c.createdAt)}.\nCounted: ${n0(c.countedCash)}\nShould have been: ${should}\n${dCash < 0 ? 'Short' : 'Over'}: ${n0(Math.abs(dCash))}${note}`;
        openWa(phone, text);
    }
    openCashups();
}

// ════════════════════════════════════════════════
//  CLOSE DAY  → WhatsApp summary
// ════════════════════════════════════════════════
function openCloseDay() {
    $('cdStep1').classList.remove('hidden'); $('cdStep2').classList.add('hidden');
    $('cdDate').value = dayStr();
    ['cdCash', 'cdMobile', 'cdBank'].forEach(id => $(id).value = '');
    openSheet('sheetCloseDay');
    loadCdCashups();
}
async function loadCdCashups() {
    const d = $('cdDate').value || dayStr(), box = $('cdCashups');
    box.innerHTML = '<div style="font-size:.75rem;color:var(--gray);padding:6px 0;">Loading…</div>';
    try {
        const s = await col('cashups').where('day', '==', d).get();
        S.cdCashups = s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (tms(a.createdAt) || 0) - (tms(b.createdAt) || 0));
    } catch (e) { box.innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; S.cdCashups = []; return; }
    const pend = S.cdCashups.filter(c => c.status !== 'confirmed').length;
    box.innerHTML = (S.cdCashups.length ? S.cdCashups.map(cashupLine).join('') : `<div class="hint gray">${isBarberMode() ? tl('Nobody has ended a shift on this day yet. You can still close the day.') : 'No seller has ended a shift on this day yet. You can still close the day.'}</div>`)
        + (pend ? `<div class="hint amber">⚠️ ${pend} cash-up${pend > 1 ? 's' : ''} not checked yet. Tap ${pend > 1 ? 'each one' : 'it'} to review before closing.</div>` : '');
}
async function confirmCloseDay() {
    const d = $('cdDate').value || dayStr();
    if (isBarberMode() && d === dayStr() && !(await payBarbersToday(true))) return;
    const val = id => $(id).value.trim() === '' ? null : num($(id).value);
    const counted = { cash: val('cdCash'), mobile: val('cdMobile'), bank: val('cdBank') };
    const x = dayFig(d), bal = S.balances;
    const fp = (await dayProfitFull(d, x)) || fullProfit(x, d === dayStr() ? (S.todaySales || []) : [], []);
    const dcut = { cost: fp.barbers, paidOut: fp.barberPaid }, profit = fp.profit;
    const outItems = S.products.filter(p => !isService(p) && (Number(p.stock) || 0) <= 0);
    const lowItems = S.products.filter(p => !isService(p) && p.stock > 0 && p.stock <= (Number(p.reorderLevel) || 5));
    const expItems = expiringItems();
    const isToday = d === dayStr();

    const cus = S.cdCashups || [];
    const cuLines = cus.map(c => {
        const st = c.status === 'confirmed' ? diffWord(c.diffCash || 0)[0] : 'not checked';
        return `${c.staffName.split(' ')[0]} ${timeOf(c.createdAt)}: counted ${n0(c.countedCash)} — ${st}`;
    });
    const cuShort = cus.filter(c => c.status === 'confirmed').reduce((a, c) => a + Math.min(0, c.diffCash || 0), 0);
    const b = db.batch();
    b.set(col('days').doc(d), {
        day: d, month: d.slice(0, 7), updatedAt: now(),
        closing: {
            countedCash: counted.cash, countedMobile: counted.mobile, countedBank: counted.bank,
            systemCash: bal.cash, systemMobile: bal.mobile, systemBank: bal.bank, by: S.me.name, at: now(),
            sales: x.sales, cashups: cus.length, cashupShort: cuShort
        }
    }, { merge: true });
    commit(b);

    const recon = [];
    const diffRow = (label, c, sys) => {
        if (c === null) return '';
        recon.push(`${label}: counted ${n0(c)} vs system ${n0(sys)} → ${signed(c - sys)}`);
        const ok = Math.abs(c - sys) < 1;
        return `<div class="sum-row"><span>${label} counted</span><strong style="color:${ok ? 'var(--green)' : 'var(--red)'};">${n0(c)} ${ok ? '✓' : '(' + signed(c - sys) + ')'}</strong></div>`;
    };
    $('cdSummary').innerHTML = `
        <div style="font-size:0.7rem;font-weight:800;color:var(--gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${prettyDay(d)}</div>
        <div class="sum-box">
            <div class="sum-row"><span>${isBarberMode() ? '💈 ' + tl('Money in') : '🛒 Sales'}</span><strong style="color:var(--green);">+${fmt(x.sales)}</strong></div>
            <div class="sum-row"><span>&nbsp;&nbsp;💵 Cash / 📱 Simu received</span><span>${n0(x.cash)} / ${n0(x.mobile)}</span></div>
            ${x.credit ? `<div class="sum-row"><span>&nbsp;&nbsp;📒 Sold on credit</span><span style="color:var(--amber);">${n0(x.credit)}</span></div>` : ''}
            ${x.discount ? `<div class="sum-row"><span>&nbsp;&nbsp;🏷️ Discounts given</span><span>${n0(x.discount)}</span></div>` : ''}
            ${x.returns ? `<div class="sum-row"><span>&nbsp;&nbsp;↩️ Returns refunded</span><span>−${n0(x.returns)}</span></div>` : ''}
            ${x.debtPaid ? `<div class="sum-row"><span>💰 Debts paid by customers</span><span style="color:var(--pos);">${n0(x.debtPaid)}</span></div>` : ''}
            <div class="sum-row"><span>📦 ${costWord()}</span><strong style="color:var(--red);">-${fmt(costOf(fp))}</strong></div>
            ${fp.barbers ? `<div class="sum-row"><span>💈 ${tl('Barbers earned')}</span><strong style="color:var(--red);">-${fmt(fp.barbers)}</strong></div>` : ''}
            <div class="sum-row"><span>💸 ${fp.barbers || fp.barberPaid ? tl('Other expenses') : 'Expenses'}</span><strong style="color:var(--red);">-${fmt(fp.otherExpense)}</strong></div>
            <div class="sum-row"><span>🏦 Banked</span><strong style="color:var(--blue);">${fmt(x.bankIn)}${x.bankOut ? ' / out ' + n0(x.bankOut) : ''}</strong></div>
            <div class="sum-row big"><span>📈 Day profit</span><strong style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};">${fmt(profit)}</strong></div>
            ${x.supplier && !isBarberMode() ? `<div class="sum-row"><span style="color:var(--gray);">📥 ${tl('Stock bought (not in profit)')}</span><span>${n0(x.supplier)}</span></div>` : ''}
        </div>${fp.missing.length ? `<div class="hint amber">⚠️ ${esc(missingCostNote(fp.missing))}</div>` : ''}
        ${counted.cash !== null || counted.mobile !== null || counted.bank !== null ? `<div class="sum-box">
            ${!isToday ? '<div class="hint amber" style="margin-bottom:6px;">Comparing with balances as they are right now, not at the end of that day.</div>' : ''}
            ${diffRow('💵 Cash', counted.cash, bal.cash)}${diffRow('📱 Lipa kwa Simu', counted.mobile, bal.mobile)}${diffRow('🏦 Bank', counted.bank, bal.bank)}
        </div>` : ''}
        ${cus.length ? `<span class="section-label">🧾 Cash-ups</span><div class="sum-box">${cus.map((c, i) => {
            const [w, colr] = c.status === 'confirmed' ? diffWord(c.diffCash || 0) : ['not checked', 'var(--amber)'];
            return `<div class="sum-row"><span>${esc(c.staffName)} · ${timeOf(c.createdAt)}</span><strong style="color:${colr};">${n0(c.countedCash)} · ${w}</strong></div>`;
        }).join('')}</div>` : ''}
        <div class="mini-cards">
            <div><b style="color:var(--pos);">${x.tx}</b><small>${isBarberMode() ? tl('Clients') : 'POS sales'}</small></div>
            <div style="background:${outItems.length ? '#fff5f5' : '#f0fdf4'};"><b style="color:${outItems.length ? 'var(--red)' : 'var(--green)'};">${outItems.length}</b><small>Out of stock</small></div>
            <div style="background:#fffbeb;"><b style="color:var(--amber);">${lowItems.length}</b><small>Low stock</small></div>
        </div>
        ${outItems.length ? `<div class="hint amber" style="background:#fff5f5;color:var(--red);">🚨 Out of stock: ${esc(outItems.slice(0, 6).map(p => p.name).join(', '))}${outItems.length > 6 ? ' +more' : ''}</div>` : ''}
        ${expItems.length ? `<div class="hint amber">⏳ Expired or expiring soon: ${esc(expItems.slice(0, 6).map(x => x.p.name).join(', '))}${expItems.length > 6 ? ' +more' : ''}</div>` : ''}`;

    S.closeDayMsg = `🏪 *${(S.tenantInfo.name || S.tenant).toUpperCase()}* — ${prettyDay(d)}

${isBarberMode() ? '💈 Money in' : '🛒 Sales'}: ${n0(x.sales)}
💵 Cash in: ${n0(x.cash)} · 📱 Simu in: ${n0(x.mobile)}${x.credit ? `\n📒 On credit: ${n0(x.credit)}` : ''}${x.discount ? `\n🏷️ Discounts: ${n0(x.discount)}` : ''}${x.returns ? `\n↩️ Returns: ${n0(x.returns)}` : ''}${x.debtPaid ? `\n💰 Debts collected: ${n0(x.debtPaid)}` : ''}
📦 ${costWord()}: ${n0(costOf(fp))}
${isBarberMode() ? `💈 Barbers earned: ${n0(dcut.cost)}\n💸 Other expenses: ${n0(fp.otherExpense)}` : `💸 Expenses: ${n0(fp.otherExpense)}`}${x.supplier && !isBarberMode() ? `\n📥 Stock bought: ${n0(x.supplier)}` : ''}
🏦 Banked: ${n0(x.bankIn)}${x.bankOut ? ` | 💳 Out: ${n0(x.bankOut)}` : ''}
━━━━━━━━━━
📈 Day profit: ${n0(profit)}
💵 Cash balance: ${n0(bal.cash)}
📱 Mobile balance: ${n0(bal.mobile)}${recon.length ? '\n\n' + recon.join('\n') : ''}${cuLines.length ? '\n\n🧾 Cash-ups\n' + cuLines.join('\n') + (cuShort ? `\nTotal short: ${n0(-cuShort)}` : '') : ''}

🧾 ${x.tx} ${isBarberMode() ? 'clients' : 'POS sales'}${outItems.length ? `\n🚨 Out of stock: ${outItems.length} items` : ''}${lowItems.length ? `\n⚠️ Low stock: ${lowItems.length} items` : ''}${expItems.length ? `\n⏳ Expiring soon: ${expItems.length} items` : ''}
Closed by ${S.me.name}`;

    $('cdStep1').classList.add('hidden'); $('cdStep2').classList.remove('hidden');
    shareText(S.closeDayMsg);
}
function shareText(text) {
    if (!text) return;
    const wa = String((S.tenantInfo.settings || {}).whatsapp || '').replace(/\D/g, '');
    openWa(wa, text);
}

// ════════════════════════════════════════════════
//  MONTHLY PROFIT & CLOSE MONTH
// ════════════════════════════════════════════════
function openMonth(m) {
    const thisM = dayStr().slice(0, 7);
    $('mcPick').value = m || (new Date().getDate() <= 7 ? prevMonth(thisM) : thisM);
    renderMonthHistory(); renderMonthClose();
    openSheet('sheetMonth');
}
function renderMonthHistory() {
    let m = dayStr().slice(0, 7); const rows = [];
    for (let i = 0; i < 6; i++) { const f = monthFig(m); if (f.hasData) rows.push([m, f]); m = prevMonth(m); }
    const cur = dayStr().slice(0, 7);
    $('mcHistory').innerHTML = '<span class="section-label">Profit by month</span>' + (rows.length ? rows.map(([m, f]) => {
        const pct = f.sales ? Math.round(f.profit / f.sales * 100) : 0;
        const tag = m === cur ? `<span class="tag tag-prog">${tl('In progress')}</span>` : (S.months[m] && S.months[m].closed) ? `<span class="tag tag-closed">✅ ${tl('Closed')}</span>` : `<span class="tag tag-open">${tl('Not closed')}</span>`;
        return `<div class="entry-item" style="padding:10px 14px;" onclick="$('mcPick').value='${m}';renderMonthClose();">
            <div><div class="entry-date">${monthName(m)}${tag}</div><div class="entry-meta">${tl(isBarberMode() ? 'Money in' : 'Sales')} ${n0(f.sales)} · ${tl('Expenses')} ${n0(isBarberMode() ? f.supplier + f.expense : f.expense)}</div></div>
            <div style="text-align:right;font-weight:800;color:${f.profit >= 0 ? 'var(--green)' : 'var(--red)'};">${f.pending ? '…' : signed(f.profit)}<div style="font-size:0.62rem;color:var(--gray);font-weight:600;">${f.pending ? '' : pct + '% margin'}</div></div>
        </div>`;
    }).join('') : '<div class="empty-state">No data yet.</div>');
}
async function renderMonthClose() {
    const m = $('mcPick').value; if (!m) return;
    const f = await monthFigFull(m); if ($('mcPick').value !== m) return;
    const cur = m === dayStr().slice(0, 7), info = S.months[m] || {}, closed = !!info.closed, bal = S.balances;
    S.mc = { m, f };
    const row = (l, v, c) => `<div class="sum-row"><span>${l}</span><strong style="color:${c || 'inherit'};">${v}</strong></div>`;
    let html = `${cur ? `<div class="hint amber">⚠️ ${monthName(m)} isn't over yet — these are month-to-date figures.</div>` : ''}
        <div class="sum-box">
            ${row(isBarberMode() ? '💈 ' + tl('Money in') : '🛒 Sales', fmt(f.sales), 'var(--green)')}
            ${row('📦 ' + costWord(), f.pending ? '…' : '-' + fmt(costOf(f)), 'var(--red)')}
            ${f.barbers ? row('💈 ' + tl('Barbers earned'), '-' + fmt(f.barbers), 'var(--red)') : ''}
            ${row(f.barbers || f.barberPaid ? '💸 ' + tl('Other expenses') : '💸 ' + tl('Expenses'), '-' + fmt(f.otherExpense != null ? f.otherExpense : f.expense), 'var(--red)')}
            ${row('📈 Profit', f.pending ? '…' : fmt(f.profit), f.profit >= 0 ? 'var(--green)' : 'var(--red)')}
            ${f.supplier && !isBarberMode() ? row('📥 ' + tl('Stock bought (not in profit)'), fmt(f.supplier), 'var(--gray)') : ''}
            ${row('🏦 Banked (net)', fmt(f.bankIn - f.bankOut), 'var(--blue)')}
            ${row('💰 Put in savings', fmt(f.toSavings), '#a16207')}
        </div>${f.missing && f.missing.length ? `<div class="hint amber">⚠️ ${esc(missingCostNote(f.missing))}</div>` : ''}`;
    if (closed) html += `<div class="hint green" style="text-align:center;">✅ <b>${monthName(m)} is closed</b> · saved ${fmt(info.saved)} · by ${esc(info.closedBy || '')}</div>`
        + (isAdmin() ? `<button class="btn-sec wide" style="margin-bottom:12px;" onclick="reopenMonth()">↩️ ${tl('Reopen')} ${monthName(m)} — ${tl('undo the closing and close it again')}</button>` : '');
    else if (info.reopenedBy) html += `<div class="hint amber" style="text-align:center;">↩️ ${tl('Reopened by')} ${esc(info.reopenedBy)} — ${tl('close it again below')}</div>`;
    if (cur && !closed) {
        html += `<div style="font-size:0.75rem;color:var(--gray);text-align:center;padding:6px 0 12px;">You can close ${monthName(m)} once the month has ended.</div>`;
    } else {
        html += `<span class="section-label">${closed ? 'Move more to savings' : 'Close ' + monthName(m) + ' → Savings'}</span>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px;margin-bottom:10px;">
            <button type="button" class="primary-cta yellow" style="padding:11px;font-size:0.75rem;margin-bottom:12px;" onclick="$('mcBank').value=Math.max(0, S.balances.bank);mcTotal();">💯 Whole bank balance (${n0(bal.bank)})</button>
            <span class="field-label">🏦 From bank → savings (TZS)</span>
            <input type="number" id="mcBank" inputmode="decimal" value="${closed ? 0 : Math.max(0, bal.bank)}" oninput="mcTotal()" style="margin-bottom:10px;">
            <span class="field-label">💵 / 📱 Extra from cash or mobile (TZS)</span>
            <div style="display:flex;gap:8px;">
                <input type="number" id="mcExtra" inputmode="decimal" value="0" oninput="mcTotal()" style="flex:1;">
                <select id="mcFrom" style="flex:1;"><option value="cash">💵 Cash (${n0(bal.cash)})</option><option value="mobile">📱 Mobile (${n0(bal.mobile)})</option></select>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px dashed #fcd34d;">
                <strong style="font-size:0.85rem;">💰 Total to savings</strong><strong id="mcTotalLbl" style="color:#a16207;">0 TZS</strong>
            </div>
        </div>
        <button class="primary-cta ${closed ? '' : 'red'}" onclick="closeMonth()">${closed ? '💰 MOVE TO SAVINGS' : '🔒 CLOSE ' + monthName(m).toUpperCase()}</button>`;
    }
    html += `<button class="primary-cta green" onclick="shareText(monthMessage())">📲 SEND MONTH SUMMARY</button>`;
    $('mcBody').innerHTML = html;
    mcTotal();
}
function mcTotal() { const l = $('mcTotalLbl'); if (l) l.textContent = fmt(num($('mcBank').value) + num($('mcExtra').value)); }
async function closeMonth() {
    const { m } = S.mc, info = S.months[m] || {}, already = !!info.closed, bal = S.balances;
    const bankAmt = num($('mcBank').value), extra = num($('mcExtra').value), from = $('mcFrom').value, total = bankAmt + extra;
    if (bankAmt < 0 || extra < 0) return toast('⚠️ Amounts cannot be negative.', 'err');
    if (bankAmt > bal.bank + 1) return toast(`⚠️ Bank only has ${fmt(bal.bank)}.`, 'err');
    if (extra > (bal[from] || 0) + 1) return toast(`⚠️ ${ACCT[from]} only has ${fmt(bal[from])}.`, 'err');
    if (already && !total) return toast('⚠️ Enter an amount to move.', 'err');
    const lines = [];
    if (bankAmt) lines.push(`🏦 Bank → Savings: ${fmt(bankAmt)}`);
    if (extra) lines.push(`${ACCT[from]} → Savings: ${fmt(extra)}`);
    const msg = total ? `${already ? 'Move to savings' : 'Close ' + monthName(m)}?<br><br>${lines.join('<br>')}<br><b>Total: ${fmt(total)}</b>` : `Close ${monthName(m)} without saving anything?`;
    if (!await showConfirm(msg, already ? 'Move' : 'Close month', 'var(--blue)')) return;
    const figs = already ? null : await monthFigFull(m);
    const day = dayStr(), note = `Month close – ${monthName(m)}`, entries = [];
    if (bankAmt) entries.push({ type: 'savings', category: 'Savings', from: 'bank', to: 'savings', amount: bankAmt, note, day, closeOf: m });
    if (extra) entries.push({ type: 'savings', category: 'Savings', from, to: 'savings', amount: extra, note, day, closeOf: m });
    const b = db.batch();
    if (entries.length) writeEntries(b, entries);
    b.set(col('months').doc(m), already
        ? { saved: inc(total), updatedAt: now() }
        : { month: m, closed: true, saved: total, closedBy: S.me.name, closedAt: now(), figures: figs }, { merge: true });
    commit(b, total ? `💰 ${fmt(total)} moved to savings` : `🔒 ${monthName(m)} closed — tap Send month summary to share`);
    setTimeout(() => { renderMonthHistory(); renderMonthClose(); }, 400);
}
// Reopen a closed month: the savings moved when it was closed (and any "move more") go back to
// where they came from, so the owner can close it again with the right figures.
async function reopenMonth() {
    if (!isAdmin()) return;
    const { m } = S.mc, info = S.months[m] || {}; if (!info.closed) return;
    const note = `Month close – ${monthName(m)}`;
    let list = [];
    try {
        const qs = await col('entries').where('type', '==', 'savings').get();
        list = qs.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.type === 'savings' && (e.closeOf === m || e.note === note));
    } catch (e) { return toast('⚠️ ' + friendlyErr(e), 'err'); }
    const total = list.reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const lines = list.map(e => `${ACCT[e.from] || e.from} ← ${tl('Savings')}: ${fmt(e.amount)} <span style="color:#6b7280;">(${prettyDay(e.day)})</span>`);
    const short = total > (Number(S.balances.savings) || 0) + 1;
    const msg = `${tl('Reopen')} <b>${monthName(m)}</b>?<br><br>`
        + (list.length ? `${tl('The money moved to savings when it was closed goes back')}:<br>${lines.join('<br>')}<br><b>${tl('Total')}: ${fmt(total)}</b>` : tl('No savings from this closing are left — nothing is moved back.'))
        + (short ? `<br><br>⚠️ ${tl('Savings only holds')} ${fmt(S.balances.savings)} ${tl('now, so it will show less than zero until you correct it.')}` : '')
        + `<br><br>${tl('Then close it again with the right amounts.')}`;
    if (!await showConfirm(msg, tl('Reopen'), 'var(--blue)')) return;
    const b = db.batch();
    if (list.length) writeEntries(b, list, -1, list.map(e => e.id));
    b.set(col('months').doc(m), { closed: false, saved: 0, figures: firebase.firestore.FieldValue.delete(),
        reopenedBy: S.me.name, reopenedAt: now(), closedBefore: { by: info.closedBy || '', saved: info.saved || 0 } }, { merge: true });
    commit(b, `↩️ ${monthName(m)} ${tl('reopened')}${total ? ' · ' + fmt(total) + ' ' + tl('back from savings') : ''}`);
    setTimeout(() => { renderMonthHistory(); renderMonthClose(); }, 400);
}
function monthMessage() {
    if (!S.mc) return '';
    const { m, f } = S.mc, b = S.balances, pct = f.sales ? Math.round(f.profit / f.sales * 100) : 0;
    return `${isBarberMode() ? '💈' : '🏪'} *${(S.tenantInfo.name || S.tenant).toUpperCase()}* — ${monthName(m)}

${isBarberMode() ? '💈 Money in' : '🛒 Sales'}: ${n0(f.sales)}
📦 ${costWord()}: ${n0(costOf(f))}
${f.barbers ? `💈 Barbers earned: ${n0(f.barbers)}\n💸 Other expenses: ${n0(f.otherExpense)}` : `💸 Expenses: ${n0(f.otherExpense != null ? f.otherExpense : f.expense)}`}${f.supplier && !isBarberMode() ? `\n📥 Stock bought: ${n0(f.supplier)}` : ''}
━━━━━━━━━━
📈 Profit: ${n0(f.profit)} (${pct}%)
🏦 Banked: ${n0(f.bankIn - f.bankOut)}
💰 Put in savings: ${n0(f.toSavings)}

Balances now
💵 Cash: ${n0(b.cash)}
📱 Mobile: ${n0(b.mobile)}
🏦 Bank: ${n0(b.bank)}
💰 Savings: ${n0(b.savings)}`;
}

// ════════════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════════════
function openReport() { $('rpMonth').value = dayStr().slice(0, 7); openSheet('sheetReport'); previewReport(); }
async function loadMonthDetail(m) {
    if (S.reportCache[m] && m !== dayStr().slice(0, 7)) return S.reportCache[m];
    const [ss, es] = await Promise.all([col('sales').where('month', '==', m).get(), col('entries').where('month', '==', m).get()]);
    const sales = ss.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.voided);
    const entries = es.docs.map(d => ({ id: d.id, ...d.data() }));
    return (S.reportCache[m] = { sales, entries });
}
function itemTotals(sales) {
    const t = {};
    sales.forEach(s => (s.items || []).forEach(i => {
        const sg = s.kind === 'return' ? -1 : 1, k = i.productId || i.name;
        t[k] = t[k] || { name: i.name, unit: i.unit, qty: 0, revenue: 0, cogs: 0 };
        t[k].qty += sg * i.qty; t[k].revenue += sg * i.subtotal; t[k].cogs += sg * (lineCost(i, tms(s.createdAt) || Date.parse((s.day || dayStr()) + 'T23:59:59')) || 0);
    }));
    return Object.values(t).sort((a, b) => b.revenue - a.revenue);
}
async function previewReport() {
    const m = $('rpMonth').value; if (!m) return;
    const f = await monthFigFull(m), box = $('rpPreview'); if ($('rpMonth').value !== m) return;
    if (!f.hasData) { box.innerHTML = `<div class="empty-state"><div class="icon">📭</div>No data for ${monthName(m)}.</div>`; return; }
    const margin = f.sales ? (f.profit / f.sales * 100).toFixed(1) : 0;
    box.innerHTML = `<div style="font-size:0.75rem;color:var(--gray);text-align:center;margin-bottom:10px;">${monthName(m)} · ${f.days} trading days</div>
        <div class="sum-box">
            <div class="sum-row"><span>${isBarberMode() ? '💈 ' + tl('Money in') : '🛒 Sales'}</span><strong style="color:var(--green);">${fmt(f.sales)}</strong></div>
            <div class="sum-row"><span>&nbsp;&nbsp;💵 Cash / 📱 Simu received</span><span>${n0(f.cash)} / ${n0(f.mobile)}</span></div>
            ${f.credit ? `<div class="sum-row"><span>&nbsp;&nbsp;📒 Sold on credit</span><span>${n0(f.credit)}</span></div>` : ''}
            ${f.discount ? `<div class="sum-row"><span>&nbsp;&nbsp;🏷️ Discounts given</span><span>${n0(f.discount)}</span></div>` : ''}
            ${f.returns ? `<div class="sum-row"><span>&nbsp;&nbsp;↩️ Returns refunded</span><span>−${n0(f.returns)}</span></div>` : ''}
            ${f.debtPaid ? `<div class="sum-row"><span>💰 Debts collected</span><span>${n0(f.debtPaid)}</span></div>` : ''}
            <div class="sum-row"><span>📦 ${costWord()}</span><strong style="color:var(--red);">${fmt(costOf(f))}</strong></div>
            ${f.barbers ? `<div class="sum-row"><span>💈 ${tl('Barbers earned')}</span><strong style="color:var(--red);">${fmt(f.barbers)}</strong></div>` : ''}
            <div class="sum-row"><span>💸 ${f.barbers || f.barberPaid ? tl('Other expenses') : tl('Expenses')}</span><strong style="color:var(--red);">${fmt(f.otherExpense != null ? f.otherExpense : f.expense)}</strong></div>
            <div class="sum-row"><span>🏦 Banked (net)</span><strong style="color:var(--blue);">${fmt(f.bankIn - f.bankOut)}</strong></div>
            <div class="sum-row big"><span>📈 Profit</span><strong style="color:${f.profit >= 0 ? 'var(--green)' : 'var(--red)'};">${fmt(f.profit)} (${margin}%)</strong></div>
            ${f.supplier && !isBarberMode() ? `<div class="sum-row"><span style="color:var(--gray);">📥 ${tl('Stock bought (not in profit)')}</span><span>${n0(f.supplier)}</span></div>` : ''}
        </div>${f.missing && f.missing.length ? `<div class="hint amber">⚠️ ${esc(missingCostNote(f.missing))}</div>` : ''}<div id="rpTop" style="font-size:0.75rem;color:var(--gray);text-align:center;">Loading top sellers…</div>`;
    try {
        const { sales } = await loadMonthDetail(m);
        const top = itemTotals(sales).slice(0, 5);
        if ($('rpMonth').value !== m) return;
        $('rpTop').outerHTML = top.length ? `<span class="section-label">Top sellers</span><div class="sum-box">${top.map((t, i) =>
            `<div class="sum-row"><span>${i + 1}. ${esc(t.name)}</span><strong>${t.qty} · ${n0(t.revenue)}</strong></div>`).join('')}</div>` : '';
    } catch (e) { const el = $('rpTop'); if (el) el.textContent = 'Top sellers need a connection.'; }
}
async function generatePDF() {
    const m = $('rpMonth').value; if (!m) return;
    const f = await monthFigFull(m);
    if (!f.hasData) return toast('No data for ' + monthName(m), 'err');
    if (!window.jspdf) return toast('PDF tool did not load. Check your connection and refresh.', 'err');
    loader(true, 'BUILDING PDF...');
    try {
        const { sales, entries } = await loadMonthDetail(m);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = 210, ink = [11, 13, 18], yellow = [255, 199, 44], blue = [26, 86, 219];
        const shop = (S.tenantInfo.name || S.tenant).toUpperCase();
        const header = (title, sub) => {
            doc.setFillColor(...ink); doc.rect(0, 0, W, 28, 'F');
            doc.setTextColor(...yellow); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text(shop, 14, 12);
            doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            doc.text(title, 14, 20); doc.text(sub, W - 14, 20, { align: 'right' });
        };
        header('Monthly Report — ' + monthName(m), 'Generated ' + new Date().toLocaleDateString('en-GB'));
        const items = itemTotals(sales), cogs = items.reduce((s, i) => s + i.cogs, 0), itemRevenue = items.reduce((s, i) => s + i.revenue, 0);
        const margin = f.sales ? (f.profit / f.sales * 100).toFixed(1) : 0;
        const boxes = [
            ['Total Sales', fmt(f.sales), [22, 163, 74]], ['Cash Sales', fmt(f.cash), [124, 58, 237]], ['Mobile Sales', fmt(f.mobile), [0, 135, 90]],
            ['POS Transactions', String(f.tx), ink], ['Cost of Goods Sold', fmt(costOf(f)), [220, 38, 38]], ['Expenses', fmt(f.otherExpense != null ? f.otherExpense : f.expense), [220, 38, 38]],
            ['Profit', fmt(f.profit), f.profit >= 0 ? [22, 163, 74] : [220, 38, 38]], ['Profit Margin', margin + '%', ink],
            ['Banked (net)', fmt(f.bankIn - f.bankOut), blue], ['To Savings', fmt(f.toSavings), [161, 98, 7]],
            ['Stock Bought', fmt(f.supplier), ink], ['Trading Days', String(f.days), ink],
            ['Sold on Credit', fmt(f.credit), [245, 158, 11]], ['Discounts Given', fmt(f.discount), ink], ['Debts Collected', fmt(f.debtPaid), [0, 135, 90]], ['Returns Refunded', fmt(f.returns), [124, 58, 237]]
        ];
        let y = 36;
        doc.setTextColor(...ink); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('SUMMARY', 14, y); y += 4;
        boxes.forEach(([l, v, c], i) => {
            const bx = 14 + (i % 4) * 46, by = y + Math.floor(i / 4) * 17;
            doc.setFillColor(246, 248, 251); doc.roundedRect(bx, by, 44, 15, 2, 2, 'F');
            doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120); doc.text(l, bx + 3, by + 5);
            doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...c); doc.text(v, bx + 3, by + 11.5);
        });
        y += Math.ceil(boxes.length / 4) * 17 + 6;

        const dayKeys = Object.keys(S.days).filter(d => d.slice(0, 7) === m).sort();
        doc.setTextColor(...ink); doc.setFontSize(10); doc.text('DAILY FIGURES', 14, y);
        doc.autoTable({
            startY: y + 3, margin: { left: 14, right: 14 },
            head: [['Date', 'Sales', 'Cash', 'Mobile', 'Cost of goods', 'Expenses', 'Banked', 'Profit']],
            body: dayKeys.map(d => { const x = dayFig(d), p = fullProfit(x, sales.filter(s => s.day === d), entries.filter(e => e.day === d)); return [d, n0(x.sales), n0(x.cash), n0(x.mobile), n0(costOf(p)), n0(p.otherExpense + p.barbers), n0(x.bankIn - x.bankOut), n0(p.profit)]; }),
            styles: { fontSize: 7, cellPadding: 2.2 }, headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 248, 252] },
            didParseCell: d => { if (d.section === 'body' && d.column.index === 7) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = String(d.cell.raw).startsWith('-') ? [220, 38, 38] : [22, 163, 74]; } }
        });

        if (entries.length) {
            doc.addPage(); header('Money Entries — ' + monthName(m), entries.length + ' entries');
            doc.autoTable({
                startY: 34, margin: { left: 14, right: 14 },
                head: [['Date', 'Type', 'Category', 'From', 'To', 'Amount', 'Note', 'By']],
                body: entries.sort((a, b) => a.day.localeCompare(b.day)).map(e => [e.day, e.type, e.category || '', e.from || '', e.to || '', n0(e.amount), e.note || '', e.staffName || '']),
                styles: { fontSize: 6.8, cellPadding: 2 }, headStyles: { fillColor: ink, textColor: yellow, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 248, 252] }, columnStyles: { 6: { cellWidth: 40 } }
            });
        }

        if (items.length) {
            doc.addPage(); header('Items Sold — ' + monthName(m), sales.length + ' sales');
            doc.autoTable({
                startY: 34, margin: { left: 14, right: 14 },
                head: [['Item', 'Units', 'Revenue', 'Cost (est.)', 'Margin']],
                body: items.map(i => [i.name, qtyTxt(i.qty, { unit: i.unit }), n0(i.revenue), i.cogs ? n0(i.cogs) : '—', i.cogs ? n0(i.revenue - i.cogs) : '—']),
                styles: { fontSize: 7, cellPadding: 2.2 }, headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 248, 252] }
            });
        }

        if (S.products.length) {
            doc.addPage(); header('Stock Snapshot', 'As of ' + new Date().toLocaleDateString('en-GB'));
            const value = S.products.reduce((s, p) => s + stockValue(p), 0);
            doc.setTextColor(...ink); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
            doc.text(`Items: ${S.products.length}   |   Stock value at cost: ${fmt(value)}`, 14, 34);
            doc.autoTable({
                startY: 38, margin: { left: 14, right: 14 },
                head: [['Item', 'Category', 'Stock', 'Warn at', 'Sell', 'Cost', 'Status']],
                body: S.products.filter(p => !isService(p)).sort((a, b) => (a.stock || 0) - (b.stock || 0)).map(p => {
                    const st = p.stock || 0, status = st <= 0 ? 'OUT' : st <= (p.reorderLevel || 5) ? 'LOW' : 'OK';
                    return [p.name, p.category || '', String(st), String(p.reorderLevel || 5), n0(p.sellPrice), n0(S.costs[p.id] || 0), status];
                }),
                styles: { fontSize: 7, cellPadding: 2.2 }, headStyles: { fillColor: ink, textColor: yellow, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 248, 252] },
                didParseCell: d => { if (d.section === 'body' && d.column.index === 6) { const r = d.cell.raw; d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = r === 'OUT' ? [220, 38, 38] : r === 'LOW' ? [245, 158, 11] : [22, 163, 74]; } }
            });
        }
        doc.save(`${S.tenant}_${m}_report.pdf`);
        toast('📄 Report downloaded');
    } catch (e) {
        console.error(e);
        toast('⚠️ Could not build the report: ' + friendlyErr(e), 'err');
    } finally { loader(false); }
}

// ════════════════════════════════════════════════
//  BUSINESS INSIGHTS (rule-based)
// ════════════════════════════════════════════════
function openAI() {
    openSheet('sheetAI');
    const today = dayStr(), from = shiftDay(today, -29), mid = shiftDay(today, -14);
    const keys = Object.keys(S.days).filter(d => d >= from && d <= today);
    if (!keys.length) { $('aiOut').innerHTML = '<div class="ai-bubble">Not enough data in the last 30 days yet. Keep selling!</div>'; return; }
    let sales = 0, stock = 0, other = 0, saved = 0, we = 0, weN = 0, wd = 0, wdN = 0, recent = 0, older = 0;
    keys.forEach(d => {
        const x = dayFig(d);
        sales += x.sales; stock += x.supplier; other += x.expense; saved += x.bankIn - x.bankOut + x.toSavings;
        const dow = new Date(d + 'T12:00:00').getDay();
        if (dow === 0 || dow === 6) { we += x.sales; weN++; } else { wd += x.sales; wdN++; }
        if (d > mid) recent += x.sales; else older += x.sales;
    });
    const margin = sales ? (sales - stock - other) / sales * 100 : 0;
    const stockRatio = sales ? stock / sales * 100 : 0;
    const momentum = older ? (recent - older) / older * 100 : 0;
    const avgWe = weN ? we / weN : 0, avgWd = wdN ? wd / wdN : 0;
    const advice = margin < 15 ? `🚨 <b>Low profit:</b> only <b>${margin.toFixed(1)}%</b> of sales is profit. Check expenses and supplier prices.`
        : stockRatio > 65 ? `⚠️ <b>Heavy restocking:</b> <b>${stockRatio.toFixed(1)}%</b> of sales goes back into stock. You may be over-ordering.`
        : momentum < -10 ? `📉 <b>Sales slowing:</b> the last 15 days are <b>${Math.abs(momentum).toFixed(1)}%</b> below the 15 before. Consider a promotion.`
        : `🚀 <b>Healthy:</b> margin is <b>${margin.toFixed(1)}%</b>. A good time to add a fast-moving product line.`;
    const rhythm = avgWe > avgWd * 1.3 ? 'Weekends are busiest — restock by Friday.'
        : avgWd > avgWe * 1.3 ? 'Weekdays are your peak — keep the till fast in the mornings.'
        : 'Steady trade all week — monthly bulk orders are safe.';
    const out = S.products.filter(p => !isService(p) && (p.stock || 0) <= 0), low = S.products.filter(p => !isService(p) && p.stock > 0 && p.stock <= (p.reorderLevel || 5));
    const inv = (out.length ? `🚨 <b>${out.length} out of stock:</b> ${esc(out.map(p => p.name).join(', '))}<br>` : '')
        + (low.length ? `⚠️ <b>${low.length} running low:</b> ${esc(low.map(p => p.name).join(', '))}` : '') || '✅ All stock levels are healthy.';
    $('aiOut').innerHTML = `
        <div class="ai-bubble" style="background:#eef3ff;">${advice}</div>
        <div class="ai-bubble"><h5>Last 30 days</h5>
            <div class="ai-stat"><span>Sales</span><b>${fmt(sales)}</b></div>
            <div class="ai-stat"><span>Profit margin</span><b style="color:${margin >= 20 ? 'var(--green)' : 'var(--red)'}">${margin.toFixed(1)}%</b></div>
            <div class="ai-stat"><span>Stock-to-sales</span><b>${stockRatio.toFixed(1)}%</b></div>
            <div class="ai-stat"><span>15-day momentum</span><b style="color:${momentum >= 0 ? 'var(--green)' : 'var(--red)'}">${momentum >= 0 ? '+' : ''}${momentum.toFixed(1)}%</b></div>
            <div class="ai-stat"><span>Banked & saved</span><b style="color:#a16207;">${fmt(saved)}</b></div>
        </div>
        <div class="ai-bubble" style="border-left-color:var(--yellow);background:#fffdf3;"><h5>Stock</h5>${inv}</div>
        <div class="ai-bubble" style="border-left-color:var(--pos);background:#f0fdf4;"><h5>Rhythm</h5>${rhythm}
            <div class="ai-stat" style="margin-top:6px;"><span>Average weekday</span><b>${fmt(avgWd)}</b></div>
            <div class="ai-stat"><span>Average weekend day</span><b>${fmt(avgWe)}</b></div>
        </div>`;
}

// ════════════════════════════════════════════════
