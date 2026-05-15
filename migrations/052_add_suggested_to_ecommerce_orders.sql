-- Pedidos sugeridos: admin/supervisor envía un pedido pre-armado al cliente.
-- El cliente recibe el sugerido por correo y puede aceptarlo, modificarlo o rechazarlo
-- desde su portal. Reutilizamos la tabla ecommerce_orders con flag y auditoría.
ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS is_suggested BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS suggested_by_id VARCHAR;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS suggested_by_name VARCHAR;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS suggested_at TIMESTAMP;

-- Momento en que el cliente respondió (aceptó / modificó / rechazó)
ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS suggested_response_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS IDX_ecommerce_orders_is_suggested
  ON ecommerce_orders(is_suggested);
