-- Migration: Add branch hierarchy fields to clients table
-- Allows grouping sucursales under a parent company (empresa matriz)

-- Add parent_client_id for self-referencing hierarchy
ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_client_id VARCHAR;

-- Add branch_label for sucursal identification
ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_label VARCHAR;

-- Index for efficient parent lookups
CREATE INDEX IF NOT EXISTS "IDX_clients_parent" ON clients(parent_client_id);
