-- Migration 006: Align ALL ETL execution log tables to use start_time/end_time
-- Applies to: ventas.etl_execution_log, nvv.nvv_sync_log, gdv.gdv_sync_log
-- Changes execution_date to start_time/end_time pattern for consistency

-- ============================================================================
-- TABLE 1: ventas.etl_execution_log
-- ============================================================================

-- Step 1a: Add new columns
ALTER TABLE ventas.etl_execution_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2a: Backfill start_time from execution_date
UPDATE ventas.etl_execution_log 
SET start_time = execution_date 
WHERE start_time IS NULL;

-- Step 3a: For completed executions, set end_time = start_time (approximation)
UPDATE ventas.etl_execution_log 
SET end_time = execution_date 
WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;

-- Step 4a: Make start_time NOT NULL after backfill
ALTER TABLE ventas.etl_execution_log 
ALTER COLUMN start_time SET NOT NULL;

-- Step 5a: Drop old execution_date column
ALTER TABLE ventas.etl_execution_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6a: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_etl_execution_log_start_time 
ON ventas.etl_execution_log(start_time DESC);

-- ============================================================================
-- TABLE 2: nvv.nvv_sync_log
-- ============================================================================

-- Step 1b: Add new columns
ALTER TABLE nvv.nvv_sync_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2b: Backfill start_time from execution_date
UPDATE nvv.nvv_sync_log 
SET start_time = execution_date 
WHERE start_time IS NULL;

-- Step 3b: For completed executions, set end_time = start_time (approximation)
UPDATE nvv.nvv_sync_log 
SET end_time = execution_date 
WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;

-- Step 4b: Make start_time NOT NULL after backfill
ALTER TABLE nvv.nvv_sync_log 
ALTER COLUMN start_time SET NOT NULL;

-- Step 5b: Drop old execution_date column
ALTER TABLE nvv.nvv_sync_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6b: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_nvv_sync_log_start_time 
ON nvv.nvv_sync_log(start_time DESC);

-- ============================================================================
-- TABLE 3: gdv.gdv_sync_log
-- ============================================================================

-- Step 1c: Add new columns
ALTER TABLE gdv.gdv_sync_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2c: Backfill start_time from execution_date
UPDATE gdv.gdv_sync_log 
SET start_time = execution_date 
WHERE start_time IS NULL;

-- Step 3c: For completed executions, set end_time = start_time (approximation)
UPDATE gdv.gdv_sync_log 
SET end_time = execution_date 
WHERE status IN ('success', 'failed', 'error') AND end_time IS NULL;

-- Step 4c: Make start_time NOT NULL after backfill
ALTER TABLE gdv.gdv_sync_log 
ALTER COLUMN start_time SET NOT NULL;

-- Step 5c: Drop old execution_date column
ALTER TABLE gdv.gdv_sync_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6c: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_gdv_sync_log_start_time 
ON gdv.gdv_sync_log(start_time DESC);

-- ============================================================================
-- MIGRATION COMPLETE
-- All three ETL log tables now use start_time/end_time for execution tracking
-- ============================================================================
