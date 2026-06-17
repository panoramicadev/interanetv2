-- Paleta de colores del catálogo: hex por nombre de color (ecommerce_products.color).
-- La usan los swatches del Tomador de Pedidos / Constructor de Presupuesto.
-- Nota: el server también ejecuta este DDL + seed en runtime (bootstrapDatabase)
-- porque el runner de migraciones no es confiable en producción.

CREATE TABLE IF NOT EXISTS color_palette (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_color TEXT NOT NULL,
  hex VARCHAR(32) NOT NULL DEFAULT '#cbd5e1',
  updated_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Único case-insensitive para que "Blanco" y "BLANCO" no dupliquen.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_color_palette_nombre"
  ON color_palette (UPPER(TRIM(nombre_color)));

-- Auto-puebla con los colores reales del catálogo asignando un hex aproximado.
-- Idempotente: ON CONFLICT DO NOTHING solo agrega colores nuevos.
INSERT INTO color_palette (nombre_color, hex)
SELECT DISTINCT ON (UPPER(TRIM(ep.color))) TRIM(ep.color),
  CASE
    WHEN ep.color ILIKE '%hueso%' THEN '#f5f0e1'
    WHEN ep.color ILIKE '%marfil%' THEN '#fbf7e4'
    WHEN ep.color ILIKE '%blanco%' THEN '#fafafa'
    WHEN ep.color ILIKE '%negro%' THEN '#1e293b'
    WHEN ep.color ILIKE '%gris perla%' THEN '#d1d5db'
    WHEN ep.color ILIKE '%plomo%' THEN '#6b7280'
    WHEN ep.color ILIKE '%gris%' THEN '#94a3b8'
    WHEN ep.color ILIKE '%crema%' THEN '#f5e6c8'
    WHEN ep.color ILIKE '%beige%' OR ep.color ILIKE '%arena%' THEN '#e8d8b0'
    WHEN ep.color ILIKE '%topacio%' THEN '#f4c430'
    WHEN ep.color ILIKE '%amarillo%' THEN '#facc15'
    WHEN ep.color ILIKE '%oro%' OR ep.color ILIKE '%dorado%' THEN '#d4af37'
    WHEN ep.color ILIKE '%naran%' THEN '#f97316'
    WHEN ep.color ILIKE '%terracota%' OR ep.color ILIKE '%teja%' THEN '#c1654a'
    WHEN ep.color ILIKE '%bermell%' THEN '#e34234'
    WHEN ep.color ILIKE '%colonial%' THEN '#a52a2a'
    WHEN ep.color ILIKE '%burdeo%' OR ep.color ILIKE '%bordo%' OR ep.color ILIKE '%vino%' THEN '#7b1f2b'
    WHEN ep.color ILIKE '%rojo%' THEN '#dc2626'
    WHEN ep.color ILIKE '%fucsia%' OR ep.color ILIKE '%magenta%' THEN '#d6336c'
    WHEN ep.color ILIKE '%rosa%' OR ep.color ILIKE '%rosado%' THEN '#f9a8d4'
    WHEN ep.color ILIKE '%lila%' THEN '#c4b5fd'
    WHEN ep.color ILIKE '%morado%' OR ep.color ILIKE '%violeta%' OR ep.color ILIKE '%purpura%' OR ep.color ILIKE '%púrpura%' THEN '#7c3aed'
    WHEN ep.color ILIKE '%celeste%' THEN '#7dd3fc'
    WHEN ep.color ILIKE '%turquesa%' OR ep.color ILIKE '%aqua%' OR ep.color ILIKE '%agua marina%' THEN '#2dd4bf'
    WHEN ep.color ILIKE '%marino%' THEN '#1e3a8a'
    WHEN ep.color ILIKE '%azul rey%' OR ep.color ILIKE '%azul el%' THEN '#1d4ed8'
    WHEN ep.color ILIKE '%azul%' THEN '#2563eb'
    WHEN ep.color ILIKE '%verde lim%' THEN '#84cc16'
    WHEN ep.color ILIKE '%verde agua%' THEN '#99f6e4'
    WHEN ep.color ILIKE '%oliva%' OR ep.color ILIKE '%militar%' THEN '#556b2f'
    WHEN ep.color ILIKE '%verde%' THEN '#16a34a'
    WHEN ep.color ILIKE '%cobre%' OR ep.color ILIKE '%copper%' THEN '#b87333'
    WHEN ep.color ILIKE '%bronce%' THEN '#cd7f32'
    WHEN ep.color ILIKE '%plata%' OR ep.color ILIKE '%plateado%' OR ep.color ILIKE '%aluminio%' THEN '#c0c0c0'
    WHEN ep.color ILIKE '%chocolate%' OR ep.color ILIKE '%cafe%' OR ep.color ILIKE '%café%' OR ep.color ILIKE '%marron%' OR ep.color ILIKE '%marrón%' OR ep.color ILIKE '%caoba%' OR ep.color ILIKE '%nogal%' THEN '#7b4b2a'
    WHEN ep.color ILIKE '%madera%' OR ep.color ILIKE '%roble%' OR ep.color ILIKE '%cedro%' OR ep.color ILIKE '%pino%' OR ep.color ILIKE '%natural%' THEN '#c19a6b'
    WHEN ep.color ILIKE '%transparente%' OR ep.color ILIKE '%incoloro%' OR ep.color ILIKE '%cristal%' THEN '#e2e8f0'
    ELSE '#cbd5e1'
  END
FROM ecommerce_products ep
WHERE ep.color IS NOT NULL AND TRIM(ep.color) <> ''
ORDER BY UPPER(TRIM(ep.color))
ON CONFLICT DO NOTHING;
