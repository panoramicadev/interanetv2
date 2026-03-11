-- Add product_family column to product_content for family-level technical sheets
-- When product_family is set, the entry serves as a shared ficha técnica for all SKUs of that family

ALTER TABLE product_content ALTER COLUMN codigo DROP NOT NULL;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS product_family VARCHAR;

-- Create index for faster family lookups
CREATE INDEX IF NOT EXISTS idx_product_content_family ON product_content(product_family);
