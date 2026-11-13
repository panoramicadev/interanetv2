-- 101: Solicitud de Muestra — lista para retiro (nov-2026).
--
-- Laboratorio deja la muestra lista y anota dónde está, para que el vendedor la
-- retire, y el día en que quedó lista. Solo agrega columnas: no toca lo guardado.
--
-- Lo mismo lo hace ensureSolicitudesMuestraTablas (server/migrations.ts) al
-- arrancar, porque el bucle de migraciones se corta en la 022.

ALTER TABLE solicitudes_muestra
  ADD COLUMN IF NOT EXISTS lista_ubicacion TEXT,
  ADD COLUMN IF NOT EXISTS lista_fecha DATE,
  ADD COLUMN IF NOT EXISTS lista_por_id VARCHAR,
  ADD COLUMN IF NOT EXISTS lista_por_nombre TEXT,
  ADD COLUMN IF NOT EXISTS lista_registrada_at TIMESTAMPTZ;
