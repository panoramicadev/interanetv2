// Tarjeta KPI del dashboard — tipografía, colores y formato.
//
// Fuente única de las cuatro tarjetas del bloque superior del dashboard principal
// (Ventas Totales, Presupuesto, Clientes Nuevos y Margen). El usuario pidió (sep-2026)
// que ESE mismo diseño se mantenga en todas las vistas: segmento, sucursal, vendedor,
// cliente y los dashboards de supervisor y técnico.
//
// Antes cada pantalla tenía su propia versión —sucursal con la cifra en naranjo y el
// ícono suelto a la derecha, supervisor con todo el texto naranjo sobre borde naranjo,
// "Mis Vendedores" con íconos azul/verde/lila/amarillo— así que el mismo indicador se
// leía distinto según dónde estabas parado.
//
// Importar de acá en vez de repetir las clases. Para la tarjeta completa ya armada está
// `TarjetaKpi` en `components/dashboard/kpi-simple-card.tsx`.

/** Cuadro de la tarjeta. El `relative` es para el chip del ícono. */
export const KPI_TARJETA =
  "modern-card p-3 sm:p-5 lg:p-6 hover-lift relative overflow-hidden";

/** Fila del chip de ícono, arriba a la izquierda y en su propia línea. */
export const KPI_CHIP_FILA = "flex items-center gap-3 pb-2";

/** Título de la tarjeta ("Ventas Totales", "Margen"…). */
export const KPI_TITULO =
  "text-xs sm:text-sm lg:text-base font-semibold text-gray-900 dark:text-white";

/**
 * Cifra grande. Nunca en naranjo: el color queda para la variación.
 *
 * **No lleva `text-ellipsis`**: son cifras de plata y un `$1.482.930…` no es un dato, es
 * un dato perdido (corrección del usuario, oct-2026). Antes la clase recortaba con
 * puntos suspensivos y en pantallas angostas desaparecían los dígitos grandes, que son
 * justo los que importan.
 *
 * Para que quepa entera sin recortar, el tamaño sale de `kpiCifraClase(valor)`, que baja
 * un escalón cuando la cifra es larga. `KPI_CIFRA` sigue exportada con el tamaño normal
 * para los llamadores que muestran valores cortos.
 */
export const KPI_CIFRA_BASE =
  "font-bold text-gray-900 dark:text-white mb-1 whitespace-nowrap min-w-0";

export const KPI_CIFRA = `text-base min-[400px]:text-lg lg:text-xl 2xl:text-2xl ${KPI_CIFRA_BASE}`;

/**
 * Clases de la cifra grande ajustadas al largo de lo que se va a mostrar.
 *
 * El escalón se elige por cantidad de caracteres del texto YA formateado
 * (`"$1.482.930.455"` son 14). Es a propósito que solo bajen los tamaños chicos: en
 * escritorio la tarjeta tiene ancho de sobra y la cifra se sigue leyendo grande; el
 * problema vive en el teléfono y en las pantallas de baja resolución.
 */
export function kpiCifraClase(valor: string | number): string {
  const largo = String(valor).length;
  if (largo <= 11) return KPI_CIFRA;
  if (largo <= 14) return `text-sm min-[400px]:text-base sm:text-lg lg:text-xl 2xl:text-2xl ${KPI_CIFRA_BASE}`;
  if (largo <= 17) return `text-xs min-[400px]:text-sm sm:text-base lg:text-lg 2xl:text-xl ${KPI_CIFRA_BASE}`;
  return `text-[11px] min-[400px]:text-xs sm:text-sm lg:text-base 2xl:text-lg ${KPI_CIFRA_BASE}`;
}

/**
 * Valor de la fila de variación (el `+22.1%`, el acumulado del año, los `-1,0 pts`).
 * Va sin negrita y al mismo tamaño en las cuatro tarjetas; el color se agrega aparte
 * con `KPI_VARIACION_COLOR`.
 */
export const KPI_VARIACION = "text-sm lg:text-base";

/** Etiqueta de contexto de esa fila ("vs Agosto 2025", "acumulado año 2026"). */
export const KPI_VARIACION_ETIQUETA =
  "text-xs lg:text-sm text-gray-500 dark:text-gray-400";

/** Filas de detalle del pie de la tarjeta ("Clientes totales: 157"). */
export const KPI_DETALLE = "text-sm lg:text-base text-gray-700 dark:text-gray-300";

/** El nombre del dato dentro de una fila de detalle, un tono más claro que la cifra. */
export const KPI_DETALLE_ETIQUETA = "text-gray-500 dark:text-gray-400";

/**
 * Color de una variación de tarjeta KPI: **siempre el naranjo de marca**, suba o baje
 * (corrección del usuario, sep-2026, para todos los dashboards).
 *
 * Antes las caídas iban en rojo. El signo y el paréntesis ya dicen que bajó, y en rojo
 * la tarjeta se leía como si algo estuviera fallando, no como el estado normal del
 * período. Es la misma regla que ya tenía la "Diferencia" de Presupuesto.
 *
 * Se mantiene como función —y no como una constante— para no tocar cada llamador si
 * mañana vuelve a depender del signo.
 */
export const KPI_VARIACION_COLOR = (_valor: number): string => "text-[#fd6301]";
