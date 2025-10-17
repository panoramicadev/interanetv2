-- ============================================================================
-- SCRIPT DE CREACIÓN DE SCHEMA ETL PARA PRODUCCIÓN
-- Pinturas Panorámica - Data Warehouse
-- ============================================================================
-- IMPORTANTE: Este script debe ejecutarse en la base de datos de PRODUCCIÓN
-- mediante el panel de base de datos de Replit.
-- ============================================================================

-- 1. Crear el schema ventas si no existe
CREATE SCHEMA IF NOT EXISTS "ventas";

-- 2. Crear tabla de log de ejecuciones ETL
CREATE TABLE IF NOT EXISTS "ventas"."etl_execution_log" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "execution_date" timestamp DEFAULT now() NOT NULL,
  "status" varchar(20) NOT NULL,
  "period" varchar(7) NOT NULL,
  "document_types" text NOT NULL,
  "branches" text NOT NULL,
  "records_processed" integer,
  "execution_time_ms" integer,
  "error_message" text,
  "statistics" text,
  "watermark_date" timestamp
);

-- 3. Crear tabla FACT_VENTAS (tabla principal del Data Warehouse)
CREATE TABLE IF NOT EXISTS "ventas"."fact_ventas" (
  "idmaeddo" numeric(20, 0) PRIMARY KEY NOT NULL,
  "idmaeedo" numeric(20, 0),
  "tido" text,
  "nudo" numeric(20, 0),
  "endo" text,
  "suendo" text,
  "sudo" numeric(20, 0),
  "feemdo" date,
  "feulvedo" date,
  "esdo" text,
  "espgdo" text,
  "kofudo" text,
  "modo" text,
  "timodo" text,
  "tamodo" numeric(18, 6),
  "caprad" numeric(20, 0),
  "caprex" numeric(20, 0),
  "vanedo" numeric(20, 0),
  "vaivdo" numeric(18, 6),
  "vabrdo" numeric(20, 0),
  "lilg" text,
  "nulido" numeric(20, 0),
  "sulido" numeric(20, 0),
  "luvtlido" numeric(18, 6),
  "bosulido" numeric(20, 0),
  "kofulido" text,
  "prct" boolean,
  "tict" numeric(18, 6),
  "tipr" text,
  "nusepr" numeric(18, 6),
  "koprct" text,
  "udtrpr" numeric(20, 0),
  "rludpr" numeric(18, 6),
  "caprco1" numeric(18, 6),
  "caprad1" numeric(18, 6),
  "caprex1" numeric(18, 6),
  "caprnc1" numeric(18, 6),
  "ud01pr" text,
  "caprco2" numeric(20, 0),
  "caprad2" numeric(20, 0),
  "caprex2" numeric(20, 0),
  "caprnc2" numeric(20, 0),
  "ud02pr" text,
  "ppprne" numeric(18, 6),
  "ppprbr" numeric(18, 6),
  "vaneli" numeric(20, 0),
  "vabrli" numeric(20, 0),
  "feemli" date,
  "feerli" timestamp,
  "ppprpm" numeric(18, 6),
  "ppprpmifrs" numeric(18, 6),
  "logistica" numeric(20, 0),
  "eslido" text,
  "ppprnere1" numeric(18, 6),
  "ppprnere2" numeric(18, 6),
  "fmpr" numeric(20, 0),
  "mrpr" numeric(18, 6),
  "zona" numeric(18, 6),
  "ruen" numeric(18, 6),
  "recaprre" boolean,
  "pfpr" numeric(18, 6),
  "hfpr" numeric(18, 6),
  "monto" numeric(20, 2),
  "ocdo" text,
  "nokoprct" text,
  "nokozo" numeric(18, 6),
  "nosudo" text,
  "nokofu" text,
  "nokofudo" text,
  "nobosuli" text,
  "nokoen" text,
  "noruen" text,
  "nomrpr" numeric(18, 6),
  "nofmpr" text,
  "nopfpr" text,
  "nohfpr" text,
  "devol1" numeric(20, 0),
  "devol2" numeric(20, 0),
  "stockfis" numeric(20, 0),
  "listacost" numeric(18, 6),
  "liscosmod" numeric(20, 0)
);

-- 4. Crear tablas STAGING (temporales para el proceso ETL)
CREATE TABLE IF NOT EXISTS "ventas"."stg_maeddo" (
  "idmaeddo" numeric(20, 0) PRIMARY KEY NOT NULL,
  "idmaeedo" numeric(20, 0) NOT NULL,
  "koprct" text,
  "nokopr" text,
  "udtrpr" text,
  "caprco" numeric(18, 4),
  "preuni" numeric(18, 6),
  "vaneli" numeric(18, 4),
  "devol1" numeric(18, 4),
  "devol2" numeric(18, 4),
  "stockfis" numeric(18, 4)
);

CREATE TABLE IF NOT EXISTS "ventas"."stg_maeedo" (
  "idmaeedo" numeric(20, 0) PRIMARY KEY NOT NULL,
  "tido" text,
  "nudo" text,
  "feemli" date,
  "endo" text,
  "suendo" text,
  "suli" text,
  "bosulido" text,
  "kofudo" text,
  "vanedo" numeric(18, 4),
  "vaivdo" numeric(18, 4),
  "vabrdo" numeric(18, 4)
);

CREATE TABLE IF NOT EXISTS "ventas"."stg_maeen" (
  "koen" text PRIMARY KEY NOT NULL,
  "nokoen" text,
  "rut" text,
  "zona" text
);

CREATE TABLE IF NOT EXISTS "ventas"."stg_maepr" (
  "kopr" text PRIMARY KEY NOT NULL,
  "nomrpr" text,
  "ud01pr" text,
  "ud02pr" text,
  "tipr" text
);

CREATE TABLE IF NOT EXISTS "ventas"."stg_maeven" (
  "kofu" text PRIMARY KEY NOT NULL,
  "nokofu" text
);

CREATE TABLE IF NOT EXISTS "ventas"."stg_tabbo" (
  "suli" text NOT NULL,
  "bosuli" text NOT NULL,
  "nobosuli" text,
  CONSTRAINT "stg_tabbo_suli_bosuli_pk" PRIMARY KEY("suli","bosuli")
);

CREATE TABLE IF NOT EXISTS "ventas"."stg_tabpp" (
  "kopr" text PRIMARY KEY NOT NULL,
  "listacost" numeric(18, 4),
  "liscosmod" numeric(18, 4)
);

-- 5. Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS "ix_fact_ventas_feemli_id" ON "ventas"."fact_ventas" ("feemli");
CREATE INDEX IF NOT EXISTS "ix_fact_ventas_cliente" ON "ventas"."fact_ventas" ("kofudo");
CREATE INDEX IF NOT EXISTS "ix_fact_ventas_producto" ON "ventas"."fact_ventas" ("koprct");
CREATE INDEX IF NOT EXISTS "ix_fact_ventas_vendedor" ON "ventas"."fact_ventas" ("kofulido");
CREATE INDEX IF NOT EXISTS "ix_fact_ventas_bodega" ON "ventas"."fact_ventas" ("bosulido");

-- ============================================================================
-- SCRIPT COMPLETADO
-- ============================================================================
-- Después de ejecutar este script, la base de datos de producción estará
-- lista para recibir datos del proceso ETL.
-- ============================================================================
