'use strict';
const https = require('https');
function get(u) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { 'Cache-Control': 'no-cache' } }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res(d));
    }).on('error', rej);
  });
}
(async () => {
  const h = await get('https://nexora-q1v4.onrender.com/');
  const m = h.match(/main\.css\?v=([^"']+)/);
  console.log('html css v=', m && m[1]);
  const s0 = await get('https://nexora-q1v4.onrender.com/js/shell.js');
  console.log('default openNavMore=', /openNavMore/.test(s0));
  console.log('default display none important=', /display:none!important/.test(s0));
  const sf = await get('https://nexora-q1v4.onrender.com/js/shell.js?v=20260804f');
  console.log('f openNavMore=', /openNavMore/.test(sf));
})().catch((e) => console.error(e));
