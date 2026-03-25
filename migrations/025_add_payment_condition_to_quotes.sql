-- Add payment_condition column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_condition VARCHAR;
