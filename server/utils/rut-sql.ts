import { sql, type SQL } from 'drizzle-orm';
import { rutMatchKey } from '@shared/rut';

/**
 * Búsqueda por RUT insensible al formato guardado.
 *
 * En la base conviven dos formatos para el mismo RUT: el ETL guarda el que trae
 * el ERP, sin dígito verificador ("77454264"), y el alta manual lo formatea
 * completo ("77.454.264-7"). Un ILIKE literal contra la columna solo encuentra
 * el formato exacto que se tipeó, así que la misma búsqueda funcionaba o no
 * según de dónde hubiera salido la ficha.
 *
 * La comparación se hace contra el CUERPO del RUT (sin puntos, guion ni DV) de
 * los dos lados, de modo que cualquiera de las dos formas encuentra a la otra.
 */

/** ¿El término parece un RUT y no un nombre con números? */
export function looksLikeRut(term: string): boolean {
  return /^[\d.\-\s]+[kK]?$/.test(term.trim());
}

/**
 * Condición LIKE por cuerpo de RUT sobre `column`. Devuelve `null` cuando el
 * término no parece un RUT o es demasiado corto: en ese caso quien llama debe
 * quedarse solo con sus condiciones por nombre, sin ensuciar la búsqueda.
 */
export function rutContainsCondition(column: unknown, term: string): SQL | null {
  const trimmed = term.trim();
  const key = rutMatchKey(trimmed);
  if (!looksLikeRut(trimmed) || key.length < 6) return null;
  return sql`REPLACE(REPLACE(REPLACE(UPPER(COALESCE(${column}, '')), '.', ''), '-', ''), ' ', '') LIKE ${`%${key}%`}`;
}
