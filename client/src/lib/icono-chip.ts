// Chip de ícono de tarjeta o panel — el cuadrado naranjo con el ícono en blanco.
//
// Es el mismo de la tarjeta de Meta y de Documentos Pendientes, que es el que quedó
// como estándar (corrección del usuario, ago-2026). Antes convivían dos versiones: esta
// y una "suave" (fondo naranjo pálido con el ícono naranjo), que al lado de la sólida se
// veía apagada y hacía que dos tarjetas vecinas parecieran de distinta jerarquía.
//
// Fuente única: importar de acá en vez de repetir las clases. Si el chip cambia, cambia
// en todos los módulos de una vez.

/** Contenedor del chip. Va en el `div` que envuelve al ícono. */
export const ICONO_CHIP =
  "bg-[#fd6301] rounded-xl p-2.5 shadow-md shadow-[#fd6301]/25 flex items-center justify-center shrink-0";

/** El ícono adentro del chip: tamaño y color. */
export const ICONO_CHIP_ICONO = "h-5 w-5 text-white";

/**
 * Variante chica, para chips dentro de una fila de lista o de una tabla, donde el
 * tamaño estándar se come el alto de la fila. Mismo color y mismo radio.
 */
export const ICONO_CHIP_SM =
  "bg-[#fd6301] rounded-lg p-2 shadow-sm shadow-[#fd6301]/25 flex items-center justify-center shrink-0";

export const ICONO_CHIP_ICONO_SM = "h-4 w-4 text-white";
