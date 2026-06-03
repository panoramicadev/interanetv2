-- 056_add_pallet_sales_config.sql
--
-- Venta por pallet — configuración comercial editable desde admin.
--
-- Contexto: la tabla ya tiene `packaging_amount_per_pallet` (poblado por el ETL
-- desde SAP/Softland). Acá agregamos un FLAG explícito para habilitar la
-- venta-por-pallet en la tienda online + un descuento opcional por línea.
--
-- Política comercial:
--   - palletEnabled = true requiere que packaging_amount_per_pallet sea > 0
--     (la UI no muestra el botón si no hay unidades).
--   - El descuento por pallet REEMPLAZA cualquier oferta activa del SKU
--     (no se suman). Se calcula sobre el precio unitario de lista del cliente.
--
-- ⚠️ Deploy manual: el runner de migraciones SQL del proyecto está roto
-- (poison pills CONCURRENTLY 022 / add_performance_indexes). Aplicar este
-- ALTER TABLE a mano en producción.

ALTER TABLE ecommerce_products
  ADD COLUMN IF NOT EXISTS pallet_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE ecommerce_products
  ADD COLUMN IF NOT EXISTS pallet_discount_pct numeric(5,2);

-- Sanity constraint: 0..100 (NULL permitido = sin descuento)
ALTER TABLE ecommerce_products
  DROP CONSTRAINT IF EXISTS ecommerce_products_pallet_discount_pct_range;

ALTER TABLE ecommerce_products
  ADD CONSTRAINT ecommerce_products_pallet_discount_pct_range
  CHECK (pallet_discount_pct IS NULL OR (pallet_discount_pct >= 0 AND pallet_discount_pct <= 100));

-- Índice parcial para listar rápido SKUs con pallet habilitado en el admin
CREATE INDEX IF NOT EXISTS idx_ecommerce_products_pallet_enabled
  ON ecommerce_products (pallet_enabled)
  WHERE pallet_enabled = true;

COMMENT ON COLUMN ecommerce_products.pallet_enabled IS
  'Si true, la tienda muestra el botón "Pallet completo" usando packaging_amount_per_pallet como cantidad.';
COMMENT ON COLUMN ecommerce_products.pallet_discount_pct IS
  'Descuento (0..100) aplicado al precio unitario al comprar pallet completo. REEMPLAZA ofertas activas del SKU; no se suman.';
