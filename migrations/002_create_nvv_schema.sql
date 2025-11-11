-- =====================================================
-- ESQUEMA NVV (NOTAS DE VENTA) - ETL MONITORING
-- =====================================================
-- Creado: 2025-11-11
-- Propósito: Monitoreo de Notas de Venta pendientes
-- Similar a esquema GDV pero para documentos tipo NVV
-- =====================================================

-- Crear esquema dedicado para NVV
CREATE SCHEMA IF NOT EXISTS nvv;

-- =====================================================
-- TABLAS DE STAGING (Temporal - Snapshot de SQL Server)
-- =====================================================

-- Tabla staging para encabezados de documentos NVV (MAEEDO)
CREATE TABLE IF NOT EXISTS nvv.stg_maeedo_nvv (
  idmaeedo BIGINT PRIMARY KEY,
  tido VARCHAR(3),
  nudo VARCHAR(20),
  endo VARCHAR(13),
  suendo VARCHAR(10),
  sudo VARCHAR(3),
  feemdo DATE,
  feer DATE,
  modo VARCHAR(3),
  timodo VARCHAR(1),
  tideve VARCHAR(10),
  tidevefe DATE,
  tideveho VARCHAR(8),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla staging para líneas de detalle NVV (MAEDDO)
CREATE TABLE IF NOT EXISTS nvv.stg_maeddo_nvv (
  idmaeddo BIGINT PRIMARY KEY,
  idmaeedo BIGINT NOT NULL,
  koprct VARCHAR(50),
  nokopr TEXT,
  lilg VARCHAR(2),
  prct VARCHAR(1),
  nulido VARCHAR(10),
  feerli DATE,
  sulido VARCHAR(3),
  bosulido VARCHAR(3),
  luvtlido INTEGER,
  ud01pr VARCHAR(2),
  nokozo VARCHAR(100),
  nusepr VARCHAR(20),
  
  -- Cantidades en unidad 1
  caprco1 NUMERIC(10,2),
  caprad1 NUMERIC(10,2),
  caprex1 NUMERIC(10,2),
  
  -- Unidad 2
  ud02pr VARCHAR(2),
  
  -- Cantidades en unidad 2
  caprco2 NUMERIC(10,2),
  caprad2 NUMERIC(10,2),
  caprex2 NUMERIC(10,2),
  
  -- Precio y monto
  ppprne NUMERIC(15,2),
  tamopppr NUMERIC(15,2),
  vaneli NUMERIC(15,2),
  feemli DATE,
  kofulido VARCHAR(13),
  
  -- CAMPO CRÍTICO: Estado de la línea
  eslido VARCHAR(1),
  
  -- Información adicional
  ocdo VARCHAR(20),
  obdo TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla staging para entidades (MAEEN)
CREATE TABLE IF NOT EXISTS nvv.stg_maeen_nvv (
  koen VARCHAR(13) PRIMARY KEY,
  nokoen VARCHAR(200),
  dien VARCHAR(200),
  zoen VARCHAR(10),
  foen VARCHAR(10),
  cpen VARCHAR(10),
  cmen VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla staging para productos (MAEPR)
CREATE TABLE IF NOT EXISTS nvv.stg_maepr_nvv (
  kopr VARCHAR(50) PRIMARY KEY,
  nokopr TEXT,
  tipr VARCHAR(3),
  pfpr VARCHAR(10),
  fmpr VARCHAR(10),
  rupr VARCHAR(10),
  mrpr VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla staging para vendedores (MAEVEN)
CREATE TABLE IF NOT EXISTS nvv.stg_maeven_nvv (
  kofuven VARCHAR(13) PRIMARY KEY,
  nokofuven VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla staging para sucursales (TABRU)
CREATE TABLE IF NOT EXISTS nvv.stg_tabru_nvv (
  kofurn VARCHAR(3) PRIMARY KEY,
  nokofurn VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla staging para bodegas (TABBO)
CREATE TABLE IF NOT EXISTS nvv.stg_tabbo_nvv (
  kobo VARCHAR(3) PRIMARY KEY,
  nokobo VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- TABLA FACT (Denormalizada para análisis)
-- =====================================================

CREATE TABLE IF NOT EXISTS nvv.fact_nvv (
  -- PK: ID de línea de detalle (único)
  idmaeddo BIGINT PRIMARY KEY,
  
  -- FK: Relación con documento
  idmaeedo BIGINT NOT NULL,
  nudo VARCHAR(20),
  
  -- Información del documento
  tido VARCHAR(3),
  endo VARCHAR(13),
  sudo VARCHAR(3),
  nosudo VARCHAR(100),
  feemdo DATE,
  feer DATE,
  
  -- Información del producto
  koprct VARCHAR(50),
  nokopr TEXT,
  tipr VARCHAR(3),
  pfpr VARCHAR(10),
  fmpr VARCHAR(10),
  mrpr VARCHAR(10),
  
  -- Cantidades (unidad 1)
  caprco1 NUMERIC(10,2),
  caprad1 NUMERIC(10,2),
  caprex1 NUMERIC(10,2),
  ud01pr VARCHAR(2),
  
  -- Cantidades (unidad 2)
  caprco2 NUMERIC(10,2),
  caprad2 NUMERIC(10,2),
  caprex2 NUMERIC(10,2),
  ud02pr VARCHAR(2),
  
  -- Precio y montos
  ppprne NUMERIC(15,2),
  vaneli NUMERIC(15,2),
  monto NUMERIC(15,2),
  
  -- Información del cliente
  nokoen VARCHAR(200),
  endo_nombre VARCHAR(200),
  dien VARCHAR(200),
  comuna VARCHAR(50),
  
  -- Información del vendedor
  kofulido VARCHAR(13),
  nombre_vendedor VARCHAR(200),
  
  -- Bodega
  bosulido VARCHAR(3),
  nombre_bodega VARCHAR(100),
  
  -- Estado de la línea (CRÍTICO)
  eslido VARCHAR(1),
  
  -- Fechas importantes
  feerli DATE,
  feemli DATE,
  
  -- Información adicional
  ocdo VARCHAR(20),
  obdo TEXT,
  lilg VARCHAR(2),
  luvtlido INTEGER,
  
  -- CAMPO CALCULADO: Indica si tiene cantidad pendiente
  -- TRUE = Línea abierta con productos pendientes de despacho
  -- FALSE = Línea cerrada o sin productos pendientes
  cantidad_pendiente BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- ETL control fields
  id VARCHAR(50) NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  data_source VARCHAR(20) NOT NULL DEFAULT 'etl_nvv',
  last_etl_sync TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA DE LOG DE SINCRONIZACIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS nvv.nvv_sync_log (
  id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  status VARCHAR(20), -- 'running', 'completed', 'failed'
  period VARCHAR(100) NOT NULL, -- Descripción del período
  branches TEXT NOT NULL DEFAULT '004,006,007', -- Sucursales NVV
  records_processed INTEGER,
  records_inserted INTEGER,
  records_updated INTEGER,
  status_changes INTEGER,
  execution_time_ms INTEGER,
  watermark_date DATE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices en staging tables
CREATE INDEX IF NOT EXISTS idx_stg_maeedo_nvv_sudo_feemdo 
  ON nvv.stg_maeedo_nvv(sudo, feemdo DESC);

CREATE INDEX IF NOT EXISTS idx_stg_maeedo_nvv_tido 
  ON nvv.stg_maeedo_nvv(tido);

CREATE INDEX IF NOT EXISTS idx_stg_maeddo_nvv_idmaeedo 
  ON nvv.stg_maeddo_nvv(idmaeedo);

CREATE INDEX IF NOT EXISTS idx_stg_maeddo_nvv_eslido 
  ON nvv.stg_maeddo_nvv(eslido);

CREATE INDEX IF NOT EXISTS idx_stg_maeddo_nvv_kofulido 
  ON nvv.stg_maeddo_nvv(kofulido);

-- Índices en fact table
CREATE INDEX IF NOT EXISTS idx_fact_nvv_sudo_feemdo 
  ON nvv.fact_nvv(sudo, feemdo DESC);

CREATE INDEX IF NOT EXISTS idx_fact_nvv_cantidad_pendiente 
  ON nvv.fact_nvv(cantidad_pendiente) 
  WHERE cantidad_pendiente = TRUE;

CREATE INDEX IF NOT EXISTS idx_fact_nvv_kofulido 
  ON nvv.fact_nvv(kofulido);

CREATE INDEX IF NOT EXISTS idx_fact_nvv_nokoen 
  ON nvv.fact_nvv(nokoen);

CREATE INDEX IF NOT EXISTS idx_fact_nvv_eslido 
  ON nvv.fact_nvv(eslido);

CREATE INDEX IF NOT EXISTS idx_fact_nvv_feer 
  ON nvv.fact_nvv(feer);

-- Índice compuesto para queries complejas
CREATE INDEX IF NOT EXISTS idx_fact_nvv_sudo_pend_feer 
  ON nvv.fact_nvv(sudo, cantidad_pendiente, feer DESC) 
  WHERE cantidad_pendiente = TRUE;

-- Índice en sync log
CREATE INDEX IF NOT EXISTS idx_nvv_sync_log_start_time 
  ON nvv.nvv_sync_log(start_time DESC);

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON SCHEMA nvv IS 'Esquema dedicado para monitoreo de Notas de Venta (NVV) pendientes';

COMMENT ON TABLE nvv.fact_nvv IS 'Tabla fact denormalizada con todas las NVV para análisis. Incluye campo cantidad_pendiente que identifica líneas con productos pendientes de despacho.';

COMMENT ON COLUMN nvv.fact_nvv.eslido IS 'Estado de la línea: NULL/'' = Abierto, ''C'' = Cerrado. Campo crítico para determinar cantidad_pendiente.';

COMMENT ON COLUMN nvv.fact_nvv.cantidad_pendiente IS 'Indica si la línea tiene productos pendientes: (CAPRCO - CAPRAD - CAPREX > 0) AND (ESLIDO IS NULL OR ESLIDO = '''' OR ESLIDO = '' '') AND (monto >= 1000)';

COMMENT ON COLUMN nvv.fact_nvv.idmaeddo IS 'ID único de línea de detalle (PRIMARY KEY). Cada línea representa un producto en la NVV.';

COMMENT ON COLUMN nvv.fact_nvv.idmaeedo IS 'ID del documento. Un documento puede tener múltiples líneas (IDMAEDDO).';

COMMENT ON TABLE nvv.nvv_sync_log IS 'Log de ejecuciones del ETL de NVV con métricas y estado';

-- =====================================================
-- GRANTS (Si es necesario)
-- =====================================================

-- Los permisos se heredan del usuario de la conexión
-- No es necesario crear grants adicionales en Replit

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
