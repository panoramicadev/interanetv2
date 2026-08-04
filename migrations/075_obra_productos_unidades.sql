-- 075_obra_productos_unidades.sql
--
-- Unidades del control de obras: de texto libre copiado del ERP a una lista
-- cerrada de cuatro formatos.
--
--   tineta_4gl | tineta_5gl | galon | litro
--
-- Ver client/src/components/obras/unidades.ts, que aplica exactamente las mismas
-- reglas cuando un producto entra desde el catálogo.
--
-- SUPUESTO A REVISAR: una "tineta" sin capacidad se toma como la de 4 galones,
-- que es el formato por defecto de la planilla. Si alguna obra llevaba tinetas
-- de 5, hay que corregirla desde el selector del producto — el respaldo de abajo
-- deja ver exactamente cuáles eran y con qué texto estaban guardadas.
--
-- Lo mismo con "kilo" y "unidad", que dejan de existir como formatos: caen en el
-- valor por defecto y quedan listados en el respaldo para revisarlos.

CREATE TABLE IF NOT EXISTS obra_productos_unidades_backup_075 (
  id varchar,
  kopr varchar,
  nombre text,
  unidad_anterior varchar,
  unidad_nueva varchar,
  respaldado_at timestamptz DEFAULT now()
);

-- El nombre manda por sobre la unidad: el maestro escribe la capacidad ahí
-- ("LATEX CONSTRUCCION BLANCO TINETA 5 GL") y `unidad` traía solo "GL".
WITH normalizado AS (
  SELECT
    p.id,
    p.unidad AS unidad_anterior,
    CASE
      -- Ya está en la lista nueva: no se toca.
      WHEN p.unidad IN ('tineta_4gl', 'tineta_5gl', 'galon', 'litro') THEN p.unidad
      WHEN upper(p.nombre) ~ '(TINETA|BALDE|BD)[ -]*0?5( |$)' THEN 'tineta_5gl'
      WHEN upper(p.nombre) ~ '(^| )0?5 *(GL|GAL|GALON|GALONES)( |$)' THEN 'tineta_5gl'
      WHEN upper(p.unidad) ~ '(TINETA|BALDE|BD)[ -]*0?5( |$)' THEN 'tineta_5gl'
      WHEN upper(p.nombre) ~ '(TINETA|BALDE|BD)[ -]*0?4( |$)' THEN 'tineta_4gl'
      WHEN upper(p.nombre) ~ '(^| )0?4 *(GL|GAL|GALON|GALONES)( |$)' THEN 'tineta_4gl'
      WHEN upper(p.unidad) ~ '(TINETA|BALDE|BD)[ -]*0?4( |$)' THEN 'tineta_4gl'
      WHEN upper(p.nombre) ~ '(^| )(TINETA|BALDE)( |$)' THEN 'tineta_4gl'
      WHEN upper(p.nombre) ~ '(^| )(GL|GAL|GALON|GALONES)( |$)' THEN 'galon'
      WHEN upper(p.unidad) ~ '(^| )(GL|GAL|GALON|GALONES)( |$)' THEN 'galon'
      WHEN upper(p.nombre) ~ '(^| )(LT|LTS|LITRO|LITROS)( |$)' THEN 'litro'
      WHEN upper(p.unidad) ~ '(^| )(LT|LTS|LITRO|LITROS)( |$)' THEN 'litro'
      -- "tineta" a secas, "kilo", "unidad", vacío: el formato por defecto.
      ELSE 'tineta_4gl'
    END AS unidad_nueva
  FROM obra_productos p
)
INSERT INTO obra_productos_unidades_backup_075 (id, kopr, nombre, unidad_anterior, unidad_nueva)
SELECT p.id, p.kopr, p.nombre, n.unidad_anterior, n.unidad_nueva
FROM obra_productos p
JOIN normalizado n ON n.id = p.id
WHERE n.unidad_nueva IS DISTINCT FROM n.unidad_anterior
  AND NOT EXISTS (SELECT 1 FROM obra_productos_unidades_backup_075 b WHERE b.id = p.id);

UPDATE obra_productos p
SET unidad = b.unidad_nueva
FROM obra_productos_unidades_backup_075 b
WHERE b.id = p.id
  -- Solo si sigue como estaba: si alguien ya la corrigió a mano, se respeta.
  AND p.unidad IS NOT DISTINCT FROM b.unidad_anterior;

-- Los productos nuevos entran con el formato por defecto de la planilla.
ALTER TABLE obra_productos ALTER COLUMN unidad SET DEFAULT 'tineta_4gl';
