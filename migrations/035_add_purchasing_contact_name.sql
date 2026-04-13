-- Add purchasing contact name field to clients table
-- This field stores the name of the purchasing manager (encargado de compras) for each client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS purchasing_contact_name TEXT;
