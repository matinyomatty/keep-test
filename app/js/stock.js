// Keep till — Stock list, items, restock and stock counts.
// Part of app/index.html; the parts load in order and share one global scope.
//  STOCK
// ════════════════════════════════════════════════
// Expiry: days left until the soonest expiry date on the shelf (null = no date set or nothing in stock).
const EXPIRY_WARN_DAYS = 30;
function daysToExpiry(p) {
    if (!p || !p.expiry || (Number(p.stock) || 0) <= 0) return null;
    const d = new Date(p.expiry + 'T00:00:00'), t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
}
function expiringItems() {
    return S.products.map(p => ({ p, d: daysToExpiry(p) })).filter(x => x.d !== null && x.d <= EXPIRY_WARN_DAYS).sort((a, b) => a.d - b.d);
}
function expiryTxt(d) {
    if (d === null) return '';
    if (d < 0) return tl(`Expired ${-d} day${d === -1 ? '' : 's'} ago`);
    if (d === 0) return tl('Expires today');
    return tl(`Expires in ${d} day${d === 1 ? '' : 's'}`);
}
function filterExpiring() { S.invFilter = S.invFilter === 'exp' ? '' : 'exp'; renderInventory(); }
function renderInventory() {
    if (!S.me) return;
    const P = S.products;
    const expN = expiringItems().length;
    const G = P.filter(p => !isService(p));
    const low = G.filter(p => p.stock > 0 && p.stock <= (Number(p.reorderLevel) || 5)).length;
    const out = G.filter(p => (Number(p.stock) || 0) <= 0).length;
    const value = P.reduce((s, p) => s + (S.costs[p.id] || 0) * Math.max(0, Number(p.stock) || 0), 0);
    $('invStrip').innerHTML = `
        <div class="inv-strip-card"><h4>Items</h4><p>${P.length}</p></div>
        <div class="inv-strip-card ${low ? 'alert' : ''}"><h4>Low stock</h4><p>${low}</p></div>
        <div class="inv-strip-card ${out ? 'alert' : ''}"><h4>Out of stock</h4><p>${out}</p></div>
        ${expN || S.invFilter === 'exp' ? `<div class="inv-strip-card alert" style="cursor:pointer;${S.invFilter === 'exp' ? 'outline:2px solid var(--red);' : ''}" onclick="filterExpiring()"><h4>⏳ Expiring</h4><p>${expN}</p></div>` : ''}
        ${isAdmin() ? `<div class="inv-strip-card"><h4>Stock value (cost)</h4><p style="font-size:0.74rem;">${fmt(value)}</p></div>` : ''}`;

    const raw = ($('invSearch').value || '').trim(), q = raw.toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    let list = P.filter(p => {
        const hay = [p.name, p.category, p.emoji, p.sellPrice, p.stock, p.barcode].join(' ').toLowerCase();
        return words.every(w => hay.includes(w));
    });
    if (S.invFilter === 'exp') {
        const ids = new Set(expiringItems().map(x => x.p.id));
        list = list.filter(p => ids.has(p.id)).sort((a, b) => daysToExpiry(a) - daysToExpiry(b));
    } else if (!q) list = [...list].sort((a, b) => (a.stock || 0) - (b.stock || 0));
    $('invLabel').textContent = S.invFilter === 'exp' ? tl('Expired or expiring within 30 days') : !q ? 'All stock items · lowest first' : list.length ? `"${raw}" — ${list.length} item${list.length > 1 ? 's' : ''}` : `Nothing found for "${raw}"`;
    const box = $('invList');
    if (!P.length) {
        box.innerHTML = `<div class="empty-state"><div class="icon">📦</div>No items yet.${isAdmin() ? '<br>Tap <strong>+ ADD ITEM</strong> to get started.' : ''}</div>`;
        return;
    }
    box.innerHTML = list.map(p => {
        const svc = isService(p), st = Number(p.stock) || 0, isOut = !svc && st <= 0, isLow = !svc && !isOut && st <= (Number(p.reorderLevel) || 5);
        return `<div class="inv-row ${isOut ? 'out' : isLow ? 'low' : ''}">
            <span class="inv-emoji">${esc(p.emoji || '📦')}</span>
            <div class="inv-info">
                <div class="inv-name">${esc(p.name)}</div>
                <div class="inv-detail">${esc(p.category || 'General')} · Sell ${n0(p.sellPrice)}${perUnit(p)}${isAdmin() ? ' · Cost ' + n0(S.costs[p.id] || 0) : ''}${p.trackSerial ? ` · 🔢 ${inStockSerials(p.id).length} serials` : ''}${p.warrantyMonths ? ' · 🛡️ ' + p.warrantyMonths + 'm' : ''}${p.packSize > 1 ? ' · ' + p.packSize + '/pack' : ''}${(() => { const d = daysToExpiry(p); return d === null ? '' : ` · <span style="color:${d <= 0 ? 'var(--red)' : d <= EXPIRY_WARN_DAYS ? '#b45309' : 'inherit'};font-weight:${d <= EXPIRY_WARN_DAYS ? 800 : 400};">⏳ ${d <= EXPIRY_WARN_DAYS ? esc(expiryTxt(d)) : 'Exp ' + esc(p.expiry)}</span>`; })()}</div>
            </div>
            <div class="inv-stock">${svc ? `<b style="font-size:1rem;">✂️</b><small>${tl('Service')}</small>` : `<b class="${isOut ? 'out' : isLow ? 'low' : ''}">${q3(st).toLocaleString('en-US')}</b><small>${unitOf(p) === 'pc' ? 'pcs' : unitShort(p)}</small>`}</div>
            <div class="inv-actions">
                ${svc ? '' : `<button class="btn-circle" title="Restock" onclick="openRestock('${p.id}')">📥</button>`}
                ${p.trackSerial ? `<button class="btn-circle" title="Serials on the shelf" onclick="openSerials('${p.id}')">🔢</button>` : ''}
                ${isAdmin() ? `<button class="btn-circle" title="Edit" onclick="openItem('${p.id}')">✏️</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function buildEmojiPicker() {
    const svcForm = $('itemService') && $('itemService').checked;
    $('emojiPicker').innerHTML = (isBarberMode() && svcForm ? BARBER_ICONS : isBarberMode() ? ['🧴','🧼','🪮','🪒','🧽','💈','🧻','💊','🥤','🍫','🛍️','📦'] : isServiceShop() ? ['💈','✂️','💇','💇‍♀️','🧔','🪒','💅','💆','🧖','🪮', ...EMOJIS] : EMOJIS).map(e => `<button type="button" class="emoji-opt ${e === S.emoji ? 'sel' : ''}" onclick="pickEmoji(this)">${e}</button>`).join('');
}
function pickEmoji(el) {
    S.emoji = el.textContent;
    document.querySelectorAll('.emoji-opt').forEach(x => x.classList.toggle('sel', x === el));
}

function openItem(id) {
    if (!isAdmin()) return;
    const p = id ? productById(id) : null;
    $('itemTitle').textContent = p ? 'Edit Item' : 'Add New Item';
    $('itemId').value = p ? p.id : '';
    $('itemName').value = p ? p.name : '';
    $('itemCat').value = p ? (p.category || '') : '';
    $('itemSell').value = p ? (p.sellPrice ?? '') : '';
    $('itemCost').value = p ? (S.costs[p.id] ?? '') : '';
    $('itemStock').value = p ? (p.stock ?? '') : '';
    $('itemReorder').value = p ? (p.reorderLevel ?? 5) : '';
    $('itemBarcode').value = p ? (p.barcode || '') : '';
    $('itemExpiry').value = p ? (p.expiry || '') : '';
    $('itemService').checked = p ? isService(p) : (S.tenantInfo || {}).type === 'barbershop';
    $('itemStaffPay').value = p && p.staffPay ? p.staffPay : '';
    serviceChanged();
    $('itemUnit').innerHTML = UNITS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    $('itemUnit').value = p ? unitOf(p) : 'pc';
    $('itemPart').checked = p ? partOk(p) : false;
    $('itemPack').value = p && p.packSize > 1 ? p.packSize : '';
    $('itemWarranty').value = p && p.warrantyMonths ? p.warrantyMonths : '';
    $('itemSerial').checked = !!(p && p.trackSerial);
    unitChanged(true);
    $('itemDeleteBtn').classList.toggle('hidden', !p);
    $('catList').innerHTML = [...new Set(S.products.map(x => x.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('');
    S.emoji = p ? (p.emoji || '📦') : '📦';
    buildEmojiPicker();
    openSheet('sheetItem');
    if (!p) setTimeout(() => $('itemName').focus(), 250);
}

function unitChanged(keepPart) {
    const u = $('itemUnit').value, name = (UNITS.find(x => x[0] === u) || UNITS[0])[1].toLowerCase();
    if (!keepPart) $('itemPart').checked = PART_UNITS.includes(u);
    $('lblSell').textContent = `Sell price / ${name} (TZS)`;
    $('lblCost').textContent = `Cost / ${name} (TZS)`;
    $('lblStock').textContent = `In stock (${u === 'pc' ? 'pieces' : name + 's'})`;
    if ($('itemService').checked) { $('lblSell').textContent = 'Price (TZS)'; $('lblCost').textContent = 'Cost to you (TZS, optional)'; }
}
function saveItem() {
    const id = $('itemId').value;
    const name = $('itemName').value.trim();
    if (!name) return toast('⚠️ Item name is required.', 'err');
    if (S.products.some(p => p.id !== id && (p.name || '').toLowerCase() === name.toLowerCase())) return toast('⚠️ An item with that name already exists.', 'err');
    const sellPrice = num($('itemSell').value), cost = num($('itemCost').value);
    if (sellPrice <= 0) return toast('⚠️ Enter a selling price.', 'err');
    const svc = $('itemService').checked;
    if (svc && num($('itemStaffPay').value) > sellPrice) return toast('⚠️ ' + tl('The barber cannot get more than the price.'), 'err');
    if (svc) { $('itemStock').value = '0'; $('itemSerial').checked = false; $('itemPart').checked = false; $('itemPack').value = ''; $('itemWarranty').value = ''; $('itemExpiry').value = ''; }
    const part = $('itemPart').checked, serial = $('itemSerial').checked;
    const roundQ = v => part ? q3(v) : Math.round(v);
    const stock = roundQ(num($('itemStock').value)), reorderLevel = roundQ(num($('itemReorder').value)) || 5;
    if (serial && part) return toast('⚠️ Items with serial numbers are sold in whole units — untick "part units".', 'err');
    const prev = id ? productById(id) : null;
    if (serial && stock !== (prev ? Number(prev.stock) || 0 : 0)) return toast(prev ? '⚠️ For serial items, add stock with 📥 Restock so each serial is scanned in.' : '⚠️ Save serial items with stock 0, then use 📥 Restock to scan each serial in.', 'err');
    const maxP = Number((S.tenantInfo.limits || {}).maxProducts) || 0;
    if (!id && maxP && usedItems() >= maxP) return toast(`⚠️ Your plan allows ${maxP} items. Ask Keep to upgrade your plan.`, 'err');
    const ref = id ? col('products').doc(id) : col('products').doc();
    const before = id ? productById(id) : null;
    const b = db.batch();
    const barcode = $('itemBarcode').value.trim();
    if (barcode && S.products.some(p => p.id !== id && p.barcode && normCode(p.barcode) === normCode(barcode))) return toast('⚠️ Another item already uses that barcode.', 'err');
    b.set(ref, { name, emoji: S.emoji, category: $('itemCat').value.trim() || 'General', sellPrice, stock, reorderLevel, barcode,
        unit: $('itemUnit').value, partQty: part, packSize: Math.max(0, Math.round(num($('itemPack').value))) || 0,
        warrantyMonths: Math.max(0, Math.round(num($('itemWarranty').value))) || 0, trackSerial: serial, expiry: $('itemExpiry').value || '',
        service: svc, staffPay: svc ? Math.max(0, Math.round(num($('itemStaffPay').value))) || 0 : 0, updatedAt: now() }, { merge: true });
    b.set(col('costs').doc(ref.id), { costPrice: cost, updatedAt: now() }, { merge: true });
    if (!id) usageAdd(b, 'products', ref.id);
    if (!before || (Number(before.stock) || 0) !== stock) {
        b.set(col('movements').doc(), {
            productId: ref.id, name, type: before ? 'edit' : 'opening', qty: stock - (before ? Number(before.stock) || 0 : 0),
            before: before ? Number(before.stock) || 0 : 0, after: stock, day: dayStr(), staffUid: S.me.uid, staffName: S.me.name, createdAt: now()
        });
    }
    closeModals();
    commit(b, id ? '✅ Item updated' : '✅ Item added');
}

async function deleteItem() {
    const id = $('itemId').value, p = productById(id); if (!p) return;
    if (!await showConfirm(`Delete <b>${esc(p.name)}</b>?<br><span style="font-size:0.78rem;color:#6b7280;">Past sales stay in your records.</span>`)) return;
    const b = db.batch();
    b.delete(col('products').doc(id));
    b.delete(col('costs').doc(id));
    usageDel(b, 'products', id);
    delete S.cart[id];
    closeModals();
    commit(b, '🗑️ Item deleted');
}

function openRestock(id) {
    const p = productById(id); if (!p) return;
    $('restockId').value = id;
    $('restockInfo').innerHTML = `<strong>${esc(p.emoji || '📦')} ${esc(p.name)}</strong><br>In stock now: <strong>${qtyTxt(p.stock || 0, p)}</strong> · warn below ${qtyTxt(p.reorderLevel || 5, p)}`;
    $('restockQty').value = '';
    const un = unitOf(p) === 'pc' ? 'pieces' : unitName(p) + 's';
    $('restockIn').innerHTML = `<option value="1">${un}</option>` + (p.packSize > 1 ? `<option value="${p.packSize}">packs of ${p.packSize}</option>` : '');
    $('lblRestockCost').textContent = `Cost per ${unitOf(p) === 'pc' ? 'piece' : unitName(p)} (TZS)`;
    $('restockCost').value = S.costs[id] || '';
    $('restockPaid').value = '';
    $('restockExpiry').value = '';
    const ser = !!p.trackSerial;
    $('restockSerialWrap').classList.toggle('hidden', !ser);
    $('restockInWrap').classList.toggle('hidden', ser);
    $('restockQty').readOnly = ser; $('restockSerials').value = ''; $('restockSerialInfo').innerHTML = ser ? 'Each serial = one unit.' : '';
    restockTotal();
    openSheet('sheetRestock');
    setTimeout(() => $('restockQty').focus(), 250);
}
function restockUnits() { return q3(num($('restockQty').value) * (Number($('restockIn').value) || 1)); }
function restockTotal() {
    const p = productById($('restockId').value), u = restockUnits();
    $('restockTotalLbl').textContent = fmt(u * num($('restockCost').value)) + (Number($('restockIn').value) > 1 && p ? ` · ${qtyTxt(u, p)} added` : '');
}

function confirmRestock() {
    const id = $('restockId').value, p = productById(id); if (!p) return;
    const serials = p.trackSerial ? parseSerials($('restockSerials').value) : [];
    if (p.trackSerial) {
        if (!serials.length) return toast('⚠️ Scan or type the serial / IMEI of each unit.', 'err');
        const dup = serials.filter(x => S.serialsIn[serialId(x)]);
        if (dup.length) return toast(`⚠️ Already in stock: ${dup.join(', ')}`, 'err');
    }
    const qty = p.trackSerial ? serials.length : partOk(p) ? restockUnits() : Math.round(restockUnits());
    if (qty <= 0) return toast('⚠️ Enter how much came in.', 'err');
    const cost = isAdmin() ? num($('restockCost').value) : 0;
    const paid = isAdmin() ? $('restockPaid').value : '';
    if (paid && cost <= 0) return toast('⚠️ Enter the cost per unit to record the payment.', 'err');
    const day = dayStr();
    const b = db.batch(), mv = col('movements').doc();
    const pu = { stock: inc(qty), src: src('movements', mv.id), updatedAt: now() };
    const exp = isAdmin() ? $('restockExpiry').value : '';
    // Keep the soonest date on the shelf; if the old stock had run out, the new batch's date takes over.
    if (exp) pu.expiry = (!p.expiry || (Number(p.stock) || 0) <= 0 || exp < p.expiry) ? exp : p.expiry;
    b.update(col('products').doc(id), pu);
    b.set(mv, {
        productId: id, name: p.name, type: 'restock', qty, unitCost: isAdmin() ? cost : null, expiry: exp || null,
        day, staffUid: S.me.uid, staffName: S.me.name, createdAt: now()
    });
    if (isAdmin() && cost > 0) b.set(col('costs').doc(id), { costPrice: cost, updatedAt: now() }, { merge: true });
    serials.forEach(sn => b.set(col('serials').doc(serialId(sn)), { serial: sn, productId: id, name: p.name, status: 'in', receivedAt: now(), receivedBy: S.me.name,
        saleId: null, soldAt: null, soldBy: null, customerName: null, updatedAt: now() }, { merge: true }));
    if (paid) writeEntries(b, [{ type: 'expense', category: 'Supplier', from: paid, to: null, amount: Math.round(qty * cost), note: `Restock ${qtyTxt(qty, p)} × ${p.name}`, day }]);
    closeModals();
    commit(b, `✅ +${qtyTxt(qty, p)} ${p.name}`, { label: `Restock +${qtyTxt(qty, p)} ${p.name}${serials.length ? ' (' + serials.join(', ') + ')' : ''}` });
}

function openStocktake() {
    $('stkSearch').value = '';
    $('stkList').innerHTML = S.products.filter(p => !isService(p)).map(p => `
        <div class="stk-line" data-name="${esc((p.name || '').toLowerCase())}">
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.82rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.emoji || '📦')} ${esc(p.name)}</div>
                <div style="font-size:0.68rem;color:var(--gray);">System: <strong>${qtyTxt(p.stock || 0, p)}</strong></div>
            </div>
            <input type="number" inputmode="decimal" step="${partOk(p) ? '0.01' : '1'}" placeholder="${q3(p.stock || 0)}" data-id="${p.id}" data-sys="${p.stock || 0}">
        </div>`).join('') || '<div class="empty-state">No items yet.</div>';
    openSheet('sheetStocktake');
}
function filterStocktake() {
    const q = $('stkSearch').value.trim().toLowerCase();
    document.querySelectorAll('#stkList .stk-line').forEach(r => r.style.display = !q || r.dataset.name.includes(q) ? '' : 'none');
}
function confirmStocktake() {
    const changes = [];
    document.querySelectorAll('#stkList input[data-id]').forEach(i => {
        if (i.value.trim() === '') return;
        const p = productById(i.dataset.id), actual = partOk(p) ? q3(num(i.value)) : Math.round(num(i.value)), sys = Number(i.dataset.sys) || 0;
        if (Math.abs(actual - sys) > 1e-9) changes.push({ id: i.dataset.id, actual, sys });
    });
    if (!changes.length) { closeModals(); return toast('No differences found 👍'); }
    const day = dayStr();
    // 10 items per save: the database checks each count against its own movement record,
    // and it can only look up about 20 records per save.
    for (let i = 0; i < changes.length; i += 10) {
        const b = db.batch();
        changes.slice(i, i + 10).forEach(c => {
            const p = productById(c.id), mv = col('movements').doc(), d = q3(c.actual - c.sys);
            b.update(col('products').doc(c.id), { stock: inc(d), src: src('movements', mv.id), updatedAt: now() });
            b.set(mv, {
                productId: c.id, name: p ? p.name : '', type: 'stocktake', qty: d, before: c.sys, after: c.actual,
                day, staffUid: S.me.uid, staffName: S.me.name, createdAt: now()
            });
        });
        commit(b);
    }
    closeModals();
    toast(`✅ Stocktake saved — ${changes.length} item${changes.length > 1 ? 's' : ''} corrected`);
}

// ════════════════════════════════════════════════
