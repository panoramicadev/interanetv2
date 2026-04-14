-- Ayuda Memoria CRM - Fichas de cliente para vendedores
CREATE TABLE IF NOT EXISTS crm_ayuda_memoria (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vinculación con cliente CRM (opcional)
  cliente_seguimiento_id VARCHAR,  -- FK a crm_seguimiento_clientes.id
  cliente_nombre TEXT NOT NULL,
  rut VARCHAR,
  
  -- Info del negocio
  giro TEXT,
  direccion TEXT,
  ciudad VARCHAR,
  tipo_cliente VARCHAR,  -- ferreteria, construccion, industrial, etc.
  
  -- Contactos
  contacto_principal TEXT,
  telefono_contacto VARCHAR,
  email_contacto VARCHAR,
  
  -- Comercial
  productos_interes TEXT,
  frecuencia_compra VARCHAR,
  condiciones_pago TEXT,
  competencia TEXT,
  
  -- Análisis FODA
  fortalezas TEXT,
  debilidades TEXT,
  oportunidades TEXT,
  
  -- Notas
  observaciones TEXT,
  
  -- Metadata
  creado_por VARCHAR NOT NULL,
  creado_por_nombre TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_ayuda_mem_cliente" ON crm_ayuda_memoria (cliente_seguimiento_id);
CREATE INDEX IF NOT EXISTS "IDX_ayuda_mem_creado_por" ON crm_ayuda_memoria (creado_por);
CREATE INDEX IF NOT EXISTS "IDX_ayuda_mem_created" ON crm_ayuda_memoria (created_at);
CREATE INDEX IF NOT EXISTS "IDX_ayuda_mem_nombre" ON crm_ayuda_memoria (cliente_nombre);
