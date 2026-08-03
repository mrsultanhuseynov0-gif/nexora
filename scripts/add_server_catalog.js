/**
 * Add Server & Şəbəkə category + switch / router / rack / server products.
 * Updates data/*.json and upserts into SQLite without wiping users/orders.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(data, null, 2), 'utf8');
}

const IMG = {
  switch: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a576b9b2d?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1551703599-6b3e8379cf4b?auto=format&fit=crop&w=1200&h=800&q=80'
  ],
  router: [
    'https://images.unsplash.com/photo-1606904825846-647eb07d8adb?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1606904825751-0d5ab6a5f8c0?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1622544238246-3c8b0f8b0b0b?auto=format&fit=crop&w=1200&h=800&q=80'.replace('b0b0b0b', '8475d9'),
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&h=800&q=80'
  ],
  rack: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1597852074816-d933c7d2d988?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=800&q=80'
  ],
  server: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&h=800&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a576b9b2d?auto=format&fit=crop&w=1200&h=800&q=80'
  ]
};

// Fix broken router image URL
IMG.router[2] = 'https://images.unsplash.com/photo-1622544238246-8475d9b6b5e3?auto=format&fit=crop&w=1200&h=800&q=80';

const NEW_BRANDS = [
  { id: 'cisco', name: 'Cisco', logo: 'CISCO', color: '#049fd9', featured: true, image: IMG.switch[0] },
  { id: 'mikrotik', name: 'MikroTik', logo: 'MT', color: '#293239', featured: true, image: IMG.router[0] },
  { id: 'ubiquiti', name: 'Ubiquiti', logo: 'UI', color: '#0559c9', featured: true, image: IMG.switch[1] },
  { id: 'tp-link', name: 'TP-Link', logo: 'TP', color: '#4acbd6', featured: false, image: IMG.router[1] },
  { id: 'hpe', name: 'HPE', logo: 'HPE', color: '#01a982', featured: true, image: IMG.server[0] },
  { id: 'dell-emc', name: 'Dell EMC', logo: 'DELL', color: '#007db8', featured: true, image: IMG.server[1] },
  { id: 'huawei', name: 'Huawei', logo: 'HW', color: '#cf0a2c', featured: false, image: IMG.switch[2] },
  { id: 'netgear', name: 'NETGEAR', logo: 'NG', color: '#2b2b2b', featured: false, image: IMG.router[3] },
  { id: 'apc', name: 'APC', logo: 'APC', color: '#000000', featured: false, image: IMG.rack[1] },
  { id: 'triton', name: 'Tritón', logo: 'TR', color: '#1a237e', featured: false, image: IMG.rack[0] }
];

const CAT = {
  id: 'server',
  name: 'Server & Şəbəkə',
  slug: 'server-shebeke',
  count: 0,
  icon: 'server',
  gradient: 'linear-gradient(135deg, #0d1b2a, #1b3a4b)',
  link: 'pages/categories.html?cat=server',
  subcategories: [
    { id: 'switches', name: 'Switch-lər' },
    { id: 'routers', name: 'Router-lər' },
    { id: 'racks', name: 'Server rak / kabinet' },
    { id: 'servers', name: 'Serverlər' }
  ],
  image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&h=800&q=80'
};

function baseSpecs(extra, p) {
  return Object.assign({
    Brend: p.brand,
    Model: p.name,
    SKU: p.sku,
    Kateqoriya: 'server',
    'Alt kateqoriya': p.subcategory,
    Zəmanət: '24 ay rəsmi zəmanət',
    Çatdırılma: '1–3 iş günü (Bakı), 2–5 gün (regionlar)',
    Qaytarma: '14 gün ərzində dəyişmə / qaytarma',
    Mənşə: 'Rəsmi distribyutor',
    'Qutu içində': 'Məhsul, montaj dəsti, sənədlər, zəmanət kartı'
  }, extra);
}

function makeProduct(i, def) {
  const id = 'p' + String(i).padStart(4, '0');
  const sku = def.sku || ('SRV-' + def.subcategory.slice(0, 3).toUpperCase() + '-' + String(i).padStart(4, '0'));
  const img = def.image;
  const p = {
    id: id,
    sku: sku,
    name: def.name,
    brand: def.brand,
    brandId: def.brandId,
    category: 'server',
    subcategory: def.subcategory,
    price: def.price,
    oldPrice: def.oldPrice || null,
    currency: '₼',
    rating: def.rating || (4.2 + (i % 7) * 0.1),
    reviews: def.reviews || (12 + (i % 40) * 3),
    badge: def.badge || (def.isNew ? 'Yeni' : ''),
    badgeType: def.badgeType || (def.isNew ? 'new' : ''),
    inStock: true,
    stock: def.stock || (8 + (i % 20)),
    isNew: !!def.isNew,
    tags: ['server', def.subcategory, def.brandId, 'nexora', 'network'],
    description: def.description,
    specs: baseSpecs(def.specs || {}, { brand: def.brand, name: def.name, sku: sku, subcategory: def.subcategory }),
    images: [img, img],
    gradient: 'linear-gradient(135deg, #0d1b2a, #1b3a4b)',
    reviewList: [],
    image: img
  };
  p.rating = Math.round(Math.min(5, p.rating) * 10) / 10;
  return p;
}

function buildProducts(startId) {
  const list = [];
  let n = startId;

  const switches = [
    { brand: 'Cisco', brandId: 'cisco', name: 'Cisco Catalyst 9200 24-Port PoE+', price: 2899, oldPrice: 3199, ports: '24×1G + 4×SFP', poe: 'PoE+ 370W', speed: '1 Gbps', manage: 'Layer 2/3 Lite', isNew: true },
    { brand: 'Cisco', brandId: 'cisco', name: 'Cisco Catalyst 1000 48-Port', price: 1899, ports: '48×1G + 4×SFP', poe: 'Yox', speed: '1 Gbps', manage: 'Layer 2' },
    { brand: 'Cisco', brandId: 'cisco', name: 'Cisco CBS350 8-Port PoE', price: 649, ports: '8×1G PoE+', poe: 'PoE+ 120W', speed: '1 Gbps', manage: 'Smart managed' },
    { brand: 'MikroTik', brandId: 'mikrotik', name: 'MikroTik CRS326 24G+2S+RM', price: 499, ports: '24×1G + 2×SFP+', poe: 'Yox', speed: '1G / 10G uplink', manage: 'RouterOS / SwOS', isNew: true },
    { brand: 'MikroTik', brandId: 'mikrotik', name: 'MikroTik CSS610 8G-2S+IN', price: 189, ports: '8×1G + 2×SFP+', poe: 'Yox', speed: '1G / 10G', manage: 'SwOS Lite' },
    { brand: 'Ubiquiti', brandId: 'ubiquiti', name: 'Ubiquiti UniFi Switch Pro 24 PoE', price: 1299, ports: '24×1G + 2×SFP+', poe: 'PoE+ 400W', speed: '1G / 10G', manage: 'UniFi OS', isNew: true },
    { brand: 'Ubiquiti', brandId: 'ubiquiti', name: 'Ubiquiti UniFi Lite 16 PoE', price: 429, ports: '16×1G', poe: 'PoE+ 45W', speed: '1 Gbps', manage: 'UniFi' },
    { brand: 'TP-Link', brandId: 'tp-link', name: 'TP-Link TL-SG3428 JetStream', price: 359, ports: '24×1G + 4×SFP', poe: 'Yox', speed: '1 Gbps', manage: 'L2+' },
    { brand: 'TP-Link', brandId: 'tp-link', name: 'TP-Link TL-SG108-M2 2.5G', price: 229, ports: '8×2.5G', poe: 'Yox', speed: '2.5 Gbps', manage: 'Unmanaged', isNew: true },
    { brand: 'HPE', brandId: 'hpe', name: 'HPE Aruba 1930 24G PoE+', price: 799, ports: '24×1G + 4×SFP+', poe: 'PoE+ 370W', speed: '1G / 10G', manage: 'Cloud / local' },
    { brand: 'Huawei', brandId: 'huawei', name: 'Huawei S5735 24P4S', price: 1099, ports: '24×1G + 4×SFP', poe: 'PoE+', speed: '1 Gbps', manage: 'Layer 3' },
    { brand: 'NETGEAR', brandId: 'netgear', name: 'NETGEAR GS724T Smart Switch', price: 449, ports: '24×1G + 2×SFP', poe: 'Yox', speed: '1 Gbps', manage: 'Smart' }
  ];

  switches.forEach(function (s, idx) {
    list.push(makeProduct(n++, {
      brand: s.brand, brandId: s.brandId, name: s.name, subcategory: 'switches',
      price: s.price, oldPrice: s.oldPrice, isNew: s.isNew,
      image: IMG.switch[idx % IMG.switch.length],
      description: s.brand + ' idarə olunan şəbəkə switch — ofis və server otağı üçün. ' + s.ports + '.',
      specs: {
        'Port sayı': s.ports,
        'PoE': s.poe,
        'Keçiricilik': s.speed,
        'İdarəetmə': s.manage,
        'Form-faktor': '1U rackmount',
        'Montaj': '19" rack',
        'VLAN': '802.1Q dəstəyi',
        'Güc': 'AC 100–240V'
      }
    }));
  });

  const routers = [
    { brand: 'Cisco', brandId: 'cisco', name: 'Cisco ISR 4331 Integrated Router', price: 3499, wan: '3×GE', wifi: 'Yox (modullu)', vpn: 'IPSec / SSL', thr: '100+ Mbps', isNew: true },
    { brand: 'Cisco', brandId: 'cisco', name: 'Cisco RV340 Dual WAN VPN', price: 699, wan: '2×GE WAN', wifi: 'Yox', vpn: '50 tunnel', thr: '900 Mbps' },
    { brand: 'MikroTik', brandId: 'mikrotik', name: 'MikroTik RB4011iGS+RM', price: 389, wan: '10×1G + 1×SFP+', wifi: 'Yox', vpn: 'IPsec hardware', thr: 'Multi-gig', isNew: true },
    { brand: 'MikroTik', brandId: 'mikrotik', name: 'MikroTik hAP ax³ Wi-Fi 6', price: 199, wan: '1×2.5G + 4×1G', wifi: 'Wi-Fi 6 AX', vpn: 'WireGuard / IPsec', thr: 'Ax class' },
    { brand: 'MikroTik', brandId: 'mikrotik', name: 'MikroTik CCR2004-16G-2S+', price: 599, wan: '16×1G + 2×SFP+', wifi: 'Yox', vpn: 'Hardware offload', thr: 'Yüksək', isNew: true },
    { brand: 'Ubiquiti', brandId: 'ubiquiti', name: 'Ubiquiti UniFi Dream Machine SE', price: 899, wan: '8×1G + 2.5G WAN', wifi: 'Wi-Fi 6', vpn: 'UniFi VPN', thr: '3.5 Gbps IDS' },
    { brand: 'Ubiquiti', brandId: 'ubiquiti', name: 'Ubiquiti EdgeRouter 4', price: 279, wan: '3×1G + SFP', wifi: 'Yox', vpn: 'IPsec / OpenVPN', thr: '3.4 Mpps' },
    { brand: 'TP-Link', brandId: 'tp-link', name: 'TP-Link Omada ER7212PC', price: 449, wan: 'Multi-WAN', wifi: 'Controller + PoE', vpn: 'Omada VPN', thr: 'Gigabit', isNew: true },
    { brand: 'TP-Link', brandId: 'tp-link', name: 'TP-Link Archer AX73 Wi-Fi 6', price: 179, wan: '1×GE', wifi: 'AX5400', vpn: 'VPN client', thr: 'AX' },
    { brand: 'Huawei', brandId: 'huawei', name: 'Huawei AR6121 Enterprise Router', price: 1299, wan: 'Multi-GE', wifi: 'Yox', vpn: 'IPSec', thr: 'Enterprise' },
    { brand: 'NETGEAR', brandId: 'netgear', name: 'NETGEAR Nighthawk RAXE300', price: 399, wan: '1×2.5G', wifi: 'Wi-Fi 6E', vpn: 'VPN support', thr: 'AXE', isNew: true },
    { brand: 'HPE', brandId: 'hpe', name: 'HPE Aruba Gateway 9004', price: 2499, wan: '4×1G/SFP', wifi: 'Controller', vpn: 'Aruba VPN', thr: 'Branch SD-WAN' }
  ];

  routers.forEach(function (s, idx) {
    list.push(makeProduct(n++, {
      brand: s.brand, brandId: s.brandId, name: s.name, subcategory: 'routers',
      price: s.price, isNew: s.isNew,
      image: IMG.router[idx % IMG.router.length],
      description: s.brand + ' router — filial / ofis şəbəkəsi və VPN üçün. WAN: ' + s.wan + '.',
      specs: {
        'WAN / LAN': s.wan,
        'Wi-Fi': s.wifi,
        VPN: s.vpn,
        Performans: s.thr,
        'İdarəetmə': 'Web / CLI / Cloud',
        'Form-faktor': idx % 3 === 0 ? '1U rackmount' : 'Desktop / rack kit',
        Firewall: 'Stateful firewall',
        'QoS': 'Var'
      }
    }));
  });

  const racks = [
    { brand: 'Tritón', brandId: 'triton', name: 'Tritón 9U Divar Mount Kabinet', price: 289, u: '9U', depth: '450 mm', type: 'Divar', glass: 'Şüşə qapı', isNew: true },
    { brand: 'Tritón', brandId: 'triton', name: 'Tritón 12U Divar Kabinet', price: 359, u: '12U', depth: '600 mm', type: 'Divar', glass: 'Şüşə qapı' },
    { brand: 'Tritón', brandId: 'triton', name: 'Tritón 22U Floor Standing', price: 899, u: '22U', depth: '800 mm', type: 'Yerləşən', glass: 'Şüşə + mesh', isNew: true },
    { brand: 'Tritón', brandId: 'triton', name: 'Tritón 42U Server Rack 800×1000', price: 1899, u: '42U', depth: '1000 mm', type: 'Yerləşən', glass: 'Mesh qapı' },
    { brand: 'APC', brandId: 'apc', name: 'APC NetShelter SX 24U', price: 1599, u: '24U', depth: '1070 mm', type: 'Yerləşən', glass: 'Perforated', isNew: true },
    { brand: 'APC', brandId: 'apc', name: 'APC NetShelter SX 42U', price: 2799, u: '42U', depth: '1070 mm', type: 'Yerləşən', glass: 'Perforated' },
    { brand: 'APC', brandId: 'apc', name: 'APC AR100HD 13U Wall Cabinet', price: 649, u: '13U', depth: '600 mm', type: 'Divar', glass: 'Şüşə' },
    { brand: 'HPE', brandId: 'hpe', name: 'HPE 42U 600×1200 Rack', price: 2499, u: '42U', depth: '1200 mm', type: 'Yerləşən', glass: 'Mesh', isNew: true },
    { brand: 'Dell EMC', brandId: 'dell-emc', name: 'Dell EMC Ready Rack 42U', price: 2699, u: '42U', depth: '1200 mm', type: 'Yerləşən', glass: 'Mesh' },
    { brand: 'Tritón', brandId: 'triton', name: 'Tritón 18U Server Kabinet', price: 699, u: '18U', depth: '800 mm', type: 'Yerləşən', glass: 'Şüşə qapı' },
    { brand: 'APC', brandId: 'apc', name: 'APC Vertical PDU Kit 32A', price: 499, u: 'PDU', depth: '—', type: 'Aksessuar', glass: '—', badge: 'Aksessuar' },
    { brand: 'Tritón', brandId: 'triton', name: 'Tritón 42U Soyuq Koridor Kabinet', price: 3299, u: '42U', depth: '1200 mm', type: 'Yerləşən', glass: 'Mesh + brush', isNew: true, oldPrice: 3599 }
  ];

  racks.forEach(function (s, idx) {
    list.push(makeProduct(n++, {
      brand: s.brand, brandId: s.brandId, name: s.name, subcategory: 'racks',
      price: s.price, oldPrice: s.oldPrice, isNew: s.isNew,
      badge: s.badge, badgeType: s.badge ? 'info' : (s.isNew ? 'new' : ''),
      image: IMG.rack[idx % IMG.rack.length],
      description: s.u + ' server rak / kabinet — ' + s.type.toLowerCase() + ' tip, dərinlik ' + s.depth + '.',
      specs: {
        'U hündürlük': s.u,
        Dərinlik: s.depth,
        Tip: s.type,
        Qapı: s.glass,
        'Montaj eni': '19 inch',
        Material: 'Polad gövdə',
        Soyutma: 'Fan paneli hazırlığı',
        'Yük tutumu': s.u === '42U' ? '800–1000 kg' : (s.u === 'PDU' ? '—' : '100–500 kg'),
        Rəng: 'Qara RAL 9005'
      }
    }));
  });

  const servers = [
    { brand: 'Dell EMC', brandId: 'dell-emc', name: 'Dell PowerEdge R350 1U', price: 4299, oldPrice: 4699, cpu: 'Intel Xeon E-2300', ram: '32 GB DDR4', storage: '2×1.2 TB SAS', form: '1U', isNew: true },
    { brand: 'Dell EMC', brandId: 'dell-emc', name: 'Dell PowerEdge R750 2U', price: 8999, cpu: '2× Xeon Silver', ram: '128 GB DDR4', storage: '4×1.92 TB SSD', form: '2U', isNew: true },
    { brand: 'HPE', brandId: 'hpe', name: 'HPE ProLiant DL360 Gen10+', price: 7599, cpu: 'Xeon Silver', ram: '64 GB DDR4', storage: '2×960 GB SSD', form: '1U' },
    { brand: 'HPE', brandId: 'hpe', name: 'HPE ProLiant DL380 Gen10+', price: 9999, cpu: '2× Xeon Gold', ram: '128 GB', storage: '8×bay SAS/SATA', form: '2U', isNew: true },
    { brand: 'Huawei', brandId: 'huawei', name: 'Huawei FusionServer 2288H V6', price: 6799, cpu: '2× Xeon Scalable', ram: '64 GB', storage: '8×2.5"', form: '2U' },
    { brand: 'Dell EMC', brandId: 'dell-emc', name: 'Dell PowerEdge T150 Tower', price: 2899, cpu: 'Xeon E-2300', ram: '16 GB', storage: '2×2 TB HDD', form: 'Tower' },
    { brand: 'HPE', brandId: 'hpe', name: 'HPE ProLiant MicroServer Gen10+', price: 1499, cpu: 'X3216 / Athlon', ram: '16 GB', storage: '4×LFF', form: 'Mini tower', isNew: true },
    { brand: 'Cisco', brandId: 'cisco', name: 'Cisco UCS C220 M6 1U', price: 11200, cpu: '2× Xeon Scalable', ram: '128 GB', storage: '10×SFF', form: '1U' }
  ];

  servers.forEach(function (s, idx) {
    list.push(makeProduct(n++, {
      brand: s.brand, brandId: s.brandId, name: s.name, subcategory: 'servers',
      price: s.price, oldPrice: s.oldPrice, isNew: s.isNew,
      image: IMG.server[idx % IMG.server.length],
      description: s.form + ' server — ' + s.cpu + ', ' + s.ram + ' RAM. Data mərkəzi və ofis üçün.',
      specs: {
        Prosessor: s.cpu,
        RAM: s.ram,
        Yaddaş: s.storage,
        'Form-faktor': s.form,
        RAID: 'Hardware RAID dəstəyi',
        Şəbəkə: '2×1G / 10G (modeldən asılı)',
        'Uzaq idarəetmə': 'iDRAC / iLO / BMC',
        Qidalanma: 'Redundant PSU hazırlığı',
        'Əməliyyat sistemi': 'Windows Server / Linux uyğun'
      }
    }));
  });

  return list;
}

function main() {
  const productsData = readJson('products.json');
  const categoriesData = readJson('categories.json');
  const brandsData = readJson('brands.json');

  // Remove previous server-catalog products if re-run
  productsData.products = (productsData.products || []).filter(function (p) {
    return p.category !== 'server';
  });

  const maxNum = productsData.products.reduce(function (m, p) {
    const n = parseInt(String(p.id || '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);

  const created = buildProducts(maxNum + 1);
  productsData.products = productsData.products.concat(created);
  productsData.version = Number(productsData.version || 1) + 1;

  // Categories
  let cats = categoriesData.categories || [];
  cats = cats.filter(function (c) { return c.id !== 'server'; });
  CAT.count = created.length;
  cats.push(CAT);
  categoriesData.categories = cats;

  // Brands
  const brandIds = {};
  (brandsData.brands || []).forEach(function (b) { brandIds[b.id] = true; });
  NEW_BRANDS.forEach(function (b) {
    if (!brandIds[b.id]) brandsData.brands.push(b);
  });

  writeJson('products.json', productsData);
  writeJson('categories.json', categoriesData);
  writeJson('brands.json', brandsData);

  // Upsert DB
  const { db, productToRow } = require(path.join(ROOT, 'server', 'src', 'db'));
  const insertProduct = db.prepare(`
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
  const insertCategory = db.prepare('INSERT OR REPLACE INTO categories (id, data_json) VALUES (?, ?)');

  const tx = db.transaction(function () {
    // wipe old server products from db
    db.prepare("DELETE FROM products WHERE category = 'server'").run();
    created.forEach(function (p) { insertProduct.run(productToRow(p)); });
    // refresh all category rows from file
    db.prepare('DELETE FROM categories').run();
    cats.forEach(function (c) {
      insertCategory.run(c.id, JSON.stringify(c));
    });
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'catalog_version',
      String(productsData.version)
    );
    // CMS categories doc
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)')
      .run('categories', JSON.stringify(categoriesData), now);
    db.prepare('INSERT OR REPLACE INTO cms_docs (key, data_json, updated_at) VALUES (?, ?, ?)')
      .run('brands', JSON.stringify(brandsData), now);
  });
  tx();

  const bySub = {};
  created.forEach(function (p) {
    bySub[p.subcategory] = (bySub[p.subcategory] || 0) + 1;
  });

  console.log(JSON.stringify({
    ok: true,
    added: created.length,
    bySub: bySub,
    totalProducts: productsData.products.length,
    version: productsData.version,
    category: CAT.id
  }, null, 2));
}

main();
