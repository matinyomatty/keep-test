// Keep till — Camera scanner for barcodes and serials.
// Part of app/index.html; the parts load in order and share one global scope.
//  CAMERA SCANNER — barcodes, QR codes, serial / IMEI labels
//  Uses the phone's built-in detector when available, otherwise a
//  scanning library that is only downloaded the first time it's needed.
// ════════════════════════════════════════════════
const SCAN_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
// Fast reader for phones whose browser has no built-in barcode reader (iPhone, some tablets).
// Downloaded once, then kept by the app for offline use.
const FAST_SCAN_LIB = 'https://cdn.jsdelivr.net/npm/barcode-detector@2.3.1/dist/iife/pure.js';
const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix'];
const SC = { on: false, stream: null, timer: null, lib: null, last: {}, opts: null, list: [], det: null, busy: false, warmTimer: null };
function beep() {
    try {
        const a = SC.audio || (SC.audio = new (window.AudioContext || window.webkitAudioContext)());
        const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 1400; g.gain.value = 0.15;
        o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.09);
    } catch (e) {}
    navigator.vibrate?.(60);
}
// Get a barcode reader: the phone's own (fastest), else the fast downloaded one.
function getDetector() {
    return SC.detP || (SC.detP = makeDetector().catch(e => { SC.detP = null; throw e; }));
}
async function makeDetector() {
    let Det = null, fmts = [];
    if ('BarcodeDetector' in window) {
        try { fmts = await BarcodeDetector.getSupportedFormats(); if (fmts.length) Det = BarcodeDetector; } catch (e) {}
    }
    if (!Det) {
        if (!window.BarcodeDetectionAPI) await loadScript(FAST_SCAN_LIB, 'the scanner');
        Det = window.BarcodeDetectionAPI.BarcodeDetector;
        fmts = await Det.getSupportedFormats();
    }
    const want = SCAN_FORMATS.filter(f => fmts.includes(f));
    const det = new Det(want.length ? { formats: want } : undefined);
    // first call loads the reader engine — do it now so the first real scan is instant
    const c = document.createElement('canvas'); c.width = c.height = 8;
    await det.detect(c).catch(() => {});
    return (SC.det = det);
}
// Get things ready in the background on phones/tablets, so the first scan doesn't wait for a download.
function prewarmScanner() {
    if (SC.detP || !navigator.mediaDevices) return;
    setTimeout(() => getDetector().catch(() => {}), 2500);
}
async function getCameraStream() {
    // Camera kept "warm" from the last scan opens instantly
    if (SC.stream && SC.stream.getVideoTracks().some(t => t.readyState === 'live')) {
        clearTimeout(SC.warmTimer); SC.stream.getVideoTracks().forEach(t => t.enabled = true); return SC.stream;
    }
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    const tr = s.getVideoTracks()[0];
    try { await tr.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
    return (SC.stream = s);
}
// Which part of the camera picture sits under the yellow box (plus some room around it).
function scanCrop(v) {
    const vw = v.videoWidth, vh = v.videoHeight, view = v.getBoundingClientRect(), fr = document.querySelector('.scan-frame').getBoundingClientRect();
    const k = Math.max(view.width / vw, view.height / vh);          // the video is drawn "cover"
    const ox = (vw * k - view.width) / 2, oy = (vh * k - view.height) / 2;
    const padY = fr.height * 0.35;
    let y = (fr.top - view.top - padY + oy) / k, h = (fr.height + padY * 2) / k;
    y = Math.max(0, y); h = Math.min(vh - y, h);
    return { x: 0, y, w: vw, h };                                    // full width: long serial barcodes may poke out of the box
}
async function openScanner(opts) {
    if (SC.on) await closeScanner();
    SC.opts = opts; SC.list = []; SC.last = {}; SC.on = true; SC.t0 = performance.now(); SC.readMs = 0;
    $('scanTitle').textContent = opts.title || 'Scan';
    $('scanHint').textContent = opts.hint || 'Hold the barcode inside the yellow box';
    $('scanList').innerHTML = ''; $('scanDone').textContent = opts.multi ? 'DONE' : 'CANCEL';
    $('scanMsg').textContent = 'Starting camera…';
    $('scanner').classList.add('show'); $('scanner').classList.remove('lib');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        $('scanMsg').textContent = 'This browser cannot use the camera. Open the app over https in Chrome or Safari, or type the code.';
        return;
    }
    try {
        // camera and reader start at the same time
        const [stream, det] = await Promise.all([getCameraStream(), getDetector().catch(e => { console.warn('fast scanner', e); return null; })]);
        if (!SC.on) return;
        if (det) {
            const v = $('scanVideo'); if (v.srcObject !== stream) v.srcObject = stream;
            v.classList.remove('hidden'); $('scanReader').classList.add('hidden');
            await v.play();
            $('scanMsg').textContent = ''; SC.camMs = Math.round(performance.now() - SC.t0);
            const cv = SC.canvas || (SC.canvas = document.createElement('canvas')), cx = cv.getContext('2d', { willReadFrequently: true });
            const frame = async () => {
                if (!SC.on) return;
                if (!SC.busy && v.videoWidth) {
                    SC.busy = true;
                    try {
                        const r = scanCrop(v), sc = Math.min(1, 1280 / r.w);   // keep it light: at most 1280 px wide
                        cv.width = Math.round(r.w * sc); cv.height = Math.round(r.h * sc);
                        cx.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height);
                        const t1 = performance.now(); const found = await det.detect(cv); SC.decMs = Math.round(performance.now() - t1);
                        for (const c of found) if (c.rawValue) { gotCode(c.rawValue); break; }
                    } catch (e) {}
                    SC.busy = false;
                }
                if (SC.on) v.requestVideoFrameCallback ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
            };
            frame();
        } else {
            // last resort: the older, slower scanning library
            stopStream();
            if (!window.Html5Qrcode) await loadScript(SCAN_LIB, 'the scanner');
            $('scanner').classList.add('lib');
            $('scanVideo').classList.add('hidden'); $('scanReader').classList.remove('hidden');
            const F = window.Html5QrcodeSupportedFormats || {};
            const formats = ['QR_CODE', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF'].map(k => F[k]).filter(x => x !== undefined);
            SC.lib = new Html5Qrcode('scanReader', { formatsToSupport: formats, verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
            await SC.lib.start({ facingMode: 'environment' }, {
                fps: 20,
                qrbox: (vw, vh) => ({ width: Math.floor(vw * 0.94), height: Math.floor(Math.min(vh * 0.6, vw * 0.6)) }),
                videoConstraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] }
            }, gotCode, () => {});
            $('scanMsg').textContent = '';
        }
    } catch (e) {
        const m = String(e && (e.name && e.name !== 'Error' ? e.name + ': ' : '') + (e && e.message || e));
        console.warn('scanner', e);
        $('scanMsg').textContent = /NotAllowed|Permission/i.test(m) ? '📷 Camera permission was refused. Allow the camera for this site in your browser settings, then try again.'
            : /NotFound|Devices/i.test(m) ? 'No camera found on this device.' : 'Could not start the camera: ' + m;
    }
}
function stopStream() {
    clearTimeout(SC.warmTimer);
    try { if (SC.stream) SC.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    SC.stream = null; $('scanVideo').srcObject = null;
}
async function closeScanner() {
    SC.on = false; clearTimeout(SC.timer);
    try { if (SC.lib) { await SC.lib.stop(); SC.lib.clear(); } } catch (e) {}
    SC.lib = null;
    // keep the camera ready for a few seconds — the next scan then opens at once
    if (SC.stream) {
        SC.stream.getVideoTracks().forEach(t => t.enabled = false);
        clearTimeout(SC.warmTimer); SC.warmTimer = setTimeout(stopStream, 20000);
    }
    $('scanner').classList.remove('show');
}
document.addEventListener('visibilitychange', () => { if (document.hidden && !SC.on) stopStream(); });
function gotCode(raw) {
    const code = String(raw || '').trim(); if (!code || !SC.on) return;
    const t = Date.now(); if (SC.last[code] && t - SC.last[code] < 2500) return;   // same code held in view
    SC.last[code] = t; if (!SC.readMs) SC.readMs = Math.round(performance.now() - SC.t0);
    beep();
    $('scanMsg').innerHTML = `<span style="background:rgba(22,163,74,.9);padding:6px 12px;border-radius:10px;font-weight:800;">✓ Read: ${esc(code)}</span>`;
    setTimeout(() => { if (SC.on && /Read:/.test($('scanMsg').textContent)) $('scanMsg').textContent = ''; }, 1500);
    const o = SC.opts;
    const res = o.onCode(code);
    if (o.multi) {
        SC.list.unshift({ code, ok: res !== false, note: typeof res === 'string' ? res : '' });
        $('scanList').innerHTML = SC.list.slice(0, 6).map(x => `<div class="scan-chip ${x.ok ? '' : 'bad'}">${x.ok ? '✓' : '✗'} ${esc(x.note || x.code)}</div>`).join('');
    } else { closeScanner(); toast('✓ Scanned ' + code); }
}
function scanTypeInstead() {
    const o = SC.opts; closeScanner();
    askValue(o.title || 'Code', 'Type the code', 'OK', { type: 'text' }).then(v => { if (v) o.onCode(v); });
}
async function toggleTorch() {
    try {
        const tr = SC.stream && SC.stream.getVideoTracks()[0];
        if (tr) { SC.torch = !SC.torch; await tr.applyConstraints({ advanced: [{ torch: SC.torch }] }); return; }
        if (SC.lib) { SC.torch = !SC.torch; await SC.lib.applyVideoConstraints({ advanced: [{ torch: SC.torch }] }); }
    } catch (e) { toast('This camera has no light control.', 'err'); }
}

// ── What a scanned code means on each screen ──────────
// Till: product barcode → add to cart. Serial / IMEI on the shelf → add that item with the serial filled in.
const normCode = c => String(c || '').replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
const productByCode = c => { const n = normCode(c); return n ? S.products.find(x => x.barcode && normCode(x.barcode) === n) : null; };
function sellByCode(code) {
    const p = productByCode(code);
    if (p) {
        if ((Number(p.stock) || 0) - (S.cart[p.id] || 0) < 1 && !partOk(p)) { toast(`⚠️ No more ${p.name} in stock`, 'err'); return false; }
        if (p.trackSerial) { toast(`Now scan the serial / IMEI of the ${p.name}`); }
        addToCart(p.id); return `${p.name} · ${n0(linePrice(p.id))}`;
    }
    const r = S.serialsIn[serialId(code)];
    if (r) {
        const pp = productById(r.productId);
        if (!pp) return false;
        const m = meta(pp.id), have = (m.serials || []).filter(Boolean);
        if (have.includes(r.serial)) return `${pp.name} · already in cart`;
        // fill an empty serial box, or add one more unit
        const q = S.cart[pp.id] || 0;
        if (have.length >= q) addToCart(pp.id);
        const slots = m.serials || (m.serials = []);
        let n = 0; while (slots[n]) n++;
        slots[n] = r.serial;
        renderCart();
        return `${pp.name} · S/N ${r.serial}`;
    }
    if (isAdmin()) {
        closeScanner();
        showConfirm(`Code <b>${esc(code)}</b> is not in your stock.<br>Add it as a new item?`, '➕ Add item', 'var(--blue)').then(ok => {
            if (!ok) return; openItem(); $('itemBarcode').value = code; setTimeout(() => $('itemName').focus(), 300);
        });
        return false;
    }
    toast(`Unknown code ${code} — ask the owner to add it`, 'err');
    return false;
}
function scanToSell() { openScanner({ title: '📷 Scan to sell', hint: 'Barcode on the box, or the serial / IMEI label', multi: true, onCode: sellByCode }); }
function scanItemBarcode() { openScanner({ title: 'Item barcode', onCode: c => { $('itemBarcode').value = c; } }); }
function scanSerialsInto(taId, after) {
    openScanner({ title: '📷 Scan serials / IMEI', hint: 'Scan each unit — the list fills up as you go', multi: true, onCode: c => {
        const ta = $(taId), have = parseSerials(ta.value);
        if (have.includes(c)) return 'already scanned';
        if (S.serialsIn[serialId(c)]) { toast(`${c} is already on the shelf`, 'err'); return false; }
        ta.value = [...have, c].join('\n'); after && after(); return c;
    } });
}
function scanCartSerial(id) {
    const p = productById(id);
    openScanner({ title: `Serial for ${p ? p.name : ''}`, onCode: c => {
        const r = S.serialsIn[serialId(c)];
        if (r && r.productId !== id) { toast(`That serial belongs to ${r.name}`, 'err'); return; }
        const m = meta(id), slots = m.serials || (m.serials = []);
        if (slots.includes(c)) return;
        let n = 0; while (slots[n]) n++;
        if (n >= (S.cart[id] || 0)) addToCart(id);
        slots[n] = c; renderCart();
    } });
}
function scanLookup() { openScanner({ title: 'Serial / IMEI', onCode: c => { $('serialQ').value = c; runSerialLookup(); } }); }
function scanStockSearch() {
    openScanner({ title: 'Find in stock', onCode: c => {
        const p = productByCode(c) || productById((S.serialsIn[serialId(c)] || {}).productId);
        if (p) { $('invSearch').value = p.name; renderInventory(); } else { serialLookup(); $('serialQ').value = c; runSerialLookup(); }
    } });
}

// ════════════════════════════════════════════════
