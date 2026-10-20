// Keep till — Reports centre: every report as PDF or Excel.
// Part of app/index.html; the parts load in order and share one global scope.
//  REPORTS CENTRE — every report as PDF or Excel, for any period
// ════════════════════════════════════════════════
const RP = { from: null, to: null, preset: 'month' };
const REPORTS = [
    { g: 'Sales', id: 'salesList', icon: '🧾', t: 'Sales list', d: 'Every sale with seller, items, payment and status' },
    { g: 'Sales', id: 'salesItems', icon: '📦', t: 'Sales by item', d: 'Quantity, revenue, cost and profit per item' },
    { g: 'Sales', id: 'salesDaily', icon: '📅', t: 'Daily sales summary', d: 'Day-by-day sales, cash, mobile, credit' },
    { g: 'Sales', id: 'salesStaff', icon: '👤', t: 'Sales by seller', d: 'How much each seller sold' },
    { g: 'Sales', id: 'returns', icon: '↩️', t: 'Returns & voids', d: 'Refunds given and cancelled sales' },
    { g: 'Money', id: 'pnl', icon: '📈', t: 'Profit & loss', d: 'Sales, stock bought, expenses and profit' },
    { g: 'Money', id: 'expenses', icon: '💸', t: 'Expenses', d: 'All expenses by category, with who recorded them' },
    { g: 'Money', id: 'banking', icon: '🏦', t: 'Banking, transfers & savings', d: 'Money moved between cash, mobile, bank and savings' },
    { g: 'Money', id: 'cashups', icon: '🧮', t: 'Cash-ups', d: 'Each seller\'s counts, shortages and overs' },
    { g: 'Stock', id: 'stockList', icon: '🏷️', t: 'Stock list & value', d: 'Every item with stock, cost, price and value', now: true },
    { g: 'Stock', id: 'reorder', icon: '⚠️', t: 'Low & out of stock', d: 'What to buy next', now: true },
    { g: 'Stock', id: 'expiry', icon: '⏳', t: 'Expiry dates', d: 'Expired items and items expiring soon', now: true },
    { g: 'Stock', id: 'stocking', icon: '🚚', t: 'Stock received', d: 'Deliveries and restocks with what was paid' },
    { g: 'Stock', id: 'movements', icon: '🔁', t: 'Stock movements', d: 'Restocks, counts, edits and returns' },
    { g: 'Stock', id: 'serials', icon: '🔢', t: 'Serial / IMEI register', d: 'Every serial: in stock, sold, warranty', now: true },
    { g: 'Customers', id: 'customers', icon: '👥', t: 'Customer register', d: 'All customers with phone, balance and purchases', now: true },
    { g: 'Customers', id: 'debtors', icon: '📒', t: 'Customers who owe', d: 'Debts to collect, biggest first', now: true }
];
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function rpPreset(p) {
    const t = new Date(dayStr() + 'T12:00:00'), y = t.getFullYear(), m = t.getMonth();
    const R = {
        today: [t, t], yesterday: [new Date(t - 864e5), new Date(t - 864e5)],
        week: [new Date(t - ((t.getDay() + 6) % 7) * 864e5), t], month: [new Date(y, m, 1), t],
        lastmonth: [new Date(y, m - 1, 1), new Date(y, m, 0)], year: [new Date(y, 0, 1), t]
    }[p];
    RP.preset = p;
    if (R) { RP.from = isoDay(R[0]); RP.to = isoDay(R[1]); $('rpFrom').value = RP.from; $('rpTo').value = RP.to; }
    renderReports();
}
function rpCustom() { RP.preset = 'custom'; RP.from = $('rpFrom').value; RP.to = $('rpTo').value; if (RP.from > RP.to) [RP.from, RP.to] = [RP.to, RP.from]; renderReports(); }
const rpPeriodText = () => RP.from === RP.to ? prettyDay(RP.from) : `${new Date(RP.from + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(RP.to + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
function openReports() { openSheet('sheetReports'); if (!RP.from) rpPreset('month'); else renderReports(); }
// A barbershop sees the reports that fit it, in its own words
const BARBER_REPORTS = {
    salesList: ['Clients list', 'Every client with services, barber and payment'],
    salesItems: ['By service', 'How many of each service, and the money'],
    salesDaily: ['Daily summary', 'Day-by-day money, cash and mobile'],
    returns: ['Cancelled', 'Cancelled sales and refunds'],
    pnl: ['Profit & loss', 'Money in, supplies, expenses and profit'],
    expenses: null, banking: null,
    cashups: ['Cash-ups', "Each person's counts, shortages and overs"],
    stockList: ['Products in stock', 'Products you sell, with stock and value']
};
const reportsShown = () => isBarberMode()
    ? REPORTS.filter(r => r.id in BARBER_REPORTS && (r.id !== 'stockList' || S.products.some(p => !isService(p))))
        .map(r => BARBER_REPORTS[r.id] ? { ...r, t: BARBER_REPORTS[r.id][0], d: BARBER_REPORTS[r.id][1], g: r.g === 'Sales' ? 'Clients' : r.g === 'Stock' ? 'Products' : r.g } : r)
    : REPORTS;
function renderReports() {
    document.querySelectorAll('#rpPresets button').forEach(b => b.classList.toggle('on', b.dataset.p === RP.preset));
    $('rpPeriod').textContent = rpPeriodText();
    let g = '';
    $('rpList').innerHTML = reportsShown().map(r => (r.g !== g ? `<span class="section-label" style="margin-top:12px;">${(g = r.g)}</span>` : '') + `
        <div class="rp-card"><div class="rp-ic">${r.icon}</div>
            <div class="rp-tx"><b>${r.t}</b><small>${r.d}${r.now ? ' · <i>as of now</i>' : ''}</small></div>
            <div class="rp-btns"><button data-r="${r.id}" data-f="pdf" onclick="runReport(this.dataset.r,this.dataset.f)">PDF</button><button class="xl" data-r="${r.id}" data-f="xlsx" onclick="runReport(this.dataset.r,this.dataset.f)">Excel</button></div>
        </div>`).join('') + `<span class="section-label" style="margin-top:12px;">Monthly</span>
        <div class="rp-card" onclick="openReport()" style="cursor:pointer;"><div class="rp-ic">🗓️</div><div class="rp-tx"><b>Monthly report (detailed)</b><small>The month at a glance with top sellers</small></div><div class="rp-btns"><button>Open</button></div></div>`;
}
// ── data ──
const rpRange = c => col(c).where('day', '>=', RP.from).where('day', '<=', RP.to).get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
const dt = x => tms(x) ? new Date(tms(x)) : null;
const dDay = x => x ? new Date(x + 'T12:00').toLocaleDateString('en-GB') : '';
const dTime = x => dt(x) ? dt(x).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const catName = c => ((EXPENSE_CATS.find(x => x[0] === c) || [, c || 'Other'])[1] || '').replace(/^\S+\s/, '');
async function buildReport(id) {
    const r = { title: reportsShown().concat(REPORTS).find(x => x.id === id).t, summary: [], tables: [] };
    const T = (name, head, rows, foot) => r.tables.push({ name, head, rows, foot });
    if (['salesList', 'salesItems', 'salesStaff', 'returns', 'pnl'].includes(id)) {
        const sales = (await rpRange('sales')).sort((a, b) => (tms(a.createdAt) || 0) - (tms(b.createdAt) || 0));
        const ok = sales.filter(s => !s.voided), real = ok.filter(s => s.kind !== 'repay');
        if (id === 'salesList') {
            r.summary = [['Sales', ok.filter(s => s.kind === 'pos' || s.kind === 'manual').length], ['Total sold', sum(real, s => s.kind === 'return' ? -s.total : s.total)], ['Cash', sum(real, s => s.cash)], ['Lipa kwa Simu', sum(real, s => s.mobile)], ['On credit', sum(real, s => s.credit)], ['Discounts', sum(real, s => s.discount)], ['Voided', sales.filter(s => s.voided).length]];
            T('Sales', ['Date', 'Time', 'Receipt', 'Seller', 'Type', 'Items', 'Customer', 'Total', 'Cash', 'Mobile', 'Credit', 'Discount', 'Status'],
                sales.map(s => [dDay(s.day), dTime(s.createdAt), s.receiptNo || '', s.staffName || '', { pos: 'Sale', manual: 'Manual', repay: 'Debt payment', return: 'Return' }[s.kind] || s.kind,
                    (s.items || []).map(i => `${q3(i.qty)}×${i.name}`).join(', ') || s.note || '', (s.customer || {}).name || '', s.kind === 'return' ? -s.total : s.total, s.cash || 0, s.mobile || 0, s.credit || 0, s.discount || 0,
                    s.voided ? 'VOIDED' : s.returnedTotal ? 'Part returned' : '']));
        }
        if (id === 'salesItems' || id === 'pnl') {
            const t = itemTotals(ok.filter(s => s.kind === 'pos' || s.kind === 'return'));
            if (id === 'salesItems') {
                r.summary = [['Items sold', t.length], ['Revenue', sum(t, x => x.revenue)], ['Cost of goods (est.)', sum(t, x => x.cogs)], ['Gross profit (est.)', sum(t, x => x.revenue - x.cogs)]];
                T('By item', ['Item', 'Qty', 'Revenue', 'Cost (est.)', 'Profit (est.)', 'Margin %'], t.map(x => [x.name, q3(x.qty), Math.round(x.revenue), Math.round(x.cogs), Math.round(x.revenue - x.cogs), x.revenue ? Math.round((x.revenue - x.cogs) / x.revenue * 1000) / 10 : 0]),
                    ['TOTAL', '', Math.round(sum(t, x => x.revenue)), Math.round(sum(t, x => x.cogs)), Math.round(sum(t, x => x.revenue - x.cogs)), '']);
                r.note = 'Cost uses each item\'s current cost price. Daily totals entered as manual sales have no items and are not included.';
            } else r._items = t;
        }
        if (id === 'salesStaff') {
            const by = {};
            ok.forEach(s => { const k = s.staffName || '—', o = by[k] = by[k] || { n: 0, total: 0, cash: 0, mobile: 0, credit: 0, disc: 0, ret: 0, repay: 0 };
                if (s.kind === 'pos' || s.kind === 'manual') { o.n++; o.total += s.total; o.credit += s.credit || 0; o.disc += s.discount || 0; }
                if (s.kind === 'return') o.ret += s.total; if (s.kind === 'repay') o.repay += s.total;
                o.cash += s.cash || 0; o.mobile += s.mobile || 0; });
            const rows = Object.entries(by).sort((a, b) => b[1].total - a[1].total);
            r.summary = [['Sellers', rows.length], ['Total sold', sum(rows, x => x[1].total)]];
            T('By seller', ['Seller', 'Sales', 'Sold', 'Cash taken', 'Mobile taken', 'On credit', 'Discounts', 'Refunds', 'Debts collected'], rows.map(([k, o]) => [k, o.n, o.total, o.cash, o.mobile, o.credit, o.disc, o.ret, o.repay]));
        }
        if (id === 'returns') {
            const rets = sales.filter(s => s.kind === 'return'), voids = sales.filter(s => s.voided);
            r.summary = [['Returns', rets.length], ['Refunded', sum(rets, s => s.total)], ['Voided sales', voids.length], ['Voided value', sum(voids, s => s.total)]];
            T('Returns', ['Date', 'Return no.', 'Of receipt', 'Seller', 'Items', 'Reason', 'Refund', 'Cash back', 'Mobile back', 'Off debt'],
                rets.map(s => [dDay(s.day), s.receiptNo, s.refReceipt || '', s.staffName, (s.items || []).map(i => `${q3(i.qty)}×${i.name}${i.restock ? '' : ' (damaged)'}`).join(', '), s.reason || '', s.total, -(s.cash || 0), -(s.mobile || 0), -(s.credit || 0)]));
            T('Voided', ['Date', 'Receipt', 'Sold by', 'Voided by', 'Type', 'Total'], voids.map(s => [dDay(s.day), s.receiptNo || '', s.staffName, s.voidedBy || '', s.kind, s.total]));
        }
        if (id !== 'pnl') return r;
    }
    if (id === 'pnl' || id === 'salesDaily') {
        const days = (await rpRange('days')).sort((a, b) => a.id.localeCompare(b.id));
        const f = k => sum(days, d => d[k]);
        if (id === 'salesDaily') {
            r.summary = [['Days with sales', days.filter(d => d.sales).length], ['Sales', f('sales')], ['Cash', f('cash')], ['Lipa kwa Simu', f('mobile')], ['On credit', f('credit')], ['Average per day', Math.round(f('sales') / Math.max(1, days.filter(d => d.sales).length))]];
            T('Daily', ['Date', 'Sales', 'Cash', 'Mobile', 'Credit', 'Discounts', 'Returns', 'Debts collected', 'Transactions'], days.map(d => [dDay(d.id), d.sales || 0, d.cash || 0, d.mobile || 0, d.credit || 0, d.discount || 0, d.returns || 0, d.debtPaid || 0, d.txCount || 0]),
                ['TOTAL', f('sales'), f('cash'), f('mobile'), f('credit'), f('discount'), f('returns'), f('debtPaid'), f('txCount')]);
            return r;
        }
        const ents = await rpRange('entries'), exp = ents.filter(e => e.type === 'expense' && e.category !== 'Supplier');
        const byCat = {}; exp.forEach(e => byCat[e.category || 'Other'] = (byCat[e.category || 'Other'] || 0) + e.amount);
        const items = r._items || [], cogs = sum(items, x => x.cogs); delete r._items;
        if (isBarberMode()) {
            const cut = barberCut(await rpRange('sales'), ents);
            const other = f('expense') - cut.paidOut, profit = f('sales') - f('supplier') - other - cut.cost;
            r.summary = [['Money in', f('sales')], ['Barbers earned', cut.cost], ['Supplies bought', f('supplier')], ['Other expenses', other], ['Profit (money in - barbers - supplies - expenses)', profit],
                ['Margin', f('sales') ? (profit / f('sales') * 100).toFixed(1) + '%' : '—'], ['Banked (net)', f('bankIn') - f('bankOut')], ['Moved to savings', f('toSavings')]];
            T('Profit & loss', ['Line', 'TZS'], [['Money in', f('sales')], ['  of which cash', f('cash')], ['  of which Lipa kwa Simu', f('mobile')], ['Barbers earned', -cut.cost], ['Supplies bought', -f('supplier')],
                ...Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ['Expense: ' + catName(c), -v]), ['  less: barber pay already counted above', cut.paidOut], ['PROFIT', profit]]);
            r.note = 'Barbers paid per service, by percentage or chair rent are counted the day they work; paying them later is not counted twice. Salaries count as expenses when paid.';
            return r;
        }
        const profit = f('sales') - f('supplier') - f('expense');
        r.summary = [['Sales', f('sales')], ['Stock bought', f('supplier')], ['Expenses', f('expense')], ['Profit (sales - stock bought - expenses)', profit], ['Margin', f('sales') ? (profit / f('sales') * 100).toFixed(1) + '%' : '—'],
            ['Gross profit on items sold (est.)', Math.round(sum(items, x => x.revenue) - cogs)], ['Banked (net)', f('bankIn') - f('bankOut')], ['Moved to savings', f('toSavings')]];
        T('Profit & loss', ['Line', 'TZS'], [['Sales', f('sales')], ['  of which cash', f('cash')], ['  of which Lipa kwa Simu', f('mobile')], ['  sold on credit', f('credit')], ['  discounts given', f('discount')], ['  returns refunded', f('returns')], ['Debts collected', f('debtPaid')],
            ['Stock bought', -f('supplier')], ...Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ['Expense: ' + catName(c), -v]), ['PROFIT', profit]]);
        T('By day', ['Date', 'Sales', 'Stock bought', 'Expenses', 'Profit', 'Banked'], days.map(d => [dDay(d.id), d.sales || 0, d.supplier || 0, d.expense || 0, (d.sales || 0) - (d.supplier || 0) - (d.expense || 0), (d.bankIn || 0) - (d.bankOut || 0)]));
        r.note = '"Profit" counts stock when it is bought. "Gross profit on items sold" uses current cost prices of what was sold.';
        return r;
    }
    if (id === 'expenses' || id === 'banking') {
        const ents = (await rpRange('entries')).sort((a, b) => a.day.localeCompare(b.day) || (tms(a.createdAt) || 0) - (tms(b.createdAt) || 0));
        if (id === 'expenses') {
            const exp = ents.filter(e => e.type === 'expense'), by = {};
            exp.forEach(e => by[e.category || 'Other'] = (by[e.category || 'Other'] || 0) + e.amount);
            r.summary = [['Expenses recorded', exp.length], ['Total', sum(exp, e => e.amount)], ...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => [catName(c), v])];
            T('By category', ['Category', 'Count', 'Total'], Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) => [catName(c), exp.filter(e => (e.category || 'Other') === c).length, v]), ['TOTAL', exp.length, sum(exp, e => e.amount)]);
            T('All expenses', ['Date', 'Category', 'Note', 'Paid from', 'Recorded by', 'Amount'], exp.map(e => [dDay(e.day), catName(e.category), e.note || '', (ACCT[e.from] || e.from || '').replace(/^\S+\s/, ''), e.staffName || '', e.amount]));
        } else {
            const mv = ents.filter(e => e.type !== 'expense'), lbl = { banking: 'Banked', withdrawal: 'Withdrawn', transfer: 'Transfer', savings: 'To savings', adjust: 'Balance fix' };
            const tot = t => sum(mv.filter(e => e.type === t), e => e.amount);
            r.summary = [['Banked', tot('banking')], ['Withdrawn from bank', tot('withdrawal')], ['Transfers', tot('transfer')], ['Moved to savings', tot('savings')], ['Balance fixes', mv.filter(e => e.type === 'adjust').length]];
            T('Money movements', ['Date', 'Type', 'From', 'To', 'Note', 'Recorded by', 'Amount'], mv.map(e => [dDay(e.day), lbl[e.type] || e.type, (ACCT[e.from] || e.from || '—').replace(/^\S+\s/, ''), (ACCT[e.to] || e.to || '—').replace(/^\S+\s/, ''), e.note || '', e.staffName || '', e.amount]));
        }
        return r;
    }
    if (id === 'cashups') {
        const cu = (await rpRange('cashups')).sort((a, b) => (tms(a.createdAt) || 0) - (tms(b.createdAt) || 0));
        const done = cu.filter(c => c.status === 'confirmed');
        r.summary = [['Cash-ups', cu.length], ['Not checked yet', cu.length - done.length], ['Total short', -sum(done, c => Math.min(0, c.diffCash || 0))], ['Total over', sum(done, c => Math.max(0, c.diffCash || 0))]];
        T('Cash-ups', ['Date', 'Time', 'Seller', 'Sales', 'Counted cash', 'Paid out', 'Expected', 'Difference', 'Status', 'Checked by', 'Note'],
            cu.map(c => [dDay(c.day), dTime(c.createdAt), c.staffName, c.salesCount || 0, c.countedCash, c.paidOutTotal || 0, c.status === 'confirmed' ? (c.expectedCash || 0) - (c.paidOutTotal || 0) : '', c.status === 'confirmed' ? Math.round(c.diffCash || 0) : '', c.status === 'confirmed' ? 'Checked' : 'Waiting', c.reviewedBy || '', [c.note, c.ownerNote].filter(Boolean).join(' / ')]));
        return r;
    }
    if (id === 'stockList' || id === 'reorder') {
        const P = S.products.filter(p => !isService(p)).sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
        const st = p => (Number(p.stock) || 0) <= 0 ? 'Out of stock' : (Number(p.stock) || 0) <= (Number(p.reorderLevel) || 5) ? 'Low' : 'OK';
        if (id === 'stockList') {
            r.summary = [['Items', P.length], ['Units in stock', q3(sum(P, p => Math.max(0, p.stock)))], ['Value at cost', Math.round(sum(P, p => Math.max(0, p.stock) * (S.costs[p.id] || 0)))], ['Value at selling price', Math.round(sum(P, p => Math.max(0, p.stock) * (p.sellPrice || 0)))], ['Low', P.filter(p => st(p) === 'Low').length], ['Out of stock', P.filter(p => st(p) === 'Out of stock').length]];
            T('Stock', ['Item', 'Category', 'Unit', 'Barcode', 'In stock', 'Cost', 'Price', 'Value at cost', 'Value at price', 'Status'],
                P.map(p => [p.name, p.category || '', unitOf(p), p.barcode || '', q3(p.stock || 0), S.costs[p.id] || 0, p.sellPrice || 0, Math.round(Math.max(0, p.stock) * (S.costs[p.id] || 0)), Math.round(Math.max(0, p.stock) * (p.sellPrice || 0)), st(p)]));
        } else {
            const L = P.filter(p => st(p) !== 'OK').sort((a, b) => (a.stock || 0) - (b.stock || 0));
            r.summary = [['Out of stock', L.filter(p => st(p) === 'Out of stock').length], ['Low', L.filter(p => st(p) === 'Low').length], ['Cost to restock to 2× reorder level (est.)', Math.round(sum(L, p => Math.max(0, 2 * (Number(p.reorderLevel) || 5) - Math.max(0, p.stock)) * (S.costs[p.id] || 0)))]];
            T('Reorder list', ['Item', 'Category', 'In stock', 'Reorder at', 'Suggested order', 'Cost each', 'Status'], L.map(p => [p.name, p.category || '', q3(p.stock || 0), Number(p.reorderLevel) || 5, Math.max(0, 2 * (Number(p.reorderLevel) || 5) - Math.max(0, Number(p.stock) || 0)), S.costs[p.id] || 0, st(p)]));
        }
        return r;
    }
    if (id === 'expiry') {
        const L = S.products.map(p => ({ p, d: daysToExpiry(p) })).filter(x => x.d !== null).sort((a, b) => a.d - b.d);
        const st = d => d < 0 ? 'Expired' : d <= EXPIRY_WARN_DAYS ? 'Expiring soon' : 'OK';
        r.summary = [['Expired', L.filter(x => x.d < 0).length], ['Expiring within 30 days', L.filter(x => x.d >= 0 && x.d <= EXPIRY_WARN_DAYS).length],
            ['Value at cost (expired + expiring)', Math.round(sum(L.filter(x => x.d <= EXPIRY_WARN_DAYS), x => Math.max(0, x.p.stock) * (S.costs[x.p.id] || 0)))]];
        T('Expiry dates', ['Item', 'Category', 'In stock', 'Expiry date', 'Days left', 'Value at cost', 'Status'],
            L.map(({ p, d }) => [p.name, p.category || '', q3(p.stock || 0), p.expiry, d, Math.round(Math.max(0, p.stock) * (S.costs[p.id] || 0)), st(d)]));
        return r;
    }
    if (id === 'stocking' || id === 'movements') {
        const mv = (await rpRange('movements')).sort((a, b) => (tms(a.createdAt) || 0) - (tms(b.createdAt) || 0));
        if (id === 'stocking') {
            const [rec, ents] = await Promise.all([rpRange('receipts'), rpRange('entries')]);
            const rs = mv.filter(m => m.type === 'restock' || m.type === 'opening'), recById = Object.fromEntries(rec.map(d => [d.id, d]));
            const paid = ents.filter(e => e.type === 'expense' && e.category === 'Supplier');
            r.summary = [['Deliveries', rec.length], ['Restock lines', rs.length], ['Paid for stock (recorded)', sum(paid, e => e.amount)], ['Deliveries waiting for owner', rec.filter(d => d.status === 'pending').length]];
            T('Items received', ['Date', 'Item', 'Qty', 'Paid each', 'Line total', 'Supplier', 'Delivery', 'Received by'], rs.map(m => { const d = recById[m.deliveryId] || {}, it = (d.items || []).find(i => i.productId === m.productId) || {};
                const each = m.unitCost ?? it.unitCost ?? null; return [dDay(m.day), m.name, q3(m.qty), each ?? '', each == null ? '' : Math.round(each * m.qty), d.supplier || '', d.receiptNo || '', m.staffName || '']; }));
            T('Deliveries', ['Date', 'Delivery', 'Supplier', 'Received by', 'Items', 'Total', 'Paid how', 'Status'], rec.sort((a, b) => a.day.localeCompare(b.day)).map(d => [dDay(d.day), d.receiptNo, d.supplier || '', d.staffName, d.items.length, d.total, (PAID_LABEL[d.paidFrom] || d.paidFrom || '').replace(/^\S+\s/, ''), d.status === 'pending' ? 'Waiting' : 'Checked']));
            T('Payments for stock', ['Date', 'Note', 'Paid from', 'Recorded by', 'Amount'], paid.map(e => [dDay(e.day), e.note || '', (ACCT[e.from] || e.from || '').replace(/^\S+\s/, ''), e.staffName || '', e.amount]));
        } else {
            const lbl = { restock: 'Received', stocktake: 'Count', edit: 'Edited', opening: 'Opening stock', return: 'Returned' };
            r.summary = [['Movements', mv.length], ...Object.entries(lbl).map(([k, v]) => [v, mv.filter(m => m.type === k).length]).filter(x => x[1])];
            T('Movements', ['Date', 'Time', 'Item', 'Type', 'Change', 'Before', 'After', 'By'], mv.map(m => [dDay(m.day), dTime(m.createdAt), m.name, lbl[m.type] || m.type, q3(m.qty), m.before ?? '', m.after ?? '', m.staffName || '']));
        }
        return r;
    }
    if (id === 'serials') {
        const all = (await col('serials').get()).docs.map(d => d.data()).sort((a, b) => (a.name || '').localeCompare(b.name || '') || (a.status || '').localeCompare(b.status || ''));
        r.summary = [['Serials', all.length], ['On the shelf', all.filter(x => x.status === 'in').length], ['Sold', all.filter(x => x.status === 'sold').length], ['Damaged', all.filter(x => x.status === 'damaged').length]];
        T('Serials', ['Serial / IMEI', 'Item', 'Status', 'Received', 'Received by', 'Sold', 'Sold by', 'Customer'], all.map(x => [x.serial, x.name, { in: 'On shelf', sold: 'Sold', damaged: 'Damaged' }[x.status] || x.status, dt(x.receivedAt) ? dt(x.receivedAt).toLocaleDateString('en-GB') : '', x.receivedBy || '', dt(x.soldAt) ? dt(x.soldAt).toLocaleDateString('en-GB') : '', x.soldBy || '', x.customerName || '']));
        return r;
    }
    if (id === 'customers' || id === 'debtors') {
        let cs = (await col('customers').get()).docs.map(d => d.data());
        if (id === 'debtors') cs = cs.filter(c => (c.balance || 0) > 0).sort((a, b) => b.balance - a.balance); else cs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        r.summary = id === 'debtors' ? [['Customers who owe', cs.length], ['Total owed', sum(cs, c => c.balance)]] : [['Customers', cs.length], ['Owe the shop', cs.filter(c => (c.balance || 0) > 0).length], ['Total owed', sum(cs.filter(c => c.balance > 0), c => c.balance)], ['Total bought', sum(cs, c => c.totalBought)]];
        T(id === 'debtors' ? 'Debtors' : 'Customers', ['Name', 'Phone', 'Owes', 'Total bought', 'Last purchase', 'Added', 'Added by'],
            cs.map(c => [c.name, c.phone ? prettyPhone(c.phone) : '', Math.round(c.balance || 0), Math.round(c.totalBought || 0), dt(c.lastSaleAt) ? dt(c.lastSaleAt).toLocaleDateString('en-GB') : '', dt(c.createdAt) ? dt(c.createdAt).toLocaleDateString('en-GB') : '', c.createdBy || '']),
            id === 'debtors' ? ['TOTAL', '', Math.round(sum(cs, c => c.balance)), '', '', '', ''] : null);
        return r;
    }
    return r;
}
// ── output ──
async function runReport(id, fmtType) {
    const def = reportsShown().concat(REPORTS).find(x => x.id === id);
    if (!navigator.onLine && !def.now) return toast('⚠️ Reports for a period need internet.', 'err');
    loader(true, 'PREPARING REPORT...');
    try {
        const r = await buildReport(id);
        const shop = S.tenantInfo.name || S.tenant, period = def.now ? 'As of ' + new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : rpPeriodText();
        const base = `${shop}_${r.title}_${def.now ? dayStr() : RP.from + (RP.from === RP.to ? '' : '_to_' + RP.to)}`.replace(/[^\w\-]+/g, '_');
        loader(false);
        if (fmtType === 'xlsx') await reportXlsx(r, shop, period, base); else await reportPdf(r, shop, period, base);
    } catch (e) { loader(false); console.error(e); toast('⚠️ Could not make the report: ' + friendlyErr(e), 'err'); }
}
const money = v => typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 2 })) : v;
async function reportPdf(r, shop, period, base) {
    if (!window.jspdf) return toast('PDF tool did not load — check your connection.', 'err');
    const wide = r.tables.some(t => t.head.length > 6), { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: wide ? 'landscape' : 'portrait' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(11, 13, 18); doc.rect(0, 0, W, 26, 'F');
    doc.setTextColor(255, 199, 44); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(String(shop).toUpperCase(), 12, 11);
    doc.setTextColor(255); doc.setFontSize(10.5); doc.text(r.title.toUpperCase(), 12, 19);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(period, W - 12, 11, { align: 'right' }); doc.text('Generated ' + new Date().toLocaleString('en-GB'), W - 12, 19, { align: 'right' });
    let y = 32;
    if (r.summary.length) {
        doc.autoTable({ startY: y, body: r.summary.map(([k, v]) => [k, money(v)]), theme: 'plain', styles: { fontSize: 9, cellPadding: 1.4 },
            columnStyles: { 0: { textColor: [100, 110, 125] }, 1: { fontStyle: 'bold', halign: 'right' } }, tableWidth: Math.min(120, W - 24), margin: { left: 12 } });
        y = doc.lastAutoTable.finalY + 4;
    }
    if (r.note) { doc.setFontSize(7.5); doc.setTextColor(120); doc.text(doc.splitTextToSize(r.note, W - 24), 12, y + 2); y += 8; }
    r.tables.forEach(t => {
        if (!t.rows.length) return;
        doc.setFontSize(10); doc.setTextColor(26, 86, 219); doc.setFont('helvetica', 'bold');
        if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 14; }
        doc.text(t.name, 12, y + 4);
        const numCols = t.head.map((_, i) => t.rows.some(rw => typeof rw[i] === 'number'));
        doc.autoTable({ startY: y + 6, head: [t.head], body: t.rows.map(rw => rw.map(money)), foot: t.foot ? [t.foot.map(money)] : undefined, theme: 'striped', margin: { left: 12, right: 12 },
            headStyles: { fillColor: [11, 13, 18], textColor: [255, 199, 44], fontSize: 7.5 }, footStyles: { fillColor: [255, 199, 44], textColor: 20, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 1.5, overflow: 'linebreak' }, columnStyles: Object.fromEntries(numCols.map((n, i) => [i, n ? { halign: 'right' } : {}]).filter(x => x[1].halign)),
            didParseCell: c => { if ((c.section === 'body' || c.section === 'foot') && numCols[c.column.index]) c.cell.styles.halign = 'right'; } });
        y = doc.lastAutoTable.finalY + 8;
    });
    if (!r.tables.some(t => t.rows.length)) { doc.setFontSize(10); doc.setTextColor(120); doc.text('Nothing recorded in this period.', 12, y + 6); }
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150); doc.text(`Keep POS · ${shop} · page ${i} of ${n}`, W / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' }); }
    await shareOrSave(doc.output('blob'), base + '.pdf', 'application/pdf', `${r.title} — ${shop} (${period})`);
}
async function reportXlsx(r, shop, period, base) {
    const X = await needXLSX(), wb = X.utils.book_new();
    const sumRows = [[String(shop).toUpperCase()], [r.title], [period], [], ...r.summary.map(([k, v]) => [k, v])];
    if (r.note) sumRows.push([], [r.note]);
    const ws0 = X.utils.aoa_to_sheet(sumRows); ws0['!cols'] = [{ wch: 42 }, { wch: 18 }]; X.utils.book_append_sheet(wb, ws0, 'Summary');
    r.tables.forEach(t => {
        // dd/mm/yyyy text → real Excel dates, so they sort and filter properly
        const asDate = v => { const m = typeof v === 'string' && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : v; };
        const ws = X.utils.aoa_to_sheet([t.head, ...t.rows.map(rw => rw.map(asDate)), ...(t.foot ? [t.foot] : [])], { cellDates: true, dateNF: 'dd/mm/yyyy' });
        ws['!cols'] = t.head.map((h, i) => ({ wch: Math.min(48, Math.max(String(h).length + 2, ...t.rows.slice(0, 200).map(rw => String(rw[i] ?? '').length + 1))) }));
        ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, t.rows.length), c: t.head.length - 1 } }) };
        let nm = t.name.replace(/[:\\/?*\[\]]/g, ' ').slice(0, 28), k = 2; const base = nm;
        while (wb.SheetNames.includes(nm)) nm = `${base} ${k++}`;
        X.utils.book_append_sheet(wb, ws, nm);
    });
    const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
    await shareOrSave(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${r.title} — ${shop}`);
}
async function shareOrSave(blob, name, type, text) {
    const how = await choose(`📄 <b>${esc(name.replace(/_/g, ' '))}</b> is ready.`, [['share', '📲 Send (WhatsApp / email)', 'var(--pos)'], ['save', '⬇️ Download', 'var(--blue)']]);
    if (!how) return;
    if (how === 'share') {
        try { const file = new File([blob], name, { type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name, text }); return; } }
        catch (e) { if (e && e.name === 'AbortError') return; }
        toast('This device can\'t attach files directly — downloading instead; attach it in WhatsApp or email.');
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// ════════════════════════════════════════════════
