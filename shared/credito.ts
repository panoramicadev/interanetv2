/**
 * LÍNEA DE CRÉDITO DE UN CLIENTE — fuente única.
 *
 * ── De qué columna del ERP sale ─────────────────────────────────────────────
 * En Softland el crédito de la ficha (dbo.MAEEN) no vive en una sola columna:
 * son cupos por instrumento de pago, y el total autorizado va aparte.
 *
 *   CRSD   cupo sin documentar (cuenta corriente)
 *   CRCH   cupo en cheques
 *   CRLT   cupo en letras
 *   CRPA   cupo en pagarés
 *   CRTO   TOTAL autorizado   ← esta es la línea de crédito
 *
 * Durante mucho tiempo la intranet leyó CRLT como límite (el comentario del
 * esquema decía "Credit limit total"). CRLT es el cupo en LETRAS y Panorámica
 * no vende con letras: viene en 0 en todas las fichas. Por eso el límite salía
 * $0, el disponible salía negativo con cualquier deuda, y de la pestaña Crédito
 * solo servían las facturas — lo único que sí se calculaba bien, porque la
 * deuda se saca de ventas.fact_ventas y no de la ficha.
 *
 * Muestra real al detectarlo (06-08-2026):
 *
 *   DISTRIBUIDORA DMS     CRSD   6.000.000  CRCH           0  CRLT 0  CRTO   6.000.000
 *   PINTURERÍA DEL SUR    CRSD 140.000.000  CRCH 150.000.000  CRLT 0  CRTO 140.000.000
 *   CONSTRUCTORA EBETESA  CRSD     250.000  CRCH     250.000  CRLT 0  CRTO     500.000
 *   CONSTRUCTORA AZAPA    CRSD           0  CRCH           0  CRLT 0  CRTO           0
 *
 * ── Quién manda ─────────────────────────────────────────────────────────────
 * Por defecto manda el ERP (CRTO). La intranet puede fijar una línea distinta
 * a mano en `ficha_overrides.creditLimit` — la misma columna JSONB donde vive
 * el override de lista de precios, que el ETL nunca pisa. Cuando hay override,
 * la ficha lo muestra MARCADO COMO MANUAL: quien lo mire tiene que poder
 * distinguir de un vistazo la línea que dice Softland de la que puso alguien
 * acá adentro, porque son responsabilidades distintas.
 *
 * Ni el checkout ni ningún otro flujo escriben las columnas CR* del ERP: son un
 * espejo de Softland y el ETL las vuelve a dejar como estaban.
 */

/** Ficha de cliente, en la forma mínima que hace falta para leer su línea. */
export interface FichaConCredito {
  /** clients.crto — cupo total autorizado en el ERP. */
  crto?: string | number | null;
  /** clients.ficha_overrides (JSONB) — puede llegar como objeto o como string. */
  fichaOverrides?: unknown;
  ficha_overrides?: unknown;
}

/** De dónde salió la línea que se está mostrando. */
export type OrigenLineaCredito = 'manual' | 'erp' | 'sin-linea';

export interface LineaCredito {
  /** La línea que rige. null = el cliente no tiene crédito (compra al contado). */
  limit: number | null;
  /** Lo que dice Softland, aunque haya override. Para poder contrastarlos. */
  erp: number | null;
  /** La línea fijada a mano en la intranet, si la hay. */
  override: number | null;
  origen: OrigenLineaCredito;
}

/** ficha_overrides es JSONB y, según el driver, llega como objeto o como string. */
function parseOverrides(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  if (typeof raw === 'object') return raw as Record<string, any>;
  return {};
}

/**
 * Monto positivo, o null.
 *
 * El ERP guarda 0 tanto para "nunca se le asignó" como para "se le dejó en
 * cero": en los dos casos el cliente compra al contado y no hay línea contra la
 * cual calcular un disponible. Devolver null (y no 0) es lo que evita que un
 * cliente de contado con una factura abierta aparezca como "crédito excedido",
 * que es ruido — para ese cliente lo que importa es el vencido.
 */
function montoONull(bruto: unknown): number | null {
  if (bruto == null || bruto === '') return null;
  const monto = Number(bruto);
  if (!Number.isFinite(monto) || monto <= 0) return null;
  return monto;
}

/** Resuelve la línea de crédito de una ficha: override manual > CRTO del ERP. */
export function resolverLineaCredito(ficha: FichaConCredito | null | undefined): LineaCredito {
  const erp = montoONull(ficha?.crto);
  const ov = parseOverrides(ficha?.fichaOverrides ?? ficha?.ficha_overrides);
  const override = montoONull(ov.creditLimit);
  const limit = override ?? erp;
  return {
    limit,
    erp,
    override,
    origen: override != null ? 'manual' : limit != null ? 'erp' : 'sin-linea',
  };
}

/** Atajo para cuando solo interesa el monto que rige. */
export function lineaDeCredito(ficha: FichaConCredito | null | undefined): number | null {
  return resolverLineaCredito(ficha).limit;
}
