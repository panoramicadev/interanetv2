-- Add purchase_order_pdf_url column to ecommerce_orders
-- Stores the optional client-uploaded purchase order (OC) PDF URL
ALTER TABLE ecommerce_orders
ADD COLUMN IF NOT EXISTS purchase_order_pdf_url TEXT;
