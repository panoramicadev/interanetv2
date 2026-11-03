/**
 * Dirección de la página de cada producto del cotizador: /productos/<nombre-en-slug>.
 * El slug sale del nombre genérico ("ESMALTE AL AGUA COPPER" → "esmalte-al-agua-copper").
 */
export function slugProducto(genericName: string): string {
  return genericName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** La página vive en el subdominio de la tienda; desde otro dominio se enlaza allá. */
export function urlProducto(genericName: string): string {
  const path = `/productos/${slugProducto(genericName)}`;
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('tienda.')) return path;
  return `https://tienda.pinturaspanoramica.cl${path}`;
}
