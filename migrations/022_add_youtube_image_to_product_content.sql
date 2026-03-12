-- Add YouTube video URL and featured image URL to product_content table
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS youtube_url VARCHAR;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS imagen_destacada VARCHAR;
