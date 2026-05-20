-- Seguimiento público de pedidos (sin login)
-- 1) tracking_code: identificador opaco que el cliente usa para rastrear su pedido.
-- 2) erp_idmaeedo: puente al ERP/TMS (idmaeedo = idErp), se completa al ingresar el pedido al ERP.

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS tracking_code VARCHAR;

ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS erp_idmaeedo NUMERIC(20, 0);

-- Backfill: asignar un código único a los pedidos existentes que aún no tienen uno.
-- gen_random_uuid() es volátil => se evalúa por fila, garantizando unicidad.
UPDATE ecommerce_orders
SET tracking_code = 'PM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE tracking_code IS NULL;

-- Unicidad del código (permite múltiples NULL, pero tras el backfill no debería haberlos).
CREATE UNIQUE INDEX IF NOT EXISTS UQ_ecommerce_orders_tracking_code
ON ecommerce_orders (tracking_code);
