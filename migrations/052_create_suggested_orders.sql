-- Pedidos sugeridos: carros que vendedores/administradores envían a un cliente de la tienda.
-- El cliente los acepta (se genera un pedido eCommerce), modifica (vuelve al vendedor) o rechaza.
CREATE TABLE IF NOT EXISTS suggested_orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id VARCHAR,
  client_user_id VARCHAR NOT NULL,
  client_name TEXT NOT NULL,
  client_email VARCHAR,

  created_by_id VARCHAR NOT NULL,
  created_by_name VARCHAR,
  created_by_role VARCHAR,

  title VARCHAR,
  items JSONB NOT NULL,
  subtotal NUMERIC(15, 2) NOT NULL,
  tax NUMERIC(15, 2) NOT NULL,
  total NUMERIC(15, 2) NOT NULL,
  price_list_used VARCHAR,
  branch_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,

  status VARCHAR NOT NULL DEFAULT 'sent',

  seller_notes TEXT,
  client_notes TEXT,

  accepted_at TIMESTAMP,
  modified_at TIMESTAMP,
  rejected_at TIMESTAMP,
  resent_at TIMESTAMP,
  converted_order_id VARCHAR,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_suggested_orders_client_user_id" ON suggested_orders (client_user_id);
CREATE INDEX IF NOT EXISTS "IDX_suggested_orders_created_by_id" ON suggested_orders (created_by_id);
CREATE INDEX IF NOT EXISTS "IDX_suggested_orders_status" ON suggested_orders (status);
