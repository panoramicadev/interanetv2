// Meses en español y completos, para toda etiqueta que el usuario lee.
//
// date-fns con `format(fecha, 'MMM')` y sin locale devuelve el mes en inglés y
// abreviado ("Aug"), que es de dónde salían los "vs Aug 2025" del dashboard.
// Acá no hay locale que se pueda olvidar de pasar.

export const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Mes en minúscula: "agosto". Para cuando va dentro de una frase ("1 de agosto"). */
export function mesEs(mesIndex0: number): string {
  return MESES_ES[mesIndex0] ?? "";
}

/**
 * Mes con mayúscula inicial: "Agosto". Para cuando el mes es el nombre del período
 * y va solo o con el año ("Agosto 2025"), igual que el selector de período.
 */
export function mesEsCapitalizado(mesIndex0: number): string {
  const m = MESES_ES[mesIndex0];
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "";
}

/** Nombre del período: "Agosto 2025". */
export function mesAnioEs(mesIndex0: number, anio: number): string {
  return `${mesEsCapitalizado(mesIndex0)} ${anio}`;
}
