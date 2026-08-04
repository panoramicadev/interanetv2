-- 077_solicitudes_credito.sql
--
-- Solicitud de Crédito real. Hasta ahora era un formulario maqueta dentro de
-- /facturas: al enviarlo hacía console.log y limpiaba los campos, así que la
-- solicitud no llegaba a ninguna parte.
--
-- La carpeta tributaria se guarda como URL: los archivos suben por /api/upload
-- (Supabase / Object Storage / disco, según el deploy) y acá queda dónde quedó.

CREATE TABLE IF NOT EXISTS solicitudes_credito (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  cliente_id VARCHAR,
  razon_social TEXT NOT NULL,
  rut VARCHAR(20) NOT NULL,
  direccion TEXT NOT NULL,
  ciudad VARCHAR(120) NOT NULL,
  telefono VARCHAR(40) NOT NULL,
  giro TEXT,
  correo VARCHAR(160),

  socio1_nombre TEXT,
  socio1_direccion TEXT,
  socio2_nombre TEXT,
  socio2_direccion TEXT,
  representante_nombre TEXT,
  representante_cedula VARCHAR(20),

  banco1 VARCHAR(120),
  cuenta1 VARCHAR(60),
  sucursal1 VARCHAR(120),
  banco2 VARCHAR(120),
  cuenta2 VARCHAR(60),
  sucursal2 VARCHAR(120),

  credito_solicitado NUMERIC(15, 2) NOT NULL,
  credito_aprobado NUMERIC(15, 2),

  carpeta_tributaria_url TEXT,
  carpeta_tributaria_nombre TEXT,

  estado VARCHAR(20) NOT NULL DEFAULT 'enviada',
  observaciones TEXT,
  solicitante_id VARCHAR,
  solicitante_nombre TEXT,
  supervisor_id VARCHAR,
  resuelta_por_id VARCHAR,
  resuelta_por_nombre TEXT,
  resuelta_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_solicitudes_credito_solicitante" ON solicitudes_credito (solicitante_id);
CREATE INDEX IF NOT EXISTS "IDX_solicitudes_credito_estado" ON solicitudes_credito (estado);
CREATE INDEX IF NOT EXISTS "IDX_solicitudes_credito_created" ON solicitudes_credito (created_at);

-- Destinatarios del aviso, editables desde Configuración → Correos. Se siembra
-- vacío a propósito: mientras no se definan, el correo sale igual con copia al
-- supervisor y al vendedor, que son los destinatarios que sí están definidos.
INSERT INTO email_notification_settings (notification_type, enabled, recipients, cc_recipients, display_name, description)
VALUES (
  'solicitud_credito',
  true,
  '',
  '',
  'Solicitud de Crédito',
  'A quién le llega una solicitud de crédito nueva. El supervisor del vendedor y el propio vendedor van siempre en copia.'
)
ON CONFLICT (notification_type) DO NOTHING;
