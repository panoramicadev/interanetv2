/**
 * Calendario de Chile en el servidor.
 *
 * Railway no fija zona horaria: el proceso corre en UTC, y la fecha de UTC pasa
 * al día siguiente a las 21:00 de Chile (20:00 en invierno). Toda regla que
 * dependa de "hoy" o de "este mes" —el término de un fondo, el mes de la boleta
 * de un vendedor— tiene que mirar el calendario de Chile, no el de UTC.
 */

const PARTES_CHILE = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Hoy en Chile, 'AAAA-MM-DD'. Se arma por partes y no con un locale que "ya
 * venga" en ese orden, porque ese orden depende de la versión de ICU.
 */
export function hoyEnChile(ahora: Date = new Date()): string {
  const partes = PARTES_CHILE.formatToParts(ahora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}
