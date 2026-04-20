-- Migration 042: Create B2C quote_requests table (idempotent)
-- Fixes 500 error on POST /api/b2c/quote-request when table/columns are missing in production.

CREATE TABLE IF NOT EXISTS quote_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name VARCHAR NOT NULL,
  visitor_email VARCHAR NOT NULL,
  visitor_phone VARCHAR,
  visitor_company VARCHAR,
  visitor_city VARCHAR,
  visitor_rut VARCHAR,
  message TEXT,
  items JSONB NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'pending',
  assigned_to_user_id INTEGER,
  internal_notes TEXT,
  quote_number VARCHAR,
  subtotal NUMERIC(15, 2),
  tax_amount NUMERIC(15, 2),
  total_amount NUMERIC(15, 2),
  priced_at TIMESTAMP,
  priced_by_user_id INTEGER,
  valid_until_date TIMESTAMP,
  source VARCHAR DEFAULT 'b2c_cotizador',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ensure columns exist even if an earlier version of the table was created without them
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS visitor_phone VARCHAR;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS visitor_company VARCHAR;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS visitor_city VARCHAR;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS visitor_rut VARCHAR;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'pending';
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS quote_number VARCHAR;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2);
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2);
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2);
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS priced_at TIMESTAMP;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS priced_by_user_id INTEGER;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS valid_until_date TIMESTAMP;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'b2c_cotizador';

CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_requests_email ON quote_requests(visitor_email);
