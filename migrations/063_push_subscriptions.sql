-- Suscripciones Web Push (PWA): una fila por dispositivo/navegador suscrito.
-- Alimenta las notificaciones push en iPhone/Android/desktop cuando la app
-- está instalada como PWA (en iOS requiere "Añadir a pantalla de inicio").
-- Nota: el server también ejecuta este DDL en runtime (bootstrapDatabase)
-- porque el runner de migraciones no es confiable en producción.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now(),
  last_used_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_push_subscriptions_user_id" ON push_subscriptions (user_id);
