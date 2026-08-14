-- 001: Indices para consultas frecuentes. Sin indice, Postgres lee la tabla
-- entera para filtrar por phone o status (escaneo secuencial). Con estos
-- indices las busquedas de pedidos y abonos son O(log n).
CREATE INDEX IF NOT EXISTS idx_orders_phone_time ON @SCHEMA@orders (phone, timestamp);
CREATE INDEX IF NOT EXISTS idx_orders_status_time ON @SCHEMA@orders (status, timestamp);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON @SCHEMA@payments (phone);
