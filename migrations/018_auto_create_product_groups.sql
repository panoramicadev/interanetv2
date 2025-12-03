-- Migration 018: Auto-create product groups from productFamily and link variations
-- This migration creates parent product groups and links existing products as variations

-- Step 1: Create groups for each unique productFamily that doesn't already have a group
INSERT INTO ecommerce_product_groups (id, nombre, descripcion, imagen_principal, categoria, activo, orden, created_at, updated_at)
SELECT 
    gen_random_uuid()::varchar,
    ep.product_family,
    'Grupo creado automáticamente desde familia de producto',
    (SELECT ep2.imagen_url FROM ecommerce_products ep2 WHERE ep2.product_family = ep.product_family AND ep2.imagen_url IS NOT NULL LIMIT 1),
    (SELECT ep2.categoria FROM ecommerce_products ep2 WHERE ep2.product_family = ep.product_family AND ep2.categoria IS NOT NULL LIMIT 1),
    true,
    0,
    NOW(),
    NOW()
FROM ecommerce_products ep
WHERE ep.product_family IS NOT NULL 
  AND ep.product_family != ''
  AND ep.group_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM ecommerce_product_groups epg 
    WHERE epg.nombre = ep.product_family
  )
GROUP BY ep.product_family;

-- Step 2: Link products to their corresponding groups
UPDATE ecommerce_products ep
SET group_id = epg.id,
    updated_at = NOW()
FROM ecommerce_product_groups epg
WHERE ep.product_family = epg.nombre
  AND ep.group_id IS NULL;

-- Step 3: Set the first variation of each group as main variant (by lowest price or alphabetically)
WITH ranked_variants AS (
    SELECT 
        ep.id,
        ep.group_id,
        ROW_NUMBER() OVER (PARTITION BY ep.group_id ORDER BY ep.precio_ecommerce::numeric NULLS LAST, ep.color, ep.id) as rn
    FROM ecommerce_products ep
    WHERE ep.group_id IS NOT NULL
)
UPDATE ecommerce_products ep
SET is_main_variant = (rv.rn = 1),
    updated_at = NOW()
FROM ranked_variants rv
WHERE ep.id = rv.id;

-- Step 4: Update variant labels to show color if not already set
UPDATE ecommerce_products
SET variant_label = color,
    updated_at = NOW()
WHERE group_id IS NOT NULL 
  AND variant_label IS NULL 
  AND color IS NOT NULL;
