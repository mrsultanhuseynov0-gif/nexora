'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const V = '20260805c';

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
      if (/^https?:/i.test(url)) {
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

// Keep CSS @import cache-bust in sync with HTML asset version
const mainCss = path.join(ROOT, 'css', 'main.css');
if (fs.existsSync(mainCss)) {
  let css = fs.readFileSync(mainCss, 'utf8');
  const cssNext = css.replace(/@import '([^'?]+\.css)(?:\?[^']*)?';/g, "@import '$1?v=" + V + "';");
  if (cssNext !== css) {
    fs.writeFileSync(mainCss, cssNext);
    console.log('busted css/main.css imports');
  }
}

console.log('updated', n, 'files with v=' + V);
