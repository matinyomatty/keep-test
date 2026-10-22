// Keep till — Owner dashboard and the point of sale.
// Part of app/index.html; the parts load in order and share one global scope.
//  DASHBOARD
// ════════════════════════════════════════════════
function renderDashboard() {
    if (!isAdmin() || !$('page-dashboard').classList.contains('active')) return;
    const today = dayStr();
    const t = dayFig(today), y = dayFig(shiftDay(today, -1));
    $('daySales').textContent = fmt(t.sales);
    $('heroSalesTrend').innerHTML = trendBadge(t.sales, y.sales, 'vs yesterday');
    const target = Number((S.tenantInfo.settings || {}).dailyTarget) || 0;
    $('targetWrap').innerHTML = target ? `<div class="target-bar"><div style="width:${Math.min(100, Math.round(t.sales / target * 100))}%"></div></div>
        <div style="font-size:0.55rem;color:rgba(255,255,255,0.5);margin-top:3px;">${Math.round(t.sales / target * 100)}% of ${n0(target)} target</div>` : '';
    $('todayTx').textContent = isBarberMode() ? `${t.tx} ${tl(t.tx === 1 ? 'client' : 'clients')} ${tl('today')}` : `${t.tx} POS sale${t.tx === 1 ? '' : 's'} today`;
    const b = S.balances;
    $('balCash').textContent = fmt(b.cash); $('balMobile').textContent = fmt(b.mobile);
    $('balBank').textContent = fmt(b.bank); $('balSavings').textContent = fmt(b.savings);

    renderMonthBanner();
    renderHistory();
}

// How the month's profit was worked out: one line under "Profit so far" (no second set of boxes)
function monthBreakdown(f) {
    if (!f.hasData) return '';
    const v = x => f.pending ? '…' : n0(x), barber = isBarberMode();
    const cols = barber
        ? [[tl('Money in'), v(f.sales), ''], [tl('Barbers earned'), v(f.barbers || 0), '−'], [tl('Expenses'), v((f.otherExpense || 0) + (f.supplies || 0)), '−']]
        : [['Sales', v(f.sales), ''], [tl('Cost of goods'), v(f.cogs || 0), '−'], ['Expenses', v(f.otherExpense != null ? f.otherExpense : f.expense), '−']];
    const notes = [];
    if (!f.pending && f.missing && f.missing.length) notes.push(`<div class="mb-warn" onclick="switchTab('inventory')">⚠️ ${esc(missingCostNote(f.missing))} ›</div>`);
    if (!barber && f.supplier) notes.push(`<div class="mb-note">📥 ${tl('Stock bought')} ${n0(f.supplier)} — ${tl('counted when the goods are sold')}</div>`);
    return `<div class="mb-break">${cols.map(([l, x, sg]) => `<div><small>${l}</small><b>${sg && x !== '…' && x !== '0' ? sg : ''}${x}</b></div>`).join('')}</div>${notes.join('')}`;
}
function renderMonthBanner() {
    const now = new Date(), m = dayStr().slice(0, 7);
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const f = monthFig(m), pm = prevMonth(m), pf = monthFig(pm);
    let prev = '';
    if (pf.hasData) {
        const closed = S.months[pm] && S.months[pm].closed;
        prev = closed
            ? `<div onclick="openMonth('${pm}')" style="cursor:pointer;margin-top:8px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.35);border-radius:12px;padding:9px 12px;font-size:0.74rem;color:#bbf7d0;">
                ✅ <strong>${monthName(pm)} closed</strong> · Profit ${pf.pending ? '…' : n0(pf.profit)} · Saved ${n0(S.months[pm].saved)} TZS</div>`
            : `<div onclick="openMonth('${pm}')" style="cursor:pointer;margin-top:8px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.5);border-radius:12px;padding:9px 12px;font-size:0.74rem;color:#fde68a;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span>⚠️ <strong>${monthName(pm)} not closed</strong> · Profit ${pf.pending ? '…' : n0(pf.profit) + ' TZS'}</span>
                <span style="background:var(--amber);color:var(--ink);font-weight:800;border-radius:8px;padding:4px 9px;white-space:nowrap;">CLOSE ›</span></div>`;
    }
    $('monthBanner').innerHTML = `
        <div style="background:rgba(255,199,44,0.08);border:1px solid rgba(255,199,44,0.35);border-radius:14px;padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-family:'DM Sans',system-ui,sans-serif;font-weight:800;font-size:0.95rem;color:var(--yellow);letter-spacing:1px;text-transform:uppercase;">${monthName(m)}</div>
                    <div style="font-size:0.6rem;color:rgba(255,255,255,0.5);margin-top:1px;">Day ${now.getDate()} of ${dim}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.5rem;color:var(--yellow);text-transform:uppercase;letter-spacing:.8px;">Profit so far</div>
                    <div style="font-size:1.05rem;font-weight:800;color:${f.profit >= 0 ? '#4ade80' : '#f87171'};">${f.pending ? '…' : n0(f.profit)} <span style="font-size:0.6rem;">TZS</span></div>
                </div>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:3px;margin-top:8px;overflow:hidden;">
                <div style="height:100%;width:${Math.round(now.getDate() / dim * 100)}%;background:var(--yellow);"></div>
            </div>${monthBreakdown(f)}${prev}
        </div>`;
}

function toggleHistory() { S.historyAll = !S.historyAll; S.historyLimit = 7; renderHistory(); }
function renderHistory() {
    const today = dayStr(), m = today.slice(0, 7);
    const keys = Object.keys(S.days).filter(d => S.historyAll || d.slice(0, 7) === m).sort().reverse();
    $('historyLabel').textContent = S.historyAll ? 'Days · last 12 months' : 'Days · ' + monthName(m);
    $('historyToggle').textContent = S.historyAll ? 'This month only' : 'Show all months';
    const list = $('historyList');
    if (!keys.length) {
        list.innerHTML = `<div class="empty-state"><div class="icon">🗓️</div>Nothing recorded in ${monthName(m)} yet.<br><span style="font-size:0.75rem;">${isBarberMode() ? tl('Clients you record appear here automatically.') : 'Sales from the POS appear here automatically.'}</span></div>`;
        $('historyMore').classList.add('hidden');
        return;
    }
    list.innerHTML = keys.slice(0, S.historyLimit).map(d => {
        const x = dayFig(d), p = dayFig(shiftDay(d, -1));
        const spent = x.supplier + x.expense, banked = x.bankIn - x.bankOut;
        return `<div class="entry-item ${d === today ? 'is-today' : ''}" onclick="openDay('${d}')">
            <div style="min-width:0;flex:1;">
                <div class="entry-date">${shortDay(d)}${d === today ? '<span class="tag tag-today">TODAY</span>' : ''}${x.closing ? '<span class="tag tag-closed">🔒 CLOSED</span>' : ''}${afterClose(x) ? '<span class="tag tag-open">+' + n0(afterClose(x)) + ' AFTER CLOSE</span>' : ''}</div>
                <div class="entry-meta">${isBarberMode() ? '💈' : '🛒'} ${n0(x.sales)} TZS${x.tx ? ` · ${x.tx} ${isBarberMode() ? tl(x.tx === 1 ? 'client' : 'clients') : 'sale' + (x.tx === 1 ? '' : 's')}` : ''}${spent ? ` · 💸 ${n0(spent)}` : ''}${banked ? ` · 🏦 ${n0(banked)}` : ''}</div>
                ${p.sales ? `<div style="margin-top:4px;">${trendBadge(x.sales, p.sales, 'vs day before')}</div>` : ''}
            </div>
            <div class="btn-circle">›</div>
        </div>`;
    }).join('');
    $('historyMore').classList.toggle('hidden', keys.length <= S.historyLimit);
}

// ════════════════════════════════════════════════
//  POINT OF SALE
// ════════════════════════════════════════════════
function renderPosStrip() {
    const live = S.todaySales.filter(s => !s.voided && s.kind !== 'repay');
    const pos = live.filter(s => s.kind !== 'manual' && s.kind !== 'return');
    const mine = pos.filter(s => S.me && s.staffUid === S.me.uid);
    const total = live.reduce((a, s) => a + (s.kind === 'return' ? -1 : 1) * (s.total || 0), 0);
    const mineTotal = live.filter(s => S.me && s.staffUid === S.me.uid).reduce((a, s) => a + (s.kind === 'return' ? -1 : 1) * (s.total || 0), 0);
    const n = isBarberMode() ? pos.filter(x => !isCancelled(x)).length : (isAdmin() ? pos.length : mine.length);
    const word = isBarberMode() ? (n === 1 ? 'client' : 'clients') : (n === 1 ? 'sale' : 'sales');
    const amt = isAdmin() ? total : mineTotal;
    $('posStrip').innerHTML = `<span class="ss-l">${tl(isAdmin() ? 'Today' : 'You today')} · <b>${n}</b> ${tl(word)}</span><span class="ss-r">${fmt(amt)}</span>`;
}

function renderPOS() {
    if (!S.me) return;
    const q = ($('posSearch').value || '').toLowerCase().trim();
    const cats = ['All', ...new Set(S.products.map(p => p.category || 'General'))];
    if (!cats.includes(S.activeCat)) S.activeCat = 'All';
    $('catFilter').innerHTML = cats.map(c => `<button class="cat-chip ${c === S.activeCat ? 'active' : ''}" data-cat="${esc(c)}" onclick="setCat(this.dataset.cat)">${esc(c)}</button>`).join('');
    const words = q ? q.split(/\s+/) : [];
    const list = S.products.filter(p => {
        if (S.activeCat !== 'All' && (p.category || 'General') !== S.activeCat) return false;
        const hay = [p.name, p.category, p.sellPrice, p.barcode].join(' ').toLowerCase();
        return words.every(w => hay.includes(w));
    });
    const empty = $('posEmpty');
    if (!list.length) {
        $('posGrid').innerHTML = '';
        empty.classList.remove('hidden');
        empty.innerHTML = isBarberMode() ? (S.products.length ? `<div class="icon">🔍</div>${tl('Nothing matches.')}` : `<div class="icon">✂️</div>${tl('No services yet.')}<br><span style="font-size:0.78rem;">${tl(isAdmin() ? 'Add your services and prices first.' : 'Ask the owner to add the services.')}</span>${isAdmin() ? `<br><button class="btn-sec" style="margin-top:12px;" onclick="switchTab('services')">✂️ ${tl('Add services')}</button>` : ''}`)
            : S.products.length
            ? '<div class="icon">🔍</div>No items match your search.'
            : `<div class="icon">📦</div>No items yet.<br><span style="font-size:0.78rem;">${isAdmin() ? 'Go to <b>Stock → + ADD ITEM</b> to add your products.' : 'Ask the shop owner to add products.'}</span>`;
    } else {
        empty.classList.add('hidden');
        $('posGrid').classList.toggle('svc-list', isBarberMode());
        if (isBarberMode()) { $('posGrid').innerHTML = renderBarberList(list); updateCartBar(); renderBarberToday(); renderSvcBar(); return; }
        $('posGrid').innerHTML = list.map(p => {
            const qty = S.cart[p.id] || 0, stock = Number(p.stock) || 0, svc = isService(p);
            const out = !svc && stock <= 0, low = !svc && !out && stock <= (Number(p.reorderLevel) || 5);
            return `<button class="item-card ${qty ? 'in-cart' : ''} ${out ? 'out' : ''}" ${out ? 'disabled' : ''} onclick="addToCart('${p.id}')">
                ${low ? '<span class="ic-low">LOW</span>' : ''}
                <span class="ic-badge">${q3(qty)}</span>
                <span class="ic-emoji">${esc(p.emoji || '📦')}</span>
                <div class="ic-name">${esc(p.name)}</div>
                <div class="ic-price">${n0(p.sellPrice)} TZS${perUnit(p)}</div>
                <div class="ic-stock">${svc ? '✂️ ' + tl('Service') : out ? '❌ Out of stock' : stockTxt(p)}${p.trackSerial ? ' · 🔢' : ''}${p.warrantyMonths ? ' · 🛡️' : ''}</div>
            </button>`;
        }).join('');
    }
    updateCartBar();
}
function setCat(c) { S.activeCat = c; renderPOS(); }

// ── Units ─────────────────────────────────────────────
const UNITS = [['pc', 'Piece', 'pc'], ['m', 'Metre', 'm'], ['ft', 'Foot', 'ft'], ['kg', 'Kilogram', 'kg'], ['l', 'Litre', 'L'],
    ['box', 'Box', 'box'], ['pack', 'Pack', 'pack'], ['carton', 'Carton', 'ctn'], ['set', 'Set', 'set'], ['pair', 'Pair', 'pair'],
    ['roll', 'Roll', 'roll'], ['bag', 'Bag', 'bag'], ['sheet', 'Sheet', 'sheet'], ['length', 'Length', 'length']];
const PART_UNITS = ['m', 'ft', 'kg', 'l'];
const unitOf = p => (p && p.unit) || 'pc';
const unitShort = p => (UNITS.find(u => u[0] === unitOf(p)) || UNITS[0])[2];
const unitName = p => (UNITS.find(u => u[0] === unitOf(p)) || UNITS[0])[1].toLowerCase();
const partOk = p => !!(p && (p.partQty === true || (p.partQty === undefined && PART_UNITS.includes(unitOf(p)))));
const q3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const qtyTxt = (q, p) => `${q3(q).toLocaleString('en-US', { maximumFractionDigits: 3 })}${unitOf(p) === 'pc' ? '' : ' ' + unitShort(p)}`;
const stockTxt = p => `${qtyTxt(p.stock || 0, p)}${unitOf(p) === 'pc' ? '' : ''} left`;
const perUnit = p => unitOf(p) === 'pc' ? '' : '/' + unitShort(p);

// ── Cart state ────────────────────────────────────────
// S.cart[id] = quantity · S.lineMeta[id] = { price, serials[] }
S.lineMeta = {}; S.saleDisc = null; S.saleCustomer = null;
const meta = id => (S.lineMeta[id] = S.lineMeta[id] || { serials: [] });
const linePrice = id => { const m = S.lineMeta[id], p = productById(id); return m && m.price != null ? m.price : Number((p || {}).sellPrice) || 0; };
const lineSub = id => Math.round(linePrice(id) * (S.cart[id] || 0));
const cartList = () => Object.entries(S.cart).reduce((s, [id, q]) => s + (Number((productById(id) || {}).sellPrice) || 0) * q, 0);
const cartGross = () => Object.keys(S.cart).reduce((s, id) => s + lineSub(id), 0);
function cartDiscount() {
    const d = S.saleDisc, g = cartGross();
    if (!d) return 0;
    return Math.min(g, Math.round(d.type === 'pct' ? g * d.value / 100 : d.value));
}
const cartTotal = () => Math.max(0, cartGross() - cartDiscount());
const cartCount = () => Object.keys(S.cart).length;
const maxDiscPct = () => { const v = (S.tenantInfo.settings || {}).maxDiscount; return v === undefined || v === null || v === '' ? 10 : Number(v) || 0; };
const creditAllowed = () => isAdmin() || !!(S.tenantInfo.settings || {}).cashierCredit;

function addToCart(id) {
    const p = productById(id); if (!p) return;
    const q = S.cart[id] || 0, stock = Number(p.stock) || 0;
    if (isService(p)) {
        S.cart[id] = q + 1;
        if (!meta(id).by && defaultDoer()) meta(id).by = defaultDoer();
    } else {
        const step = partOk(p) ? Math.min(1, q3(stock - q)) : 1;
        if (step <= 0 || q + step > stock + 1e-9) { toast(`⚠️ Only ${qtyTxt(stock, p)} ${p.name} in stock`, 'err'); return; }
        S.cart[id] = q3(q + step);
    }
    navigator.vibrate?.(25);
    renderPOS();
    if ($('sheetCart').classList.contains('active')) renderCart();
}
function removeFromCart(id) {
    if (!S.cart[id]) return;
    const p = productById(id), q = S.cart[id];
    const next = partOk(p) && q % 1 ? Math.floor(q) : q - 1;
    if (next <= 0) { delete S.cart[id]; delete S.lineMeta[id]; } else S.cart[id] = q3(next);
    renderPOS(); renderCart();
}
function setQty(id, v) {
    const p = productById(id); if (!p) return;
    let q = num(v);
    if (!partOk(p)) q = Math.round(q);
    q = q3(q);
    if (q <= 0) { delete S.cart[id]; delete S.lineMeta[id]; }
    else if (!isService(p) && q > (Number(p.stock) || 0) + 1e-9) { toast(`⚠️ Only ${qtyTxt(p.stock, p)} in stock`, 'err'); }
    else S.cart[id] = q;
    setTimeout(() => { renderPOS(); renderCart(); }, 0);
}
async function editLinePrice(id) {
    const p = productById(id); if (!p) return;
    const lim = isAdmin() ? '' : `<br><span style="font-size:.72rem;color:#6b7280;">You can go down to ${n0(p.sellPrice * (1 - maxDiscPct() / 100))} (${maxDiscPct()}% off).</span>`;
    const v = await askValue(`Price for <b>${esc(p.name)}</b>${perUnit(p)}<br><span style="font-size:.75rem;color:#6b7280;">Normal price ${n0(p.sellPrice)}</span>${lim}`, 'New price', 'Set price', { value: String(linePrice(id)) });
    if (v === null || v === '') return;
    const n = num(v);
    if (!(n >= 0)) return toast('⚠️ Enter a price.', 'err');
    if (!isAdmin() && n < p.sellPrice * (1 - maxDiscPct() / 100) - 0.5) return toast(`⚠️ The lowest you can sell at is ${n0(p.sellPrice * (1 - maxDiscPct() / 100))}. Ask the owner.`, 'err');
    meta(id).price = Math.abs(n - p.sellPrice) < 0.5 ? null : n;
    S.payTouched = false; renderPOS(); renderCart();
}
async function askDiscount() {
    if (!Object.keys(S.cart).length) return toast('Add items first.');
    const v = await askValue(`Discount on the whole sale<br><span style="font-size:.75rem;color:#6b7280;">Type an amount (e.g. 5000) or a percent (e.g. 10%). Empty = no discount.${isAdmin() ? '' : `<br>Your limit: ${maxDiscPct()}%`}</span>`, 'e.g. 5000 or 10%', 'Apply', { type: 'text', value: S.saleDisc ? (S.saleDisc.type === 'pct' ? S.saleDisc.value + '%' : String(S.saleDisc.value)) : '' });
    if (v === null) return;
    const t = v.replace(/\s/g, '');
    if (!t) S.saleDisc = null;
    else if (t.endsWith('%')) S.saleDisc = { type: 'pct', value: Math.min(100, num(t)) };
    else S.saleDisc = { type: 'amt', value: num(t) };
    if (S.saleDisc && !(S.saleDisc.value > 0)) S.saleDisc = null;
    S.payTouched = false; renderCart();
    if (!isAdmin() && discPctNow() > maxDiscPct() + 0.01) toast(`⚠️ That is ${discPctNow().toFixed(1)}% off — above your ${maxDiscPct()}% limit. The owner can give bigger discounts.`, 'err');
}
const discPctNow = () => { const l = cartList(); return l ? (l - cartTotal()) / l * 100 : 0; };
function clearCart() { S.cart = {}; S.lineMeta = {}; S.saleDisc = null; S.saleCustomer = null; S.payTouched = false; S.elecAsked = false; renderPOS(); renderCart(); }

function updateCartBar() {
    const n = Object.keys(S.cart).length;
    $('cartCount').textContent = n;
    $('cartBarTotal').textContent = fmt(cartTotal());
    const ids = Object.keys(S.cart);
    const names = ids.slice(0, 2).map(id => (productById(id) || {}).name || '').map(x => x.split(' ')[0]);
    $('cartSummary').textContent = n ? names.join(', ') + (ids.length > 2 ? ` +${ids.length - 2} more` : '') : 'No items';
    $('cartBar').classList.toggle('show', n > 0 && !isBarberMode());
    if ($('sheetCart').classList.contains('docked')) renderCart();
}

function openCart() { S.payTouched = false; renderCart(); openSheet('sheetCart'); }
function renderCart() {
    if (S._renderingCart) return;
    S._renderingCart = true;
    try { renderCartInner(); } finally { S._renderingCart = false; }
}
function renderCartInner() {
    const lines = Object.entries(S.cart);
    $('cartLines').innerHTML = lines.length ? lines.map(([id, q]) => {
        const p = productById(id); if (!p) return '';
        const price = linePrice(id), changed = Math.abs(price - p.sellPrice) >= 0.5;
        const onShelf = p.trackSerial ? inStockSerials(id) : [];
        const serials = p.trackSerial && q === Math.round(q) ? `<datalist id="sl-${id}">${onShelf.map(x => `<option value="${esc(x.serial)}">`).join('')}</datalist>`
            + Array.from({ length: Math.min(q, 20) }, (_, n) =>
            `<input class="serial-in" list="sl-${id}" data-id="${id}" data-n="${n}" oninput="meta('${id}').serials[${n}]=this.value.trim()" placeholder="Serial / IMEI #${n + 1}${onShelf.length ? ' — tap to pick' : ''}" value="${esc((meta(id).serials || [])[n] || '')}">`).join('')
            + `<button class="cl-edit" style="padding:4px 0;" onclick="scanCartSerial('${id}')">📷 scan serial</button>${onShelf.length ? ` <span class="cl-price">${onShelf.length} on the shelf</span>` : ''}` : '';
        return `<div class="cart-line" style="align-items:flex-start;">
            <span class="cl-emoji">${esc(p.emoji || '📦')}</span>
            <div style="flex:1;min-width:0;"><div class="cl-name">${esc(p.name)}</div>
                <div class="cl-price">${changed ? `<s>${n0(p.sellPrice)}</s> ` : ''}<b style="color:${changed ? 'var(--amber)' : 'inherit'};">${n0(price)}</b>${perUnit(p)} × ${qtyTxt(q, p)} = <b>${n0(lineSub(id))}</b>
                    <button class="cl-edit" onclick="editLinePrice('${id}')">✏️ price</button></div>
                ${p.warrantyMonths ? `<div class="cl-price">🛡️ ${p.warrantyMonths}-month warranty</div>` : ''}
                ${isElectronic(p) && !p.trackSerial ? `<button class="cl-edit" style="padding:2px 0;" onclick="editRef('${id}')">🔢 ${meta(id).ref ? esc(meta(id).ref) : tl('Add serial / IMEI')}</button>` : ''}
                ${isService(p) ? `<button class="cl-edit" style="padding:4px 0;color:${meta(id).by ? 'inherit' : 'var(--red)'};font-weight:800;" onclick="pickDoer('${id}')">✂️ ${meta(id).by ? esc(tl('Done by') + ' ' + (staffName(meta(id).by) || '…')) : esc(tl('Choose who did it'))}</button>` : ''}
                ${serials}
            </div>
            <div class="qty-ctrl">
                <button class="qty-btn qty-minus" onclick="removeFromCart('${id}')">−</button>
                <input class="qty-in" type="number" inputmode="decimal" step="${partOk(p) ? '0.1' : '1'}" value="${q3(q)}" onchange="setQty('${id}', this.value)">
                <button class="qty-btn qty-plus" onclick="addToCart('${id}')">+</button>
            </div></div>`;
    }).join('') : '<div class="empty-state"><div class="icon">🛒</div>Cart is empty.' + (S.dockCart ? '<br><span style="font-size:.72rem;">Tap items or scan a barcode.</span>' : '') + '</div>';
    const list = cartList(), gross = cartGross(), disc = cartDiscount(), total = cartTotal();
    const saved = list - total;
    $('cartSums').innerHTML = saved >= 1 ? `
        <div class="sum-line"><span>Normal price</span><span>${fmt(list)}</span></div>
        ${list - gross >= 1 ? `<div class="sum-line"><span>Price changes</span><span>−${n0(list - gross)}</span></div>` : ''}
        ${disc ? `<div class="sum-line"><span>Discount${S.saleDisc.type === 'pct' ? ' ' + S.saleDisc.value + '%' : ''}</span><span>−${n0(disc)}</span></div>` : ''}
        <div class="sum-line" style="color:${!isAdmin() && discPctNow() > maxDiscPct() + 0.01 ? 'var(--red)' : 'var(--amber)'};font-weight:800;"><span>Customer saves</span><span>${n0(saved)} (${discPctNow().toFixed(1)}%)</span></div>` : '';
    $('cartModalTotal').textContent = fmt(total);
    const nItems = lines.length; if ($('cartCountHead')) $('cartCountHead').textContent = nItems ? `· ${nItems} ${nItems === 1 ? 'item' : 'items'}` : '';
    // customer + discount buttons
    const c = S.saleCustomer;
    $('custBtn').innerHTML = c ? `👤 ${esc(c.name)}${c.balance ? ` · owes ${n0(c.balance)}` : ''} <span onclick="event.stopPropagation();S.saleCustomer=null;S.payTouched=false;renderCart();" style="margin-left:4px;color:var(--red);">✕</span>` : '👤 Add customer';
    $('custBtn').classList.toggle('set', !!c);
    $('discBtn').innerHTML = S.saleDisc ? `🏷️ −${S.saleDisc.type === 'pct' ? S.saleDisc.value + '%' : n0(S.saleDisc.value)} <span onclick="event.stopPropagation();S.saleDisc=null;S.payTouched=false;renderCart();" style="margin-left:4px;color:var(--red);">✕</span>` : '🏷️ Discount';
    $('discBtn').classList.toggle('set', !!S.saleDisc);
    const credit = !!c && creditAllowed();
    $('payCreditWrap').classList.toggle('hidden', !credit);
    $('payAllCredit').classList.toggle('hidden', !credit);
    if (!credit) $('payCredit').value = 0;
    if (!S.payTouched) { $('payCash').value = total; $('payMobile').value = 0; $('payCredit').value = 0; }
    checkPay();
}
function setPay(mode) {
    const t = cartTotal();
    $('payCash').value = mode === 'cash' ? t : 0;
    $('payMobile').value = mode === 'mobile' ? t : 0;
    $('payCredit').value = mode === 'credit' ? t : 0;
    S.payTouched = true; checkPay();
}
function checkPay() {
    const ok = Math.abs(num($('payCash').value) + num($('payMobile').value) + num($('payCredit').value) - cartTotal()) < 1;
    // show which way the customer is paying
    const t = cartTotal(), c = num($('payCash').value), m = num($('payMobile').value), cr = num($('payCredit').value);
    $('ppCash').classList.toggle('on', t > 0 && c >= t - 0.5); $('ppMobile').classList.toggle('on', t > 0 && m >= t - 0.5); $('payAllCredit').classList.toggle('on', t > 0 && cr >= t - 0.5);
    $('payWarn').style.display = ok || !Object.keys(S.cart).length ? 'none' : 'block';
    return ok;
}

// Electronics: anything that tracks serials or has a warranty
const isElectronic = p => !!p && !isService(p) && (p.trackSerial || Number(p.warrantyMonths) > 0);
async function confirmSale() {
    if (S.saving) return;
    // Electronics: ask for the customer and the serial / IMEI, for the warranty and for safety. The seller may skip.
    const elec = Object.keys(S.cart).map(productById).filter(isElectronic);
    if (elec.length && !S.elecAsked) {
        S.elecAsked = true;
        if (!S.saleCustomer) {
            const k = await choose(`📱 <b>${tl('Electronics in this sale')}</b><br><span style="font-weight:500;">${tl('Add the customer for the warranty and safety?')}</span>`,
                [['cust', '👤 ' + tl('Add customer'), 'var(--pos)'], ['skip', tl('Continue without customer'), '#5b6474']], tl('Back'));
            if (!k) { S.elecAsked = false; return; }
            if (k === 'cust') { S.elecAsked = false; openCustomers('pick'); return; }
        }
        for (const p of elec.filter(p => !p.trackSerial && !meta(p.id).ref)) {
            const v = await askValue(`🔢 ${tl('Serial / IMEI / barcode for')} <b class="notr">${esc(p.name)}</b><br><span style="font-size:.75rem;color:#6b7280;">${tl('Optional — leave empty to skip.')}</span>`, 'IMEI / S/N', tl('Save'), { type: 'text' });
            if (v) meta(p.id).ref = v.trim().slice(0, 60);
        }
    }
    // Serials not on the shelf list: make sure they weren't already sold (e.g. on another till)
    const unknown = [];
    Object.keys(S.cart).forEach(id => { const p = productById(id); if (p && p.trackSerial) (meta(id).serials || []).forEach(sn => { sn = (sn || '').trim(); if (sn && !S.serialsIn[serialId(sn)]) unknown.push(sn); }); });
    if (unknown.length) {
        S.saving = true;
        try {
            for (const sn of unknown) {
                const d = await Promise.race([col('serials').doc(serialId(sn)).get().then(x => x.exists ? x.data() : null).catch(() => null), new Promise(r => setTimeout(() => r(null), 2500))]);
                if (d && d.status === 'sold') return toast(`⚠️ ${sn} was already sold${d.soldAt && tms(d.soldAt) ? ' on ' + new Date(tms(d.soldAt)).toLocaleDateString('en-GB') : ''}${d.soldBy ? ' by ' + d.soldBy : ''}. Check the number.`, 'err');
            }
        } finally { S.saving = false; }
    }
    const lines = Object.entries(S.cart);
    if (!lines.length) return toast('Cart is empty');
    if (!checkPay()) return toast('⚠️ The payment must add up to the total.', 'err');
    if (!isAdmin() && discPctNow() > maxDiscPct() + 0.01) return toast(`⚠️ Discount is ${discPctNow().toFixed(1)}% — your limit is ${maxDiscPct()}%. Ask the owner.`, 'err');
    const credit = num($('payCredit').value);
    if (credit > 0 && !S.saleCustomer) return toast('⚠️ Add the customer before selling on credit.', 'err');
    if (credit > 0 && !creditAllowed()) return toast('⚠️ Only the owner can sell on credit.', 'err');
    const items = [], allSerials = [];
    const gross = cartGross(), disc = cartDiscount();
    for (const [id, qty] of lines) {
        const p = productById(id);
        if (!p) return toast('An item was removed from stock. Check the cart.', 'err');
        if (!isService(p) && (Number(p.stock) || 0) < qty - 1e-9) return toast(`⚠️ Only ${qtyTxt(p.stock, p)} ${p.name} left`, 'err');
        if (isService(p) && !meta(id).by) { openCart(); return toast(`⚠️ ${tl('Choose who did')} ${p.name}.`, 'err'); }
        let serials = [];
        if (p.trackSerial) {
            serials = (meta(id).serials || []).slice(0, qty).map(x => (x || '').trim());
            if (serials.length < qty || serials.some(x => !x)) return toast(`⚠️ Enter the serial / IMEI for each ${p.name}.`, 'err');
            if (new Set(serials).size !== serials.length) return toast(`⚠️ The same serial is entered twice for ${p.name}.`, 'err');
            const shelf = inStockSerials(id);
            for (const sn of serials) {
                const r = S.serialsIn[serialId(sn)];
                if (r && r.productId !== id) return toast(`⚠️ Serial ${sn} belongs to ${r.name}, not ${p.name}.`, 'err');
                // Items that have serials registered must be sold from that list (catches typos and double-selling)
                if (!r && shelf.length) return toast(`⚠️ Serial ${sn} is not on the shelf list for ${p.name}. Check the number — it may already be sold.`, 'err');
            }
            allSerials.push(...serials);
        }
        const unitPrice = linePrice(id);
        items.push({ productId: id, name: p.name, emoji: p.emoji || '📦', unit: unitOf(p), qty: q3(qty), listPrice: Number(p.sellPrice) || 0, unitPrice,
            subtotal: lineSub(id), serials, warrantyMonths: Number(p.warrantyMonths) || 0,
            ...(meta(id).ref ? { ref: meta(id).ref } : {}),
            ...(isService(p) ? { service: true, share: shareOf(p, qty) } : {}), ...(meta(id).by ? { by: meta(id).by, byName: staffName(meta(id).by) } : {}) });
    }
    const total = cartTotal(), list = Math.round(cartList());
    const cash = num($('payCash').value), mobile = num($('payMobile').value);
    const day = dayStr(), month = day.slice(0, 7);
    const ref = col('sales').doc();
    const receiptNo = 'R' + day.slice(2).replace(/-/g, '') + '-' + ref.id.slice(0, 4).toUpperCase();
    const cust = S.saleCustomer ? { id: S.saleCustomer.id, name: S.saleCustomer.name, phone: S.saleCustomer.phone || '' } : null;
    const lineOf = {}; items.forEach((i, ix) => { lineOf[i.productId] = ix; });
    const sale = {
        kind: 'pos', appV: APP_VERSION, items, lineOf, subtotal: list, discount: Math.max(0, list - total), saleDiscount: disc, total, cash, mobile, credit,
        customer: cust, serials: allSerials, receiptNo, day, month, voided: false, staffUid: S.me.uid, staffName: S.me.name, createdAt: now()
    };
    const b = db.batch();
    b.set(ref, sale);
    const why = src('sales', ref.id);
    items.forEach(i => { if (!i.service) b.update(col('products').doc(i.productId), { stock: inc(-i.qty), src: why, updatedAt: now() }); });
    const dayUp = { day, month, sales: inc(total), cash: inc(cash), mobile: inc(mobile), txCount: inc(1), src: why, updatedAt: now() };
    if (credit) dayUp.credit = inc(credit);
    if (sale.discount) dayUp.discount = inc(sale.discount);
    b.set(col('days').doc(day), dayUp, { merge: true });
    b.set(col('meta').doc('balances'), { cash: inc(cash), mobile: inc(mobile), src: why, updatedAt: now() }, { merge: true });
    if (cust) b.update(col('customers').doc(cust.id), { balance: inc(credit), totalBought: inc(total), lastSaleAt: now(), src: why, updatedAt: now() });
    items.forEach(i => (i.serials || []).forEach(sn => b.set(col('serials').doc(serialId(sn)), {
        serial: sn, productId: i.productId, name: i.name, status: 'sold', saleId: ref.id, soldAt: now(), soldBy: S.me.name,
        customerName: cust ? cust.name : null, updatedAt: now() }, { merge: true })));
    b.update(tRef(), { txnCount: inc(1), lastSaleAt: now() });

    closeModals();
    S.lastSale = { ...sale, id: ref.id, createdAt: { toDate: () => new Date(), toMillis: () => Date.now() } };
    clearCart();
    renderLastSale();
    navigator.vibrate?.(80);
    if ((S.tenantInfo.settings || {}).askReceipt !== false) setTimeout(() => receiptMenu(S.lastSale, true), 350);
    commit(b, `✅ ${tl(isBarberMode() ? 'Client recorded' : 'Sale recorded')} · ${fmt(total)}`, { label: `Sale ${receiptNo} · ${fmt(total)} · ${items.map(i => qtyTxt(i.qty, { unit: i.unit }) + ' × ' + i.name).join(', ')}${credit ? ' · credit ' + n0(credit) + ' to ' + cust.name : ''}` });
}
function renderLastSale() {
    const s = S.lastSale, bar = $('lastSaleBar');
    if (!s) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = `<span>✅ ${esc(s.receiptNo)} · ${fmt(s.total)}${s.customer ? ' · ' + esc(s.customer.name) : ''}${s.credit ? ` · 📒 ${n0(s.credit)} on credit` : ''}</span><button onclick="receiptMenu(S.lastSale)">🧾 Receipt</button>`;
}

// ════════════════════════════════════════════════

// ── My day: what this person sold today, receipts again, and a check before closing ──
// Sellers see their own work; the owner and admins see the whole shop.
// Sellers can look back 30 days at their own sales; the owner can open any date
const MYDAY_BACK = 30;
function openTodaySales() {
    openSheet('sheetTodaySales');
    myDayGo(dayStr());
}
function myDayGo(d) {
    const today = dayStr(), min = isAdmin() ? '2000-01-01' : shiftDay(today, -MYDAY_BACK);
    if (!d || d > today) d = today;
    if (d < min) { toast(tl('Sellers can look back 30 days. Ask the owner for older sales.'), 'err'); d = min; }
    S.myDay = d; S.myDayEntries = null; S.myDayPast = d === today ? null : undefined;
    const pick = $('tsDay'); if (pick) { pick.value = d; pick.max = today; pick.min = isAdmin() ? '' : min; }
    if ($('tsPrev')) $('tsPrev').disabled = d <= min;
    if ($('tsNext')) $('tsNext').disabled = d >= today;
    document.querySelectorAll('#sheetTodaySales .today-only').forEach(el => el.classList.toggle('hidden', d !== today));
    renderTodaySales();
    const mine = c => isAdmin() ? col(c).where('day', '==', d) : col(c).where('staffUid', '==', S.me.uid).where('day', '==', d);
    // money paid out of the drawer that day (expenses), for the reconciliation
    mine('entries').get().then(sn => { if (S.myDay !== d) return; S.myDayEntries = sn.docs.map(x => x.data()); renderTodaySales(); })
        .catch(() => { if (S.myDay !== d) return; S.myDayEntries = []; renderTodaySales(); });
    if (d !== today) mine('sales').get().then(sn => { if (S.myDay !== d) return; S.myDayPast = sn.docs.map(x => ({ id: x.id, ...x.data() })); renderTodaySales(); })
        .catch(e => { if (S.myDay !== d) return; S.myDayPast = []; renderTodaySales(); toast(friendlyErr(e), 'err'); });
}
function myDaySales() {
    const src = S.myDay && S.myDay !== dayStr() ? (S.myDayPast || []) : (S.todaySales || []);
    return src.filter(x => ['pos', 'return', 'manual', 'repay'].includes(x.kind || 'pos') && (isAdmin() || x.staffUid === S.me.uid));
}
function renderMyDay() {
    const box = $('tsSummary'); if (!box) return;
    const past = S.myDay && S.myDay !== dayStr();
    if (past && !S.myDayPast) { box.innerHTML = `<div class="empty-state">${tl('Loading…')}</div>`; return; }
    const L = myDaySales().filter(x => !x.voided);
    const sum = f => L.reduce((a, x) => a + (Number(x[f]) || 0), 0);
    const pos = L.filter(x => (x.kind || 'pos') === 'pos'), rets = L.filter(x => x.kind === 'return'), repay = L.filter(x => x.kind === 'repay');
    const salesTotal = L.filter(x => x.kind !== 'repay').reduce((a, x) => a + (x.kind === 'return' ? -1 : 1) * (Number(x.total) || 0), 0);
    const cashIn = sum('cash'), mobileIn = sum('mobile');
    const credit = pos.reduce((a, x) => a + (Number(x.credit) || 0), 0);
    const ents = (S.myDayEntries || []).filter(e => e.type === 'expense');
    const paidCash = ents.filter(e => e.from === 'cash').reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const paidMobile = ents.filter(e => e.from === 'mobile').reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const word = isBarberMode() ? (pos.length === 1 ? 'client' : 'clients') : (pos.length === 1 ? 'sale' : 'sales');
    box.innerHTML = `<div class="md-card">
        <div class="md-top"><div><small>${past ? esc(prettyDay(S.myDay)) : tl(isAdmin() ? 'Shop today' : 'Your day')}</small><b>${fmt(salesTotal)}</b></div><div class="md-n"><b>${pos.length}</b><small>${tl(word)}</small></div></div>
        <div class="md-grid">
            <div><small>💵 ${tl('Cash received')}</small><b>${n0(cashIn)}</b></div>
            <div><small>📱 ${tl('Mobile received')}</small><b>${n0(mobileIn)}</b></div>
            ${credit ? `<div><small>📒 ${tl('On credit')}</small><b>${n0(credit)}</b></div>` : ''}
            ${repay.length ? `<div><small>💰 ${tl('Debts paid')}</small><b>${n0(repay.reduce((a, x) => a + (Number(x.total) || 0), 0))}</b></div>` : ''}
            ${rets.length ? `<div><small>↩️ ${tl('Refunds')}</small><b>−${n0(rets.reduce((a, x) => a + (Number(x.total) || 0), 0))}</b></div>` : ''}
            ${paidCash || paidMobile ? `<div><small>💸 ${tl('Paid out')}</small><b>−${n0(paidCash + paidMobile)}</b></div>` : ''}
        </div>
        <div class="md-check"><span>💵 ${tl(isAdmin() ? 'Cash from today\'s sales, less money paid out' : 'Cash from your sales, less money you paid out')}</span><b>${S.myDayEntries ? fmt(cashIn - paidCash) : '…'}</b></div>
        ${past ? '' : `<div class="md-note">${tl('Count the drawer: it should hold this plus the change it started with. Mobile money should show')} <b>${n0(mobileIn - paidMobile)}</b> ${tl('more than this morning.')}</div>`}
    </div>`;
}
function renderTodaySales() {
    const box = $('tsList'); if (!box) return;
    renderMyDay();
    const q = ($('tsSearch').value || '').toLowerCase().trim();
    let L = myDaySales();
    L.sort((a, b) => (tms(b.createdAt) || 9e15) - (tms(a.createdAt) || 9e15));
    if (q) L = L.filter(x => [x.receiptNo, x.customer && x.customer.name, ...(x.items || []).map(i => i.name)].join(' ').toLowerCase().includes(q));
    L.forEach(x => S.saleCache[x.id] = x);
    box.innerHTML = L.length ? L.map(x => {
        const gone = x.voided || (typeof isCancelled === 'function' && isCancelled(x));
        const what = x.kind === 'manual' ? tl('Manual sale') : x.kind === 'repay' ? tl('Debt payment') : (x.items || []).map(i => esc(i.name) + (i.qty > 1 ? ' ×' + q3(i.qty) : '')).join(', ');
        const how = [x.cash ? '💵' : '', x.mobile ? '📱' : '', x.credit > 0 ? '📒' : ''].join('');
        return `<div class="ts-row ${gone ? 'gone' : ''}">
            <div class="ts-main"><b>${x.kind === 'return' ? '↩️ ' : ''}<span class="notr">${esc(x.receiptNo || '')}</span> · ${timeOf(x.createdAt)}</b>
                <small class="notr">${what}</small>${x.customer ? `<small>👤 <span class="notr">${esc(x.customer.name)}</span></small>` : ''}${isAdmin() && x.staffName ? `<small>${tl('By')} <span class="notr">${esc(x.staffName)}</span></small>` : ''}</div>
            <div class="ts-amt">${x.kind === 'return' ? '−' : ''}${n0(x.total)}<small style="color:var(--gray);">${gone ? `<span style="color:var(--red);">${tl(x.voided ? 'Voided' : 'Cancelled')}</span>` : how}</small></div>
            ${x.kind === 'pos' || x.kind === 'return' ? `<button class="ts-rcpt" onclick="receiptMenu(S.saleCache['${x.id}'])">🧾</button>` : '<span style="width:42px;"></span>'}</div>`;
    }).join('') : `<div class="hint gray">${tl(q ? 'Nothing matches.' : S.myDay && S.myDay !== dayStr() ? (S.myDayPast ? 'No sales on this day.' : 'Loading…') : 'No sales yet today.')}</div>`;
}

async function editRef(id) {
    const p = productById(id); if (!p) return;
    const v = await askValue(`🔢 ${tl('Serial / IMEI / barcode for')} <b class="notr">${esc(p.name)}</b>`, 'IMEI / S/N', tl('Save'), { type: 'text', value: meta(id).ref || '' });
    if (v === null) return;
    meta(id).ref = v.trim().slice(0, 60) || null; renderCart();
}
