// Keep till — Subscription, team and settings.
// Part of app/index.html; the parts load in order and share one global scope.
//  SUBSCRIPTION — lock screen, reminders, receipts
//  The lock is enforced by the database rules; this is what staff see.
// ════════════════════════════════════════════════
const tms = x => x && x.toMillis ? x.toMillis() : null;
const tsDay = x => tms(x) ? new Date(tms(x)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
function subState(t) {
    t = t || {};
    if (t.status === 'archived') return { locked: true, reason: 'closed' };
    if (t.status && t.status !== 'active') return { locked: true, reason: 'suspended' };
    const until = tms(t.paidUntil), lock = tms(t.lockAt), now = Date.now();
    if (lock && now >= lock) return { locked: true, reason: 'expired', until };
    return { locked: false, until, lock, trial: !!t.trial, overdue: !!(until && now > until), daysLeft: until ? Math.ceil((until - now) / 864e5) : null };
}
function payInstructions() {
    const P = S.platform || {}, t = S.tenantInfo;
    return `Amount: ${fmt(t.monthlyFee || 0)} per month\n${P.payHow || 'Contact Keep for payment details.'}\nReference: ${S.tenant}`;
}
function stopLockWatch() { if (S.lockWatch) { S.lockWatch(); S.lockWatch = null; } }
function showLocked() {
    stopListeners(); closeModals();
    $('mainApp').style.display = 'none'; $('loginPage').style.display = 'none';
    document.body.classList.remove('unlocked');
    syncCartDock();
    renderLock();
    $('lockPage').style.display = 'flex';
    // Watch the shop record: the moment Keep records a payment, the till opens again.
    S.lockWatch = tRef().onSnapshot(s => {
        S.tenantInfo = s.data() || {};
        if (!subState(S.tenantInfo).locked) { toast('✅ Subscription active — welcome back!'); enterApp(); }
        else renderLock();
    }, () => {});
}
function renderLock() {
    const t = S.tenantInfo, st = subState(t), P = S.platform || {};
    $('lockShop').textContent = (t.name || S.tenant || '').toUpperCase();
    $('lockTitle').textContent = st.reason === 'expired' ? 'Subscription ended' : st.reason === 'suspended' ? 'Shop paused by Keep' : 'Shop closed';
    $('lockWhy').textContent = st.reason === 'expired'
        ? `The Keep POS subscription ended on ${tsDay(t.paidUntil)}. Your sales and stock are safe.${isAdmin() ? '' : ' Please tell the shop owner.'}`
        : `Please contact Keep to reopen this shop.${isAdmin() ? '' : ' Tell the shop owner.'}`;
    $('lockPay').textContent = st.reason === 'expired' ? payInstructions() : (P.supportPhone ? 'Keep support: ' + prettyPhone(P.supportPhone) : 'Contact Keep support.');
    $('lockWa').classList.toggle('hidden', !P.supportPhone);
    $('lockWa').textContent = st.reason === 'expired' ? "📲 I've paid — tell Keep" : '📲 Contact Keep';
}
function lockWhatsApp() {
    const P = S.platform || {}, t = S.tenantInfo;
    const text = subState(t).reason === 'expired'
        ? `Hello Keep, I have paid the subscription for *${t.name}* (shop code ${S.tenant}).\nAmount: \nTransaction ID: `
        : `Hello Keep, I need help with shop *${t.name}* (shop code ${S.tenant}).`;
    openWa(P.supportPhone, text);
}

function dismissedNotices() { try { return JSON.parse(sGet('matinyo.dismissed') || '[]'); } catch (e) { return []; } }
function dismissNotice(id) { const d = dismissedNotices(); d.push(id); sSet('matinyo.dismissed', JSON.stringify(d.slice(-50))); renderNotices(); }
function renderNotices() {
    const box = $('noticeBar'); if (!box || !S.me) return;
    const out = [], t = S.tenantInfo, fee = fmt(t.monthlyFee || 0);
    if (isAdmin() && (S.pendingCashups || []).length) {
        const n = S.pendingCashups.length;
        out.push(['warn', `🧾 ${n} cash-up${n > 1 ? 's' : ''} to review`, `From ${[...new Set(S.pendingCashups.map(c => (c.staffName || '').split(' ')[0]))].join(', ')}. Check the money, then close the day.`, 'cash']);
    }
    if (isAdmin()) {
        const st = subState(t);
        if (st.overdue) out.push(['red', '⏰ Payment overdue', `The till locks on ${tsDay(t.lockAt)}. Pay ${fee} to keep selling.`, 'sub']);
        else if (st.trial && st.daysLeft !== null && st.daysLeft <= 7) out.push(['info', `🧪 Free trial: ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left`, `Ends ${tsDay(t.paidUntil)}. Then ${fee} per month.`, 'sub']);
        else if (!st.trial && st.daysLeft !== null && st.daysLeft <= 5) out.push(['warn', `📅 Subscription ends in ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'}`, `Renew ${fee} before ${tsDay(t.paidUntil)}.`, 'sub']);
    }
    if (isAdmin() && (S.pendingReceipts || []).length) {
        const n = S.pendingReceipts.length, tot = S.pendingReceipts.reduce((a, d) => a + (d.total || 0), 0);
        out.push(['warn', `🚚 ${n} deliver${n > 1 ? 'ies' : 'y'} to check`, `From ${[...new Set(S.pendingReceipts.map(d => (d.staffName || '').split(' ')[0]))].join(', ')} · ${fmt(tot)}. Check the prices and confirm.`, 'dlv']);
    }
    const neg = isAdmin() ? S.products.filter(p => (Number(p.stock) || 0) < -1e-9) : [];
    if (neg.length) out.push(['red', `📦 ${neg.length} item${neg.length > 1 ? 's are' : ' is'} below zero`, `${neg.slice(0, 3).map(p => `${p.name} (${q3(p.stock)})`).join(', ')}${neg.length > 3 ? ' …' : ''}. More was sold than the system had — usually two tills sold the last one, or the count was wrong. Count ${neg.length > 1 ? 'them' : 'it'} and correct the stock.`, 'neg']);
    const fs = failedSaves();
    if (fs.length) out.push(['red', `⚠️ ${fs.length} thing${fs.length > 1 ? 's were' : ' was'} not saved`, 'The internet or a permission problem stopped it. Tap to see what to enter again.', 'failed']);
    if (S.clockOff) out.push(['red', '⏰ This phone\'s clock is wrong', `It is about ${S.clockOff > 0 ? S.clockOff + ' min ahead' : -S.clockOff + ' min behind'}, so sales may be saved under the wrong date. Turn on automatic date & time in the phone settings.`, 'clock']);
    const gone = dismissedNotices();
    (S.announcements || []).forEach(a => {
        if (a.shops && a.shops.length && !a.shops.includes(S.tenant)) return;
        if (tms(a.endsAt) && tms(a.endsAt) < Date.now()) return;
        if (gone.includes(a.id)) return;
        out.push([a.level === 'warn' ? 'warn' : 'info', (a.level === 'warn' ? '⚠️ ' : '📣 ') + a.title, a.body, 'ann', a.id]);
    });
    box.innerHTML = out.map(([cls, title, body, kind, id]) => `<div class="notice ${cls}"><div><b>${esc(title)}</b>${esc(body)}</div>${kind === 'sub'
        ? '<button class="act" onclick="openSub()">How to pay</button>' : kind === 'cash' ? '<button class="act" onclick="openCashups()">Review</button>'
        : kind === 'dlv' ? '<button class="act" onclick="openDeliveries()">Check</button>'
        : kind === 'failed' ? '<button class="act" onclick="showFailedSaves()">See</button>' : kind === 'neg' ? '<button class="act" onclick="openStocktake()">Count</button>' : kind === 'clock' ? ''
        : `<button title="Hide" onclick="dismissNotice('${id}')">✕</button>`}</div>`).join('');
}

function planUsageText() {
    const t = S.tenantInfo, lim = t.limits || {};
    return `${t.plan || 'Plan'} · ${usedStaff()}/${lim.maxStaff || '∞'} staff · ${usedItems()}/${lim.maxProducts || '∞'} items`;
}
S.subPays = [];
function openSub() {
    const t = S.tenantInfo, st = subState(t), lim = t.limits || {};
    openSheet('sheetSub');
    const status = st.trial ? `🧪 Free trial — ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left` : st.overdue ? '⏰ Overdue — locks ' + tsDay(t.lockAt) : st.daysLeft !== null ? `✅ Active — ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left` : '—';
    $('subBody').innerHTML = `
        <div class="sum-box">
            <div class="sum-row"><span>Plan</span><strong>${esc(t.plan || '—')} · ${fmt(t.monthlyFee || 0)}/month</strong></div>
            <div class="sum-row"><span>Status</span><strong>${status}</strong></div>
            <div class="sum-row"><span>Paid until</span><strong>${tsDay(t.paidUntil)}</strong></div>
            <div class="sum-row"><span>Plan limits</span><strong>${lim.maxStaff || '∞'} staff · ${lim.maxProducts || '∞'} items</strong></div>
        </div>
        <span class="section-label">How to pay</span>
        <div class="pay-box" style="margin-top:0;">${esc(payInstructions())}</div>
        ${(S.platform || {}).supportPhone ? `<button class="btn-sec wide" onclick="lockWhatsApp()">📲 Tell Keep you've paid</button>` : ''}
        <span class="section-label" style="margin-top:10px;">Payments & receipts</span>
        <div id="subPays"><div style="font-size:.75rem;color:var(--gray);padding:8px 0;">Loading…</div></div>`;
    S.sheetListeners.push(col('payments').onSnapshot(s => {
        S.subPays = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (tms(b.paidAt) || 0) - (tms(a.paidAt) || 0));
        $('subPays').innerHTML = S.subPays.length ? S.subPays.map(p => `
            <div class="list-line" style="background:${p.voided ? '#f3f4f6' : '#f0fdf4'};border-left-color:${p.voided ? '#9ca3af' : 'var(--pos)'};">
                <div class="ll-main ${p.voided ? 'voided' : ''}"><div class="ll-title">${fmt(p.amount)} · ${p.months} month${p.months > 1 ? 's' : ''}</div>
                <div class="ll-sub">${tsDay(p.paidAt)} · ${esc(p.method)} · ${esc(p.receiptNo || '')}</div></div>
                <button class="tiny-btn" onclick="tillReceipt('${p.id}')">🧾 Receipt</button>
            </div>`).join('') : '<div style="font-size:.75rem;color:var(--gray);padding:8px 0;">No payments yet.</div>';
    }, e => { $('subPays').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }));
}
function tillReceipt(pid) {
    const p = S.subPays.find(x => x.id === pid); if (!p) return;
    if (!window.jspdf) return toast('PDF tool did not load — check your connection.', 'err');
    const P = S.platform || {}, { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a5' }), W = 148;
    doc.setFillColor(11, 13, 18); doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255, 199, 44); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('KEEP', 12, 15);
    doc.setTextColor(96, 165, 250); doc.setFontSize(9); doc.text('POS SUBSCRIPTION', 12, 22);
    doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.text('RECEIPT', W - 12, 15, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(p.receiptNo || '', W - 12, 22, { align: 'right' });
    doc.setFillColor(26, 86, 219); doc.rect(0, 30, W, 1.5, 'F');
    let y = 44;
    const row = (l, v, bold) => { doc.setTextColor(110, 116, 128); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(l, 12, y); doc.setTextColor(11, 13, 18); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 9.5); doc.text(String(v), W - 12, y, { align: 'right' }); y += 8; };
    row('Date paid', tsDay(p.paidAt)); row('Received from', p.shopName || S.tenant);
    if (p.ownerName) row('Owner', p.ownerName);
    row('Shop code', p.shop || S.tenant); row('Plan', `${p.plan} · ${p.months} month${p.months > 1 ? 's' : ''}`);
    row('Period', `${tsDay(p.periodFrom)} – ${tsDay(p.periodTo)}`); row('Paid via', p.method + (p.reference ? ' · ' + p.reference : ''));
    y += 2; doc.setDrawColor(227, 232, 239); doc.line(12, y - 5, W - 12, y - 5);
    row('Amount', fmt(p.amount), true);
    if (p.voided) { doc.setTextColor(220, 38, 38); doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.text('VOID', W / 2, 110, { align: 'center', angle: 20 }); }
    doc.setTextColor(110, 116, 128); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Thank you for your business.', W / 2, 180, { align: 'center' });
    doc.text(P.bizLine || 'Matinyo', W / 2, 186, { align: 'center' });
    if (P.supportPhone) doc.text('Support: ' + prettyPhone(P.supportPhone), W / 2, 192, { align: 'center' });
    doc.save(`${p.receiptNo || 'receipt'}.pdf`);
}

// ════════════════════════════════════════════════
//  TEAM & SETTINGS
// ════════════════════════════════════════════════
S.staff = [];
async function loadCashStats() {
    S.cashStats = {};
    try {
        const s = await col('cashups').where('createdAt', '>=', TSms(nowMs() - 30 * 864e5)).get();
        s.docs.forEach(d => {
            const c = d.data(), k = c.staffUid, x = S.cashStats[k] = S.cashStats[k] || { n: 0, short: 0, over: 0 };
            x.n++;
            if (c.status === 'confirmed') { if ((c.diffCash || 0) < -1) x.short += -c.diffCash; else if ((c.diffCash || 0) > 1) x.over += c.diffCash; }
        });
    } catch (e) {}
}
function cashStatText(uid) {
    const x = (S.cashStats || {})[uid];
    if (!x || !x.n) return '';
    return `<div style="font-size:0.66rem;margin-top:2px;color:${x.short ? 'var(--red)' : 'var(--gray)'};">🧾 ${x.n} cash-up${x.n > 1 ? 's' : ''} in 30 days${x.short ? ' · short ' + n0(x.short) : ''}${x.over ? ' · over ' + n0(x.over) : ''}${!x.short && !x.over ? ' · no differences' : ''}</div>`;
}
function teamTab(t) {
    S.teamTab = t;
    document.querySelectorAll('#tmTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    document.querySelectorAll('#sheetTeam .tm-pane').forEach(p => p.classList.toggle('hidden', p.dataset.p !== t));
    if (t === 'plan') renderTeamPlan();
}
function toggleAddStaff(show) {
    $('addStaffForm').classList.toggle('hidden', !show); $('stOpenBtn').classList.toggle('hidden', show);
    if (show) { ['stName', 'stPhone'].forEach(id => $(id).value = ''); $('stRole').value = 'cashier'; document.querySelector('input[name=stRoleR][value=cashier]').checked = true; setTimeout(() => $('stName').focus(), 150); }
}
// Seller permissions save the moment they're switched
function setPerm(el) {
    const k = el.dataset.k, v = el.type === 'checkbox' ? el.checked : Math.min(100, Math.max(0, num(el.value)));
    if (el.type !== 'checkbox') el.value = v;
    tRef().update({ ['settings.' + k]: v })
        .then(() => toast(el.type === 'checkbox' ? (v ? '✅ Sellers can now: ' : '⛔ Sellers can no longer: ') + el.closest('.tg-row').querySelector('b').textContent.toLowerCase() : `✅ Biggest discount: ${v}%`))
        .catch(e => { toast('⚠️ ' + friendlyErr(e), 'err'); if (el.type === 'checkbox') el.checked = !v; });
}
// ── WhatsApp formats: the plan decides what is allowed, the owner picks ──
// tenant.services.dailyReport: off | text | both   ·   receipts: manual | text | both  ('pdf' = both)
function shopServices() {
    const sv = { dailyReport: 'off', receipts: 'manual', receiptQuota: 0, ...((S.tenantInfo || {}).services || {}) };
    if (sv.dailyReport === 'pdf') sv.dailyReport = 'both'; if (sv.receipts === 'pdf') sv.receipts = 'both';
    return sv;
}
function renderWaFormats() {
    const box = $('waFmt'); if (!box) return;
    const sv = shopServices(), st = S.tenantInfo.settings || {};
    const rep = st.waReport || 'text', rec = st.waReceipts || (sv.receipts === 'manual' ? 'off' : 'text');
    const seg = (key, cur, opts) => `<div class="wa-seg">${opts.map(([v, label, ok]) =>
        `<button type="button" class="${v === cur && ok ? 'on' : ''}" ${ok ? `onclick="setWaFmt('${key}','${v}')"` : 'disabled title="Upgrade your plan"'}>${ok ? '' : '🔒 '}${label}</button>`).join('')}</div>`;
    const repOk = sv.dailyReport !== 'off', pdfRep = sv.dailyReport === 'both';
    const recOk = sv.receipts !== 'manual', pdfRec = sv.receipts === 'both';
    box.innerHTML = `
        <div class="field-group"><span class="field-label">Daily report on WhatsApp</span>
            ${repOk ? seg('waReport', rep, [['text', 'Text', true], ['pdf', 'PDF', pdfRep]]) : '<div class="hint gray">🔒 Not in your plan. Ask Keep to upgrade.</div>'}</div>
        <div class="field-group"><span class="field-label">Receipts to customers${recOk && sv.receiptQuota ? ` · ${sv.receiptQuota}/month` : ''}</span>
            ${recOk ? seg('waReceipts', rec, [['off', 'Off', true], ['text', 'Text', true], ['pdf', 'PDF', pdfRec]]) : '<div class="hint gray">Your plan uses the WhatsApp button on each sale. Automatic receipts need an upgrade.</div>'}</div>
        ${(repOk && !pdfRep) || (recOk && !pdfRec) ? '<div class="hint gray" style="margin-top:-4px;">🔒 PDF needs a higher plan.</div>' : ''}`;
}
function setWaFmt(key, v) {
    tRef().update({ ['settings.' + key]: v }).then(() => {
        S.tenantInfo.settings = { ...(S.tenantInfo.settings || {}), [key]: v }; renderWaFormats();
        toast(key === 'waReport' ? `✅ Daily report: ${v.toUpperCase()}` : v === 'off' ? '✅ Automatic receipts off' : `✅ Receipts: ${v.toUpperCase()}`);
    }).catch(e => toast('⚠️ ' + friendlyErr(e), 'err'));
}
function renderTeamPlan() {
    const t = S.tenantInfo, lim = t.limits || {}, st = subState(t);
    const bar = (used, max, label) => `<div class="tm-meter"><div style="display:flex;justify-content:space-between;font-size:.74rem;"><b>${label}</b><span>${used} of ${max || '∞'}</span></div>
        <div class="tm-track"><i style="width:${max ? Math.min(100, used / max * 100) : 8}%;background:${max && used >= max ? 'var(--red)' : 'var(--blue)'};"></i></div></div>`;
    $('tmPlan').innerHTML = `<div class="tm-box"><div class="tm-box-title">💳 ${esc(t.plan || 'Plan')} · ${fmt(t.monthlyFee || 0)}/month</div>
        <div style="font-size:.78rem;color:var(--gray);margin-bottom:10px;">${st.trial ? '🧪 Free trial · ' : ''}${tms(t.paidUntil) ? 'Paid until <b style="color:var(--ink);">' + tsDay(t.paidUntil) + '</b>' : ''}${st.daysLeft != null ? ` · ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left` : ''}</div>
        ${bar(usedStaff(), lim.maxStaff, '👥 Staff logins')}${bar(usedItems(), lim.maxProducts, '📦 Items')}</div>`;
}
function openTeam() {
    loadCashStats().then(() => { if ($('sheetTeam').classList.contains('active') && S.renderStaff) S.renderStaff(); });
    const st = S.tenantInfo.settings || {};
    $('setTarget').value = st.dailyTarget || ''; $('setWa').value = st.whatsapp ? prettyPhone(st.whatsapp) : '';
    $('setPhone').value = st.phone ? prettyPhone(st.phone) : ''; $('setAddr').value = st.address || ''; $('setFooter').value = st.footer || ''; $('setPaper').value = String(st.paperWidth || 80); renderLogoBox();
    renderWaFormats(); $('setMaxDisc').value = st.maxDiscount ?? 10; $('setCredit').checked = !!st.cashierCredit; $('setReturns').checked = !!st.cashierReturns; $('setManual').checked = !!st.cashierManual; $('setCloseDay').checked = !!st.cashierCloseDay; $('setExpenses').checked = !!st.cashierExpenses;
    toggleAddStaff(false);
    openSheet('sheetTeam'); teamTab(S.teamTab || 'team');
    $('staffList').innerHTML = '<div style="font-size:0.75rem;color:var(--gray);padding:8px 0;">Loading…</div>';
    S.sheetListeners.push(col('staff').onSnapshot(s => {
        S.staff = s.docs.map(d => ({ uid: d.id, ...d.data() })).filter(p => !p.replacedBy).sort((a, b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1) || (a.name || '').localeCompare(b.name || ''));
        S.renderStaff();
    }, e => { $('staffList').innerHTML = `<div class="hint amber">${esc(friendlyErr(e))}</div>`; }));
    S.renderStaff = () => {
        const card = p => {
            const me = p.uid === S.me.uid, off = p.active === false, byEmail = (p.loginId || '').includes('@');
            const login = byEmail ? '✉️ ' + esc(p.loginId) : '📱 ' + esc(prettyPhone(p.loginId || ''));
            return `<div class="tm-card ${off ? 'off' : ''}">
                <div class="tm-top"><div class="staff-av ${p.role === 'admin' ? 'adm' : ''}">${esc((p.name || '?').charAt(0).toUpperCase())}</div>
                    <div style="flex:1;min-width:0;"><div class="tm-name">${esc(p.name)}${me ? ' <small>(you)</small>' : ''}</div><div class="tm-sub">${login}</div>${cashStatText(p.uid)}</div>
                    <span class="role-pill ${off ? 'off' : p.role}">${off ? 'Off' : p.role === 'admin' ? 'Admin' : 'Seller'}</span></div>
                <div class="tm-acts">${me ? `<button onclick="openPin()">🔑 Change my PIN</button>` : off
                    ? `<button class="go" data-u="${p.uid}" onclick="toggleStaff(this.dataset.u)">✅ Switch on</button>`
                    : `<button data-u="${p.uid}" onclick="resetStaffPin(this.dataset.u)">🔑 ${byEmail ? 'Email reset' : 'Reset PIN'}</button>
                       <button data-u="${p.uid}" onclick="toggleRole(this.dataset.u)">${p.role === 'admin' ? '⬇️ Make seller' : '👑 Make admin'}</button>
                       <button class="stop" data-u="${p.uid}" onclick="toggleStaff(this.dataset.u)">⛔ Switch off</button>`}</div>
            </div>`;
        };
        const on = S.staff.filter(p => p.active !== false), off = S.staff.filter(p => p.active === false);
        $('staffList').innerHTML = on.map(card).join('') +
            (off.length ? `<details class="tm-off"><summary>Switched off (${off.length})</summary>${off.map(card).join('')}</details>` : '');
        const lim = (S.tenantInfo.limits || {}).maxStaff;
        $('planUsage').innerHTML = `<b>${usedStaff()}</b> of ${lim || '∞'} staff logins used${lim && usedStaff() >= lim ? ' · <span style="color:var(--red);">plan full</span>' : ''}`;
    };
}

// Ask for a value in a small dialog (mobile-safe replacement for prompt())
// Pick one of several options; resolves to the option key, or null on cancel
function choose(message, options) {
    return new Promise(resolve => {
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        o.innerHTML = `<div style="background:#fff;border-radius:20px;padding:22px;max-width:340px;width:100%;text-align:center;">
            <div style="font-size:0.88rem;font-weight:600;margin-bottom:16px;line-height:1.45;">${message}</div>
            ${options.map(([k, l, c]) => `<button data-k="${k}" style="width:100%;padding:13px;border-radius:12px;border:none;background:${c};color:#fff;font-weight:800;margin-bottom:8px;cursor:pointer;">${l}</button>`).join('')}
            <button data-k="" style="width:100%;padding:11px;border-radius:12px;border:2px solid #e3e8ef;background:#fff;font-weight:800;cursor:pointer;">Cancel</button></div>`;
        document.body.appendChild(o);
        o.addEventListener('click', e => { const k = e.target.dataset && e.target.dataset.k; if (k === undefined) return; o.remove(); resolve(k || null); });
    });
}
function askValue(message, placeholder, okLabel = 'Save', opt = {}) {
    return new Promise(resolve => {
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        o.innerHTML = `<div style="background:#fff;border-radius:20px;padding:22px;max-width:330px;width:100%;text-align:center;">
            <div style="font-size:0.88rem;font-weight:600;margin-bottom:12px;line-height:1.45;">${message}</div>
            <input type="${opt.type || 'tel'}" inputmode="${opt.type === 'text' ? 'text' : 'decimal'}" placeholder="${placeholder}" value="${esc(opt.value || '')}" style="margin-bottom:14px;text-align:center;letter-spacing:${opt.type === 'text' ? '1px' : '3px'};">
            <div style="display:flex;gap:10px;">
                <button data-a="no" style="flex:1;padding:12px;border-radius:12px;border:2px solid #e3e8ef;background:#fff;font-weight:800;">Cancel</button>
                <button data-a="yes" style="flex:1;padding:12px;border-radius:12px;border:none;background:var(--blue);color:#fff;font-weight:800;">${okLabel}</button>
            </div></div>`;
        document.body.appendChild(o);
        const inp = o.querySelector('input'); setTimeout(() => { inp.focus(); inp.select(); }, 50);
        const done = v => { o.remove(); resolve(v); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(inp.value.trim()); });
        o.addEventListener('click', e => {
            const a = e.target.dataset && e.target.dataset.a; if (!a) return;
            done(a === 'yes' ? inp.value.trim() : null);
        });
    });
}

// Creates a hidden Firebase login for a seller. A separate Firebase instance
// is used so the owner stays signed in on this device.
async function makeSellerLogin(pin) {
    const helper = firebase.apps.find(a => a.name === 'staffmaker') || firebase.initializeApp(firebaseConfig, 'staffmaker');
    await helper.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
    const email = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '@' + SHOP_DOMAIN;
    const cred = await helper.auth().createUserWithEmailAndPassword(email, pin);
    await helper.auth().signOut();
    return { uid: cred.user.uid, email };
}

// ── One-time setup codes: staff choose their own PIN ──
// The owner never sees or sets a seller's PIN. A new login is created with a random
// 8-character code as its temporary password; the seller opens keep.co.tz/?setup=CODE,
// signs in with the code once and replaces it with a PIN only they know. The code then dies.
const SETUP_HOURS = 48;
function newSetupCode() {
    const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(r, x => abc[x % abc.length]).join('');
}
const prettyCode = c => c.slice(0, 4) + '-' + c.slice(4);
const setupLink = c => new URL('../?setup=' + c, location.href).href;
function addInvite(b, code, uid, email, name, phone) {
    b.set(db.collection('invites').doc(code), {
        shop: S.tenant, shopName: S.tenantInfo.name || S.tenant, uid, email, name, phone,
        expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + SETUP_HOURS * 3600e3),
        createdAt: now(), createdBy: S.me.name
    });
}
async function sendSetupCode(name, phone, code, isNew) {
    const text = `Habari ${name.split(' ')[0]}! ${isNew ? `You have been added to *${S.tenantInfo.name || S.tenant}* on Keep.` : `Your Keep PIN for *${S.tenantInfo.name || S.tenant}* was reset.`}\n\nTap the link to choose your own PIN:\n${setupLink(code)}\n\nOr open keep.co.tz → "First time here?" and enter setup code *${prettyCode(code)}*.\nThe code works once and expires in ${SETUP_HOURS} hours. Do not share it.`;
    const ok = await showConfirm(`Setup code for <b>${esc(name)}</b><br><br><span style="font-size:1.6rem;font-weight:800;letter-spacing:3px;">${prettyCode(code)}</span><br><br><span style="font-size:0.78rem;color:#6b7280;">They use it once to choose their own PIN. It expires in ${SETUP_HOURS} hours.</span><br><br>Send it to ${esc(prettyPhone(phone))} on WhatsApp?`, '📲 WhatsApp', 'var(--pos)');
    if (ok) openWa(phone, text);
}

async function addStaff() {
    const name = $('stName').value.trim(), phone = normPhone($('stPhone').value), role = $('stRole').value;
    if (!name) return toast('⚠️ Enter their name.', 'err');
    if (!/^255[67]\d{8}$/.test(phone) && !/^\d{10,15}$/.test(phone)) return toast('⚠️ Enter a valid phone number, e.g. 0712 345 678.', 'err');
    if (!navigator.onLine) return toast('⚠️ Adding a seller needs internet.', 'err');
    const maxS = Number((S.tenantInfo.limits || {}).maxStaff) || 0;
    if (maxS && usedStaff() >= maxS) return toast(`⚠️ Your plan allows ${maxS} staff logins. Switch someone off or ask Keep to upgrade.`, 'err');
    const btn = $('stBtn'); btn.disabled = true; btn.textContent = 'ADDING...';
    try {
        const taken = await db.collection('logins').doc(phone).get({ source: 'server' });
        if (taken.exists) return toast('⚠️ That phone number already has an account.', 'err');
        const code = newSetupCode();
        const { uid, email } = await makeSellerLogin(code);
        const b = db.batch();
        b.set(col('staff').doc(uid), { name, loginId: phone, role, active: true, createdAt: now(), createdBy: S.me.name, inviteCode: code });
        addInvite(b, code, uid, email, name, phone);
        b.set(db.collection('users').doc(uid), { shop: S.tenant });
        b.set(db.collection('logins').doc(phone), { email, shop: S.tenant, uid });
        usageAdd(b, 'staff', uid);
        await b.commit();
        toggleAddStaff(false);
        await sendSetupCode(name, phone, code, true);
    } catch (e) {
        toast('⚠️ ' + friendlyErr(e), 'err');
    } finally { btn.disabled = false; btn.textContent = '➕ ADD SELLER'; }
}

async function resetStaffPin(uid) {
    const p = S.staff.find(x => x.uid === uid); if (!p) return;
    if (!navigator.onLine) return toast('⚠️ Resetting a PIN needs internet.', 'err');
    if ((p.loginId || '').includes('@')) {
        if (!await showConfirm(`Email <b>${esc(p.name)}</b> a link to set a new PIN?<br><span style="font-size:0.78rem;color:#6b7280;">${esc(maskEmail(p.loginId))}</span>`, 'Send email', 'var(--blue)')) return;
        return auth.sendPasswordResetEmail(p.loginId, { url: window.KEEP_ENV.site }).then(() => toast('📧 Reset email sent')).catch(e => toast('⚠️ ' + friendlyErr(e), 'err'));
    }
    if (!await showConfirm(`Reset <b>${esc(p.name)}</b>'s PIN?<br><span style="font-size:0.78rem;color:#6b7280;">Their old PIN stops working. You get a new setup code to send them, and they choose a new PIN themselves.</span>`, 'Reset PIN', 'var(--blue)')) return;
    const code = newSetupCode();
    loader(true, 'RESETTING PIN...');
    try {
        // A new login replaces the old one; the old one is switched off.
        const { uid: newUid, email } = await makeSellerLogin(code);
        const b = db.batch();
        b.set(col('staff').doc(newUid), { name: p.name, loginId: p.loginId, role: p.role, active: p.active !== false, createdAt: now(), createdBy: S.me.name, previousUid: uid, inviteCode: code });
        addInvite(b, code, newUid, email, p.name, p.loginId);
        b.update(col('staff').doc(uid), { active: false, replacedBy: newUid });
        b.set(db.collection('users').doc(newUid), { shop: S.tenant });
        b.delete(db.collection('users').doc(uid));
        b.set(db.collection('logins').doc(p.loginId), { email, shop: S.tenant, uid: newUid });
        usageDel(b, 'staff', uid); if (p.active !== false) usageAdd(b, 'staff', newUid);
        await b.commit();
        loader(false);
        await sendSetupCode(p.name, p.loginId, code, false);
    } catch (e) {
        toast('⚠️ ' + friendlyErr(e), 'err');
    } finally { loader(false); }
}

function toggleStaff(uid) {
    const p = S.staff.find(x => x.uid === uid); if (!p) return;
    const on = p.active === false;
    if (uid === S.me.uid) return toast('You cannot switch yourself off.', 'err');
    const maxS = Number((S.tenantInfo.limits || {}).maxStaff) || 0;
    if (on && maxS && usedStaff() >= maxS) return toast(`⚠️ Your plan allows ${maxS} staff logins. Switch someone else off first, or ask Keep to upgrade.`, 'err');
    const b = db.batch();
    b.update(col('staff').doc(uid), { active: on });
    if (on) usageAdd(b, 'staff', uid); else usageDel(b, 'staff', uid);
    b.commit().then(() => toast(p.active === false ? `✅ ${p.name} switched on` : `⛔ ${p.name} switched off`)).catch(e => toast('⚠️ ' + friendlyErr(e), 'err'));
}
function toggleRole(uid) {
    const p = S.staff.find(x => x.uid === uid); if (!p) return;
    const role = p.role === 'admin' ? 'cashier' : 'admin';
    col('staff').doc(uid).update({ role }).then(() => toast(`${p.name} is now ${role}`)).catch(e => toast('⚠️ ' + friendlyErr(e), 'err'));
}
// ── My account menu (tap your name in the header) ──
function closeMeMenu() { const m = document.getElementById('meMenu'); if (m) m.remove(); document.removeEventListener('click', meOutside, true); }
function meOutside(e) { const m = document.getElementById('meMenu'); if (m && !m.contains(e.target)) closeMeMenu(); }
async function switchBranch() {
    const list = Object.entries(S.branches || {}).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    if (list.length < 2) return;
    const pick = await choose(tl('Which branch?'), list.map(([id, name]) => [id, (id === S.tenant ? '✓ ' : '🏪 ') + esc(name), id === S.tenant ? '#0b0d12' : '#1a56db']));
    if (!pick || pick === S.tenant) return;
    if (await unsyncedCount() && !await showConfirm(tl('Some sales or changes have not reached the internet yet.') + '<br><br>' + tl('Switch branch anyway? They will still be sent.'))) return;
    if (Object.keys(S.cart || {}).length && !await showConfirm(tl('There are items in the cart. Switch branch anyway?'))) return;
    try { localStorage.setItem('keep.branch.' + S.me.uid, pick); } catch (e) {}
    try {
        const t = (await db.collection('tenants').doc(pick).get()).data() || {};
        if (t.type === 'barbershop') { location.href = '../barber/'; return; }
    } catch (e) {}
    location.reload();
}
async function switchLang() {
    if (Object.keys(S.cart || {}).length && !await showConfirm(tl('There are items in the cart. Switch language anyway?'))) return;
    KeepLang.set(KeepLang.lang === 'sw' ? 'en' : 'sw');
}
function openMeMenu(ev) {
    ev.stopPropagation();
    if (document.getElementById('meMenu')) return closeMeMenu();
    const r = ev.currentTarget.getBoundingClientRect(), me = S.me || {};
    const role = me.role === 'admin' ? (me.uid === (S.tenantInfo || {}).ownerUid ? 'Owner' : 'Admin') : 'Seller';
    const ic = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    const m = document.createElement('div');
    m.id = 'meMenu'; m.className = 'me-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `
        <div class="mm-head"><span class="me-av">${esc((me.name || '?').trim().charAt(0).toUpperCase())}</span>
            <div><div class="mm-name">${esc(me.name || '')}</div><div class="mm-sub">${role} · ${esc((S.tenantInfo || {}).name || S.tenant || '')}</div></div></div>
        <button onclick="closeMeMenu();openPin()">${ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')}Change my PIN</button>
        ${isAdmin() ? `<button onclick="closeMeMenu();openTeam()">${ic('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.9 4.6 1.7 1.7 0 0 0 9.93 3.04V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.07z"/>')}Settings</button>` : ''}
        <a href="help.html" onclick="closeMeMenu()">${ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>')}Help, guide &amp; FAQ</a>
        ${S.branches && Object.keys(S.branches).length > 1 ? `<button onclick="closeMeMenu();switchBranch()">${ic('<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-7h6v7"/>')}Switch branch</button>` : ''}
        <button class="notr" onclick="closeMeMenu();switchLang()">${ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>')}${KeepLang.lang === 'sw' ? 'English' : 'Kiswahili'}</button>
        <button onclick="closeMeMenu();forceUpdate()">${ic('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>')}Refresh app</button>
        <button class="mm-out" onclick="closeMeMenu();logout()">${ic('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>')}Sign out</button>`;
    document.body.appendChild(m);
    const w = m.offsetWidth;
    m.style.top = Math.round(r.bottom + 8) + 'px';
    m.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w))) + 'px';
    setTimeout(() => document.addEventListener('click', meOutside, true), 0);
}
window.addEventListener('resize', closeMeMenu);
window.addEventListener('scroll', closeMeMenu, true);

// Full copy of the shop's records as one file (JSON), for the owner to keep safe.
async function downloadBackup() {
    if (!isAdmin()) return toast('⚠️ Only the owner can download a backup.', 'err');
    if (!navigator.onLine) return toast('⚠️ Connect to the internet to make a backup.', 'err');
    const cols = ['products', 'costs', 'sales', 'customers', 'serials', 'movements', 'entries', 'days', 'meta', 'receipts', 'cashups', 'months', 'staff'];
    const plain = v => {
        if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
        if (Array.isArray(v)) return v.map(plain);
        if (v && typeof v === 'object') { const o = {}; Object.entries(v).forEach(([k, x]) => o[k] = plain(x)); return o; }
        return v;
    };
    const out = { app: 'Keep', shop: S.tenant, shopName: S.tenantInfo.name || '', madeAt: new Date().toISOString(), madeBy: S.me.name, data: {} };
    loader(true, 'MAKING BACKUP...');
    try {
        for (const c of cols) {
            $('loadingText').textContent = 'BACKING UP ' + c.toUpperCase() + '...';
            const snap = await col(c).get({ source: 'server' });
            out.data[c] = {}; snap.docs.forEach(d => out.data[c][d.id] = plain(d.data()));
        }
    } catch (e) { loader(false); return toast('⚠️ Backup failed: ' + friendlyErr(e), 'err'); }
    loader(false);
    const counts = Object.entries(out.data).map(([k, v]) => `${k}: ${Object.keys(v).length}`).join(', ');
    out.counts = counts;
    const name = `Keep_backup_${S.tenant}_${dayStr()}.json`;
    await shareOrSave(new Blob([JSON.stringify(out)], { type: 'application/json' }), name, 'application/json', `Keep backup — ${S.tenantInfo.name || S.tenant}`);
    sSet('keep.lastBackup.' + S.tenant, String(Date.now()));
}

function saveSettings() {
    const wa = $('setWa').value.trim();
    if (wa && !/^\d{10,15}$/.test(normPhone(wa))) return toast('⚠️ WhatsApp number looks wrong — e.g. 0712 345 678.', 'err');
    const upd = { 'settings.dailyTarget': num($('setTarget').value), 'settings.whatsapp': normPhone(wa),
        'settings.phone': normPhone($('setPhone').value), 'settings.address': $('setAddr').value.trim(), 'settings.footer': $('setFooter').value.trim(), 'settings.paperWidth': Number($('setPaper').value) || 80 };
    tRef().update(upd).then(() => toast('✅ Shop details saved')).catch(e => toast('⚠️ ' + friendlyErr(e), 'err'));
}

// ════════════════════════════════════════════════
