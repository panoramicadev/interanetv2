-- Panel de Trabajo: registro de cambios por sección + marcadores de visto por usuario.
-- Alimenta los badges de "algo cambió" en las pestañas del panel y el destacado
-- de los ítems modificados al entrar a cada sección.
-- Nota: el server también ejecuta este DDL en runtime (bootstrapDatabase)
-- porque el runner de migraciones no es confiable en producción.

CREATE TABLE IF NOT EXISTS panel_change_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  section VARCHAR(30) NOT NULL,
  segmento VARCHAR(30),
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR,
  action VARCHAR(30) NOT NULL,
  title TEXT NOT NULL,
  user_id VARCHAR NOT NULL,
  user_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_panel_change_log_created_at" ON panel_change_log (created_at);
CREATE INDEX IF NOT EXISTS "IDX_panel_change_log_section" ON panel_change_log (section);

CREATE TABLE IF NOT EXISTS panel_change_seen (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  section VARCHAR(30) NOT NULL,
  segmento VARCHAR(30) NOT NULL DEFAULT '__all',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT panel_change_seen_unique UNIQUE (user_id, section, segmento)
);

CREATE INDEX IF NOT EXISTS "IDX_panel_change_seen_user_id" ON panel_change_seen (user_id);
