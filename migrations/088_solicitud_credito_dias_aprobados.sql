-- 088_solicitud_credito_dias_aprobados.sql
--
-- Plazo de pago que Finanzas aprueba en la Solicitud de Crédito. Puede ser
-- distinto del pedido por el vendedor (dias_solicitados), así que va aparte.
--
-- Nullable: solo se llena al aprobar, y las solicitudes ya resueltas no lo tienen.

ALTER TABLE solicitudes_credito
  ADD COLUMN IF NOT EXISTS dias_aprobados INTEGER;
