-- === Esquema destino para Neon/PostgreSQL ===
CREATE SCHEMA IF NOT EXISTS ventas;
SET search_path=ventas,public;

-- Staging básicas (origen SQL Server)
CREATE TABLE IF NOT EXISTS stg_maeedo (
  idmaeedo    bigint PRIMARY KEY,
  tido        text,
  nudo        text,
  feemli      date,
  endo        text,
  suendo      text,
  suli        text,
  bosulido    text,
  kofudo      text,
  vanedo      numeric(18,4),
  vaivdo      numeric(18,4),
  vabrdo      numeric(18,4)
);
CREATE TABLE IF NOT EXISTS stg_maeddo (
  idmaeddo    bigint PRIMARY KEY,
  idmaeedo    bigint NOT NULL,
  koprct      text,
  nokopr      text,
  udtrpr      text,
  caprco      numeric(18,4),
  preuni      numeric(18,6),
  vaneli      numeric(18,4),
  devol1      numeric(18,4),
  devol2      numeric(18,4),
  stockfis    numeric(18,4)
);
CREATE TABLE IF NOT EXISTS stg_maeen (
  koen        text PRIMARY KEY,
  nokoen      text,
  rut         text,
  zona        text
);
CREATE TABLE IF NOT EXISTS stg_maepr (
  kopr        text PRIMARY KEY,
  nomrpr      text,
  ud01pr      text,
  ud02pr      text,
  tipr        text
);
CREATE TABLE IF NOT EXISTS stg_maeven (
  kofu        text PRIMARY KEY,
  nokofu      text
);
CREATE TABLE IF NOT EXISTS stg_tabbo (
  suli        text,
  bosuli      text,
  nobosuli    text,
  PRIMARY KEY (suli, bosuli)
);
CREATE TABLE IF NOT EXISTS stg_tabpp (
  kopr        text PRIMARY KEY,
  listacost   numeric(18,4),
  liscosmod   numeric(18,4)
);

-- Tabla final con las 79 columnas del Excel
CREATE TABLE IF NOT EXISTS fact_ventas (
  idmaeedo bigint,
  tido text,
  nudo bigint,
  endo text,
  suendo text,
  sudo bigint,
  feemdo date,
  feulvedo date,
  kofudo text,
  modo text,
  timodo text,
  tamodo numeric(18,6),
  caprad bigint,
  caprex bigint,
  vanedo bigint,
  vaivdo numeric(18,6),
  vabrdo bigint,
  lilg text,
  nulido bigint,
  sulido bigint,
  luvtlido numeric(18,6),
  bosulido bigint,
  kofulido text,
  prct boolean,
  tict numeric(18,6),
  tipr text,
  nusepr numeric(18,6),
  koprct text,
  udtrpr bigint,
  rludpr numeric(18,6),
  caprco1 numeric(18,6),
  caprad1 numeric(18,6),
  caprex1 numeric(18,6),
  caprnc1 numeric(18,6),
  ud01pr text,
  caprco2 bigint,
  caprad2 bigint,
  caprex2 bigint,
  caprnc2 bigint,
  ud02pr text,
  ppprne numeric(18,6),
  ppprbr numeric(18,6),
  vaneli bigint,
  vabrli bigint,
  feemli date,
  feerli timestamp,
  ppprpm numeric(18,6),
  ppprpmifrs numeric(18,6),
  logistica bigint,
  eslido text,
  ppprnere1 numeric(18,6),
  ppprnere2 numeric(18,6),
  idmaeddo bigint,
  fmpr bigint,
  mrpr numeric(18,6),
  zona numeric(18,6),
  ruen numeric(18,6),
  recaprre boolean,
  pfpr numeric(18,6),
  hfpr numeric(18,6),
  monto bigint,
  ocdo text,
  nokoprct text,
  nokozo numeric(18,6),
  nosudo text,
  nokofu text,
  nokofudo text,
  nobosuli text,
  nokoen text,
  noruen text,
  nomrpr numeric(18,6),
  nofmpr text,
  nopfpr text,
  nohfpr text,
  devol1 bigint,
  devol2 bigint,
  stockfis bigint,
  listacost numeric(18,6),
  liscosmod bigint,
  PRIMARY KEY (idmaeddo)
);
-- Índices para el dashboard
CREATE INDEX IF NOT EXISTS ix_fact_ventas_feemli_id ON fact_ventas (feemli DESC, idmaeedo DESC, idmaeddo DESC);
CREATE INDEX IF NOT EXISTS ix_fact_ventas_cliente   ON fact_ventas (endo);
CREATE INDEX IF NOT EXISTS ix_fact_ventas_producto  ON fact_ventas (koprct);
CREATE INDEX IF NOT EXISTS ix_fact_ventas_vendedor  ON fact_ventas (kofudo);
CREATE INDEX IF NOT EXISTS ix_fact_ventas_bodega    ON fact_ventas (suli, bosulido);
