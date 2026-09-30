-- 089_solicitud_credito_aumento.sql
--
-- Aumento de crédito. Hasta ahora la Solicitud de Crédito servía solo para un
-- cliente nuevo: para subirle la línea a uno que ya compra, el vendedor tenía
-- que volver a llenar la ficha entera (socios, bancos, dirección) de una empresa
-- que Finanzas ya conoce. Pedido del gerente comercial (sep-2026): una pestaña
-- aparte para pedir el aumento.
--
-- `tipo` distingue las dos: 'nueva' (las de siempre, y todas las anteriores) o
-- 'aumento'. En un aumento se guarda la línea y los días que el cliente tenía al
-- pedirlo —la ficha cambia apenas se aprueba, y después no se sabría desde dónde
-- se subió— y el motivo. `credito_solicitado` sigue siendo la línea TOTAL que se
-- pide, no lo que se suma.
--
-- Dirección, ciudad y teléfono dejan de ser obligatorios en la tabla: en un
-- aumento salen de la ficha, que puede tenerlos incompletos. Para un cliente
-- nuevo los sigue exigiendo el formulario y la validación del servidor.

ALTER TABLE solicitudes_credito
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'nueva',
  ADD COLUMN IF NOT EXISTS credito_actual NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS dias_actuales INTEGER,
  ADD COLUMN IF NOT EXISTS motivo TEXT;

ALTER TABLE solicitudes_credito
  ALTER COLUMN direccion DROP NOT NULL,
  ALTER COLUMN ciudad DROP NOT NULL,
  ALTER COLUMN telefono DROP NOT NULL;
