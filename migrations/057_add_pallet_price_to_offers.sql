-- 057_add_pallet_price_to_offers.sql
--
-- Permitir que las ofertas de pallet se carguen por precio TOTAL fijo del pallet
-- (no sólo por % de descuento sobre el precio de lista).
--
-- Política comercial:
--   - offer_type='pallet' requiere units_per_pallet + (discount_pct XOR pallet_price)
--   - pallet_price = precio total del pallet completo en $ (NULL = usar discount_pct)
--   - El precio unitario en modo precio fijo = pallet_price / units_per_pallet
--
-- ⚠️ Deploy manual: el runner de migraciones SQL del proyecto está roto
-- (poison pills CONCURRENTLY 022 / add_performance_indexes). Aplicar este
-- ALTER TABLE a mano en producción.

ALTER TABLE price_list_offers
  ADD COLUMN IF NOT EXISTS pallet_price numeric(15,2);

-- Sanity constraint: > 0 (NULL permitido = usar discount_pct)
ALTER TABLE price_list_offers
  DROP CONSTRAINT IF EXISTS price_list_offers_pallet_price_positive;

ALTER TABLE price_list_offers
  ADD CONSTRAINT price_list_offers_pallet_price_positive
  CHECK (pallet_price IS NULL OR pallet_price > 0);

COMMENT ON COLUMN price_list_offers.pallet_price IS
  'Precio total fijo del pallet completo (en $). NULL = usar discount_pct sobre precio de lista. Mutuamente excluyente con discount_pct.';
