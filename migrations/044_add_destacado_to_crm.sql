-- Add destacado column to crm_seguimiento_clientes
-- Marca cliente destacado/importante en el seguimiento CRM

ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS destacado BOOLEAN DEFAULT FALSE NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_crm_seg_destacado" ON crm_seguimiento_clientes (destacado) WHERE destacado = TRUE;
