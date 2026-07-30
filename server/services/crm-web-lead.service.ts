/**
 * crm-web-lead.service — Puente cotizador público → CRM de seguimiento.
 *
 * Toda solicitud del cotizador web cae además como lead en
 * `crm_seguimiento_clientes`, en el CRM del segmento que declaró el visitante
 * (Construcción / Ferretería / Industrial) y con la etiqueta "COTIZACIÓN WEB".
 *
 * Reglas de diseño:
 * - Nunca revienta el POST público: el llamador lo envuelve en try/catch y una
 *   falla acá no debe perder la cotización (que ya quedó en quote_requests).
 * - Idempotente por contacto: si el visitante ya está en el pipeline (mismo
 *   email o RUT, lead activo) NO se duplica; se le agrega un hito con la nueva
 *   cotización y se le asegura la etiqueta.
 * - El lead se asigna al encargado/supervisor del área, que es quien ve los
 *   leads de todo su equipo (ver getVendedorScope en server/routes.ts). Si no
 *   hay a quién asignar el lead queda con un vendedor placeholder y solo lo ve
 *   un admin: se loguea fuerte para que se corrija la configuración del área.
 */

import { db } from '../db';
import {
  quoteRequests,
  crmSeguimientoClientes,
  crmSeguimientoHitos,
  salespeopleUsers,
  clients,
  type QuoteRequest,
  type QuoteRequestItem,
} from '@shared/schema';
import { and, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import {
  ETIQUETA_COTIZACION_WEB,
  getSegmentoCotizacionWeb,
} from '@shared/segmentos-cotizacion-web';
import { logPanelChange, normalizePanelSegmento } from '../panel-changes';

const AUTOR_SISTEMA_ID = 'sistema';
const AUTOR_SISTEMA_NOMBRE = 'Cotizador Web';
const VENDEDOR_SIN_ASIGNAR_ID = 'web-sin-asignar';
const VENDEDOR_SIN_ASIGNAR_NOMBRE = 'Sin asignar (web)';

/** Encargado/supervisor del área, o el primer vendedor de ese equipo. */
async function resolveOwnerForSegmento(segmentoValue: string | null | undefined) {
  const segmento = getSegmentoCotizacionWeb(segmentoValue);
  if (!segmento) return null;

  const matchesSegmento = or(
    ...segmento.assignedSegmentLike.map(p => ilike(salespeopleUsers.assignedSegment, p))
  )!;
  // is_active tiene default true pero es nullable: NULL también es activo.
  const activo = or(eq(salespeopleUsers.isActive, true), isNull(salespeopleUsers.isActive))!;

  // 1) Encargado/supervisor del área (ve los leads de todo su equipo).
  const [owner] = await db
    .select({ id: salespeopleUsers.id, name: salespeopleUsers.salespersonName })
    .from(salespeopleUsers)
    .where(and(
      activo,
      or(
        eq(salespeopleUsers.role, 'supervisor'),
        eq(salespeopleUsers.role, 'encargado_area'),
      )!,
      matchesSegmento,
    ))
    .limit(1);
  if (owner) return owner;

  // 2) Cualquier vendedor cuyo supervisor sea del área.
  const supervisores = await db
    .select({ id: salespeopleUsers.id })
    .from(salespeopleUsers)
    .where(matchesSegmento);
  if (supervisores.length > 0) {
    const [teamMember] = await db
      .select({ id: salespeopleUsers.id, name: salespeopleUsers.salespersonName })
      .from(salespeopleUsers)
      .where(and(
        activo,
        inArray(salespeopleUsers.supervisorId, supervisores.map(s => s.id)),
      ))
      .limit(1);
    if (teamMember) return teamMember;
  }

  return null;
}

/** Etiquetas actuales del lead (JSON array en texto), tolerante a basura. */
function parseEtiquetas(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return raw.split(',').map(t => t.trim()).filter(Boolean);
  }
}

function withEtiquetaWeb(raw: string | null | undefined): string {
  const tags = parseEtiquetas(raw);
  if (tags.some(t => t.trim().toUpperCase() === ETIQUETA_COTIZACION_WEB.toUpperCase())) {
    return JSON.stringify(tags);
  }
  return JSON.stringify([...tags, ETIQUETA_COTIZACION_WEB]);
}

/** Resumen de productos para la nota/hito del lead. */
function describeItems(items: QuoteRequestItem[]): string {
  const lines = (items || []).slice(0, 20).map(it => {
    const color = it.color && it.color !== 'Sin Color' ? ` ${it.color}` : '';
    const format = it.format ? ` (${it.format})` : '';
    return `• ${it.quantity} × ${it.productName}${color}${format}`;
  });
  const extra = (items?.length || 0) - lines.length;
  if (extra > 0) lines.push(`• …y ${extra} producto${extra === 1 ? '' : 's'} más`);
  return lines.join('\n');
}

/** Lead activo del mismo contacto (email o RUT), para no duplicar el pipeline. */
async function findExistingLead(email?: string | null, rut?: string | null) {
  const keys: any[] = [];
  if (email?.trim()) keys.push(ilike(crmSeguimientoClientes.email, email.trim()));
  if (rut?.trim()) keys.push(eq(crmSeguimientoClientes.rut, rut.trim()));
  if (keys.length === 0) return null;

  const [existing] = await db
    .select()
    .from(crmSeguimientoClientes)
    .where(and(eq(crmSeguimientoClientes.active, true), or(...keys)!))
    .orderBy(desc(crmSeguimientoClientes.updatedAt))
    .limit(1);
  return existing || null;
}

/**
 * Crea (o actualiza) el lead del CRM a partir de una solicitud del cotizador
 * web. Devuelve el id del lead, o null si no se pudo crear.
 */
export async function syncQuoteRequestToCrm(request: QuoteRequest): Promise<string | null> {
  const segmento = getSegmentoCotizacionWeb(request.segmento);
  const items = (request.items as QuoteRequestItem[]) || [];
  const resumen = describeItems(items);
  const detalle = [
    `Cotización web (${items.length} producto${items.length === 1 ? '' : 's'})`,
    resumen,
    request.message ? `Mensaje: ${request.message}` : '',
  ].filter(Boolean).join('\n');

  const existing = await findExistingLead(request.visitorEmail, request.visitorRut);

  if (existing) {
    // Contacto ya en el pipeline: se refresca sin pisar la gestión del vendedor.
    await db.update(crmSeguimientoClientes)
      .set({
        etiquetas: withEtiquetaWeb(existing.etiquetas),
        segmento: existing.segmento || segmento?.crmSegmento || null,
        telefono: existing.telefono || request.visitorPhone || null,
        empresa: existing.empresa || request.visitorCompany || null,
        comuna: existing.comuna || request.visitorCity || null,
        ultimoContacto: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crmSeguimientoClientes.id, existing.id));

    await db.insert(crmSeguimientoHitos).values({
      seguimientoId: existing.id,
      tipo: 'cotizacion',
      descripcion: detalle,
      autorId: AUTOR_SISTEMA_ID,
      autorNombre: AUTOR_SISTEMA_NOMBRE,
      autoDetectado: true,
    });

    console.log(`[CRM] Cotización web ${request.id} sumada al lead existente ${existing.id} (${existing.nombre})`);
    return existing.id;
  }

  const owner = await resolveOwnerForSegmento(request.segmento);
  if (!owner) {
    console.warn(
      `[CRM] Sin encargado para el segmento "${request.segmento}" — el lead de ${request.visitorEmail} ` +
      `queda como "${VENDEDOR_SIN_ASIGNAR_NOMBRE}" y solo lo verá un admin. ` +
      `Configurar assigned_segment del área en salespeople_users.`
    );
  }

  // Vínculo con la base de clientes del ERP cuando el RUT calza.
  let clienteId: string | null = null;
  if (request.visitorRut?.trim()) {
    const [erpClient] = await db.select({ id: clients.id })
      .from(clients)
      .where(eq(clients.rten, request.visitorRut.trim()))
      .limit(1);
    if (erpClient) clienteId = erpClient.id;
  }

  const [created] = await db.insert(crmSeguimientoClientes).values({
    nombre: request.visitorName,
    telefono: request.visitorPhone || null,
    email: request.visitorEmail,
    empresa: request.visitorCompany || null,
    rut: request.visitorRut || null,
    comuna: request.visitorCity || null,
    clienteId,
    segmento: segmento?.crmSegmento || null,
    vendedorId: owner?.id || VENDEDOR_SIN_ASIGNAR_ID,
    vendedorNombre: owner?.name || VENDEDOR_SIN_ASIGNAR_NOMBRE,
    estado: 'cotizacion',
    // Catálogo vivo del alta del CRM (manual | digital_organico | digital_pagado):
    // 'web' quedó legacy y dejaría el Select del formulario en blanco.
    origen: 'digital_organico',
    etiquetas: JSON.stringify([ETIQUETA_COTIZACION_WEB]),
    notas: detalle,
    ultimoContacto: new Date(),
  }).returning();

  await db.insert(crmSeguimientoHitos).values({
    seguimientoId: created.id,
    tipo: 'cotizacion',
    descripcion: detalle,
    autorId: AUTOR_SISTEMA_ID,
    autorNombre: AUTOR_SISTEMA_NOMBRE,
    autoDetectado: true,
  });

  // Badge + push del Panel de Trabajo para el área que recibe el lead
  // (autor "system": el cotizador no tiene usuario).
  await logPanelChange(null, {
    section: 'crm',
    action: 'created',
    entityType: 'crm_cliente',
    entityId: created.id,
    title: `Cotización web de "${created.nombre}" ingresada al CRM`,
    segmento: normalizePanelSegmento(created.segmento),
  });

  console.log(
    `[CRM] Lead ${created.id} creado desde cotización web ${request.id} — ` +
    `segmento "${segmento?.crmSegmento || 'sin segmento'}", asignado a ${created.vendedorNombre}`
  );
  return created.id;
}

/**
 * Envuelve syncQuoteRequestToCrm: nunca lanza y deja el vínculo en
 * quote_requests.crm_seguimiento_id. Pensado para el POST público.
 */
export async function linkQuoteRequestToCrm(request: QuoteRequest): Promise<string | null> {
  try {
    const leadId = await syncQuoteRequestToCrm(request);
    if (leadId) {
      await db.update(quoteRequests)
        .set({ crmSeguimientoId: leadId, updatedAt: new Date() })
        .where(eq(quoteRequests.id, request.id));
    }
    return leadId;
  } catch (err: any) {
    console.error('[CRM] No se pudo llevar la cotización web al CRM:', err?.message || err);
    return null;
  }
}
