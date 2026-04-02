-- Add offer_price column to price_list table
-- This allows setting promotional/offer prices for products
-- NULL means no offer active for that product
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS offer_price NUMERIC(15, 2);
