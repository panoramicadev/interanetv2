/**
 * Costo por línea de venta — criterio único para Margen y Comisiones.
 * ------------------------------------------------------------------
 * Los documentos del ERP mezclan mercadería con CONCEPTOS: fletes,
 * servicios, descuentos, diferencias de precio, muestras y envases.
 * En el ERP todos esos códigos empiezan con "ZZ" (ZZFLETE001,
 * ZZSERVICIOS, ZZDESCUENTO, ZZDIFPRECIO, ...).
 *
 * Un concepto NO tiene costo de mercadería: no salió nada de bodega.
 * Cargárselo infla el costo y hunde el margen del vendedor. Pasó de
 * verdad: ZZSERVICIOS quedó con un precio GRI de $1.547.550 tomado de
 * una recepción de 2022, y como ese código se reutiliza para todos los
 * servicios (asistencia, arriendo, 1% administración), en 2026 cargó
 * ~$10,8 millones de costo inexistente. Un servicio facturado en
 * $155.430 arrastraba $9,3 millones de costo.
 *
 * Los fragmentos asumen los alias de las consultas de margen/comisiones:
 *   fv  = ventas.fact_ventas
 *   gpc = gri_prices_cache
 *   pl  = price_list   (solo en UNIT_COST_EXPR)
 */
import { sql } from "drizzle-orm";

/** Línea de concepto (no mercadería): no lleva costo. */
export const ES_CONCEPTO = sql`UPPER(TRIM(COALESCE(fv."koprct", ''))) LIKE 'ZZ%'`;

/**
 * CUIDADO CON LAS UNIDADES. Cada línea trae dos cantidades: `caprco1` en la
 * unidad 1 (el galón) y `caprco2` en la unidad 2 (el balde de 4 galones). Los
 * dos costos disponibles NO están en la misma unidad:
 *
 *   fv.ppprpm  → por unidad 1 (galón)  → multiplicar por caprco1
 *   gpc.price  → por unidad 2 (balde)  → multiplicar por caprco2
 *
 * Verificado contra la planilla de Finanzas de abril 2026: para un producto
 * "4 GALONES", ppprpm × caprco2 da exactamente 1/4 del costo real, mientras
 * ppprpm × caprco1 lo reproduce al peso. Cruzar las unidades cuadruplica o
 * divide por cuatro el costo de la línea.
 *
 * Prioridad: el COSTO DEL DOCUMENTO manda. Es lo que de verdad costó esa venta,
 * congelado por el ERP al emitirla, y es la fuente de la verdad que usa
 * Finanzas. El snapshot GRI es el último costo conocido y se aplica hacia
 * atrás, así que hace que una venta de abril cambie de costo en agosto: queda
 * solo como respaldo para las líneas que no traen costo propio.
 */
export const LINE_COST_EXPR = sql`(CASE
  WHEN ${ES_CONCEPTO} THEN 0
  WHEN COALESCE(fv."ppprpm", 0) <> 0 THEN fv."ppprpm" * COALESCE(fv."caprco1", 0)
  ELSE COALESCE(
    gpc."price",
    NULLIF(fv."listacost", 0),
    pl."costo_produccion",
    0
  ) * COALESCE(fv."caprco2", 0)
END)`;

/** Variante para las consultas que solo cruzan el costo GRI (sin price_list). */
export const LINE_COST_GRI_EXPR = sql`(CASE
  WHEN ${ES_CONCEPTO} THEN 0
  WHEN COALESCE(fv."ppprpm", 0) <> 0 THEN fv."ppprpm" * COALESCE(fv."caprco1", 0)
  ELSE COALESCE(gpc."price", 0) * COALESCE(fv."caprco2", 0)
END)`;
