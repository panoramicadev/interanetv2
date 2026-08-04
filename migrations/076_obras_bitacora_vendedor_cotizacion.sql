-- 076_obras_bitacora_vendedor_cotizacion.sql
--
-- Tres cosas de la estructura Cliente → Obra:
--
--   1. Bitácora POR OBRA (no una general del cliente).
--   2. Dueño de la obra: vendedor y supervisor, estampados al crearla.
--   3. La cotización sabe a qué obra es.

-- ---------------------------------------------------------------------------
-- 1. Bitácora de la obra
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS obra_bitacora (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id VARCHAR NOT NULL,
  texto TEXT NOT NULL,
  autor_id VARCHAR,
  autor_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_obra_bitacora_obra" ON obra_bitacora (obra_id);
CREATE INDEX IF NOT EXISTS "IDX_obra_bitacora_created" ON obra_bitacora (created_at);

-- ---------------------------------------------------------------------------
-- 2. Vendedor y supervisor de la obra
-- ---------------------------------------------------------------------------
-- Quedan en NULL para las obras ya cargadas: el vendedor de un cliente hoy solo
-- se deduce del historial de ventas (un NOMBRE, no un id), así que un backfill
-- automático adivinaría. Las obras nuevas los traen desde el alta; las viejas se
-- van completando a medida que se reasignan.
ALTER TABLE obras ADD COLUMN IF NOT EXISTS vendedor_id VARCHAR;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS supervisor_id VARCHAR;

CREATE INDEX IF NOT EXISTS "IDX_obras_vendedor" ON obras (vendedor_id);
CREATE INDEX IF NOT EXISTS "IDX_obras_supervisor" ON obras (supervisor_id);

-- ---------------------------------------------------------------------------
-- 3. Cotización ↔ obra
-- ---------------------------------------------------------------------------
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS obra_id VARCHAR;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS obra_nombre TEXT;

CREATE INDEX IF NOT EXISTS "IDX_quotes_obra" ON quotes (obra_id);
