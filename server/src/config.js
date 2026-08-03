'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function parseOrigins(raw) {
  if (!raw || raw === '*') return true;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 8787,
  // 0.0.0.0 required on Render / Docker; 127.0.0.1 only for local lockdown
  host: process.env.HOST || (isProd ? '0.0.0.0' : '127.0.0.1'),
  jwtSecret: process.env.JWT_SECRET || 'nexora-dev-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '8h',
  publicSiteUrl: String(process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, ''),
  publicApiUrl: String(process.env.PUBLIC_API_URL || '').replace(/\/+$/, ''),
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS || '*'),
  databasePath: process.env.DATABASE_PATH || '',
  // Optional future: Supabase / Postgres connection string (not used by SQLite runtime yet)
  databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '',
  cloudinaryCloud: process.env.CLOUDINARY_CLOUD_NAME || '',
  trustProxy: process.env.TRUST_PROXY !== '0'
};
