-- Agrega el cliente/destinatario a los movimientos de inventario de marketing.
-- Permite registrar a qué cliente se asignó un retiro (o quién devolvió, en una devolución).
-- El tipo 'devolucion' no requiere cambios de schema: la columna `tipo` es varchar sin constraint.

ALTER TABLE inventario_marketing_movimientos
  ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(255);
