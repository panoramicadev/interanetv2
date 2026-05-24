// Cliente de solo-lectura para la API de logística de la app de envíos (TMS).
// Se activa solo si están las variables de entorno; mientras tanto degrada a null
// para que el seguimiento muestre el estado interno sin romperse.
//
//   TMS_API_BASE   p.ej. https://produccion.pinturaspanoramica.cl/api/external/v1
//   TMS_API_KEY    la API key que entrega la app de envíos
//   TMS_API_AUTH   "bearer" (default) | "apikey"  (cómo se manda la key)
//
// IMPORTANTE: el estado real de la orden vive en `orden.estado`
// ("Pendiente" | "En Preparación" | "Preparada" | "Listo para Despacho" |
//  "Despachado" | "Entregado" | "No Entregado"). El array `orden.entregas[]`
// trae el detalle del último tramo (operario, patente, fotos, motivo) y puede
// venir vacío aun cuando la orden ya está entregada (p.ej. retiro en bodega).

export interface EnvioVigente {
  estadoEntrega: string | null;
  horaEntrega: string | null;
  motivoRechazo: string | null;
  operario: string | null;
  patente: string | null;
  rutaEstado: string | null;
}

export interface EstadoLogistica {
  estadoPedido: string | null;
  envio: EnvioVigente | null;
  tieneFaltantes: boolean;
  backordersPendientes: number;
  retiroEnBodega: boolean;
}

// Resumen de orden tal cual lo expone el TMS en GET /logistica/ordenes.
export interface TmsOrderSummary {
  id: number;
  idErp: string;
  numeroDocumento: string | null;
  tipoDocumento: string | null;
  estado: string | null;
  fechaEmision: string | null;
  fechaCompromiso: string | null;
  fechaConfirmacionDespacho: string | null;
  esDespachoParcial: boolean;
  esBackorder: boolean;
  esRetiroCliente: boolean;
  fechaActualizacion: string | null;
  clienteIdErp: string | null;
  clienteNombre: string | null;
  clienteComuna: string | null;
  clienteRegion: string | null;
}

// Una entrega (último tramo) del detalle de la orden.
export interface TmsEntrega {
  estadoEntrega: string | null;
  horaEntrega: string | null;
  operarioNombre: string | null;
  rutaPatente: string | null;
  rutaEstado: string | null;
  direccionEntrega: string | null;
  motivoRechazo: string | null;
  fotoEvidenciaUrl: string | null;
  fotoFirmaUrl: string | null;
  creadoEn: string | null;
}

export interface TmsOrderItem {
  productoCodigo: string | null;
  productoNombre: string | null;
  unidad: string | null;
  cantidadPedida: number | null;
  cantidadDespachada: number | null;
  cantidadPendiente: number | null;
  estadoItem: string | null;
  motivoFaltante: string | null;
}

export interface TmsOrderDetail extends TmsOrderSummary {
  resumen: {
    totalItems: number;
    totalPedido: number;
    totalDespachado: number;
    tieneFaltantes: boolean;
    backordersPendientes: number;
  } | null;
  items: TmsOrderItem[];
  entregas: TmsEntrega[];
  backorders: any[];
}

// Etapas del recorrido en orden, para construir el timeline/stepper.
// "No Entregado" es un desvío terminal, no una etapa de la secuencia.
export const TMS_ETAPAS = [
  'Pendiente',
  'En Preparación',
  'Preparada',
  'Listo para Despacho',
  'Despachado',
  'Entregado',
] as const;

export function isTmsConfigured(): boolean {
  return !!process.env.TMS_API_BASE && !!process.env.TMS_API_KEY;
}

// Cache simple en memoria por path (incluye negativos como null) para no golpear
// el TMS en cada visita a la página de seguimiento.
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, { at: number; value: any }>();

function authHeaders(): Record<string, string> {
  const key = process.env.TMS_API_KEY as string;
  const mode = (process.env.TMS_API_AUTH || 'bearer').toLowerCase();
  return mode === 'apikey'
    ? { 'X-API-Key': key }
    : { Authorization: `Bearer ${key}` };
}

// GET genérico contra el TMS. Devuelve el JSON parseado o null (404 / error /
// credenciales). Cachea por path (incluye negativos) salvo que se pida saltarlo.
async function tmsGet<T = any>(path: string, useCache = true): Promise<T | null> {
  if (!isTmsConfigured()) return null;

  if (useCache) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T | null;
  }

  const base = (process.env.TMS_API_BASE as string).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: 'application/json', ...authHeaders() },
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.error(`[TMS] auth error ${res.status} en ${path}`);
      }
      if (useCache) cache.set(path, { at: Date.now(), value: null });
      return null;
    }

    const json = (await res.json()) as T;
    if (useCache) cache.set(path, { at: Date.now(), value: json });
    return json;
  } catch (err: any) {
    console.error(`[TMS] error en ${path}:`, err?.message || err);
    if (useCache) cache.set(path, { at: Date.now(), value: null });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Lista las órdenes de un cliente por su RUT (clienteIdErp). Pagina hasta un tope
// razonable para cubrir clientes con muchos documentos sin abusar del TMS.
export async function fetchTmsOrdersByClient(
  clienteIdErp: string,
): Promise<TmsOrderSummary[]> {
  if (!isTmsConfigured() || !clienteIdErp) return [];

  const rut = encodeURIComponent(clienteIdErp);
  const limit = 100;
  const MAX_PAGES = 10;
  const out: TmsOrderSummary[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * limit;
    const data = await tmsGet<{ data: TmsOrderSummary[]; pagination?: { total?: number } }>(
      `/logistica/ordenes?clienteIdErp=${rut}&limit=${limit}&offset=${offset}`,
    );
    const rows = data?.data ?? [];
    out.push(...rows);
    const total = data?.pagination?.total ?? out.length;
    if (rows.length < limit || out.length >= total) break;
  }

  return out;
}

// Detalle de una orden por su idErp (NO por el id interno del TMS).
export async function fetchTmsOrderDetail(idErp: string | number): Promise<TmsOrderDetail | null> {
  if (!isTmsConfigured() || idErp == null) return null;
  return tmsGet<TmsOrderDetail>(`/logistica/ordenes/${encodeURIComponent(String(idErp))}`);
}

// ---------------------------------------------------------------------------
// Espejo del TMS: listado global con filtros (estado/fecha/cliente) + KPIs.
// La API soporta ?estado=, ?fechaDesde=/&fechaHasta= y ?limit=/&offset=, y el
// total filtrado viene en pagination.total (lo usamos para los KPIs baratos).
// ---------------------------------------------------------------------------

export interface TmsOrdersQuery {
  estado?: string;
  clienteIdErp?: string;
  fechaDesde?: string; // YYYY-MM-DD (sobre fechaEmisión)
  fechaHasta?: string; // YYYY-MM-DD
  limit?: number;
  offset?: number;
}

export interface TmsListResult {
  data: TmsOrderSummary[];
  total: number;
  limit: number;
  offset: number;
}

// Todos los estados posibles (recorrido + el desvío No Entregado).
export const TMS_ESTADOS_ALL = [
  'Pendiente',
  'En Preparación',
  'Preparada',
  'Listo para Despacho',
  'Despachado',
  'Entregado',
  'No Entregado',
] as const;

function buildTmsQuery(q: TmsOrdersQuery): string {
  const p = new URLSearchParams();
  if (q.estado) p.set('estado', q.estado);
  if (q.clienteIdErp) p.set('clienteIdErp', q.clienteIdErp);
  if (q.fechaDesde) p.set('fechaDesde', q.fechaDesde);
  if (q.fechaHasta) p.set('fechaHasta', q.fechaHasta);
  if (q.limit != null) p.set('limit', String(q.limit));
  if (q.offset != null) p.set('offset', String(q.offset));
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Listado de órdenes del TMS con filtros y paginación.
export async function fetchTmsOrders(q: TmsOrdersQuery = {}): Promise<TmsListResult> {
  const fallback: TmsListResult = { data: [], total: 0, limit: q.limit ?? 0, offset: q.offset ?? 0 };
  if (!isTmsConfigured()) return fallback;
  const res = await tmsGet<{ data: TmsOrderSummary[]; pagination?: { total?: number; limit?: number; offset?: number } }>(
    `/logistica/ordenes${buildTmsQuery(q)}`,
  );
  if (!res) return fallback;
  return {
    data: res.data ?? [],
    total: res.pagination?.total ?? (res.data?.length ?? 0),
    limit: res.pagination?.limit ?? (q.limit ?? 0),
    offset: res.pagination?.offset ?? (q.offset ?? 0),
  };
}

// Conteo por estado para los KPIs: usa el total de la paginación con limit=1
// (1 request liviano por estado, cacheado). `base` permite acotar por fecha/cliente.
export async function fetchTmsEstadoCounts(
  base: { clienteIdErp?: string; fechaDesde?: string; fechaHasta?: string } = {},
): Promise<{ total: number; porEstado: Record<string, number> }> {
  if (!isTmsConfigured()) return { total: 0, porEstado: {} };
  const [totalRes, ...porEstadoRes] = await Promise.all([
    fetchTmsOrders({ ...base, limit: 1, offset: 0 }),
    ...TMS_ESTADOS_ALL.map((e) => fetchTmsOrders({ ...base, estado: e, limit: 1, offset: 0 })),
  ]);
  const porEstado: Record<string, number> = {};
  TMS_ESTADOS_ALL.forEach((e, i) => {
    porEstado[e] = porEstadoRes[i]?.total ?? 0;
  });
  return { total: totalRes.total, porEstado };
}

// Entrega vigente = la más reciente del array (si lo hay).
function pickEntregaVigente(entregas: any[]): EnvioVigente | null {
  if (!Array.isArray(entregas) || entregas.length === 0) return null;
  const vigente = [...entregas].sort(
    (a, b) => new Date(b?.creadoEn || 0).getTime() - new Date(a?.creadoEn || 0).getTime(),
  )[0];
  if (!vigente) return null;
  return {
    estadoEntrega: vigente.estadoEntrega ?? null,
    horaEntrega: vigente.horaEntrega ?? null,
    motivoRechazo: vigente.motivoRechazo ?? null,
    operario: vigente.operarioNombre ?? null,
    patente: vigente.rutaPatente ?? null,
    rutaEstado: vigente.rutaEstado ?? null,
  };
}

// Estado de entrega concluyente derivado de la orden. Preferimos el detalle del
// array entregas[]; si no aporta, lo derivamos de orden.estado (que es la fuente
// de verdad). Devuelve null cuando aún no es concluyente (en curso/preparación).
function deriveEnvioVigente(orden: any): EnvioVigente | null {
  const fromEntregas = pickEntregaVigente(orden?.entregas ?? []);
  if (fromEntregas?.estadoEntrega) return fromEntregas;

  const estado = orden?.estado;
  if (estado === 'Entregado' || estado === 'No Entregado') {
    return {
      estadoEntrega: estado,
      horaEntrega: fromEntregas?.horaEntrega ?? orden?.fechaConfirmacionDespacho ?? null,
      motivoRechazo: fromEntregas?.motivoRechazo ?? null,
      operario: fromEntregas?.operario ?? null,
      patente: fromEntregas?.patente ?? null,
      rutaEstado: fromEntregas?.rutaEstado ?? null,
    };
  }
  return fromEntregas; // puede ser null o traer datos de ruta sin estado concluyente
}

export async function fetchTmsShipping(idmaeedo: string | number): Promise<EstadoLogistica | null> {
  const orden = await fetchTmsOrderDetail(idmaeedo);
  if (!orden) return null;

  const resumen: any = (orden as any).resumen ?? {};
  return {
    estadoPedido: orden.estado ?? null,
    envio: deriveEnvioVigente(orden),
    tieneFaltantes: !!(resumen.tieneFaltantes ?? resumen.esDespachoParcial),
    backordersPendientes: Number(resumen.backordersPendientes ?? 0) || 0,
    retiroEnBodega: !!orden.esRetiroCliente,
  };
}
