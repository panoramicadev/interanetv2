-- Add region and segmento columns to crm_seguimiento_clientes
ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS region VARCHAR;
ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS segmento VARCHAR;
