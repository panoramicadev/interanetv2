-- Agrupaciones comerciales: el formato galón estaba con y sin tilde en
-- ecommerce_products.format_unit, y salía como dos formatos en los filtros.
-- Deja un solo nombre, el mismo que da catalogFormatName (shared/format-utils.ts).
--
-- Nota: el server también ejecuta esto en runtime (bootstrapDatabase).

UPDATE ecommerce_products SET format_unit = 'Galón'
WHERE LOWER(TRIM(format_unit)) IN ('galon', 'galón') AND format_unit <> 'Galón';

UPDATE ecommerce_products SET format_unit = '1/4 Galón'
WHERE LOWER(TRIM(format_unit)) IN ('1/4 galon', '1/4 galón') AND format_unit <> '1/4 Galón';
