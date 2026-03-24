-- Create price_list_mix table (simplified: only SKU + precio)
-- Producto, unidad, costo come from price_list via JOIN on codigo
CREATE TABLE IF NOT EXISTS price_list_mix (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR NOT NULL UNIQUE,
  precio NUMERIC(15, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_list_mix_codigo ON price_list_mix(codigo);
