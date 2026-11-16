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
  segmentoCotizacionWebDeGestor,
  type SegmentoCotizacionWeb,
} from '@shared/segmentos-cotizacion-web';
import { logPanelChange, normalizePanelSegmento } from '../panel-changes';
import { EMPRESAS_EXTERNAS, empresaExternaDe } from '@shared/empresas-externas';

export type AccesoCotizacionesWeb =
  | { todos: true }
  | {
      todos: false;
      segmento: SegmentoCotizacionWeb | null;
      /**
       * Gestor del segmento (ver `gestores` en shared/segmentos-cotizacion-web.ts):
       * ve, asigna vendedor y cotiza (pone precios). Sin estado, notas ni eliminar.
       */
      soloAsigna?: boolean;
    };

/** Qué cotizaciones web puede ver el usuario. null = ninguna (rol sin acceso). */
export async function getAccesoCotizacionesWeb(user: any): Promise<AccesoCotizacionesWeb | null> {
  if (!user) return null;
  if (user.role === 'admin') return { todos: true };
  const gestionado = segmentoCotizacionWebDeGestor(user.email);
  if (gestionado) return { todos: false, segmento: gestionado, soloAsigna: true };
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
  return puedeVerCotizacionWeb(acceso, segmentoValue) && (!!acceso.soloAsigna || !!acceso.segmento?.asignaSupervisor);
}

/** Estado, notas y eliminar: todos menos el gestor del segmento. */
export function puedeEditarCotizacionWeb(acceso: AccesoCotizacionesWeb): boolean {
  return acceso.todos || !acceso.soloAsigna;
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
  // Los gestores del segmento también pueden quedarse con una cotización.
  const gestores = getSegmentoCotizacionWeb(segmentoValue)?.gestores ?? [];
  if (gestores.length > 0) {
    const extra = await db
      .select({ id: salespeopleUsers.id, nombre: salespeopleUsers.salespersonName, email: salespeopleUsers.email, role: salespeopleUsers.role })
      .from(salespeopleUsers)
      .where(and(activo, inArray(salespeopleUsers.email, gestores)));
    for (const g of extra) if (!filas.some(f => f.id === g.id)) filas.push(g);
  }
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

/**
 * Vendedor de una empresa externa que no tiene cuenta en la intranet: se guarda
 * en `assigned_to_user_id` como "erp:<empresa>:<código Random>" (ej. "erp:02:FHP").
 * Esa columna es una referencia blanda y nada más la lee como usuario.
 */
const PREFIJO_ERP = 'erp:';
const idVendedorErp = (empresa: string, codigo: string) => `${PREFIJO_ERP}${empresa}:${codigo}`;
function leerVendedorErp(id?: string | null): { empresa: string; codigo: string } | null {
  if (!id || !id.startsWith(PREFIJO_ERP)) return null;
  const [empresa, ...resto] = id.slice(PREFIJO_ERP.length).split(':');
  const codigo = resto.join(':');
  return empresa && codigo ? { empresa, codigo } : null;
}
export const esVendedorErp = (id?: string | null) => !!leerVendedorErp(id);

/** "FERNANDO HERRERA PINTO" → "Fernando Herrera Pinto". */
const nombrePropio = (s: string) =>
  s.toLowerCase().split(/\s+/).filter(Boolean).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

async function vendedoresErpDe(empresa: string) {
  const emp = EMPRESAS_EXTERNAS.find(e => e.codigo === empresa);
  if (!emp) return [];
  const { vendedoresEmpresaExterna } = await import('../routes-empresa-externa');
  return vendedoresEmpresaExterna(emp);
}

/**
 * Vendedores a los que el gestor de un segmento (Pablo Rossi) puede asignar.
 * Si trabaja con una empresa externa: los vendedores de esa empresa en Random
 * (sin cuenta en la intranet, elegidos por nombre). Además, los usuarios activos
 * que lo tienen como supervisor (salespeople_users.supervisor_id). Nunca los
 * vendedores de Panorámica.
 */
export async function vendedoresDelGestor(email?: string | null) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return [];
  const cols = {
    id: salespeopleUsers.id,
    nombre: salespeopleUsers.salespersonName,
    email: salespeopleUsers.email,
    role: salespeopleUsers.role,
  };
  const [gestor] = await db.select(cols).from(salespeopleUsers)
    .where(and(activo, eq(salespeopleUsers.email, e)))
    .limit(1);
  if (!gestor) return [];
  const equipo = (await db.select(cols).from(salespeopleUsers)
    .where(and(activo, eq(salespeopleUsers.supervisorId, gestor.id)))
    .orderBy(salespeopleUsers.salespersonName))
    .map(v => ({ ...v, nombreSistema: v.nombre, nombre: nombreVendedorCotizacionWeb(v.id, v.nombre) }));

  const empresa = empresaExternaDe(e);
  if (!empresa) {
    return [{ ...gestor, nombreSistema: gestor.nombre, nombre: nombreVendedorCotizacionWeb(gestor.id, gestor.nombre) }, ...equipo];
  }
  // La cuenta del gestor no va en la lista: su nombre es el de la empresa
  // ("PINTURERIA DEL SUR LIMITADA"); él mismo aparece como vendedor de Random.
  const delErp = (await vendedoresErpDe(empresa.codigo)).map(v => ({
    id: idVendedorErp(empresa.codigo, v.codigo),
    nombre: nombrePropio(v.nombre),
    nombreSistema: v.nombre,
    email: null as string | null,
    role: null as string | null,
  }));
  return [...delErp, ...equipo];
}

/**
 * Datos de pago y marca del PDF: si la cotización la cotizó (puso precios) un
 * usuario de una empresa externa, los de esa empresa; si no, ambos undefined =
 * los de Panorámica de siempre.
 */
export async function estiloPdfDeCotizacion(request: { pricedByUserId?: string | null }) {
  if (!request.pricedByUserId) return { pago: undefined, marca: undefined };
  const [quien] = await db.select({ email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.id, request.pricedByUserId))
    .limit(1);
  const empresa = empresaExternaDe(quien?.email);
  return { pago: empresa?.datosPago, marca: empresa?.marcaCotizacion };
}

/** Nombres de los vendedores asignados, para mostrarlos en el listado. */
export async function nombresVendedores(ids: string[]): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return new Map();
  const nombres = new Map<string, string>();

  // Vendedores de una empresa externa (sin cuenta): el nombre sale de Random.
  const deErp = unicos.filter(esVendedorErp);
  for (const empresa of Array.from(new Set(deErp.map(id => leerVendedorErp(id)!.empresa)))) {
    try {
      const lista = await vendedoresErpDe(empresa);
      for (const id of deErp) {
        const ref = leerVendedorErp(id)!;
        if (ref.empresa !== empresa) continue;
        const v = lista.find(x => x.codigo === ref.codigo);
        nombres.set(id, v ? nombrePropio(v.nombre) : ref.codigo);
      }
    } catch {
      // Random no respondió: se muestra el código antes que tumbar el listado.
      for (const id of deErp) nombres.set(id, leerVendedorErp(id)!.codigo);
    }
  }

  const deCuenta = unicos.filter(id => !esVendedorErp(id));
  if (deCuenta.length > 0) {
    const rows = await db
      .select({ id: salespeopleUsers.id, nombre: salespeopleUsers.salespersonName })
      .from(salespeopleUsers)
      .where(inArray(salespeopleUsers.id, deCuenta));
    for (const r of rows) nombres.set(r.id, nombreVendedorCotizacionWeb(r.id, r.nombre));
  }
  return nombres;
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
  // Un vendedor de empresa externa no tiene cuenta: el lead queda a nombre de
  // quien asignó (el gestor, p. ej. Pablo Rossi) y el hito dice a quién se le dio.
  const sinCuenta = esVendedorErp(vendedor.id);
  const crmVendedorId = sinCuenta ? String(user?.id || vendedor.id) : vendedor.id;
  const crmVendedorNombre = sinCuenta ? (user?.salespersonName || vendedor.nombreSistema) : vendedor.nombreSistema;
  if (request.crmSeguimientoId) {
    try {
      const [lead] = await db.select().from(crmSeguimientoClientes)
        .where(eq(crmSeguimientoClientes.id, request.crmSeguimientoId)).limit(1);
      if (lead && (lead.vendedorId !== crmVendedorId || sinCuenta)) {
        await db.update(crmSeguimientoClientes)
          // En el CRM va el nombre del sistema, igual que en el resto de sus leads.
          .set({ vendedorId: crmVendedorId, vendedorNombre: crmVendedorNombre, updatedAt: new Date() })
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
