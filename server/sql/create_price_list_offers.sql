CREATE TABLE IF NOT EXISTS price_list_offers (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(255) NOT NULL UNIQUE,
  precio NUMERIC(15, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
