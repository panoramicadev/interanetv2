/**
 * Permisos del asistente (MCP) por persona
 * ---------------------------------------------------------------
 * Cuando alguien conecta el asistente con su usuario (OAuth), la API externa
 * lo trataba con solo tres niveles (admin / lectura y escritura / solo
 * lectura): un vendedor veía finanzas, márgenes y comisiones de todos.
 *
 * Este módulo hace que el asistente respete lo mismo que la persona ve en su
 * menú de la intranet: los permisos de Configuración → Roles y Permisos,
 * con los ajustes propios de cada usuario (server/permissions.ts).
 *
 * - Cada ruta de /api/external se asocia a uno o más permisos (basta uno).
 *   Una ruta sin regla queda cerrada para todos menos el admin: así, una ruta
 *   nueva no se abre sola a todo el mundo.
 * - El admin pasa siempre. Las API keys compartidas (integraciones) no pasan
 *   por acá: las crea y administra el admin, y conservan su propio rol.
 * - Los vendedores (rol salesperson) además quedan acotados a sus propios
 *   datos en las consultas que filtran por vendedor (ver acotarVendedor).
 */
import type { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { salespeopleUsers } from '@shared/schema';
import { getEffectivePermissionsForUser } from './permissions';
import type { ApiAuthRequest } from './middleware/api-auth';

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface Regla {
  /** Prefijo o patrón de la ruta, relativa a /api/external */
  ruta: RegExp;
  /** Métodos a los que aplica. Sin métodos = todos. */
  metodos?: Metodo[];
  /** Permisos de Roles y Permisos que habilitan la ruta (basta uno). [] = todos. */
  permisos: string[];
  /** Nombre del módulo para el mensaje de "sin acceso" */
  modulo: string;
}

const LECTURA: Metodo[] = ['GET'];
const ESCRITURA: Metodo[] = ['POST', 'PATCH', 'PUT', 'DELETE'];

// El orden importa: gana la primera regla que calza. Las más específicas van
// antes que el prefijo general de su módulo.
const REGLAS: Regla[] = [
  // ── Comunes a todos ──
  { ruta: /^\/(openapi\.json|help)$/, permisos: [], modulo: 'Ayuda' },
  { ruta: /^\/notificaciones/, permisos: [], modulo: 'Notificaciones' },
  // El Panel de Trabajo (/tareas) no tiene permiso propio en la intranet.
  { ruta: /^\/tareas/, permisos: [], modulo: 'Panel de Trabajo' },
  // Se usa para resolver nombres de vendedores antes de escribir (CRM, cotizaciones).
  { ruta: /^\/usuarios$/, permisos: [], modulo: 'Usuarios' },

  // ── Administración ──
  { ruta: /^\/api-keys/, permisos: ['config.apikeys'], modulo: 'API Keys' },

  // ── Ventas y dashboard ──
  { ruta: /^\/(dashboard|ventas|gdv|gdv-pending|nvv)(\/|$)/, permisos: ['dashboard'], modulo: 'Dashboard y ventas' },

  // ── Márgenes ──
  // La tabla de catálogo precio-vs-costo y los costos GRI son costos de producto.
  { ruta: /^\/margenes\/(productos|agrupaciones|precios-gri)$/, permisos: ['productos.costos', 'margen'], modulo: 'Costos de productos' },
  { ruta: /^\/margenes/, permisos: ['margen'], modulo: 'Margen' },

  // ── Clientes ──
  { ruta: /^\/(clientes|puntos-de-venta)(\/|$)/, permisos: ['clientes'], modulo: 'Clientes' },
  { ruta: /^\/rutas-comerciales/, permisos: ['clientes', 'clientes.seguimiento'], modulo: 'Rutas de visita' },

  // ── CRM (Seguimiento de Clientes) ──
  { ruta: /^\/crm\//, permisos: ['clientes.seguimiento'], modulo: 'Seguimiento de Clientes (CRM)' },

  // ── Productos, precios y ofertas ──
  { ruta: /^\/productos\/[^/]+\/(precio|toggle-activo)$/, metodos: ESCRITURA, permisos: ['precios.editar'], modulo: 'Edición de precios' },
  { ruta: /^\/(listas-precio|ofertas-precio)/, metodos: ESCRITURA, permisos: ['precios.editar'], modulo: 'Edición de precios' },
  { ruta: /^\/(productos|listas-precio|ofertas-precio)(\/|$)/, metodos: LECTURA, permisos: ['productos', 'lista_precios', 'tomador_pedidos'], modulo: 'Productos y lista de precios' },
  { ruta: /^\/inventario$/, permisos: ['inventario'], modulo: 'Inventario' },

  // ── Cotizaciones y pedidos ──
  { ruta: /^\/(cotizaciones|ordenes)(\/|$)/, permisos: ['tomador_pedidos', 'market.pedidos'], modulo: 'Cotizaciones y pedidos' },
  { ruta: /^\/solicitudes-b2c/, permisos: ['market.pedidos', 'tomador_pedidos'], modulo: 'Cotizaciones Web' },
  { ruta: /^\/ecommerce\/erp-orders$/, permisos: ['seguimiento_pedidos', 'market.pedidos', 'dashboard'], modulo: 'Pedidos' },
  { ruta: /^\/ecommerce\//, permisos: ['market.pedidos'], modulo: 'Pedidos eCommerce' },

  // ── Logística ──
  { ruta: /^\/logistica\//, permisos: ['market.logistica', 'market.pedidos'], modulo: 'Logística' },

  // ── Post-venta ──
  { ruta: /^\/reclamos/, permisos: ['postventa.reclamos'], modulo: 'Reclamos' },
  { ruta: /^\/mantencion/, permisos: ['cmms.ordenes', 'cmms.dashboard'], modulo: 'Mantención' },

  // ── Módulos que el asistente usa tal cual la intranet (server/puente-intranet-mcp.ts) ──
  // Además de este filtro, cada ruta aplica sus propias reglas de la intranet.
  { ruta: /^\/intranet\/solicitudes-muestra/, permisos: ['solicitud_muestra', 'solicitud_muestra.bandeja', 'solicitud_muestra.gestion'], modulo: 'Solicitud de muestra' },
  { ruta: /^\/intranet\/solicitudes-credito/, permisos: ['solicitud_credito'], modulo: 'Solicitud de crédito' },
  { ruta: /^\/intranet\/(solicitudes-nuevo-cliente|nuevo-cliente)/, permisos: ['nuevo_cliente'], modulo: 'Nuevo cliente' },
  { ruta: /^\/intranet\/detalle-facturacion/, permisos: ['finanzas'], modulo: 'Detalle de facturación' },
  { ruta: /^\/intranet\/tintometria\/carta/, permisos: ['tintometria.carta'], modulo: 'Carta de colores' },
  { ruta: /^\/intranet\/tintometria\/libro/, permisos: ['tintometria.formulas', 'tintometria.admin'], modulo: 'Libro de fórmulas' },

  // ── Tintometría ──
  { ruta: /^\/tintometria\/calculate$/, permisos: ['tintometria.calculadora', 'tintometria.selector', 'tintometria.admin'], modulo: 'Calculadora de tintometría' },
  { ruta: /^\/tintometria\//, metodos: ESCRITURA, permisos: ['tintometria.admin'], modulo: 'Administración de tintometría' },
  { ruta: /^\/tintometria\/recetas/, permisos: ['tintometria.formulas'], modulo: 'Fórmulas de tintometría' },
  { ruta: /^\/tintometria\/colores/, permisos: ['tintometria.carta', 'tintometria.admin'], modulo: 'Carta de colores' },
  { ruta: /^\/tintometria\//, permisos: ['tintometria.admin', 'tintometria.calculadora'], modulo: 'Costos de tintometría' },
  { ruta: /^\/colores-paleta/, metodos: ESCRITURA, permisos: ['tintometria.admin'], modulo: 'Paleta de colores' },
  { ruta: /^\/colores-paleta/, permisos: ['tintometria.carta', 'tintometria.admin'], modulo: 'Paleta de colores' },

  // ── Marketing ──
  { ruta: /^\/marketing\//, permisos: ['marketing'], modulo: 'Marketing' },

  // ── Finanzas ──
  { ruta: /^\/finanzas\/(gastos|fondos)/, permisos: ['gastos'], modulo: 'Rendición de gastos' },
  { ruta: /^\/finanzas\/comisiones/, permisos: ['rrhh.comisiones'], modulo: 'Comisiones' },
  { ruta: /^\/finanzas\/metas/, metodos: LECTURA, permisos: ['config.metas', 'dashboard'], modulo: 'Metas' },
  { ruta: /^\/finanzas\/metas/, permisos: ['config.metas'], modulo: 'Metas' },
  { ruta: /^\/finanzas\/(presupuesto-ventas|proyecciones)/, permisos: ['finanzas', 'config.metas'], modulo: 'Presupuesto y proyecciones' },
  { ruta: /^\/finanzas\//, permisos: ['finanzas'], modulo: 'Finanzas' },
];

function reglaPara(metodo: string, ruta: string): Regla | null {
  const m = metodo.toUpperCase() as Metodo;
  for (const regla of REGLAS) {
    if (regla.metodos && !regla.metodos.includes(m)) continue;
    if (regla.ruta.test(ruta)) return regla;
  }
  return null;
}

/** ¿Estos permisos habilitan esta ruta? Sin regla = cerrada. */
export function rutaPermitida(metodo: string, ruta: string, permisos: Record<string, boolean>): boolean {
  const regla = reglaPara(metodo, ruta);
  if (!regla) return false;
  if (regla.permisos.length === 0) return true;
  return regla.permisos.some((p) => permisos[p]);
}

/**
 * Filtra el catálogo de /help ("GET /ruta/:id" → definición) dejando solo lo
 * que la persona puede usar. Los :parametros se reemplazan por un valor de
 * muestra para evaluar la regla.
 */
export function filtrarCatalogo<T>(catalogo: Record<string, T>, permisos: Record<string, boolean>): Record<string, T> {
  const salida: Record<string, T> = {};
  for (const [clave, valor] of Object.entries(catalogo)) {
    const [metodo, ruta] = clave.split(' ');
    if (!metodo || !ruta) continue;
    const muestra = ruta.replace(/:[A-Za-z]+/g, 'x');
    if (rutaPermitida(metodo, muestra, permisos)) salida[clave] = valor;
  }
  return salida;
}

/** Permisos efectivos de quien llama, o null si no aplica (admin o API key). */
export async function permisosDeQuienLlama(req: ApiAuthRequest): Promise<Record<string, boolean> | null> {
  const u = req.oauthUser;
  if (!u) return null;
  if (u.rolIntranet === 'admin') return null;
  const cache = (req as any)._permisosMcp as Record<string, boolean> | undefined;
  if (cache) return cache;
  const permisos = await getEffectivePermissionsForUser(u.email, u.rolIntranet);
  (req as any)._permisosMcp = permisos;
  return permisos;
}

/**
 * Middleware: corta con 403 lo que la persona no tiene en su menú.
 * Va después de validateApiKey.
 */
export async function exigirPermisoMcp(req: ApiAuthRequest, res: Response, next: NextFunction) {
  try {
    const permisos = await permisosDeQuienLlama(req);
    if (!permisos) return next();

    const regla = reglaPara(req.method, req.path);
    const permitido = !!regla && (regla.permisos.length === 0 || regla.permisos.some((p) => permisos[p]));
    if (permitido && esVendedor(req) && SOLO_EQUIPO.test(req.path)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Esta consulta compara a todo el equipo de ventas y no está disponible para vendedores. Puedes consultar tus propias ventas.',
        rol: req.oauthUser?.rolIntranet,
      });
    }
    if (permitido) {
      await acotarVendedor(req);
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: regla
        ? `No tienes acceso a "${regla.modulo}". Tu usuario no tiene este módulo en Roles y Permisos de la intranet; si lo necesitas, pídeselo a un administrador.`
        : 'Esta consulta está reservada para administradores.',
      modulo: regla?.modulo ?? null,
      rol: req.oauthUser?.rolIntranet,
    });
  } catch (error) {
    console.error('[permisos-mcp] error evaluando permisos:', error);
    // Si no se pueden leer los permisos se cierra, no se abre.
    return res.status(503).json({ error: 'No se pudieron verificar tus permisos. Intenta de nuevo en un momento.' });
  }
}

// ---------------------------------------------------------------------------
// Vendedores: solo sus propios datos
// ---------------------------------------------------------------------------

const esVendedor = (req: ApiAuthRequest) => req.oauthUser?.rolIntranet === 'salesperson';

// Consultas que muestran a todo el equipo por nombre y no aceptan filtro de
// vendedor: un vendedor no las ve (en la intranet tampoco ve el ranking).
const SOLO_EQUIPO = /^\/(ventas\/top-vendedores|crm\/seguimiento\/(por-vendedor|stats)|finanzas\/comisiones\/(summary|settings|overrides|salesperson\/.*))$/;

// Consultas cuyo filtro de vendedor se fija en el propio vendedor (ver acotarVendedor).
const ACOTADAS_A_VENDEDOR = /^\/(dashboard|ventas|gdv|gdv-pending|nvv|clientes|ecommerce\/erp-orders|cotizaciones$|crm\/leads$|ecommerce\/orders$|crm\/seguimiento$)(\/|$)/;

interface VinculoVendedor { id: string; nombre: string }

async function vinculoVendedor(req: ApiAuthRequest): Promise<VinculoVendedor | null> {
  const email = req.oauthUser?.email;
  if (!email) return null;
  const [fila] = await db
    .select({ id: salespeopleUsers.id, nombre: salespeopleUsers.salespersonName })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.email, email))
    .limit(1);
  if (!fila?.nombre) return null;
  return { id: fila.id, nombre: fila.nombre };
}

/**
 * Para el rol vendedor, pisa los filtros de vendedor de las consultas para
 * que siempre sean los suyos, igual que en la intranet. Un vendedor sin
 * vínculo en salespeople_users queda con un filtro que no calza con nada
 * (no ve datos de otros por accidente).
 */
async function acotarVendedor(req: ApiAuthRequest) {
  if (!esVendedor(req)) return;
  if (req.method !== 'GET') return;

  const ruta = req.path;
  // Solo se busca la ficha del vendedor si la consulta filtra por vendedor.
  if (!ACOTADAS_A_VENDEDOR.test(ruta)) return;
  const vinculo = await vinculoVendedor(req);
  const nombre = vinculo?.nombre ?? '__sin_vinculo__';
  const id = vinculo?.id ?? '__sin_vinculo__';
  const q = req.query as Record<string, unknown>;

  // Ventas, dashboard, clientes, GDV/NVV y pedidos del ERP filtran por nombre del vendedor.
  if (/^\/(dashboard|ventas|gdv|gdv-pending|nvv|clientes|ecommerce\/erp-orders)(\/|$)/.test(ruta)) {
    q.salesperson = nombre;
  }
  if (ruta === '/ventas/ficha-vendedor') {
    q.nombre = nombre;
    delete q.vendedor;
  }
  // Cotizaciones filtran por el nombre del vendedor.
  if (/^\/cotizaciones$/.test(ruta)) {
    q.salespersonName = nombre;
    delete q.createdBy;
  }
  // CRM y pedidos eCommerce filtran por el id del vendedor.
  if (ruta === '/crm/leads' || ruta === '/ecommerce/orders') {
    q.salespersonId = id;
  }
  if (ruta === '/crm/seguimiento') {
    q.vendedor = id;
  }
}
