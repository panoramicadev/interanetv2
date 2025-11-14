-- Migration 009: Fix NVV watermark to use timestamp instead of date
-- 
-- Issue: nvv.nvv_sync_log.watermark_date was defined as DATE, truncating timestamps
-- to YYYY-MM-DD and breaking incremental ETL logic
-- 
-- Solution: Convert column to TIMESTAMP to preserve full ISO timestamp precision

-- Idempotent migration: Only alter if column is currently DATE type
DO $$
BEGIN
  -- Check if watermark_date exists and is of type DATE
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'nvv' 
      AND table_name = 'nvv_sync_log' 
      AND column_name = 'watermark_date'
      AND data_type = 'date'
  ) THEN
    -- Alter column type from DATE to TIMESTAMP
    ALTER TABLE nvv.nvv_sync_log 
      ALTER COLUMN watermark_date TYPE TIMESTAMP USING watermark_date::timestamp;
    
    RAISE NOTICE 'Migration 009: Converted nvv.nvv_sync_log.watermark_date from DATE to TIMESTAMP';
  ELSE
    RAISE NOTICE 'Migration 009: Column watermark_date is already TIMESTAMP or does not exist, skipping';
  END IF;
END $$;
