-- Migration: Create GDV Schema and Tables
-- Description: Creates a new schema 'gdv' for GDV (Guías de Despacho) ETL tables
-- Author: System
-- Date: 2025-11-11

-- Create schema gdv
CREATE SCHEMA IF NOT EXISTS gdv;

-- Create fact_gdv table in gdv schema
CREATE TABLE IF NOT EXISTS gdv.fact_gdv (
  idmaeddo NUMERIC(20, 0) PRIMARY KEY,
  idmaeedo NUMERIC(20, 0),
  tido TEXT,
  nudo NUMERIC(20, 0),
  endo TEXT,
  suendo TEXT,
  sudo NUMERIC(20, 0),
  feemdo DATE,
  feulvedo DATE,
  esdo TEXT,
  espgdo TEXT,
  kofudo TEXT,
  modo TEXT,
  timodo TEXT,
  tamodo NUMERIC(18, 6),
  caprad NUMERIC(20, 0),
  caprex NUMERIC(20, 0),
  vanedo NUMERIC(20, 0),
  vaivdo NUMERIC(18, 6),
  vabrdo NUMERIC(20, 0),
  lilg TEXT,
  nulido NUMERIC(20, 0),
  sulido NUMERIC(20, 0),
  luvtlido NUMERIC(18, 6),
  bosulido NUMERIC(20, 0),
  kofulido TEXT,
  prct BOOLEAN,
  tict NUMERIC(18, 6),
  tipr TEXT,
  nusepr NUMERIC(18, 6),
  koprct TEXT,
  udtrpr NUMERIC(20, 0),
  rludpr NUMERIC(18, 6),
  caprco1 NUMERIC(18, 6),
  caprad1 NUMERIC(18, 6),
  caprex1 NUMERIC(18, 6),
  caprnc1 NUMERIC(18, 6),
  ud01pr TEXT,
  caprco2 NUMERIC(20, 0),
  caprad2 NUMERIC(20, 0),
  caprex2 NUMERIC(20, 0),
  caprnc2 NUMERIC(20, 0),
  ud02pr TEXT,
  ppprne NUMERIC(18, 6),
  ppprbr NUMERIC(18, 6),
  vaneli NUMERIC(20, 0),
  vabrli NUMERIC(20, 0),
  feemli DATE,
  feerli TIMESTAMP,
  ppprpm NUMERIC(18, 6),
  ppprpmifrs NUMERIC(18, 6),
  logistica NUMERIC(20, 0),
  eslido TEXT,
  ppprnere1 NUMERIC(18, 6),
  ppprnere2 NUMERIC(18, 6),
  fmpr NUMERIC(20, 0),
  mrpr NUMERIC(18, 6),
  zona NUMERIC(18, 6),
  ruen NUMERIC(18, 6),
  recaprre BOOLEAN,
  pfpr NUMERIC(18, 6),
  hfpr NUMERIC(18, 6),
  monto NUMERIC(20, 2),
  ocdo TEXT,
  nokoprct TEXT,
  nokozo NUMERIC(18, 6),
  nosudo TEXT,
  nokofu TEXT,
  nokofudo TEXT,
  nobosuli TEXT,
  nokoen TEXT,
  noruen TEXT,
  nomrpr NUMERIC(18, 6),
  nofmpr TEXT,
  nopfpr TEXT,
  nohfpr TEXT,
  devol1 NUMERIC(20, 0),
  devol2 NUMERIC(20, 0),
  stockfis NUMERIC(20, 0),
  listacost NUMERIC(18, 6),
  liscosmod NUMERIC(20, 0),
  
  -- ETL control fields
  id VARCHAR NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  data_source VARCHAR(20) NOT NULL DEFAULT 'etl_gdv',
  last_etl_sync TIMESTAMP
);

-- Create indexes for fact_gdv
CREATE INDEX IF NOT EXISTS ix_fact_gdv_idmaeedo ON gdv.fact_gdv(idmaeedo);
CREATE INDEX IF NOT EXISTS ix_fact_gdv_feemdo ON gdv.fact_gdv(feemdo);
CREATE INDEX IF NOT EXISTS ix_fact_gdv_esdo ON gdv.fact_gdv(esdo);
CREATE INDEX IF NOT EXISTS ix_fact_gdv_sudo ON gdv.fact_gdv(sudo);
CREATE INDEX IF NOT EXISTS ix_fact_gdv_nokoen ON gdv.fact_gdv(nokoen);
CREATE INDEX IF NOT EXISTS ix_fact_gdv_nokofu ON gdv.fact_gdv(nokofu);
CREATE INDEX IF NOT EXISTS ix_fact_gdv_feemli ON gdv.fact_gdv(feemli);

-- Create gdv_sync_log table in gdv schema
CREATE TABLE IF NOT EXISTS gdv.gdv_sync_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_date TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL,
  period VARCHAR(100) NOT NULL,
  branches TEXT NOT NULL DEFAULT '004,006,007',
  records_processed INTEGER,
  records_inserted INTEGER,
  records_updated INTEGER,
  status_changes INTEGER,
  execution_time_ms INTEGER,
  error_message TEXT,
  watermark_date TIMESTAMP
);

-- Create index for gdv_sync_log
CREATE INDEX IF NOT EXISTS ix_gdv_sync_log_execution_date ON gdv.gdv_sync_log(execution_date DESC);
CREATE INDEX IF NOT EXISTS ix_gdv_sync_log_status ON gdv.gdv_sync_log(status);

-- Grant permissions (adjust as needed for your database user)
-- GRANT USAGE ON SCHEMA gdv TO your_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA gdv TO your_user;
