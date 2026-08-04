-- 074_permisos_vendedor_por_rol.sql
--
-- Estandarización del menú del vendedor: los permisos de TODOS los vendedores
-- pasan a gobernarse por el rol RBAC `salesperson` (defaults de
-- shared/permissions.ts), no usuario por usuario.
--
-- Los permisos efectivos se calculan como: defaults del rol → overrides de
-- role_permissions → overrides de user_permissions (ver server/permissions.ts).
-- Mientras queden overrides viejos guardados, cambiar los defaults NO cambia
-- nada para los usuarios que los tengan: por eso hay que limpiarlos.
--
-- NADA se borra sin respaldo: lo eliminado queda en las tablas *_backup_074,
-- así un INSERT ... SELECT las devuelve si hiciera falta.

-- ---------------------------------------------------------------------------
-- Las dos tablas de overrides las crea server/permissions.ts en runtime, que
-- puede correr DESPUÉS de las migraciones. Se replican acá (mismo DDL,
-- IF NOT EXISTS) para que esta migración nunca falle por orden de arranque:
-- un error acá aborta el boot completo.
-- ---------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS user_permissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email varchar NOT NULL,
  permission_key varchar NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  updated_by varchar,
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_permissions_email_key"
  ON user_permissions (user_email, permission_key);

-- ---------------------------------------------------------------------------
-- Respaldos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions_backup_074 (
  id varchar,
  role varchar,
  permission_key varchar,
  allowed boolean,
  updated_by varchar,
  updated_at timestamp,
  respaldado_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_permissions_backup_074 (
  id varchar,
  user_email varchar,
  permission_key varchar,
  allowed boolean,
  updated_by varchar,
  updated_at timestamp,
  respaldado_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Overrides de ROL del vendedor
-- ---------------------------------------------------------------------------
INSERT INTO role_permissions_backup_074 (id, role, permission_key, allowed, updated_by, updated_at)
SELECT rp.id, rp.role, rp.permission_key, rp.allowed, rp.updated_by, rp.updated_at
FROM role_permissions rp
WHERE rp.role = 'salesperson'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions_backup_074 b WHERE b.id = rp.id
  );

DELETE FROM role_permissions WHERE role = 'salesperson';

-- ---------------------------------------------------------------------------
-- Overrides POR USUARIO de los vendedores
-- ---------------------------------------------------------------------------
-- user_permissions se llavea por email (no por id), igual que en el servicio.
INSERT INTO user_permissions_backup_074 (id, user_email, permission_key, allowed, updated_by, updated_at)
SELECT up.id, up.user_email, up.permission_key, up.allowed, up.updated_by, up.updated_at
FROM user_permissions up
WHERE lower(trim(up.user_email)) IN (
    SELECT lower(trim(u.email)) FROM users u WHERE u.role = 'salesperson'
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions_backup_074 b WHERE b.id = up.id
  );

DELETE FROM user_permissions
WHERE lower(trim(user_email)) IN (
  SELECT lower(trim(u.email)) FROM users u WHERE u.role = 'salesperson'
);
