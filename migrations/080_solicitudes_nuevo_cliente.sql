-- 080_solicitudes_nuevo_cliente.sql
--
-- Módulo Nuevo Cliente: el vendedor pide el alta y Administración crea el
-- cliente en el ERP. Acá NO se crea el cliente, se registra la solicitud con
-- todo lo que hace falta para crearlo bien a la primera.
--
-- Los datos del receptor del documento y los requisitos del XML (orden de
-- compra / guía de despacho) son obligatorios: todos los clientes son
-- facturadores electrónicos y hoy esos datos se piden por WhatsApp y se pierden.

CREATE TABLE IF NOT EXISTS solicitudes_nuevo_cliente (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  segmento VARCHAR(120) NOT NULL,
  rut VARCHAR(20) NOT NULL,
  razon_social TEXT NOT NULL,
  giro TEXT NOT NULL,
  telefonos VARCHAR(120) NOT NULL,
  correo_empresa VARCHAR(160) NOT NULL,
  ciudad VARCHAR(120) NOT NULL,
  comuna VARCHAR(120) NOT NULL,
  direccion TEXT NOT NULL,

  vendedor_id VARCHAR,
  vendedor_nombre TEXT NOT NULL,
  condicion_venta VARCHAR(80) NOT NULL,

  receptor_nombre TEXT NOT NULL,
  receptor_correo VARCHAR(160) NOT NULL,
  receptor_telefono VARCHAR(60) NOT NULL,

  requiere_orden_compra BOOLEAN NOT NULL DEFAULT TRUE,
  requiere_guia_despacho BOOLEAN NOT NULL DEFAULT TRUE,

  estado VARCHAR(20) NOT NULL DEFAULT 'enviada',
  observaciones TEXT,
  cliente_id VARCHAR,
  solicitante_id VARCHAR,
  solicitante_nombre TEXT,
  supervisor_id VARCHAR,
  resuelta_por_id VARCHAR,
  resuelta_por_nombre TEXT,
  resuelta_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_solicitudes_nuevo_cliente_solicitante" ON solicitudes_nuevo_cliente (solicitante_id);
CREATE INDEX IF NOT EXISTS "IDX_solicitudes_nuevo_cliente_estado" ON solicitudes_nuevo_cliente (estado);
CREATE INDEX IF NOT EXISTS "IDX_solicitudes_nuevo_cliente_created" ON solicitudes_nuevo_cliente (created_at);
