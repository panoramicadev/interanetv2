import {
  LayoutDashboard,
  Users,
  User,
  Target,
  Package,
  FileText,
  Settings,
  ShoppingCart,
  Palette,

  ClipboardCheck,
  CheckSquare,
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle2,
  FileCheck,
  ChevronDown,
  PaintBucket,
  Building2,
  Wrench,
  AlertTriangle,
  Warehouse,
  Banknote,
  Bell,
  Key,
  Calendar,
  ExternalLink,
  FileSpreadsheet,
  Gift,
  PackageSearch,
  Truck,
  UserCheck,
  BookOpen,
  MapPin,
  Mail,
  Send,
  CalendarClock,
  Inbox
} from "lucide-react";

export interface SidebarItem {
  href: string;
  label: string;
  icon: any;
  disabled?: boolean;
  comingSoon?: boolean;
  separator?: boolean; // Para mostrar separador después del item
  children?: SidebarItem[]; // Para submenús desplegables
  isExternalCatalog?: boolean; // Para el enlace dinámico al catálogo público
  isPremium?: boolean; // Para items con estilo dorado premium (ej: Panorámica Market)
}

/**
 * Sub-secciones del módulo Marketing.
 *
 * Viven acá, en el sidebar de la app, y no en un segundo menú dentro de la página:
 * son rutas reales (`/marketing/...`), así el ítem activo se resuelve por URL como
 * en cualquier otro módulo y un enlace se puede compartir.
 *
 * El orden es el del trabajo: primero lo que hay que hacer hoy, después la bandeja
 * de lo que llega desde otros departamentos, después lo propio, y al final la parte
 * administrativa del área.
 */
const MARKETING_CHILDREN: SidebarItem[] = [
  { href: "/marketing/hoy", label: "Hoy", icon: CalendarClock },
  { href: "/marketing/solicitudes", label: "Solicitudes", icon: Inbox },
  { href: "/marketing/mis-tareas", label: "Mis tareas", icon: CheckSquare },
  { href: "/marketing/email", label: "Email Marketing", icon: Send },
  { href: "/marketing/inventario", label: "Inventario", icon: Package },
  { href: "/marketing/gastos", label: "Gastos", icon: Receipt },
  { href: "/marketing/presupuesto", label: "Presupuesto", icon: DollarSign },
  { href: "/marketing/proveedores", label: "Proveedores", icon: Users },
];

/** Copia fresca de las sub-secciones (el sidebar final se arma y filtra por rol). */
export const marketingChildren = (): SidebarItem[] => MARKETING_CHILDREN.map((c) => ({ ...c }));

/**
 * Copia profunda de una lista de ítems (ítem + sus hijos).
 *
 * Hace falta porque `buildSidebarItems` muta los ítems que recibe (les agrega
 * hijos al fusionar los "extras"): si dos roles compartieran el mismo objeto,
 * lo que se le agrega a uno se le aparecería al otro.
 */
export const cloneSidebarItems = (items: SidebarItem[]): SidebarItem[] =>
  items.map((item) => ({
    ...item,
    ...(item.children ? { children: cloneSidebarItems(item.children) } : {}),
  }));

/** Ítem de Marketing completo, con sus sub-secciones. */
export const marketingSidebarItem = (extra: Partial<SidebarItem> = {}): SidebarItem => ({
  href: "/marketing",
  label: "Marketing",
  icon: TrendingUp,
  children: marketingChildren(),
  ...extra,
});

/**
 * Mantención (CMMS) salió del sidebar de TODOS los roles.
 *
 * El módulo está marcado para eliminarse: se oculta primero el acceso —el ítem
 * "Mantención" y todo su desplegable— y recién después se borra el código, para
 * poder volver atrás con un solo commit si alguien todavía lo estaba usando.
 *
 * Lo que NO cambió: las rutas `/mantenciones` y `/cmms/*` siguen registradas en
 * App.tsx, los permisos `cmms.*` siguen gobernando el acceso y las tablas siguen
 * en la base. Quien tenga el link entra igual; solo desaparece el acceso del menú.
 *
 * El inventario completo de lo que hay que borrar cuando se confirme la baja está
 * en DEPRECAR-MANTENCION.md (raíz del repo).
 */

/**
 * Menú del administrador: la referencia curada del sistema.
 *
 * Vive afuera de SIDEBAR_CONFIG porque no lo usa solo el admin: el supervisor
 * monta exactamente este mismo menú (ver SUPERVISOR_SIDEBAR_POR_SEGMENTO). Se
 * consume siempre por `adminSidebarItems()`, que entrega una copia fresca.
 */
const ADMIN_SIDEBAR: SidebarItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/ecommerce",
    label: "Panorámica Market",
    icon: ShoppingCart,
    isPremium: true,
    children: [
      {
        href: "/ecommerce-pedidos",
        label: "Pedidos",
        icon: PackageSearch,
      },
      {
        href: "/productos",
        label: "Productos",
        icon: Package,
      },
      {
        href: "/clientes",
        label: "Clientes",
        icon: Users,
      },
      // Cotizaciones oculta del sidebar (ruta /cotizaciones-b2c sigue activa)
      // {
      //   href: "/cotizaciones-b2c",
      //   label: "Cotizaciones",
      //   icon: FileText,
      // },
      // CRM oculto del sidebar (la página sigue accesible por URL /seguimiento-clientes).
      // {
      //   href: "/seguimiento-clientes",
      //   label: "CRM",
      //   icon: UserCheck,
      // },
      {
        href: "/donde-comprar-admin",
        label: "Dónde Comprar",
        icon: MapPin,
      },
      {
        href: "/mailing",
        label: "Mailing",
        icon: Mail,
      },
      {
        href: "/ecommerce",
        label: "Configuración",
        icon: ShoppingCart,
      },
    ],
    separator: true,
  },
  // ── Operación diaria ──
  {
    href: "/tareas",
    label: "Panel de Trabajo",
    icon: CheckCircle2,
  },
  {
    href: "/tomador-pedidos-v2",
    label: "Tomador de Pedidos",
    icon: ClipboardCheck,
  },
  {
    href: "/inventario",
    label: "Inventario",
    icon: Warehouse,
  },
  // Logística sube a primer nivel (antes vivía dentro del desplegable de Market)
  {
    href: "/logistica-rutas",
    label: "Logística",
    icon: Truck,
  },
  {
    href: "/gastos-empresariales",
    label: "Rendición de Gastos",
    icon: Banknote,
  },
  {
    href: "/tintometria",
    label: "Tintometría",
    icon: Palette,
    children: [
      {
        href: "/tintometria/admin",
        label: "Administrar Datos",
        icon: Settings,
      },
      {
        href: "/tintometria/calculadora",
        label: "Calcular Costos",
        icon: DollarSign,
      },
      {
        href: "/tintometria/selector",
        label: "Selector Visual",
        icon: PaintBucket,
      },
    ],
    separator: true,
  },
  // ── Marketing ──
  // Email Marketing salió del sidebar: vive como pestaña del módulo Marketing
  // (la ruta /campanas sigue activa y el permiso market.campanas la gobierna).
  marketingSidebarItem({ separator: true }),
  // ── Finanzas ──
  {
    href: "/facturas",
    label: "Finanzas",
    icon: Receipt,
  },
  {
    href: "/margen",
    label: "Margen",
    icon: TrendingUp,
  },
  {
    href: "/comisiones",
    label: "Comisiones",
    icon: DollarSign,
  },
  // Cierra Finanzas: es Finanzas quien resuelve las solicitudes de crédito
  // (la misma pantalla vive además como pestaña del Panel de Trabajo).
  {
    href: "/solicitud-credito",
    label: "Solicitud de Crédito",
    icon: FileCheck,
    separator: true,
  },
  // ── Post-venta ──
  {
    href: "/reclamos-generales",
    label: "Reclamos",
    icon: AlertTriangle,
    separator: true,
  },
  // ── Resto de módulos del admin (fuera del orden pedido, van al final) ──
  // Visitas Técnicas salió del sidebar: su acceso vive como pestaña del Panel
  // de Trabajo en el área Construcción (la ruta /visitas-tecnicas sigue activa).
  // Mantención (CMMS) oculto: módulo a eliminar (ver nota arriba y
  // DEPRECAR-MANTENCION.md).
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
  },

];

/** Copia fresca del menú del administrador. */
export const adminSidebarItems = (): SidebarItem[] => cloneSidebarItems(ADMIN_SIDEBAR);

/**
 * Segmentos de supervisión con menú propio.
 *
 * "general" es el supervisor sin segmento asignado (o con uno que no es
 * Construcción ni Ferretería, ej. Industrial): usa el menú base.
 */
export type SupervisorSegmento = "construccion" | "ferreteria" | "general";

/**
 * Segmento de un supervisor a partir de su `assignedSegment`.
 *
 * `assigned_segment` es texto libre cargado a mano en Gestión de Usuarios
 * ("CONSTRUCCION", "Ferreterías", "construccion"…), así que se compara por
 * raíz y sin acentos, igual que en el Panel de Trabajo (pages/tareas.tsx).
 */
export function resolveSupervisorSegmento(assignedSegment?: string | null): SupervisorSegmento {
  const s = (assignedSegment ?? "").toLowerCase();
  if (s.includes("construc")) return "construccion";
  if (s.includes("ferreter")) return "ferreteria";
  return "general";
}

/**
 * Menú del supervisor, por segmento.
 *
 * HOY los tres son el mismo menú —el del administrador— porque así se pidió:
 * el supervisor ve exactamente lo que ve el admin (lo que efectivamente
 * aparece lo sigue recortando el filtro por permisos del rol).
 *
 * La razón de tener tres entradas separadas aunque devuelvan lo mismo es
 * poder diferenciarlas después SIN tocar el resto del sistema: para darle a
 * Construcción o a Ferretería un ítem propio, o sacarle uno, basta editar su
 * entrada acá. Ejemplo de cómo quedaría un menú que se separa del base:
 *
 *   construccion: () => {
 *     const items = adminSidebarItems();
 *     items.push({ href: "/visitas-tecnicas", label: "Visitas Técnicas", icon: FileCheck });
 *     return items;
 *   },
 *
 * El segmento sale de `salespeople_users.assigned_segment` del usuario; quien
 * no tenga segmento cae en "general".
 */
export const SUPERVISOR_SIDEBAR_POR_SEGMENTO: Record<SupervisorSegmento, () => SidebarItem[]> = {
  construccion: () => adminSidebarItems(),
  ferreteria: () => adminSidebarItems(),
  general: () => adminSidebarItems(),
};

/** Menú del supervisor según el segmento que tenga asignado. */
export function supervisorSidebarItems(assignedSegment?: string | null): SidebarItem[] {
  return SUPERVISOR_SIDEBAR_POR_SEGMENTO[resolveSupervisorSegmento(assignedSegment)]();
}

export const SIDEBAR_CONFIG: Record<string, SidebarItem[]> = {
  admin: adminSidebarItems(),

  jefe_planta: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    // Mantención (CMMS) oculto: módulo a eliminar (ver nota arriba y
    // DEPRECAR-MANTENCION.md).
    {
      href: "/productos",
      label: "Productos",
      icon: Package,
      separator: true,
    },
    {
      href: "/tintometria",
      label: "Tintometría",
      icon: Palette,
      children: [
        {
          href: "/tintometria/admin",
          label: "Administrar Datos",
          icon: Settings,
        },
        {
          href: "/tintometria/calculadora",
          label: "Calcular Costos",
          icon: DollarSign,
        },
        {
          href: "/tintometria/selector",
          label: "Selector Visual",
          icon: PaintBucket,
        },
      ],
    },

  ],

  // El rol `mantencion` no tenía otro módulo que el CMMS, así que al ocultarlo su
  // menú queda solo con "Rendición de Gastos" (el ítem que se agrega abajo a todos
  // los roles). Sigue aterrizando en Órdenes de Trabajo al entrar (App.tsx), o sea
  // que puede trabajar; lo que perdió es el menú. Cuando se confirme la baja del
  // módulo hay que decidir qué pasa con el rol: ver DEPRECAR-MANTENCION.md.
  mantencion: [],

  // Supervisor: el MISMO menú que el administrador.
  //
  // Esta entrada es solo el fallback estático (cualquiera que lea
  // SIDEBAR_CONFIG directo). El menú real lo arma `buildSidebarItems` con
  // `supervisorSidebarItems(assignedSegment)`, que ya distingue Construcción
  // de Ferretería (ver SUPERVISOR_SIDEBAR_POR_SEGMENTO).
  supervisor: supervisorSidebarItems(),

  // Encargados de Área: acceso a Dashboard, Panorámica Market, Productos, Finanzas y Tomador de Pedidos
  encargado_area: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/ecommerce",
      label: "Panorámica Market",
      icon: ShoppingCart,
      isPremium: true,
      children: [
        {
          href: "/ecommerce-pedidos",
          label: "Pedidos",
          icon: PackageSearch,
        },
        {
          href: "/productos",
          label: "Productos",
          icon: Package,
        },
        {
          href: "/clientes",
          label: "Clientes",
          icon: Users,
        },
        {
          href: "/logistica-rutas",
          label: "Logística",
          icon: Truck,
        },
        // Cotizaciones oculta del sidebar (ruta /cotizaciones-b2c sigue activa)
        // {
        //   href: "/cotizaciones-b2c",
        //   label: "Cotizaciones",
        //   icon: FileText,
        // },
        // CRM oculto del sidebar (la página sigue accesible por URL /seguimiento-clientes).
        // {
        //   href: "/seguimiento-clientes",
        //   label: "CRM",
        //   icon: UserCheck,
        // },
        {
          href: "/donde-comprar-admin",
          label: "Dónde Comprar",
          icon: MapPin,
        },
        {
          href: "/mailing",
          label: "Mailing",
          icon: Mail,
        },
        {
          href: "/campanas",
          label: "Campañas Mailing",
          icon: Send,
        },
        {
          href: "/ecommerce",
          label: "Configuración",
          icon: ShoppingCart,
        },
      ],
      separator: true,
    },
    {
      href: "/facturas",
      label: "Finanzas",
      icon: Receipt,
    },
    {
      href: "/tomador-pedidos-v2",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
    },
  ],

  // Menú estandarizado del vendedor (igual para TODOS los vendedores: se
  // gobierna por el rol RBAC `salesperson`, no usuario por usuario).
  //
  // El orden es el del trabajo diario: primero vender (tomador, panel, precios,
  // stock), después lo administrativo (gastos, crédito) y al final el
  // seguimiento de lo que ya pasó (reclamos, pedidos).
  //
  // Fuera a propósito: Productos (entra solo a Lista de Precios e Inventario),
  // Clientes (la ficha se abre desde el Panel de Trabajo) y Marketing.
  salesperson: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/tomador-pedidos-v2",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
      isPremium: true,
    },
    {
      href: "/tareas",
      label: "Panel de Trabajo",
      icon: CheckCircle2,
      separator: true,
    },
    {
      // Solo la lista COMERCIAL y en solo lectura: sin el permiso
      // "productos.costos" la página esconde costos, márgenes y edición.
      href: "/lista-precios",
      label: "Lista de Precios",
      icon: FileSpreadsheet,
    },
    {
      href: "/inventario",
      label: "Inventarios",
      icon: Warehouse,
      separator: true,
    },
    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
    },
    {
      href: "/solicitud-credito",
      label: "Solicitud de Crédito",
      icon: FileCheck,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/seguimiento-pedidos",
      label: "Pedidos",
      icon: PackageSearch,
    },
    // Tintometría oculta temporalmente para vendedores
    // {
    //   href: "/tintometria",
    //   label: "Tintometría",
    //   icon: Palette,
    //   children: [
    //     {
    //       href: "/tintometria/admin",
    //       label: "Administrar Datos",
    //       icon: Settings,
    //     },
    //     {
    //       href: "/tintometria/calculadora",
    //       label: "Calcular Costos",
    //       icon: DollarSign,
    //     },
    //     {
    //       href: "/tintometria/selector",
    //       label: "Selector Visual",
    //       icon: PaintBucket,
    //     },
    //   ],
    // },

  ],

  client: [
    {
      href: "/",
      label: "Mi Panel",
      icon: Package,
    },
    {
      href: "/mis-pedidos",
      label: "Mis Pedidos",
      icon: ShoppingCart,
    },
    {
      href: "/solicitar-cotizacion",
      label: "Solicitar Cotización",
      icon: FileText,
    },

    {
      href: "/tintometria",
      label: "Tintometría",
      icon: Palette,
      children: [
        {
          href: "/tintometria/admin",
          label: "Administrar Datos",
          icon: Settings,
        },
        {
          href: "/tintometria/calculadora",
          label: "Calcular Costos",
          icon: DollarSign,
        },
        {
          href: "/tintometria/selector",
          label: "Selector Visual",
          icon: PaintBucket,
        },
      ],
    },

  ],

  reception: [
    {
      href: "/",
      label: "Recepción",
      icon: ClipboardCheck,
      separator: true,
    },
    {
      href: "/ecommerce",
      label: "Panorámica Market",
      icon: ShoppingCart,
      isPremium: true,
      children: [
        {
          href: "/ecommerce-pedidos",
          label: "Pedidos",
          icon: PackageSearch,
        },
        {
          href: "/productos",
          label: "Productos",
          icon: Package,
        },
        {
          href: "/clientes",
          label: "Clientes",
          icon: Users,
        },
        {
          href: "/logistica-rutas",
          label: "Logística",
          icon: Truck,
        },
        // Cotizaciones oculta del sidebar (ruta /cotizaciones-b2c sigue activa)
        // {
        //   href: "/cotizaciones-b2c",
        //   label: "Cotizaciones",
        //   icon: FileText,
        // },
        // Solo visible si a la recepcionista se le habilita el CRM
        // (Gestión de Usuarios → Acceso CRM); el filtro por permiso lo oculta.
        // CRM oculto del sidebar (la página sigue accesible por URL /seguimiento-clientes).
        // {
        //   href: "/seguimiento-clientes",
        //   label: "CRM",
        //   icon: UserCheck,
        // },
        {
          href: "/donde-comprar-admin",
          label: "Dónde Comprar",
          icon: MapPin,
        },
        {
          href: "/mailing",
          label: "Mailing",
          icon: Mail,
        },
        {
          href: "/campanas",
          label: "Campañas Mailing",
          icon: Send,
        },
        {
          href: "/ecommerce",
          label: "Configuración",
          icon: ShoppingCart,
        },
      ],
      separator: true,
    },
    {
      href: "/facturas",
      label: "Finanzas",
      icon: Receipt,
    },
  ],

  tecnico_obra: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/clientes",
      label: "Clientes",
      icon: Users,
    },
  ],

  laboratorio: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/productos",
      label: "Productos",
      icon: Package,
    },
    {
      href: "/tintometria",
      label: "Tintometría",
      icon: Palette,
      children: [
        {
          href: "/tintometria/admin",
          label: "Administrar Datos",
          icon: Settings,
        },
        {
          href: "/tintometria/calculadora",
          label: "Calcular Costos",
          icon: DollarSign,
        },
        {
          href: "/tintometria/selector",
          label: "Selector Visual",
          icon: PaintBucket,
        },
      ],
    },
  ],

  // Roles organizacionales - Acceso a Reclamos Generales
  // (tenían también Mantención, oculto: módulo a eliminar, ver nota arriba y
  // DEPRECAR-MANTENCION.md).
  produccion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/productos",
      label: "Productos",
      icon: Package,
    },
  ],

  logistica_bodega: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/facturas",
      label: "Finanzas",
      icon: Receipt,
    },
    {
      href: "/productos",
      label: "Productos",
      icon: Package,
      separator: true,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    // Mantención (CMMS) oculto: módulo a eliminar (ver nota arriba y
    // DEPRECAR-MANTENCION.md).
  ],

  planificacion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    // Mantención (CMMS) oculto: módulo a eliminar (ver nota arriba y
    // DEPRECAR-MANTENCION.md).
  ],

  bodega_materias_primas: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    // Mantención (CMMS) oculto: módulo a eliminar (ver nota arriba y
    // DEPRECAR-MANTENCION.md).
  ],

  prevencion_riesgos: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  // Roles de área - Solo acceso a Reclamos Generales
  area_produccion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  area_logistica: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  area_aplicacion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  area_materia_prima: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  area_colores: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  area_envase: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  area_etiqueta: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  recursos_humanos: [
    {
      href: "/comisiones",
      label: "Comisiones",
      icon: DollarSign,
    },
    {
      href: "/solicitud-credito",
      label: "Solicitud de Crédito",
      icon: FileCheck,
    },
    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
    },
  ],

  // El rol Marketing trabaja entero dentro de su módulo: "Hoy", la bandeja de
  // solicitudes y sus tareas viven ahí. Antes tenía además el Panel de Trabajo, que
  // le mostraba lo mismo con otra interfaz (una bandeja de solicitudes distinta y un
  // "Mis tareas" paralelo) y era la principal fuente de confusión.
  marketing: [marketingSidebarItem()],
};

const GASTOS_SIDEBAR_ITEM: SidebarItem = {
  href: "/gastos-empresariales",
  label: "Rendición de Gastos",
  icon: Banknote,
};

for (const role of Object.keys(SIDEBAR_CONFIG)) {
  if (role === "client") continue;
  const items = SIDEBAR_CONFIG[role];
  const alreadyHasGastos = items.some(
    (item) => item.href === "/gastos-empresariales"
  );
  if (!alreadyHasGastos) {
    items.push({ ...GASTOS_SIDEBAR_ITEM });
  }
}