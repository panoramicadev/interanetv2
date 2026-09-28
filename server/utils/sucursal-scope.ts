/**
 * Sucursales que solo se distinguen por el prefijo de su orden de compra.
 *
 * Caso REDMAT: las 17 ferreterías de la cadena facturan con un solo RUT
 * (77691044-9) y un solo código de cliente del ERP, así que en
 * ventas.fact_ventas todas las ventas llegan con el mismo `endo`. Lo único que
 * separa una ferretería de sus hermanas es el prefijo con el que numera la
 * orden de compra: "009-1129" es Ferretería Chávez de Cabrero.
 *
 * El scope de datos del encargado de área viaja como `string[]` por catorce
 * firmas distintas y además forma parte de las claves de caché, así que una
 * sucursal por prefijo se codifica DENTRO de ese mismo string en vez de
 * cambiarle el tipo a todas:
 *
 *     "oc:<koen de la casa matriz>:<prefijo>"
 *
 * Solo dos lugares conocen el formato: `getEncargadoScopeKoens` (server/routes.ts),
 * que lo arma, y `DatabaseStorage.getClientScopeConditions` (server/storage.ts),
 * que lo traduce a SQL.
 */

const MARCA = 'oc:';

/** Codifica una sucursal identificada por el prefijo de su orden de compra. */
export function encodeScopeSucursal(koen: string, ocPrefix: string): string {
  return `${MARCA}${koen}:${ocPrefix}`;
}

/**
 * Devuelve el koen de una entrada del scope y, si la entrada es una sucursal por
 * prefijo, también su prefijo. Una entrada mal formada se trata como koen a
 * secas: no matchea ningún `endo` real, así que filtra en vez de abrir datos.
 */
export function parseScopeEntry(entry: string): { koen: string; ocPrefix?: string } {
  if (!entry.startsWith(MARCA)) return { koen: entry };
  const resto = entry.slice(MARCA.length);
  const corte = resto.lastIndexOf(':');
  if (corte <= 0 || corte === resto.length - 1) return { koen: entry };
  return { koen: resto.slice(0, corte), ocPrefix: resto.slice(corte + 1) };
}

/**
 * Patrón LIKE para la orden de compra de una sucursal.
 *
 * Los prefijos del cliente son de tres dígitos fijos ("007" … "039"), así que
 * matchear por el comienzo no puede cruzar una sucursal con otra. Se matchea a
 * propósito SIN el separador: el ejemplo que mandó el cliente viene con guion
 * ("009-1129"), pero el formato real de la columna OCDO todavía no está medido
 * contra producción y así entran igual "009 1129" o "0091129".
 */
export function ocPrefixPattern(ocPrefix: string): string {
  return `${ocPrefix}%`;
}
