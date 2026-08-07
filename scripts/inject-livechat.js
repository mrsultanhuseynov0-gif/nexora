'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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
  if (!html.includes('shell.js')) continue;
  if (html.includes('livechat.js')) continue;
  // skip admin — no customer chat widget there
  if (/pages[\\/]+admin[\\/]/i.test(file)) continue;

  const next = html.replace(
    /(<script src="(\.\.\/)?js\/shell\.js\?v=[^"]+"><\/script>)/,
    function (m, full, rel) {
      const prefix = rel || '';
      return full + '\n  <script src="' + prefix + 'js/livechat.js?v=20260806a"></script>';
    }
  );
  if (next !== html) {
    fs.writeFileSync(file, next);
    n += 1;
    console.log('livechat', path.relative(ROOT, file));
  }
}
console.log('updated', n);
