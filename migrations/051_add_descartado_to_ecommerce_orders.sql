-- Add descartado/rejected tracking columns to ecommerce_orders
-- Marca cuando recepción o admin descarta el pedido, junto con la razón
ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS rejected_by_id VARCHAR;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS rejected_notes TEXT;
