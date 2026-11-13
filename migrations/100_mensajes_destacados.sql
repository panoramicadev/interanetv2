-- Mensajes destacados: la franja neón de la pantalla de inicio.
--
-- Cada mensaje va a un rol (audiencia = clave del rol) o a todos
-- (audiencia = 'todos'). El admin le escribe a cualquiera; el supervisor solo
-- a los vendedores de su área (segmento = su área normalizada, ver
-- normalizePanelSegmento). Nada se borra: archivar deja archivado_at.
-- Nota: el server también ejecuta este DDL al arrancar
-- (ensureMensajesDestacadosTabla) porque el bucle de migraciones se corta en la 022.

CREATE TABLE IF NOT EXISTS mensajes_destacados (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  texto TEXT NOT NULL,
  audiencia VARCHAR(40) NOT NULL,
  segmento VARCHAR(40),
  color VARCHAR(20) NOT NULL DEFAULT 'naranjo',
  activo BOOLEAN NOT NULL DEFAULT true,
  desde VARCHAR(10),
  hasta VARCHAR(10),
  creado_por_id VARCHAR NOT NULL,
  creado_por_nombre TEXT,
  creado_por_rol VARCHAR(40) NOT NULL,
  archivado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_mensajes_destacados_audiencia" ON mensajes_destacados (audiencia);
CREATE INDEX IF NOT EXISTS "IDX_mensajes_destacados_creador" ON mensajes_destacados (creado_por_id);
