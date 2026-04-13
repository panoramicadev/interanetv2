-- Add comuna and contacto_encargado columns to crm_seguimiento_clientes
-- These allow users to override/edit the linked ERP data directly

ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS comuna VARCHAR;
ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS contacto_encargado VARCHAR;
