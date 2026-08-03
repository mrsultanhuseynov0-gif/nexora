'use strict';

const crypto = require('crypto');
const { db } = require('./db');
const warranties = require('./warranties');

const TICKET_TYPES = ['warranty_claim', 'repair', 'diagnostic', 'other'];
const TICKET_STATUSES = ['open', 'in_progress', 'waiting_parts', 'completed', 'cancelled'];

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      warranty_id TEXT,
      order_id TEXT,
      product_id TEXT,
      product_name TEXT NOT NULL,
      brand TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'repair',
      subject TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS service_events (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL,
      detail TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(ticket_id) REFERENCES service_tickets(id)
    );

    CREATE INDEX IF NOT EXISTS idx_service_tickets_user ON service_tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_service_events_ticket ON service_events(ticket_id);
  `);
}

migrate();

function uid(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function mapTicket(row, events) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    warrantyId: row.warranty_id || null,
    orderId: row.order_id || null,
    productId: row.product_id || null,
    productName: row.product_name,
    brand: row.brand || '',
    type: row.type,
    subject: row.subject,
    description: row.description || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: events || []
  };
}

function listEvents(ticketId) {
  return db.prepare(`
    SELECT * FROM service_events WHERE ticket_id = ? ORDER BY created_at ASC
  `).all(ticketId).map((e) => ({
    id: e.id,
    ticketId: e.ticket_id,
    kind: e.kind,
    title: e.title,
    detail: e.detail || '',
    createdAt: e.created_at
  }));
}

function addEvent(ticketId, userId, kind, title, detail) {
  const id = uid('sev');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO service_events (id, ticket_id, user_id, kind, title, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, ticketId, userId, kind || 'note', String(title || '').slice(0, 160), String(detail || '').slice(0, 2000), now);
  db.prepare('UPDATE service_tickets SET updated_at = ? WHERE id = ?').run(now, ticketId);
  return listEvents(ticketId).find((e) => e.id === id);
}

function listTickets(userId) {
  return db.prepare(`
    SELECT * FROM service_tickets WHERE user_id = ? ORDER BY updated_at DESC
  `).all(userId).map((row) => mapTicket(row, listEvents(row.id)));
}

function getTicket(userId, id) {
  const row = db.prepare('SELECT * FROM service_tickets WHERE id = ? AND user_id = ?').get(id, userId);
  return row ? mapTicket(row, listEvents(row.id)) : null;
}

function createTicket(userId, body) {
  body = body || {};
  const type = TICKET_TYPES.indexOf(body.type) !== -1 ? body.type : 'repair';
  const subject = String(body.subject || '').trim().slice(0, 160);
  const description = String(body.description || '').trim().slice(0, 2000);
  if (!subject) {
    const err = new Error('Mövzu tələb olunur');
    err.status = 400;
    throw err;
  }

  let warranty = null;
  if (body.warrantyId) {
    warranty = warranties.getForUser(userId, body.warrantyId);
    if (!warranty) {
      const err = new Error('Zəmanət tapılmadı');
      err.status = 404;
      throw err;
    }
  }

  const id = uid('st');
  const now = new Date().toISOString();
  const productName = warranty
    ? warranty.productName
    : String(body.productName || 'Məhsul').slice(0, 160);
  const brand = warranty ? (warranty.brand || '') : String(body.brand || '').slice(0, 80);
  const productId = warranty ? warranty.productId : (body.productId || null);
  const orderId = warranty ? warranty.orderId : (body.orderId || null);
  const warrantyId = warranty ? warranty.id : null;

  db.prepare(`
    INSERT INTO service_tickets (
      id, user_id, warranty_id, order_id, product_id, product_name, brand,
      type, subject, description, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
  `).run(
    id, userId, warrantyId, orderId, productId, productName, brand,
    type, subject, description, now, now
  );

  addEvent(id, userId, 'status', 'Müraciət açıldı', 'Status: open · ' + type);
  if (description) addEvent(id, userId, 'note', 'İlkin təsvir', description);

  return getTicket(userId, id);
}

function setTicketStatus(userId, id, status, note) {
  if (TICKET_STATUSES.indexOf(status) === -1) {
    const err = new Error('Status yanlışdır');
    err.status = 400;
    throw err;
  }
  const ticket = getTicket(userId, id);
  if (!ticket) {
    const err = new Error('Müraciət tapılmadı');
    err.status = 404;
    throw err;
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE service_tickets SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  addEvent(id, userId, 'status', 'Status yeniləndi', 'Yeni status: ' + status + (note ? ' — ' + note : ''));
  if (status === 'completed') {
    addEvent(id, userId, 'completed', 'Təmir / servis tamamlandı', note || 'İş uğurla bitdi');
  }
  if (status === 'in_progress' || status === 'waiting_parts') {
    addEvent(id, userId, 'repair', 'Təmir mərhələsi', note || ('Status: ' + status));
  }
  return getTicket(userId, id);
}

function seedDemoTickets(userId, email) {
  const mail = String(email || '').toLowerCase();
  if (mail !== 'demo@nexora.az' && mail !== 'admin@nexora.az') return;
  const n = db.prepare('SELECT COUNT(*) AS c FROM service_tickets WHERE user_id = ?').get(userId).c;
  if (n > 0) return;

  const wars = warranties.listForUser({ id: userId, email: mail });
  if (!wars.length) return;

  const w0 = wars[0];
  const w1 = wars[1] || wars[0];

  // Completed repair
  const t1 = createTicket(userId, {
    warrantyId: w0.id,
    type: 'repair',
    subject: 'Ekran sensörü / sensor nasazlığı',
    description: 'Toxunma bəzən işləmir, xüsusilə kənarlarda.'
  });
  setTicketStatus(userId, t1.id, 'in_progress', 'Diaqnostika başladı');
  addEvent(t1.id, userId, 'repair', 'Sensor dəyişdirildi', 'Orijinal ehtiyat hissə quraşdırıldı');
  setTicketStatus(userId, t1.id, 'completed', 'Test keçdi — müştəriyə təhvil');

  // Open warranty claim
  createTicket(userId, {
    warrantyId: w1.id,
    type: 'warranty_claim',
    subject: 'Zəmanət üzrə yoxlama',
    description: 'Cihaz gözlənilmədən sönür. Zəmanət çərçivəsində yoxlama istəyirəm.'
  });

  // Waiting parts
  const t3 = createTicket(userId, {
    warrantyId: w0.id,
    type: 'diagnostic',
    subject: 'Şarj portu zəif kontakt',
    description: 'Kabel hərəkət edəndə şarj kəsilir.'
  });
  setTicketStatus(userId, t3.id, 'waiting_parts', 'USB-C board sifariş edildi');
}

function purchaseLines(user) {
  const wars = warranties.listForUser(user);
  const byOrder = {};
  wars.forEach((w) => {
    const key = w.orderId || w.id;
    if (!byOrder[key]) byOrder[key] = [];
    byOrder[key].push(w);
  });

  // Also pull order items without warranty rows
  const orders = db.prepare(`
    SELECT * FROM orders WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(user.id);

  const purchases = [];
  const seen = {};

  wars.forEach((w) => {
    seen[w.productId + '|' + w.orderId] = true;
    purchases.push({
      id: 'pur_' + w.id,
      purchasedAt: w.startAt,
      orderId: w.orderId,
      productId: w.productId,
      productName: w.productName,
      brand: w.brand,
      sku: w.sku,
      serial: w.serial,
      warranty: w
    });
  });

  orders.forEach((o) => {
    let items = [];
    try { items = JSON.parse(o.items_json || '[]'); } catch (e) { items = []; }
    items.forEach((item, idx) => {
      const pid = item.productId || item.id || ('x' + idx);
      const key = pid + '|' + o.id;
      if (seen[key]) return;
      seen[key] = true;
      purchases.push({
        id: 'pur_' + o.id + '_' + idx,
        purchasedAt: String(o.created_at || '').slice(0, 10),
        orderId: o.id,
        productId: pid,
        productName: item.name || 'Məhsul',
        brand: item.brand || '',
        sku: item.sku || '',
        serial: '',
        qty: item.qty || 1,
        price: item.price,
        warranty: null
      });
    });
  });

  purchases.sort((a, b) => String(b.purchasedAt).localeCompare(String(a.purchasedAt)));
  return purchases;
}

function getHistory(user) {
  seedDemoTickets(user.id, user.email);
  const purchases = purchaseLines(user);
  const tickets = listTickets(user.id);
  const repairs = [];
  tickets.forEach((t) => {
    (t.events || []).forEach((ev) => {
      if (ev.kind === 'repair' || ev.kind === 'completed' || ev.kind === 'parts') {
        repairs.push({
          id: ev.id,
          ticketId: t.id,
          productName: t.productName,
          brand: t.brand,
          kind: ev.kind,
          title: ev.title,
          detail: ev.detail,
          status: t.status,
          createdAt: ev.created_at
        });
      }
    });
  });
  repairs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const wars = warranties.listForUser(user);
  return {
    summary: {
      purchases: purchases.length,
      activeWarranties: wars.filter((w) => w.status === 'active' || w.status === 'expiring').length,
      openTickets: tickets.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length,
      repairs: repairs.length
    },
    purchases,
    warranties: wars,
    tickets,
    repairs
  };
}

module.exports = {
  TICKET_TYPES,
  TICKET_STATUSES,
  listTickets,
  getTicket,
  createTicket,
  setTicketStatus,
  addEvent,
  getHistory,
  seedDemoTickets
};
