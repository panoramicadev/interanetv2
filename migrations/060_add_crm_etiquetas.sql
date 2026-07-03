-- Etiquetas libres del cliente en seguimiento (CRM).
-- Se guarda un JSON array de strings en texto plano (ej: ["VIP","Moroso"]).
-- Nota: el server también ejecuta este DDL en runtime (bootstrapDatabase)
-- porque el runner de migraciones no es confiable en producción.

ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS etiquetas TEXT;
