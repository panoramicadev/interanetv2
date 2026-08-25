-- 081_solicitud_credito_dias.sql
--
-- Plazo de pago pedido en la Solicitud de Crédito. Antes solo se pedía el monto
-- y el plazo (30 / 45 / 60 / 90 días) se acordaba por fuera, así que Finanzas
-- evaluaba sin saber a cuántos días le estaban pidiendo el crédito.
--
-- Va nullable a propósito: las solicitudes anteriores a este campo no tienen
-- plazo y no hay forma de deducírselo. Se muestran sin plazo, no con uno
-- inventado. El formulario sí lo exige de acá en adelante.

ALTER TABLE solicitudes_credito
  ADD COLUMN IF NOT EXISTS dias_solicitados INTEGER;
