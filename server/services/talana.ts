/**
 * Cliente de la API de Talana (remuneraciones)
 * ---------------------------------------------------------------
 * Talana es el sistema donde Panorámica lleva contratos, días trabajados y
 * liquidaciones de sueldo. Este archivo es el ÚNICO lugar que habla HTTP con
 * Talana: el resto del módulo (server/routes-remuneraciones.ts) trabaja sobre
 * los tipos de acá.
 *
 * Autenticación: header `Authorization: Token <token>` con la cuenta de
 * integración (integracion-rem@pintureriapanoramica.cl). El token vive en la
 * variable de entorno TALANA_API_TOKEN — nunca en el código ni en la base.
 *
 * Lo que hay que saber de la API (verificado contra el ambiente real de
 * Panorámica, sep-2026):
 *
 * - `GET /periodos/` devuelve un ARRAY plano (sin paginar), del más nuevo al
 *   más viejo, con `cerrado` para saber si el mes ya se cerró.
 * - `GET /workedDays` pagina con `page`/`page_size` y SIEMPRE responde el
 *   período vigente: acepta `?periodo=` pero lo IGNORA (devuelve el mismo
 *   count). Por eso los días trabajados de un mes cerrado se leen del ítem
 *   `diasTrabajadosItem` de la liquidación, y workedDays solo se usa para el
 *   mes en curso, que todavía no tiene liquidación.
 * - `GET /liquidaciones/` pagina por CURSOR (`next` trae `?cursor=`), no por
 *   número de página, y sí filtra por `?periodo=`. Trae `sueldo`, `anticipo`
 *   y `finiquito` en la misma lista: hay que separar por `tipoLiquidacion`.
 * - `GET /contracts/` pagina con `page`/`page_size` y trae cargo, centro de
 *   costo, sucursal y sueldo base. `contract` (singular) está eliminado (410).
 *
 * Diseño defensivo: si el token no está configurado o Talana responde error,
 * se lanza `TalanaError` con un mensaje en español que la UI muestra tal cual.
 * El módulo NUNCA cae por una API externa caída: el endpoint responde 200 con
 * el cruce vacío y el detalle del problema (ver routes-remuneraciones.ts).
 */

const BASE_URL = (process.env.TALANA_API_BASE || 'https://talana.com/es/api').replace(/\/$/, '');
const TIMEOUT_MS = 25_000;

/** Cuánto se guarda en memoria cada respuesta. Los datos de sueldo cambian
 *  cuando RR.HH. edita la liquidación, no cada minuto: 10 min es suficiente
 *  para que abrir el módulo dos veces seguidas no golpee la API. */
const CACHE_TTL_MS = 10 * 60 * 1000;

export class TalanaError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TalanaError';
  }
}

export function talanaToken(): string {
  return (process.env.TALANA_API_TOKEN || '').trim();
}

export function talanaConfigurado(): boolean {
  return talanaToken().length > 0;
}

// ─── Tipos (solo los campos que usa el módulo) ──────────────────────────────

export interface TalanaEmpleado {
  id: number;
  rut: string;
  nombre: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  email: string | null;
}

export interface TalanaPeriodo {
  id: number;
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  mes: number;
  ano: number;
  cerrado: boolean;
}

export interface TalanaWorkedDay {
  id: number;
  idContrato: string;
  empleado: TalanaEmpleado;
  diasTrabajados: number;
  diasTrabajadosReales: number;
  fechaContratacion: string;
}

export interface TalanaLiquidacionItem {
  tipoItem: string;
  valor: number;
  glosa: string | null;
}

export interface TalanaLiquidacion {
  id: number;
  empleado: number;
  empleado_detalles?: TalanaEmpleado;
  tipoLiquidacion: 'sueldo' | 'anticipo' | 'finiquito' | string;
  periodo: number;
  estado: string; // 'cerrada' | 'aprobacion' | …
  contrato: number | null;
  items: TalanaLiquidacionItem[];
}

export interface TalanaContrato {
  id: number;
  empleado: number;
  empleadoDetails: TalanaEmpleado;
  cargo: string | null;
  fechaContratacion: string | null;
  finiquitado: boolean;
  activo: boolean;
  sueldoBase: number | null;
  centroCosto: { id: number; nombre: string | null; codigo: string | null } | null;
  sucursal: { id: number; nombre: string | null } | null;
  unidadOrganizacionalDetails: { id: number; nombre: string | null } | null;
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { at: number; data: any }>();

function fromCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

/** Vacía el caché (lo usa el botón "Actualizar desde Talana"). */
export function limpiarCacheTalana() {
  cache.clear();
}

async function request<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
  const token = talanaToken();
  if (!token) {
    throw new TalanaError(
      'Falta la variable de entorno TALANA_API_TOKEN: sin ella no se puede consultar Talana.',
    );
  }

  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new TalanaError(`Talana no respondió en ${TIMEOUT_MS / 1000}s (${path}).`);
    }
    throw new TalanaError(`No se pudo conectar con Talana: ${error?.message || 'error de red'}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new TalanaError('Talana rechazó el token (401/403). Revisa TALANA_API_TOKEN.', res.status);
  }
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => '');
    throw new TalanaError(
      `Talana respondió ${res.status} en ${path}${cuerpo ? `: ${cuerpo.slice(0, 200)}` : ''}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

interface Paginada<T> { count?: number; next: string | null; results: T[] }

/**
 * Recorre una lista paginada hasta el final. Sirve para las dos formas de
 * paginación de Talana (páginas numeradas y cursor) porque en ambas se sigue
 * la URL absoluta de `next`. El tope de páginas evita un bucle infinito si la
 * API devolviera un `next` que se apunta a sí mismo.
 */
async function fetchTodo<T>(path: string, query: Record<string, string | number> = {}, maxPaginas = 40): Promise<T[]> {
  const out: T[] = [];
  let page = await request<Paginada<T>>(path, { page_size: 200, ...query });
  out.push(...(page.results || []));
  let n = 1;
  while (page.next && n < maxPaginas) {
    page = await request<Paginada<T>>(page.next);
    out.push(...(page.results || []));
    n++;
  }
  return out;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/** Períodos de remuneración, del más nuevo al más viejo. */
export async function getPeriodos(): Promise<TalanaPeriodo[]> {
  const key = 'periodos';
  const hit = fromCache<TalanaPeriodo[]>(key);
  if (hit) return hit;
  // Este endpoint devuelve un array plano, no un objeto paginado.
  const data = await request<TalanaPeriodo[]>('/periodos/');
  const periodos = (Array.isArray(data) ? data : []).sort(
    (a, b) => b.ano - a.ano || b.mes - a.mes,
  );
  cache.set(key, { at: Date.now(), data: periodos });
  return periodos;
}

/**
 * Días trabajados por contrato. OJO: Talana solo responde el período VIGENTE
 * (ignora cualquier filtro de período), por eso no recibe argumentos.
 */
export async function getDiasTrabajados(): Promise<TalanaWorkedDay[]> {
  const key = 'workedDays';
  const hit = fromCache<TalanaWorkedDay[]>(key);
  if (hit) return hit;
  const data = await fetchTodo<TalanaWorkedDay>('/workedDays');
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Liquidaciones de un período (sueldos, anticipos y finiquitos). */
export async function getLiquidaciones(periodoId: number): Promise<TalanaLiquidacion[]> {
  const key = `liquidaciones:${periodoId}`;
  const hit = fromCache<TalanaLiquidacion[]>(key);
  if (hit) return hit;
  const data = await fetchTodo<TalanaLiquidacion>('/liquidaciones/', { periodo: periodoId });
  // Defensa: si la API ignorara el filtro, no mezclamos períodos en el cruce.
  const delPeriodo = data.filter((l) => Number(l.periodo) === Number(periodoId));
  cache.set(key, { at: Date.now(), data: delPeriodo });
  return delPeriodo;
}

/** Contratos (cargo, centro de costo, sucursal, sueldo base). */
export async function getContratos(): Promise<TalanaContrato[]> {
  const key = 'contracts';
  const hit = fromCache<TalanaContrato[]>(key);
  if (hit) return hit;
  const data = await fetchTodo<TalanaContrato>('/contracts/');
  cache.set(key, { at: Date.now(), data });
  return data;
}

// ─── Helpers de dominio ─────────────────────────────────────────────────────

/** Valor de un ítem de la liquidación (0 si no viene). */
export function item(liq: TalanaLiquidacion, tipo: string): number {
  const it = liq.items?.find((i) => i.tipoItem === tipo);
  const v = Number(it?.valor);
  return Number.isFinite(v) ? v : 0;
}

/** Suma de varios ítems (ej: Comision1 + Comision2). */
export function items(liq: TalanaLiquidacion, tipos: string[]): number {
  return tipos.reduce((acc, t) => acc + item(liq, t), 0);
}

/** Nombre completo de un empleado de Talana, listo para mostrar. */
export function nombreCompleto(e: Pick<TalanaEmpleado, 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'> | null | undefined): string {
  if (!e) return '';
  return [e.nombre, e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** RUT sin puntos ni guion y con K mayúscula, para comparar. */
export function rutNormalizado(rut: string | null | undefined): string {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}
