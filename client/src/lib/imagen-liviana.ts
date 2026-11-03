/**
 * Las fotos de productos y banners viven en Supabase Storage a tamaño completo
 * (cientos de KB cada una). Para mostrarlas, se piden redimensionadas por el
 * endpoint de transformación de Supabase, que además entrega WebP al navegador.
 * Cualquier URL que no sea de Supabase Storage se devuelve tal cual.
 */
export function imagenLiviana(url: string | null | undefined, width: number, quality = 75): string {
  if (!url) return '';
  if (!url.includes('.supabase.co/storage/v1/object/public/')) return url;
  const render = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = render.includes('?') ? '&' : '?';
  return `${render}${sep}width=${width}&quality=${quality}&resize=contain`;
}
