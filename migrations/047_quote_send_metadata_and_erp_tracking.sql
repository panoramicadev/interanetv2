-- Metadata del envío de cotización a finanzas + tracking de ingreso a ERP por recepción
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_to_finance_at TIMESTAMP;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS oc_number VARCHAR;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS segment VARCHAR;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_method VARCHAR;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assigned_salesperson_id VARCHAR;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_entered BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_entered_at TIMESTAMP;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_entered_by_id VARCHAR;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_notes TEXT;

CREATE INDEX IF NOT EXISTS "IDX_quotes_sent_to_finance_at" ON quotes (sent_to_finance_at) WHERE sent_to_finance_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IDX_quotes_erp_entered" ON quotes (erp_entered) WHERE erp_entered = FALSE AND sent_to_finance_at IS NOT NULL;
