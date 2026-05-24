// Vincula pedidos del e-commerce (Panorámica Market) con su documento NVV del
// ERP/SAP, completando `ecommerceOrders.erpIdmaeedo` (= idmaeedo de la NVV).
//
// El TMS (app de envíos) indexa cada despacho por ese idmaeedo, así que sin este
// puente la logística no puede consultar el estado real de entrega. El ERP no
// expone un vínculo directo con el pedido del Market, por eso lo inferimos por
// RUT del cliente + fecha + monto neto, de forma conservadora (ante ambigüedad o
// duda, no asignamos: es preferible un pedido sin idmaeedo a un idmaeedo errado).

import { sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { clients } from '@shared/schema';

const DAY = 24 * 60 * 60 * 1000;
// Ventana de fecha alrededor del ingreso del pedido donde esperamos que exista la
// NVV (suele emitirse el mismo día o pocos días alrededor del ingreso al ERP).
const WINDOW_BEFORE = 5 * DAY;
const WINDOW_AFTER = 45 * DAY;
const MONTO_TOLERANCE = 0.05; // 5% para cubrir redondeos y descuentos menores

const normalizeRut = (rut?: string | null): string =>
  rut ? rut.replace(/[.\-\s]/g, '').toUpperCase().trim() : '';

const toTime = (v: any): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

export interface OrderToMatch {
  id: string;
  clientId: string | null;
  subtotal: string | number | null; // neto (antes de IVA)
  total: string | number | null;    // bruto (con IVA 19%)
  createdAt: string | Date | null;
  ingresadoAt: string | Date | null;
}

interface NvvDoc {
  idmaeedo: string;
  rut: string;
  fecha: number | null;
  montoNeto: number;
}

/**
 * Empareja una tanda de pedidos con su NVV del ERP. Devuelve un Map orderId →
 * idmaeedo solo para los que matchean con confianza. No escribe en la base: el
 * caller decide cuándo persistir.
 */
export async function matchEcommerceOrdersToErp(
  orders: OrderToMatch[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const pending = orders.filter((o) => o.clientId);
  if (pending.length === 0) return result;

  // 1. Resolver el RUT (clients.rten) de cada cliente. El pedido referencia a
  //    users.id; clients.userId hace el puente al maestro de clientes del ERP.
  const clientIds = Array.from(new Set(pending.map((o) => String(o.clientId))));
  const rutByClientId = new Map<string, string>();
  try {
    const rows = await db
      .select({ userId: clients.userId, rten: clients.rten })
      .from(clients)
      .where(inArray(clients.userId, clientIds));
    for (const r of rows) {
      const rut = normalizeRut(r.rten as any);
      if (r.userId && rut) rutByClientId.set(String(r.userId), rut);
    }
  } catch (err: any) {
    console.error('[ERP-MATCH] error resolviendo RUTs de clientes:', err?.message || err);
    return result;
  }

  const ruts = Array.from(new Set(rutByClientId.values()));
  if (ruts.length === 0) return result;

  // 2. Traer las NVV ABIERTAS de esos RUTs, agrupadas por documento (idmaeedo).
  //    fact_nvv es a nivel de línea: sumamos `monto` (neto) por documento.
  const nvvByRut = new Map<string, NvvDoc[]>();
  try {
    const rutExpr = sql`REPLACE(REPLACE(REPLACE(UPPER(TRIM(endo)), '.', ''), '-', ''), ' ', '')`;
    const placeholders = sql.join(ruts.map((r) => sql`${r}`), sql`, `);
    const res: any = await db.execute(sql`
      SELECT
        idmaeedo::text AS idmaeedo,
        ${rutExpr} AS rut,
        MAX(feemdo)::text AS fecha,
        COALESCE(SUM(monto), 0)::numeric AS monto_neto
      FROM nvv.fact_nvv
      WHERE (eslido IS NULL OR TRIM(eslido) = '')
        AND idmaeedo IS NOT NULL
        AND ${rutExpr} IN (${placeholders})
      GROUP BY idmaeedo, ${rutExpr}
    `);
    const rows = Array.isArray(res) ? res : res?.rows || [];
    for (const r of rows) {
      const doc: NvvDoc = {
        idmaeedo: String(r.idmaeedo),
        rut: String(r.rut),
        fecha: toTime(r.fecha),
        montoNeto: Number(r.monto_neto) || 0,
      };
      const arr = nvvByRut.get(doc.rut) || [];
      arr.push(doc);
      nvvByRut.set(doc.rut, arr);
    }
  } catch (err: any) {
    console.error('[ERP-MATCH] error consultando NVV:', err?.message || err);
    return result;
  }

  // 3. Emparejar cada pedido con la NVV más probable (RUT + ventana de fecha +
  //    monto neto). Procesamos por fecha de referencia ascendente y no reutilizamos
  //    un mismo idmaeedo para dos pedidos distintos.
  const used = new Set<string>();
  const withRef = pending
    .map((o) => ({ o, ref: toTime(o.ingresadoAt) ?? toTime(o.createdAt) }))
    .sort((a, b) => (a.ref ?? 0) - (b.ref ?? 0));

  for (const { o, ref } of withRef) {
    const rut = rutByClientId.get(String(o.clientId));
    if (!rut) continue;
    const candidates = nvvByRut.get(rut);
    if (!candidates || candidates.length === 0) continue;

    // Comparamos en NETO: subtotal del pedido vs SUM(monto) de la NVV. Si no hay
    // subtotal, lo derivamos del total bruto (IVA 19%).
    const orderNeto = Number(o.subtotal) || (Number(o.total) ? Number(o.total) / 1.19 : 0);
    if (orderNeto <= 0) continue;

    let best: { doc: NvvDoc; montoDiff: number; fechaDiff: number } | null = null;
    for (const doc of candidates) {
      if (used.has(doc.idmaeedo)) continue;

      const montoDiff = Math.abs(doc.montoNeto - orderNeto) / orderNeto;
      if (montoDiff > MONTO_TOLERANCE) continue;

      let fechaDiff = 0;
      if (ref != null && doc.fecha != null) {
        const delta = doc.fecha - ref;
        if (delta < -WINDOW_BEFORE || delta > WINDOW_AFTER) continue;
        fechaDiff = Math.abs(delta);
      }

      if (
        !best ||
        montoDiff < best.montoDiff ||
        (montoDiff === best.montoDiff && fechaDiff < best.fechaDiff)
      ) {
        best = { doc, montoDiff, fechaDiff };
      }
    }

    if (best) {
      result.set(o.id, best.doc.idmaeedo);
      used.add(best.doc.idmaeedo);
    }
  }

  return result;
}
