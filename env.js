// Keep — which database this copy of the website talks to.
// keep.co.tz            → the live database (real shops)
// test.keep.co.tz       → the test database (practice data only)
// The same code runs on both; only this choice differs.
(function () {
  const host = location.hostname;
  const test = host.startsWith('test.') || /[?&]env=test\b/.test(location.search) && (host === 'localhost' || host === '127.0.0.1');
  const LIVE = {
    apiKey: 'AIzaSyCaDZILjLrWg2VGvFElzU08Je-kJTGHKiU',
    authDomain: 'matinyopos.firebaseapp.com',
    projectId: 'matinyopos',
    storageBucket: 'matinyopos.firebasestorage.app',
    messagingSenderId: '891386548810',
    appId: '1:891386548810:web:26f1ef407a053a3f6f4cb3'
  };
  const TEST = {
    apiKey: 'AIzaSyAoaS1BhG2hwUO44mdM-hD0TzeYBmQPMgk',
    authDomain: 'keep-test-d0686.firebaseapp.com',
    projectId: 'keep-test-d0686',
    storageBucket: 'keep-test-d0686.firebasestorage.app',
    messagingSenderId: '260455775669',
    appId: '1:260455775669:web:a6b9db9e95bb3cbc896dfc'
  };
  // WhatsApp sending server (Cloudflare Worker holding the Twilio key). Empty = not set up: Keep opens WhatsApp instead.
  // Test site only for now; the live site stays on the WhatsApp button until we publish.
  const WA_WORKER = test ? 'https://keep-whatsapp.flat-violet-e940.workers.dev' : '';
  window.KEEP_ENV = { test, firebaseConfig: test ? TEST : LIVE, site: location.origin + '/', waWorker: WA_WORKER };

  // A yellow strip on every page of the test copy, so nobody mistakes it for the real shop.
  if (test) {
    const show = () => {
      if (document.getElementById('keep-test-strip')) return;
      const d = document.createElement('div');
      d.id = 'keep-test-strip';
      d.className = 'notr';
      d.textContent = 'TEST COPY — practice data, not real shops';
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#ffc72c;color:#0b0d12;font:700 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-align:center;padding:5px 8px;pointer-events:none;';
      document.body.appendChild(d);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
})();
