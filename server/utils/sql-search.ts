/**
 * Búsqueda de texto libre insensible a mayúsculas Y a tildes/diacríticos.
 *
 * `ILIKE` de Postgres ignora mayúsculas pero NO ignora acentos: "jose" no
 * encuentra "José" ni viceversa. Para tolerar tildes (datos cargados con/sin
 * acento, tipeo del usuario, dictado por voz) normalizamos ambos lados con
 * `translate(lower(...))`.
 *
 * Se usa `translate()` en lugar de la extensión `unaccent` a propósito: no
 * depende de instalar una extensión (el runner de migraciones del proyecto es
 * frágil) y cubre el set de diacríticos del español, que es el idioma de los
 * datos. `translate()` opera por carácter (no por byte), así que es seguro con
 * UTF-8.
 */
import { sql, type SQL, type AnyColumn } from "drizzle-orm";

// Mapeo minúscula-acentuada → ASCII. Como aplicamos lower() antes, solo hacen
// falta las variantes en minúscula. FROM y TO deben tener la misma longitud.
const ACCENTS_FROM = "áàäâãéèëêíìïîóòöôõúùüûñç";
const ACCENTS_TO = "aaaaaeeeeiiiiooooouuuunc";

/** Expresión SQL que pasa el texto a minúsculas y le quita tildes (es). */
export function normalizeSql(expr: SQL | AnyColumn): SQL {
  return sql`translate(lower(${expr}), ${ACCENTS_FROM}, ${ACCENTS_TO})`;
}

/**
 * Condición "contiene" insensible a mayúsculas y a tildes. Normaliza la columna
 * y el término de modo que "jose" encuentre "José" y "café" encuentre "cafe".
 */
export function accentInsensitiveContains(column: SQL | AnyColumn, term: string): SQL {
  const pattern = `%${term}%`;
  return sql`${normalizeSql(column)} LIKE ${normalizeSql(sql`${pattern}`)}`;
}
