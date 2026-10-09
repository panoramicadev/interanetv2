-- Obras: documentos del ERP vinculados solos a su obra, y viviendas pintadas
-- cargadas en la obra.
--   obra_ventas.regla      por qué regla se vinculó (NULL = lo asoció una persona)
--   quotes.erp_nvv_number  la nota de venta que recepción digitó en Random
-- Nota: el server también ejecuta este DDL en runtime (bootstrapDatabase).

-- Las viviendas pintadas pasan a cargarse en la obra. Hasta acá la obra mostraba
-- las del producto más adelantado: se copia UNA vez ese número a la obra para que
-- ninguna cambie de avance. La columna nueva de quotes marca que ya se hizo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'erp_nvv_number'
  ) THEN
    UPDATE obras o SET viviendas_pintadas = m.pintadas
    FROM (SELECT obra_id, MAX(viviendas_pintadas) AS pintadas FROM obra_productos GROUP BY obra_id) m
    WHERE m.obra_id = o.id AND o.viviendas_pintadas <> m.pintadas;
  END IF;
END $$;

ALTER TABLE obra_ventas ADD COLUMN IF NOT EXISTS regla VARCHAR(30);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_nvv_number VARCHAR(30);
