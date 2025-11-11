-- Migración: Agregar campos de fallback vendor/warehouse a stg_maeedo_nvv
-- Fecha: 2025-01-11
-- Propósito: Permitir COALESCE(detail, header) para vendor y bodega en fact_nvv

ALTER TABLE nvv.stg_maeedo_nvv 
  ADD COLUMN IF NOT EXISTS empresa VARCHAR(3),
  ADD COLUMN IF NOT EXISTS kofudo VARCHAR(13), 
  ADD COLUMN IF NOT EXISTS suli VARCHAR(3),
  ADD COLUMN IF NOT EXISTS bosulido VARCHAR(13);

-- Comentarios
COMMENT ON COLUMN nvv.stg_maeedo_nvv.empresa IS 'Empresa (fallback cuando línea no tiene)';
COMMENT ON COLUMN nvv.stg_maeedo_nvv.kofudo IS 'Código vendedor cabecera (fallback para kofulido)';
COMMENT ON COLUMN nvv.stg_maeedo_nvv.suli IS 'Código bodega sucursal (fallback)';
COMMENT ON COLUMN nvv.stg_maeedo_nvv.bosulido IS 'Código bodega (fallback)';
