-- Migration 011: Arreglar columnas en tablas staging de NVV
-- Problema: Campos VARCHAR(10) muy cortos, faltan columnas ruen y kofuen

-- 1. Agregar columnas faltantes en stg_maeen_nvv
ALTER TABLE nvv.stg_maeen_nvv
  ADD COLUMN IF NOT EXISTS ruen VARCHAR(50),  -- Segmento del cliente
  ADD COLUMN IF NOT EXISTS kofuen VARCHAR(50); -- Vendedor asociado

-- 2. Ampliar campos que causan "value too long for type character varying(10)"
ALTER TABLE nvv.stg_maeen_nvv
  ALTER COLUMN zoen TYPE VARCHAR(50),
  ALTER COLUMN foen TYPE VARCHAR(50),
  ALTER COLUMN cpen TYPE VARCHAR(50);

-- 3. Ampliar campos similares en stg_maepr_nvv (prevención)
ALTER TABLE nvv.stg_maepr_nvv
  ALTER COLUMN pfpr TYPE VARCHAR(50),
  ALTER COLUMN fmpr TYPE VARCHAR(50),
  ALTER COLUMN rupr TYPE VARCHAR(50),
  ALTER COLUMN mrpr TYPE VARCHAR(50);

-- 4. Comentarios para documentar
COMMENT ON COLUMN nvv.stg_maeen_nvv.ruen IS 'Código de segmento del cliente';
COMMENT ON COLUMN nvv.stg_maeen_nvv.kofuen IS 'Código del vendedor asociado al cliente';
