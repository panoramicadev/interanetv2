-- Migration 041: Add branch discount percent to clients
-- Allows a global % discount per branch, applied exclusively in /tienda
ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_discount_percent numeric(5,2) NOT NULL DEFAULT 0;

-- Index for quick lookup when resolving branch discount
CREATE INDEX IF NOT EXISTS idx_clients_branch_discount ON clients(branch_discount_percent) WHERE branch_discount_percent > 0;
