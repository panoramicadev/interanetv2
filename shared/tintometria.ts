/**
 * Tintometría: notación de dosis de las máquinas dispensadoras y nombres que
 * comparten el servidor (importador del libro) y la pantalla (carta de colores).
 *
 * Una dosis se escribe "1Y14-1": onzas, "Y", 48avos de onza (las "rayas" o
 * "pintas" del libro) y un tramo final "-0"/"-1" que suma media raya. Es la
 * notación onza / 48 / 96 de los dispensadores. Se verificó contra el libro
 * Copper 960 (sep-2026): las 3.831 dosis por galón de la cartilla Panorámica
 * cuadran exactas con sus rayas si una onza tiene 48 rayas y la dosis se corta
 * (no se redondea) a la media raya.
 *
 * La onza es la onza líquida estadounidense (29,5735 ml): el libro no lo dice,
 * así que los ml se muestran como referencia y la dosis que manda es la del
 * libro.
 */

export const RAYAS_POR_ONZA = 48;
export const ML_POR_ONZA = 29.5735;

export interface DosisLeida {
  onzas: number;
  rayas: number;
  media: boolean;
  /** Todo expresado en rayas (48avos de onza), con la media raya incluida. */
  totalRayas: number;
}

/**
 * Lee "1Y14-1", "0Y57", "0y11" (el laboratorio a veces la escribe sin el tramo
 * final o en minúscula). null si no es una dosis.
 */
export function leerDosis(texto: string | null | undefined): DosisLeida | null {
  const m = /^\s*(\d+)\s*[Yy]\s*(\d+)(?:\s*-\s*([01]))?\s*$/.exec(String(texto ?? ""));
  if (!m) return null;
  const onzas = Number(m[1]);
  const rayas = Number(m[2]);
  const media = m[3] === "1";
  return { onzas, rayas, media, totalRayas: onzas * RAYAS_POR_ONZA + rayas + (media ? 0.5 : 0) };
}

/** Escribe una cantidad de rayas en la notación del libro, cortando a la media raya. */
export function escribirDosis(totalRayas: number): string {
  const enMedias = Math.floor(Math.max(0, totalRayas) * 2 + 1e-9);
  const onzas = Math.floor(enMedias / (RAYAS_POR_ONZA * 2));
  const resto = enMedias - onzas * RAYAS_POR_ONZA * 2;
  return `${onzas}Y${Math.floor(resto / 2)}-${resto % 2}`;
}

/** ml aproximados de una dosis escrita, o null si el texto no es una dosis. */
export function dosisEnMl(texto: string | null | undefined): number | null {
  const d = leerDosis(texto);
  return d ? (d.totalRayas / RAYAS_POR_ONZA) * ML_POR_ONZA : null;
}

/** "0Y0-0" no es una dosis que haya que servir. */
export function esDosisVacia(texto: string | null | undefined): boolean {
  const d = leerDosis(texto);
  return !d || d.totalRayas === 0;
}

/**
 * Un colorante de una fórmula. `dosis` va por formato, con la cantidad de
 * galones como clave ("1" = galón, "5" = balde de 5 galones), tal como la trae
 * el libro. `rayasPorGalon` es la cantidad sin redondear cuando el libro la da
 * (la cartilla Panorámica sí, la de Sherwin-Williams no).
 */
export interface ItemFormula {
  colorante: string;
  dosis: Record<string, string>;
  rayasPorGalon?: number | null;
}

/** Cartillas conocidas. Una fórmula de laboratorio puede traer otra (RAL, NCS…). */
export const CARTILLAS: Record<string, string> = {
  PANORAMICA: "Panorámica",
  SW: "Sherwin-Williams",
};

export const nombreCartilla = (codigo: string) => CARTILLAS[codigo] ?? codigo;

/** "1" → "Galón", "5" → "Balde 5 galones", "0.25" → "1/4 galón". */
export function nombreFormato(galones: string | number): string {
  const n = Number(galones);
  if (n === 1) return "Galón";
  if (n === 0.25) return "1/4 galón";
  if (n === 5) return "Balde 5 galones";
  return `${String(galones).replace(".", ",")} galones`;
}

/** Formatos de una fórmula, del más chico al más grande. */
export function formatosDeFormula(items: ItemFormula[]): string[] {
  const set = new Set<string>();
  for (const it of items) Object.keys(it.dosis ?? {}).forEach((k) => set.add(k));
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
}
