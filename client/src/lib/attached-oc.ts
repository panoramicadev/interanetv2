/**
 * Helpers para persistir la Orden de Compra adjuntada desde el modal "Pedido Rápido
 * por SKU" para que el checkout (BillingSummary) la encuentre automáticamente.
 *
 * Se guarda en localStorage por usuario para que cambiar de cuenta no filtre la OC.
 */

export interface AttachedOcMetadata {
  ocNumber?: string | null;
  rut?: string | null;
  razonSocial?: string | null;
  email?: string | null;
  fecha?: string | null;
  direccion?: string | null;
  observaciones?: string | null;
  total?: string | null;
}

export interface AttachedOc {
  url: string;
  fileName: string;
  attachedAt: string;
  source: 'sku-modal' | 'checkout' | string;
  metadata?: AttachedOcMetadata | null;
}

const PREFIX = 'panoramica_attached_oc';

function key(userId?: number | string | null): string {
  return `${PREFIX}_${userId ? String(userId) : 'anon'}`;
}

export function getAttachedOc(userId?: number | string | null): AttachedOc | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.url || !parsed?.fileName) return null;
    return parsed as AttachedOc;
  } catch {
    return null;
  }
}

export function setAttachedOc(oc: AttachedOc, userId?: number | string | null): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(oc));
    window.dispatchEvent(new CustomEvent('panoramica:oc-attached', { detail: oc }));
  } catch (err) {
    console.warn('No se pudo guardar la OC adjuntada', err);
  }
}

export function clearAttachedOc(userId?: number | string | null): void {
  try {
    localStorage.removeItem(key(userId));
    window.dispatchEvent(new CustomEvent('panoramica:oc-attached', { detail: null }));
  } catch {
    /* ignore */
  }
}

export const OC_ATTACHED_EVENT = 'panoramica:oc-attached';
