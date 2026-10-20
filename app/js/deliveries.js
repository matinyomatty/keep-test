// Keep till — Serial register and deliveries.
// Part of app/index.html; the parts load in order and share one global scope.
//  SERIAL REGISTER — every serial/IMEI is scanned in when stock arrives,
//  marked sold at the till, and put back on a return or void.
// ════════════════════════════════════════════════
S.serialsIn = {};
const serialId = x => String(x || '').trim().replace(/[\/\s#?\[\]]+/g, '_').slice(0, 140);
const inStockSerials = pid => Object.values(S.serialsIn).filter(x => x.productId === pid).sort((a, b) => (tms(a.receivedAt) || 0) - (tms(b.receivedAt) || 0));
const parseSerials = txt => [...new Set(String(txt || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean))];

function restockSerialCount() {
    const p = productById($('restockId').value); if (!p || !p.trackSerial) return;
    const list = parseSerials($('restockSerials').value);
    const dup = list.filter(x => S.serialsIn[serialId(x)]);
    $('restockQty').value = list.length || '';
    $('restockSerialInfo').innerHTML = `<b>${list.length}</b> serial${list.length === 1 ? '' : 's'} = ${list.length} unit${list.length === 1 ? '' : 's'} received` +
        (dup.length ? `<br><span style="color:var(--red);">⚠️ Already in stock: ${esc(dup.join(', '))}</span>` : '');
    restockTotal();
}

function openSerials(pid) {
    const p = productById(pid); if (!p) return;
    S.serialsFor = pid;
    openSheet('sheetSerials');
    renderSerialList();
}
function renderSerialList() {
    const p = productById(S.serialsFor); if (!p) return;
    const L = inStockSerials(p.id), st = Number(p.stock) || 0;
    $('serialsBody').innerHTML = `
        <div class="modal-title" style="margin-bottom:4px;">${esc(p.emoji || '')} ${esc(p.name)}</div>
        <div class="mini-cards" style="margin-top:10px;">
            <div><b style="color:var(--pos);">${L.length}</b><small>Serials on the shelf</small></div>
            <div style="background:${L.length !== st ? '#fef3c7' : '#f0fdf4'};"><b>${q3(st)}</b><small>Stock count</small></div>
        </div>
        ${L.length !== st ? `<div class="hint amber">⚠️ The stock count and the serial list don't match. ${L.length < st ? `${st - L.length} unit${st - L.length > 1 ? 's have' : ' has'} no serial recorded — use 📥 Restock to scan them in, or correct the count in Stocktake.` : 'Some serials are listed but not counted in stock — check the shelf.'}</div>` : ''}
        <button class="btn-sec wide" onclick="openRestock('${p.id}')">📥 Receive more (scan serials)</button>
        ${L.length ? L.map(x => `
            <div class="list-line" style="background:#f8fafc;border-left-color:var(--pos);">
                <div class="ll-main"><div class="ll-title" style="font-family:monospace;font-size:.8rem;">${esc(x.serial)}</div>
                    <div class="ll-sub">In since ${tms(x.receivedAt) ? new Date(tms(x.receivedAt)).toLocaleDateString('en-GB') : '—'}${x.receivedBy ? ' · ' + esc(x.receivedBy) : ''}${x.returnedAt ? ' · came back on a return' : ''}</div></div>
                <button class="tiny-btn" data-sn="${esc(x.serial)}" onclick="const v=this.dataset.sn;closeModals();serialLookup();$('serialQ').value=v;runSerialLookup();">🔍</button>
                ${isAdmin() ? `<button class="tiny-btn red" title="Remove a wrong entry" data-sid="${esc(x.id)}" onclick="removeSerial(this.dataset.sid)">✕</button>` : ''}
            </div>`).join('') : '<div class="empty-state" style="padding:12px;">No serials on the shelf.</div>'}`;
}
async function removeSerial(sid) {
    const x = S.serialsIn[sid]; if (!x) return;
    if (!await showConfirm(`Remove serial <b>${esc(x.serial)}</b> from the list?<br><span style="font-size:.75rem;color:#6b7280;">Only for a wrongly typed number. The stock count is not changed.</span>`, 'Remove')) return;
    const b = db.batch(); b.delete(col('serials').doc(sid)); commit(b, 'Serial removed');
}

// ════════════════════════════════════════════════
//  DELIVERIES — anyone on shift receives stock (several items at once).
//  Sellers type what they paid for THIS delivery; they never see stored cost prices.
//  Money paid from the drawer goes into the seller's next cash-up automatically.
//  The owner reviews each delivery: update cost prices, record the payment.
// ════════════════════════════════════════════════
S.dl = { lines: [] };
const PAID_LABEL = { drawer: '💵 Paid from the drawer', owner: '👤 Paid by the owner', credit: '📒 On credit — pay later', cash: '💵 Paid from Cash', mobile: '📱 Paid from Lipa kwa Simu', bank: '🏦 Paid from Bank' };
function openDelivery() {
    S.dl = { lines: [] };
    ['dlSupplier', 'dlSearch', 'dlNote'].forEach(id => $(id).value = '');
    $('dlResults').innerHTML = '';
    $('dlPaid').innerHTML = (isAdmin() ? ['cash', 'mobile', 'bank', 'credit'] : ['drawer', 'owner', 'credit']).map(k => `<option value="${k}">${PAID_LABEL[k]}</option>`).join('');
    renderDlLines();
    openSheet('sheetDelivery');
    setTimeout(() => $('dlSupplier').focus(), 250);
}
function dlSearchList() {
    const q = $('dlSearch').value.trim().toLowerCase();
    if (!q) { $('dlResults').innerHTML = ''; return; }
    const hits = S.products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.barcode && normCode(p.barcode) === normCode(q))).slice(0, 6);
    $('dlResults').innerHTML = hits.map(p => `<div class="list-line" style="cursor:pointer;" data-pid="${p.id}" onclick="dlAdd(this.dataset.pid)">
        <div class="ll-main"><div class="ll-title">${esc(p.emoji || '📦')} ${esc(p.name)}</div><div class="ll-sub">In stock: ${qtyTxt(p.stock || 0, p)}</div></div><div class="ll-amt">＋</div></div>`).join('')
        || '<div class="hint gray">No item matches. New items are added by the owner in Stock → + Add item.</div>';
}
function dlSearchEnter() {
    const q = $('dlSearch').value.trim(); if (!q) return;
    const p = productByCode(q) || S.products.find(x => (x.name || '').toLowerCase() === q.toLowerCase());
    if (p) dlAdd(p.id); else dlSearchList();
}
function dlScan() {
    openScanner({ title: '📷 Scan delivery items', hint: 'Scan each item — scanning again adds one more', multi: true, onCode: c => {
        const p = productByCode(c); if (!p) return false;
        dlAdd(p.id, true); return `${p.name} · ${qtyTxt(S.dl.lines.find(l => l.productId === p.id).qty, p)}`;
    } });
}
function dlAdd(pid, bump) {
    const p = productById(pid); if (!p) return;
    let l = S.dl.lines.find(x => x.productId === pid);
    if (l) { if (bump && !p.trackSerial) l.qty = q3((l.qty || 0) + 1); }
    else S.dl.lines.unshift(l = { productId: pid, qty: p.trackSerial ? 0 : 1, unitCost: '', serials: '' });
    $('dlSearch').value = ''; $('dlResults').innerHTML = '';
    renderDlLines();
}
function dlRemove(pid) { S.dl.lines = S.dl.lines.filter(l => l.productId !== pid); renderDlLines(); }
function dlSet(pid, k, v) {
    const l = S.dl.lines.find(x => x.productId === pid); if (!l) return;
    if (k === 'serials') { l.serials = v; l.qty = parseSerials(v).length; const q = document.querySelector(`[data-dlq="${pid}"]`); if (q) q.value = l.qty; }
    else l[k] = v;
    dlTotal();
}
function dlLineTotal(l) { return Math.round(num(l.qty) * num(l.unitCost)); }
function dlTotal() { $('dlTotalLbl').textContent = fmt(S.dl.lines.reduce((a, l) => a + dlLineTotal(l), 0)); S.dl.lines.forEach(l => { const e = document.querySelector(`[data-dlt="${l.productId}"]`); if (e) e.textContent = l.unitCost === '' ? '' : '= ' + n0(dlLineTotal(l)); }); }
function renderDlLines() {
    $('dlLines').innerHTML = S.dl.lines.length ? S.dl.lines.map(l => {
        const p = productById(l.productId) || { name: '?' };
        return `<div class="cart-line" style="display:block;padding:10px 12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><b style="font-size:.85rem;">${esc(p.emoji || '📦')} ${esc(p.name)}</b>
                <button class="tiny-btn red" data-pid="${l.productId}" onclick="dlRemove(this.dataset.pid)">✕</button></div>
            ${p.trackSerial ? `<textarea rows="3" placeholder="Serial / IMEI — one per line" style="font-family:monospace;margin-top:6px;" data-pid="${l.productId}" id="dls_${l.productId}" oninput="dlSet(this.dataset.pid,'serials',this.value)">${esc(l.serials)}</textarea>
                <button class="btn-sec wide" style="margin:4px 0;" data-pid="${l.productId}" onclick="scanSerialsInto('dls_'+this.dataset.pid, () => dlSet(this.dataset.pid,'serials',$('dls_'+this.dataset.pid).value))">📷 Scan serials</button>` : ''}
            <div class="form-row" style="margin:6px 0 0;gap:8px;">
                <div class="field-group" style="margin:0;"><span class="field-label">Qty${p.unit && p.unit !== 'pc' ? ' (' + esc(p.unit) + ')' : ''}</span><input type="number" inputmode="decimal" data-dlq="${l.productId}" value="${l.qty || ''}" ${p.trackSerial ? 'readonly' : ''} data-pid="${l.productId}" oninput="dlSet(this.dataset.pid,'qty',this.value)"></div>
                <div class="field-group" style="margin:0;"><span class="field-label">Paid each (TZS)</span><input type="number" inputmode="decimal" value="${l.unitCost}" placeholder="optional" data-pid="${l.productId}" oninput="dlSet(this.dataset.pid,'unitCost',this.value)"></div>
            </div>
            <div style="text-align:right;font-size:.75rem;color:var(--gray);" data-dlt="${l.productId}"></div>
        </div>`;
    }).join('') : '<div class="empty-state" style="padding:12px;">Search or scan the items that arrived.</div>';
    dlTotal();
}
async function saveDelivery() {
    const lines = S.dl.lines.filter(l => num(l.qty) > 0 || (l.serials || '').trim());
    if (!lines.length) return toast('⚠️ Add the items that arrived.', 'err');
    const items = [];
    for (const l of lines) {
        const p = productById(l.productId); if (!p) continue;
        const serials = p.trackSerial ? parseSerials(l.serials) : [];
        if (p.trackSerial) {
            if (!serials.length) return toast(`⚠️ Scan or type the serial of each ${p.name}.`, 'err');
            const dup = serials.filter(x => S.serialsIn[serialId(x)]);
            if (dup.length) return toast(`⚠️ Already on the shelf: ${dup.join(', ')}`, 'err');
        }
        const qty = p.trackSerial ? serials.length : (partOk(p) ? q3(num(l.qty)) : Math.round(num(l.qty)));
        if (qty <= 0) return toast(`⚠️ Enter how many ${p.name} came in.`, 'err');
        const unitCost = l.unitCost === '' ? null : Math.round(num(l.unitCost));
        items.push({ productId: p.id, name: p.name, emoji: p.emoji || '📦', unit: unitOf(p), qty, unitCost, lineTotal: unitCost == null ? null : Math.round(qty * unitCost), serials });
    }
    const paidFrom = $('dlPaid').value, total = items.reduce((a, i) => a + (i.lineTotal || 0), 0);
    if (['drawer', 'cash', 'mobile', 'bank'].includes(paidFrom) && !total) return toast('⚠️ Enter what was paid for each item, so the money adds up.', 'err');
    if (isAdmin() && ['cash', 'mobile', 'bank'].includes(paidFrom) && total > (S.balances[paidFrom] || 0) + 1 && !await showConfirm(`${ACCT[paidFrom]} only shows ${fmt(S.balances[paidFrom] || 0)}. Record ${fmt(total)} anyway?`, 'Record', 'var(--blue)')) return;
    const supplier = $('dlSupplier').value.trim(), note = $('dlNote').value.trim();
    const day = dayStr(), ref = col('receipts').doc(), receiptNo = 'D' + day.slice(2).replace(/-/g, '') + '-' + ref.id.slice(0, 4).toUpperCase();
    const confirmed = isAdmin();
    const lineOf = {}; items.forEach((i, ix) => { lineOf[i.productId] = ix; });
    const doc = { receiptNo, supplier, note, items, lineOf, total, paidFrom, day, month: day.slice(0, 7), status: confirmed ? 'confirmed' : 'pending',
        staffUid: S.me.uid, staffName: S.me.name, createdAt: now() };
    if (confirmed) Object.assign(doc, { reviewedBy: S.me.name, reviewedAt: now(), costsUpdated: items.some(i => i.unitCost != null), paymentRecorded: ['cash', 'mobile', 'bank'].includes(paidFrom) });
    const b = db.batch();
    b.set(ref, doc);
    items.forEach(i => {
        b.update(col('products').doc(i.productId), { stock: inc(i.qty), src: src('receipts', ref.id), updatedAt: now() });
        b.set(col('movements').doc(), { productId: i.productId, name: i.name, type: 'restock', qty: i.qty, unitCost: confirmed ? i.unitCost : null, deliveryId: ref.id, day, staffUid: S.me.uid, staffName: S.me.name, createdAt: now() });
        i.serials.forEach(sn => b.set(col('serials').doc(serialId(sn)), { serial: sn, productId: i.productId, name: i.name, status: 'in', receivedAt: now(), receivedBy: S.me.name,
            saleId: null, soldAt: null, soldBy: null, customerName: null, updatedAt: now() }, { merge: true }));
        if (confirmed && i.unitCost != null) b.set(col('costs').doc(i.productId), { costPrice: i.unitCost, updatedAt: now() }, { merge: true });
    });
    if (confirmed && ['cash', 'mobile', 'bank'].includes(paidFrom) && total) writeEntries(b, [{ type: 'expense', category: 'Supplier', from: paidFrom, to: null, amount: total, note: `Delivery ${receiptNo}${supplier ? ' · ' + supplier : ''}`, day, deliveryId: ref.id }]);
    closeModals();
    commit(b, `✅ Delivery saved · ${items.length} item${items.length > 1 ? 's' : ''}`, { label: `Delivery ${receiptNo} · ${items.map(i => qtyTxt(i.qty, { unit: i.unit }) + ' × ' + i.name).join(', ')}` });
    const saved = { ...doc, id: ref.id, createdAt: { toDate: () => new Date(), toMillis: () => Date.now() } };
    S.lastDelivery = saved;
    deliveryShare(saved, true);
}
// ── PDF delivery note: share to WhatsApp / email, or download ──
function deliveryPdf(d) {
    if (!window.jspdf) { toast('PDF tool did not load — check your connection.', 'err'); return null; }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210;
    doc.setFillColor(11, 13, 18); doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255, 199, 44); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text((S.tenantInfo.name || S.tenant || '').toUpperCase(), 14, 13);
    doc.setTextColor(255); doc.setFontSize(10); doc.text('DELIVERY RECEIVED', 14, 21);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(d.receiptNo || '', W - 14, 13, { align: 'right' });
    doc.text(`${new Date(tms(d.createdAt) || Date.now()).toLocaleDateString('en-GB')} ${timeOf(d.createdAt)}`, W - 14, 21, { align: 'right' });
    doc.setTextColor(30); let y = 40;
    const kv = (k, v) => { doc.setFont('helvetica', 'bold'); doc.text(k, 14, y); doc.setFont('helvetica', 'normal'); doc.text(String(v || '—'), 52, y); y += 6; };
    kv('Received by', d.staffName); kv('Supplier', d.supplier); kv('Payment', (PAID_LABEL[d.paidFrom] || d.paidFrom || '').replace(/^\S+\s/, ''));
    if (d.note) kv('Note', d.note);
    const body = d.items.map((i, k) => [k + 1, i.name + (i.serials && i.serials.length ? '\nS/N: ' + i.serials.join(', ') : ''), qtyTxt(i.qty, { unit: i.unit }), i.unitCost == null ? '—' : n0(i.unitCost), i.lineTotal == null ? '—' : n0(i.lineTotal)]);
    doc.autoTable({ startY: y + 2, head: [['#', 'Item', 'Qty', 'Paid each', 'Total']], body,
        foot: [['', `${d.items.length} item${d.items.length > 1 ? 's' : ''}`, '', 'TOTAL TZS', n0(d.total)]],
        theme: 'grid', headStyles: { fillColor: [26, 86, 219] }, footStyles: { fillColor: [255, 199, 44], textColor: 20 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, styles: { fontSize: 9 } });
    y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(d.status === 'confirmed' ? `Checked by ${d.reviewedBy || 'owner'}` : 'Waiting for the owner to check', 14, y);
    doc.text('Recorded in Keep POS', W - 14, y, { align: 'right' });
    return doc;
}
function deliveryText(d) {
    return `🚚 *Delivery — ${S.tenantInfo.name || S.tenant}*\n${d.receiptNo} · ${prettyDay(d.day)} ${timeOf(d.createdAt)}\n👤 ${d.staffName}${d.supplier ? '\n🏪 ' + d.supplier : ''}\n\n` +
        d.items.map(i => `• ${i.name} — ${qtyTxt(i.qty, { unit: i.unit })}${i.unitCost != null ? ' × ' + n0(i.unitCost) + ' = ' + n0(i.lineTotal) : ''}`).join('\n') +
        `\n\n💰 Total: ${n0(d.total)} TZS\n${PAID_LABEL[d.paidFrom] || ''}${d.note ? '\n📝 ' + d.note : ''}`;
}
async function deliveryShare(d, justSaved) {
    const how = await choose(`${justSaved ? '✅ <b>Delivery saved.</b><br>' : ''}🚚 <b>${esc(d.receiptNo)}</b> · ${d.items.length} item${d.items.length > 1 ? 's' : ''} · ${fmt(d.total)}<br>Send the delivery note to the owner?`,
        [['share', '📄 Send PDF (WhatsApp / email)', 'var(--pos)'], ['wa', '📲 WhatsApp as text', 'var(--blue)'], ['pdf', '⬇️ Download PDF', 'var(--ink)']]);
    if (!how) return;
    if (how === 'wa') { const wa = String((S.tenantInfo.settings || {}).whatsapp || '').replace(/\D/g, ''); openWa(wa, deliveryText(d)); return; }
    const doc = deliveryPdf(d); if (!doc) return;
    const name = `Delivery_${d.receiptNo}.pdf`;
    if (how === 'share') {
        try {
            const file = new File([doc.output('blob')], name, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name, text: deliveryText(d) }); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        toast('This device can\'t attach files directly — the PDF is downloading; attach it in WhatsApp or email.');
    }
    doc.save(name);
}
// ── Owner: review deliveries ──
S.pendingReceipts = [];
function openDeliveries() {
    openSheet('sheetDeliveries'); renderDeliveries();
    // sellers may only read their own deliveries, so their query must say so
    const since = nowMs() - 30 * 864e5, q = isAdmin() ? col('receipts').where('createdAt', '>=', TSms(since)) : col('receipts').where('staffUid', '==', S.me.uid);
    S.sheetListeners.push(q.onSnapshot(s => {
        S.recentReceipts = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => (tms(d.createdAt) || 9e15) >= since).sort((a, b) => (tms(b.createdAt) || 9e15) - (tms(a.createdAt) || 9e15));
        renderDeliveries();
    }, e => { $('dvBody').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }));
}
S.receiptCache = {};
function dvLine(d) {
    S.receiptCache[d.id] = d;
    const pend = d.status === 'pending';
    return `<div class="entry-item" style="padding:11px 13px;border-left-color:${pend ? 'var(--yellow)' : 'var(--pos)'};" data-id="${d.id}" onclick="openReceipt(this.dataset.id)">
        <div style="min-width:0;flex:1;"><div class="entry-date" style="font-size:.84rem;">${esc(d.staffName)} · ${shortDay(d.day)} ${timeOf(d.createdAt)}${d.supplier ? ' · ' + esc(d.supplier) : ''}</div>
            <div class="entry-meta">${d.items.length} item${d.items.length > 1 ? 's' : ''} · ${esc((PAID_LABEL[d.paidFrom] || '').replace(/^\S+\s/, ''))}</div></div>
        <div style="text-align:right;"><div style="font-weight:800;font-size:.85rem;">${n0(d.total)}</div><div style="font-size:.68rem;font-weight:800;color:${pend ? 'var(--amber)' : 'var(--pos)'};">${pend ? '⏳ To check' : '✓ Checked'}</div></div>
    </div>`;
}
function renderDeliveries() {
    const all = S.recentReceipts || [], pend = all.filter(d => d.status === 'pending'), done = all.filter(d => d.status !== 'pending');
    $('dvBody').innerHTML = `<button class="primary-cta green" style="margin:0 0 12px;" onclick="openDelivery()">🚚 RECEIVE A DELIVERY</button>
        ${isAdmin() ? `<span class="section-label">To check</span>${pend.length ? pend.map(dvLine).join('') : '<div class="empty-state" style="padding:12px;">✅ Nothing waiting.</div>'}` : ''}
        <span class="section-label" style="margin-top:10px;">${isAdmin() ? 'Checked · last 30 days' : 'Your deliveries · last 30 days'}</span>
        ${(isAdmin() ? done : all).map(dvLine).join('') || '<div class="empty-state" style="padding:12px;">None yet.</div>'}`;
}
async function openReceipt(id) {
    const d = S.receiptCache[id]; if (!d) return;
    if (!isAdmin() || d.status !== 'pending') return deliveryShare(d);
    const costs = {};
    await Promise.all(d.items.map(i => col('costs').doc(i.productId).get().then(x => costs[i.productId] = (x.data() || {}).costPrice).catch(() => {})));
    const hasCost = d.items.some(i => i.unitCost != null);
    const rows = d.items.map(i => {
        const old = costs[i.productId], changed = i.unitCost != null && old != null && Math.abs(old - i.unitCost) >= 1;
        return `<div class="list-line"><div class="ll-main"><div class="ll-title">${esc(i.emoji || '')} ${esc(i.name)} · ${qtyTxt(i.qty, { unit: i.unit })}</div>
            <div class="ll-sub">${i.unitCost == null ? 'No price given' : `Paid ${n0(i.unitCost)} each` + (old == null ? ' · no cost on record' : changed ? ` · <b style="color:${i.unitCost > old ? 'var(--red)' : 'var(--pos)'};">was ${n0(old)}</b>` : ' · same as before')}</div></div>
            <div class="ll-amt">${i.lineTotal == null ? '—' : n0(i.lineTotal)}</div></div>`;
    }).join('');
    $('dvBody').innerHTML = `
        <div style="text-align:center;font-size:.8rem;color:var(--gray);margin-bottom:8px;">${esc(d.receiptNo)} · 👤 <b style="color:var(--ink);">${esc(d.staffName)}</b> · ${prettyDay(d.day)} ${timeOf(d.createdAt)}${d.supplier ? '<br>🏪 ' + esc(d.supplier) : ''}</div>
        ${rows}
        <div class="diff-big" style="background:#f0fdf4;color:var(--pos);"><small>${esc(PAID_LABEL[d.paidFrom] || '')}</small><span>${fmt(d.total)}</span></div>
        ${d.note ? `<div class="hint gray">📝 “${esc(d.note)}”</div>` : ''}
        <span class="section-label">Your decision</span>
        ${hasCost ? '<label class="check"><input type="checkbox" id="dvCosts" checked><span>Update cost prices to what was paid</span></label>' : ''}
        ${d.paidFrom === 'drawer' ? `<div class="hint gray">💵 The ${fmt(d.total)} paid from the drawer is added to ${esc(d.staffName.split(' ')[0])}'s next cash-up — confirm it there.</div>` : ''}
        ${d.paidFrom === 'owner' && d.total ? `<div class="field-group"><span class="field-label">Record your payment of ${fmt(d.total)} from</span><select id="dvFrom">
            <option value="bank">🏦 Bank</option><option value="mobile">📱 Lipa kwa Simu</option><option value="cash">💵 Cash</option><option value="savings">💰 Savings</option><option value="">Don't record it (already recorded)</option></select></div>` : ''}
        ${d.paidFrom === 'credit' ? '<div class="hint amber">📒 On credit — record the payment in Accounting when you pay the supplier.</div>' : ''}
        <button class="primary-cta green" id="dvBtn" data-id="${d.id}" onclick="confirmReceipt(this.dataset.id)">✅ CONFIRM DELIVERY</button>
        <button class="btn-sec wide" data-id="${d.id}" onclick="deliveryShare(S.receiptCache[this.dataset.id])">📄 Delivery note (PDF)</button>
        <button class="btn-sec wide ghost" onclick="renderDeliveries()">← Back</button>`;
}
async function confirmReceipt(id) {
    const d = S.receiptCache[id]; if (!d) return;
    const upd = $('dvCosts') ? $('dvCosts').checked : false, from = $('dvFrom') ? $('dvFrom').value : '';
    const b = db.batch();
    if (upd) d.items.forEach(i => { if (i.unitCost != null) b.set(col('costs').doc(i.productId), { costPrice: i.unitCost, updatedAt: now() }, { merge: true }); });
    if (from && d.total) writeEntries(b, [{ type: 'expense', category: 'Supplier', from, to: null, amount: d.total, note: `Delivery ${d.receiptNo}${d.supplier ? ' · ' + d.supplier : ''}`, day: d.day, deliveryId: d.id }]);
    b.update(col('receipts').doc(id), { status: 'confirmed', costsUpdated: upd, paymentRecorded: !!from, paymentFrom: from || null, reviewedBy: S.me.name, reviewedAt: now() });
    $('dvBtn').disabled = true;
    await commit(b, '✅ Delivery checked');
    renderDeliveries();
}
// Deliveries this seller paid from the drawer since their last cash-up (they count as paid-outs)
async function myDrawerDeliveries() {
    const since = myShiftStart();
    try {
        const s = await col('receipts').where('staffUid', '==', S.me.uid).where('day', '==', dayStr()).get();
        return s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.paidFrom === 'drawer' && d.total > 0 && (!since || (tms(d.createdAt) || 9e15) > since));
    } catch (e) { return []; }
}

// ════════════════════════════════════════════════
