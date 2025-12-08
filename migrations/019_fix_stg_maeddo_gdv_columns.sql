-- Migration 019: Agregar columnas faltantes a stg_maeddo_gdv para GDV ETL
-- Problema: La tabla stg_maeddo_gdv no tiene las columnas nokopr, udtrpr, nulido, luvtlido, preuni
-- Solución: Agregar las columnas faltantes

-- Agregar columnas faltantes a stg_maeddo_gdv
ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS nokopr TEXT;
ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS udtrpr TEXT;
ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS nulido TEXT;
ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS luvtlido TEXT;
ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS preuni NUMERIC(18, 6);
ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS feemli TIMESTAMP;
ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS feerli TIMESTAMP;

-- Crear índice para nokopr si es útil
CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_nokopr ON gdv.stg_maeddo_gdv(nokopr);

-- Comentario de documentación
COMMENT ON COLUMN gdv.stg_maeddo_gdv.nokopr IS 'Nombre del producto (cache para evitar JOINs)';
