// Cómo se muestra un reclamo: su número de trazabilidad y el cliente.

/** "N° 01/26/11/26", o null si el reclamo todavía no tiene número. */
export function etiquetaNumeroReclamo(r: { numeroTrazabilidad?: string | null }): string | null {
  return r.numeroTrazabilidad ? `N° ${r.numeroTrazabilidad}` : null;
}

const PATRON_RUT = /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/;

/**
 * Nombre y RUT del cliente de un reclamo. Hasta nov-2026 el selector de clientes
 * guardaba el RUT en clientName y el nombre en clientRut; esos reclamos quedaron
 * así, de modo que se reconoce cuál de los dos es el RUT y se pone en su lugar.
 */
export function clienteDelReclamo(r: { clientName?: string | null; clientRut?: string | null }): { nombre: string; rut: string } {
  const nombre = (r.clientName || "").trim();
  const rut = (r.clientRut || "").trim();
  if (PATRON_RUT.test(nombre) && rut && !PATRON_RUT.test(rut)) {
    return { nombre: rut, rut: nombre };
  }
  return { nombre, rut };
}
