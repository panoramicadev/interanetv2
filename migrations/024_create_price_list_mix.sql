-- Create price_list_mix table for simplified Mix price list
CREATE TABLE IF NOT EXISTS price_list_mix (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR NOT NULL UNIQUE,
  producto TEXT NOT NULL,
  unidad VARCHAR,
  precio NUMERIC(15, 2),
  costo_produccion NUMERIC(15, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_list_mix_codigo ON price_list_mix(codigo);
