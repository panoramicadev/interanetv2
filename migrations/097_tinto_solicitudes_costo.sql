-- Solicitudes a laboratorio: el costo se resuelve en dos pasos.
--
-- 1. Un químico de laboratorio carga la fórmula en gramos (estado "por_costear").
-- 2. Otro usuario de laboratorio le pone el costo y se la responde a quien pidió.
--
-- formula_gramos  { para, base, observaciones, items: [{ componente, gramos }] }.
--                 Es interna de laboratorio: quien pide recibe solo el costo.
--
-- Nota: el server también ejecuta este DDL en runtime (bootstrap de tintometría).

ALTER TABLE tinto_solicitudes ADD COLUMN IF NOT EXISTS formula_gramos JSONB;
ALTER TABLE tinto_solicitudes ADD COLUMN IF NOT EXISTS formulada_por_id VARCHAR;
ALTER TABLE tinto_solicitudes ADD COLUMN IF NOT EXISTS formulada_por_nombre TEXT;
ALTER TABLE tinto_solicitudes ADD COLUMN IF NOT EXISTS formulada_at TIMESTAMPTZ;
