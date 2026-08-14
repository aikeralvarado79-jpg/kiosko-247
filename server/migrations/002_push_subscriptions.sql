-- 002: Suscripciones push en tabla propia (una fila por suscripcion).
-- Antes vivia como una sola fila JSONB gigante en settings que se reescribia
-- entera en cada alta (cuello de botella al crecer).
CREATE TABLE IF NOT EXISTS @SCHEMA@push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  keys JSONB DEFAULT '{}',
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone ON @SCHEMA@push_subscriptions (phone);