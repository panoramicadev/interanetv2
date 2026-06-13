-- Sistema de Roles y Permisos: overrides por rol.
-- Un rol sin filas usa los defaults de shared/permissions.ts.
-- Nota: el server también ejecuta este DDL en runtime (CREATE IF NOT EXISTS)
-- porque el runner de migraciones no es confiable en producción.

CREATE TABLE IF NOT EXISTS role_permissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  role varchar NOT NULL,
  permission_key varchar NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  updated_by varchar,
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_permissions_role_key"
  ON role_permissions (role, permission_key);
