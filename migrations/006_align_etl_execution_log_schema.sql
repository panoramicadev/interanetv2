-- Migration 006: Align etl_execution_log schema with nvv_sync_log
-- Changes execution_date to start_time/end_time pattern for consistency

-- Step 1: Add new columns
ALTER TABLE ventas.etl_execution_log 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Step 2: Backfill start_time from execution_date
UPDATE ventas.etl_execution_log 
SET start_time = execution_date 
WHERE start_time IS NULL;

-- Step 3: For completed executions, set end_time = start_time (approximation)
-- For running executions, end_time stays NULL
UPDATE ventas.etl_execution_log 
SET end_time = execution_date 
WHERE status IN ('success', 'failed') AND end_time IS NULL;

-- Step 4: Make start_time NOT NULL after backfill
ALTER TABLE ventas.etl_execution_log 
ALTER COLUMN start_time SET NOT NULL;

-- Step 5: Drop old execution_date column
ALTER TABLE ventas.etl_execution_log 
DROP COLUMN IF EXISTS execution_date;

-- Step 6: Create index on start_time for performance
CREATE INDEX IF NOT EXISTS idx_etl_execution_log_start_time 
ON ventas.etl_execution_log(start_time DESC);

-- Note: This migration aligns ventas.etl_execution_log with nvv.nvv_sync_log schema
-- Both now use start_time/end_time for execution tracking
