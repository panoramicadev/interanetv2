-- 046: Fotos promocionales por producto en product_content
-- Galería de imágenes promocionales que se muestran en el detalle público del producto.

ALTER TABLE product_content
  ADD COLUMN IF NOT EXISTS fotos_promocionales JSONB DEFAULT '[]'::jsonb;
