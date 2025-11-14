-- Migration 013: Agregar columnas faltantes a nvv.fact_nvv
-- Problema: Columnas rupr, ruen, nombre_segmento, nombre_segmento_cliente no existen en producción
-- Estas columnas están definidas en el schema de Drizzle pero faltaban en la migración 002

-- 1. Agregar columna rupr (segmento de producto)
ALTER TABLE nvv.fact_nvv
  ADD COLUMN IF NOT EXISTS rupr TEXT;

-- 2. Agregar columna ruen (segmento de cliente)
ALTER TABLE nvv.fact_nvv
  ADD COLUMN IF NOT EXISTS ruen TEXT;

-- 3. Agregar columna nombre_segmento (nombre del segmento de producto)
ALTER TABLE nvv.fact_nvv
  ADD COLUMN IF NOT EXISTS nombre_segmento TEXT;

-- 4. Agregar columna nombre_segmento_cliente (nombre del segmento de cliente)
ALTER TABLE nvv.fact_nvv
  ADD COLUMN IF NOT EXISTS nombre_segmento_cliente TEXT;

-- 5. Crear índice para queries por segmento de producto
CREATE INDEX IF NOT EXISTS idx_fact_nvv_rupr 
  ON nvv.fact_nvv(rupr);

-- 6. Crear índice para queries por segmento de cliente
CREATE INDEX IF NOT EXISTS idx_fact_nvv_ruen 
  ON nvv.fact_nvv(ruen);

-- 7. Comentarios de documentación
COMMENT ON COLUMN nvv.fact_nvv.rupr IS 'Código de segmento del producto (desde MAEPR)';
COMMENT ON COLUMN nvv.fact_nvv.ruen IS 'Código de segmento del cliente (desde MAEEN)';
COMMENT ON COLUMN nvv.fact_nvv.nombre_segmento IS 'Nombre del segmento del producto';
COMMENT ON COLUMN nvv.fact_nvv.nombre_segmento_cliente IS 'Nombre del segmento del cliente (desde ventas.stg_tabru)';
