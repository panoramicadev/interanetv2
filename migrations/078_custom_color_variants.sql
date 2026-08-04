-- 078_custom_color_variants.sql
--
-- Colores personalizados cotizados. Hasta ahora la solicitud de color a medida
-- (botón "Color personalizado" de /tienda) entraba a quote_requests como un ítem
-- con itemType='custom_color' y SKU ficticio CUSTOM-xxx, y ahí moría: al asignarle
-- precio no pasaba nada más. El cliente nunca se enteraba y no tenía forma de
-- comprarlo.
--
-- Esta tabla materializa el color ya cotizado como una variante privada del
-- producto: sólo la ve quien tiene el token (llega por correo) o el cliente
-- logueado con ese mismo email. No entra al catálogo público — el precio de un
-- color a medida es negociado y no debe quedar expuesto a terceros.
--
-- El token es el mecanismo de entrega: el carrito de la tienda vive en
-- localStorage del navegador (ver client/src/contexts/CartContext.tsx), así que
-- el servidor no puede "dejar algo en el carrito"; el enlace del correo es lo
-- que efectivamente lo inyecta.
--
-- Sin vencimiento por decisión de negocio: el precio queda disponible hasta que
-- alguien lo desactive a mano (estado='disabled').

CREATE TABLE IF NOT EXISTS custom_color_variants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origen: la cotización que le puso precio (FK blanda a quote_requests)
  quote_request_id VARCHAR,
  quote_number VARCHAR(60),

  -- Token del enlace mágico: /tienda?colorPersonalizado=<token>
  token VARCHAR(64) NOT NULL UNIQUE,

  -- A quién pertenece. user_id se llena si el email coincide con una cuenta.
  client_email VARCHAR(160) NOT NULL,
  client_name VARCHAR(200),
  client_user_id VARCHAR,

  -- Producto base sobre el que se pidió el color
  base_sku VARCHAR(60),
  base_product_name TEXT NOT NULL,
  generic_name TEXT,
  format_unit VARCHAR(60),
  image_url TEXT,

  -- El color en sí
  color_code VARCHAR(120) NOT NULL,
  color_brand VARCHAR(120),
  color_hex VARCHAR(9),
  color_notes TEXT,
  -- Descriptor legible que se muestra como "color" de la variante
  color_label VARCHAR(240) NOT NULL,

  -- Precio asignado por el equipo comercial (neto unitario, CLP)
  unit_price NUMERIC(15, 2) NOT NULL,
  -- Cantidad que pidió cotizar; se usa como cantidad inicial en el carrito
  quantity INTEGER NOT NULL DEFAULT 1,
  min_unit INTEGER NOT NULL DEFAULT 1,
  step_size INTEGER NOT NULL DEFAULT 1,

  -- active: comprable | ordered: ya se pidió | disabled: dado de baja a mano
  estado VARCHAR(20) NOT NULL DEFAULT 'active',

  -- Cuándo el cliente abrió el enlace por primera vez
  claimed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_custom_color_variants_email" ON custom_color_variants (client_email);
CREATE INDEX IF NOT EXISTS "IDX_custom_color_variants_quote" ON custom_color_variants (quote_request_id);
CREATE INDEX IF NOT EXISTS "IDX_custom_color_variants_estado" ON custom_color_variants (estado);

-- Un mismo ítem cotizado no debe generar dos variantes si se reasigna el precio:
-- el upsert del servicio pisa la fila existente en vez de duplicarla.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_custom_color_variants_quote_item"
  ON custom_color_variants (quote_request_id, base_sku, color_code, format_unit);
