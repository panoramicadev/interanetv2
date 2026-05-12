-- Add rejection/discard tracking columns to ecommerce_orders
-- Permite descartar un pedido dejando registro del motivo, quién lo descartó y cuándo.
ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS rejected_by_id VARCHAR;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
