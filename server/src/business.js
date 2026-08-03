'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, rowToProduct, publicUser } = require('./db');
const { buildQuoteDocument, buildContractDocument } = require('./pdf-doc');
const { buildWorkbook, buildCsv } = require('./excel-simple');

const B2B_DISCOUNT_PERCENT = 8;
const B2B_MIN_LINES = 1;
const B2B_MIN_TOTAL = 200;

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_profiles (
      user_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      voen TEXT DEFAULT '',
      legal_address TEXT DEFAULT '',
      contact_person TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      contact_email TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      meta_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS business_quotes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      items_json TEXT NOT NULL,
      totals_json TEXT NOT NULL,
      notes TEXT DEFAULT '',
      valid_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS business_contracts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quote_id TEXT,
      order_id TEXT,
      title TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      body_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_biz_quotes_user ON business_quotes(user_id);
    CREATE INDEX IF NOT EXISTS idx_biz_contracts_user ON business_contracts(user_id);
  `);
}

migrate();

function uid(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function ensureDemoBusiness() {
  const email = 'business@nexora.az';
  const demoPass = 'Business1234';
  const demoHash = bcrypt.hashSync(demoPass, 10);
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const id = 'u_biz_demo';
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, phone, role, addresses_json, created_at)
      VALUES (?, ?, ?, ?, ?, 'customer', '[]', ?)
    `).run(
      id,
      email,
      demoHash,
      'Biznes Demo',
      '+994 12 555 11 11',
      now
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (!bcrypt.compareSync(demoPass, user.password_hash)) {
    // Keep demo credentials predictable for local/staff testing
    db.prepare('UPDATE users SET password_hash = ?, name = COALESCE(name, ?) WHERE id = ?')
      .run(demoHash, 'Biznes Demo', user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }
  const profile = db.prepare('SELECT user_id FROM business_profiles WHERE user_id = ?').get(user.id);
  if (!profile) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO business_profiles (
        user_id, company_name, voen, legal_address, contact_person, contact_phone,
        contact_email, bank_name, bank_account, meta_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)
    `).run(
      user.id,
      'NEXORA Demo MMC',
      '1401234561',
      'Bakı şəh., Nəsimi r., 28 May küç. 15',
      'Biznes Demo',
      '+994 12 555 11 11',
      email,
      'Kapital Bank',
      'AZ00NABZ00000000123456789001',
      now,
      now
    );
  }
  return user;
}

try { ensureDemoBusiness(); } catch (e) { /* db may be empty early */ }

function getProfile(userId) {
  const row = db.prepare('SELECT * FROM business_profiles WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    userId: row.user_id,
    companyName: row.company_name,
    voen: row.voen || '',
    legalAddress: row.legal_address || '',
    contactPerson: row.contact_person || '',
    contactPhone: row.contact_phone || '',
    contactEmail: row.contact_email || '',
    bankName: row.bank_name || '',
    bankAccount: row.bank_account || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requireBusiness(userId) {
  const profile = getProfile(userId);
  if (!profile) {
    const err = new Error('Biznes hesabı tələb olunur');
    err.status = 403;
    throw err;
  }
  return profile;
}

function upsertProfile(userId, data) {
  const now = new Date().toISOString();
  const existing = getProfile(userId);
  const next = {
    companyName: String(data.companyName || (existing && existing.companyName) || '').trim(),
    voen: String(data.voen != null ? data.voen : (existing && existing.voen) || '').trim(),
    legalAddress: String(data.legalAddress != null ? data.legalAddress : (existing && existing.legalAddress) || '').trim(),
    contactPerson: String(data.contactPerson != null ? data.contactPerson : (existing && existing.contactPerson) || '').trim(),
    contactPhone: String(data.contactPhone != null ? data.contactPhone : (existing && existing.contactPhone) || '').trim(),
    contactEmail: String(data.contactEmail != null ? data.contactEmail : (existing && existing.contactEmail) || '').trim(),
    bankName: String(data.bankName != null ? data.bankName : (existing && existing.bankName) || '').trim(),
    bankAccount: String(data.bankAccount != null ? data.bankAccount : (existing && existing.bankAccount) || '').trim()
  };
  if (!next.companyName) {
    const err = new Error('Şirkət adı tələb olunur');
    err.status = 400;
    throw err;
  }
  if (existing) {
    db.prepare(`
      UPDATE business_profiles SET
        company_name=?, voen=?, legal_address=?, contact_person=?, contact_phone=?,
        contact_email=?, bank_name=?, bank_account=?, updated_at=?
      WHERE user_id=?
    `).run(
      next.companyName, next.voen, next.legalAddress, next.contactPerson, next.contactPhone,
      next.contactEmail, next.bankName, next.bankAccount, now, userId
    );
  } else {
    db.prepare(`
      INSERT INTO business_profiles (
        user_id, company_name, voen, legal_address, contact_person, contact_phone,
        contact_email, bank_name, bank_account, meta_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)
    `).run(
      userId, next.companyName, next.voen, next.legalAddress, next.contactPerson, next.contactPhone,
      next.contactEmail, next.bankName, next.bankAccount, now, now
    );
  }
  return getProfile(userId);
}

function resolveItems(rawItems) {
  const items = [];
  for (const line of rawItems || []) {
    const id = line.productId || line.id;
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!row) {
      const err = new Error('Məhsul tapılmadı: ' + id);
      err.status = 400;
      throw err;
    }
    const p = rowToProduct(row);
    const qty = Math.max(1, parseInt(line.qty, 10) || 1);
    const unit = Number(p.price) || 0;
    items.push({
      productId: p.id,
      sku: p.sku || p.id,
      name: p.name,
      brand: p.brand || '',
      image: p.image || '',
      qty,
      unitPrice: unit,
      lineTotal: Math.round(unit * qty * 100) / 100
    });
  }
  if (!items.length) {
    const err = new Error('Ən azı bir məhsul seçin');
    err.status = 400;
    throw err;
  }
  return items;
}

function calcB2bTotals(items) {
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const discountPercent = subtotal >= B2B_MIN_TOTAL ? B2B_DISCOUNT_PERCENT : 0;
  const discount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round(taxable * 0.18 * 100) / 100;
  const shipping = 0; // B2B — razılaşma ilə
  const total = Math.round((taxable + tax + shipping) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount,
    discountPercent,
    tax,
    shipping,
    total,
    currency: 'AZN',
    minTotal: B2B_MIN_TOTAL,
    b2b: true
  };
}

function createQuote(userId, body) {
  requireBusiness(userId);
  const items = resolveItems(body.items);
  const totals = calcB2bTotals(items);
  const id = uid('qt');
  const now = new Date().toISOString();
  const valid = new Date();
  valid.setDate(valid.getDate() + 14);
  db.prepare(`
    INSERT INTO business_quotes (id, user_id, title, status, items_json, totals_json, notes, valid_until, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    String(body.title || 'Kommersiya təklifi').slice(0, 120),
    JSON.stringify(items),
    JSON.stringify(totals),
    String(body.notes || '').slice(0, 1000),
    valid.toISOString(),
    now,
    now
  );
  return getQuote(userId, id);
}

function getQuote(userId, id) {
  const row = db.prepare('SELECT * FROM business_quotes WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    items: JSON.parse(row.items_json),
    totals: JSON.parse(row.totals_json),
    notes: row.notes,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listQuotes(userId) {
  requireBusiness(userId);
  return db.prepare('SELECT * FROM business_quotes WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      items: JSON.parse(row.items_json),
      totals: JSON.parse(row.totals_json),
      notes: row.notes,
      validUntil: row.valid_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
}

function createContract(userId, body) {
  const profile = requireBusiness(userId);
  let quote = null;
  if (body.quoteId) {
    quote = getQuote(userId, body.quoteId);
    if (!quote) {
      const err = new Error('Təklif tapılmadı');
      err.status = 404;
      throw err;
    }
  }
  const id = uid('ct');
  const now = new Date().toISOString();
  const payload = {
    company: profile,
    quoteId: quote ? quote.id : null,
    orderId: body.orderId || null,
    items: quote ? quote.items : [],
    totals: quote ? quote.totals : null,
    terms: [
      'Odeme: 50% avans, 50% teslimatda (ve ya razilasma ile).',
      'Catdirilma: Bakı daxilində razılaşdırılmış vaxtda.',
      'Zemanet: mehsul uzre resmi istehsalçı zemaneti.',
      'Mecelle: Azərbaycan Respublikası qanunvericiliyi.'
    ]
  };
  db.prepare(`
    INSERT INTO business_contracts (id, user_id, quote_id, order_id, title, status, body_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `).run(
    id,
    userId,
    quote ? quote.id : null,
    body.orderId || null,
    String(body.title || ('Müqavilə — ' + profile.companyName)).slice(0, 140),
    JSON.stringify(payload),
    now,
    now
  );
  return getContract(userId, id);
}

function getContract(userId, id) {
  const row = db.prepare('SELECT * FROM business_contracts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  return {
    id: row.id,
    quoteId: row.quote_id,
    orderId: row.order_id,
    title: row.title,
    status: row.status,
    body: JSON.parse(row.body_json || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listContracts(userId) {
  requireBusiness(userId);
  return db.prepare('SELECT * FROM business_contracts WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map((row) => getContract(userId, row.id));
}

function placeBulkOrder(userId, body) {
  const profile = requireBusiness(userId);
  const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
  const items = resolveItems(body.items);
  const totals = calcB2bTotals(items);
  if (items.length < B2B_MIN_LINES) {
    const err = new Error('Toplu sifariş üçün məhsul seçin');
    err.status = 400;
    throw err;
  }

  // Stock check + decrement
  const orderId = uid('bord');
  const now = new Date().toISOString();
  const customer = {
    name: profile.contactPerson || user.name,
    email: profile.contactEmail || user.email,
    phone: profile.contactPhone || user.phone,
    address: profile.legalAddress || '',
    city: 'Bakı',
    paymentMethod: body.paymentMethod || 'transfer',
    companyName: profile.companyName,
    voen: profile.voen,
    b2b: true
  };

  const orderItems = items.map((i) => ({
    productId: i.productId,
    name: i.name,
    price: i.unitPrice,
    qty: i.qty,
    image: i.image,
    variant: null
  }));

  const tx = db.transaction(() => {
    for (const item of items) {
      const info = db.prepare(`
        UPDATE products SET stock = stock - ?, in_stock = CASE WHEN stock - ? <= 0 THEN 0 ELSE 1 END
        WHERE id = ? AND stock >= ?
      `).run(item.qty, item.qty, item.productId, item.qty);
      if (!info.changes) throw new Error('STOCK:' + item.productId);
    }
    db.prepare(`
      INSERT INTO orders (id, user_id, status, customer_json, items_json, totals_json, coupon_code, notes, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?, NULL, ?, ?, ?)
    `).run(
      orderId,
      userId,
      JSON.stringify(customer),
      JSON.stringify(orderItems),
      JSON.stringify(totals),
      String(body.notes || 'B2B toplu sifariş').slice(0, 500),
      now,
      now
    );
  });

  try {
    tx();
  } catch (e) {
    if (String(e.message).startsWith('STOCK:')) {
      const err = new Error('Stok kifayət etmir');
      err.status = 400;
      throw err;
    }
    throw e;
  }

  try {
    const { ensureFromOrder } = require('./warranties');
    ensureFromOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId), userId);
  } catch (e) { /* ignore */ }

  return {
    id: orderId,
    status: 'pending',
    items: orderItems,
    totals,
    customer,
    createdAt: now
  };
}

function buildQuotePdf(quote, profile, user) {
  return buildQuoteDocument(quote, profile, user);
}

function buildContractPdf(contract, profile, user) {
  return buildContractDocument(contract, profile, user);
}

function mapQuoteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    items: JSON.parse(row.items_json || '[]'),
    totals: JSON.parse(row.totals_json || '{}'),
    notes: row.notes,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companyName: row.company_name || '',
    voen: row.voen || '',
    contactEmail: row.contact_email || '',
    userEmail: row.user_email || '',
    userName: row.user_name || ''
  };
}

function mapContractRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    quoteId: row.quote_id,
    orderId: row.order_id,
    title: row.title,
    status: row.status,
    body: JSON.parse(row.body_json || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companyName: row.company_name || '',
    voen: row.voen || '',
    contactEmail: row.contact_email || '',
    userEmail: row.user_email || '',
    userName: row.user_name || ''
  };
}

function adminListCompanies() {
  return db.prepare(`
    SELECT bp.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone,
      (SELECT COUNT(*) FROM business_quotes q WHERE q.user_id = bp.user_id) AS quotes_count,
      (SELECT COUNT(*) FROM business_contracts c WHERE c.user_id = bp.user_id) AS contracts_count,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = bp.user_id AND o.notes LIKE '%B2B%') AS orders_count
    FROM business_profiles bp
    JOIN users u ON u.id = bp.user_id
    ORDER BY bp.updated_at DESC
  `).all().map((row) => ({
    userId: row.user_id,
    companyName: row.company_name,
    voen: row.voen || '',
    legalAddress: row.legal_address || '',
    contactPerson: row.contact_person || '',
    contactPhone: row.contact_phone || '',
    contactEmail: row.contact_email || '',
    bankName: row.bank_name || '',
    bankAccount: row.bank_account || '',
    userEmail: row.user_email,
    userName: row.user_name,
    userPhone: row.user_phone || '',
    quotesCount: row.quotes_count || 0,
    contractsCount: row.contracts_count || 0,
    ordersCount: row.orders_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function adminListQuotes() {
  return db.prepare(`
    SELECT q.*, bp.company_name, bp.voen, bp.contact_email, u.email AS user_email, u.name AS user_name
    FROM business_quotes q
    LEFT JOIN business_profiles bp ON bp.user_id = q.user_id
    LEFT JOIN users u ON u.id = q.user_id
    ORDER BY q.created_at DESC
  `).all().map(mapQuoteRow);
}

function adminListContracts() {
  return db.prepare(`
    SELECT c.*, bp.company_name, bp.voen, bp.contact_email, u.email AS user_email, u.name AS user_name
    FROM business_contracts c
    LEFT JOIN business_profiles bp ON bp.user_id = c.user_id
    LEFT JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC
  `).all().map(mapContractRow);
}

function adminListB2bOrders() {
  return db.prepare(`
    SELECT o.*, bp.company_name, bp.voen, u.email AS user_email
    FROM orders o
    LEFT JOIN business_profiles bp ON bp.user_id = o.user_id
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.notes LIKE '%B2B%' OR o.customer_json LIKE '%"b2b":true%' OR o.id LIKE 'bord%'
    ORDER BY o.created_at DESC
    LIMIT 200
  `).all().map((row) => {
    let totals = {};
    let customer = {};
    let items = [];
    try { totals = JSON.parse(row.totals_json || '{}'); } catch (e) { /* */ }
    try { customer = JSON.parse(row.customer_json || '{}'); } catch (e) { /* */ }
    try { items = JSON.parse(row.items_json || '[]'); } catch (e) { /* */ }
    return {
      id: row.id,
      status: row.status,
      userId: row.user_id,
      companyName: row.company_name || customer.companyName || '',
      voen: row.voen || customer.voen || '',
      userEmail: row.user_email || customer.email || '',
      totals,
      itemCount: items.length,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
}

function adminOverview() {
  const companies = adminListCompanies();
  const quotes = adminListQuotes();
  const contracts = adminListContracts();
  const orders = adminListB2bOrders();
  const quoteSum = quotes.reduce((s, q) => s + (Number(q.totals && q.totals.total) || 0), 0);
  const orderSum = orders.reduce((s, o) => s + (Number(o.totals && o.totals.total) || 0), 0);
  return {
    stats: {
      companies: companies.length,
      quotes: quotes.length,
      contracts: contracts.length,
      orders: orders.length,
      quoteVolume: Math.round(quoteSum * 100) / 100,
      orderVolume: Math.round(orderSum * 100) / 100,
      contractsDraft: contracts.filter((c) => c.status === 'draft').length,
      contractsSigned: contracts.filter((c) => c.status === 'signed' || c.status === 'active').length
    },
    companies,
    quotes,
    contracts,
    orders
  };
}

function adminGetQuote(id) {
  const row = db.prepare(`
    SELECT q.*, bp.company_name, bp.voen, bp.contact_email, u.email AS user_email, u.name AS user_name
    FROM business_quotes q
    LEFT JOIN business_profiles bp ON bp.user_id = q.user_id
    LEFT JOIN users u ON u.id = q.user_id
    WHERE q.id = ?
  `).get(id);
  return mapQuoteRow(row);
}

function adminGetContract(id) {
  const row = db.prepare(`
    SELECT c.*, bp.company_name, bp.voen, bp.contact_email, u.email AS user_email, u.name AS user_name
    FROM business_contracts c
    LEFT JOIN business_profiles bp ON bp.user_id = c.user_id
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(id);
  return mapContractRow(row);
}

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
const CONTRACT_STATUSES = ['draft', 'sent', 'signed', 'active', 'cancelled'];

function adminSetQuoteStatus(id, status) {
  if (QUOTE_STATUSES.indexOf(status) === -1) {
    const err = new Error('Status yanlışdır: ' + status);
    err.status = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const info = db.prepare('UPDATE business_quotes SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  if (!info.changes) {
    const err = new Error('Təklif tapılmadı');
    err.status = 404;
    throw err;
  }
  return adminGetQuote(id);
}

function adminSetContractStatus(id, status) {
  if (CONTRACT_STATUSES.indexOf(status) === -1) {
    const err = new Error('Status yanlışdır: ' + status);
    err.status = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const info = db.prepare('UPDATE business_contracts SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  if (!info.changes) {
    const err = new Error('Müqavilə tapılmadı');
    err.status = 404;
    throw err;
  }
  return adminGetContract(id);
}

function adminExportExcel(kind) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'companies') {
    const rows = adminListCompanies();
    const buf = buildWorkbook([{
      name: 'Sirketler',
      widths: [140, 90, 120, 100, 140, 100, 60, 60, 60, 110],
      rows: [
        ['Sirket', 'VOEN', 'Elaqe', 'Telefon', 'E-poct', 'User email', 'Teklif', 'Muqavile', 'Sifaris', 'Yenilenme'],
        ...rows.map((r) => [
          r.companyName, r.voen, r.contactPerson, r.contactPhone, r.contactEmail,
          r.userEmail, r.quotesCount, r.contractsCount, r.ordersCount,
          String(r.updatedAt || '').slice(0, 10)
        ])
      ]
    }]);
    return { buf, filename: 'nexora-b2b-sirketler-' + stamp + '.xls', mime: 'application/vnd.ms-excel' };
  }
  if (kind === 'quotes') {
    const quotes = adminListQuotes();
    const summary = [
      ['Teklif ID', 'Sirket', 'VOEN', 'Status', 'Mehsul sayi', 'Ara cem', 'Endirim', 'EDV', 'Yekun', 'Kecerli', 'Tarix', 'User email'],
      ...quotes.map((q) => [
        q.id, q.companyName, q.voen, q.status, (q.items || []).length,
        { v: Number(q.totals.subtotal) || 0, t: 'Number' },
        { v: Number(q.totals.discount) || 0, t: 'Number' },
        { v: Number(q.totals.tax) || 0, t: 'Number' },
        { v: Number(q.totals.total) || 0, t: 'Number' },
        String(q.validUntil || '').slice(0, 10),
        String(q.createdAt || '').slice(0, 10),
        q.userEmail
      ])
    ];
    const lines = [
      ['Teklif ID', 'Sirket', 'SKU', 'Mehsul', 'Eded', 'Qiymet', 'Setir cem'],
      ...quotes.flatMap((q) => (q.items || []).map((it) => [
        q.id, q.companyName, it.sku || '', it.name || '', it.qty,
        { v: Number(it.unitPrice) || 0, t: 'Number' },
        { v: Number(it.lineTotal) || 0, t: 'Number' }
      ]))
    ];
    const buf = buildWorkbook([
      { name: 'Teklifler', widths: [120, 140, 80, 80, 70, 80, 80, 80, 90, 90, 90, 140], rows: summary },
      { name: 'Setirler', widths: [120, 140, 90, 200, 60, 80, 90], rows: lines }
    ]);
    return { buf, filename: 'nexora-b2b-teklifler-' + stamp + '.xls', mime: 'application/vnd.ms-excel' };
  }
  if (kind === 'contracts') {
    const contracts = adminListContracts();
    const buf = buildWorkbook([{
      name: 'Muqavileler',
      widths: [120, 140, 90, 80, 120, 120, 90, 90, 140],
      rows: [
        ['Muqavile ID', 'Sirket', 'VOEN', 'Status', 'Teklif ID', 'Sifaris ID', 'Yekun', 'Tarix', 'User email'],
        ...contracts.map((c) => [
          c.id, c.companyName, c.voen, c.status, c.quoteId || '', c.orderId || '',
          { v: Number(c.body && c.body.totals && c.body.totals.total) || 0, t: 'Number' },
          String(c.createdAt || '').slice(0, 10),
          c.userEmail
        ])
      ]
    }]);
    return { buf, filename: 'nexora-b2b-muqavileler-' + stamp + '.xls', mime: 'application/vnd.ms-excel' };
  }
  if (kind === 'orders') {
    const orders = adminListB2bOrders();
    const buf = buildWorkbook([{
      name: 'B2B Sifarisler',
      widths: [120, 140, 90, 80, 70, 90, 160, 100],
      rows: [
        ['Sifaris ID', 'Sirket', 'VOEN', 'Status', 'Mehsul', 'Yekun', 'Qeyd', 'Tarix'],
        ...orders.map((o) => [
          o.id, o.companyName, o.voen, o.status, o.itemCount,
          { v: Number(o.totals && o.totals.total) || 0, t: 'Number' },
          o.notes, String(o.createdAt || '').slice(0, 10)
        ])
      ]
    }]);
    return { buf, filename: 'nexora-b2b-sifarisler-' + stamp + '.xls', mime: 'application/vnd.ms-excel' };
  }
  if (kind === 'all') {
    const companies = adminListCompanies();
    const quotes = adminListQuotes();
    const contracts = adminListContracts();
    const orders = adminListB2bOrders();
    const buf = buildWorkbook([
      {
        name: 'Sirketler',
        widths: [140, 90, 120, 140, 60, 60],
        rows: [
          ['Sirket', 'VOEN', 'Elaqe', 'E-poct', 'Teklif', 'Muqavile'],
          ...companies.map((r) => [r.companyName, r.voen, r.contactPerson, r.contactEmail, r.quotesCount, r.contractsCount])
        ]
      },
      {
        name: 'Teklifler',
        widths: [120, 140, 80, 90, 90],
        rows: [
          ['ID', 'Sirket', 'Status', 'Yekun', 'Tarix'],
          ...quotes.map((q) => [q.id, q.companyName, q.status, Number(q.totals.total) || 0, String(q.createdAt || '').slice(0, 10)])
        ]
      },
      {
        name: 'Muqavileler',
        widths: [120, 140, 80, 90, 90],
        rows: [
          ['ID', 'Sirket', 'Status', 'Yekun', 'Tarix'],
          ...contracts.map((c) => [
            c.id, c.companyName, c.status,
            Number(c.body && c.body.totals && c.body.totals.total) || 0,
            String(c.createdAt || '').slice(0, 10)
          ])
        ]
      },
      {
        name: 'Sifarisler',
        widths: [120, 140, 80, 90, 90],
        rows: [
          ['ID', 'Sirket', 'Status', 'Yekun', 'Tarix'],
          ...orders.map((o) => [o.id, o.companyName, o.status, Number(o.totals && o.totals.total) || 0, String(o.createdAt || '').slice(0, 10)])
        ]
      }
    ]);
    return { buf, filename: 'nexora-b2b-tam-' + stamp + '.xls', mime: 'application/vnd.ms-excel' };
  }
  const err = new Error('Export növü yanlışdır');
  err.status = 400;
  throw err;
}

function adminExportCsv(kind) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'quotes') {
    const quotes = adminListQuotes();
    const buf = buildCsv(
      ['teklif_id', 'sirket', 'voen', 'status', 'yekun', 'tarix', 'email'],
      quotes.map((q) => [q.id, q.companyName, q.voen, q.status, q.totals.total || 0, String(q.createdAt || '').slice(0, 10), q.userEmail])
    );
    return { buf, filename: 'nexora-b2b-teklifler-' + stamp + '.csv', mime: 'text/csv; charset=utf-8' };
  }
  const companies = adminListCompanies();
  const buf = buildCsv(
    ['sirket', 'voen', 'elaqe', 'telefon', 'email', 'teklif', 'muqavile'],
    companies.map((r) => [r.companyName, r.voen, r.contactPerson, r.contactPhone, r.contactEmail, r.quotesCount, r.contractsCount])
  );
  return { buf, filename: 'nexora-b2b-sirketler-' + stamp + '.csv', mime: 'text/csv; charset=utf-8' };
}

function enrichUser(user) {
  if (!user) return user;
  const profile = getProfile(user.id);
  return Object.assign({}, user, {
    isBusiness: !!profile,
    business: profile
  });
}

/**
 * One-click professional offer PDF.
 * Works without business login (ephemeral). Optionally persists as quote when save=true + business user.
 */
function generateOfferPdf(body, user) {
  body = body || {};
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  if (!rawItems.length) {
    const err = new Error('Ən azı bir məhsul seçin');
    err.status = 400;
    throw err;
  }

  let quote = null;
  let profile = null;
  const save = !!body.save && user && getProfile(user.id);

  if (save) {
    quote = createQuote(user.id, {
      title: body.title || 'Qiymət təklifi',
      notes: body.notes || '',
      items: rawItems
    });
    profile = getProfile(user.id);
  } else {
    const items = resolveItems(rawItems);
    const totals = calcB2bTotals(items);
    const now = new Date().toISOString();
    const valid = new Date();
    valid.setDate(valid.getDate() + 14);
    const companyName = String(body.companyName || '').trim();
    if (companyName.length < 2) {
      const err = new Error('Şirkət adı tələb olunur');
      err.status = 400;
      throw err;
    }
    quote = {
      id: 'OFF-' + Date.now().toString(36).toUpperCase(),
      title: String(body.title || 'Qiymət təklifi').slice(0, 120),
      status: 'offer',
      items,
      totals,
      notes: String(body.notes || '').slice(0, 1000),
      validUntil: valid.toISOString(),
      createdAt: now
    };
    profile = {
      companyName: companyName.slice(0, 160),
      voen: String(body.voen || '').trim().slice(0, 40),
      contactPerson: String(body.contactPerson || '').trim().slice(0, 120),
      contactPhone: String(body.contactPhone || '').trim().slice(0, 40),
      contactEmail: String(body.contactEmail || '').trim().slice(0, 120),
      legalAddress: String(body.legalAddress || '').trim().slice(0, 240)
    };
  }

  const pdfUser = user || {
    name: profile.contactPerson || '',
    email: profile.contactEmail || ''
  };
  const buf = buildQuotePdf(quote, profile, pdfUser);
  const company = String(profile.companyName || 'sirket').replace(/[^\w\-]+/g, '_').slice(0, 24);
  return {
    buf,
    filename: 'NEXORA_Qiymet_Teklifi_' + company + '_' + quote.id + '.pdf',
    quote,
    profile,
    saved: save
  };
}

module.exports = {
  ensureDemoBusiness,
  getProfile,
  requireBusiness,
  upsertProfile,
  createQuote,
  getQuote,
  listQuotes,
  createContract,
  getContract,
  listContracts,
  placeBulkOrder,
  buildQuotePdf,
  buildContractPdf,
  generateOfferPdf,
  calcB2bTotals,
  resolveItems,
  enrichUser,
  adminOverview,
  adminListCompanies,
  adminListQuotes,
  adminListContracts,
  adminListB2bOrders,
  adminGetQuote,
  adminGetContract,
  adminSetQuoteStatus,
  adminSetContractStatus,
  adminExportExcel,
  adminExportCsv,
  QUOTE_STATUSES,
  CONTRACT_STATUSES,
  B2B_DISCOUNT_PERCENT,
  B2B_MIN_TOTAL
};
