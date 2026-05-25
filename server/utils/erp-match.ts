// Vincula pedidos del e-commerce (Panorámica Market) con su documento NVV del
// ERP/SAP, completando `ecommerceOrders.erpIdmaeedo` (= idmaeedo de la NVV).
//
// El TMS (app de envíos) indexa cada despacho por ese idmaeedo, así que sin este
// puente la logística no puede consultar el estado real de entrega. El ERP no
// expone un vínculo directo con el pedido del Market, por eso lo inferimos por
// RUT del cliente + fecha + monto neto, de forma conservadora (ante ambigüedad o
// duda, no asignamos: es preferible un pedido sin idmaeedo a un idmaeedo errado).

import { sql, inArray, eq } from 'drizzle-orm';
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

export interface FcvMatch {
  idmaeedo: string;   // id de cabecera de la FCV → se pasa a /api/erp/facturas/:idmaeedo/pdf
  nudo: string | null; // número/folio de la factura
  fecha: string | null;
  total: number;       // bruto (con IVA)
}

/**
 * Busca la FACTURA (FCV) del ERP que corresponde a un pedido del Market.
 *
 * El espejo no tiene el vínculo exacto pedido→factura (la cadena NVV→GDV→FCV de
 * Softland no está en `fact_ventas`), así que lo inferimos igual que la NVV: por
 * RUT del cliente + ventana de fecha + monto neto, de forma conservadora. Ante
 * ambigüedad o duda devolvemos null (preferible no mostrar factura a mostrar una
 * equivocada, que es un documento tributario). Mientras no exista el link exacto,
 * esto habilita el botón "Descargar factura" en el detalle del pedido.
 */
export async function findFcvForOrder(order: OrderToMatch): Promise<FcvMatch | null> {
  if (!order.clientId) return null;

  // 1. RUT del cliente (clients.rten vía clients.userId = pedido.clientId).
  let rut = '';
  try {
    const rows = await db
      .select({ rten: clients.rten })
      .from(clients)
      .where(eq(clients.userId, String(order.clientId)))
      .limit(1);
    rut = normalizeRut(rows[0]?.rten as any);
  } catch (err: any) {
    console.error('[ERP-MATCH/FCV] error resolviendo RUT:', err?.message || err);
    return null;
  }
  if (!rut) return null;

  // 2. FCV de ese RUT, agregadas por documento. vanedo/vabrdo son a nivel de
  //    documento (se repiten por línea) → MAX devuelve el total del documento.
  let docs: { idmaeedo: string; nudo: string | null; fecha: number | null; neto: number; bruto: number }[] = [];
  try {
    const rutExpr = sql`REPLACE(REPLACE(REPLACE(UPPER(TRIM(endo)), '.', ''), '-', ''), ' ', '')`;
    const res: any = await db.execute(sql`
      SELECT
        idmaeedo::text AS idmaeedo,
        MAX(nudo)::text AS nudo,
        MAX(feemdo)::text AS fecha,
        COALESCE(SUM(monto), MAX(vanedo), 0)::numeric AS neto,
        MAX(vabrdo)::numeric AS bruto
      FROM ventas.fact_ventas
      WHERE tido = 'FCV'
        AND idmaeedo IS NOT NULL
        AND ${rutExpr} = ${rut}
      GROUP BY idmaeedo
    `);
    const rows = Array.isArray(res) ? res : res?.rows || [];
    docs = rows.map((r: any) => ({
      idmaeedo: String(r.idmaeedo),
      nudo: r.nudo != null ? String(r.nudo) : null,
      fecha: toTime(r.fecha),
      neto: Number(r.neto) || 0,
      bruto: Number(r.bruto) || 0,
    }));
  } catch (err: any) {
    console.error('[ERP-MATCH/FCV] error consultando FCV:', err?.message || err);
    return null;
  }
  if (docs.length === 0) return null;

  // 3. Mejor candidata por monto neto (tolerancia) dentro de la ventana de fecha.
  const orderNeto = Number(order.subtotal) || (Number(order.total) ? Number(order.total) / 1.19 : 0);
  if (orderNeto <= 0) return null;
  const ref = toTime(order.ingresadoAt) ?? toTime(order.createdAt);

  let best: { doc: (typeof docs)[number]; montoDiff: number; fechaDiff: number } | null = null;
  for (const doc of docs) {
    if (doc.neto <= 0) continue;
    const montoDiff = Math.abs(doc.neto - orderNeto) / orderNeto;
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

  if (!best) return null;
  return {
    idmaeedo: best.doc.idmaeedo,
    nudo: best.doc.nudo,
    fecha: best.doc.fecha != null ? new Date(best.doc.fecha).toISOString() : null,
    total: best.doc.bruto || Math.round(best.doc.neto * 1.19),
  };
}
