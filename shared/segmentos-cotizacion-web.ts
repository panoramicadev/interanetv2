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
  /**
   * Destinatarios de la notificación interna del cotizador para este segmento.
   * Si el segmento no define los suyos, se usan
   * DESTINATARIOS_NOTIFICACION_COTIZACION_WEB. Solo aplica al correo interno del
   * cotizador web: no cambia el ruteo al CRM ni el correo al visitante.
   */
  notificacionEmails?: string[];
  /**
   * El supervisor del área puede asignar el vendedor de las cotizaciones de su
   * segmento. Si no, solo lo asigna un admin (el supervisor igual las ve).
   */
  asignaSupervisor?: boolean;
  /**
   * Vendedores a los que se le pueden asignar las cotizaciones del segmento, en
   * este orden y con este nombre visible (`id` = salespeople_users.id). Sin lista,
   * se ofrecen los del área y los equipos de sus supervisores.
   */
  vendedores?: Array<{ id: string; nombre: string }>;
}

/** A quién se le avisa una cotización web cuando el segmento no define destinatarios propios. */
export const DESTINATARIOS_NOTIFICACION_COTIZACION_WEB = [
  'contacto@pinturaspanoramica.cl',
  'dhermosilla@pinturaspanoramica.cl',
];

export const SEGMENTOS_COTIZACION_WEB: SegmentoCotizacionWeb[] = [
  {
    value: 'construccion',
    label: 'CONSTRUCCIÓN',
    crmSegmento: 'Construcción',
    assignedSegmentLike: ['%construc%'],
    notificacionEmails: ['prossi@pintureriadelsur.com'],
  },
  {
    value: 'ferreteria',
    label: 'FERRETERÍA',
    crmSegmento: 'Ferretería',
    assignedSegmentLike: ['%ferreter%'],
    // Ferretería la reparte su supervisor (Daniel Hermosilla); Construcción e
    // Industrial las asigna el admin.
    asignaSupervisor: true,
    // Lista cerrada pedida por el usuario (oct-2026).
    vendedores: [
      { id: '7f144924-8919-4b49-8c7a-990f5e181eb8', nombre: 'Daniel Hermosilla' },
      { id: '36c85cad-94f5-48aa-9cba-234049e41f00', nombre: 'Claudio Lopez' },
      { id: '44825c43-17c2-4c66-83f1-b14357d53fa6', nombre: 'Fabian Zenteno' },
      { id: 'a0b25ee9-ffe5-45f9-a33b-487ebab186eb', nombre: 'Pablo Soto' },
      { id: 'b586c293-074f-4f41-9a99-254236d1871d', nombre: 'Omar Arámbula' },
      { id: '718557b9-bf76-4723-b990-836fa629403c', nombre: 'Carol Aguirre' },
    ],
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

/**
 * Segmento del cotizador al que pertenece un área de `salespeople_users.assigned_segment`
 * (texto libre: "FERRETERIAS", "Construcción"…). Aplica los mismos patrones
 * `assignedSegmentLike` que el ruteo al CRM, pero en memoria.
 */
export function segmentoCotizacionWebDeArea(assignedSegment?: string | null): SegmentoCotizacionWeb | null {
  if (!assignedSegment) return null;
  const area = assignedSegment.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return SEGMENTOS_COTIZACION_WEB.find(s =>
    s.assignedSegmentLike.some(p => area.includes(p.replace(/%/g, ''))),
  ) || null;
}

/**
 * Nombre visible de un vendedor en Cotizaciones Web: el de la lista del segmento
 * si está ahí; si no, el del sistema con solo la inicial de cada palabra en
 * mayúscula ("PATRICIO HERNAN GHISELLINI" → "Patricio Hernan Ghisellini").
 */
export function nombreVendedorCotizacionWeb(id: string | null | undefined, nombre: string | null | undefined): string {
  for (const s of SEGMENTOS_COTIZACION_WEB) {
    const fijo = s.vendedores?.find(v => v.id === id);
    if (fijo) return fijo.nombre;
  }
  return (nombre || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/** Estados de una cotización web, en el orden en que avanza. */
export const ESTADOS_COTIZACION_WEB = ['pending', 'assigned', 'contacted', 'quoted', 'sale', 'closed'] as const;

/** Etiqueta legible del segmento (para emails y panel admin). */
export function segmentoCotizacionWebLabel(value?: string | null): string | null {
  return getSegmentoCotizacionWeb(value)?.crmSegmento ?? (value || null);
}

/**
 * Destinatarios (separados por coma, como los espera el helper de correo) de la
 * notificación interna del cotizador web para el segmento elegido.
 */
export function destinatariosNotificacionCotizacionWeb(value?: string | null): string {
  const segmento = getSegmentoCotizacionWeb(value);
  const emails = segmento?.notificacionEmails?.length
    ? segmento.notificacionEmails
    : DESTINATARIOS_NOTIFICACION_COTIZACION_WEB;
  return emails.join(', ');
}
