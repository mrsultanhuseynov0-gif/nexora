'use strict';

const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { adminRequired, authOptional } = require('../middleware/auth');

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

function threadPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    status: row.status,
    unreadAdmin: Number(row.unread_admin) || 0,
    unreadVisitor: Number(row.unread_visitor) || 0,
    lastMessage: row.last_message || '',
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

/** Visitor: start or continue thread */
router.post('/session', authOptional, (req, res) => {
  const visitorKey = sanitize(req.body && req.body.visitorKey, 80) || uid('vk');
  const name = sanitize(req.body && req.body.name, 80);
  const email = sanitize(req.body && req.body.email, 120);
  const phone = sanitize(req.body && req.body.phone, 40);

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
        (id, visitor_key, name, email, phone, status, unread_admin, unread_visitor, last_message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'open', 0, 0, '', ?, ?)
    `).run(id, visitorKey, name, email, phone, t, t);

    const welcome = 'Salam! NEXORA dəstək komandası. Necə kömək edə bilərik?';
    db.prepare(`
      INSERT INTO chat_messages (id, thread_id, sender, body, created_at)
      VALUES (?, ?, 'system', ?, ?)
    `).run(uid('cm'), id, welcome, t);
    db.prepare(`
      UPDATE chat_threads SET last_message = ?, unread_visitor = 1 WHERE id = ?
    `).run(welcome, id);

    thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(id);
  } else if (name || email || phone) {
    db.prepare(`
      UPDATE chat_threads SET
        name = CASE WHEN ? != '' THEN ? ELSE name END,
        email = CASE WHEN ? != '' THEN ? ELSE email END,
        phone = CASE WHEN ? != '' THEN ? ELSE phone END
      WHERE id = ?
    `).run(name, name, email, email, phone, phone, thread.id);
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

/** Visitor: send message */
router.post('/messages', authOptional, (req, res) => {
  const threadId = sanitize(req.body && req.body.threadId, 80);
  const visitorKey = sanitize(req.body && req.body.visitorKey, 80);
  const body = sanitize(req.body && req.body.body, 2000);
  if (!threadId || !visitorKey || !body) {
    return res.status(400).json({ error: 'threadId, visitorKey və mesaj tələb olunur' });
  }

  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ? AND visitor_key = ?').get(threadId, visitorKey);
  if (!thread) return res.status(404).json({ error: 'Söhbət tapılmadı' });
  if (thread.status === 'closed') {
    return res.status(400).json({ error: 'Söhbət bağlanıb. Yenidən başlayın.' });
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

  return res.status(201).json({ ok: true, message: messagePublic({
    id: id, thread_id: threadId, sender: 'visitor', body: body, created_at: t
  }) });
});

/** Visitor: poll messages */
router.get('/messages', (req, res) => {
  const threadId = sanitize(req.query.threadId, 80);
  const visitorKey = sanitize(req.query.visitorKey, 80);
  const after = sanitize(req.query.after, 80);
  if (!threadId || !visitorKey) {
    return res.status(400).json({ error: 'threadId və visitorKey tələb olunur' });
  }
  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ? AND visitor_key = ?').get(threadId, visitorKey);
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

/** Admin: reply */
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
      unread_admin = 0, status = 'open'
    WHERE id = ?
  `).run(body, t, thread.id);

  return res.status(201).json({
    ok: true,
    message: messagePublic({
      id: id, thread_id: thread.id, sender: 'admin', body: body, created_at: t
    })
  });
});

/** Admin: close / reopen */
router.patch('/admin/threads/:id', adminRequired, (req, res) => {
  const status = sanitize(req.body && req.body.status, 20);
  if (status !== 'open' && status !== 'closed') {
    return res.status(400).json({ error: 'status open|closed olmalıdır' });
  }
  const info = db.prepare(`
    UPDATE chat_threads SET status = ?, updated_at = ? WHERE id = ?
  `).run(status, now(), req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Söhbət tapılmadı' });
  const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(req.params.id);
  return res.json({ ok: true, thread: threadPublic(thread) });
});

module.exports = router;
