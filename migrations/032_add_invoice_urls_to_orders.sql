-- Add invoice_urls column to ecommerce_orders for storing uploaded invoice PDFs
ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS invoice_urls JSONB DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN ecommerce_orders.invoice_urls IS 'Array of {url, name, uploadedAt} for invoice PDF files attached by admin';
