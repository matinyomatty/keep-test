// Keep — English / Kiswahili.
// The pages are written in English. When Kiswahili is chosen, this file swaps the words on screen
// as they appear, so every screen, button, message and pop-up follows the chosen language.
// The choice is saved on this device and shared by sign-in, the till and the barbershop.
(function () {
  const KEY = 'keep.lang';
  let lang = 'en';
  try { lang = localStorage.getItem(KEY) || ((navigator.language || '').toLowerCase().startsWith('sw') ? 'sw' : 'en'); } catch (_) {}

  const DICT = {};      // exact English phrase -> Kiswahili
  const RULES = [];     // [regex, replacement] for phrases with numbers or names inside
  const SKIP = 'script,style,textarea,input,code,pre,.notr,[data-notr],.cl-name,.ic-name,.inv-name,.me-name,.mm-name,.qu-name,.shop-name,.tm-name';
  const missing = new Set();
  const VALS = new Set();

  function add(dict, rules) {
    Object.assign(DICT, dict || {});
    Object.values(dict || {}).forEach(v => { VALS.add(v); VALS.add(v.toLowerCase()); });
    (rules || []).forEach(r => RULES.push(r));
    if (lang === 'sw' && document.body) apply(document.body);
  }

  // Translate one phrase. Leading emoji/symbols and trailing punctuation are kept as they are.
  function dict(s) {
    if (DICT[s] !== undefined) return DICT[s];
    const low = s.toLowerCase();
    if (DICT[low] !== undefined) return matchCase(s, DICT[low]);
    return null;
  }
  function rule(s) {
    for (const [re, rep] of RULES) if (re.test(s)) return s.replace(re, rep);
    return null;
  }
  function matchCase(src, out) {
    if (src === src.toUpperCase() && /[A-Z]/.test(src)) return out.toUpperCase();
    if (src[0] === src[0].toUpperCase()) return out[0].toUpperCase() + out.slice(1);
    return out;
  }
  const LEAD = /^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}️‍•·→←↩️✓✔✅❌⚠️🔒+\-–—*#|()\[\]]*/u;
  const TAIL = /[\s:.!?…,;)·—✓✔]*$/;
  function phrase(s) {
    if (!s || !/[A-Za-z]/.test(s)) return null;
    if (s.includes('\n')) {
      let any = false;
      const out = s.split('\n').map(l => { const t = l.trim() ? phrase(l.trim()) : null; if (t !== null) { any = true; return l.replace(l.trim(), t); } return l; }).join('\n');
      return any ? out : null;
    }
    const lead = (s.match(LEAD) || [''])[0];
    let body = s.slice(lead.length);
    const tail = (body.match(TAIL) || [''])[0];
    body = body.slice(0, body.length - tail.length);
    if (!body) return null;
    const full = (body + tail).trim(), ws = (tail.match(/\s*$/) || [''])[0];
    let out = dict(body);
    if (out !== null) return lead + out + tail;
    if ((out = dict(full)) !== null) return lead + out + ws;
    if ((out = rule(full)) !== null) return lead + out + ws;
    if ((out = rule(body)) !== null) return lead + out + tail;
    // Lines built from parts joined by " · " — translate each part on its own.
    if (body.includes(' · ')) {
      let any = false;
      const parts = body.split(' · ').map(p => { const t = phrase(p); if (t !== null) { any = true; return t; } return p; });
      if (any) return lead + parts.join(' · ') + tail;
    }
    if (window.__keepCollect && !VALS.has(body) && !VALS.has(full) && !VALS.has(body.toLowerCase())) missing.add(body);
    return null;
  }
  function tl(s) {
    if (lang !== 'sw' || typeof s !== 'string') return s;
    const t = phrase(s.trim());
    return t === null ? s : s.replace(s.trim(), t);
  }

  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-label'];
  function doText(n) {
    const v = n.nodeValue;
    if (!v || !/[A-Za-z]/.test(v)) return;
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) return;
    const t = phrase(v.trim());
    if (t !== null && t !== v.trim()) { n.__keepEn = n.__keepEn || v; n.nodeValue = v.replace(v.trim(), t); }
  }
  function doEl(el) {
    if (el.closest && el.closest('script,style,.notr,[data-notr]')) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) { const t = phrase(v.trim()); if (t !== null && t !== v) { el.__keepAttr = el.__keepAttr || {}; if (!(a in el.__keepAttr)) el.__keepAttr[a] = v; el.setAttribute(a, t); } }
    }
    if ((el.tagName === 'INPUT') && /^(button|submit)$/i.test(el.type) && el.value) { const t = phrase(el.value); if (t !== null) el.value = t; }
  }
  function apply(root) {
    if (lang !== 'sw' || !root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) n.nodeType === 3 ? doText(n) : doEl(n);
  }

  let obs = null;
  function watch() {
    if (obs || !document.body) return;
    obs = new MutationObserver(list => {
      if (lang !== 'sw') return;
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
        else m.addedNodes.forEach(apply);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    if (document.title) { const t = phrase(document.title); if (lang === 'sw' && t) document.title = t; }
  }
  function start() { document.documentElement.lang = lang === 'sw' ? 'sw' : 'en'; if (lang === 'sw') apply(document.body); watch(); }

  function set(l) {
    try { localStorage.setItem(KEY, l); } catch (_) {}
    location.reload();
  }

  window.KeepLang = { get lang() { return lang; }, add, tl, set, apply, missing: () => [...missing].sort() };
  window.tl = tl;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
