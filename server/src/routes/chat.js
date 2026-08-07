'use strict';

const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { adminRequired, authRequired } = require('../middleware/auth');

const router = express.Router();

function uid(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function now() {
  return new Date().toISOString();
}

function sanitize(text, max) {
  return String(text || '').trim().slice(0, max || 2000);
}

/** Normalize to E.164-ish AZ digits: 994XXXXXXXXX */
function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('994') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '994' + digits.slice(1);
  if (digits.length === 9) return '994' + digits;
  return digits;
}

function isValidPhone(phone) {
  const digits = normalizePhone(phone);
  // AZ mobile: 994 + operator (50/51/55/70/77/99/10/60) + 7 digits
  if (!/^994(50|51|55|70|77|99|10|60)\d{7}$/.test(digits)) return false;
  const local = digits.slice(3);
  // Reject obvious fake / sequential patterns
  if (/^(\d)\1{8}$/.test(local)) return false;
  if (/^(012345678|123456789|987654321|111111111|000000000)/.test(local)) return false;
  return true;
}

function formatPhoneDisplay(digits) {
  const d = normalizePhone(digits);
  if (d.length === 12) return '+' + d;
  return d ? '+' + d : '';
}

function threadPublic(row) {
  if (!row) return null;
  const visitorCount = db.prepare(`
    SELECT COUNT(*) AS n FROM chat_messages
    WHERE thread_id = ? AND sender = 'visitor'
  `).get(row.id).n;
  return {
    id: row.id,
    userId: row.user_id || '',
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    topic: row.topic || '',
    approved: !!Number(row.approved),
    status: row.status,
    unreadAdmin: Number(row.unread_admin) || 0,
    unreadVisitor: Number(row.unread_visitor) || 0,
    lastMessage: row.last_message || '',
    visitorMessageCount: Number(visitorCount) || 0,
    canSend: !!Number(row.approved) || Number(visitorCount) < 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function messagePublic(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    sender: row.sender,
    body: row.body,
    createdAt: row.created_at
  };
}

function getMessages(threadId, afterId) {
  if (afterId) {
    const anchor = db.prepare('SELECT created_at FROM chat_messages WHERE id = ?').get(afterId);
    if (anchor) {
      return db.prepare(`
        SELECT * FROM chat_messages
        WHERE thread_id = ? AND created_at > ?
        ORDER BY created_at ASC LIMIT 200
      `).all(threadId, anchor.created_at).map(messagePublic);
    }
  }
  return db.prepare(`
    SELECT * FROM chat_messages WHERE thread_id = ?
    ORDER BY created_at ASC LIMIT 200
  `).all(threadId).map(messagePublic);
}

function userVisitorKey(user) {
  return 'user:' + user.id;
}

/** Logged-in user: start or continue thread (name + phone + topic required) */
router.post('/session', authRequired, (req, res) => {
  const name = sanitize(req.body && req.body.name, 80);
  const phoneRaw = sanitize(req.body && req.body.phone, 40);
  const topic = sanitize(req.body && req.body.topic, 200);
  const phone = normalizePhone(phoneRaw);
  const visitorKey = userVisitorKey(req.user);
  const email = sanitize(req.user.email, 120);

  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'Ad mütləqdir (ən azı 2 hərf)' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({
      error: 'Düzgün Azərbaycan mobil nömrəsi yazın (məs: +994501234567)'
    });
  }
  if (!topic || topic.length < 3) {
    return res.status(400).json({ error: 'Problem / mövzu mütləqdir' });
  }

  const phoneDisplay = formatPhoneDisplay(phone);

  let thread = db.prepare(`
    SELECT * FROM chat_threads
    WHERE visitor_key = ? AND status != 'closed'
    ORDER BY updated_at DESC LIMIT 1
  `).get(visitorKey);

  if (!thread) {
    const id = uid('ct');
    const t = now();
    db.prepare(`
      INSERT INTO chat_threads
        (id, visitor_key, user_id, name, email, phone, topic, approved, status,
         unread_admin, unread_visitor, last_message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'open', 0, 0, '', ?, ?)
    `).run(id, visitorKey, req.user.id, name, email, phoneDisplay, topic, t, t);

    const welcome =
      'Salam, ' + name + '! Mövzu: «' + topic + '». ' +
      'Bir mesaj yazın — admin təsdiq edənə qədər əlavə mesaj göndərə bilməzsiniz.';
    db.prepare(`
      INSERT INTO chat_messages (id, thread_id, sender, body, created_at)
      VALUES (?, ?, 'system', ?, ?)
    `).run(uid('cm'), id, welcome, t);
    db.prepare(`
      UPDATE chat_threads SET last_message = ?, unread_visitor = 1 WHERE id = ?
    `).run(welcome, id);

    thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(id);
  } else {
    db.prepare(`
      UPDATE chat_threads SET
        user_id = ?,
        name = ?,
        email = ?,
        phone = ?,
        topic = CASE WHEN topic = '' OR topic IS NULL THEN ? ELSE topic END
      WHERE id = ?
    `).run(req.user.id, name, email, phoneDisplay, topic, thread.id);
    thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(thread.id);
  }

  const messages = getMessages(thread.id);
  db.prepare('UPDATE chat_threads SET unread_visitor = 0 WHERE id = ?').run(thread.id);

  return res.json({
    ok: true,
    visitorKey: visitorKey,
    thread: threadPublic(thread),
    messages: messages
  });
});

/** Logged-in user: send message (max 1 until admin approves) */
router.post('/messages', authRequired, (req, res) => {
  const threadId = sanitize(req.body && req.body.threadId, 80);
  const visitorKey = sanitize(req.body && req.body.visitorKey, 80) || userVisitorKey(req.user);
  const body = sanitize(req.body && req.body.body, 2000);
  if (!threadId || !body) {
    return res.status(400).json({ error: 'threadId və mesaj tələb olunur' });
  }

  const thread = db.prepare(`
    SELECT * FROM chat_threads
    WHERE id = ? AND (visitor_key = ? OR user_id = ?)
  `).get(threadId, visitorKey, req.user.id);

  if (!thread) return res.status(404).json({ error: 'Söhbət tapılmadı' });
  if (thread.status === 'closed') {
    return res.status(400).json({ error: 'Söhbət bağlanıb. Yenidən başlayın.' });
  }
  if (!thread.name || !isValidPhone(thread.phone) || !thread.topic) {
    return res.status(400).json({ error: 'Əvvəlcə ad, telefon və mövzunu tamamlayın' });
  }

  const visitorCount = db.prepare(`
    SELECT COUNT(*) AS n FROM chat_messages
    WHERE thread_id = ? AND sender = 'visitor'
  `).get(threadId).n;

  if (!Number(thread.approved) && Number(visitorCount) >= 1) {
    return res.status(403).json({
      error: 'Admin təsdiq edənə qədər yalnız 1 mesaj yaza bilərsiniz. Gözləyin.'
    });
  }

  const t = now();
  const id = uid('cm');
  db.prepare(`
    INSERT INTO chat_messages (id, thread_id, sender, body, created_at)
    VALUES (?, ?, 'visitor', ?, ?)
  `).run(id, threadId, body, t);
  db.prepare(`
    UPDATE chat_threads SET
      last_message = ?, updated_at = ?, unread_admin = unread_admin + 1, status = 'open'
    WHERE id = ?
  `).run(body, t, threadId);

  const updated = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(threadId);
  return res.status(201).json({
    ok: true,
    thread: threadPublic(updated),
    message: messagePublic({
      id: id, thread_id: threadId, sender: 'visitor', body: body, created_at: t
    })
  });
});

/** Logged-in user: poll messages */
router.get('/messages', authRequired, (req, res) => {
  const threadId = sanitize(req.query.threadId, 80);
  const visitorKey = sanitize(req.query.visitorKey, 80) || userVisitorKey(req.user);
  const after = sanitize(req.query.after, 80);
  if (!threadId) {
    return res.status(400).json({ error: 'threadId tələb olunur' });
  }
  const thread = db.prepare(`
    SELECT * FROM chat_threads
    WHERE id = ? AND (visitor_key = ? OR user_id = ?)
  `).get(threadId, visitorKey, req.user.id);
  if (!thread) return res.status(404).json({ error: 'Söhbət tapılmadı' });

  const messages = getMessages(threadId, after || null);
  if (messages.length) {
    db.prepare('UPDATE chat_threads SET unread_visitor = 0 WHERE id = ?').run(threadId);
  }
  return res.json({ ok: true, thread: threadPublic(thread), messages: messages });
});

/** Admin: list threads */
router.get('/admin/threads', adminRequired, (req, res) => {
  const status = sanitize(req.query.status, 20);
  let rows;
  if (status === 'open' || status === 'closed') {
    rows = db.prepare(`
      SELECT * FROM chat_threads WHERE status = ?
      ORDER BY updated_at DESC LIMIT 100
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT * FROM chat_threads ORDER BY updated_at DESC LIMIT 100
    `).all();
  }
  const unread = db.prepare(`
    SELECT COALESCE(SUM(unread_admin), 0) AS n FROM chat_threads WHERE status != 'closed'
  `).get().n;
  return res.json({
    ok: true,
    unread: Number(unread) || 0,
    threads: rows.map(threadPublic)
  });
});

/** Admin: thread + messages */
router.get('/admin/threads/:id', adminRequired, (req, res) => {
  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Söhbət tapılmadı' });
  db.prepare('UPDATE chat_threads SET unread_admin = 0 WHERE id = ?').run(thread.id);
  const messages = getMessages(thread.id, sanitize(req.query.after, 80) || null);
  return res.json({ ok: true, thread: threadPublic(thread), messages: messages });
});

/** Admin: reply (auto-approves thread) */
router.post('/admin/threads/:id/messages', adminRequired, (req, res) => {
  const body = sanitize(req.body && req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Mesaj tələb olunur' });
  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Söhbət tapılmadı' });

  const t = now();
  const id = uid('cm');
  db.prepare(`
    INSERT INTO chat_messages (id, thread_id, sender, body, created_at)
    VALUES (?, ?, 'admin', ?, ?)
  `).run(id, thread.id, body, t);
  db.prepare(`
    UPDATE chat_threads SET
      last_message = ?, updated_at = ?, unread_visitor = unread_visitor + 1,
      unread_admin = 0, status = 'open', approved = 1
    WHERE id = ?
  `).run(body, t, thread.id);

  if (!Number(thread.approved)) {
    const t2 = new Date(Date.now() + 1).toISOString();
    db.prepare(`
      INSERT INTO chat_messages (id, thread_id, sender, body, created_at)
      VALUES (?, ?, 'system', ?, ?)
    `).run(uid('cm'), thread.id, 'Admin söhbəti təsdiqlədi. İndi sərbəst yazışa bilərsiniz.', t2);
  }

  return res.status(201).json({
    ok: true,
    thread: threadPublic(db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(thread.id)),
    message: messagePublic({
      id: id, thread_id: thread.id, sender: 'admin', body: body, created_at: t
    })
  });
});

/** Admin: close / reopen / approve */
router.patch('/admin/threads/:id', adminRequired, (req, res) => {
  const status = sanitize(req.body && req.body.status, 20);
  const approve = req.body && (req.body.approved === true || req.body.approved === 1 || req.body.approve === true);

  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Söhbət tapılmadı' });

  if (approve) {
    const t = now();
    db.prepare(`
      UPDATE chat_threads SET approved = 1, updated_at = ?, status = 'open' WHERE id = ?
    `).run(t, thread.id);
    if (!Number(thread.approved)) {
      db.prepare(`
        INSERT INTO chat_messages (id, thread_id, sender, body, created_at)
        VALUES (?, ?, 'system', ?, ?)
      `).run(uid('cm'), thread.id, 'Admin söhbəti təsdiqlədi. İndi sərbəst yazışa bilərsiniz.', t);
      db.prepare(`
        UPDATE chat_threads SET last_message = ?, unread_visitor = unread_visitor + 1 WHERE id = ?
      `).run('Admin söhbəti təsdiqlədi. İndi sərbəst yazışa bilərsiniz.', thread.id);
    }
  }

  if (status === 'open' || status === 'closed') {
    db.prepare(`
      UPDATE chat_threads SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, now(), req.params.id);
  } else if (!approve) {
    return res.status(400).json({ error: 'status open|closed və ya approved tələb olunur' });
  }

  const updated = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.id);
  return res.json({ ok: true, thread: threadPublic(updated) });
});

/** Admin: delete thread + messages */
router.delete('/admin/threads/:id', adminRequired, (req, res) => {
  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Söhbət tapılmadı' });

  const del = db.transaction(() => {
    db.prepare('DELETE FROM chat_messages WHERE thread_id = ?').run(thread.id);
    db.prepare('DELETE FROM chat_threads WHERE id = ?').run(thread.id);
  });
  del();

  return res.json({ ok: true, deleted: thread.id });
});

module.exports = router;
