-- Add client_rut column to salespeople_users table
ALTER TABLE salespeople_users ADD COLUMN IF NOT EXISTS client_rut VARCHAR;
