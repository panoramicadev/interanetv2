-- Add fecha column to gastos_marketing table
ALTER TABLE gastos_marketing ADD COLUMN IF NOT EXISTS fecha DATE;
