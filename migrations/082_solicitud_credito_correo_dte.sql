-- 082_solicitud_credito_correo_dte.sql
--
-- El correo de la solicitud de crédito era uno solo y hacía las dos cosas: por
-- ahí se cobraba y por ahí se mandaban las facturas electrónicas. Son casillas
-- distintas en casi todos los clientes, así que la factura terminaba llegándole
-- a quien no correspondía.
--
-- `correo` queda como el de cobranza y se suma `correo_dte`, el receptor de DTE
-- que el cliente tiene registrado en el SII. Va nullable a propósito: las
-- solicitudes anteriores no lo tienen y no hay de dónde deducirlo. El formulario
-- sí lo exige de acá en adelante.

ALTER TABLE solicitudes_credito
  ADD COLUMN IF NOT EXISTS correo_dte VARCHAR(160);
