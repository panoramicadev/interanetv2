-- Bitácora de Seguimiento de Pedidos
-- Allows salespeople to add log entries / notes to orders

CREATE TABLE IF NOT EXISTS pedido_bitacora (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Reference to the document (cotización, NVV, GDV, factura)
  documento_tipo VARCHAR(20) NOT NULL, -- 'cotizacion', 'nvv', 'gdv', 'factura'
  documento_id VARCHAR(100) NOT NULL, -- Quote ID, doc number, etc.
  documento_numero VARCHAR(100), -- Human-readable document number
  -- Client info
  cliente_nombre VARCHAR(500),
  cliente_rut VARCHAR(50),
  -- Note/entry
  nota TEXT NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'nota', -- 'nota', 'llamada', 'visita', 'seguimiento', 'problema'
  -- Author
  autor_id VARCHAR NOT NULL,
  autor_nombre VARCHAR(255) NOT NULL,
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bitacora_documento ON pedido_bitacora(documento_tipo, documento_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_autor ON pedido_bitacora(autor_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_cliente ON pedido_bitacora(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_bitacora_created ON pedido_bitacora(created_at DESC);
