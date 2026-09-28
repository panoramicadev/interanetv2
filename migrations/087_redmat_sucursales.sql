-- Sucursales de cadena identificadas por el prefijo de la orden de compra (OCDO).
--
-- Caso REDMAT: las 17 ferreterías de la cadena facturan con un solo RUT
-- (77691044-9) y comparten el mismo código de cliente del ERP, así que el
-- modelo que ya existe para MCT —una ficha por plaza, resuelta por koen propio
-- o por el nombre del vendedor— no las distingue. Lo único que las separa es el
-- prefijo con el que viene la orden de compra en cada venta: "009-1129" es
-- Ferretería Chávez de Cabrero.
--
-- Esta migración es solo aditiva: agrega la columna donde se guarda ese prefijo.
-- Nada la lee todavía; las fichas se cargan aparte con el script de seed.
--
-- Para revertir:
--   DROP INDEX IF EXISTS "IDX_clients_oc_prefix";
--   ALTER TABLE clients DROP COLUMN IF EXISTS oc_prefix;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS oc_prefix VARCHAR;

-- Un prefijo identifica a una sola sucursal DENTRO de una misma casa matriz.
-- No es único a secas: otra cadena puede numerar sus locales igual.
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_clients_oc_prefix_parent"
  ON clients (parent_client_id, oc_prefix)
  WHERE oc_prefix IS NOT NULL;

-- Búsqueda por prefijo al imputar una venta.
CREATE INDEX IF NOT EXISTS "IDX_clients_oc_prefix"
  ON clients (oc_prefix)
  WHERE oc_prefix IS NOT NULL;
