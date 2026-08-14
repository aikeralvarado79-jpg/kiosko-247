-- 003: Reservas de stock y carritos compartidos persistidos en Postgres con TTL.
-- Antes vivian en Map del proceso y se perdian en cada sleep/redeploy de Render.
CREATE TABLE IF NOT EXISTS @SCHEMA@stock_holds (
  client_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (client_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_holds_expires ON @SCHEMA@stock_holds (expires_at);

CREATE TABLE IF NOT EXISTS @SCHEMA@shares (
  code TEXT PRIMARY KEY,
  owner_client_id TEXT NOT NULL,
  owner_name TEXT,
  items JSONB DEFAULT '[]',
  expires_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON @SCHEMA@shares (owner_client_id);