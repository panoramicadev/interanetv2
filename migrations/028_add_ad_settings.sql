ALTER TABLE store_config ADD COLUMN IF NOT EXISTS ad_settings JSONB DEFAULT '{"desktopFrequency": 6, "mobileFrequency": 4}'::jsonb;
