/**
 * VENTA POR UNIDAD — interruptores del modo de venta.
 *
 * La pintura se vende por bulto: galón de a 4, 1/4 de galón de a 6 y baldes
 * de a 1. Desde oct-2026 el cotizador web público (/cotizador y /catalogo)
 * vende al detalle: cualquier formato desde 1 unidad y de a 1. El resto
 * (tienda B2B, tomador de pedidos, carrito, pedido sugerido, lectura de OC y
 * catálogos compartidos /catalogo/:slug) sigue por bulto.
 *
 * La configuración de bultos NO se borró: sigue en `PRODUCT_FORMATS`
 * (shared/format-utils.ts), en `CART_CONFIG.QUANTITY_RULES` (shared/schema.ts)
 * y en las columnas `min_unit` / `step_size` de `ecommerce_products`. Estos
 * interruptores solo hacen que el sistema las ignore.
 *
 * Ver VENTA-POR-UNIDAD.md en la raíz del repo.
 */

/** Interno: tienda B2B, tomador de pedidos, carrito, pedido sugerido, OC. */
export const VENTA_POR_UNIDAD = false;

/** Cotizador web público (/cotizador, /catalogo): lista de cotización B2C. */
export const VENTA_POR_UNIDAD_COTIZADOR_WEB = true;

function regla(
  porUnidad: boolean,
  minUnit: number | string | null | undefined,
  stepSize: number | string | null | undefined,
): { minUnit: number; stepSize: number } {
  if (porUnidad) return { minUnit: 1, stepSize: 1 };
  return {
    minUnit: Number(minUnit) || 1,
    stepSize: Number(stepSize) || 1,
  };
}

/**
 * Regla de cantidad efectiva de un producto en el interno: la del bulto, o 1 y
 * de a 1 si se vende por unidad. Acepta lo que venga de la base (null, string, número).
 */
export function reglaDeVenta(
  minUnit: number | string | null | undefined,
  stepSize: number | string | null | undefined,
): { minUnit: number; stepSize: number } {
  return regla(VENTA_POR_UNIDAD, minUnit, stepSize);
}

/** Igual que `reglaDeVenta`, pero para el cotizador web público. */
export function reglaDeVentaCotizadorWeb(
  minUnit: number | string | null | undefined,
  stepSize: number | string | null | undefined,
): { minUnit: number; stepSize: number } {
  return regla(VENTA_POR_UNIDAD_COTIZADOR_WEB, minUnit, stepSize);
}
