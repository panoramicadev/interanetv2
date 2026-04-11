-- Migration 033: Add client_id FK to salespeople_users for reliable eCommerce↔SAP client linking
-- This replaces the fragile name-based matching with a direct foreign key

-- Step 1: Add client_id column
ALTER TABLE salespeople_users 
  ADD COLUMN IF NOT EXISTS client_id VARCHAR;

-- Step 2: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_salespeople_client_id ON salespeople_users(client_id);

-- Step 3: Auto-reconcile existing users by matching RUT
-- This links existing eCommerce users with their SAP client record
UPDATE salespeople_users sp
SET client_id = c.id
FROM clients c
WHERE sp.role = 'client'
  AND sp.client_id IS NULL
  AND sp.client_rut IS NOT NULL
  AND sp.client_rut != ''
  AND UPPER(REPLACE(REPLACE(REPLACE(c.rten, '.', ''), '-', ''), ' ', '')) = 
      UPPER(REPLACE(REPLACE(REPLACE(sp.client_rut, '.', ''), '-', ''), ' ', ''));

-- Step 4: Fallback – link by exact name match for users without RUT
UPDATE salespeople_users sp
SET client_id = c.id
FROM clients c
WHERE sp.role = 'client'
  AND sp.client_id IS NULL
  AND sp.salesperson_name IS NOT NULL
  AND UPPER(sp.salesperson_name) = UPPER(c.nokoen);

-- Step 5: Also backfill clients.user_id for bidirectional lookup
UPDATE clients c
SET user_id = sp.id
FROM salespeople_users sp
WHERE sp.role = 'client'
  AND sp.client_id = c.id
  AND (c.user_id IS NULL OR c.user_id = '');
