'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const file = path.join(ROOT, 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const exist = new Set(data.products.map((p) => p.id));

function make(p) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    brandId: p.brandId,
    category: p.category,
    subcategory: p.subcategory,
    price: p.price,
    oldPrice: p.oldPrice || null,
    currency: '₼',
    rating: p.rating || 4.5,
    reviews: p.reviews || 48,
    badge: p.badge || '',
    badgeType: p.badgeType || '',
    inStock: true,
    stock: p.stock || 60,
    isNew: !!p.isNew,
    tags: p.tags,
    description: p.description,
    specs: Object.assign({
      Brend: p.brand,
      Model: p.name,
      SKU: p.sku,
      Kateqoriya: p.category,
      'Alt kateqoriya': p.subcategory,
      Zəmanət: '12 ay rəsmi zəmanət',
      Çatdırılma: '1–3 iş günü (Bakı), 2–5 gün (regionlar)',
      Qaytarma: '14 gün ərzində dəyişmə / qaytarma'
    }, p.specs || {}),
    images: [p.image],
    gradient: p.gradient,
    reviewList: [],
    image: p.image
  };
}

const office = [
  make({
    id: 'p0635', sku: 'HP-PRT-0635', name: 'HP LaserJet Pro M404dn',
    brand: 'HP', brandId: 'hp', category: 'electronics', subcategory: 'printers',
    price: 449, oldPrice: 499, badge: '-10%', badgeType: 'sale', isNew: true,
    tags: ['electronics', 'printers', 'hp', 'nexora', 'office'],
    description: 'Mono lazer printer — ofis çapı üçün sürətli və qənaətcil. Duplex, Ethernet.',
    specs: { Tip: 'Mono lazer', Sürət: '38 səh/dəq', Duplex: 'Avtomatik', Bağlantı: 'USB / Ethernet' },
    image: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)'
  }),
  make({
    id: 'p0636', sku: 'HP-PRT-0636', name: 'HP LaserJet MFP M428fdw',
    brand: 'HP', brandId: 'hp', category: 'electronics', subcategory: 'printers',
    price: 799, tags: ['electronics', 'printers', 'hp', 'nexora', 'office', 'mfp'],
    description: 'Çoxfunksiyalı lazer — çap, skan, kopiya, faks. Wi‑Fi və Ethernet.',
    specs: { Tip: 'MFP mono lazer', Sürət: '38 səh/dəq', Funksiya: 'Print / Scan / Copy / Fax', Bağlantı: 'Wi‑Fi / Ethernet / USB' },
    image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)'
  }),
  make({
    id: 'p0637', sku: 'BR-PRT-0637', name: 'Brother HL-L2460DW',
    brand: 'Brother', brandId: 'brother', category: 'electronics', subcategory: 'printers',
    price: 289, tags: ['electronics', 'printers', 'brother', 'nexora', 'office'],
    description: 'Kompakt ofis printeri — Wi‑Fi, avtomatik ikitərəfli çap.',
    specs: { Tip: 'Mono lazer', Sürət: '34 səh/dəq', Duplex: 'Avtomatik', Bağlantı: 'Wi‑Fi / USB' },
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)'
  }),
  make({
    id: 'p0638', sku: 'CN-PRT-0638', name: 'Canon imageCLASS MF455dw',
    brand: 'Canon', brandId: 'canon', category: 'electronics', subcategory: 'printers',
    price: 649, tags: ['electronics', 'printers', 'canon', 'nexora', 'office', 'mfp'],
    description: 'Ofis MFP — yüksək həcmli çap və skan. Ethernet + Wi‑Fi.',
    specs: { Tip: 'MFP mono lazer', Sürət: '40 səh/dəq', Funksiya: 'Print / Scan / Copy', Bağlantı: 'Wi‑Fi / Ethernet' },
    image: 'https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)'
  }),
  make({
    id: 'p0639', sku: 'APC-UPS-0639', name: 'APC Back-UPS 650VA',
    brand: 'APC', brandId: 'apc', category: 'electronics', subcategory: 'ups',
    price: 149, isNew: true, badge: 'Yeni', badgeType: 'new',
    tags: ['electronics', 'ups', 'apc', 'nexora', 'office', 'power'],
    description: '650VA UPS — kompüter və router üçün qısa elektrik kəsilməsinə qarşı.',
    specs: { Güc: '650 VA / 360 W', Tip: 'Line-interactive', Rozetka: '3× backup', Runtime: '~5–15 dəq' },
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #0f2027, #203a43)'
  }),
  make({
    id: 'p0640', sku: 'APC-UPS-0640', name: 'APC Back-UPS Pro 1500VA',
    brand: 'APC', brandId: 'apc', category: 'electronics', subcategory: 'ups',
    price: 399, tags: ['electronics', 'ups', 'apc', 'nexora', 'office', 'power'],
    description: '1500VA Pro UPS — ofis iş stansiyası və şəbəkə avadanlığı üçün.',
    specs: { Güc: '1500 VA / 865 W', Tip: 'Line-interactive', Rozetka: '10×', Runtime: '~10–30 dəq', LCD: 'Bəli' },
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #0f2027, #203a43)'
  }),
  make({
    id: 'p0641', sku: 'EAT-UPS-0641', name: 'Eaton 5E 850VA UPS',
    brand: 'Eaton', brandId: 'eaton', category: 'electronics', subcategory: 'ups',
    price: 179, tags: ['electronics', 'ups', 'eaton', 'nexora', 'office', 'power'],
    description: '850VA UPS — masaüstü PC və monitor üçün etibarlı qoruma.',
    specs: { Güc: '850 VA / 480 W', Tip: 'Line-interactive', Rozetka: '4×', Runtime: '~5–20 dəq' },
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #0f2027, #203a43)'
  }),
  make({
    id: 'p0642', sku: 'CP-UPS-0642', name: 'CyberPower UT1500EG',
    brand: 'CyberPower', brandId: 'cyberpower', category: 'electronics', subcategory: 'ups',
    price: 229, tags: ['electronics', 'ups', 'cyberpower', 'nexora', 'office', 'power'],
    description: '1500VA UPS — kiçik ofis şəbəkəsi və printer üçün.',
    specs: { Güc: '1500 VA / 900 W', Tip: 'Line-interactive', Rozetka: '6×', Runtime: '~8–25 dəq' },
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&h=1000&q=80',
    gradient: 'linear-gradient(135deg, #0f2027, #203a43)'
  })
];

let added = 0;
for (const p of office) {
  if (!exist.has(p.id)) {
    data.products.push(p);
    exist.add(p.id);
    added += 1;
  }
}
data.version = Math.max(Number(data.version) || 0, 18);
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('added', added, 'total', data.products.length, 'version', data.version);

try {
  const Database = require(path.join(ROOT, 'server', 'node_modules', 'better-sqlite3'));
  const { productToRow } = require(path.join(ROOT, 'server', 'src', 'db'));
  const candidates = [
    path.join(ROOT, 'server', 'data', 'nexora.db'),
    path.join(ROOT, 'server', 'nexora.db'),
    path.join(ROOT, 'data', 'nexora.db')
  ];
  const dbFile = candidates.find((f) => fs.existsSync(f));
  if (!dbFile) {
    console.log('no db file, skip upsert');
    process.exit(0);
  }
  const db = new Database(dbFile);
  const stmt = db.prepare(`
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
  const tx = db.transaction((rows) => {
    for (const r of rows) stmt.run(productToRow(r));
  });
  tx(office);
  console.log('upserted', office.length, 'into', dbFile);
  db.close();
} catch (e) {
  console.log('db upsert skipped:', e.message);
}
