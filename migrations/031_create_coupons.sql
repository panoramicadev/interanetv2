-- 031: Create ecommerce_coupons table
-- Supports percentage, fixed amount, and free-shipping coupons
-- that can target the entire cart or a specific product SKU.

CREATE TABLE IF NOT EXISTS ecommerce_coupons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,              -- Código del cupón (ej: DESCUENTO10)
  description VARCHAR,                       -- Descripción legible
  discount_type VARCHAR NOT NULL,            -- 'percentage' | 'fixed' | 'free_shipping'
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Valor del descuento
  applies_to VARCHAR NOT NULL DEFAULT 'cart', -- 'cart' | 'product'
  product_sku VARCHAR,                       -- SKU del producto si applies_to = 'product'
  min_order_amount NUMERIC(10, 2) DEFAULT 0, -- Monto mínimo del cart para aplicar
  max_uses INTEGER DEFAULT NULL,             -- NULL = sin límite
  times_used INTEGER NOT NULL DEFAULT 0,     -- Contador de usos
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP DEFAULT NULL,         -- NULL = sin vencimiento
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_coupons_code ON ecommerce_coupons(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_ecommerce_coupons_active ON ecommerce_coupons(is_active);
