-- Mensajes de voz en el chat del Panel de Trabajo. El audio se sube al storage
-- (Supabase en producción) y acá queda su URL y su duración; `content` guarda
-- la transcripción, para que la bitácora siga siendo texto que se lee, se
-- busca y que el asistente IA puede tomar como contexto.

ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS audio_url VARCHAR,
  ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER;
