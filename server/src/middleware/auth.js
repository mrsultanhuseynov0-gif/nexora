'use strict';

const jwt = require('jsonwebtoken');
const { db, publicUser } = require('../db');

const cfg = require('../config');
const JWT_SECRET = cfg.jwtSecret;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: cfg.jwtExpires }
  );
}

function authOptional(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    req.user = publicUser(row);
  } catch (e) {
    req.user = null;
  }
  return next();
}

function authRequired(req, res, next) {
  authOptional(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Giriş tələb olunur' });
    }
    return next();
  });
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin icazəsi tələb olunur' });
    }
    return next();
  });
}

module.exports = {
  signToken,
  authOptional,
  authRequired,
  adminRequired
};
