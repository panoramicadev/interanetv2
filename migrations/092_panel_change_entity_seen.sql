-- Panel de Trabajo: visto POR FICHA.
-- Los cambios sobre una tarea o un seguimiento de cliente dejan de darse por
-- vistos al entrar a la pestaña: quedan destacados hasta que se abre la ficha.
-- Nota: el server también ejecuta este DDL en runtime (bootstrapDatabase),
-- que además siembra los marcadores a partir de lo que cada usuario ya había
-- visto. Acá va solo el DDL: sembrar en cada arranque daría por visto lo nuevo.

CREATE TABLE IF NOT EXISTS panel_change_entity_seen (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  entity_id VARCHAR NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT panel_change_entity_seen_unique UNIQUE (user_id, entity_id)
);
