-- Módulo Remuneraciones: puente entre las personas de Talana y las de la intranet.
--
-- Talana identifica a cada persona por RUT, la intranet por `users.id` y las
-- ventas del ERP por el NOMBRE del vendedor (`fact_ventas.nokofu`). Son tres
-- identidades distintas y ninguna tabla las tenía juntas: sin este puente no se
-- puede comparar la comisión que la intranet calcula con la que Talana paga.
--
-- `confirmado` distingue el calce que propone el sistema (por nombre) del que
-- RR.HH. revisó; `ignorado` es para quien no corresponde cruzar.
--
-- Se replica en runtime en server/routes-remuneraciones.ts (ensureTables) porque
-- el runner de migraciones no es confiable en producción.

CREATE TABLE IF NOT EXISTS talana_vinculos (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  talana_empleado_id integer NOT NULL,
  rut varchar(20),
  nombre_talana varchar(255),
  user_id varchar,
  salesperson_name varchar(255),
  confirmado boolean NOT NULL DEFAULT false,
  ignorado boolean NOT NULL DEFAULT false,
  actualizado_por varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_talana_vinculos_empleado"
  ON talana_vinculos (talana_empleado_id);

CREATE INDEX IF NOT EXISTS "IDX_talana_vinculos_rut"
  ON talana_vinculos (rut);
