-- Enable pg_trgm extension for ILIKE index support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for price_list text search
-- These allow ILIKE '%term%' to use an index instead of sequential scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_list_producto_trgm 
  ON price_list USING gin (producto gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_list_codigo_trgm 
  ON price_list USING gin (codigo gin_trgm_ops);

-- B-tree index for unidad exact match and sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_list_unidad 
  ON price_list (unidad);

-- Index on inventory_products.sku for future PPP lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_products_sku 
  ON inventory_products (sku);
