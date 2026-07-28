-- 066: archivar campañas de mailing.
-- Permite sacar una campaña de la lista principal sin borrar su historial de
-- envíos. Drizzle enumera todas las columnas del schema en cada SELECT, así que
-- esta columna debe existir antes de servir tráfico de campañas.
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_archived"
  ON email_campaigns (archived);
