-- Migration 050: Add free_shipping flag to clients
-- When true, the client gets free shipping in /tienda regardless of cart total.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clients_free_shipping ON clients(free_shipping) WHERE free_shipping = true;
