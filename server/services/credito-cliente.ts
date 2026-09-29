/**
 * CRÉDITO DE UN CLIENTE — el cálculo, en un solo lugar.
 *
 * Una sola respuesta con TODO el panorama de crédito de un cliente: la línea
 * asignada, la deuda, el vencido, el por vencer, el disponible, la antigüedad
 * de la deuda y el detalle de documentos.
 *
 * Lo consumen tres salidas que tienen que decir exactamente lo mismo:
 *  - la pestaña Crédito de la ficha y el panel de Cobranza del Panel de Trabajo
 *    (GET /api/clients/credito);
 *  - el estado de cuenta en PDF y Excel (services/estado-cuenta.ts);
 *  - el PDF que va adjunto en el correo de cobranza.
 * Por eso el cálculo vive aquí y no dentro de una ruta: si cada salida sumara
 * por su cuenta, el archivo que recibe el cliente podría no cuadrar con lo que
 * ve quien se lo manda.
 *
 * Todo sale de ventas.fact_ventas con el cálculo ya validado en la ficha:
 * saldo del documento = vabrdo - vaabdo, dedup por idmaeedo, solo documentos
 * pendientes (espgdo='P') de tipo FCV/FDV. La deuda NO se lee de las columnas
 * CR* de la ficha: esas son los CUPOS autorizados por instrumento de pago, no
 * lo que el cliente debe (ver shared/credito.ts). De clients solo se toma la
 * línea de crédito, los días de crédito (dccr) y los datos de contacto que
 * encabezan el estado de cuenta.
 *
 * Alcance: la empresa completa (casa matriz + sucursales que comparten nombre
 * o RUT), igual que el resto de la ficha.
 */
import { sql } from 'drizzle-orm';
import { resolverLineaCredito, type OrigenLineaCredito } from '@shared/credito';
import { db } from '../db';

export interface DocumentoCredito {
  nudo: string | null;
  tido: string | null;
  clientCode: string | null;
  emision: string | null;
  vencimiento: string | null;
  /** Monto total del documento (vabrdo). */
  facturado: number;
  /** Lo que ya se abonó al documento (vaabdo). */
  abonado: number;
  /** Lo que queda por pagar: facturado − abonado. */
  saldo: number;
  diasVencido: number;
  vencida: boolean;
}

export interface CreditoCliente {
  client: {
    id: string;
    clientCode: string | null;
    name: string | null;
    rut: string | null;
    paymentCondition: string | null;
    creditDays: number | null;
    salesRepCode: string | null;
    branchCount: number;
    address: string | null;
    comuna: string | null;
    city: string | null;
    phone: string | null;
  } | null;
  credit: {
    limit: number | null;
    /** 'manual' = la línea la fijó alguien en la intranet; 'erp' = viene de Softland (CRTO). */
    limitSource: OrigenLineaCredito;
    /** Lo que dice el ERP, aunque haya override manual. */
    limitErp: number | null;
    used: number;
    overdue: number;
    upcoming: number;
    available: number | null;
    exceeded: boolean;
    overdueSince: string | null;
    nextDueDate: string | null;
    documentCount: number;
    oldestOverdueDays: number | null;
  };
  aging: { porVencer: number; d1a30: number; d31a60: number; d61a90: number; d90mas: number };
  docs: DocumentoCredito[];
}

const filasDe = (resultado: any): any[] =>
  (Array.isArray(resultado) ? resultado : resultado?.rows || []) as any[];

const textoONull = (v: unknown): string | null => {
  const t = v == null ? '' : String(v).trim();
  return t === '' ? null : t;
};

/**
 * Crédito de un cliente buscado por nombre, por RUT o por los dos. Quien llama
 * valida que venga al menos uno: con los dos vacíos no hay a quién buscar.
 */
export async function obtenerCreditoCliente(filtro: {
  name?: string | null;
  rut?: string | null;
}): Promise<CreditoCliente> {
  const name = (filtro.name || '').trim();
  const rut = (filtro.rut || '').trim();

  const normalizeRut = (v?: string | null) => (v || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
  const upperName = name.toUpperCase();
  const cleanRut = normalizeRut(rut);

  // Filas de la empresa, casa matriz primero (misma regla que account-status).
  const fichaResult: any = await db.execute(sql`
    SELECT id, koen, nokoen, rten, cpen, crto, dccr, kofuen, parent_client_id, ficha_overrides,
           dien, comuna, cmen, foen
    FROM clients
    WHERE (${upperName} <> '' AND UPPER(TRIM(nokoen)) = ${upperName})
       OR (${cleanRut} <> '' AND REPLACE(REPLACE(REPLACE(UPPER(rten), '.', ''), '-', ''), ' ', '') = ${cleanRut})
    ORDER BY parent_client_id NULLS FIRST
  `);
  const fichaRows = filasDe(fichaResult);
  const principal = fichaRows[0] || null;
  const koens = Array.from(new Set(fichaRows.map((f) => f.koen).filter(Boolean))) as string[];

  // Línea de crédito: la de la casa matriz; si no tiene, la primera sucursal
  // que sí la tenga. Sin línea asignada queda en null (≠ límite cero).
  // El override manual de la ficha manda sobre el CRTO del ERP, y se informa
  // aparte para que el panel pueda marcarlo como manual.
  const linea = fichaRows.map(resolverLineaCredito).find((l) => l.limit != null)
    ?? resolverLineaCredito(principal);
  const limit = linea.limit;

  const client: CreditoCliente['client'] = principal
    ? {
        id: principal.id,
        clientCode: principal.koen ?? null,
        name: principal.nokoen ?? name,
        rut: principal.rten ?? null,
        paymentCondition: principal.cpen ?? null,
        creditDays: principal.dccr != null ? Number(principal.dccr) : null,
        salesRepCode: principal.kofuen ?? null,
        branchCount: fichaRows.length,
        address: textoONull(principal.dien),
        comuna: textoONull(principal.comuna),
        city: textoONull(principal.cmen),
        phone: textoONull(principal.foen),
      }
    : null;

  const vacio: CreditoCliente = {
    client,
    credit: {
      limit,
      // De dónde sale la línea: 'manual' si alguien la fijó en la intranet,
      // 'erp' si viene de Softland. limitErp deja ver el valor del ERP aunque
      // haya override, para poder contrastarlos en la ficha.
      limitSource: linea.origen,
      limitErp: linea.erp,
      used: 0, overdue: 0, upcoming: 0,
      available: limit != null ? limit : null,
      exceeded: false,
      overdueSince: null,
      nextDueDate: null,
      documentCount: 0,
      oldestOverdueDays: null,
    },
    aging: { porVencer: 0, d1a30: 0, d31a60: 0, d61a90: 0, d90mas: 0 },
    docs: [],
  };

  if (koens.length === 0) return vacio;

  const docsResult: any = await db.execute(sql`
    SELECT idmaeedo,
           MAX(nudo) AS nudo,
           MAX(tido) AS tido,
           MAX(endo) AS endo,
           MAX(feemdo) AS emision,
           MAX(fe01vedo) AS vencimiento,
           MAX(COALESCE(vabrdo, 0)) AS facturado,
           MAX(COALESCE(vaabdo, 0)) AS abonado,
           MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0)) AS saldo
    FROM ventas.fact_ventas
    WHERE endo IN (${sql.join(koens.map((k) => sql`${k}`), sql`, `)})
      AND tido IN ('FCV', 'FDV')
      AND espgdo = 'P'
    GROUP BY idmaeedo
    HAVING (MAX(COALESCE(vabrdo, 0)) - MAX(COALESCE(vaabdo, 0))) > 0
    ORDER BY MAX(fe01vedo) ASC NULLS LAST
  `);
  const docRows = filasDe(docsResult);

  const fmtDate = (v: any) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diasDesde = (fecha: string | null) => {
    if (!fecha) return null;
    const d = new Date(`${fecha}T00:00:00`);
    if (isNaN(d.getTime())) return null;
    return Math.floor((hoy.getTime() - d.getTime()) / 86_400_000);
  };

  const docs: DocumentoCredito[] = docRows.map((d) => {
    const vencimiento = fmtDate(d.vencimiento);
    const dias = diasDesde(vencimiento);
    // Sin fecha de vencimiento el documento cuenta como por vencer, no como
    // vencido: no hay evidencia de que se haya pasado la fecha.
    const vencida = dias != null && dias > 0;
    return {
      nudo: d.nudo != null ? String(d.nudo) : null,
      tido: d.tido ? String(d.tido).trim() : null,
      clientCode: d.endo ? String(d.endo).trim() : null,
      emision: fmtDate(d.emision),
      vencimiento,
      facturado: Number(d.facturado) || 0,
      abonado: Number(d.abonado) || 0,
      saldo: Number(d.saldo) || 0,
      diasVencido: vencida ? (dias as number) : 0,
      vencida,
    };
  });

  const suma = (f: (d: DocumentoCredito) => boolean) =>
    docs.filter(f).reduce((t, d) => t + d.saldo, 0);

  const used = suma(() => true);
  const overdue = suma((d) => d.vencida);
  const upcoming = suma((d) => !d.vencida);
  const vencidos = docs.filter((d) => d.vencida);
  const porVencerDocs = docs.filter((d) => !d.vencida && d.vencimiento);

  return {
    client,
    credit: {
      limit,
      limitSource: linea.origen,
      limitErp: linea.erp,
      used,
      overdue,
      upcoming,
      // Sin línea asignada no hay disponible que calcular.
      available: limit != null ? limit - used : null,
      exceeded: limit != null && used > limit,
      overdueSince: vencidos.length > 0 ? vencidos[0].vencimiento : null,
      nextDueDate: porVencerDocs.length > 0 ? porVencerDocs[0].vencimiento : null,
      documentCount: docs.length,
      oldestOverdueDays: vencidos.length > 0 ? Math.max(...vencidos.map((d) => d.diasVencido)) : null,
    },
    // Antigüedad de la deuda vencida, en tramos: para saber si lo vencido es
    // de la semana pasada o de hace tres meses.
    aging: {
      porVencer: upcoming,
      d1a30: suma((d) => d.vencida && d.diasVencido <= 30),
      d31a60: suma((d) => d.vencida && d.diasVencido > 30 && d.diasVencido <= 60),
      d61a90: suma((d) => d.vencida && d.diasVencido > 60 && d.diasVencido <= 90),
      d90mas: suma((d) => d.vencida && d.diasVencido > 90),
    },
    docs,
  };
}
