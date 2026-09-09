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

/** Cifra grande. Nunca en naranjo: el color queda para la variación. */
export const KPI_CIFRA =
  "text-base min-[400px]:text-lg lg:text-xl 2xl:text-2xl font-bold text-gray-900 dark:text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0";

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
