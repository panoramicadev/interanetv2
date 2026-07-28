-- 065: trazabilidad del origen de cada destinatario de campaña.
-- Guarda una línea legible ("Lead CRM · etapa Visita · Juan Pérez") junto al
-- destinatario, para que en la campaña se vea de dónde salió cada correo
-- incluso mucho después de haberlo agregado.
ALTER TABLE email_campaign_recipients ADD COLUMN IF NOT EXISTS source_detail VARCHAR;

CREATE INDEX IF NOT EXISTS "IDX_email_campaign_recipients_source"
  ON email_campaign_recipients (source);
