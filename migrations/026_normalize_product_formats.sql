-- Migration: Normalize product format/unit values in price_list table
-- Standardizes all variations of format names to canonical values:
--   '1/4 Galon', 'Galon', 'Balde 4 Galones', 'Balde 5 Galones', 'Unidad'

-- First, let's see what we're working with (preview)
-- SELECT DISTINCT unidad, COUNT(*) as cnt FROM price_list GROUP BY unidad ORDER BY unidad;

-- ══════════════════════════════════════════════
-- 1/4 Galón variations → '1/4 Galon'
-- ══════════════════════════════════════════════
UPDATE price_list SET unidad = '1/4 Galon'
WHERE unidad IS NOT NULL
  AND unidad != '1/4 Galon'
  AND (
    LOWER(TRIM(unidad)) IN ('1/4 galon', '1/4 galón', '1/4 de galon', '1/4 de galón', '1/4', 'cuarto', 'cuarto galon', 'cuarto galón', '14')
    OR LOWER(TRIM(unidad)) LIKE '%1/4%gal%'
    OR LOWER(TRIM(unidad)) LIKE '%cuarto%gal%'
  );

-- ══════════════════════════════════════════════
-- Galón variations → 'Galon'
-- ══════════════════════════════════════════════
UPDATE price_list SET unidad = 'Galon'
WHERE unidad IS NOT NULL
  AND unidad != 'Galon'
  AND (
    LOWER(TRIM(unidad)) IN ('gl', 'galon', 'galón', 'galones')
  )
  -- Exclude values that are actually 1/4 or Balde
  AND LOWER(TRIM(unidad)) NOT LIKE '%1/4%'
  AND LOWER(TRIM(unidad)) NOT LIKE '%cuarto%'
  AND LOWER(TRIM(unidad)) NOT LIKE '%balde%'
  AND LOWER(TRIM(unidad)) NOT LIKE '%bd%';

-- ══════════════════════════════════════════════
-- Balde 4 Galones variations → 'Balde 4 Galones'
-- ══════════════════════════════════════════════
UPDATE price_list SET unidad = 'Balde 4 Galones'
WHERE unidad IS NOT NULL
  AND unidad != 'Balde 4 Galones'
  AND (
    LOWER(TRIM(unidad)) IN ('bd4', 'bd 4', 'bd-4', 'bd4gl', 'bd 4 gl', 'bd 4gl', 'bd-4gl', 'balde4', 'balde 4', 'balde 4 gl', 'balde 4gl', 'balde4gl', 'balde 4 galones', 'balde4galones')
    OR (LOWER(TRIM(unidad)) LIKE '%bd%4%' AND LOWER(TRIM(unidad)) NOT LIKE '%5%')
    OR (LOWER(TRIM(unidad)) LIKE '%balde%4%' AND LOWER(TRIM(unidad)) NOT LIKE '%5%')
  );

-- ══════════════════════════════════════════════
-- Balde 5 Galones variations → 'Balde 5 Galones'
-- ══════════════════════════════════════════════
UPDATE price_list SET unidad = 'Balde 5 Galones'
WHERE unidad IS NOT NULL
  AND unidad != 'Balde 5 Galones'
  AND (
    LOWER(TRIM(unidad)) IN ('bd5', 'bd 5', 'bd-5', 'bd5gl', 'bd 5 gl', 'bd 5gl', 'bd-5gl', 'balde5', 'balde 5', 'balde 5 gl', 'balde 5gl', 'balde5gl', 'balde 5 galones', 'balde5galones')
    OR (LOWER(TRIM(unidad)) LIKE '%bd%5%')
    OR (LOWER(TRIM(unidad)) LIKE '%balde%5%')
  );

-- ══════════════════════════════════════════════
-- Unidad variations → 'Unidad'
-- ══════════════════════════════════════════════
UPDATE price_list SET unidad = 'Unidad'
WHERE unidad IS NOT NULL
  AND unidad != 'Unidad'
  AND LOWER(TRIM(unidad)) IN ('un', 'und', 'u', 'unidad');

-- Verify: show remaining distinct values
-- SELECT DISTINCT unidad, COUNT(*) as cnt FROM price_list GROUP BY unidad ORDER BY unidad;
