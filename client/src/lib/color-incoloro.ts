import type { CSSProperties } from "react";

// Los colores "incoloros" (Base Incolora, Transparente, Cristal...) no se pueden
// dibujar con un color plano: pintarlos de gris o de un tono cualquiera hace creer
// que el producto tiene ese color. Se dibujan como vidrio — cuadriculado de fondo
// que se ve a través, más un brillo diagonal — que es como se representa la
// transparencia en cualquier editor gráfico.
//
// Fuente única: la usan la ficha del producto y el Dashboard de Productos, para que
// el mismo "Base Incolora" se vea igual en las dos.

/**
 * ¿La etiqueta de color describe algo transparente?
 * Compara sin acentos y en mayúsculas, y busca la raíz de la palabra para que
 * entren las variantes: "Incoloro", "Incolora", "Base Incolora", "Transparente",
 * "Esmalte transparente", "Cristal", "Sin color".
 */
export function esColorIncoloro(name: string | null | undefined): boolean {
  if (!name) return false;
  const limpio = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return /INCOLOR|TRANSPAREN|CRISTAL|SIN\s+COLOR/.test(limpio);
}

/** Cuadriculado de transparencia (el fondo del muestrario). */
export const INCOLORO_FONDO: CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%), " +
    "linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%)",
  backgroundSize: "6px 6px",
  backgroundPosition: "0 0, 3px 3px",
};

/** Brillo diagonal encima del cuadriculado: lo que lo hace leer como vidrio. */
export const INCOLORO_BRILLO: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.55) 38%, rgba(255,255,255,0.05) 52%, rgba(255,255,255,0.4) 100%)",
};

export const INCOLORO_TITULO = "Incoloro / transparente";
