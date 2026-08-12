-- Esquema para Supabase (Postgres). Ejecutá esto en el SQL Editor del proyecto,
-- o dejalo: store.js lo crea automáticamente al iniciar (initStore -> ensureSchema).

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT,
  brand TEXT,
  description TEXT,
  price NUMERIC,
  category TEXT,
  stock INTEGER,
  "sizeValue" TEXT,
  "sizeUnit" TEXT,
  image TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  "customerName" TEXT,
  phone TEXT,
  type TEXT,
  address TEXT,
  notes TEXT,
  items JSONB,
  total NUMERIC,
  status TEXT,
  timestamp TEXT,
  "estimatedMinutes" INTEGER,
  credit BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB
);

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  "customerName" TEXT,
  addresses JSONB DEFAULT '[]',
  "createdAt" TEXT,
  "lastOrderAt" TEXT,
  balance NUMERIC DEFAULT 0,
  "isBenefited" BOOLEAN DEFAULT false,
  "creditLimit" NUMERIC
);

CREATE TABLE IF NOT EXISTS admin_credentials (
  phone TEXT PRIMARY KEY,
  salt TEXT,
  hash TEXT,
  "createdAt" TEXT
);
