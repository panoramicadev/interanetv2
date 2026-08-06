-- 079_market_sub_usuarios.sql
--
-- Compradores (sub-usuarios) de un cliente de Panorámica Market.
--
-- Hasta ahora cada cliente tenía UNA cuenta ("Activar Market" desde la ficha) y
-- quien tuviera esa clave compraba a nombre de la empresa. Los clientes con varios
-- locales o encargados necesitan que su gente arme pedidos sin compartir la clave
-- del titular y sin que esos pedidos salgan a Panorámica sin visto bueno.
--
-- Modelo: el comprador es otro registro role='client' en salespeople_users con
-- parent_user_id = id del titular y el MISMO client_id, así hereda ficha, lista de
-- precios, crédito y convenios. Sus pedidos nacen en 'pending_client' y sólo entran
-- al flujo normal cuando el titular los aprueba desde su panel.
--
-- La intranet habilita la función por cliente (can_create_sub_users en el titular).

ALTER TABLE salespeople_users ADD COLUMN IF NOT EXISTS parent_user_id VARCHAR;
ALTER TABLE salespeople_users ADD COLUMN IF NOT EXISTS can_create_sub_users BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "IDX_salespeople_parent_user" ON salespeople_users (parent_user_id);

-- Quién armó el pedido (el comprador) vs. a quién pertenece (el titular, client_id).
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR;
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS created_by_name VARCHAR;

-- Visto bueno del titular, previo y distinto a la aprobación de Panorámica.
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMP;
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS client_approved_by_id VARCHAR;
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS client_rejected_at TIMESTAMP;
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS client_rejected_by_id VARCHAR;
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS client_rejected_reason TEXT;

CREATE INDEX IF NOT EXISTS "IDX_ecommerce_orders_created_by" ON ecommerce_orders (created_by_user_id);
