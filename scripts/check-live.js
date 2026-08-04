'use strict';
const https = require('https');
function get(u) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res({ code: r.statusCode, body: d }));
    }).on('error', rej);
  });
}
(async () => {
  const html = (await get('https://nexora-q1v4.onrender.com/')).body;
  const cssV = (html.match(/main\.css\?v=([^"']+)/) || [])[1] || 'none';
  console.log('html css v=', cssV);
  const shell = (await get('https://nexora-q1v4.onrender.com/js/shell.js')).body;
  console.log('has more.html link=', /pages\/more\.html/.test(shell));
  console.log('has nav-more-menu=', /nav-more-menu/.test(shell));
  console.log('has PRIMARY_NAV=', /PRIMARY_NAV_IDS/.test(shell));
  console.log('has openNavMore=', /openNavMore/.test(shell));
  const more = await get('https://nexora-q1v4.onrender.com/pages/more.html');
  console.log('more.html status=', more.code);
})().catch((e) => console.error(e));
