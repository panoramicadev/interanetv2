-- Obras: control de avance por obra (pestaña "Obras" del Panel de Trabajo, área Construcción).
--
-- Construcción llevaba en Excel una planilla de temporada por constructora
-- ("Planilla Control <cliente> Temporada 2026-2027"): una fila por obra/ciudad con
-- las viviendas del proyecto, las tinetas proyectadas y lo pedido/entregado, y un
-- resumen arriba con el avance, el saldo en obra y el próximo pedido sugerido.
-- Esas columnas se agregan a la tabla `obras` que ya existía (un cliente puede
-- tener varias obras). Todo el detalle se ingresa a mano; lo único que se elige
-- desde el sistema es el cliente.

ALTER TABLE obras ADD COLUMN IF NOT EXISTS ciudad TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS programa VARCHAR(30);
ALTER TABLE obras ADD COLUMN IF NOT EXISTS temporada VARCHAR(20);
ALTER TABLE obras ADD COLUMN IF NOT EXISTS viviendas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_por_vivienda NUMERIC(5, 2) NOT NULL DEFAULT 1.5;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_proyectadas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS viviendas_pintadas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_utilizadas_real NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_pedidas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_entregadas INTEGER NOT NULL DEFAULT 0;

-- La dirección deja de ser obligatoria: en la planilla la obra se identifica por
-- ciudad y muchas veces no hay dirección postal todavía.
ALTER TABLE obras ALTER COLUMN direccion DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_obras_cliente_id" ON obras (cliente_id);
