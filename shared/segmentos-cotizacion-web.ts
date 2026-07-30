/**
 * Segmentos del cotizador web público.
 *
 * El visitante elige su segmento en el modal "Solicitar Cotización" y con eso
 * la solicitud se rutea al CRM correspondiente (Construcción / Ferretería /
 * Industrial).
 *
 * Se viaja por la red el `value` en ASCII (no la etiqueta con tildes) para que
 * ningún problema de encoding rompa el ruteo. `crmSegmento` es la etiqueta que
 * se escribe en `crm_seguimiento_clientes.segmento` y DEBE coincidir carácter a
 * carácter con SEGMENTOS_CRM (client/src/lib/crm-seguimiento.ts): el filtro por
 * segmento del pipeline compara strings exactos, así que cualquier variante
 * dejaría el lead fuera de la vista de su área.
 *
 * `assignedSegmentLike` son los patrones ILIKE con los que se busca al
 * encargado/supervisor del área en `salespeople_users.assigned_segment`, que es
 * texto libre ("CONSTRUCCION", "Ferreterías", "Digital"…). Industrial incluye
 * "digital" y "modular" por el rename histórico del rubro (ver
 * server/utils/segment-normalize.ts).
 */

export interface SegmentoCotizacionWeb {
  value: string;
  /** Etiqueta para el formulario público (en mayúsculas, como el resto del modal). */
  label: string;
  /** Valor exacto que se escribe en crm_seguimiento_clientes.segmento. */
  crmSegmento: string;
  assignedSegmentLike: string[];
}

export const SEGMENTOS_COTIZACION_WEB: SegmentoCotizacionWeb[] = [
  {
    value: 'construccion',
    label: 'CONSTRUCCIÓN',
    crmSegmento: 'Construcción',
    assignedSegmentLike: ['%construc%'],
  },
  {
    value: 'ferreteria',
    label: 'FERRETERÍA',
    crmSegmento: 'Ferretería',
    assignedSegmentLike: ['%ferreter%'],
  },
  {
    value: 'industrial',
    label: 'INDUSTRIAL',
    crmSegmento: 'Industrial',
    assignedSegmentLike: ['%industrial%', '%modular%', '%digital%'],
  },
];

export const SEGMENTO_COTIZACION_WEB_VALUES = SEGMENTOS_COTIZACION_WEB.map(s => s.value);

/** Etiqueta con la que caen al CRM todas las solicitudes del cotizador público. */
export const ETIQUETA_COTIZACION_WEB = 'COTIZACIÓN WEB';

export function getSegmentoCotizacionWeb(value?: string | null): SegmentoCotizacionWeb | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return SEGMENTOS_COTIZACION_WEB.find(s => s.value === v || s.crmSegmento.toLowerCase() === v) || null;
}

/** Etiqueta legible del segmento (para emails y panel admin). */
export function segmentoCotizacionWebLabel(value?: string | null): string | null {
  return getSegmentoCotizacionWeb(value)?.crmSegmento ?? (value || null);
}
