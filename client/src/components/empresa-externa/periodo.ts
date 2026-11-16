import type { YearMonthSelection } from "@/contexts/FilterContext";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Rango de fechas (YYYY-MM-DD) de la selección del selector de período. El
 * final se corta en el día de hoy, así la comparación con el año anterior es
 * "a la misma fecha", igual que en el Dashboard de Panorámica.
 */
export function rangoDeSeleccion(sel: YearMonthSelection | null | undefined): { desde: string; hasta: string } {
  const hoy = new Date();
  const corte = (d: Date) => (d > hoy ? hoy : d);
  if (!sel || !sel.years?.length) {
    return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) };
  }
  const anios = [...sel.years].sort((a, b) => a - b);
  const y = anios[0];
  if (sel.period === "custom-range" && sel.startDate && sel.endDate) {
    return { desde: iso(new Date(sel.startDate)), hasta: iso(corte(new Date(sel.endDate))) };
  }
  if (sel.period === "full-year") {
    return { desde: `${y}-01-01`, hasta: iso(corte(new Date(anios[anios.length - 1], 11, 31))) };
  }
  const meses = sel.months && sel.months.length ? [...sel.months].sort((a, b) => a - b) : [hoy.getMonth() + 1];
  if ((sel.period === "day" || sel.period === "days") && sel.days && sel.days.length) {
    const dias = [...sel.days].sort((a, b) => a - b);
    const m = meses[0] - 1;
    return { desde: iso(new Date(y, m, dias[0])), hasta: iso(corte(new Date(y, m, dias[dias.length - 1]))) };
  }
  // Mes o varios meses: del primero al último (los meses intermedios entran).
  return {
    desde: iso(new Date(y, meses[0] - 1, 1)),
    hasta: iso(corte(new Date(y, meses[meses.length - 1], 0))),
  };
}

/** "16/11/2025" → "16/11". */
export const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** "2026-11-16" → "16-11-2026". */
export const fechaCorta = (fecha: string) => `${fecha.slice(8, 10)}-${fecha.slice(5, 7)}-${fecha.slice(0, 4)}`;
