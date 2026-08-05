// ═══════════════════════════════════════════════════════════════════════════
// LISTA DE PRECIOS EFECTIVA DE UN CLIENTE — fuente única
// ═══════════════════════════════════════════════════════════════════════════
// Todo lo que cotiza precios al cliente (catálogo de la tienda, búsqueda de
// códigos por SKU y el candado de precios del checkout) tiene que cobrar LA
// MISMA lista. Antes cada punto la resolvía por su cuenta y el catálogo además
// se fiaba del `?priceList=` que mandaba el navegador, así que era posible que
// la vitrina mostrara una lista y el checkout cobrara otra.
//
// Reglas:
//   1. Manda el override manual de la ficha (ficha_overrides.priceList), que el
//      ETL nunca pisa. Si la sucursal no tiene uno propio, hereda el de su casa
//      matriz: la lista se asigna una vez para la empresa y rige a todas sus
//      sucursales.
//   2. Si no hay override, se usa el lcen sincronizado desde Softland (propio o
//      el de la matriz).
//   3. La lista solo sirve si la intranet le puede poner precio: LP01 (lista
//      comercial, precio base de price_list) o una lista propia creada en el
//      módulo de Listas (custom_price_lists + sus ítems). Los códigos de lista
//      del ERP (TABPPPL1, etc.) NO tienen precios acá — el ETL no trae las
//      tablas de precio de Softland — así que no son cotizables: se cae a LP01
//      y se deja constancia (`usable: false`) para poder avisarlo en la ficha
//      en vez de mostrar una lista que en realidad no se está respetando.
import { sql } from 'drizzle-orm';
import { db } from './db';

export const DEFAULT_PRICE_LIST = 'LP01';

export type PriceListSource = 'override' | 'override-matriz' | 'erp' | 'erp-matriz' | 'default';

export interface ResolvedPriceList {
  /** Lista que se cobra de verdad. Siempre cotizable (LP01 o una lista propia). */
  code: string;
  /** Lo que dice la ficha del cliente (override manual o lcen del ERP). */
  assigned: string | null;
  /** De dónde salió `assigned`. */
  source: PriceListSource;
  /** false => `assigned` no existe en la intranet y se está cobrando `code`. */
  usable: boolean;
  /** Nombre legible de la lista cobrada, para mostrar en paneles. */
  name: string | null;
}

// ficha_overrides es JSONB y puede llegar como string (según el driver) u objeto.
export function parseFichaOverrides(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  if (typeof raw === 'object') return raw;
  return {};
}

/**
 * Lista de precios declarada en UNA fila de clients: override manual > lcen del
 * ERP. No mira la casa matriz ni valida que la lista sea cotizable — para eso
 * está `resolvePriceListForClient`.
 */
export function effectivePriceList(client: any): string | null {
  const ov = parseFichaOverrides(client?.fichaOverrides ?? client?.ficha_overrides);
  const override = typeof ov.priceList === 'string' ? ov.priceList.trim() : '';
  if (override) return override;
  const lcen = (client?.lcen && typeof client.lcen === 'string') ? client.lcen.trim() : '';
  return lcen || null;
}

const normalizeCode = (v: any) => (v == null ? '' : v.toString().trim().toUpperCase());

// ─── Listas cotizables (código -> nombre) ───
// Se consultan poco y cambian por acción manual de un admin, así que un caché
// corto evita una query por request del catálogo.
let listCache: { lists: Map<string, string>; at: number } | null = null;
const LIST_CACHE_TTL = 60_000;

export function invalidatePriceListCache() {
  listCache = null;
}

/** Códigos de lista que la intranet sabe cotizar, con su nombre para mostrar. */
export async function getQuotablePriceLists(): Promise<Map<string, string>> {
  if (listCache && Date.now() - listCache.at < LIST_CACHE_TTL) return listCache.lists;

  const lists = new Map<string, string>([[DEFAULT_PRICE_LIST, 'Lista Comercial']]);
  try {
    const res: any = await db.execute(sql`
      SELECT code, name FROM custom_price_lists WHERE active IS NOT FALSE
    `);
    const rows = Array.isArray(res) ? res : (res?.rows || []);
    for (const row of rows as any[]) {
      const code = normalizeCode(row.code);
      if (code) lists.set(code, (row.name || code).toString());
    }
    listCache = { lists, at: Date.now() };
  } catch (e) {
    // Sin el catálogo de listas seguimos cotizando en LP01 en vez de caernos.
    console.warn('[price-list] no se pudieron leer las listas de precios:', e);
  }
  return lists;
}

/**
 * Filas de clients que forman la empresa del cliente dado: él mismo, su casa
 * matriz y las sucursales de esa matriz. Se usa para heredar la lista asignada
 * a la matriz cuando la sucursal no tiene una propia.
 */
async function loadCompanyRows(client: any): Promise<any[]> {
  const ownId = (client?.id || '').toString();
  const rootId = (client?.parentClientId || client?.parent_client_id || ownId || '').toString();
  if (!ownId && !rootId) return [];
  try {
    const res: any = await db.execute(sql`
      SELECT id, parent_client_id, lcen, ficha_overrides
      FROM clients
      WHERE id = ${ownId} OR id = ${rootId} OR parent_client_id = ${rootId}
    `);
    return (Array.isArray(res) ? res : (res?.rows || [])) as any[];
  } catch (e) {
    console.warn('[price-list] no se pudo leer la empresa del cliente:', e);
    return [];
  }
}

/**
 * Resuelve qué lista de precios se le cobra a un cliente. `client` es una fila
 * de `clients` (camelCase de Drizzle o cruda de db.execute); null/undefined
 * (visitante anónimo) devuelve la lista comercial.
 */
export async function resolvePriceListForClient(client: any): Promise<ResolvedPriceList> {
  const quotable = await getQuotablePriceLists();
  const fallback: ResolvedPriceList = {
    code: DEFAULT_PRICE_LIST,
    assigned: null,
    source: 'default',
    usable: true,
    name: quotable.get(DEFAULT_PRICE_LIST) || 'Lista Comercial',
  };
  if (!client) return fallback;

  const ownId = (client.id || '').toString();
  const rootId = (client.parentClientId || client.parent_client_id || '').toString();

  // Candidatos en orden de precedencia. La matriz solo aporta si la sucursal no
  // trae lo suyo en ese mismo nivel (override antes que ERP, siempre).
  const ownOverride = parseFichaOverrides(client.fichaOverrides ?? client.ficha_overrides).priceList;
  const ownLcen = client.lcen;

  let matrizOverride: any = null;
  let matrizLcen: any = null;
  if (rootId && rootId !== ownId) {
    const rows = await loadCompanyRows(client);
    const matriz = rows.find((r: any) => (r.id || '').toString() === rootId);
    if (matriz) {
      matrizOverride = parseFichaOverrides(matriz.ficha_overrides).priceList;
      matrizLcen = matriz.lcen;
    }
  }

  const candidates: Array<{ raw: any; source: PriceListSource }> = [
    { raw: ownOverride, source: 'override' },
    { raw: matrizOverride, source: 'override-matriz' },
    { raw: ownLcen, source: 'erp' },
    { raw: matrizLcen, source: 'erp-matriz' },
  ];

  // `assigned` es el primer valor declarado (lo que muestra la ficha), aunque no
  // sea cotizable; `code` es el primero que la intranet sí sabe cobrar.
  let assigned: string | null = null;
  let assignedSource: PriceListSource = 'default';
  for (const { raw, source } of candidates) {
    const code = normalizeCode(raw);
    if (!code) continue;
    if (!assigned) { assigned = code; assignedSource = source; }
    if (quotable.has(code)) {
      return {
        code,
        assigned,
        source: assigned === code ? assignedSource : source,
        usable: assigned === code,
        name: quotable.get(code) || code,
      };
    }
  }

  return { ...fallback, assigned, source: assigned ? assignedSource : 'default', usable: !assigned };
}

/** Igual que `resolvePriceListForClient` pero partiendo del id de la fila. */
export async function resolvePriceListForClientId(clientId: string | null | undefined): Promise<ResolvedPriceList> {
  if (!clientId) return resolvePriceListForClient(null);
  try {
    const res: any = await db.execute(sql`
      SELECT id, parent_client_id, lcen, ficha_overrides
      FROM clients WHERE id = ${clientId} LIMIT 1
    `);
    const rows = Array.isArray(res) ? res : (res?.rows || []);
    return resolvePriceListForClient(rows[0] || null);
  } catch (e) {
    console.warn('[price-list] no se pudo leer el cliente', clientId, e);
    return resolvePriceListForClient(null);
  }
}
