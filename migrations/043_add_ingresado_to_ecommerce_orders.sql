-- Add ingresado tracking columns to ecommerce_orders
-- Marca cuando recepción ingresa el pedido al ERP
ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS ingresado_at TIMESTAMP;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS ingresado_by_id VARCHAR;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS ingresado_notes TEXT;
