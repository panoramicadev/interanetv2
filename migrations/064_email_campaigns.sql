-- 064_email_campaigns.sql
-- Módulo de Campañas de Marketing (mailing masivo con Resend).
-- El server también ejecuta este DDL en runtime (bootstrapDatabase) porque el
-- runner de migraciones no es confiable en producción. Mantener ambos en sync.

CREATE TABLE IF NOT EXISTS email_campaign_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  subject VARCHAR,
  preheader VARCHAR,
  body_html TEXT NOT NULL,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_email_campaign_templates_name" ON email_campaign_templates (name);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  subject VARCHAR NOT NULL,
  preheader VARCHAR,
  from_name VARCHAR,
  reply_to VARCHAR,
  body_html TEXT NOT NULL DEFAULT '',
  status VARCHAR NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  register_in_crm BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR,
  started_at TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_status" ON email_campaigns (status);
CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_scheduled_at" ON email_campaigns (scheduled_at);
CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_created_at" ON email_campaigns (created_at);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  name VARCHAR,
  source VARCHAR NOT NULL DEFAULT 'manual',
  source_id VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_email_campaign_recipients_campaign" ON email_campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS "IDX_email_campaign_recipients_status" ON email_campaign_recipients (status);
CREATE UNIQUE INDEX IF NOT EXISTS "email_campaign_recipients_campaign_email_unique" ON email_campaign_recipients (campaign_id, email);
