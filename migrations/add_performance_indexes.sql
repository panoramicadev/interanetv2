-- Composite indexes for dashboard performance optimization
-- Run these manually on production with CONCURRENTLY to avoid table locks

-- Index for metrics queries that filter by date + document type
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_fact_ventas_feemdo_tido 
  ON ventas.fact_ventas (feemdo, tido);

-- Index for metrics queries filtered by salesperson + date + doc type
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_fact_ventas_feemdo_nokofu_tido 
  ON ventas.fact_ventas (feemdo, nokofu, tido);

-- Index for metrics queries filtered by segment + date + doc type
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_fact_ventas_feemdo_noruen_tido 
  ON ventas.fact_ventas (feemdo, noruen, tido);
