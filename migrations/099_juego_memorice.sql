-- Memorice Colores Patagonia (Feria Redmat · El Fogón, Chicureo, 4 al 6 nov 2026).
--
-- Juego público en /memorice: cada partida registrada queda acá para el
-- ranking del día, y el jugador entra además como lead del CRM de Ferretería
-- (crm_seguimiento_clientes, etiqueta "FERIA REDMAT"). crm_seguimiento_id
-- guarda ese vínculo para no repetir el hito en cada partida.

CREATE TABLE IF NOT EXISTS juego_memorice_partidas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  evento VARCHAR NOT NULL DEFAULT 'feria-redmat-2026',
  dia VARCHAR(10) NOT NULL,
  nombre TEXT NOT NULL,
  ferreteria TEXT NOT NULL,
  ciudad TEXT,
  telefono VARCHAR NOT NULL,
  telefono_norm VARCHAR(9) NOT NULL,
  email VARCHAR NOT NULL,
  ms INTEGER NOT NULL,
  intentos INTEGER NOT NULL,
  crm_seguimiento_id VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_memorice_evento_dia" ON juego_memorice_partidas (evento, dia);
CREATE INDEX IF NOT EXISTS "IDX_memorice_tel" ON juego_memorice_partidas (telefono_norm);
