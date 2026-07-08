import { eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Normalización del segmento "Industrial" (antes "Fabricación Modular").
 *
 * El nombre del segmento vive en `ventas.fact_ventas.noruen`, que el ETL
 * resuelve por join a la tabla de rubros del ERP (`stg_tabru.nokoru`). El ERP
 * renombró ese rubro a "Industrial", pero hasta que el ETL re-sincronice todo
 * el histórico pueden convivir el valor viejo ("Fabricación Modular", en la
 * grafía/acento/caja que tenga el ERP) y el nuevo ("Industrial"). Acá los
 * unificamos bajo una sola etiqueta canónica.
 *
 * IMPORTANTE: el match NO es por strings exactos (la grafía real del ERP puede
 * diferir en mayúsculas/acentos), sino por el token distintivo: cualquier
 * `noruen` que contenga "MODULAR" o que sea "INDUSTRIAL" es el segmento
 * Industrial. Ningún otro segmento usa esas palabras, así que es seguro.
 *
 * Propiedad clave: para cualquier segmento que NO sea Industrial, estos helpers
 * se comportan exactamente igual que antes (mismo filtro, mismo display).
 */

// En MAYÚSCULA para ser consistente con los demás segmentos del dashboard
// (que muestran el `noruen` crudo: CONSTRUCCION, FERRETERIAS, MCT, …).
export const INDUSTRIAL_LABEL = "INDUSTRIAL";

/** ¿El valor (crudo o etiqueta) corresponde al segmento Industrial? */
export function isIndustrialSegment(value: string | null | undefined): boolean {
  if (value == null) return false;
  const up = value.trim().toUpperCase();
  return up === "INDUSTRIAL" || up.includes("MODULAR");
}

/** Para MOSTRAR: convierte cualquier variante en la etiqueta canónica. */
export function canonicalSegmentName<T extends string | null | undefined>(raw: T): T | string {
  if (raw == null) return raw;
  return isIndustrialSegment(raw) ? INDUSTRIAL_LABEL : raw;
}

/**
 * Condición de match para el segmento Industrial, insensible a
 * mayúsculas/acentos y a la redacción exacta ("Fabricación Modular",
 * "FABRICACION MODULAR", "Industrial", etc.). `columnExpr` es la columna
 * `noruen` como fragmento SQL.
 */
function industrialSqlCondition(columnExpr: SQL): SQL {
  return sql`(TRIM(${columnExpr}) ILIKE 'industrial' OR ${columnExpr} ILIKE '%modular%')`;
}

/**
 * Reemplazo directo de `eq(column, selected)` que respeta el segmento
 * Industrial (viejo + nuevo). Para el resto de segmentos devuelve una igualdad
 * equivalente a la original.
 */
export function segmentEq(column: PgColumn, selected: string): SQL {
  if (isIndustrialSegment(selected)) {
    return industrialSqlCondition(sql`${column}`);
  }
  return eq(column, selected);
}

/**
 * Igual que `segmentEq` pero cuando la columna se referencia de forma cruda
 * dentro de un template `sql`` (p. ej. `sql`fv."noruen"`` o `sql`noruen``).
 */
export function segmentSqlEq(columnExpr: SQL, selected: string): SQL {
  if (isIndustrialSegment(selected)) {
    return industrialSqlCondition(columnExpr);
  }
  return sql`${columnExpr} = ${selected}`;
}

/**
 * Fragmento de condición como STRING crudo, para sitios que concatenan SQL a
 * mano (no templates `sql``). `columnRawExpr` es el nombre de columna literal
 * (p. ej. `"noruen"`). El valor se escapea con comillas simples dobladas.
 */
export function segmentRawStringCondition(columnRawExpr: string, selected: string): string {
  if (isIndustrialSegment(selected)) {
    return `(TRIM(${columnRawExpr}) ILIKE 'industrial' OR ${columnRawExpr} ILIKE '%modular%')`;
  }
  return `${columnRawExpr} = '${selected.replace(/'/g, "''")}'`;
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
