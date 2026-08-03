'use strict';
const { db } = require('../server/src/db');
const { consult } = require('../server/src/ai');

console.log('bySub', db.prepare(
  "SELECT subcategory, COUNT(*) AS n FROM products WHERE category = 'server' GROUP BY subcategory"
).all());
console.log('category row', db.prepare("SELECT id FROM categories WHERE id = 'server'").get());
console.log('total', db.prepare('SELECT COUNT(*) AS n FROM products').get());

['24 port poe switch', 'mikrotik router', '42U server kabinet', 'dell poweredge'].forEach((q) => {
  const r = consult(q, { limit: 2 });
  console.log('\nQ:', q);
  console.log(' intent', r.intent.label, r.intent.subcategory);
  console.log(' products', (r.products || []).map((p) => p.name + ' @' + p.price));
});
