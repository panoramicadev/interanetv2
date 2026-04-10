-- Migration: Create custom_price_lists and custom_price_list_items tables
-- These tables generalize the single price_list_mix into a multi-list system

CREATE TABLE IF NOT EXISTS custom_price_lists (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_price_list_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  list_code VARCHAR NOT NULL,
  codigo VARCHAR NOT NULL,
  precio NUMERIC(15, 2),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(list_code, codigo)
);

-- Create index for fast lookup by list_code
CREATE INDEX IF NOT EXISTS idx_cpli_list_code ON custom_price_list_items(list_code);
CREATE INDEX IF NOT EXISTS idx_cpli_codigo ON custom_price_list_items(codigo);

-- Migrate existing LP02 (Lista Mix) data
INSERT INTO custom_price_lists (code, name, active)
SELECT 'LP02', 'Lista Mix', true
WHERE NOT EXISTS (SELECT 1 FROM custom_price_lists WHERE code = 'LP02');

-- Migrate existing price_list_mix items into the new structure
INSERT INTO custom_price_list_items (list_code, codigo, precio)
SELECT 'LP02', codigo, precio FROM price_list_mix
ON CONFLICT (list_code, codigo) DO NOTHING;
