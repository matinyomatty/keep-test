// Keep till — Stock from Excel and shelf labels.
// Part of app/index.html; the parts load in order and share one global scope.
//  STOCK FROM EXCEL  — template, export, upload with preview
//  The spreadsheet tool (SheetJS) is only downloaded when this screen opens.
// ════════════════════════════════════════════════
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const IMPORT_COLS = [
    ['name', 'Item name', 34, ['item name', 'name', 'item', 'product', 'bidhaa', 'jina']],
    ['category', 'Category', 16, ['category', 'group', 'aina', 'kundi']],
    ['sellPrice', 'Sell price', 12, ['sell price', 'selling price', 'price', 'bei', 'bei ya kuuza', 'sell']],
    ['cost', 'Cost price', 12, ['cost price', 'cost', 'buying price', 'bei ya kununua', 'gharama']],
    ['stock', 'Stock', 10, ['stock', 'qty', 'quantity', 'units', 'idadi', 'count']],
    ['reorderLevel', 'Warn below', 11, ['warn below', 'reorder level', 'reorder', 'min', 'minimum']],
    ['barcode', 'Barcode', 16, ['barcode', 'code', 'sku', 'bar code']],
    ['unit', 'Unit', 9, ['unit', 'uom', 'kipimo']],
    ['partQty', 'Part qty', 9, ['part qty', 'part', 'decimal', 'part units']],
    ['packSize', 'Pack size', 10, ['pack size', 'pack', 'per pack', 'per box']],
    ['warrantyMonths', 'Warranty months', 15, ['warranty months', 'warranty', 'dhamana']],
    ['trackSerial', 'Serial required', 14, ['serial required', 'serial', 'imei', 'serial/imei']],
    ['expiry', 'Expiry date', 12, ['expiry date', 'expiry', 'expires', 'exp', 'best before', 'tarehe ya kuisha', 'mwisho wa matumizi']],
    ['emoji', 'Icon', 6, ['icon', 'emoji']]
];
// Excel gives dates as day numbers, text like 31/12/2026 or 2026-12-31, or real dates.
function cellDate(v) {
    if (v === null || v === undefined || v === '') return null;
    const iso = d => isNaN(d) ? undefined : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (v instanceof Date) return iso(v);
    if (typeof v === 'number') return iso(new Date(Math.round((v - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000));
    const t = String(v).trim(); let m;
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(new Date(+m[1], m[2] - 1, +m[3]));
    if ((m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) return iso(new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], m[2] - 1, +m[1]));
    return undefined;
}
const yesNo = v => { const t = String(v ?? '').trim().toLowerCase(); return t === '' ? null : ['yes', 'y', 'true', '1', 'ndiyo', 'ndio'].includes(t); };
function unitKey(v) {
    const t = String(v ?? '').trim().toLowerCase(); if (!t) return null;
    const hit = UNITS.find(([k, l, sh]) => [k, l.toLowerCase(), sh.toLowerCase(), l.toLowerCase() + 's', k + 's'].includes(t))
        || { metres: ['m'], meter: ['m'], meters: ['m'], mita: ['m'], pcs: ['pc'], piece: ['pc'], pieces: ['pc'], kgs: ['kg'], litres: ['l'], liter: ['l'], ltr: ['l'], ctn: ['carton'], feet: ['ft'] }[t];
    return hit ? hit[0] : undefined;
}
function loadScript(url, what = 'a tool') {
    return new Promise((ok, fail) => {
        if (document.querySelector(`script[src="${url}"]`) && window.XLSX) return ok();
        const s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = () => { s.remove(); fail(new Error(`Could not load ${what}. Check your internet and try again.`)); };
        document.head.appendChild(s);
    });
}
async function needXLSX() { if (!window.XLSX) await loadScript(XLSX_URL, 'the Excel tool'); return window.XLSX; }

// ════════════════════════════════════════════════
//  SHELF LABELS  (name, price and barcode, printed on A4 label sheets)
// ════════════════════════════════════════════════
const BARCODE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js';
function openLabels() {
    if (!isAdmin()) return;
    $('lblSearch').value = '';
    const P = [...S.products].sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
    $('lblList').innerHTML = P.map(p => `
        <label class="lbl-line" data-name="${esc((p.name + ' ' + (p.category || '') + ' ' + (p.barcode || '')).toLowerCase())}" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #f1f2f4;">
            <input type="checkbox" data-id="${p.id}" style="width:20px;height:20px;flex:none;">
            <span style="flex:1;min-width:0;"><b class="notr" style="display:block;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.emoji || '📦')} ${esc(p.name)}</b>
                <small style="color:var(--gray);font-size:.7rem;">${n0(p.sellPrice)} TZS · ${p.barcode ? esc(p.barcode) : tl('no barcode yet')}</small></span>
            <input type="number" inputmode="numeric" min="1" value="1" data-qty="${p.id}" title="${esc(tl('How many of each'))}" style="width:58px;flex:none;text-align:center;">
        </label>`).join('') || `<div class="empty-state">${tl('No items yet')}</div>`;
    openSheet('sheetLabels');
    needBarcode().catch(() => {});
}
function filterLabels() {
    const q = $('lblSearch').value.trim().toLowerCase();
    document.querySelectorAll('#lblList .lbl-line').forEach(r => r.style.display = !q || r.dataset.name.includes(q) ? 'flex' : 'none');
}
function labelsAll(on) { document.querySelectorAll('#lblList .lbl-line').forEach(r => { if (r.style.display !== 'none') r.querySelector('input[type=checkbox]').checked = on; }); }
async function needBarcode() { if (!window.JsBarcode) await loadScript(BARCODE_URL, 'the barcode tool'); return window.JsBarcode; }
// In-store EAN-13 codes start with 20–29, so they never clash with codes printed by manufacturers.
function newStoreCode() {
    const used = new Set(S.products.map(p => normCode(p.barcode || '')));
    for (;;) {
        let d = '20'; for (let i = 0; i < 10; i++) d += Math.floor(Math.random() * 10);
        const sum = [...d].reduce((a, c, i) => a + (+c) * (i % 2 ? 3 : 1), 0);
        const code = d + ((10 - sum % 10) % 10);
        if (!used.has(normCode(code))) return code;
    }
}
function barcodeImage(JB, code) {
    const c = document.createElement('canvas');
    const fmt = /^\d{13}$/.test(code) ? 'EAN13' : /^\d{12}$/.test(code) ? 'UPC' : /^\d{8}$/.test(code) ? 'EAN8' : 'CODE128';
    try { JB(c, code, { format: fmt, displayValue: true, fontSize: 18, margin: 4, height: 60, width: 2 }); }
    catch (e) { JB(c, code, { format: 'CODE128', displayValue: true, fontSize: 18, margin: 4, height: 60, width: 2 }); }
    return { url: c.toDataURL('image/png'), ratio: c.width / c.height };
}
async function printLabels() {
    const picks = [...document.querySelectorAll('#lblList input[type=checkbox]:checked')].map(i => ({ p: productById(i.dataset.id), n: Math.max(1, Math.min(500, Math.round(num(document.querySelector(`[data-qty="${i.dataset.id}"]`).value)) || 1)) })).filter(x => x.p);
    if (!picks.length) return toast('⚠️ Choose at least one item.', 'err');
    if (!window.jspdf) return toast('PDF tool did not load — check your connection.', 'err');
    let JB; try { JB = await needBarcode(); } catch (e) { return toast('⚠️ ' + e.message, 'err'); }
    // Give a barcode to items that have none, and save it so the till can scan it.
    const fresh = picks.filter(x => !x.p.barcode);
    if (fresh.length) {
        const b = db.batch();
        fresh.forEach(x => { const code = newStoreCode(); x.p.barcode = code; b.set(col('products').doc(x.p.id), { barcode: code, updatedAt: now() }, { merge: true }); });
        commit(b);
    }
    const small = $('lblSize').value === 's', showPrice = $('lblPrice').checked;
    const L = small ? { cols: 5, rows: 13, w: 38.1, h: 21.2, left: 4.7, top: 10.7, gx: 2.5, gy: 0 } : { cols: 3, rows: 8, w: 70, h: 37, left: 0, top: 0, gx: 0, gy: 0 };
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const shop = (S.tenantInfo.name || '').toUpperCase(), cache = {};
    let k = 0;
    picks.forEach(({ p, n }) => {
        for (let c = 0; c < n; c++) {
            if (k && k % (L.cols * L.rows) === 0) doc.addPage();
            const i = k % (L.cols * L.rows), x = L.left + (i % L.cols) * (L.w + L.gx), y = L.top + Math.floor(i / L.cols) * (L.h + L.gy), pad = small ? 1.5 : 3;
            let ty = y + pad + (small ? 2.2 : 3.2);
            if (!small && shop) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(110); doc.text(shop, x + pad, ty); ty += 3.6; }
            doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(small ? 6.8 : 9.5);
            const lines = doc.splitTextToSize(p.name || '', L.w - pad * 2).slice(0, small ? 1 : 2);
            doc.text(lines, x + pad, ty); ty += lines.length * (small ? 2.6 : 3.8);
            if (showPrice) { doc.setFontSize(small ? 8.5 : 13); doc.text(`TZS ${n0(p.sellPrice)}${perUnit(p)}`, x + pad, ty + (small ? 0.6 : 1.4)); ty += small ? 1.6 : 3.2; }
            const img = cache[p.barcode] || (cache[p.barcode] = barcodeImage(JB, p.barcode));
            const bh = y + L.h - pad - ty - 0.5, bw = Math.min(L.w - pad * 2, bh * img.ratio);
            if (bh > 4) doc.addImage(img.url, 'PNG', x + (L.w - bw) / 2, ty + 0.5, bw, bh);
            k++;
        }
    });
    doc.save(`${(S.tenantInfo.name || 'Keep').replace(/[^\w\-]+/g, '_')}_labels_${dayStr()}.pdf`);
    closeModals();
    toast(`🏷️ ${tl('Labels downloaded')} · ${k}`);
}

function openImport() {
    if (!isAdmin()) return;
    $('impStep1').classList.remove('hidden'); $('impStep2').classList.add('hidden');
    $('impFile').value = '';
    openSheet('sheetImport');
    needXLSX().catch(() => {});
}

async function downloadTemplate(withStock) {
    let X; try { X = await needXLSX(); } catch (e) { return toast('⚠️ ' + e.message, 'err'); }
    const head = IMPORT_COLS.map(c => c[1]);
    const rows = withStock && S.products.length
        ? S.products.map(p => [p.name, p.category || '', Number(p.sellPrice) || 0, S.costs[p.id] ?? '', q3(p.stock), Number(p.reorderLevel) || 5, p.barcode || '',
            unitOf(p), partOk(p) ? 'yes' : 'no', p.packSize || '', p.warrantyMonths || '', p.trackSerial ? 'yes' : 'no', p.expiry || '', p.emoji || ''])
        : [['Example: Samsung A15 phone', 'Phones', 420000, 360000, 6, 2, '', 'pc', 'no', '', 12, 'yes', '', '📱'],
           ['Example: Bosch drill GSB 550', 'Power tools', 185000, 150000, 4, 1, '3165140601324', 'pc', 'no', '', 6, 'yes', '', '🔧'],
           ['Example: Electric cable 2.5mm', 'Electrical', 2500, 1800, 300, 50, '', 'm', 'yes', 100, '', 'no', '', '🔌'],
           ['Example: Panadol 500mg (box)', 'Pharmacy', 3000, 2200, 40, 10, '', 'box', 'no', '', '', 'no', '2027-06-30', '💊']];
    const ws = X.utils.aoa_to_sheet([head, ...rows]);
    ws['!cols'] = IMPORT_COLS.map(c => ({ wch: c[2] }));
    ws['!autofilter'] = { ref: `A1:M${rows.length + 1}` };
    const help = X.utils.aoa_to_sheet([
        ['How to fill the Stock sheet'], [],
        ['Item name', 'Required. Items with the same name (or barcode) as one in your shop are updated, not duplicated.'],
        ['Category', 'Optional, e.g. Phones, Power tools, Plumbing, Paint. Empty = General.'],
        ['Sell price', 'Required for new items. Numbers only, no commas or "TZS".'],
        ['Cost price', 'Optional. What you pay per unit — used for profit and stock value.'],
        ['Stock', 'Units you have. When uploading you choose: add to current stock, or replace it.'],
        ['Warn below', 'Optional. The till shows LOW when stock falls to this number. Empty = 5.'],
        ['Barcode', 'Optional. Lets you sell by scanning on a computer with a barcode scanner.'],
        ['Unit', 'How you sell it: pc, m (metre), ft, kg, l (litre), box, pack, carton, set, pair, roll, bag, sheet, length. Empty = pc.'],
        ['Part qty', 'yes = can sell part units like 2.5 m or 0.5 kg. Empty = yes for m/ft/kg/l, no for others.'],
        ['Pack size', 'Optional. Units in one pack/box (e.g. 100 screws per box) — lets you restock by the box.'],
        ['Warranty months', 'Optional. Printed on the receipt with the end date. Empty or 0 = no warranty.'],
        ['Serial required', 'yes = the till asks for the serial / IMEI of each unit sold (phones, laptops, power tools).'],
        ['Icon', 'Optional emoji, e.g. 🍞 🥛 🧴.'], [],
        ['Rows whose name starts with "Example" are skipped — delete them or overwrite them.'],
        ['Empty cells on existing items keep the current value.']
    ]);
    help['!cols'] = [{ wch: 14 }, { wch: 90 }];
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'Stock');
    X.utils.book_append_sheet(wb, help, 'How to fill');
    const shop = (S.tenant || 'shop').replace(/[^a-z0-9-]/gi, '');
    X.writeFile(wb, withStock ? `${shop}-stock-${dayStr()}.xlsx` : 'matinyo-stock-template.xlsx');
    toast(withStock ? '⬇️ Your stock list downloaded — edit it and upload it back' : '⬇️ Template downloaded');
}

const cellNum = v => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : NaN;
};
// Keep the icon only if it is a real emoji (some files store emoji in a way that reads back garbled)
function validEmoji(v) { try { return v && /\p{Extended_Pictographic}/u.test(v) && [...v].length <= 4 ? v : ''; } catch (e) { return ''; } }
async function readImportFile(input) {
    const file = input.files && input.files[0]; if (!file) return;
    let X; try { X = await needXLSX(); } catch (e) { return toast('⚠️ ' + e.message, 'err'); }
    loader(true, 'READING FILE...');
    try {
        const wb = X.read(await file.arrayBuffer(), { type: 'array' });
        const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'stock') || wb.SheetNames[0];
        const grid = X.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true });
        // Find the header row (first row that has a "name"-like column)
        let hIdx = grid.findIndex(r => r.some(c => IMPORT_COLS[0][3].includes(String(c).trim().toLowerCase())));
        if (hIdx < 0) throw new Error('Could not find an "Item name" column. Use the template.');
        const head = grid[hIdx].map(c => String(c).trim().toLowerCase());
        const map = {};
        IMPORT_COLS.forEach(([k, , , names]) => { const i = head.findIndex(h => names.includes(h)); if (i >= 0) map[k] = i; });
        const rows = [];
        grid.slice(hIdx + 1).forEach((r, i) => {
            const g = k => map[k] === undefined ? '' : r[map[k]];
            const name = String(g('name') ?? '').trim().replace(/\s+/g, ' ');
            if (!name && !r.some(c => String(c).trim())) return;     // blank line
            if (/^example\b/i.test(name)) return;                     // template examples
            rows.push({
                line: hIdx + i + 2, name, category: String(g('category') ?? '').trim(),
                sellPrice: cellNum(g('sellPrice')), cost: cellNum(g('cost')), stock: cellNum(g('stock')),
                reorderLevel: cellNum(g('reorderLevel')), barcode: String(g('barcode') ?? '').trim().replace(/\.0$/, ''), emoji: validEmoji(String(g('emoji') ?? '').trim()),
                unit: unitKey(g('unit')), partQty: yesNo(g('partQty')), packSize: cellNum(g('packSize')), warrantyMonths: cellNum(g('warrantyMonths')), trackSerial: yesNo(g('trackSerial')), expiry: cellDate(g('expiry'))
            });
        });
        if (!rows.length) throw new Error('The file has no item rows.');
        S.importRows = rows;
        $('impMode').value = 'add'; $('impPrices').value = 'update';
        $('impStep1').classList.add('hidden'); $('impStep2').classList.remove('hidden');
        renderImportPreview();
    } catch (e) {
        toast('⚠️ ' + (e.message || 'Could not read that file.'), 'err');
    } finally { loader(false); input.value = ''; }
}

// Work out what each row will do
function planImport() {
    const mode = $('impMode').value, prices = $('impPrices').value;
    const byName = {}, byCode = {}, seen = {};
    S.products.forEach(p => { byName[(p.name || '').toLowerCase()] = p; if (p.barcode) byCode[p.barcode] = p; });
    return S.importRows.map(r => {
        const out = { ...r, errors: [] };
        const key = r.name.toLowerCase();
        if (!r.name) out.errors.push('no name');
        if (seen[key]) out.errors.push(`same name as line ${seen[key]}`); else if (r.name) seen[key] = r.line;
        if (r.unit === undefined) out.errors.push('unknown unit');
        if (r.expiry === undefined) out.errors.push('expiry date not understood (use 31/12/2026)');
        if (r.trackSerial && (r.partQty || PART_UNITS.includes(r.unit || ''))) out.errors.push('serial items must be sold in whole units');
        ['sellPrice', 'cost', 'stock', 'reorderLevel', 'packSize', 'warrantyMonths'].forEach(k => { if (Number.isNaN(r[k])) out.errors.push(`${k === 'sellPrice' ? 'sell price' : k === 'reorderLevel' ? 'warn below' : k} is not a number`); else if (r[k] !== null && r[k] < 0) out.errors.push('negative number'); });
        const match = (r.barcode && byCode[r.barcode]) || byName[key];
        out.match = match || null;
        if (!match) {
            out.action = 'new';
            if (!(r.sellPrice > 0)) out.errors.push('sell price needed');
            if (r.barcode && byCode[r.barcode]) out.errors.push('barcode already used');
            const part = r.partQty ?? PART_UNITS.includes(r.unit || 'pc');
            out.newStock = Math.max(0, part ? q3(r.stock || 0) : Math.round(r.stock || 0));
        } else {
            out.action = 'update';
            const part = r.partQty ?? (r.unit ? PART_UNITS.includes(r.unit) : partOk(match));
            const cur = Number(match.stock) || 0, q = r.stock === null ? null : part ? q3(r.stock) : Math.round(r.stock);
            out.oldStock = cur;
            out.newStock = q3(mode === 'keep' || q === null ? cur : mode === 'add' ? cur + q : q);
            out.keepPrices = prices === 'keep';
            if (r.barcode && byCode[r.barcode] && byCode[r.barcode].id !== match.id) out.errors.push('barcode belongs to another item');
        }
        const ser = r.trackSerial ?? (match ? !!match.trackSerial : false);
        if (ser && !out.errors.length) {
            const keep = match ? Number(match.stock) || 0 : 0;
            if (out.newStock !== keep) out.note = 'stock not changed — scan serials in with 📥 Restock';
            out.newStock = keep;
        }
        if (out.errors.length) out.action = 'error';
        return out;
    });
}
function renderImportPreview() {
    const plan = planImport();
    const n = plan.filter(x => x.action === 'new').length, u = plan.filter(x => x.action === 'update').length, e = plan.filter(x => x.action === 'error').length;
    const maxP = Number((S.tenantInfo.limits || {}).maxProducts) || 0;
    const over = maxP && S.products.length + n > maxP;
    $('impCounts').innerHTML = `
        <div><b style="color:var(--pos);">${n}</b><small>New items</small></div>
        <div style="background:#eff6ff;"><b style="color:var(--blue);">${u}</b><small>Updated</small></div>
        <div style="background:${e ? '#fff5f5' : '#f8fafc'};"><b style="color:${e ? 'var(--red)' : 'var(--gray)'};">${e}</b><small>With problems</small></div>`;
    $('impWarn').innerHTML = over ? `<div class="hint amber">⚠️ Your plan allows ${maxP} items. You have ${S.products.length}, so only ${Math.max(0, maxP - S.products.length)} new items will be added.</div>` : '';
    const chip = x => x.action === 'new' ? '<span class="tag tag-closed" style="margin:0;">NEW</span>' : x.action === 'update' ? '<span class="tag tag-prog" style="margin:0;">UPDATE</span>' : '<span class="tag" style="margin:0;background:#fee2e2;color:#991b1b;">FIX</span>';
    const order = { error: 0, new: 1, update: 2 };
    const list = [...plan].sort((a, b) => order[a.action] - order[b.action] || a.line - b.line);
    const sell = x => x.sellPrice === null ? (x.match ? '<small>keep</small>' : '—') : (x.match && x.keepPrices ? `<span class="was">${n0(x.sellPrice)}</span>${n0(x.match.sellPrice)}` : n0(x.sellPrice));
    $('impRows').innerHTML = list.slice(0, 400).map(x => `
        <tr class="${x.action === 'error' ? 'err' : ''}">
            <td>${chip(x)}</td>
            <td>${esc(x.emoji || (x.match && x.match.emoji) || '')} ${esc(x.name || '(no name)')}<small>${x.action === 'error' ? '⚠️ line ' + x.line + ': ' + esc(x.errors.join(', ')) : esc(x.category || (x.match && x.match.category) || 'General')}${x.barcode ? ' · ' + esc(x.barcode) : ''}</small></td>
            <td class="n">${sell(x)}</td>
            <td class="n">${x.cost === null ? '<small>—</small>' : n0(x.cost)}</td>
            <td class="n">${x.action === 'update' && x.newStock !== x.oldStock ? `<span class="was">${q3(x.oldStock)}</span>` : ''}${x.action === 'error' ? '' : q3(x.newStock)}${x.action !== 'error' && (x.unit || (x.match && unitOf(x.match))) && (x.unit || unitOf(x.match)) !== 'pc' ? ' ' + (UNITS.find(u => u[0] === (x.unit || unitOf(x.match))) || [, , ''])[2] : ''}${x.trackSerial ? '<small>🔢 serial</small>' : ''}${x.note ? '<small style="color:var(--amber);">' + esc(x.note) + '</small>' : ''}${x.warrantyMonths ? '<small>🛡️ ' + x.warrantyMonths + 'm</small>' : ''}</td>
        </tr>`).join('') + (list.length > 400 ? `<tr><td colspan="5" style="text-align:center;color:var(--gray);">…and ${list.length - 400} more rows</td></tr>` : '');
    const ok = n + u;
    $('impBtn').disabled = !ok;
    $('impBtn').textContent = ok ? `✅ IMPORT ${ok} ITEM${ok > 1 ? 'S' : ''}${e ? ` · SKIP ${e}` : ''}` : 'NOTHING TO IMPORT';
}

async function runImport() {
    let plan = planImport().filter(x => x.action !== 'error');
    const maxP = Number((S.tenantInfo.limits || {}).maxProducts) || 0;
    if (maxP) {
        let room = Math.max(0, maxP - usedItems());
        plan = plan.filter(x => x.action === 'update' || room-- > 0);
    }
    if (!plan.length) return toast('Nothing to import.', 'err');
    if (!navigator.onLine) return toast('⚠️ Importing from Excel needs internet.', 'err');
    const day = dayStr(), mode = $('impMode').value;
    loader(true, 'IMPORTING...');
    let added = 0, updated = 0;
    try {
        for (let i = 0; i < plan.length; i += 150) {               // 3 writes per item, max 500 per batch
            const b = db.batch(), newIds = [];
            plan.slice(i, i + 150).forEach(x => {
                const ref = x.match ? col('products').doc(x.match.id) : col('products').doc();
                const d = { updatedAt: now() };
                if (!x.match) {
                    Object.assign(d, { name: x.name, category: x.category || 'General', sellPrice: x.sellPrice, stock: x.newStock,
                        reorderLevel: x.reorderLevel !== null ? q3(x.reorderLevel) : 5, barcode: x.barcode || '', emoji: x.emoji || '📦',
                        unit: x.unit || 'pc', partQty: x.partQty ?? PART_UNITS.includes(x.unit || 'pc'), packSize: Math.round(x.packSize || 0),
                        warrantyMonths: Math.round(x.warrantyMonths || 0), trackSerial: !!x.trackSerial, expiry: x.expiry || '' });
                    added++; newIds.push(ref.id);
                } else {
                    if (x.category) d.category = x.category;
                    if (x.sellPrice !== null && !x.keepPrices) d.sellPrice = x.sellPrice;
                    if (x.reorderLevel !== null) d.reorderLevel = q3(x.reorderLevel);
                    if (x.unit) d.unit = x.unit;
                    if (x.partQty !== null) d.partQty = x.partQty;
                    if (x.packSize !== null) d.packSize = Math.round(x.packSize);
                    if (x.warrantyMonths !== null) d.warrantyMonths = Math.round(x.warrantyMonths);
                    if (x.trackSerial !== null) d.trackSerial = x.trackSerial;
                    if (x.expiry) d.expiry = x.expiry;
                    if (x.barcode) d.barcode = x.barcode;
                    if (x.emoji) d.emoji = x.emoji;
                    if (x.newStock !== x.oldStock) d.stock = x.newStock;
                    updated++;
                }
                b.set(ref, d, { merge: true });
                if (x.cost !== null && !(x.match && x.keepPrices) && (!x.match || Math.round(x.cost) !== (Number(S.costs[ref.id]) || 0))) costTyped(b, ref.id, x.cost);
                const before = x.match ? x.oldStock : 0;
                if (x.newStock !== before) b.set(col('movements').doc(), {
                    productId: ref.id, name: x.name, type: x.match ? (mode === 'add' ? 'restock' : 'stocktake') : 'opening', qty: x.newStock - before,
                    before, after: x.newStock, source: 'excel', day, staffUid: S.me.uid, staffName: S.me.name, createdAt: now()
                });
            });
            if (S.usage && newIds.length) b.update(usageRef(), Object.fromEntries([...newIds.map(k => ['products.' + k, true]), ['updatedAt', now()]]));
            await commit(b);
        }
        closeModals();
        toast(`✅ ${added} added · ${updated} updated`);
    } catch (e) { toast('⚠️ Import stopped: ' + friendlyErr(e), 'err'); }
    finally { loader(false); }
}

// ════════════════════════════════════════════════
