/**
 * Formato y parseo de números de la pestaña Obras.
 *
 * Vive aparte porque la planilla (control-obras.tsx) y el detalle por producto
 * (panel-productos.tsx) tienen que mostrar los mismos números igual: tinetas
 * enteras, consumo con un decimal y porcentajes redondeados.
 */

const nf = new Intl.NumberFormat("es-CL");
const nfDec = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmt = (n: number) => nf.format(Math.round(n));
/** Las tinetas utilizadas/saldo van con un decimal, igual que en la planilla. */
export const fmtDec = (n: number) => nfDec.format(n);
export const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

export const toInt = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "").replace(/\./g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export const toNum = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Número tal como se quiere escribir en un input: coma decimal y sin ceros de
 * relleno ("12" en vez de "12,0"), para que editar una cantidad no obligue a
 * borrar antes lo que el formato agregó.
 */
export const numeroEditable = (v: string | number | null | undefined) => {
  const n = toNum(v);
  if (n === 0) return "";
  return String(n).replace(".", ",");
};

/** Los buscadores de la pestaña ignoran tildes: "concepcion" encuentra "CONCEPCIÓN". */
export const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
