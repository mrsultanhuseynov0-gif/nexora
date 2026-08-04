'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const V = '20260804c';

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
  const next = html
    .replace(/(href|src)=["']([^"']+\.(?:css|js))(?:\?[^"']*)?["']/g, function (_, attr, url) {
      if (/^https?:/i.test(url) || url.indexOf('cdn.') !== -1) {
        return attr + '="' + url + '"';
      }
      return attr + '="' + url + '?v=' + V + '"';
    });
  if (next !== html) {
    fs.writeFileSync(file, next);
    n += 1;
    console.log('busted', path.relative(ROOT, file));
  }
}
console.log('updated', n, 'files with v=' + V);
