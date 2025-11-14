-- Migration 007: Complete ETL schema unification for NVV and GDV sync logs
-- This migration completes the work started in 006 by aligning nvv.nvv_sync_log 
-- and gdv.gdv_sync_log to use start_time/end_time instead of execution_date
-- Note: Migration 006 only updated ventas.etl_execution_log

-- ============================================================================
-- TABLE 1: nvv.nvv_sync_log
-- ============================================================================

-- Step 1: Add new columns
ALTER TABLE nvv.nvv_sync_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2: Backfill start_time from execution_date (handle NULL values)
UPDATE nvv.nvv_sync_log 
SET start_time = COALESCE(execution_date, NOW())
WHERE start_time IS NULL;

-- Step 3: For completed executions, set end_time = start_time (approximation)
-- For running executions, end_time stays NULL
UPDATE nvv.nvv_sync_log 
SET end_time = start_time
WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;

-- Step 4: Make start_time NOT NULL after backfill
ALTER TABLE nvv.nvv_sync_log 
ALTER COLUMN start_time SET NOT NULL;

-- Step 5: Drop old execution_date column
ALTER TABLE nvv.nvv_sync_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_nvv_sync_log_start_time 
ON nvv.nvv_sync_log(start_time DESC);

-- ============================================================================
-- TABLE 2: gdv.gdv_sync_log
-- ============================================================================

-- Step 1: Add new columns
ALTER TABLE gdv.gdv_sync_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2: Backfill start_time from execution_date (handle NULL values)
UPDATE gdv.gdv_sync_log 
SET start_time = COALESCE(execution_date, NOW())
WHERE start_time IS NULL;

-- Step 3: For completed executions, set end_time = start_time (approximation)
-- For running executions, end_time stays NULL
UPDATE gdv.gdv_sync_log 
SET end_time = start_time
WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;

-- Step 4: Make start_time NOT NULL after backfill
ALTER TABLE gdv.gdv_sync_log 
ALTER COLUMN start_time SET NOT NULL;

-- Step 5: Drop old execution_date column
ALTER TABLE gdv.gdv_sync_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_gdv_sync_log_start_time 
ON gdv.gdv_sync_log(start_time DESC);

-- ============================================================================
-- MIGRATION COMPLETE
-- All ETL sync log tables now use start_time/end_time for execution tracking
-- Schema consistency achieved across ventas.etl_execution_log (via 006),
-- nvv.nvv_sync_log, and gdv.gdv_sync_log (via 007)
-- ============================================================================
