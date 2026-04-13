-- Add condicion_pago column to crm_seguimiento_clientes
-- Allows users to set/override payment conditions independently of ERP data

ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS condicion_pago VARCHAR;
