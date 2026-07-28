-- Obras: historial de movimientos de cada producto de obra.
--
-- `obra_productos` guarda el acumulado (proyectado / pedido / entregado /
-- utilizado). Esta tabla guarda CÓMO se llegó a ese acumulado: cada pedido,
-- cada entrega y cada consumo informado desde la obra, con su fecha y su nota.
-- Los botones rápidos del panel de productos escriben acá y suman en la columna
-- correspondiente de obra_productos.
--
-- Es el primer paso hacia las hojas "Pedidos" y "Avances" de la planilla de
-- temporada, que hasta ahora se resumían en un solo número por obra.

CREATE TABLE IF NOT EXISTS obra_producto_movimientos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_producto_id VARCHAR NOT NULL REFERENCES obra_productos(id) ON DELETE CASCADE,
  -- pedido | entrega | consumo
  tipo VARCHAR(20) NOT NULL,
  -- Negativo = corrección de un movimiento cargado de más.
  cantidad NUMERIC(12, 2) NOT NULL,
  -- Fecha del documento (guía, pedido, avance), no la de carga.
  fecha DATE,
  nota TEXT,
  creado_por VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_obra_prod_mov_producto" ON obra_producto_movimientos (obra_producto_id);
