/**
 * VENTA POR UNIDAD — interruptor único del modo de venta.
 *
 * Hasta oct-2026 la pintura se vendía solo por bulto: galón de a 4, 1/4 de
 * galón de a 6 y baldes de a 1. Desde entonces se vende al detalle: cualquier
 * formato se puede pedir desde 1 unidad y de a 1.
 *
 * La configuración de bultos NO se borró: sigue en `PRODUCT_FORMATS`
 * (shared/format-utils.ts), en `CART_CONFIG.QUANTITY_RULES` (shared/schema.ts)
 * y en las columnas `min_unit` / `step_size` de `ecommerce_products`. Este
 * interruptor solo hace que el sistema las ignore.
 *
 * Para volver a vender por bulto: dejar VENTA_POR_UNIDAD en `false`.
 * Ver VENTA-POR-UNIDAD.md en la raíz del repo.
 */
export const VENTA_POR_UNIDAD = true;

/**
 * Regla de cantidad efectiva de un producto: la del bulto, o 1 y de a 1 si se
 * vende por unidad. Acepta lo que venga de la base (null, string, número).
 */
export function reglaDeVenta(
  minUnit: number | string | null | undefined,
  stepSize: number | string | null | undefined,
): { minUnit: number; stepSize: number } {
  if (VENTA_POR_UNIDAD) return { minUnit: 1, stepSize: 1 };
  return {
    minUnit: Number(minUnit) || 1,
    stepSize: Number(stepSize) || 1,
  };
}
