ALTER TABLE store_config 
ADD COLUMN IF NOT EXISTS checkout_settings JSONB DEFAULT '{}'::jsonb;
