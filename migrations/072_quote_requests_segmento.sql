-- Cotizador web público: segmento del visitante + lead creado en el CRM.
--
-- El modal "Solicitar Cotización" ahora pide el SEGMENTO (Construcción /
-- Ferretería / Industrial). Con ese dato la solicitud cae automáticamente al
-- CRM del área (crm_seguimiento_clientes) con la etiqueta "COTIZACIÓN WEB", y
-- guardamos el id del lead creado para no duplicarlo y poder navegar de la
-- cotización al seguimiento.
--
-- `segmento` guarda el código ASCII ('construccion' | 'ferreteria' |
-- 'industrial'); la etiqueta con tildes vive en shared/segmentos-cotizacion-web.ts.
--
-- IF EXISTS: la tabla quote_requests se crea de forma auto-sanadora en
-- server/services/quote-request.service.ts, no en el bootstrap.

ALTER TABLE IF EXISTS quote_requests ADD COLUMN IF NOT EXISTS segmento VARCHAR;
ALTER TABLE IF EXISTS quote_requests ADD COLUMN IF NOT EXISTS crm_seguimiento_id VARCHAR;

CREATE INDEX IF NOT EXISTS "IDX_quote_requests_segmento" ON quote_requests (segmento);
