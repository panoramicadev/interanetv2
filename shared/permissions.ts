/**
 * Sistema de Roles y Permisos
 * ---------------------------------------------------------------
 * Catálogo único de permisos por módulo y los permisos por defecto
 * de cada rol. Compartido entre server (enforcement) y client
 * (sidebar dinámico + gates de rutas).
 *
 * Semántica:
 * - Cada permiso representa un módulo/sección visible de la intranet
 *   (ítem del sidebar, ruta del frontend o pestaña de Configuración).
 * - Los defaults replican el acceso que cada rol tenía hard-coded
 *   antes de existir este sistema (SIDEBAR_CONFIG + gates de rutas).
 * - Los overrides guardados en la tabla role_permissions tienen
 *   prioridad sobre los defaults, clave por clave.
 * - El rol `admin` SIEMPRE tiene todos los permisos (no configurable,
 *   evita que un administrador se bloquee a sí mismo).
 * - El rol `client` usa el portal de tienda (otro layout) y queda
 *   fuera de este sistema.
 */

export interface PermissionDef {
  /** Clave estable que se persiste en DB. No renombrar. */
  key: string;
  label: string;
  description: string;
  /** Grupo para agrupar en la UI de administración */
  group: string;
  /** Ruta del frontend asociada (si el permiso corresponde a una página) */
  href?: string;
}

export interface PermissionGroupDef {
  key: string;
  label: string;
  description: string;
}

export const PERMISSION_GROUPS: PermissionGroupDef[] = [
  { key: "general", label: "General", description: "Acceso base a la intranet" },
  { key: "market", label: "Panorámica Market", description: "Módulos del eCommerce B2B/B2C" },
  { key: "comercial", label: "Comercial y Ventas", description: "Productos, clientes y pedidos" },
  { key: "finanzas", label: "Finanzas", description: "Facturación, márgenes, comisiones y gastos" },
  { key: "postventa", label: "Post-Venta", description: "Visitas técnicas y reclamos" },
  { key: "tintometria", label: "Tintometría", description: "Herramientas de color y costos" },
  { key: "mantencion", label: "Mantención (CMMS)", description: "Gestión de mantenimiento de planta" },
  { key: "administracion", label: "Administración", description: "Configuración del sistema (pestañas de Configuración)" },
];

export const PERMISSIONS: PermissionDef[] = [
  // ── General ──────────────────────────────────────────────────
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Panel principal con métricas (la vista depende del rol)",
    group: "general",
    href: "/",
  },

  // ── Panorámica Market ────────────────────────────────────────
  {
    key: "market.pedidos",
    label: "Pedidos Market",
    description: "Pedidos entrantes del eCommerce",
    group: "market",
    href: "/ecommerce-pedidos",
  },
  {
    key: "market.logistica",
    label: "Logística",
    description: "Rutas de despacho y entregas",
    group: "market",
    href: "/logistica-rutas",
  },
  {
    key: "market.donde_comprar",
    label: "Dónde Comprar",
    description: "Administración del mapa de puntos de venta",
    group: "market",
    href: "/donde-comprar-admin",
  },
  {
    key: "market.mailing",
    label: "Mailing",
    description: "Correos transaccionales a clientes (venta, cobranza, automatizaciones)",
    group: "market",
    href: "/mailing",
  },
  {
    key: "market.campanas",
    label: "Campañas Mailing",
    description: "Armar y enviar campañas de correo masivo (newsletters) a clientes, CRM, cotizador web, obras y listas propias",
    group: "market",
    href: "/campanas",
  },
  {
    key: "market.configuracion",
    label: "Configuración Market",
    description: "Catálogo, ofertas y ajustes del eCommerce",
    group: "market",
    href: "/ecommerce",
  },

  // ── Comercial y Ventas ───────────────────────────────────────
  {
    key: "productos",
    label: "Productos",
    description: "Lista de precios, catálogo e inventario",
    group: "comercial",
    href: "/productos",
  },
  {
    key: "productos.costos",
    label: "Costos y márgenes de productos",
    description: "Ver costos, márgenes y simulador dentro de Productos (sin esto se muestra la vista de vendedor)",
    group: "comercial",
  },
  // Lista de Precios e Inventario tienen permiso propio porque el vendedor
  // entra a las dos SIN tener el módulo Productos: su menú las lleva como
  // ítems de primer nivel (/lista-precios y /inventario), no como pestañas
  // de Productos. Los roles que ya tenían "productos" las conservan.
  {
    key: "lista_precios",
    label: "Lista de Precios",
    description: "Lista de precios comercial (sin costos ni márgenes si falta productos.costos)",
    group: "comercial",
    href: "/lista-precios",
  },
  {
    key: "precios.editar",
    label: "Editar precios",
    description: "Crear, editar y eliminar SKU, ofertas y listas de precios (sin esto la lista es de solo lectura)",
    group: "comercial",
  },
  {
    key: "inventario",
    label: "Inventarios",
    description: "Stock por bodega y disponibilidad de productos",
    group: "comercial",
    href: "/inventario",
  },
  {
    key: "clientes",
    label: "Clientes",
    description: "Listado y ficha de clientes",
    group: "comercial",
    href: "/clientes",
  },
  {
    key: "clientes.seguimiento",
    label: "Seguimiento de Clientes",
    description: "Seguimiento comercial de la cartera",
    group: "comercial",
    href: "/seguimiento-clientes",
  },
  {
    key: "clientes.ayuda_memoria",
    label: "Ayuda Memoria",
    description: "Resumen rápido de clientes para terreno",
    group: "comercial",
    href: "/ayuda-memoria",
  },
  {
    key: "tomador_pedidos",
    label: "Tomador de Pedidos",
    description: "Creación de pedidos y presupuestos",
    group: "comercial",
    href: "/tomador-pedidos",
  },
  {
    key: "seguimiento_pedidos",
    label: "Seguimiento de Pedidos",
    description: "Estado de pedidos (NVV → facturación → despacho)",
    group: "comercial",
    href: "/seguimiento-pedidos",
  },
  {
    key: "mis_pedidos",
    label: "Mis Pedidos",
    description: "Pedidos propios del usuario",
    group: "comercial",
    href: "/mis-pedidos",
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Panel de marketing y campañas",
    group: "comercial",
    href: "/marketing",
  },
  {
    key: "mi_catalogo",
    label: "Mi Catálogo (enlace público)",
    description: "Acceso al catálogo público personal del vendedor",
    group: "comercial",
  },

  // ── Finanzas ─────────────────────────────────────────────────
  {
    key: "finanzas",
    label: "Finanzas",
    description: "Facturas, notas de venta y documentos",
    group: "finanzas",
    href: "/facturas",
  },
  {
    key: "margen",
    label: "Margen",
    description: "Análisis de márgenes (información sensible)",
    group: "finanzas",
    href: "/margen",
  },
  // La clave sigue siendo "rrhh.comisiones" porque está persistida en
  // role_permissions y en los overrides por usuario: no se renombra. Vive en
  // Finanzas —junto a Margen, sobre el que se calcula— porque ahí es donde se
  // busca al configurar un rol; el grupo "rrhh" tenía este único módulo y
  // quedaba enterrado bajo las nueve filas de Mantención.
  {
    key: "rrhh.comisiones",
    label: "Comisiones de Vendedores",
    description: "Cálculo de comisiones por vendedor sobre el margen facturado (información sensible)",
    group: "finanzas",
    href: "/comisiones",
  },
  {
    key: "gastos",
    label: "Rendición de Gastos",
    description: "Rendición de gastos empresariales",
    group: "finanzas",
    href: "/gastos-empresariales",
  },
  {
    key: "solicitud_credito",
    label: "Solicitud de Crédito",
    description: "Pedir crédito para un cliente y seguir su resolución",
    group: "finanzas",
    href: "/solicitud-credito",
  },

  // ── Post-Venta ───────────────────────────────────────────────
  {
    key: "postventa.visitas",
    label: "Visitas Técnicas",
    description: "Programación y registro de visitas técnicas",
    group: "postventa",
    href: "/visitas-tecnicas",
  },
  {
    key: "postventa.reclamos",
    label: "Reclamos",
    description: "Gestión de reclamos generales",
    group: "postventa",
    href: "/reclamos-generales",
  },

  // ── Tintometría ──────────────────────────────────────────────
  {
    key: "tintometria.admin",
    label: "Administrar Datos",
    description: "Mantención de datos de tintometría",
    group: "tintometria",
    href: "/tintometria/admin",
  },
  {
    key: "tintometria.calculadora",
    label: "Calcular Costos",
    description: "Calculadora de costos de tintometría",
    group: "tintometria",
    href: "/tintometria/calculadora",
  },
  {
    key: "tintometria.selector",
    label: "Selector Visual",
    description: "Selector visual de colores",
    group: "tintometria",
    href: "/tintometria/selector",
  },

  // ── Mantención (CMMS) ────────────────────────────────────────
  {
    key: "cmms.dashboard",
    label: "Dashboard CMMS",
    description: "Métricas y estado general de mantención",
    group: "mantencion",
    href: "/cmms",
  },
  {
    key: "cmms.ordenes",
    label: "Órdenes de Trabajo",
    description: "Órdenes de trabajo de mantención",
    group: "mantencion",
    href: "/mantenciones",
  },
  {
    key: "cmms.mantenciones_planificadas",
    label: "Mantenciones Planificadas",
    description: "Planificación de mantenciones",
    group: "mantencion",
    href: "/cmms/mantenciones-planificadas",
  },
  {
    key: "cmms.planes_preventivos",
    label: "Planes Preventivos",
    description: "Planes de mantención preventiva",
    group: "mantencion",
    href: "/cmms/planes-preventivos",
  },
  {
    key: "cmms.equipos",
    label: "Equipos Críticos",
    description: "Gestión de equipos de planta",
    group: "mantencion",
    href: "/cmms/equipos",
  },
  {
    key: "cmms.proveedores",
    label: "Proveedores",
    description: "Proveedores de mantención",
    group: "mantencion",
    href: "/cmms/proveedores",
  },
  {
    key: "cmms.presupuesto",
    label: "Presupuesto",
    description: "Presupuesto de mantención",
    group: "mantencion",
    href: "/cmms/presupuesto",
  },
  {
    key: "cmms.gastos_materiales",
    label: "Gastos de Materiales",
    description: "Gastos de materiales de mantención",
    group: "mantencion",
    href: "/cmms/gastos-materiales",
  },
  {
    key: "cmms.calendario",
    label: "Calendario",
    description: "Calendario de mantenciones",
    group: "mantencion",
    href: "/cmms/calendario",
  },

  // ── Administración ───────────────────────────────────────────
  {
    key: "configuracion",
    label: "Configuración (acceso)",
    description: "Acceso a la página de Configuración (las pestañas se controlan con los permisos siguientes)",
    group: "administracion",
    href: "/configuracion",
  },
  {
    key: "config.usuarios",
    label: "Gestión de Usuarios",
    description: "Crear, editar y desactivar usuarios",
    group: "administracion",
    href: "/usuarios",
  },
  {
    key: "config.metas",
    label: "Gestión de Metas",
    description: "Metas de venta por vendedor/segmento",
    group: "administracion",
    href: "/metas",
  },
  {
    key: "etl_monitor",
    label: "Monitor ETL",
    description: "Estado de las sincronizaciones con el ERP",
    group: "administracion",
    href: "/etl-monitor",
  },
  {
    key: "config.apikeys",
    label: "API Keys",
    description: "Llaves de acceso programático (sensible)",
    group: "administracion",
    href: "/api-keys",
  },
  {
    key: "config.importar",
    label: "Importar Datos",
    description: "Importación manual de datos al sistema (sensible)",
    group: "administracion",
  },
  {
    key: "config.correos",
    label: "Configuración de Correos",
    description: "Notificaciones y plantillas de correo",
    group: "administracion",
  },
  {
    key: "config.whatsapp",
    label: "Configuración de WhatsApp",
    description: "Integración de WhatsApp",
    group: "administracion",
  },
  {
    key: "config.integraciones",
    label: "Integraciones",
    description: "Integraciones con servicios externos",
    group: "administracion",
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

const ALL_KEYS_SET = new Set(ALL_PERMISSION_KEYS);

export function isValidPermissionKey(key: string): boolean {
  return ALL_KEYS_SET.has(key);
}

/** Mapeo ruta del frontend → clave de permiso (para filtrar el sidebar) */
export const PERMISSION_BY_HREF: Record<string, string> = Object.fromEntries(
  PERMISSIONS.filter((p) => p.href).map((p) => [p.href as string, p.key]),
);

// El Tomador 2 (beta) reutiliza el mismo permiso que el tomador clásico:
// así se muestra/oculta para exactamente los mismos roles.
PERMISSION_BY_HREF["/tomador-pedidos-v2"] = "tomador_pedidos";

// Sub-secciones del módulo Marketing: son rutas propias en el sidebar, pero el
// acceso lo sigue gobernando el permiso del módulo. La única con permiso propio es
// Email Marketing, que ya tenía el suyo cuando vivía como página aparte (/campanas).
for (const seccion of ["hoy", "solicitudes", "mis-tareas", "inventario", "gastos", "presupuesto", "proveedores"]) {
  PERMISSION_BY_HREF[`/marketing/${seccion}`] = "marketing";
}
PERMISSION_BY_HREF["/marketing/email"] = "market.campanas";

/** Etiquetas legibles de cada rol */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  encargado_area: "Encargado de Área",
  salesperson: "Vendedor",
  tecnico_obra: "Técnico de Obra",
  reception: "Recepción",
  jefe_planta: "Jefe de Planta",
  mantencion: "Mantención",
  laboratorio: "Laboratorio",
  produccion: "Producción",
  logistica_bodega: "Logística y Bodega",
  planificacion: "Planificación",
  bodega_materias_primas: "Bodega Materias Primas",
  prevencion_riesgos: "Prevención de Riesgos",
  recursos_humanos: "Recursos Humanos",
  marketing: "Marketing",
  client: "Cliente",
  area_produccion: "Área Producción",
  area_logistica: "Área Logística",
  area_aplicacion: "Área Aplicación",
  area_materia_prima: "Área Materia Prima",
  area_colores: "Área Colores",
  area_envase: "Área Envase",
  area_etiqueta: "Área Etiqueta",
};

/**
 * Roles administrables desde la UI de Roles y Permisos, en orden de
 * presentación. `admin` se muestra pero bloqueado (acceso total fijo).
 * `client` queda fuera: usa el portal de tienda, no la intranet.
 */
export const CONFIGURABLE_ROLES: string[] = [
  "admin",
  "supervisor",
  "encargado_area",
  "salesperson",
  "tecnico_obra",
  "reception",
  "jefe_planta",
  "mantencion",
  "laboratorio",
  "produccion",
  "logistica_bodega",
  "planificacion",
  "bodega_materias_primas",
  "prevencion_riesgos",
  "recursos_humanos",
  "marketing",
  "area_produccion",
  "area_logistica",
  "area_aplicacion",
  "area_materia_prima",
  "area_colores",
  "area_envase",
  "area_etiqueta",
];

// Bloques reutilizables para defaults
const TINTOMETRIA_ALL = ["tintometria.admin", "tintometria.calculadora", "tintometria.selector"];
/**
 * Consulta de catálogo: acompaña SIEMPRE al permiso "productos".
 * Antes /lista-precios se cubría con "productos" y /inventario no tenía guard;
 * al darles clave propia, los roles que ya entraban las mantienen.
 */
const CATALOGO_CONSULTA = ["lista_precios", "inventario"];
const MARKET_ALL = [
  "market.pedidos",
  "market.logistica",
  "market.donde_comprar",
  "market.mailing",
  "market.configuracion",
];
const CMMS_FULL = [
  "cmms.dashboard",
  "cmms.ordenes",
  "cmms.mantenciones_planificadas",
  "cmms.planes_preventivos",
  "cmms.equipos",
  "cmms.proveedores",
  "cmms.presupuesto",
  "cmms.gastos_materiales",
  "cmms.calendario",
];
const CMMS_BASICO = ["cmms.ordenes", "cmms.calendario"];
const CONFIG_TABS_GESTION = [
  "configuracion",
  "config.usuarios",
  "config.metas",
  "etl_monitor",
  "config.correos",
  "config.whatsapp",
  "config.integraciones",
];

/**
 * Permisos por defecto de cada rol. Replican el acceso previo a este
 * sistema (SIDEBAR_CONFIG + gates de rutas), con dos excepciones
 * deliberadas por seguridad: "API Keys" e "Importar Datos" quedan por
 * defecto solo para admin (antes supervisor/encargado_area veían esas
 * pestañas). Un admin puede re-otorgarlos desde Roles y Permisos.
 *
 * `admin` no aparece: siempre tiene todo (hard-coded en server y client).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  // El menú del supervisor es el mismo del administrador
  // (SUPERVISOR_SIDEBAR_POR_SEGMENTO), así que necesita los permisos de los
  // módulos que ese menú muestra: por eso entran "margen" —que el módulo
  // documenta como de admin y supervisor— y "market.campanas", el Email
  // Marketing que vive como sub-sección del módulo Marketing.
  //
  // "rrhh.comisiones" entra por decisión explícita: el menú tiene que quedar
  // igual al del admin, Comisiones incluido. Es información sensible
  // (comisión por vendedor sobre margen facturado), así que si más adelante se
  // quiere cerrar, se desactiva para el rol en Configuración → Roles y
  // Permisos sin tocar código.
  supervisor: [
    "dashboard",
    "solicitud_credito",
    ...MARKET_ALL,
    "productos",
    ...CATALOGO_CONSULTA,
    "productos.costos",
    "precios.editar",
    "clientes",
    "finanzas",
    "margen",
    "marketing",
    "market.campanas",
    "rrhh.comisiones",
    "tomador_pedidos",
    "postventa.visitas",
    "postventa.reclamos",
    "cmms.dashboard",
    ...CMMS_BASICO,
    "gastos",
    ...TINTOMETRIA_ALL,
    ...CONFIG_TABS_GESTION,
  ],
  encargado_area: [
    "dashboard",
    "solicitud_credito",
    ...MARKET_ALL,
    "productos",
    ...CATALOGO_CONSULTA,
    "productos.costos",
    "precios.editar",
    "clientes",
    "finanzas",
    "tomador_pedidos",
    "gastos",
    ...CONFIG_TABS_GESTION,
  ],
  // Menú estandarizado del vendedor: Dashboard → Tomador de Pedidos → Panel de
  // Trabajo → Lista de Precios → Inventarios → Rendición de Gastos → Solicitud
  // de Crédito → Reclamos → Pedidos. Sale el módulo Productos (entra solo a
  // Lista de Precios e Inventario), sale Marketing y sale el ítem Clientes.
  //
  // "clientes" SE CONSERVA como permiso aunque no esté en el menú: el vendedor
  // llega a la ficha del cliente desde su Panel de Trabajo (Obras), y de ahí
  // cuelgan la bitácora y la cobranza. El ítem de primer nivel se oculta en
  // client/src/lib/sidebar-permissions.ts (EXTRAS_OCULTOS_POR_ROL).
  salesperson: [
    "dashboard",
    "solicitud_credito",
    "clientes",
    ...CATALOGO_CONSULTA,
    "seguimiento_pedidos",
    "tomador_pedidos",
    "postventa.reclamos",
    "gastos",
  ],
  tecnico_obra: [
    "postventa.visitas",
    "postventa.reclamos",
    "clientes",
    "gastos",
  ],
  // Recepción administra la lista de precios: crea SKU, edita precios y arma
  // ofertas por cliente (las que después ve ese cliente en su tienda). Por eso
  // lleva "precios.editar" y ve costos y márgenes como un supervisor.
  reception: [
    "dashboard",
    ...MARKET_ALL,
    "productos",
    ...CATALOGO_CONSULTA,
    "productos.costos",
    "precios.editar",
    "clientes",
    "finanzas",
    "gastos",
  ],
  jefe_planta: [
    "dashboard",
    "postventa.visitas",
    "postventa.reclamos",
    "productos",
    ...CATALOGO_CONSULTA,
    ...CMMS_FULL,
    ...TINTOMETRIA_ALL,
    "gastos",
  ],
  mantencion: [
    "cmms.dashboard",
    "cmms.ordenes",
    "cmms.mantenciones_planificadas",
    "cmms.planes_preventivos",
    "cmms.calendario",
    "gastos",
  ],
  laboratorio: [
    "postventa.reclamos",
    "postventa.visitas",
    "productos",
    ...CATALOGO_CONSULTA,
    ...TINTOMETRIA_ALL,
    "gastos",
  ],
  produccion: [
    "postventa.reclamos",
    ...CMMS_BASICO,
    "productos",
    ...CATALOGO_CONSULTA,
    "gastos",
  ],
  logistica_bodega: [
    "dashboard",
    "finanzas",
    "productos",
    ...CATALOGO_CONSULTA,
    "postventa.reclamos",
    ...CMMS_BASICO,
    "gastos",
  ],
  planificacion: ["postventa.reclamos", ...CMMS_BASICO, "gastos"],
  bodega_materias_primas: ["postventa.reclamos", ...CMMS_BASICO, "gastos"],
  prevencion_riesgos: ["postventa.reclamos", "gastos"],
  recursos_humanos: ["rrhh.comisiones", "gastos", "solicitud_credito"],
  marketing: ["marketing", "market.campanas", "gastos"],
  area_produccion: ["postventa.reclamos", "gastos"],
  area_logistica: ["postventa.reclamos", "gastos"],
  area_aplicacion: ["postventa.reclamos", "gastos"],
  area_materia_prima: ["postventa.reclamos", "gastos"],
  area_colores: ["postventa.reclamos", "gastos"],
  area_envase: ["postventa.reclamos", "gastos"],
  area_etiqueta: ["postventa.reclamos", "gastos"],
  // Rol client: portal de tienda; estos permisos solo afectan rutas
  // del dashboard interno que comparte (no tiene UI de configuración).
  client: ["mis_pedidos", ...TINTOMETRIA_ALL],
};

/** Set de permisos por defecto de un rol (admin → todos) */
export function getDefaultPermissionsForRole(role: string): Set<string> {
  if (role === "admin") return new Set(ALL_PERMISSION_KEYS);
  return new Set(DEFAULT_ROLE_PERMISSIONS[role] || []);
}

/**
 * Calcula el mapa efectivo clave→permitido de un rol combinando
 * defaults con overrides persistidos (los overrides mandan).
 */
export function computeEffectivePermissions(
  role: string,
  overrides?: Record<string, boolean> | null,
): Record<string, boolean> {
  const defaults = getDefaultPermissionsForRole(role);
  const effective: Record<string, boolean> = {};
  for (const key of ALL_PERMISSION_KEYS) {
    if (role === "admin") {
      effective[key] = true;
    } else if (overrides && key in overrides) {
      effective[key] = !!overrides[key];
    } else {
      effective[key] = defaults.has(key);
    }
  }
  return effective;
}
