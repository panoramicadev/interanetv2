-- Add invoice_url column to ecommerce_orders table
-- Allows admins to attach invoice PDFs to orders for client download
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS invoice_url TEXT;
