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
    if (on && $('page-inventory').classList.contains('active')) switchTab('pos');
    if (!on && ($('page-services').classList.contains('active') || $('page-barbers').classList.contains('active'))) switchTab('pos');
}

// ── Today: clients served today, under the services list ──
function renderBarberToday() {
    const box = $('barberToday'); if (!box) return;
    if (!isBarberMode()) { box.innerHTML = ''; return; }
    let list = (S.todaySales || []).filter(s => s.kind === 'pos' && !s.voided);
    if (!isAdmin()) list = list.filter(s => s.staffUid === S.me.uid || (s.items || []).some(i => i.by === S.me.uid));
    list.sort((a, b) => (tms(b.createdAt) || 0) - (tms(a.createdAt) || 0));
    const time = s => { const t = tms(s.createdAt); return t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''; };
    box.innerHTML = `<div class="sr-head">${tl('Clients today')} · ${list.length}</div>` + (list.length ? list.slice(0, 40).map(s => {
        const what = (s.items || []).map(i => esc(i.name) + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ');
        const who = [...new Set((s.items || []).filter(i => i.by).map(i => i.byName || staffName(i.by)))].map(esc).join(', ');
        return `<div class="bt-row"><span class="bt-time">${time(s)}</span>
            <span class="bt-what"><b class="notr">${what}</b>${who ? `<small>✂️ <span class="notr">${who}</span></small>` : ''}</span>
            <span class="bt-amt">${n0(s.total)}<small>${s.mobile > 0 && !s.cash ? '📱' : s.cash > 0 && !s.mobile ? '💵' : '💵📱'}</small></span></div>`;
    }).join('') : `<div class="hint gray" style="margin-top:6px;">${tl('Tap a service above when a client is done.')}</div>`);
}

// ── Services tab (owner) ──
function renderServicesPage() {
    if (!$('svcList')) return;
    const svcs = S.products.filter(isService), goods = S.products.filter(p => !isService(p));
    $('svcList').innerHTML = svcs.length ? svcs.map(p => `
        <button class="svc-row" onclick="openItem('${p.id}')">
            <span class="sr-emoji">${esc(p.emoji || '✂️')}</span>
            <span class="sr-name"><span class="notr">${esc(p.name)}</span>${p.staffPay ? `<small>${tl('Barber gets')} ${n0(p.staffPay)}</small>` : ''}</span>
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
    const staff = await loadStaffOnce(true);
    const today = (S.todaySales || []).filter(s => s.kind === 'pos' && !s.voided);
    const rows = staff.filter(x => x.active !== false).map(x => {
        let clients = 0, money = 0;
        today.forEach(s => {
            const mine = (s.items || []).filter(i => i.service && i.by === x.uid);
            if (mine.length) clients++;
            mine.forEach(i => money += Number(i.subtotal) || 0);
        });
        return `<div class="barber-card">
            <div class="bc-top"><span class="bc-av">${esc((x.name || '?').trim()[0] || '?').toUpperCase()}</span>
                <div style="flex:1;"><b class="notr">${esc(x.name)}</b><small>${esc(payLabel(x))}</small></div>
                <button class="tiny-btn" onclick="setStaffPay('${x.uid}').then(renderBarbersPage)">✏️ ${tl('Pay rule')}</button></div>
            <div class="bc-stats"><div><b>${clients}</b><small>${tl('Clients today')}</small></div><div><b>${n0(money)}</b><small>${tl('Money today')}</small></div></div>
        </div>`;
    });
    box.innerHTML = rows.join('') || `<div class="empty-state"><div class="icon">💈</div>${tl('No barbers yet.')}</div>`;
}
function addBarber() { openTeam(); setTimeout(() => toggleAddStaff(true), 50); }
