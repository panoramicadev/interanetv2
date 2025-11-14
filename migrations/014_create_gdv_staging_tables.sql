-- Migration 014: Crear/actualizar tablas staging de GDV
-- Problema: Las tablas staging de GDV pueden no existir en producción o pueden tener columnas faltantes
-- Solución: Crear tablas si no existen Y agregar columnas faltantes si ya existen

-- 1. Tabla staging: stg_maeedo_gdv (Encabezados de GDV)
CREATE TABLE IF NOT EXISTS gdv.stg_maeedo_gdv (
  idmaeedo NUMERIC(20, 0) PRIMARY KEY,
  empresa TEXT,
  tido TEXT,
  nudo TEXT,
  endo TEXT,
  suendo TEXT,
  endofi TEXT,
  tigedo TEXT,
  sudo TEXT,
  luvtdo TEXT,
  feemdo DATE,
  kofudo TEXT,
  esdo TEXT,
  espgdo TEXT,
  suli TEXT,
  bosulido TEXT,
  feer DATE,
  vanedo NUMERIC(18, 4),
  vaivdo NUMERIC(18, 4),
  vabrdo NUMERIC(18, 4),
  lilg TEXT,
  modo TEXT,
  timodo TEXT,
  tamodo NUMERIC(18, 4),
  ocdo TEXT,
  feulvedo DATE
);

-- 2. Tabla staging: stg_maeddo_gdv (Detalles de líneas GDV)
CREATE TABLE IF NOT EXISTS gdv.stg_maeddo_gdv (
  idmaeddo NUMERIC(20, 0) PRIMARY KEY,
  idmaeedo NUMERIC(20, 0),
  koprct TEXT,
  sulido TEXT,
  bosulido TEXT,
  kofulido TEXT,
  eslido TEXT,
  caprco1 NUMERIC(18, 4),
  caprco2 NUMERIC(18, 4),
  caprad1 NUMERIC(18, 4),
  caprad2 NUMERIC(18, 4),
  caprnc1 NUMERIC(18, 4),
  caprnc2 NUMERIC(18, 4),
  vaneli NUMERIC(18, 4),
  feemli DATE,
  feerli TIMESTAMP,
  devol1 NUMERIC(18, 4),
  devol2 NUMERIC(18, 4),
  stockfis NUMERIC(18, 4)
);

-- 3. Tabla staging: stg_maeen_gdv (Entidades/Clientes GDV)
CREATE TABLE IF NOT EXISTS gdv.stg_maeen_gdv (
  koen TEXT PRIMARY KEY,
  nokoen TEXT,
  ruen TEXT
);

-- 4. Tabla staging: stg_maepr_gdv (Productos GDV)
CREATE TABLE IF NOT EXISTS gdv.stg_maepr_gdv (
  kopr TEXT PRIMARY KEY,
  nomrpr TEXT
);

-- Agregar columnas faltantes a stg_maepr_gdv (para compatibilidad con versiones anteriores)
ALTER TABLE gdv.stg_maepr_gdv ADD COLUMN IF NOT EXISTS nokopr TEXT;
ALTER TABLE gdv.stg_maepr_gdv ADD COLUMN IF NOT EXISTS rupr TEXT;
ALTER TABLE gdv.stg_maepr_gdv ADD COLUMN IF NOT EXISTS ud01pr TEXT;
ALTER TABLE gdv.stg_maepr_gdv ADD COLUMN IF NOT EXISTS ud02pr TEXT;
ALTER TABLE gdv.stg_maepr_gdv ADD COLUMN IF NOT EXISTS tipr TEXT;

-- 5. Tabla staging: stg_maeven_gdv (Vendedores GDV)
CREATE TABLE IF NOT EXISTS gdv.stg_maeven_gdv (
  kofu TEXT PRIMARY KEY,
  nokofu TEXT
);

-- 6. Tabla staging: stg_tabbo_gdv (Bodegas GDV)
CREATE TABLE IF NOT EXISTS gdv.stg_tabbo_gdv (
  suli TEXT NOT NULL,
  bosuli TEXT NOT NULL,
  nobosuli TEXT,
  PRIMARY KEY (suli, bosuli)
);

-- 7. Tabla staging: stg_tabru_gdv (Segmentos GDV)
CREATE TABLE IF NOT EXISTS gdv.stg_tabru_gdv (
  koru TEXT PRIMARY KEY,
  nokoru TEXT
);

-- 8. Crear índices para mejorar performance de JOINs
CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_idmaeedo ON gdv.stg_maeddo_gdv(idmaeedo);
CREATE INDEX IF NOT EXISTS idx_stg_maeedo_gdv_endo ON gdv.stg_maeedo_gdv(endo);
CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_koprct ON gdv.stg_maeddo_gdv(koprct);
CREATE INDEX IF NOT EXISTS idx_stg_maeedo_gdv_kofudo ON gdv.stg_maeedo_gdv(kofudo);
CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_kofulido ON gdv.stg_maeddo_gdv(kofulido);
CREATE INDEX IF NOT EXISTS idx_stg_maeen_gdv_ruen ON gdv.stg_maeen_gdv(ruen);
CREATE INDEX IF NOT EXISTS idx_stg_maepr_gdv_rupr ON gdv.stg_maepr_gdv(rupr);

-- 9. Comentarios de documentación
COMMENT ON TABLE gdv.stg_maeedo_gdv IS 'Staging: Encabezados de Guías de Despacho (MAEEDO)';
COMMENT ON TABLE gdv.stg_maeddo_gdv IS 'Staging: Detalles de líneas de Guías de Despacho (MAEDDO)';
COMMENT ON TABLE gdv.stg_maeen_gdv IS 'Staging: Entidades/Clientes (MAEEN)';
COMMENT ON TABLE gdv.stg_maepr_gdv IS 'Staging: Productos (MAEPR)';
COMMENT ON TABLE gdv.stg_maeven_gdv IS 'Staging: Vendedores (TABFU)';
COMMENT ON TABLE gdv.stg_tabbo_gdv IS 'Staging: Bodegas (TABBO)';
COMMENT ON TABLE gdv.stg_tabru_gdv IS 'Staging: Segmentos (TABRU)';
