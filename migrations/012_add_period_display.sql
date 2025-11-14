-- Migration 012: Agregar period_display para formato compacto del período
-- Mantener period con ISO timestamps raw, agregar period_display para UI

-- 1. Agregar columna period_display
ALTER TABLE nvv.nvv_sync_log
  ADD COLUMN IF NOT EXISTS period_display VARCHAR(100);

-- 2. Backfill con valores del campo period actual (para registros existentes)
UPDATE nvv.nvv_sync_log
SET period_display = period
WHERE period_display IS NULL;

-- 3. Comentario para documentar
COMMENT ON COLUMN nvv.nvv_sync_log.period_display IS 'Período formateado para visualización en UI (compacto y legible)';
COMMENT ON COLUMN nvv.nvv_sync_log.period IS 'Período raw con timestamps ISO (para cálculos y backward compatibility)';
