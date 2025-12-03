-- Migration 017: Add product grouping fields for catalog selection
-- Adds product_family and color fields to enable grouped product selection

-- Add product_family column (e.g., "ANTICORROSIVO ESTRUCTURAL", "BARNIZ MARINO")
ALTER TABLE ecommerce_products 
ADD COLUMN IF NOT EXISTS product_family VARCHAR(255);

-- Add color column (e.g., "BLANCO", "GRIS", "ROJO")
ALTER TABLE ecommerce_products 
ADD COLUMN IF NOT EXISTS color VARCHAR(100);

-- Add index for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_ecommerce_products_family 
ON ecommerce_products(product_family);

CREATE INDEX IF NOT EXISTS idx_ecommerce_products_family_color 
ON ecommerce_products(product_family, color);

COMMENT ON COLUMN ecommerce_products.product_family IS 'Product line/family name without color (e.g., ANTICORROSIVO ESTRUCTURAL)';
COMMENT ON COLUMN ecommerce_products.color IS 'Color variant of the product (e.g., BLANCO, GRIS, ROJO)';
