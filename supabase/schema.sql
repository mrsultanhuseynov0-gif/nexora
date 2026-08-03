-- NEXORA — optional Supabase / PostgreSQL schema (future migration)
-- Runtime today uses SQLite (better-sqlite3) on Render for zero-cost deploy.
-- Use this file when you are ready to migrate durable data off ephemeral disk.
--
-- Setup:
-- 1. Create a free Supabase project
-- 2. SQL Editor → paste this file → Run
-- 3. Set DATABASE_URL in Render (requires app migration to `pg` — not enabled yet)

-- Example core tables (subset). Expand before cutover.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  addresses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  brand_id TEXT,
  category TEXT,
  subcategory TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  old_price NUMERIC,
  currency TEXT DEFAULT 'AZN',
  rating NUMERIC DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  badge TEXT DEFAULT '',
  badge_type TEXT DEFAULT '',
  in_stock BOOLEAN DEFAULT TRUE,
  stock INTEGER DEFAULT 0,
  is_new BOOLEAN DEFAULT FALSE,
  tags_json JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  specs_json JSONB DEFAULT '{}'::jsonb,
  images_json JSONB DEFAULT '[]'::jsonb,
  gradient TEXT,
  image TEXT,
  review_list_json JSONB DEFAULT '[]'::jsonb,
  raw_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);

-- After migration tooling exists, point DATABASE_URL here and retire SQLite.
