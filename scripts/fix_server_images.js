/**
 * Assign internet images for server catalog by subcategory / brand.
 * Uses Wikimedia (product photos) + Unsplash (datacenter) without bulk HEAD spam.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const POOLS = {
  switches: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Cisco_6509.JPG/960px-Cisco_6509.JPG',
    'https://upload.wikimedia.org/wikipedia/commons/7/71/Cisco_Catalyst_4500_%286586025533%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Cisco_Catalyst_4506-E_Switch_004.jpg/960px-Cisco_Catalyst_4506-E_Switch_004.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Cisco_Systems_Catalyst_5000_Series_-_IMG_2288.jpg/960px-Cisco_Systems_Catalyst_5000_Series_-_IMG_2288.jpg',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&h=900&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=900&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&h=900&q=80',
    'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=1200&h=900&q=80',
    'https://images.unsplash.com/photo-1573164574572-cb89e39749b4?auto=format&fit=crop&w=1200&h=900&q=80',
    'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=1200&h=900&q=80',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&h=900&q=85',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&h=900&q=85'
  ],
  routers: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Linksys_WRT54G.jpg/960px-Linksys_WRT54G.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Wi-fi_router.jpg/960px-Wi-fi_router.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TP-Link_TL-WR740N_router_HS2.jpg/960px-TP-Link_TL-WR740N_router_HS2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mikrotik_Wireless_Router_2.jpg/960px-Mikrotik_Wireless_Router_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Mikrotik_RB951Ui-2HnD.jpg/960px-Mikrotik_RB951Ui-2HnD.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/MikroTIK_hAP_Lite.jpg/960px-MikroTIK_hAP_Lite.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/ELECOM_WRC-300FEBK_WPS_WiFi_router_2.jpg/960px-ELECOM_WRC-300FEBK_WPS_WiFi_router_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/3Com_OfficeConnect_ADSL_Wireless_11g_Firewall_Router_2012-10-28-0869.jpg/960px-3Com_OfficeConnect_ADSL_Wireless_11g_Firewall_Router_2012-10-28-0869.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/WRT54G_v2_Linksys_Router_Digon3.jpg/960px-WRT54G_v2_Linksys_Router_Digon3.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/e/ee/Linksys_WRT54G_V1.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/TP-Link_TL-WR740N_router_HS1.jpg/960px-TP-Link_TL-WR740N_router_HS1.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/MikroTIK_hAP_Lite_and_RouterBOARD_750.jpg/960px-MikroTIK_hAP_Lite_and_RouterBOARD_750.jpg'
  ],
  racks: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Rack_Servers_Fujitsu_Primergy_2.jpg/960px-Rack_Servers_Fujitsu_Primergy_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Door_of_Rack_Server_Cabinet_Fujitsu_Primecenter.jpg/960px-Door_of_Rack_Server_Cabinet_Fujitsu_Primecenter.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/19_inch_racks_MIT.agr.jpg/960px-19_inch_racks_MIT.agr.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Rack_in_wmf_sf_office.jpg/960px-Rack_in_wmf_sf_office.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Wikimedia_Foundation_Servers-8055_35.jpg/960px-Wikimedia_Foundation_Servers-8055_35.jpg',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&h=1000&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&h=1000&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&h=1000&q=80',
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1400&h=1000&q=80',
    'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=1400&h=1000&q=80',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&h=1600&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=1600&q=80'
  ],
  servers: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Dell_PowerEdge_Servers.jpg/960px-Dell_PowerEdge_Servers.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Rack_Servers_Fujitsu_Primergy_2.jpg/960px-Rack_Servers_Fujitsu_Primergy_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Wikimedia_Foundation_Servers-8055_35.jpg/960px-Wikimedia_Foundation_Servers-8055_35.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Rack_in_wmf_sf_office.jpg/960px-Rack_in_wmf_sf_office.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/c/c3/My_Opera_Server.jpg',
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1400&h=1000&q=80',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&h=1000&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&h=1000&q=80'
  ]
};

const BRAND_ROUTER = {
  mikrotik: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mikrotik_Wireless_Router_2.jpg/960px-Mikrotik_Wireless_Router_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Mikrotik_RB951Ui-2HnD.jpg/960px-Mikrotik_RB951Ui-2HnD.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/MikroTIK_hAP_Lite.jpg/960px-MikroTIK_hAP_Lite.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/MikroTIK_hAP_Lite_and_RouterBOARD_750.jpg/960px-MikroTIK_hAP_Lite_and_RouterBOARD_750.jpg'
  ],
  'tp-link': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TP-Link_TL-WR740N_router_HS2.jpg/960px-TP-Link_TL-WR740N_router_HS2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/TP-Link_TL-WR740N_router_HS1.jpg/960px-TP-Link_TL-WR740N_router_HS1.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/TP-Link_TL-WR740N_router_HS5.jpg/960px-TP-Link_TL-WR740N_router_HS5.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/TP-Link_TL-WR740N_router_HS3.jpg/960px-TP-Link_TL-WR740N_router_HS3.jpg'
  ],
  cisco: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Linksys_WRT54G.jpg/960px-Linksys_WRT54G.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/3Com_OfficeConnect_ADSL_Wireless_11g_Firewall_Router_2012-10-28-0869.jpg/960px-3Com_OfficeConnect_ADSL_Wireless_11g_Firewall_Router_2012-10-28-0869.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Wi-fi_router.jpg/960px-Wi-fi_router.jpg'
  ],
  ubiquiti: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Wi-fi_router.jpg/960px-Wi-fi_router.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/ELECOM_WRC-300FEBK_WPS_WiFi_router_2.jpg/960px-ELECOM_WRC-300FEBK_WPS_WiFi_router_2.jpg'
  ],
  netgear: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Linksys_WRT54G.jpg/960px-Linksys_WRT54G.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/WRT54G_v2_Linksys_Router_Digon3.jpg/960px-WRT54G_v2_Linksys_Router_Digon3.jpg'
  ],
  hpe: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/3Com_OfficeConnect_ADSL_Wireless_11g_Firewall_Router_2012-10-28-0869.jpg/960px-3Com_OfficeConnect_ADSL_Wireless_11g_Firewall_Router_2012-10-28-0869.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Wi-fi_router.jpg/960px-Wi-fi_router.jpg'
  ],
  huawei: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TP-Link_TL-WR740N_router_HS2.jpg/960px-TP-Link_TL-WR740N_router_HS2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/ELECOM_WRC-300FEBK_WPS_WiFi_router_2.jpg/960px-ELECOM_WRC-300FEBK_WPS_WiFi_router_2.jpg'
  ]
};

function main() {
  const productsPath = path.join(DATA, 'products.json');
  const poolsPath = path.join(DATA, 'image-pools.json');
  const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  let pools = {};
  try { pools = JSON.parse(fs.readFileSync(poolsPath, 'utf8')); } catch (e) { pools = {}; }

  Object.keys(POOLS).forEach(function (k) {
    pools['server-' + k] = POOLS[k];
  });
  fs.writeFileSync(poolsPath, JSON.stringify(pools, null, 2), 'utf8');

  const counters = { switches: 0, routers: 0, racks: 0, servers: 0 };
  const brandCounters = {};
  let updated = 0;
  const samples = {};

  productsData.products.forEach(function (p) {
    if (p.category !== 'server') return;
    const sub = p.subcategory;
    const pool = POOLS[sub];
    if (!pool) return;

    let img;
    let img2;
    if (sub === 'routers' && BRAND_ROUTER[p.brandId]) {
      const bp = BRAND_ROUTER[p.brandId];
      const bi = brandCounters[p.brandId] || 0;
      brandCounters[p.brandId] = bi + 1;
      img = bp[bi % bp.length];
      img2 = bp[(bi + 1) % bp.length];
    } else {
      const idx = counters[sub]++;
      img = pool[idx % pool.length];
      img2 = pool[(idx + 2) % pool.length];
    }

    p.image = img;
    p.images = [img, img2];
    updated += 1;
    if (!samples[sub]) samples[sub] = [];
    if (samples[sub].length < 2) samples[sub].push({ name: p.name, brand: p.brand, image: img });
  });

  productsData.version = Number(productsData.version || 1) + 1;
  fs.writeFileSync(productsPath, JSON.stringify(productsData, null, 2), 'utf8');

  const { db, productToRow } = require(path.join(ROOT, 'server', 'src', 'db'));
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, sku, name, brand, brand_id, category, subcategory, price, old_price, currency,
      rating, reviews, badge, badge_type, in_stock, stock, is_new, tags_json, description,
      specs_json, images_json, gradient, image, review_list_json, raw_json
    ) VALUES (
      @id, @sku, @name, @brand, @brand_id, @category, @subcategory, @price, @old_price, @currency,
      @rating, @reviews, @badge, @badge_type, @in_stock, @stock, @is_new, @tags_json, @description,
      @specs_json, @images_json, @gradient, @image, @review_list_json, @raw_json
    )
  `);
  const tx = db.transaction(function () {
    productsData.products.filter(function (p) { return p.category === 'server'; }).forEach(function (p) {
      upsert.run(productToRow(p));
    });
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'catalog_version', String(productsData.version)
    );
  });
  tx();

  console.log(JSON.stringify({ ok: true, updated: updated, samples: samples, version: productsData.version }, null, 2));
}

main();
