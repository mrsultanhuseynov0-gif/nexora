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
  if (html.includes('connectivity.js')) continue;
  const next = html.replace(
    /(<script src="((?:\.\.\/)*)js\/app\.js(\?v=[^"]*)?"><\/script>)/,
    '<script src="$2js/connectivity.js$3"></script>\n  $1'
  );
  if (next !== html) {
    fs.writeFileSync(file, next);
    n += 1;
    console.log('patched', path.relative(ROOT, file));
  }
}
console.log('updated', n);
