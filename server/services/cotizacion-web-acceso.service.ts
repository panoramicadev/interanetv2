/**
 * cotizacion-web-acceso.service — Quién ve y quién reparte las Cotizaciones Web.
 *
 * - El admin ve todas y asigna vendedor en cualquier segmento.
 * - El supervisor ve solo las de su área (salespeople_users.assigned_segment,
 *   vinculado por email) y asigna vendedor solo si su segmento lo permite
 *   (`asignaSupervisor`: hoy Ferretería). Construcción e Industrial las asigna
 *   el admin.
 * - Nadie más entra (ni recepción ni encargados de área).
 *
 * Asignar deja la cotización en "Asignado" (si seguía pendiente), pasa el lead
 * del CRM al vendedor y le avisa por correo.
 */

import { db } from '../db';
import {
  quoteRequests,
  crmSeguimientoClientes,
  crmSeguimientoHitos,
  salespeopleUsers,
  type QuoteRequest,
  type QuoteRequestItem,
} from '@shared/schema';
import { and, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import {
  getSegmentoCotizacionWeb,
  nombreVendedorCotizacionWeb,
  segmentoCotizacionWebDeArea,
  type SegmentoCotizacionWeb,
} from '@shared/segmentos-cotizacion-web';
import { logPanelChange, normalizePanelSegmento } from '../panel-changes';

export type AccesoCotizacionesWeb =
  | { todos: true }
  | { todos: false; segmento: SegmentoCotizacionWeb | null };

/** Qué cotizaciones web puede ver el usuario. null = ninguna (rol sin acceso). */
export async function getAccesoCotizacionesWeb(user: any): Promise<AccesoCotizacionesWeb | null> {
  if (!user) return null;
  if (user.role === 'admin') return { todos: true };
  if (user.role !== 'supervisor' || !user.email) return null;

  const [sp] = await db
    .select({ assignedSegment: salespeopleUsers.assignedSegment })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.email, user.email))
    .limit(1);
  return { todos: false, segmento: segmentoCotizacionWebDeArea(sp?.assignedSegment) };
}

export function puedeVerCotizacionWeb(acceso: AccesoCotizacionesWeb, segmentoValue?: string | null): boolean {
  if (acceso.todos) return true;
  const seg = getSegmentoCotizacionWeb(segmentoValue);
  return !!acceso.segmento && !!seg && seg.value === acceso.segmento.value;
}

export function puedeAsignarCotizacionWeb(acceso: AccesoCotizacionesWeb, segmentoValue?: string | null): boolean {
  if (acceso.todos) return true;
  return puedeVerCotizacionWeb(acceso, segmentoValue) && !!acceso.segmento?.asignaSupervisor;
}

/** Filtra un listado según el acceso del usuario. */
export function filtrarCotizacionesWeb<T extends { segmento?: string | null }>(
  acceso: AccesoCotizacionesWeb,
  rows: T[],
): T[] {
  if (acceso.todos) return rows;
  return rows.filter(r => puedeVerCotizacionWeb(acceso, r.segmento));
}

const activo = or(eq(salespeopleUsers.isActive, true), isNull(salespeopleUsers.isActive))!;

/**
 * Vendedores a los que se le puede asignar una cotización del segmento: los del
 * área (por assigned_segment) y los equipos de sus supervisores. Sin segmento
 * reconocible, todos los vendedores activos (solo el admin llega a ese caso).
 */
export async function vendedoresParaSegmento(segmentoValue?: string | null) {
  const filas = await vendedoresParaSegmentoSinNombre(segmentoValue);
  // `nombre` es el visible (lista del segmento o capitalizado); `nombreSistema`
  // el de salespeople_users, que es el que se escribe en el CRM.
  return filas.map(v => ({ ...v, nombreSistema: v.nombre, nombre: nombreVendedorCotizacionWeb(v.id, v.nombre) }));
}

async function vendedoresParaSegmentoSinNombre(segmentoValue?: string | null) {
  const segmento = getSegmentoCotizacionWeb(segmentoValue);
  const rolesVenta = inArray(salespeopleUsers.role, ['salesperson', 'encargado_area', 'supervisor']);
  const cols = {
    id: salespeopleUsers.id,
    nombre: salespeopleUsers.salespersonName,
    email: salespeopleUsers.email,
    role: salespeopleUsers.role,
  };

  if (!segmento) {
    return db.select(cols).from(salespeopleUsers)
      .where(and(activo, rolesVenta))
      .orderBy(salespeopleUsers.salespersonName);
  }

  // Segmento con lista cerrada: solo esos, en el orden de la lista.
  if (segmento.vendedores?.length) {
    const ids = segmento.vendedores.map(v => v.id);
    const filas = await db.select(cols).from(salespeopleUsers)
      .where(and(activo, inArray(salespeopleUsers.id, ids)));
    return filas.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }

  const delArea = or(...segmento.assignedSegmentLike.map(p => ilike(salespeopleUsers.assignedSegment, p)))!;
  const supervisores = await db
    .select({ id: salespeopleUsers.id })
    .from(salespeopleUsers)
    .where(and(delArea, inArray(salespeopleUsers.role, ['supervisor', 'encargado_area'])));

  const condicion = supervisores.length > 0
    ? or(delArea, inArray(salespeopleUsers.supervisorId, supervisores.map(s => s.id)))!
    : delArea;

  return db.select(cols).from(salespeopleUsers)
    .where(and(activo, rolesVenta, condicion))
    .orderBy(salespeopleUsers.salespersonName);
}

/** Nombres de los vendedores asignados, para mostrarlos en el listado. */
export async function nombresVendedores(ids: string[]): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return new Map();
  const rows = await db
    .select({ id: salespeopleUsers.id, nombre: salespeopleUsers.salespersonName })
    .from(salespeopleUsers)
    .where(inArray(salespeopleUsers.id, unicos));
  return new Map(rows.map(r => [r.id, nombreVendedorCotizacionWeb(r.id, r.nombre)]));
}

function nombreUsuario(user: any): string {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Admin';
}

/**
 * Asigna el vendedor de una cotización web. Quien llama ya validó el permiso y
 * que el vendedor sea de la lista de vendedoresParaSegmento.
 */
export async function asignarVendedorCotizacionWeb(
  request: QuoteRequest,
  vendedor: { id: string; nombre: string; nombreSistema: string; email: string | null },
  user: any,
) {
  const [updated] = await db.update(quoteRequests)
    .set({
      assignedToUserId: vendedor.id,
      // Solo avanza desde Pendiente: reasignar una ya cotizada no la retrocede.
      ...(request.status === 'pending' ? { status: 'assigned' } : {}),
      updatedAt: new Date(),
    })
    .where(eq(quoteRequests.id, request.id))
    .returning();

  // El lead del CRM pasa al vendedor. Nunca tumba la asignación.
  if (request.crmSeguimientoId) {
    try {
      const [lead] = await db.select().from(crmSeguimientoClientes)
        .where(eq(crmSeguimientoClientes.id, request.crmSeguimientoId)).limit(1);
      if (lead && lead.vendedorId !== vendedor.id) {
        await db.update(crmSeguimientoClientes)
          // En el CRM va el nombre del sistema, igual que en el resto de sus leads.
          .set({ vendedorId: vendedor.id, vendedorNombre: vendedor.nombreSistema, updatedAt: new Date() })
          .where(eq(crmSeguimientoClientes.id, lead.id));
        await db.insert(crmSeguimientoHitos).values({
          seguimientoId: lead.id,
          tipo: 'sistema',
          descripcion: `Cotización web asignada: vendedor reasignado de "${lead.vendedorNombre}" a "${vendedor.nombre}"`,
          autorId: user?.id || 'sistema',
          autorNombre: nombreUsuario(user),
        });
        await logPanelChange(user, {
          section: 'crm',
          action: 'updated',
          entityType: 'crm_cliente',
          entityId: lead.id,
          title: `Cotización web de "${lead.nombre}" asignada a ${vendedor.nombre}`,
          segmento: normalizePanelSegmento(lead.segmento),
        });
      }
    } catch (err: any) {
      console.error('[CotizacionWeb] No se pudo reasignar el lead del CRM:', err?.message || err);
    }
  }

  // Correo al vendedor. Tampoco tumba la asignación.
  if (vendedor.email) {
    try {
      const { sendAutoCustomerEmail } = await import('../notifications-helper');
      const { buildLeadWebAsignadoEmail } = await import('../email-templates');
      const built = buildLeadWebAsignadoEmail({
        vendedorNombre: vendedor.nombre,
        asignadoPor: nombreUsuario(user),
        visitorName: request.visitorName,
        visitorEmail: request.visitorEmail,
        visitorPhone: request.visitorPhone,
        visitorCompany: request.visitorCompany,
        visitorCity: request.visitorCity,
        segmento: getSegmentoCotizacionWeb(request.segmento)?.crmSegmento ?? null,
        crmLeadId: request.crmSeguimientoId,
        message: request.message,
        items: ((request.items as QuoteRequestItem[]) || []),
      });
      await sendAutoCustomerEmail({
        notificationType: 'cotizacion_web_asignada',
        to: vendedor.email,
        subject: built.subject,
        html: built.html,
        force: true,
      });
    } catch (err: any) {
      console.warn('[CotizacionWeb] No se pudo enviar el correo al vendedor:', err?.message || err);
    }
  } else {
    console.warn(`[CotizacionWeb] ${vendedor.nombre} no tiene correo: no se le avisó la asignación`);
  }

  return updated;
}
