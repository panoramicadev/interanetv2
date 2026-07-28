-- Solicitudes de Marketing: área/segmento de origen.
--
-- El Panel de Trabajo se navega por ÁREA (Ferreterías / Construcción / Industrial /
-- Marketing), pero la bandeja de solicitudes de la pestaña Marketing mostraba TODAS
-- las solicitudes en cualquier área. Con esta columna cada pedido queda atribuido al
-- área desde la que se envió y la bandeja se acota a la seleccionada.

ALTER TABLE solicitudes_marketing ADD COLUMN IF NOT EXISTS segmento VARCHAR(255);

CREATE INDEX IF NOT EXISTS "IDX_solicitudes_marketing_segmento"
  ON solicitudes_marketing (segmento);

-- Backfill de las solicitudes previas a la columna: se deduce el área del solicitante.
-- Primero su segmento asignado; si no tiene (caso típico de un encargado como Daniel
-- Hermosilla), el de su equipo de vendedores. El texto de assigned_segment es libre
-- ("CONSTRUCCION", "Ferreterías", "Digital"...), por eso se compara por prefijo sin
-- tildes. Las que no se pueden atribuir (p. ej. creadas por un admin sin área) quedan
-- en NULL y la UI las muestra en todas las áreas marcadas como "Sin área".
WITH segmento_usuario AS (
  SELECT
    u.id,
    COALESCE(
      CASE
        WHEN LOWER(u.assigned_segment) LIKE '%ferreter%' THEN 'ferreterias'
        WHEN LOWER(u.assigned_segment) LIKE '%construc%' THEN 'construccion'
        WHEN LOWER(u.assigned_segment) LIKE '%digital%'
          OR LOWER(u.assigned_segment) LIKE '%industrial%' THEN 'digital'
      END,
      (
        SELECT CASE
          WHEN LOWER(sp.assigned_segment) LIKE '%ferreter%' THEN 'ferreterias'
          WHEN LOWER(sp.assigned_segment) LIKE '%construc%' THEN 'construccion'
          WHEN LOWER(sp.assigned_segment) LIKE '%digital%'
            OR LOWER(sp.assigned_segment) LIKE '%industrial%' THEN 'digital'
        END
        FROM salespeople_users sp
        WHERE sp.supervisor_id = u.id
          AND sp.assigned_segment IS NOT NULL
        LIMIT 1
      )
    ) AS segmento
  FROM salespeople_users u
)
UPDATE solicitudes_marketing s
SET segmento = su.segmento
FROM segmento_usuario su
WHERE s.supervisor_id = su.id
  AND s.segmento IS NULL
  AND su.segmento IS NOT NULL;
