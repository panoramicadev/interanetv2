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

/** RUT sin puntos, guion ni espacios, en mayúscula. */
function normalizedSql(column: unknown): SQL {
  return sql`REPLACE(REPLACE(REPLACE(UPPER(COALESCE(${column}, '')), '.', ''), '-', ''), ' ', '')`;
}

/**
 * Igualdad de RUT entre DOS COLUMNAS, tolerante al dígito verificador.
 *
 * Para comparar una columna contra un RUT conocido está `rutContainsCondition`,
 * que puede calcular el cuerpo en JS con módulo 11. Acá los dos lados son
 * columnas, así que no se puede: se acepta que coincidan tal cual, o que a una
 * le sobre exactamente el último carácter respecto de la otra. Eso cubre el
 * caso real —un lado con DV y el otro sin— sin necesidad de módulo 11 en SQL.
 *
 * Se exige un largo mínimo de 7 para no aparear cadenas cortas o vacías.
 */
export function rutColumnsMatchSql(a: unknown, b: unknown): SQL {
  const na = normalizedSql(a);
  const nb = normalizedSql(b);
  return sql`(
    LENGTH(${na}) >= 7 AND LENGTH(${nb}) >= 7
    AND (
      ${na} = ${nb}
      OR ${na} = LEFT(${nb}, LENGTH(${nb}) - 1)
      OR LEFT(${na}, LENGTH(${na}) - 1) = ${nb}
    )
  )`;
}
