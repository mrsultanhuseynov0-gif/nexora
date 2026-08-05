'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SNIP = `  <script>
    /* Early Internet Xətası gate — before CSS/JS */
    (function () {
      if (navigator.onLine) return;
      document.documentElement.classList.add('nexora-offline');
      var css = document.createElement('style');
      css.id = 'nexoraEarlyOfflineCss';
      css.textContent = 'html,body{background:#0b0b0b!important;margin:0;overflow:hidden!important}' +
        '#nexoraEarlyOffline{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;background:#0b0b0b;color:#fff;text-align:center;font-family:system-ui,sans-serif}' +
        '#nexoraEarlyOffline .box{max-width:360px}#nexoraEarlyOffline .logo{font-weight:900;letter-spacing:.16em;color:#FF0000;font-size:1.4rem;margin-bottom:14px}' +
        '#nexoraEarlyOffline h1{margin:0 0 10px;font-size:1.45rem}#nexoraEarlyOffline p{margin:0;color:#bbb;line-height:1.5}';
      (document.head || document.documentElement).appendChild(css);
      function paint() {
        if (document.getElementById('nexoraEarlyOffline')) return;
        var el = document.createElement('div');
        el.id = 'nexoraEarlyOffline';
        el.innerHTML = '<div class="box"><div class="logo">NEXORA</div><h1>Internet Xətası</h1>' +
          '<p>İnternet yoxdur. Sayt yalnız onlayn açılır.</p></div>';
        (document.body || document.documentElement).appendChild(el);
      }
      if (document.body) paint();
      else document.addEventListener('DOMContentLoaded', paint);
    })();
  </script>
`;

function walk(d, acc) {
  acc = acc || [];
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'excel') continue;
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('connectivity.js') && path.basename(file) !== 'index.html') continue;
  if (html.includes('nexoraEarlyOffline') || html.includes('Early Internet')) continue;
  let next;
  if (/<meta charset="UTF-8">/i.test(html)) {
    next = html.replace(/<meta charset="UTF-8">/i, (m) => m + '\n' + SNIP);
  } else if (/<head[^>]*>/i.test(html)) {
    next = html.replace(/<head[^>]*>/i, (m) => m + '\n' + SNIP);
  } else {
    continue;
  }
  if (next !== html) {
    fs.writeFileSync(file, next);
    n += 1;
    console.log('gated', path.relative(ROOT, file));
  }
}
console.log('updated', n);
