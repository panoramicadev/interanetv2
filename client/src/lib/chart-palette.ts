/**
 * Paleta de gráficos de la intranet (ver skill panoramica-design).
 *
 * Orden fijo: la primera serie siempre va en el naranjo de marca. Los pares
 * vecinos están validados contra daltonismo sobre fondo claro. De la 8ª serie
 * en adelante se agrupa en "Otras" con el gris pizarra.
 */
export const BRAND_ORANGE = "#fd6301";
export const BRAND_ORANGE_DARK = "#e35400";

export const CHART_COLORS = [
  "#fd6301", // naranjo de marca
  "#2563eb", // azul
  "#10b981", // verde
  "#db2777", // rosa
  "#f59e0b", // ámbar
  "#7c3aed", // morado
  "#0d9488", // teal
  "#64748b", // otras
];

/** Los mismos colores con transparencia, para barras y áreas. */
export const CHART_COLORS_SOFT = [
  "rgba(253, 99, 1, 0.85)",
  "rgba(37, 99, 235, 0.85)",
  "rgba(16, 185, 129, 0.85)",
  "rgba(219, 39, 119, 0.85)",
  "rgba(245, 158, 11, 0.85)",
  "rgba(124, 58, 237, 0.85)",
  "rgba(13, 148, 136, 0.85)",
  "rgba(100, 116, 139, 0.85)",
];

/** Colores reservados para estados: nunca usarlos como color de serie. */
export const ESTADO_COLORS = {
  pendiente: "#d97706",
  aprobado: "#059669",
  rechazado: "#dc2626",
};

/** Color de la serie n (cicla si hay más series que colores). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function chartColorSoft(index: number): string {
  return CHART_COLORS_SOFT[index % CHART_COLORS_SOFT.length];
}
