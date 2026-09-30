/**
 * VIGENCIA DE UN FONDO — qué boletas se pueden cargar a un fondo.
 *
 * La usan el servidor (al crear o editar un gasto con fondo) y el formulario de
 * gasto (para avisar antes de confirmar), así que los dos dicen lo mismo.
 *
 * La fecha de término del fondo se compara contra la FECHA DE LA BOLETA, no
 * contra el día en que se carga: las boletas de una ruta se suben a la vuelta,
 * y un fondo que termina el 28 tiene que aceptar la boleta del 27 aunque se
 * cargue el 30. Lo que no entra es una boleta posterior al término. Antes se
 * comparaba contra "hoy" (y además en UTC): a un vendedor se le rechazaron las
 * boletas de su ruta con el fondo todavía con saldo.
 *
 * Las fechas van como texto 'AAAA-MM-DD', que es como llegan de las columnas
 * date(). Se comparan como texto y se formatean sin pasar por `Date`:
 * `new Date('2026-09-28')` es medianoche UTC, y en Chile eso se muestra como el 27.
 */

/** 'AAAA-MM-DD' → 'DD-MM-AAAA'. Lo que no tenga esa forma se devuelve tal cual. */
export function fechaDMA(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** true si la boleta es posterior al término del fondo. Un fondo sin fecha de término acepta cualquier boleta. */
export function boletaFueraDelFondo(fechaBoleta: string, fechaTermino: string | null | undefined): boolean {
  if (!fechaTermino) return false;
  return fechaBoleta.slice(0, 10) > fechaTermino.slice(0, 10);
}

/**
 * true si el fondo ya no cubre una boleta de hoy. Sigue aceptando las boletas
 * de su período: por eso "vencido" es un aviso, no un estado que lo bloquee.
 */
export function fondoVencido(fechaTermino: string | null | undefined, hoy: string): boolean {
  return boletaFueraDelFondo(hoy, fechaTermino);
}

/** El rechazo, con las dos fechas y qué hacer. Es el mismo texto en el servidor y en el formulario. */
export function mensajeBoletaFueraDelFondo(fechaBoleta: string, nombreFondo: string, fechaTermino: string): string {
  return `La boleta es del ${fechaDMA(fechaBoleta)} y el fondo «${nombreFondo}» terminó el ${fechaDMA(fechaTermino)}. Pide que extiendan el fondo o solicita uno nuevo.`;
}
