-- Obras: tipo de obra (casas/edificios), tipos de vivienda y etapas constructivas.
--
-- Hasta ahora una obra era "N viviendas" y punto. Pero casi ningún proyecto es
-- homogéneo: hay varios modelos de casa (y en los edificios, varios tipos de
-- departamento), cada uno con su metraje y por lo tanto su propio consumo. Y un
-- edificio además se cuenta por torres.
--
-- La etapa constructiva (fundaciones, obra gruesa, terminaciones) es un dato
-- nuevo y NO reemplaza a `estado`: una obra en terminaciones sigue activa. El
-- catálogo es editable desde el propio selector, por eso vive en su tabla.
--
-- Además, el control de avance baja a nivel de producto: cada SKU tiene su
-- rendimiento declarado y sus viviendas pintadas, porque el sellador y el
-- esmalte de rejas no avanzan al mismo ritmo que la tineta de fachada.

ALTER TABLE obras ADD COLUMN IF NOT EXISTS tipo_obra VARCHAR(20) NOT NULL DEFAULT 'casas';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS torres INTEGER NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS etapa VARCHAR(60);

CREATE TABLE IF NOT EXISTS obra_tipos_vivienda (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id VARCHAR NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  -- Los m² quedaron fuera del alta por ahora; la columna espera al rendimiento
  -- por metro cuadrado.
  metros_cuadrados NUMERIC(8, 2),
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_obra_tipos_vivienda_obra_id" ON obra_tipos_vivienda (obra_id);

CREATE TABLE IF NOT EXISTS obra_etapas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Las tres que usa Construcción hoy. El resto se agrega desde el selector.
INSERT INTO obra_etapas (nombre, orden) VALUES
  ('Fundaciones', 1),
  ('Obra gruesa', 2),
  ('Terminaciones', 3)
ON CONFLICT (nombre) DO NOTHING;

-- Control por producto
ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS rendimiento_por_vivienda NUMERIC(8, 2) NOT NULL DEFAULT 0;
ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS viviendas_pintadas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS tipo_vivienda_id VARCHAR REFERENCES obra_tipos_vivienda(id) ON DELETE SET NULL;
