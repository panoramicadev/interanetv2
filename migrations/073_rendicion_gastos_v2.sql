-- 073_rendicion_gastos_v2.sql
--
-- Rendición de gastos v2: informes de rendición, catálogos configurables e
-- historial de estados unificado. Portado desde primerosresultados/rendicion-gastos
-- y adaptado al modelo single-tenant de interanetv2.
--
-- EXTIENDE las tablas existentes (gastos_empresariales, fund_allocations) — no
-- reemplaza nada ni migra datos productivos.
--
-- Fechas en TIMESTAMPTZ + now(): las tablas viejas usan timestamp naive, que
-- desfasa 4h contra la hora de Chile.

-- ---------------------------------------------------------------------------
-- Informes de rendición
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS informes_rendicion (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(200) NOT NULL,
  periodo VARCHAR(7) NOT NULL,
  user_id VARCHAR NOT NULL,
  creado_por_id VARCHAR NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
  observaciones TEXT,
  motivo_rechazo TEXT,
  comentario_aprobacion TEXT,
  aprobador_id VARCHAR,
  fecha_envio TIMESTAMPTZ,
  fecha_aprobacion TIMESTAMPTZ,
  fecha_pago TIMESTAMPTZ,
  comprobante_pago_url VARCHAR(500),
  segment_code VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_user" ON informes_rendicion (user_id);
CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_estado" ON informes_rendicion (estado);
CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_periodo" ON informes_rendicion (periodo);
CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_created" ON informes_rendicion (created_at);

-- ---------------------------------------------------------------------------
-- Catálogos configurables (categorías, centros de costo, proyectos, tipos doc)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gasto_catalogos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(30) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  codigo VARCHAR(60),
  cuenta_contable VARCHAR(60),
  requiere_rut_proveedor BOOLEAN NOT NULL DEFAULT false,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_gasto_catalogos_tipo" ON gasto_catalogos (tipo, orden);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gasto_catalogos_tipo_nombre" ON gasto_catalogos (tipo, nombre);

-- Semilla con los valores que hoy están hardcodeados en el formulario de gasto.
INSERT INTO gasto_catalogos (tipo, nombre, orden) VALUES
  ('categoria', 'Combustibles', 1),
  ('categoria', 'Peaje', 2),
  ('categoria', 'Colación', 3),
  ('categoria', 'Gestión Ventas', 4),
  ('categoria', 'Otros', 99)
ON CONFLICT (tipo, nombre) DO NOTHING;

INSERT INTO gasto_catalogos (tipo, nombre, orden, requiere_rut_proveedor) VALUES
  ('tipo_documento', 'Boleta', 1, false),
  ('tipo_documento', 'Factura', 2, true),
  ('tipo_documento', 'Recibo', 3, false),
  ('tipo_documento', 'Peaje', 4, false),
  ('tipo_documento', 'Otro', 99, false)
ON CONFLICT (tipo, nombre) DO NOTHING;

-- Centros de costo: se siembran desde los valores ya usados en gastos reales.
INSERT INTO gasto_catalogos (tipo, nombre, orden)
SELECT DISTINCT 'centro_costo', TRIM(centro_costos), 0
FROM gastos_empresariales
WHERE centro_costos IS NOT NULL AND TRIM(centro_costos) <> ''
ON CONFLICT (tipo, nombre) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Historial de estados unificado
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_estados_gasto (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad VARCHAR(20) NOT NULL,
  entidad_id VARCHAR NOT NULL,
  estado_anterior VARCHAR(50),
  estado_nuevo VARCHAR(50) NOT NULL,
  actor_id VARCHAR,
  actor_nombre VARCHAR(255),
  comentario TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_historial_estados_entidad" ON historial_estados_gasto (entidad, entidad_id);
CREATE INDEX IF NOT EXISTS "IDX_historial_estados_created" ON historial_estados_gasto (created_at);

-- ---------------------------------------------------------------------------
-- Columnas nuevas en gastos_empresariales
-- ---------------------------------------------------------------------------
ALTER TABLE gastos_empresariales ADD COLUMN IF NOT EXISTS informe_id VARCHAR;
ALTER TABLE gastos_empresariales ADD COLUMN IF NOT EXISTS proyecto VARCHAR(160);
ALTER TABLE gastos_empresariales ADD COLUMN IF NOT EXISTS viaje_detalle JSONB;

CREATE INDEX IF NOT EXISTS "IDX_gastos_informe" ON gastos_empresariales (informe_id);

-- Al borrar un informe los gastos quedan sueltos, no se pierden.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_gastos_informe' AND table_name = 'gastos_empresariales'
  ) THEN
    ALTER TABLE gastos_empresariales
      ADD CONSTRAINT fk_gastos_informe
      FOREIGN KEY (informe_id) REFERENCES informes_rendicion(id) ON DELETE SET NULL;
  END IF;
END $$;
