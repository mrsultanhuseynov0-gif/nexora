'use strict';

const { db, rowToProduct } = require('./db');

/** Common typos / slang → canonical tokens */
const SPELL_MAP = [
  [/kompuyuter|kompyuter|komputer|kompüter|komputerler|komp\b|pk\b/gi, 'komputer'],
  [/noutbuk|noutbook|notbuk|laptob|labtop|notebook/gi, 'noutbuk'],
  [/smartfon|smartphone|telefon|telefone|telofon|mobil\s*telefon/gi, 'smartfon'],
  [/qulaqliq|qulaqlıq|qulakliq|airpod|airpods/gi, 'qulaqlıq'],
  [/ayaqqabi|ayaqqabı|ayaqabi|krossovka|krosovka/gi, 'ayaqqabı'],
  [/televizor|telvizor|\btv\b/gi, 'tv'],
  [/meslehet|məsləhət|meslexet|meslehetci/gi, 'məsləhət'],
  [/isteyirem|istəyirəm|isterem|istiyirem/gi, 'istəyirəm'],
  [/gorersen|görərsən|gorsen|göster|goster/gi, 'görərsən'],
  [/hansi|hansı|hansini|hansını/gi, 'hansı'],
  [/ucun|üçün/gi, 'üçün'],
  [/budce|büdcə|budget/gi, 'büdcə'],
  [/oyun|gaming|gamer/gi, 'oyun'],
  [/ofis|office|iş\s*üçün|is\s*ucun/gi, 'ofis'],
  [/telebe|tələbə|student|mekteb|məktəb|uni/gi, 'tələbə'],
  [/montaj|video\s*edit|photoshop|dizayn|yaradici|yaradıcı/gi, 'yaradıcı']
];

function normalizeText(raw) {
  let s = String(raw || '').trim().toLowerCase();
  SPELL_MAP.forEach(function (pair) {
    s = s.replace(pair[0], pair[1]);
  });
  // strip AZ diacritics for matching helpers
  const ascii = s
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c');
  return { raw: String(raw || '').trim(), norm: s, ascii: ascii };
}

const CATEGORY_RULES = [
  { re: /smartfon|iphone|samsung\s*galaxy|xiaomi|redmi|pixel|mobil/i, category: 'electronics', subcategory: 'smartphones', label: 'smartfon' },
  { re: /noutbuk|laptop|macbook|notebook/i, category: 'electronics', subcategory: 'laptops', label: 'noutbuk' },
  { re: /komputer|\bpc\b|masaüstü|masaustu|desktop/i, category: 'electronics', subcategory: 'laptops', label: 'kompüter / noutbuk', also: ['gaming'] },
  { re: /switch|svic|свитч|poe\s*switch|katalizator|catalyst|unifi\s*switch/i, category: 'server', subcategory: 'switches', label: 'switch' },
  { re: /router|routер|маршрутизатор|edge\s*router|dream\s*machine|vpn\s*router/i, category: 'server', subcategory: 'routers', label: 'router' },
  { re: /rack|rak|kabinet|server\s*kabinet|netshelter|skaf|şkaf/i, category: 'server', subcategory: 'racks', label: 'server rak / kabinet' },
  { re: /server|poweredge|proliant|rackmount\s*server|data\s*mərkəz|data\s*merkez/i, category: 'server', subcategory: 'servers', label: 'server' },
  { re: /şəbəkə|shebeke|network|infra|infrastruktur|cisco|mikrotik|ubiquiti/i, category: 'server', subcategory: null, label: 'server & şəbəkə' },
  { re: /qulaqlıq|airpods|earbuds|audio|dinamik|kolonka|speaker|headphone/i, category: 'electronics', subcategory: 'audio', label: 'audio' },
  { re: /oyun|gaming|gamer|playstation|xbox|konsol/i, category: 'electronics', subcategory: 'gaming', label: 'oyun / gaming', also: ['laptops'] },
  { re: /\btv\b|televizor|monitor|ekran/i, category: 'electronics', subcategory: 'tv', label: 'TV / monitor' },
  { re: /kamera|fotoapparat|lens/i, category: 'electronics', subcategory: 'cameras', label: 'kamera' },
  { re: /saat|watch|wearable|fitness\s*band/i, category: 'electronics', subcategory: 'wearables', label: 'smart saat' },
  { re: /ayaqqabı|krossovka|sneakers|\bshoes\b/i, category: null, subcategory: 'shoes', label: 'ayaqqabı', preferSports: true },
  { re: /idman|fitness|yoga|qaçış|qacis|sport|dumbbell|velosiped/i, category: 'sports', subcategory: null, label: 'idman' },
  { re: /geyim|moda|paltar|apparel|jacket|hoodie/i, category: 'fashion', subcategory: 'apparel', label: 'geyim' },
  { re: /ev|mətbəx|metbex|tozsoran|blender|appliances|mebel|dekor/i, category: 'home', subcategory: null, label: 'ev / məişət' },
  { re: /smart\s*home|ağıllı\s*ev|agilli\s*ev/i, category: 'home', subcategory: 'smart-home', label: 'ağıllı ev' },
  { re: /gözəllik|gozellik|kosmetika|serum|krem|makeup|skincare/i, category: 'beauty', subcategory: null, label: 'gözəllik' },
  { re: /uşaq|usaq|oyuncaq|lego|kids|toys/i, category: 'kids', subcategory: null, label: 'uşaq' },
  { re: /avto|maşın|masin|avtomobil|\bcar\b/i, category: 'auto', subcategory: null, label: 'avto' },
  { re: /kitab|hobi|book|roman/i, category: 'books', subcategory: null, label: 'kitab / hobi' }
];

const BRAND_HINTS = [
  'apple', 'samsung', 'xiaomi', 'huawei', 'sony', 'lg', 'asus', 'lenovo', 'hp', 'dell',
  'acer', 'msi', 'nike', 'adidas', 'puma', 'dyson', 'bosch', 'philips', 'jbl', 'bose',
  'canon', 'nikon', 'logitech', 'razer', 'google', 'oppo', 'realme', 'honor',
  'cisco', 'mikrotik', 'ubiquiti', 'tp-link', 'hpe', 'netgear', 'apc'
];

const USE_CASES = [
  { id: 'gaming', re: /oyun|gaming|gamer|fps|cyberpunk|valorant|cs2|steam/i, label: 'oyun', boost: /gaming|oyun|rtx|geforce|radeon|tuf|victus|legion|rog|msi/i },
  { id: 'office', re: /ofis|office|is\s|iş\s|word|excel|zoom|meeting/i, label: 'ofis / iş', boost: /business|latitude|thinkpad|elitebook|probook|office|ultrabook/i },
  { id: 'student', re: /tələbə|telebe|student|məktəb|mekteb|uni|ders|dərs/i, label: 'tələbə', boost: /air|slim|lightweight|student|ideapad|vivobook|aspire/i },
  { id: 'creative', re: /yaradıcı|yaradici|montaj|video|photoshop|dizayn|render|4k/i, label: 'yaradıcı iş', boost: /macbook|studio|creator|oled|color|accurate|pro\b|max\b/i }
];

function parseIntent(text, history) {
  const n = normalizeText(text);
  const hist = Array.isArray(history) ? history.join(' ') : '';
  const histN = normalizeText(hist);
  const hay = (n.norm + ' ' + histN.norm).trim();
  const hayAscii = (n.ascii + ' ' + histN.ascii).trim();

  let budget = null;
  // Require currency marker OR explicit budget words — avoid "24 port" → 24 AZN
  const budgetRe = /(\d{2,6}(?:[.,]\d+)?)\s*(azn|₼|manat|man\.?)/gi;
  let m;
  const budgets = [];
  while ((m = budgetRe.exec(hay)) !== null) {
    budgets.push(Number(String(m[1]).replace(',', '.')));
  }
  // Also: "büdcə 1500" / "budget 1500" without unit
  const budgetWord = hay.match(/(?:büdcə|budce|budget|max|maksimum)\s*[:=]?\s*(\d{3,6})/i);
  if (budgetWord) budgets.push(Number(budgetWord[1]));
  if (budgets.length) budget = Math.max.apply(null, budgets);

  const range = hay.match(/(\d{3,6})\s*[-–—]\s*(\d{3,6})\s*(azn|₼|manat)?/i);
  let budgetMin = null;
  if (range && (range[3] || /büdcə|budce|budget/i.test(hay))) {
    budgetMin = Number(range[1]);
    budget = Number(range[2]);
  }
  if (/ucuz|ekonom|budget|ucuzuna/i.test(hayAscii) && !budget) budget = 800;
  if (/orta/i.test(hayAscii) && !budget) budget = 1800;
  if (/premium|ela|flagman|yuxari|bahali/i.test(hayAscii) && !budget) budget = 4500;

  let category = null;
  let subcategory = null;
  let label = null;
  const alsoSubs = [];
  let preferSportsShoes = false;

  for (let i = 0; i < CATEGORY_RULES.length; i++) {
    const rule = CATEGORY_RULES[i];
    if (rule.re.test(hay) || rule.re.test(hayAscii)) {
      if (rule.preferSports) preferSportsShoes = true;
      if (!category && rule.category) category = rule.category;
      if (!subcategory && rule.subcategory) subcategory = rule.subcategory;
      if (!label) label = rule.label;
      if (rule.also) alsoSubs.push.apply(alsoSubs, rule.also);
      if (category && subcategory && !preferSportsShoes) break;
      if (preferSportsShoes && subcategory === 'shoes' && category === 'sports') break;
    }
  }
  if (preferSportsShoes && subcategory === 'shoes') {
    category = category || 'sports';
    label = 'idman ayaqqabısı';
  }

  // Use-case
  let useCase = null;
  for (let i = 0; i < USE_CASES.length; i++) {
    if (USE_CASES[i].re.test(hay) || USE_CASES[i].re.test(hayAscii)) {
      useCase = USE_CASES[i];
      break;
    }
  }

  if (useCase && useCase.id === 'gaming' && (category === 'electronics' || /komputer|noutbuk|pc/i.test(hayAscii))) {
    category = 'electronics';
    subcategory = 'laptops';
    label = 'oyun noutbuku';
    alsoSubs.push('gaming');
  }

  let brand = null;
  for (let i = 0; i < BRAND_HINTS.length; i++) {
    const b = BRAND_HINTS[i];
    if (new RegExp('\\b' + b + '\\b', 'i').test(hayAscii) || new RegExp('\\b' + b + '\\b', 'i').test(hay)) {
      brand = b;
      break;
    }
  }

  const keywords = [];
  const kwRe = /\b(ram|ssd|oled|amoled|5g|wifi|bluetooth|rgb|pro|max|ultra|air|plus)\b/gi;
  let km;
  while ((km = kwRe.exec(hayAscii)) !== null) keywords.push(km[1].toLowerCase());

  const askingAdvice = /məsləhət|meslehet|hansı|tövsiyə|tovsiye|seçim|secim|alım|alim|lazımdır|lazimdir|uyğun|uygun|görərsən|gorersen/i.test(hay);
  const vague = askingAdvice && !budget && !brand && !useCase;

  // If they said computer/phone but nothing else — mark needsClarify
  const needsClarify = !!(
    (category || subcategory) &&
    !budget &&
    !brand &&
    !useCase &&
    askingAdvice
  );

  return {
    text: n.raw,
    normalized: n.norm,
    budget,
    budgetMin,
    category,
    subcategory,
    alsoSubs: unique(alsoSubs),
    brand,
    keywords,
    label,
    inStockOnly: true,
    gaming: !!(useCase && useCase.id === 'gaming') || /oyun|gaming/i.test(hay),
    useCase: useCase ? useCase.id : null,
    useCaseLabel: useCase ? useCase.label : null,
    useCaseBoost: useCase ? useCase.boost : null,
    askingAdvice,
    vague,
    needsClarify,
    corrected: n.norm !== String(text || '').trim().toLowerCase()
  };
}

function unique(arr) {
  const out = [];
  (arr || []).forEach(function (x) {
    if (x && out.indexOf(x) === -1) out.push(x);
  });
  return out;
}

function scoreProduct(p, intent) {
  let s = 0;
  const blob = [
    p.name, p.brand, p.category, p.subcategory, p.description,
    (p.tags || []).join(' '),
    JSON.stringify(p.specs || {})
  ].join(' ').toLowerCase();

  if (intent.category && p.category === intent.category) s += 8;
  if (intent.subcategory && p.subcategory === intent.subcategory) s += 14;
  else if (intent.alsoSubs && intent.alsoSubs.indexOf(p.subcategory) >= 0) s += 8;

  if (intent.brand) {
    if (String(p.brand || '').toLowerCase().indexOf(intent.brand) >= 0) s += 12;
    else if (blob.indexOf(intent.brand) >= 0) s += 6;
    else s -= 2;
  }

  if (intent.useCaseBoost && intent.useCaseBoost.test(blob)) s += 10;
  if (intent.gaming && /gaming|oyun|rtx|geforce|radeon|tuf|victus|legion|rog/i.test(blob)) s += 8;

  // Office: prefer mid-light laptops, demote heavy gaming names unless asked
  if (intent.useCase === 'office' || intent.useCase === 'student') {
    if (/gaming|rtx|tuf|victus|rog/i.test(blob)) s -= 4;
    if (/ultrabook|air|slim|thinkpad|latitude|business/i.test(blob)) s += 5;
  }

  // Prefer exact U-size / port count mentioned in query
  const uMatch = String(intent.text || '').match(/(\d{1,2})\s*u\b/i);
  if (uMatch && intent.subcategory === 'racks') {
    if (new RegExp(uMatch[1] + '\\s*u', 'i').test(p.name + ' ' + JSON.stringify(p.specs || {}))) s += 12;
  }
  const portMatch = String(intent.text || '').match(/(\d{1,2})\s*port/i);
  if (portMatch && intent.subcategory === 'switches') {
    if (new RegExp(portMatch[1] + '\\s*-?\\s*port|' + portMatch[1] + '×|' + portMatch[1] + 'x', 'i').test(p.name)) s += 10;
  }

  s += (Number(p.rating) || 0) * 1.2;
  s += Math.min(3, (Number(p.reviews) || 0) / 50);
  if (p.isNew) s += 1;
  if (p.inStock !== false && (p.stock || 0) > 0) s += 2;
  if ((p.stock || 0) <= 0) s -= 8;

  if (intent.budget != null) {
    const price = Number(p.price) || 0;
    if (price > intent.budget * 1.1) return -1;
    const ratio = intent.budget > 0 ? price / intent.budget : 0;
    if (ratio >= 0.55 && ratio <= 1) s += 7;
    else if (ratio >= 0.35) s += 4;
    else if (ratio < 0.25) s -= 1;
    if (intent.budgetMin != null && price < intent.budgetMin) s -= 4;
  } else if (intent.needsClarify || intent.vague) {
    // Prefer mid-market when no budget — avoid always recommending cheapest or most expensive
    const price = Number(p.price) || 0;
    if (intent.subcategory === 'laptops' || intent.label && /komp|nout/i.test(intent.label)) {
      if (price >= 900 && price <= 2800) s += 6;
      else if (price >= 600 && price < 900) s += 3;
      else if (price > 3500) s -= 2;
    }
  }

  // tiny deterministic jitter from id so ties don't always pick same order
  let h = 0;
  const id = String(p.id || '');
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 3)) % 97;
  s += (h % 10) * 0.05;

  return s;
}

function whyFor(p, intent, tier) {
  const reasons = [];
  if (tier) reasons.push(tier);
  if (intent.budget != null && p.price <= intent.budget) {
    reasons.push('Büdcəyə uyğun (' + Math.round(p.price) + ' ₼)');
  }
  if (intent.useCaseLabel) reasons.push(intent.useCaseLabel + ' üçün');
  if (intent.brand && String(p.brand || '').toLowerCase().indexOf(intent.brand) >= 0) {
    reasons.push(p.brand + ' brendi');
  }
  if (p.rating >= 4.5) reasons.push('Reyting ' + p.rating);
  if (intent.gaming && /gaming|oyun|rtx|tuf|victus|legion/i.test(p.name)) {
    reasons.push('Oyun yönümlü');
  }
  if (!reasons.length) reasons.push('Kataloq uyğunluğu');
  return reasons.slice(0, 3);
}

function diversify(ranked, limit, intent) {
  // Pick across price tiers + brands so vague queries aren't identical every time
  const buckets = { budget: [], mid: [], premium: [] };
  ranked.forEach(function (x) {
    const price = Number(x.p.price) || 0;
    if (price < 1000) buckets.budget.push(x);
    else if (price <= 2500) buckets.mid.push(x);
    else buckets.premium.push(x);
  });

  const picked = [];
  const seenBrand = {};
  const order = intent.useCase === 'gaming'
    ? ['mid', 'premium', 'budget', 'mid', 'premium', 'budget', 'mid', 'premium']
    : intent.useCase === 'student' || intent.useCase === 'office'
      ? ['budget', 'mid', 'mid', 'premium', 'budget', 'mid', 'premium', 'budget']
      : ['mid', 'budget', 'premium', 'mid', 'budget', 'premium', 'mid', 'budget'];

  function take(list, tierLabel) {
    while (list.length && picked.length < limit) {
      const item = list.shift();
      const brand = String(item.p.brand || 'digər').toLowerCase();
      const brandCount = seenBrand[brand] || 0;
      if (brandCount >= 2 && list.length > 0) continue;
      seenBrand[brand] = brandCount + 1;
      item.tier = tierLabel;
      picked.push(item);
      return true;
    }
    return false;
  }

  order.forEach(function (key) {
    if (picked.length >= limit) return;
    const label = key === 'budget' ? 'Büdcə seçimi' : key === 'mid' ? 'Optimal seçim' : 'Premium seçim';
    take(buckets[key], label);
  });

  // fill remainder by score
  const rest = ranked.filter(function (x) {
    return !picked.some(function (p) { return p.p.id === x.p.id; });
  });
  while (picked.length < limit && rest.length) {
    const item = rest.shift();
    item.tier = item.tier || 'Tövsiyə';
    picked.push(item);
  }
  return picked;
}

function clarifyingQuestions(intent) {
  const qs = [];
  if (!intent.useCase && (intent.subcategory === 'laptops' || /komp|nout/i.test(intent.label || ''))) {
    qs.push('Oyun, ofis, tələbə, yoxsa video montaj üçün?');
  }
  if (!intent.budget) {
    qs.push('Büdcən nə qədərdir? (məs: 1500 AZN)');
  }
  if (!intent.brand && intent.category === 'electronics') {
    qs.push('Brend üstünlüyün var? (Apple, Asus, Lenovo, Samsung…)');
  }
  if (intent.subcategory === 'smartphones' && !intent.useCase) {
    qs.push('Kamera, batareya, yoxsa performans əsasdır?');
  }
  return qs.slice(0, 3);
}

function suggestChips(intent) {
  if (intent.subcategory === 'laptops' || /komp|nout/i.test(intent.label || '')) {
    return [
      '1500 AZN ofis noutbuku',
      '2500 AZN oyun noutbuku',
      '1000 AZN tələbə noutbuku',
      'Apple MacBook tövsiyə et',
      'Asus gaming seç'
    ];
  }
  if (intent.subcategory === 'smartphones') {
    return [
      '800 AZN Samsung smartfon',
      '1200 AZN Xiaomi',
      'Kamera üçün telefon',
      'Apple iPhone tövsiyə et'
    ];
  }
  if (intent.category === 'server' || /switch|router|rack|server/i.test(intent.label || '')) {
    return [
      '24 port PoE switch',
      'MikroTik router',
      '42U server kabinet',
      'Dell PowerEdge server',
      'Ubiquiti UniFi switch'
    ];
  }
  return [
    '1500 AZN smartfon',
    '3000 AZN oyun noutbuk',
    '24 port switch',
    '42U server rak'
  ];
}

function buildAdvice(intent, products, clarify) {
  if (!products.length) {
    return 'Uyğun məhsul tapa bilmədim. Büdcə və məqsədi yazın — məsələn: «2000 AZN oyun noutbuku».';
  }

  const parts = [];
  if (intent.corrected) {
    parts.push('Sorğunu başa düşdüm' + (intent.label ? ' (' + intent.label + ')' : '') + '.');
  } else if (intent.label) {
    parts.push(intent.label.charAt(0).toUpperCase() + intent.label.slice(1) + ' üçün kataloqdan seçdim.');
  } else {
    parts.push('Kataloqdan uyğun seçimləri topladım.');
  }

  if (intent.useCaseLabel) parts.push('Məqsəd: ' + intent.useCaseLabel + '.');
  if (intent.budget != null) parts.push('Büdcə: ' + intent.budget + ' ₼.');
  if (intent.brand) parts.push('Brend: ' + intent.brand + '.');

  // Explain diversified picks
  const mid = products.find(function (p) { return (p.why || []).indexOf('Optimal seçim') >= 0; }) || products[0];
  const cheap = products.find(function (p) { return (p.why || []).indexOf('Büdcə seçimi') >= 0; });
  const premium = products.find(function (p) { return (p.why || []).indexOf('Premium seçim') >= 0; });

  parts.push('Əsas tövsiyəm: **' + mid.name + '** (' + Math.round(mid.price) + ' ₼) — balanslı qiymət/keyfiyyət.');
  if (cheap && cheap.id !== mid.id) {
    parts.push('Daha sərfəli: ' + cheap.name + ' (' + Math.round(cheap.price) + ' ₼).');
  }
  if (premium && premium.id !== mid.id) {
    parts.push('Daha güclü: ' + premium.name + ' (' + Math.round(premium.price) + ' ₼).');
  }

  if (clarify && clarify.length) {
    parts.push('Daha dəqiq seçim üçün: ' + clarify.join(' '));
  }

  return parts.join(' ').replace(/\*\*/g, '');
}

function fetchRows(intent) {
  const where = [];
  const params = {};

  if (intent.category) {
    where.push('category = @category');
    params.category = intent.category;
  }

  if (intent.subcategory && intent.alsoSubs.length) {
    const subs = [intent.subcategory].concat(intent.alsoSubs);
    where.push('subcategory IN (' + subs.map(function (_, i) { return '@s' + i; }).join(',') + ')');
    subs.forEach(function (s, i) { params['s' + i] = s; });
  } else if (intent.subcategory) {
    where.push('subcategory = @subcategory');
    params.subcategory = intent.subcategory;
  }

  if (intent.budget != null) {
    where.push('price <= @budgetMax');
    params.budgetMax = intent.budget * 1.12;
  }
  if (intent.budgetMin != null) {
    where.push('price >= @budgetMin');
    params.budgetMin = intent.budgetMin * 0.85;
  }
  if (intent.brand) {
    where.push('(lower(brand) LIKE @brand OR lower(name) LIKE @brand)');
    params.brand = '%' + intent.brand + '%';
  }
  if (intent.inStockOnly) {
    where.push('in_stock = 1 AND stock > 0');
  }

  let rows = [];
  if (where.length) {
    rows = db.prepare('SELECT * FROM products WHERE ' + where.join(' AND ') + ' LIMIT 300').all(params);
  }

  // Widen carefully — keep brand if set
  if (rows.length < 6 && intent.category) {
    const loose = ['category = @category', 'in_stock = 1', 'stock > 0'];
    const lp = { category: intent.category };
    if (intent.brand) {
      loose.push('(lower(brand) LIKE @brand OR lower(name) LIKE @brand)');
      lp.brand = '%' + intent.brand + '%';
    } else if (intent.subcategory) {
      loose.push('subcategory = @subcategory');
      lp.subcategory = intent.subcategory;
    }
    rows = db.prepare('SELECT * FROM products WHERE ' + loose.join(' AND ') + ' LIMIT 300').all(lp);
  }

  // Computer fallback
  if (rows.length < 6 && /komp|nout|laptop/i.test(intent.label || intent.normalized || '')) {
    rows = db.prepare(`
      SELECT * FROM products
      WHERE category = 'electronics' AND subcategory IN ('laptops','gaming')
        AND in_stock = 1 AND stock > 0
      LIMIT 300
    `).all();
  }

  if (!rows.length) {
    rows = db.prepare(`
      SELECT * FROM products WHERE in_stock = 1 AND stock > 0
      ORDER BY rating DESC, reviews DESC LIMIT 120
    `).all();
  }

  return rows;
}

function consult(text, opts) {
  opts = opts || {};
  const history = opts.history || [];
  const intent = parseIntent(text, history);
  const limit = Math.min(Math.max(opts.limit || 8, 1), 16);

  const rows = fetchRows(intent);
  let ranked = rows
    .map(function (row) {
      const p = rowToProduct(row);
      return { p: p, s: scoreProduct(p, intent) };
    })
    .filter(function (x) { return x.s >= 0; })
    .sort(function (a, b) { return b.s - a.s; });

  // If still garbage (no category), don't return random top-rated junk
  if (!intent.category && !intent.subcategory && !intent.brand) {
    return {
      ok: true,
      source: 'api',
      advice: 'Nə axtardığınızı bir az dəqiqləşdirim. Kompüter, smartfon, qulaqlıq, yoxsa başqa bir şey?',
      intent: publicIntent(intent),
      products: [],
      questions: [
        'Hansı kompüteri məsləhət görürsən?',
        '1500 AZN smartfon istəyirəm',
        'Oyun üçün noutbuk',
        'Qulaqlıq tövsiyə et'
      ],
      chips: suggestChips(intent),
      totalCandidates: 0
    };
  }

  const diversified = diversify(ranked, limit, intent);
  const clarify = clarifyingQuestions(intent);

  const products = diversified.map(function (x) {
    const p = x.p;
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      subcategory: p.subcategory,
      price: p.price,
      oldPrice: p.oldPrice,
      currency: p.currency || '₼',
      rating: p.rating,
      reviews: p.reviews,
      image: p.image,
      images: p.images,
      inStock: p.inStock,
      stock: p.stock,
      badge: p.badge,
      badgeType: p.badgeType,
      isNew: p.isNew,
      tags: p.tags,
      score: Math.round(x.s * 10) / 10,
      why: whyFor(p, intent, x.tier)
    };
  });

  return {
    ok: true,
    source: 'api',
    advice: buildAdvice(intent, products, clarify),
    intent: publicIntent(intent),
    products: products,
    questions: clarify,
    chips: suggestChips(intent),
    totalCandidates: ranked.length
  };
}

function publicIntent(intent) {
  return {
    budget: intent.budget,
    budgetMin: intent.budgetMin,
    category: intent.category,
    subcategory: intent.subcategory,
    brand: intent.brand,
    label: intent.label,
    gaming: intent.gaming,
    useCase: intent.useCase,
    needsClarify: intent.needsClarify,
    normalized: intent.normalized
  };
}

module.exports = { consult, parseIntent, normalizeText };
