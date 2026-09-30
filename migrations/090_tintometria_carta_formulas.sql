-- 090: Carta de colores y libro de fórmulas de tintometría (sep-2026).
--
-- tinto_colores: los colores de cada cartilla (Panorámica / Copper Color,
-- Sherwin-Williams…), con su nombre y un hex referencial para mostrarlos.
-- tinto_formulas: por color, línea de producto y base, las dosis de cada
-- colorante por formato (galón, balde de 5 galones…), en la notación de la
-- máquina ("1Y14-0"). Las del libro las sube laboratorio desde el Excel; las de
-- laboratorio salen de las solicitudes de los vendedores.
--
-- Lo mismo lo crea ensureTintometriaTablas (server/migrations.ts) al arrancar,
-- que además carga la pantonera; este archivo queda como registro.

CREATE TABLE IF NOT EXISTS tinto_colores (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  cartilla VARCHAR(40) NOT NULL,
  codigo VARCHAR(40) NOT NULL,
  nombre TEXT,
  hex VARCHAR(7),
  grupo VARCHAR(20),
  orden INTEGER,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tinto_colores_cartilla_codigo" ON tinto_colores (cartilla, codigo);

CREATE TABLE IF NOT EXISTS tinto_formulas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  color_id VARCHAR NOT NULL REFERENCES tinto_colores(id) ON DELETE CASCADE,
  linea VARCHAR(120) NOT NULL,
  base VARCHAR(40) NOT NULL,
  variante INTEGER NOT NULL DEFAULT 1,
  origen VARCHAR(20) NOT NULL DEFAULT 'libro',
  version VARCHAR(60),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones TEXT,
  alerta TEXT,
  cliente_id VARCHAR,
  obra TEXT,
  solicitud_id VARCHAR,
  creado_por_id VARCHAR,
  creado_por_nombre TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_tinto_formulas_color" ON tinto_formulas (color_id);
-- Una fórmula del libro por color, línea, base y variante: es lo que usa la
-- importación para actualizar en vez de duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tinto_formulas_libro"
  ON tinto_formulas (color_id, linea, base, variante) WHERE origen = 'libro';
