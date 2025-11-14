-- Migration 010: Add incremental tracking to NVV ETL
-- 
-- Purpose: Enable detailed tracking of document changes per ETL execution
-- Features:
-- 1. Add watermark range (start/end) to nvv_sync_log for precise incremental tracking
-- 2. Add execution linkage and status tracking to fact_nvv
-- 3. Create nvv_sync_changes table to log per-document changes

-- ===== 1. Extend nvv_sync_log with watermark range =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'nvv' 
      AND table_name = 'nvv_sync_log' 
      AND column_name = 'watermark_start'
  ) THEN
    ALTER TABLE nvv.nvv_sync_log 
      ADD COLUMN watermark_start TIMESTAMP,
      ADD COLUMN watermark_end TIMESTAMP;
    
    RAISE NOTICE 'Added watermark_start and watermark_end to nvv.nvv_sync_log';
  ELSE
    RAISE NOTICE 'Watermark columns already exist in nvv.nvv_sync_log, skipping';
  END IF;
END $$;

-- ===== 2. Add ETL execution tracking to fact_nvv =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'nvv' 
      AND table_name = 'fact_nvv' 
      AND column_name = 'last_etl_execution_id'
  ) THEN
    ALTER TABLE nvv.fact_nvv 
      ADD COLUMN last_etl_execution_id VARCHAR(50),
      ADD COLUMN last_status VARCHAR(20);
    
    RAISE NOTICE 'Added last_etl_execution_id and last_status to nvv.fact_nvv';
    
    -- Backfill last_status from current eslido value
    UPDATE nvv.fact_nvv 
    SET last_status = eslido 
    WHERE last_status IS NULL;
    
    RAISE NOTICE 'Backfilled last_status from eslido in nvv.fact_nvv';
  ELSE
    RAISE NOTICE 'Execution tracking columns already exist in nvv.fact_nvv, skipping';
  END IF;
END $$;

-- ===== 3. Create nvv_sync_changes table =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'nvv' 
      AND table_name = 'nvv_sync_changes'
  ) THEN
    CREATE TABLE nvv.nvv_sync_changes (
      id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id VARCHAR(50) NOT NULL,
      idmaeedo NUMERIC(20,0) NOT NULL,
      nudo TEXT,
      sudo TEXT,
      change_type VARCHAR(20) NOT NULL,
      previous_status VARCHAR(20),
      new_status VARCHAR(20),
      monto NUMERIC(15,2),
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Index for querying changes by execution and type
    CREATE INDEX idx_nvv_sync_changes_execution_type 
      ON nvv.nvv_sync_changes(execution_id, change_type);
    
    -- Unique constraint to prevent duplicate changes per execution+document
    CREATE UNIQUE INDEX unq_nvv_sync_changes_execution_doc_type 
      ON nvv.nvv_sync_changes(execution_id, idmaeedo, change_type);
    
    -- Foreign key to nvv_sync_log (ON DELETE CASCADE)
    ALTER TABLE nvv.nvv_sync_changes 
      ADD CONSTRAINT fk_nvv_sync_changes_execution 
      FOREIGN KEY (execution_id) 
      REFERENCES nvv.nvv_sync_log(id) 
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Created nvv.nvv_sync_changes table with indexes and constraints';
  ELSE
    RAISE NOTICE 'Table nvv.nvv_sync_changes already exists, skipping';
  END IF;
END $$;
