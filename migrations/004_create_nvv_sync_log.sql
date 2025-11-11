-- Migración 004: Crear tabla nvv_sync_log para registro de ejecuciones del ETL NVV
-- Fecha: 2025-11-11
-- Propósito: Habilitar tracking de ejecuciones del ETL de NVV (Notas de Venta)

-- Crear tabla nvv_sync_log
CREATE TABLE IF NOT EXISTS nvv.nvv_sync_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_date TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL, -- success, failed, running
  period VARCHAR(100) NOT NULL, -- Descripción del período
  branches TEXT NOT NULL DEFAULT 'Todas', -- Sucursales NVV (todas por defecto)
  records_processed INTEGER,
  records_inserted INTEGER, -- Nuevos documentos
  records_updated INTEGER, -- Documentos actualizados
  status_changes INTEGER, -- Cuántos documentos cambiaron de estado
  execution_time_ms INTEGER,
  error_message TEXT,
  watermark_date TIMESTAMP -- Última fecha procesada
);

-- Index para búsquedas por fecha de ejecución
CREATE INDEX IF NOT EXISTS idx_nvv_sync_log_execution_date ON nvv.nvv_sync_log(execution_date DESC);

-- Index para búsquedas por status
CREATE INDEX IF NOT EXISTS idx_nvv_sync_log_status ON nvv.nvv_sync_log(status);
