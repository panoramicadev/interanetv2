// Cliente de solo-lectura para la API de logística de la app de envíos (TMS).
// Se activa solo si están las variables de entorno; mientras tanto degrada a null
// para que el seguimiento muestre el estado interno sin romperse.
//
//   TMS_API_BASE   p.ej. https://envios.pinturaspanoramica.cl/api/external/v1
//   TMS_API_KEY    la API key que entrega la app de envíos
//   TMS_API_AUTH   "bearer" (default) | "apikey"  (cómo se manda la key)

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

export function isTmsConfigured(): boolean {
  return !!process.env.TMS_API_BASE && !!process.env.TMS_API_KEY;
}

// Cache simple en memoria por idmaeedo (incluye negativos como null) para no
// golpear el TMS por cada visita a la página de seguimiento.
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, { at: number; value: EstadoLogistica | null }>();

function authHeaders(): Record<string, string> {
  const key = process.env.TMS_API_KEY as string;
  const mode = (process.env.TMS_API_AUTH || 'bearer').toLowerCase();
  return mode === 'apikey'
    ? { 'X-API-Key': key }
    : { Authorization: `Bearer ${key}` };
}

function pickEnvioVigente(entregas: any[]): EnvioVigente | null {
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

export async function fetchTmsShipping(idmaeedo: string | number): Promise<EstadoLogistica | null> {
  if (!isTmsConfigured() || idmaeedo == null) return null;

  const id = String(idmaeedo);
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const base = (process.env.TMS_API_BASE as string).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`${base}/logistica/ordenes/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json', ...authHeaders() },
      signal: controller.signal,
    });

    if (!res.ok) {
      // 404 = aún no está en logística; 401/403 = problema de credenciales.
      if (res.status === 401 || res.status === 403) {
        console.error(`[TMS] auth error ${res.status} consultando orden ${id}`);
      }
      cache.set(id, { at: Date.now(), value: null });
      return null;
    }

    const orden = await res.json();
    const resumen = orden?.resumen ?? {};
    const value: EstadoLogistica = {
      estadoPedido: orden?.estado ?? null,
      envio: pickEnvioVigente(orden?.entregas ?? []),
      tieneFaltantes: !!(resumen.tieneFaltantes ?? resumen.esDespachoParcial),
      backordersPendientes: Number(resumen.backordersPendientes ?? 0) || 0,
      retiroEnBodega: !!orden?.esRetiroCliente,
    };
    cache.set(id, { at: Date.now(), value });
    return value;
  } catch (err: any) {
    console.error(`[TMS] error consultando orden ${id}:`, err?.message || err);
    cache.set(id, { at: Date.now(), value: null });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
