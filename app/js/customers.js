// Serial / IMEI numbers on a sale line: tracked serials plus any number typed at the till
const itemIds = i => [...(i.serials || []), ...(i.ref ? [i.ref] : [])];
// Keep till — Customers, credit and receipts.
// Part of app/index.html; the parts load in order and share one global scope.
//  CUSTOMERS & CREDIT
// ════════════════════════════════════════════════
S.customers = []; S.custMode = 'manage';
function openCustomers(mode) {
    S.custMode = mode || 'manage';
    const pick = S.custMode === 'pick';
    if (!pick || !S.dockCart) openSheet('sheetCustomers'); else { $('sheetCustomers').classList.add('active'); }
    $('custTitle').textContent = pick ? '👤 Choose customer' : '👥 Customers';
    $('custBack').textContent = pick ? '← BACK TO CART' : 'CLOSE';
    $('custSearch').value = ''; ['ncName', 'ncPhone'].forEach(i => $(i).value = '');
    $('custList').innerHTML = '<div class="empty-state" style="padding:12px;">Loading…</div>';
    S.sheetListeners.push(col('customers').onSnapshot(s => {
        S.customers = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.balance || 0) - (a.balance || 0) || (a.name || '').localeCompare(b.name || ''));
        renderCustomers();
        if (S.custOpen && $('sheetCustomer').classList.contains('active')) renderCustomerDetail(S.custOpen);
    }, e => { $('custList').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }));
    setTimeout(() => $('custSearch').focus(), 250);
}
function closeCustomers() {
    if (S.custMode === 'pick') { if (S.dockCart) $('sheetCustomers').classList.remove('active'); else openCart(); }
    else closeModals();
}
function renderCustomers() {
    const q = ($('custSearch').value || '').toLowerCase().trim();
    const owed = S.customers.reduce((a, c) => a + Math.max(0, c.balance || 0), 0), debtors = S.customers.filter(c => (c.balance || 0) > 0).length;
    $('custOwed').innerHTML = S.custMode === 'manage' && owed ? `<div class="diff-big" style="background:#fef3c7;color:#92400e;"><small>Customers owe you</small><span>${fmt(owed)}</span><small style="margin-top:2px;">${debtors} customer${debtors > 1 ? 's' : ''}</small></div>` : '';
    const list = S.customers.filter(c => !q || [c.name, c.phone, prettyPhone(c.phone || '')].join(' ').toLowerCase().includes(q));
    $('custList').innerHTML = list.length ? list.slice(0, 80).map(c => `
        <div class="list-line" style="cursor:pointer;background:#f8fafc;border-left-color:${(c.balance || 0) > 0 ? 'var(--amber)' : 'var(--line)'};" onclick="${S.custMode === 'pick' ? `pickCustomer('${c.id}')` : `openCustomer('${c.id}')`}">
            <div class="ll-main"><div class="ll-title">${esc(c.name)}</div><div class="ll-sub">${c.phone ? '📱 ' + esc(prettyPhone(c.phone)) : 'no phone'}${c.totalBought ? ' · bought ' + n0(c.totalBought) : ''}</div></div>
            <div class="ll-amt" style="color:${(c.balance || 0) > 0 ? 'var(--red)' : (c.balance || 0) < 0 ? 'var(--blue)' : 'var(--gray)'};">${(c.balance || 0) > 0 ? 'owes ' + n0(c.balance) : (c.balance || 0) < 0 ? 'we owe ' + n0(-c.balance) : '✓'}</div>
        </div>`).join('') : `<div class="empty-state" style="padding:12px;">${S.customers.length ? 'No match — add them below.' : 'No customers yet.'}</div>`;
}
async function addCustomer() {
    const name = $('ncName').value.trim(), phone = normPhone($('ncPhone').value);
    if (!name) return toast('⚠️ Enter the customer name.', 'err');
    if (phone && !/^\d{10,15}$/.test(phone)) return toast('⚠️ Phone number looks wrong.', 'err');
    if (phone && S.customers.some(c => c.phone === phone)) return toast('⚠️ A customer with that phone already exists.', 'err');
    const ref = col('customers').doc(), b = db.batch();
    const c = { name, phone, balance: 0, totalBought: 0, createdAt: now(), createdBy: S.me.name };
    b.set(ref, c);
    commit(b, '✅ Customer added');
    if (S.custMode === 'pick') { S.saleCustomer = { id: ref.id, name, phone, balance: 0 }; closeCustomers(); S.payTouched = false; renderCart(); }
    else { $('ncName').value = ''; $('ncPhone').value = ''; }
}
function pickCustomer(id) {
    const c = S.customers.find(x => x.id === id); if (!c) return;
    S.saleCustomer = { id: c.id, name: c.name, phone: c.phone || '', balance: c.balance || 0 };
    S.payTouched = false;
    closeCustomers(); renderCart();
}
function openCustomer(id) {
    S.custOpen = id;
    $('sheetCustomers').classList.remove('active');
    $('sheetCustomer').classList.add('active');
    renderCustomerDetail(id);
}
async function renderCustomerDetail(id) {
    const c = S.customers.find(x => x.id === id); if (!c) return;
    const box = $('custBody');
    box.innerHTML = `
        <div class="modal-title" style="margin-bottom:4px;">${esc(c.name)}</div>
        <div style="text-align:center;font-size:.78rem;color:var(--gray);margin-bottom:12px;">${c.phone ? '📱 ' + esc(prettyPhone(c.phone)) : 'No phone'} · bought ${fmt(c.totalBought || 0)} in total</div>
        <div class="diff-big" style="background:${(c.balance || 0) > 0 ? '#fee2e2' : (c.balance || 0) < 0 ? '#eff6ff' : '#e6f6f0'};color:${(c.balance || 0) > 0 ? 'var(--red)' : (c.balance || 0) < 0 ? 'var(--blue)' : 'var(--green)'};"><small>${(c.balance || 0) > 0 ? 'Owes the shop' : (c.balance || 0) < 0 ? 'Shop owes them (refund or use on next purchase)' : 'Nothing owed'}</small><span>${fmt(Math.abs(c.balance || 0))}</span></div>
        ${(c.balance || 0) > 0 ? `<div class="row-btns">
            <button class="primary-cta green" style="margin:0;padding:12px;font-size:.75rem;" onclick="receivePayment('${id}')">💰 RECEIVE PAYMENT</button>
            ${c.phone ? `<button class="btn-sec" onclick="remindCustomer('${id}')">📲 Remind</button>` : ''}</div>` : ''}
        <span class="section-label" style="margin-top:8px;">History</span>
        <div id="custHist"><div class="empty-state" style="padding:10px;">Loading…</div></div>`;
    try {
        const s = await col('sales').where('customer.id', '==', id).get();
        const L = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (tms(b.createdAt) || 9e15) - (tms(a.createdAt) || 9e15)).slice(0, 40);
        L.forEach(x => S.saleCache[x.id] = x);
        $('custHist').innerHTML = L.length ? L.map(x => `
            <div class="list-line ${x.voided ? 'voided' : ''}" style="background:${x.kind === 'repay' ? '#e6f6f0' : '#f8fafc'};border-left-color:${x.kind === 'repay' ? 'var(--pos)' : x.credit ? 'var(--amber)' : 'var(--line)'};">
                <div class="ll-main"><div class="ll-title">${x.kind === 'repay' ? '💰 Paid' : x.kind === 'return' ? '↩️ Returned ' + esc((x.items || []).map(i => i.name).join(', ')).slice(0, 50) : '🛒 ' + esc((x.items || []).map(i => i.name).join(', ')).slice(0, 60)}</div>
                    <div class="ll-sub">${shortDay(x.day)} ${timeOf(x.createdAt)}${x.credit ? ' · 📒 ' + n0(x.credit) + ' on credit' : ''}${x.receiptNo ? ' · ' + esc(x.receiptNo) : ''}</div></div>
                <div class="ll-amt">${n0(x.total)}</div>
                ${x.kind === 'pos' || x.kind === 'return' ? `<button class="tiny-btn" onclick="receiptMenu(S.saleCache['${x.id}'])">🧾</button>` : ''}
                ${x.kind === 'pos' && !x.voided && canReturn() ? `<button class="tiny-btn" onclick="openReturn('${x.id}')">↩️</button>` : ''}
            </div>`).join('') : '<div class="empty-state" style="padding:10px;">No sales yet.</div>';
    } catch (e) { $('custHist').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }
}
async function receivePayment(id) {
    const c = S.customers.find(x => x.id === id); if (!c) return;
    const v = await askValue(`<b>${esc(c.name)}</b> owes ${fmt(c.balance)}.<br>How much did they pay?`, 'Amount', 'Next', { value: String(c.balance) });
    if (v === null || v === '') return;
    const amt = num(v);
    if (!(amt > 0)) return toast('⚠️ Enter the amount paid.', 'err');
    const how = await choose(`Received <b>${fmt(amt)}</b> from ${esc(c.name)}.<br>How was it paid?`, [['cash', '💵 Cash', 'var(--pos)'], ['mobile', '📱 Lipa kwa Simu', 'var(--blue)']]);
    if (!how) return;
    const day = dayStr(), ref = col('sales').doc(), b = db.batch();
    const receiptNo = 'P' + day.slice(2).replace(/-/g, '') + '-' + ref.id.slice(0, 4).toUpperCase();
    const doc = { kind: 'repay', items: [], total: amt, cash: how === 'cash' ? amt : 0, mobile: how === 'mobile' ? amt : 0, credit: 0,
        customer: { id: c.id, name: c.name, phone: c.phone || '' }, receiptNo, day, month: day.slice(0, 7), voided: false, staffUid: S.me.uid, staffName: S.me.name, createdAt: now() };
    b.set(ref, doc);
    const why = src('sales', ref.id);
    b.update(col('customers').doc(id), { balance: inc(-amt), src: why, updatedAt: now() });
    b.set(col('days').doc(day), { day, month: day.slice(0, 7), debtPaid: inc(amt), [how]: inc(amt), src: why, updatedAt: now() }, { merge: true });
    b.set(col('meta').doc('balances'), { [how]: inc(amt), src: why, updatedAt: now() }, { merge: true });
    commit(b, `✅ ${fmt(amt)} received from ${c.name}`, { label: `Debt payment ${fmt(amt)} from ${c.name} (${how})` });
    if (c.phone && await showConfirm('Send them a confirmation on WhatsApp?', '📲 WhatsApp', 'var(--pos)')) {
        const left = Math.max(0, (c.balance || 0) - amt);
        const text = `${S.tenantInfo.name || ''}: Asante ${c.name.split(' ')[0]}! We received ${fmt(amt)} (${receiptNo}).\n${left ? `Balance remaining: ${fmt(left)}` : 'Your account is fully paid ✅'}`;
        openWa(c.phone, text);
    }
}
function remindCustomer(id) {
    const c = S.customers.find(x => x.id === id); if (!c || !c.phone) return;
    const pay = (S.tenantInfo.settings || {}).phone ? `\nCall us: ${prettyPhone(S.tenantInfo.settings.phone)}` : '';
    const text = `Habari ${c.name.split(' ')[0]}, this is ${S.tenantInfo.name || 'the shop'}. A friendly reminder that your balance is ${fmt(c.balance)}. Asante!${pay}`;
    openWa(c.phone, text);
}

// ════════════════════════════════════════════════
//  RECEIPTS
// ════════════════════════════════════════════════
const warrantyEnd = (sale, i) => {
    const m = tms(sale.createdAt) || Date.now(), d = new Date(m);
    d.setMonth(d.getMonth() + (i.warrantyMonths || 0));
    return d;
};
function receiptText(s) {
    const st = S.tenantInfo.settings || {}, L = [];
    L.push(`*${(S.tenantInfo.name || '').toUpperCase()}*`);
    if (st.address) L.push(st.address);
    if (st.phone) L.push('📞 ' + prettyPhone(st.phone));
    L.push('', `🧾 ${s.receiptNo || ''} · ${shortDay(s.day)} ${timeOf(s.createdAt)}`);
    if (s.kind === 'return') L.push(`↩️ *RETURN* of receipt ${s.refReceipt || ''}`);
    if (s.customer) L.push('👤 ' + s.customer.name);
    L.push('');
    (s.items || []).forEach(i => {
        L.push(`${i.name}`);
        L.push(`  ${qtyTxt(i.qty, { unit: i.unit })} × ${n0(i.unitPrice)} = ${n0(i.subtotal)}`);
        itemIds(i).forEach(x => L.push(`  S/N: ${x}`));
        if (i.warrantyMonths) L.push(`  🛡️ Warranty to ${warrantyEnd(s, i).toLocaleDateString('en-GB')}`);
    });
    L.push('━━━━━━━━━━');
    if (s.kind === 'return') {
        L.push(`*REFUND: ${fmt(s.total)}*`);
        if (s.cash) L.push(`Cash given back: ${n0(-s.cash)}`);
        if (s.mobile) L.push(`Sent by Lipa kwa Simu: ${n0(-s.mobile)}`);
        if (s.credit) L.push(`Taken off your balance: ${n0(-s.credit)}`);
    } else {
    if (s.discount) L.push(`You saved: ${n0(s.discount)}`);
    L.push(`*TOTAL: ${fmt(s.total)}*`);
    if (s.cash) L.push(`Cash: ${n0(s.cash)}`);
    if (s.mobile) L.push(`Lipa kwa Simu: ${n0(s.mobile)}`);
    if (s.credit) L.push(`On credit: ${n0(s.credit)}`);
    }
    L.push('', `Served by ${s.staffName || ''}`);
    if (st.footer) L.push(st.footer);
    L.push('Asante kwa kununua!');
    return L.join('\n');
}
// ── Receipt PDF — 80 mm or 58 mm roll (owner picks in Settings → Shop); also reads well on a phone ──
// Drawn twice: once to measure the height, then for real on a page cut to fit.
function receiptPdf(s, opts = {}) {
    if (!window.jspdf) return toast('PDF tool did not load — check your connection.', 'err');
    const st = S.tenantInfo.settings || {}, { jsPDF } = window.jspdf;
    const narrow = Number(opts.paperWidth || st.paperWidth) === 58;
    const W = narrow ? 58 : 80, M = narrow ? 3.5 : 5, R = W - M, CW = W - 2 * M;
    const k = narrow ? 0.9 : 1;                      // text scale; smallest text never below 6.6 pt
    const fs = n => Math.max(6.6, n * k);
    const isRet = s.kind === 'return', when = new Date(tms(s.createdAt) || Date.now());
    const logo = st.logo || null;
    const date = when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + '  ' + when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const xQty = M + CW * 0.66;                      // right edge of the QTY column

    const draw = doc => {
        let y = narrow ? 5.5 : 7;
        const font = (size, style = 'normal', gray = 0) => { doc.setFont('helvetica', style); doc.setFontSize(fs(size)); doc.setTextColor(gray); };
        const lh = size => fs(size) * 0.42;
        const center = (t, size, style, gray, gap) => { font(size, style, gray); doc.splitTextToSize(String(t), CW).forEach(l => { doc.text(l, W / 2, y, { align: 'center' }); y += lh(size); }); y += gap || 0; };
        const row = (l, r, size = 7.5, style = 'normal', gray = 0) => {
            font(size, style, gray);
            const rw = doc.getTextWidth(String(r)), left = doc.splitTextToSize(String(l), Math.max(10, CW - rw - 2));
            doc.text(String(r), R, y, { align: 'right' });
            left.forEach((t, i) => { doc.text(t, M, y); if (i < left.length - 1) y += lh(size); });
            y += lh(size) + 0.9;
        };
        const label = t => { font(6.8, 'bold', 40); doc.setCharSpace(0.3); doc.text(t, M, y); doc.setCharSpace(0); y += lh(6.8) + 1; };
        const rule = (w = 0.2, dash) => { doc.setDrawColor(0); doc.setLineWidth(w); doc.setLineDashPattern(dash || [], 0); doc.line(M, y, R, y); doc.setLineDashPattern([], 0); };

        // ─ Header
        if (logo) {
            try {
                const p = doc.getImageProperties(logo), maxW = CW * 0.68, maxH = narrow ? 16 : 20;
                const f = Math.min(maxW / p.width, maxH / p.height), w = p.width * f, h = p.height * f;
                doc.addImage(logo, p.fileType || 'PNG', (W - w) / 2, y - 2, w, h); y += h + 2.6;
            } catch (e) { /* unreadable logo — skip */ }
        }
        if (!(logo && st.logoHasName)) center((S.tenantInfo.name || '').toUpperCase(), narrow ? 11.5 : 12.5, 'bold', 0, 0.6);
        if (st.address) center(st.address, 7.2, 'normal', 35);
        if (st.phone) center('Tel ' + prettyPhone(st.phone), 7.2, 'normal', 35);
        y += 2; rule(0.6); y += 4.6;

        // ─ Title, number, details
        font(narrow ? 8.5 : 9, 'bold'); doc.setCharSpace(narrow ? 0.3 : 0.6);
        doc.text(isRet ? (narrow ? 'RETURN' : 'RETURN RECEIPT') : 'RECEIPT', M, y); doc.setCharSpace(0);
        doc.text(String(s.receiptNo || ''), R, y, { align: 'right' }); y += 4.8;
        row('Date', date, 7.5, 'normal', 25);
        if (isRet) row('Original receipt', s.refReceipt || '', 7.5, 'normal', 25);
        row('Served by', s.staffName || '', 7.5, 'normal', 25);
        if (s.customer) {
            row('Customer', s.customer.name, 7.5, 'normal', 25);
            if (s.customer.phone) row('Phone', prettyPhone(s.customer.phone), 7.5, 'normal', 25);
        }
        y += 1; rule(0.2); y += 4;

        // ─ Items
        font(6.8, 'bold', 40); doc.text('ITEM', M, y); doc.text('QTY', xQty, y, { align: 'right' }); doc.text('AMOUNT', R, y, { align: 'right' }); y += 2.2;
        rule(0.15, [0.6, 0.6]); y += 3.9;
        (s.items || []).forEach(i => {
            font(8, 'bold');
            const nameW = xQty - M - (narrow ? 7 : 10);
            const name = doc.splitTextToSize(i.name, nameW).slice(0, 2);
            name.forEach((t, n) => {
                doc.text(t, M, y);
                if (n === 0) { font(8, 'normal'); doc.text(qtyTxt(i.qty, { unit: i.unit }), xQty, y, { align: 'right' }); font(8, 'bold'); doc.text(n0(i.subtotal), R, y, { align: 'right' }); }
                y += lh(8) + 0.2;
            });
            font(7, 'normal', 40);
            const was = !isRet && i.listPrice && i.listPrice > i.unitPrice ? `   was ${n0(i.listPrice)}` : '';
            doc.text(`@ ${n0(i.unitPrice)}${was}`, M, y); y += lh(7) + 0.4;
            itemIds(i).forEach(x => { doc.setFont('courier', 'bold'); doc.setFontSize(fs(7.2)); doc.setTextColor(0); doc.text('S/N ' + x, M + 1, y); y += lh(7.2) + 0.3; });
            y += 1.6;
        });
        rule(0.2); y += 4.4;

        // ─ Total: between two strong lines (prints reliably, looks light on screen)
        const big = (l, r) => {
            rule(0.7); y += 5.4;
            font(9, 'bold'); doc.setCharSpace(0.4); doc.text(l, M, y); doc.setCharSpace(0);
            font(narrow ? 12 : 13.5, 'bold'); doc.text(r, R, y + 0.3, { align: 'right' });
            y += 3.2; rule(0.7); y += 4.6;
        };
        if (isRet) {
            big('REFUND', 'TZS ' + n0(s.total));
            if (s.cash) row('Cash given back', n0(-s.cash), 7.6, 'normal', 15);
            if (s.mobile) row('Sent by Lipa kwa Simu', n0(-s.mobile), 7.6, 'normal', 15);
            if (s.credit) row('Taken off your balance', n0(-s.credit), 7.6, 'normal', 15);
        } else {
            if (s.discount) { row('Subtotal', n0((s.total || 0) + (s.discount || 0)), 7.5, 'normal', 25); row('Discount', '- ' + n0(s.discount), 7.5, 'normal', 25); y += 0.6; }
            big('TOTAL', 'TZS ' + n0(s.total));
            label('PAID BY');
            if (s.cash) row('Cash', n0(s.cash), 7.6, 'normal', 15);
            if (s.mobile) row('Lipa kwa Simu', n0(s.mobile), 7.6, 'normal', 15);
            if (s.credit) row('On credit — to pay', n0(s.credit), 7.8, 'bold', 0);
            if (s.discount) { y += 0.8; center(`You saved TZS ${n0(s.discount)}`, 7.4, 'bold', 0); }
        }
        // ─ Warranty card
        const wItems = isRet ? [] : (s.items || []).filter(i => i.warrantyMonths);
        if (wItems.length) {
            y += 2.6; const top = y;
            y += 4.6; font(8, 'bold'); doc.setCharSpace(0.5); doc.text('WARRANTY', M + 2.6, y); doc.setCharSpace(0); y += 4.2;
            wItems.forEach(i => {
                font(7.6, 'bold'); doc.splitTextToSize(i.name, CW - 5).slice(0, 2).forEach(t => { doc.text(t, M + 2.6, y); y += lh(7.6) + 0.2; });
                itemIds(i).forEach(x => { doc.setFont('courier', 'bold'); doc.setFontSize(fs(7.2)); doc.setTextColor(0); doc.text('S/N ' + x, M + 2.6, y); y += lh(7.2) + 0.3; });
                font(7.2, 'normal', 15); doc.splitTextToSize(`${i.warrantyMonths} month${i.warrantyMonths > 1 ? 's' : ''} · valid until ${warrantyEnd(s, i).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, CW - 5).forEach(t => { doc.text(t, M + 2.6, y); y += lh(7.2); });
                y += 1.6;
            });
            font(6.8, 'normal', 40); doc.splitTextToSize('Bring this receipt for any warranty claim.', CW - 5).forEach(t => { doc.text(t, M + 2.6, y); y += lh(6.8); });
            y += 0.8;
            doc.setDrawColor(0); doc.setLineWidth(0.35); doc.setLineDashPattern([1.2, 0.8], 0);
            doc.roundedRect(M, top, CW, y - top, 1.6, 1.6); doc.setLineDashPattern([], 0); y += 2;
        }

        // ─ Void stamp
        if (s.voided) {
            y += 3; doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.8); doc.rect(W / 2 - 16, y - 6, 32, 10);
            doc.setTextColor(220, 38, 38); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('VOID', W / 2, y + 1.6, { align: 'center' }); y += 9;
        }

        // ─ Footer
        y += 4;
        if (st.footer) center(st.footer, 7.2, 'italic', 25, 1.2);
        center('Asante kwa kununua!', 8.6, 'bold', 0, 1.6);
        center('Not a tax (EFD) receipt', 6.8, 'normal', 50, 0.4);
        center('Receipt by Keep', 6.6, 'normal', 90);
        return y + 3;
    };
    const probe = new jsPDF({ unit: 'mm', format: [W, 1000] });
    const H = draw(probe);
    const doc = new jsPDF({ unit: 'mm', format: [W, Math.max(narrow ? 70 : 90, H)] });
    draw(doc);
    if (opts.returnDoc) return doc;
    doc.save(`${s.receiptNo || 'receipt'}.pdf`);
}

// ── Shop logo (owner): picked from the phone, shrunk and stored with the shop ──
function renderLogoBox() {
    const lg = (S.tenantInfo.settings || {}).logo, box = $('logoBox'); if (!box) return;
    box.innerHTML = lg
        ? `<img src="${lg}" alt="Shop logo" style="max-width:120px;max-height:64px;display:block;margin:0 auto 8px;">
           <label style="display:flex;gap:8px;align-items:center;justify-content:center;font-size:.75rem;margin:0 0 8px;"><input type="checkbox" ${(S.tenantInfo.settings || {}).logoHasName ? 'checked' : ''} onchange="setLogoHasName(this.checked)"> My logo already shows the shop name</label>
           <div class="row-btns"><button class="btn-sec" onclick="$('logoFile').click()">🔁 Change logo</button><button class="btn-sec" onclick="removeLogo()">🗑️ Remove</button></div>`
        : `<div style="font-size:.75rem;color:var(--gray);margin-bottom:8px;">No logo yet. It is printed at the top of receipts.</div>
           <button class="btn-sec wide" onclick="$('logoFile').click()">📷 UPLOAD LOGO</button>`;
}
function pickLogo(input) {
    const f = input.files && input.files[0]; input.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) return toast('⚠️ Choose a picture (PNG or JPG).', 'err');
    if (f.size > 8 * 1024 * 1024) return toast('⚠️ That picture is too big (over 8 MB).', 'err');
    const r = new FileReader();
    r.onload = () => {
        const img = new Image();
        img.onload = () => {
            // fit inside 480 × 240, keep the shape
            const k = Math.min(1, 480 / img.width, 240 / img.height), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
            let data = cv.toDataURL('image/png');
            if (data.length > 180000) {           // big photo-like logo: white background + JPEG
                const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
                const x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, w, h); x2.drawImage(cv, 0, 0);
                data = c2.toDataURL('image/jpeg', 0.85);
            }
            if (data.length > 300000) return toast('⚠️ This logo is too detailed. Try a simpler PNG.', 'err');
            loader(true, 'SAVING LOGO...');
            tRef().update({ 'settings.logo': data }).then(() => {
                S.tenantInfo.settings = { ...(S.tenantInfo.settings || {}), logo: data }; renderLogoBox(); toast('✅ Logo saved — it now prints on receipts');
            }).catch(e => toast('⚠️ ' + friendlyErr(e), 'err')).finally(() => loader(false));
        };
        img.onerror = () => toast('⚠️ Could not read that picture.', 'err');
        img.src = r.result;
    };
    r.readAsDataURL(f);
}
function setLogoHasName(on) {
    tRef().update({ 'settings.logoHasName': !!on }).then(() => { S.tenantInfo.settings = { ...(S.tenantInfo.settings || {}), logoHasName: !!on }; toast(on ? 'The shop name will not be repeated under the logo' : 'The shop name will print under the logo'); }).catch(e => toast('⚠️ ' + friendlyErr(e), 'err'));
}
async function removeLogo() {
    if (!await showConfirm('Remove the shop logo from receipts?', 'Remove')) return;
    tRef().update({ 'settings.logo': FV.delete() }).then(() => {
        if (S.tenantInfo.settings) delete S.tenantInfo.settings.logo; renderLogoBox(); toast('Logo removed');
    }).catch(e => toast('⚠️ ' + friendlyErr(e), 'err'));
}
// A sample receipt, so the owner can see their logo and details before a real sale
function previewReceipt() {
    const P = (S.products || []).filter(p => !p.trackSerial).slice(0, 2);
    const items = P.length ? P.map((p, k) => ({ name: p.name, unit: unitOf(p), qty: k + 1, unitPrice: Number(p.sellPrice) || 1000, listPrice: Number(p.sellPrice) || 1000, subtotal: (k + 1) * (Number(p.sellPrice) || 1000) }))
        : [{ name: 'Sample item', unit: 'pc', qty: 2, unitPrice: 2500, listPrice: 2500, subtotal: 5000 }];
    items.push({ name: 'Sample phone (warranty)', unit: 'pc', qty: 1, unitPrice: 250000, listPrice: 250000, subtotal: 250000, serials: ['356789104455221'], warrantyMonths: 12 });
    const total = items.reduce((a, i) => a + i.subtotal, 0);
    const pw = $('setPaper') ? Number($('setPaper').value) : 0;
    receiptPdf({ kind: 'pos', receiptNo: 'SAMPLE-0001', items, total, cash: total, mobile: 0, credit: 0, discount: 0, staffName: S.me ? S.me.name : '', customer: { name: 'Sample Customer', phone: '' }, createdAt: { toMillis: () => Date.now(), toDate: () => new Date() } }, { paperWidth: pw });
}
// Receipts always go to the customer on WhatsApp: as a text message, or as a PDF file.
// Keep asks for the number every time (filled in when the customer is known).
async function receiptMenu(s, afterSale) {
    if (!s) return;
    const head = afterSale ? `✅ <b>${tl(isBarberMode() ? 'Client recorded' : 'Sale recorded')}</b> · ${fmt(s.total)}<br><span style="font-weight:500;">${tl('Send the customer a receipt on WhatsApp?')}</span><br>`
        : `🧾 ${tl(s.kind === 'return' ? 'Return receipt' : 'Receipt')} `;
    let how = await choose(`${head}<b class="notr">${esc(s.receiptNo || '')}</b>${afterSale ? '' : ' · ' + fmt(s.total)}${s.customer ? '<br><span class="notr">' + esc(s.customer.name) + '</span>' : ''}`,
        [['text', '💬 ' + tl('WhatsApp · text'), 'var(--pos)'], ['pdf', '📄 ' + tl('WhatsApp · PDF'), 'var(--blue)']], afterSale ? tl('No receipt') : undefined);
    if (how !== 'text' && how !== 'pdf') return;
    if (how === 'pdf' && !window.jspdf) { toast(tl('PDF is not available right now (check the internet). Sending as text.'), 'err'); how = 'text'; }
    const to = await askReceiptNumber(s);
    if (!to) return;
    if (how === 'text') return openWa(to, receiptText(s));
    sendReceiptPdf(s, to);
}
async function askReceiptNumber(s) {
    let v = (s.customer && s.customer.phone) || '';
    if (/^255\d{9}$/.test(v)) v = '0' + v.slice(3);
    for (let tries = 0; tries < 5; tries++) {
        v = await askValue(`📲 ${tl('Customer WhatsApp number')}`, '07XX XXX XXX', tl('Next'), { value: v });
        if (v == null || !String(v).trim()) return null;
        const n = normPhone(v);
        if (/^\d{10,15}$/.test(n)) return n;
        toast(tl('Enter a phone number like 0712 345 678'), 'err');
    }
    return null;
}
// A web page cannot attach a file to a WhatsApp chat by itself, so this takes two taps:
// 1) open the customer's chat (with a short note), 2) share the PDF and pick that chat (it is now at the top).
async function sendReceiptPdf(s, to) {
    const doc = receiptPdf(s, { returnDoc: true }); if (!doc) return;
    const name = `${s.receiptNo || 'receipt'}.pdf`;
    const file = new File([doc.output('blob')], name, { type: 'application/pdf' });
    const canFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const shown = '0' + to.slice(3);
    openWa(to, `${tl('Hello')}${s.customer && s.customer.name ? ' ' + s.customer.name.split(' ')[0] : ''}, ${tl('your receipt')} ${s.receiptNo || ''} · ${fmt(s.total)} — ${S.tenantInfo.name || ''}. ${tl('PDF coming next')} 📄`);
    if (!canFile) { doc.save(name); return toast(tl('PDF saved. Attach it in the WhatsApp chat that opened.')); }
    const go = await choose(`📄 <b>${tl('Now send the PDF')}</b><br><span style="font-weight:500;">${tl('Tap below, choose WhatsApp, then pick the chat with')} <b class="notr">${esc(shown)}</b> ${tl('(at the top of the list).')}</span>`,
        [['share', '📎 ' + tl('Send the PDF'), 'var(--pos)']], tl('Done'));
    if (go !== 'share') return;
    try { await navigator.share({ files: [file], title: name }); }
    catch (e) { if (e && e.name !== 'AbortError') toast(tl('Could not open sharing on this phone.'), 'err'); }
}

// ════════════════════════════════════════════════
