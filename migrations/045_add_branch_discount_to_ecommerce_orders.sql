-- Migration 045: Persistir el descuento de sucursal aplicado a cada pedido eCommerce.
-- Sin esto, el % aplicado al momento del pedido se pierde y el panel sólo lo
-- recupera al "Recalcular precios", lo que dejaba pedidos MCT (5%) sin reflejar
-- el descuento al ingresarlos y visualizarlos.
ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS branch_discount_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS price_list_used varchar;
