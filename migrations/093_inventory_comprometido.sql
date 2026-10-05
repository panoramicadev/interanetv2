-- Inventario: stock comprometido en notas de venta (MAEST.STOCNV1/2 del ERP).
-- El Tomador de Pedidos muestra el disponible por bodega: stock − comprometido.
-- Nota: el server también ejecuta este DDL en runtime (bootstrapDatabase).

ALTER TABLE inventory_products ADD COLUMN IF NOT EXISTS comprometido1 NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE inventory_products ADD COLUMN IF NOT EXISTS comprometido2 NUMERIC(15, 2) DEFAULT 0;
