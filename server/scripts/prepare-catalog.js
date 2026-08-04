'use strict';

/**
 * Ensure catalog JSON is available next to the server package.
 * On Render (rootDir=server) repo data/ lives at ../data.
 */
const fs = require('fs');
const path = require('path');

const dest = path.resolve(__dirname, '..', 'catalog-data');
const marker = path.join(dest, 'products.json');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dst, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (fs.existsSync(marker)) {
  console.log('[catalog] using', dest);
  process.exit(0);
}

const sources = [
  path.resolve(__dirname, '..', '..', 'data'),
  path.resolve(process.cwd(), '..', 'data'),
  path.resolve(process.cwd(), 'data')
];

for (const src of sources) {
  if (fs.existsSync(path.join(src, 'products.json'))) {
    console.log('[catalog] copying from', src, '->', dest);
    copyDir(src, dest);
    process.exit(0);
  }
}

console.error('[catalog] products.json not found. Tried:', sources.join(' | '));
process.exit(0);
