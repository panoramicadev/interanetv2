-- Migration 006: Align ALL ETL execution log tables to use start_time/end_time (IDEMPOTENT)
-- Applies to: ventas.etl_execution_log, nvv.nvv_sync_log, gdv.gdv_sync_log
-- Changes execution_date to start_time/end_time pattern for consistency
-- IDEMPOTENT: Safe to run multiple times, handles tables with or without execution_date

-- ============================================================================
-- TABLE 1: ventas.etl_execution_log
-- ============================================================================

-- Step 1a: Add new columns if they don't exist
ALTER TABLE ventas.etl_execution_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2a: Backfill start_time from execution_date (only if execution_date exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'ventas' 
        AND table_name = 'etl_execution_log' 
        AND column_name = 'execution_date'
    ) THEN
        UPDATE ventas.etl_execution_log 
        SET start_time = COALESCE(execution_date, NOW())
        WHERE start_time IS NULL;
        
        RAISE NOTICE '[ventas.etl_execution_log] Backfilled start_time from execution_date';
    ELSE
        -- No execution_date, set start_time to NOW for any NULL values
        UPDATE ventas.etl_execution_log 
        SET start_time = NOW()
        WHERE start_time IS NULL;
        
        RAISE NOTICE '[ventas.etl_execution_log] No execution_date found, defaulted start_time to NOW';
    END IF;
END $$;

-- Step 3a: For completed executions, set end_time = start_time (approximation)
DO $$
BEGIN
    UPDATE ventas.etl_execution_log 
    SET end_time = COALESCE(end_time, start_time)
    WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;
    
    RAISE NOTICE '[ventas.etl_execution_log] Set end_time for completed executions';
END $$;

-- Step 4a: Make start_time NOT NULL after backfill
ALTER TABLE ventas.etl_execution_log 
ALTER COLUMN start_time SET NOT NULL;

-- Step 5a: Drop old execution_date column if it exists
ALTER TABLE ventas.etl_execution_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6a: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_etl_execution_log_start_time 
ON ventas.etl_execution_log(start_time DESC);

-- ============================================================================
-- TABLE 2: nvv.nvv_sync_log
-- ============================================================================

-- Step 1b: Add new columns if they don't exist
ALTER TABLE nvv.nvv_sync_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2b: Backfill start_time from execution_date (only if execution_date exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'nvv' 
        AND table_name = 'nvv_sync_log' 
        AND column_name = 'execution_date'
    ) THEN
        UPDATE nvv.nvv_sync_log 
        SET start_time = COALESCE(execution_date, NOW())
        WHERE start_time IS NULL;
        
        RAISE NOTICE '[nvv.nvv_sync_log] Backfilled start_time from execution_date';
    ELSE
        -- No execution_date, set start_time to NOW for any NULL values
        UPDATE nvv.nvv_sync_log 
        SET start_time = NOW()
        WHERE start_time IS NULL;
        
        RAISE NOTICE '[nvv.nvv_sync_log] No execution_date found, defaulted start_time to NOW';
    END IF;
END $$;

-- Step 3b: For completed executions, set end_time = start_time (approximation)
DO $$
BEGIN
    UPDATE nvv.nvv_sync_log 
    SET end_time = COALESCE(end_time, start_time)
    WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;
    
    RAISE NOTICE '[nvv.nvv_sync_log] Set end_time for completed executions';
END $$;

-- Step 4b: Make start_time NOT NULL after backfill
DO $$
BEGIN
    -- Only set NOT NULL if start_time column exists and has no NULL values
    IF NOT EXISTS (
        SELECT 1 FROM nvv.nvv_sync_log WHERE start_time IS NULL LIMIT 1
    ) THEN
        ALTER TABLE nvv.nvv_sync_log 
        ALTER COLUMN start_time SET NOT NULL;
        
        RAISE NOTICE '[nvv.nvv_sync_log] Set start_time to NOT NULL';
    END IF;
END $$;

-- Step 5b: Drop old execution_date column if it exists
ALTER TABLE nvv.nvv_sync_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6b: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_nvv_sync_log_start_time 
ON nvv.nvv_sync_log(start_time DESC);

-- ============================================================================
-- TABLE 3: gdv.gdv_sync_log
-- ============================================================================

-- Step 1c: Add new columns if they don't exist
ALTER TABLE gdv.gdv_sync_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2c: Backfill start_time from execution_date (only if execution_date exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'gdv' 
        AND table_name = 'gdv_sync_log' 
        AND column_name = 'execution_date'
    ) THEN
        UPDATE gdv.gdv_sync_log 
        SET start_time = COALESCE(execution_date, NOW())
        WHERE start_time IS NULL;
        
        RAISE NOTICE '[gdv.gdv_sync_log] Backfilled start_time from execution_date';
    ELSE
        -- No execution_date, set start_time to NOW for any NULL values
        UPDATE gdv.gdv_sync_log 
        SET start_time = NOW()
        WHERE start_time IS NULL;
        
        RAISE NOTICE '[gdv.gdv_sync_log] No execution_date found, defaulted start_time to NOW';
    END IF;
END $$;

-- Step 3c: For completed executions, set end_time = start_time (approximation)
DO $$
BEGIN
    UPDATE gdv.gdv_sync_log 
    SET end_time = COALESCE(end_time, start_time)
    WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;
    
    RAISE NOTICE '[gdv.gdv_sync_log] Set end_time for completed executions';
END $$;

-- Step 4c: Make start_time NOT NULL after backfill
DO $$
BEGIN
    -- Only set NOT NULL if start_time column exists and has no NULL values
    IF NOT EXISTS (
        SELECT 1 FROM gdv.gdv_sync_log WHERE start_time IS NULL LIMIT 1
    ) THEN
        ALTER TABLE gdv.gdv_sync_log 
        ALTER COLUMN start_time SET NOT NULL;
        
        RAISE NOTICE '[gdv.gdv_sync_log] Set start_time to NOT NULL';
    END IF;
END $$;

-- Step 5c: Drop old execution_date column if it exists
ALTER TABLE gdv.gdv_sync_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6c: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_gdv_sync_log_start_time 
ON gdv.gdv_sync_log(start_time DESC);

-- ============================================================================
-- MIGRATION COMPLETE
-- All three ETL log tables now use start_time/end_time for execution tracking
-- This migration is IDEMPOTENT and safe to run on:
-- - Fresh installations (tables already have start_time/end_time)
-- - Legacy installations (tables have execution_date that needs migration)
-- ============================================================================
