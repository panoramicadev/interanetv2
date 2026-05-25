-- Migración: Agregar columna ficha_overrides a clients
-- Fecha: 2026-05-24
-- Propósito: Guardar ediciones manuales de la ficha (solo campos de contacto) que
--            deben sobrevivir al ETL de clientes. El ETL (etl-clients.ts) nunca escribe
--            esta columna, por lo que los overrides prevalecen sobre los valores de Softland
--            al construir la ficha en /api/clients/account-status.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ficha_overrides JSONB;

COMMENT ON COLUMN clients.ficha_overrides IS 'Ediciones manuales de contacto que sobreviven al ETL: { clientName?, email?, phone?, address?, commune? }';
