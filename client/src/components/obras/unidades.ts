/**
 * Unidades de medida del control de obras.
 *
 * La planilla tenía una sola unidad —"tineta"— y no distinguía la de 4 galones
 * de la de 5, que es justamente lo que cambia el cálculo: la misma cantidad de
 * tinetas puede ser 15 o 19 litros por vivienda. Ahora son cuatro formatos
 * cerrados y no hay texto libre; "kilos" y "unidades" salieron porque en obra
 * no se pide pintura así.
 *
 * El valor guardado es un slug estable (`tineta_4gl`), no la etiqueta: cambiar
 * cómo se escribe "Tineta 4 galones" no puede romper los datos ya cargados.
 */

export interface UnidadObra {
  valor: string;
  /** Como se elige en el selector. */
  label: string;
  /** Para las celdas apretadas de la planilla. */
  corto: string;
  /** "1,5 tinetas de 4 galones por vivienda". */
  plural: string;
}

export const UNIDADES_OBRA: UnidadObra[] = [
  { valor: "tineta_4gl", label: "Tineta 4 galones", corto: "Tineta 4 gl", plural: "tinetas de 4 galones" },
  { valor: "tineta_5gl", label: "Tineta 5 galones", corto: "Tineta 5 gl", plural: "tinetas de 5 galones" },
  { valor: "galon", label: "Galón", corto: "Galón", plural: "galones" },
  { valor: "litro", label: "Litro", corto: "Litro", plural: "litros" },
];

/**
 * Con qué se queda un producto cuando no se pudo deducir el formato. Es la
 * tineta de 4 galones porque es el formato de obra por defecto de la planilla;
 * el selector del producto está justamente para corregirlo cuando no sea esa.
 */
export const UNIDAD_POR_DEFECTO = "tineta_4gl";

const POR_VALOR = new Map(UNIDADES_OBRA.map((u) => [u.valor, u]));

/** MAYÚSCULAS y sin acentos: el maestro del ERP escribe "GALÓN" y "GALON". */
const limpiar = (texto: string | null | undefined) =>
  (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

/**
 * Busca un formato dentro de un texto libre (el nombre del producto o el código
 * de unidad del ERP). Devuelve null cuando no dice nada al respecto.
 */
function detectar(texto: string | null | undefined): string | null {
  const t = limpiar(texto);
  if (!t) return null;

  // Tinetas/baldes con su capacidad, en cualquiera de las formas en que el
  // maestro las escribe: "TINETA 5 GL", "BALDE 4 GALONES", "BD5".
  if (/\b(?:TINETA|BALDE|BD)\s*-?\s*0?5\b/.test(t) || /\b0?5\s*(?:GL|GAL|GALON|GALONES)\b/.test(t)) {
    return "tineta_5gl";
  }
  if (/\b(?:TINETA|BALDE|BD)\s*-?\s*0?4\b/.test(t) || /\b0?4\s*(?:GL|GAL|GALON|GALONES)\b/.test(t)) {
    return "tineta_4gl";
  }
  // Tineta sin capacidad: es el caso de la planilla vieja.
  if (/\b(?:TINETA|BALDE)\b/.test(t)) return "tineta_4gl";
  if (/\b(?:GL|GAL|GALON|GALONES)\b/.test(t) || t.includes("1/4")) return "galon";
  if (/\b(?:LT|LTS|LITRO|LITROS)\b/.test(t)) return "litro";
  return null;
}

/**
 * Normaliza cualquier unidad —un slug ya canónico, un valor viejo de la planilla
 * ("tineta", "kilo") o un código del ERP ("BD4", "GL")— a uno de los cuatro
 * formatos. Lo que no se reconoce cae en el formato por defecto.
 */
export function normalizarUnidad(bruta: string | null | undefined): string {
  const valor = (bruta ?? "").trim();
  if (POR_VALOR.has(valor)) return valor;
  return detectar(valor) ?? UNIDAD_POR_DEFECTO;
}

/**
 * Formato de un producto traído del catálogo.
 *
 * El nombre manda por sobre el código de unidad del ERP: `ud02pr` dice la
 * presentación genérica ("GL") y no distingue la tineta de 4 de la de 5, pero el
 * nombre del maestro sí la trae ("LATEX CONSTRUCCION BLANCO TINETA 5 GL"). Por
 * eso el producto llamado por SKU asignaba siempre la misma unidad.
 */
export function unidadDesdeCatalogo(nombre: string | null | undefined, unidadErp: string | null | undefined): string {
  return detectar(nombre) ?? detectar(unidadErp) ?? UNIDAD_POR_DEFECTO;
}

export const etiquetaUnidad = (valor: string | null | undefined): string =>
  POR_VALOR.get(normalizarUnidad(valor))?.label ?? "";

export const etiquetaCortaUnidad = (valor: string | null | undefined): string =>
  POR_VALOR.get(normalizarUnidad(valor))?.corto ?? "";

export const pluralUnidad = (valor: string | null | undefined): string =>
  POR_VALOR.get(normalizarUnidad(valor))?.plural ?? "";
