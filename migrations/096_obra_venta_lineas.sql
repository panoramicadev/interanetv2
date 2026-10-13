-- Obras: las cantidades Pedidas y Entregadas salen de los documentos asociados.
--
-- obra_venta_lineas  copia propia de las líneas de cada documento asociado a una
--                    obra. Los espejos del ERP no sirven para esto: el de notas
--                    de venta guarda solo lo pendiente y el de guías solo las
--                    abiertas, así que un documento ya despachado desaparece de
--                    ahí y con él sus cantidades. Se lee de Random al asociar y
--                    se refresca después de cada sincronización.
--
--   raiz       la línea más antigua de la cadena NVV → GDV → FCV (vía IDRST).
--              Las líneas con la misma raíz son la misma compra: se cuenta una
--              sola vez. NULL = no se pudo seguir la cadena.
--   con_guia   la línea de factura pasó por una guía (antes o después): lo
--              entregado ya lo cuenta la guía. NULL = no se sabe.
--   vigente    false cuando la línea ya no está en el documento (no se borra).
--
-- obra_productos.desde_documentos  Pedidas y Entregadas las escribe el sistema.
-- obra_productos.revisar           entró solo, desde un documento, sin proyección.
--
-- Nota: el server también ejecuta este DDL en runtime (bootstrapDatabase).

CREATE TABLE IF NOT EXISTS obra_venta_lineas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_venta_id VARCHAR NOT NULL REFERENCES obra_ventas(id) ON DELETE CASCADE,
  idmaeedo VARCHAR(30) NOT NULL,
  idmaeddo VARCHAR(30) NOT NULL,
  tido VARCHAR(10),
  kopr VARCHAR(60),
  nombre TEXT,
  cantidad NUMERIC(14, 2) NOT NULL DEFAULT 0,
  monto NUMERIC(18, 2) NOT NULL DEFAULT 0,
  raiz VARCHAR(30),
  con_guia BOOLEAN,
  vigente BOOLEAN NOT NULL DEFAULT true,
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_obra_venta_lineas_linea" ON obra_venta_lineas (obra_venta_id, idmaeddo);

ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS desde_documentos BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS revisar BOOLEAN NOT NULL DEFAULT false;
