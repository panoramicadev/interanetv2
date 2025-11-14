-- =============================================================
-- MIGRACIÓN 008: Agregar columna RUEN a stg_maeen_nvv
-- =============================================================
-- Fecha: 2025-11-14
-- Propósito: Agregar columna de segmento de cliente (RUEN) a tabla
--           staging de entidades NVV para mapeo de segmentos
-- =============================================================

DO $$
BEGIN
  -- Agregar columna RUEN si no existe
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'nvv'
      AND table_name = 'stg_maeen_nvv'
      AND column_name = 'ruen'
  ) THEN
    ALTER TABLE nvv.stg_maeen_nvv 
    ADD COLUMN ruen VARCHAR(10);
    
    RAISE NOTICE 'Columna ruen agregada a nvv.stg_maeen_nvv';
  ELSE
    RAISE NOTICE 'Columna ruen ya existe en nvv.stg_maeen_nvv';
  END IF;
END $$;

-- =============================================================
-- FIN DE MIGRACIÓN 008
-- =============================================================
