-- Obras: detalle de productos por obra (pestaña "Obras" del Panel de Trabajo).
--
-- El control de tinetas de la tabla `obras` sigue siendo la planilla de temporada.
-- Esta tabla es el desglose POR PRODUCTO del mismo despacho: por cada SKU de la
-- obra se lleva lo proyectado, lo pedido, lo entregado y lo utilizado, para las
-- obras donde además de la tineta de fachada van sellador, diluyente, esmalte de
-- rejas, etc. Los totales de la obra NO se derivan de acá.

CREATE TABLE IF NOT EXISTS obra_productos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id VARCHAR NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  -- NULL cuando el producto se cargó a mano (todavía no está en el maestro).
  kopr VARCHAR(60),
  nombre TEXT NOT NULL,
  color VARCHAR(80),
  unidad VARCHAR(20) NOT NULL DEFAULT 'tineta',
  cantidad_proyectada NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cantidad_pedida NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cantidad_entregada NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cantidad_utilizada NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_obra_productos_obra_id" ON obra_productos (obra_id);
