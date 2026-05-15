-- Drop de la tabla suggested_orders que entró por PR #23 y reemplazamos en PR #25
-- por columnas is_suggested + suggested_* sobre ecommerce_orders.
--
-- Seguridad: si por alguna razón la tabla tiene filas (alguien usó el flujo
-- viejo entre el merge de PR #23 y el de PR #25), NO la dropeamos. Sólo dejamos
-- un warning en los logs. La tabla queda orphan (ningún código la referencia ya)
-- y el equipo puede migrar los registros + dropearla manualmente.
--
-- Usamos RAISE WARNING en vez de RAISE EXCEPTION para no romper el deploy:
-- si abortáramos, el migration runner haría throw, la migración no quedaría
-- marcada como aplicada, y cada redeploy reintentaría e inundaría logs con
-- errores fatales.
--
-- Si la tabla nunca existió (instalación nueva o ya dropeada) tampoco rompe.
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suggested_orders') THEN
    EXECUTE 'SELECT COUNT(*) FROM suggested_orders' INTO v_count;
    IF v_count = 0 THEN
      DROP TABLE suggested_orders CASCADE;
      RAISE NOTICE 'suggested_orders dropeada (estaba vacía).';
    ELSE
      RAISE WARNING
        'La tabla suggested_orders tiene % filas. NO se dropea automáticamente para no perder data. Migrá esos registros a ecommerce_orders (is_suggested=true, status=suggested_pending) y dropeá la tabla manualmente cuando estén migrados.',
        v_count;
    END IF;
  ELSE
    RAISE NOTICE 'suggested_orders no existe — nada que dropear.';
  END IF;
END $$;
