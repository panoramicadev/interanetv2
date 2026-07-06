import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Normalización del segmento "Industrial" (antes "Fabricación Modular").
 *
 * El nombre del segmento vive en `ventas.fact_ventas.noruen`, que el ETL
 * resuelve por join a la tabla de rubros del ERP (`stg_tabru.nokoru`). El ERP
 * renombró ese rubro a "Industrial", pero hasta que el ETL re-sincronice todo
 * el histórico pueden convivir el valor viejo ("FABRICACION MODULAR") y el
 * nuevo ("INDUSTRIAL"). Acá los unificamos bajo una sola etiqueta canónica.
 *
 * Propiedad clave: para cualquier segmento que NO sea Industrial, estos helpers
 * se comportan exactamente igual que antes (mismo filtro, mismo display).
 */

export const INDUSTRIAL_LABEL = "Industrial";

/** Valores crudos de `noruen` que significan "Industrial" (viejo + nuevo). */
export const INDUSTRIAL_RAW_ALIASES = [
  "INDUSTRIAL",
  "FABRICACION MODULAR",
  "FABRICACIÓN MODULAR",
];

const INDUSTRIAL_UPPER = new Set(INDUSTRIAL_RAW_ALIASES.map((v) => v.toUpperCase()));

/** ¿El valor (crudo o etiqueta) corresponde al segmento Industrial? */
export function isIndustrialSegment(value: string | null | undefined): boolean {
  if (value == null) return false;
  const up = value.trim().toUpperCase();
  return up === INDUSTRIAL_LABEL.toUpperCase() || INDUSTRIAL_UPPER.has(up);
}

/** Para MOSTRAR: convierte cualquier alias crudo en la etiqueta canónica. */
export function canonicalSegmentName<T extends string | null | undefined>(raw: T): T | string {
  if (raw == null) return raw;
  return isIndustrialSegment(raw) ? INDUSTRIAL_LABEL : raw;
}

/**
 * Para FILTRAR: dado el valor seleccionado (que puede venir ya como
 * "Industrial" o como uno de los alias), devuelve la lista de valores crudos
 * de `noruen` contra los que hay que hacer match.
 */
export function segmentFilterValues(selected: string): string[] {
  return isIndustrialSegment(selected) ? [...INDUSTRIAL_RAW_ALIASES] : [selected];
}

/**
 * Reemplazo directo de `eq(column, selected)` que respeta los alias de
 * Industrial. Para el resto de segmentos devuelve una igualdad equivalente.
 */
export function segmentEq(column: PgColumn, selected: string): SQL {
  const values = segmentFilterValues(selected);
  return values.length > 1 ? inArray(column, values) : eq(column, selected);
}

/**
 * Fragmento SQL para filtrar por segmento cuando la columna se referencia de
 * forma cruda (p. ej. `fv."noruen"` o `noruen` dentro de un template `sql``).
 * Genera `<columnExpr> IN ($1, $2, ...)` con los alias correspondientes.
 * (Se usa IN + sql.join en vez de ANY(array), que en este código se expande mal.)
 */
export function segmentSqlEq(columnExpr: SQL, selected: string): SQL {
  const values = segmentFilterValues(selected);
  return sql`${columnExpr} IN (${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;
}

/**
 * Colapsa/dedupe una lista de segmentos crudos a etiquetas canónicas,
 * preservando el orden de aparición. Ideal para poblar dropdowns.
 */
export function canonicalizeSegmentList(raw: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const c = canonicalSegmentName(r);
    if (!c) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}
