-- Migration 015: Actualizar estructura de nvv.stg_tabbo_nvv (VERSIÓN SEGURA)
-- Problema: La tabla stg_tabbo_nvv fue creada con columnas kobo/nokobo en Migration 002
--           pero el ETL de NVV espera columnas suli/bosuli/nobosuli
-- Causa: Desincronización entre schema de Drizzle y migraciones SQL
-- Impacto: ETL de NVV falla en producción con error "column bo.suli does not exist"

-- Estrategia segura: Usar ALTER TABLE en lugar de DROP/CREATE para evitar race conditions con ETL scheduler

DO $$
BEGIN
  -- 1. Verificar si la tabla ya tiene la estructura correcta (suli/bosuli)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'nvv' 
      AND table_name = 'stg_tabbo_nvv' 
      AND column_name = 'suli'
  ) THEN
    RAISE NOTICE 'Tabla nvv.stg_tabbo_nvv ya tiene la estructura correcta (suli/bosuli)';
  ELSE
    -- 2. La tabla tiene estructura antigua (kobo/nokobo) - necesita actualización
    
    -- 2a. Agregar nuevas columnas si no existen
    ALTER TABLE nvv.stg_tabbo_nvv ADD COLUMN IF NOT EXISTS suli TEXT;
    ALTER TABLE nvv.stg_tabbo_nvv ADD COLUMN IF NOT EXISTS bosuli TEXT;
    ALTER TABLE nvv.stg_tabbo_nvv ADD COLUMN IF NOT EXISTS nobosuli TEXT;
    
    -- 2b. Copiar datos de columnas antiguas a nuevas (si hay datos)
    UPDATE nvv.stg_tabbo_nvv 
    SET suli = COALESCE(suli, '001'),  -- Default empresa
        bosuli = COALESCE(bosuli, kobo),
        nobosuli = COALESCE(nobosuli, nokobo)
    WHERE suli IS NULL OR bosuli IS NULL;
    
    -- 2c. Hacer columnas NOT NULL
    ALTER TABLE nvv.stg_tabbo_nvv ALTER COLUMN suli SET NOT NULL;
    ALTER TABLE nvv.stg_tabbo_nvv ALTER COLUMN bosuli SET NOT NULL;
    
    -- 2d. Eliminar constraint PK antiguo
    ALTER TABLE nvv.stg_tabbo_nvv DROP CONSTRAINT IF EXISTS stg_tabbo_nvv_pkey;
    
    -- 2e. Crear nuevo constraint PK compuesto
    ALTER TABLE nvv.stg_tabbo_nvv ADD PRIMARY KEY (suli, bosuli);
    
    -- 2f. Eliminar columnas antiguas (opcional - comentado por seguridad)
    -- ALTER TABLE nvv.stg_tabbo_nvv DROP COLUMN IF EXISTS kobo;
    -- ALTER TABLE nvv.stg_tabbo_nvv DROP COLUMN IF EXISTS nokobo;
    
    RAISE NOTICE 'Tabla nvv.stg_tabbo_nvv actualizada exitosamente';
  END IF;
END $$;

-- 3. Crear índices para performance (idempotentes)
CREATE INDEX IF NOT EXISTS idx_nvv_stg_tabbo_suli ON nvv.stg_tabbo_nvv(suli);
CREATE INDEX IF NOT EXISTS idx_nvv_stg_tabbo_bosuli ON nvv.stg_tabbo_nvv(bosuli);

-- 3. Actualizar también stg_maeen_nvv para incluir columnas faltantes
ALTER TABLE nvv.stg_maeen_nvv ADD COLUMN IF NOT EXISTS ruen VARCHAR(50);
ALTER TABLE nvv.stg_maeen_nvv ADD COLUMN IF NOT EXISTS kofuen VARCHAR(50);

-- 4. Actualizar stg_maepr_nvv para asegurar que tiene todas las columnas necesarias
-- (Algunas pueden faltar si se creó con schema antiguo)
ALTER TABLE nvv.stg_maepr_nvv ADD COLUMN IF NOT EXISTS pfpr VARCHAR(50);
ALTER TABLE nvv.stg_maepr_nvv ADD COLUMN IF NOT EXISTS fmpr VARCHAR(50);
ALTER TABLE nvv.stg_maepr_nvv ADD COLUMN IF NOT EXISTS rupr VARCHAR(50);
ALTER TABLE nvv.stg_maepr_nvv ADD COLUMN IF NOT EXISTS mrpr VARCHAR(50);

-- 5. Comentarios de documentación
COMMENT ON TABLE nvv.stg_tabbo_nvv IS 'Staging: Bodegas NVV (TABBO) - Estructura alineada con ETL';
COMMENT ON COLUMN nvv.stg_tabbo_nvv.suli IS 'Código de empresa/sucursal';
COMMENT ON COLUMN nvv.stg_tabbo_nvv.bosuli IS 'Código de bodega';
COMMENT ON COLUMN nvv.stg_tabbo_nvv.nobosuli IS 'Nombre de la bodega';
