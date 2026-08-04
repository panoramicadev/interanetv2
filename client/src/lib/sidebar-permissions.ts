/**
 * Sidebar dinámico según permisos efectivos del rol.
 *
 * El sidebar base de cada rol (SIDEBAR_CONFIG) se conserva como
 * estructura/orden de referencia y se filtra por permisos. Si un admin
 * otorga a un rol módulos que su sidebar base no contempla, se agregan
 * al final ("extras") usando una representación canónica, fusionándolos
 * dentro de los grupos existentes (Market, Tintometría, Mantención)
 * cuando corresponde.
 */
import {
  LayoutDashboard,
  Users,
  Package,
  Settings,
  ShoppingCart,
  Palette,
  ClipboardCheck,
  DollarSign,
  TrendingUp,
  Receipt,
  FileCheck,
  PaintBucket,
  Wrench,
  AlertTriangle,
  Banknote,
  Calendar,
  ExternalLink,
  PackageSearch,
  Truck,
  UserCheck,
  BookOpen,
  MapPin,
  Mail,
  Send,
} from "lucide-react";
import { SIDEBAR_CONFIG, marketingSidebarItem, type SidebarItem } from "@/config/sidebar-config";
import { PERMISSION_BY_HREF } from "@shared/permissions";

type Can = (key: string) => boolean;

/**
 * Sub-secciones administrativas de Marketing (plata del área). El módulo ya las
 * esconde para quien no corresponde; esto evita además el ítem muerto en el menú.
 * El criterio es el mismo `isAdmin` que usa `pages/marketing.tsx`.
 */
const MARKETING_ADMIN_HREFS = new Set(["/marketing/gastos", "/marketing/presupuesto", "/marketing/proveedores"]);
const MARKETING_ADMIN_ROLES = new Set(["admin", "supervisor", "encargado_area", "marketing"]);

function filterMarketingByRole(items: SidebarItem[], role: string | undefined): SidebarItem[] {
  if (role && MARKETING_ADMIN_ROLES.has(role)) return items;
  return items.map((item) =>
    item.href === "/marketing" && item.children
      ? { ...item, children: item.children.filter((c) => !MARKETING_ADMIN_HREFS.has(c.href)) }
      : item,
  );
}

function permissionKeyForItem(item: SidebarItem): string | null {
  if (item.isExternalCatalog) return "mi_catalogo";
  return PERMISSION_BY_HREF[item.href] || null;
}

/** Filtra ítems (y sub-ítems) según permisos; ítems sin mapping quedan visibles. */
function filterByPermissions(items: SidebarItem[], can: Can): SidebarItem[] {
  const result: SidebarItem[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      const children = item.children.filter((child) => {
        const key = permissionKeyForItem(child);
        return key ? can(key) : true;
      });
      // Un grupo sin sub-ítems visibles se oculta completo
      if (children.length > 0) result.push({ ...item, children });
    } else {
      const key = permissionKeyForItem(item);
      if (!key || can(key)) result.push(item);
    }
  }
  return result;
}

/** Claves de permiso ya representadas en el sidebar base del rol */
function collectCoveredKeys(items: SidebarItem[]): Set<string> {
  const covered = new Set<string>();
  const visit = (item: SidebarItem) => {
    const key = permissionKeyForItem(item);
    if (key) covered.add(key);
    item.children?.forEach(visit);
  };
  items.forEach(visit);
  return covered;
}

// ── Representación canónica de módulos para "extras" ──

interface ExtraGroupTemplate {
  href: string;
  label: string;
  icon: any;
  isPremium?: boolean;
  children: { key: string; href: string; label: string; icon: any }[];
}

const EXTRA_GROUPS: ExtraGroupTemplate[] = [
  {
    href: "/ecommerce",
    label: "Panorámica Market",
    icon: ShoppingCart,
    isPremium: true,
    children: [
      { key: "market.pedidos", href: "/ecommerce-pedidos", label: "Pedidos", icon: PackageSearch },
      { key: "market.logistica", href: "/logistica-rutas", label: "Logística", icon: Truck },
      { key: "market.donde_comprar", href: "/donde-comprar-admin", label: "Dónde Comprar", icon: MapPin },
      { key: "market.mailing", href: "/mailing", label: "Mailing", icon: Mail },
      { key: "market.configuracion", href: "/ecommerce", label: "Configuración", icon: ShoppingCart },
    ],
  },
  {
    href: "/tintometria",
    label: "Tintometría",
    icon: Palette,
    children: [
      { key: "tintometria.admin", href: "/tintometria/admin", label: "Administrar Datos", icon: Settings },
      { key: "tintometria.calculadora", href: "/tintometria/calculadora", label: "Calcular Costos", icon: DollarSign },
      { key: "tintometria.selector", href: "/tintometria/selector", label: "Selector Visual", icon: PaintBucket },
    ],
  },
  // Mantención (CMMS) oculto del sidebar para todos los roles: el módulo está
  // marcado para eliminarse. Tiene que quedar fuera también acá, no solo del
  // sidebar base: si no, los "extras" le reponen el grupo a cualquier rol que
  // conserve permisos cmms.*, que es justamente lo que se quiere esconder. Las
  // rutas /mantenciones y /cmms/* y los permisos cmms.* siguen activos.
  // Ver DEPRECAR-MANTENCION.md.
  // {
  //   href: "/mantenciones",
  //   label: "Mantención",
  //   icon: Wrench,
  //   children: [
  //     { key: "cmms.dashboard", href: "/cmms", label: "Dashboard CMMS", icon: LayoutDashboard },
  //     { key: "cmms.mantenciones_planificadas", href: "/cmms/mantenciones-planificadas", label: "Mantenciones Planificadas", icon: TrendingUp },
  //     { key: "cmms.ordenes", href: "/mantenciones", label: "Órdenes de Trabajo", icon: Wrench },
  //     { key: "cmms.equipos", href: "/cmms/equipos", label: "Equipos Críticos", icon: Settings },
  //     { key: "cmms.proveedores", href: "/cmms/proveedores", label: "Proveedores", icon: Users },
  //     { key: "cmms.presupuesto", href: "/cmms/presupuesto", label: "Presupuesto", icon: DollarSign },
  //     { key: "cmms.gastos_materiales", href: "/cmms/gastos-materiales", label: "Gastos de Materiales", icon: Receipt },
  //     { key: "cmms.planes_preventivos", href: "/cmms/planes-preventivos", label: "Planes Preventivos", icon: Calendar },
  //     { key: "cmms.calendario", href: "/cmms/calendario", label: "Calendario", icon: Calendar },
  //   ],
  // },
];

const EXTRA_TOP_LEVEL: { key: string; item: SidebarItem }[] = [
  { key: "dashboard", item: { href: "/", label: "Dashboard", icon: LayoutDashboard } },
  { key: "productos", item: { href: "/productos", label: "Productos", icon: Package } },
  { key: "clientes", item: { href: "/clientes", label: "Clientes", icon: Users } },
  // CRM oculto del sidebar para todos los roles (la página sigue accesible por
  // URL /seguimiento-clientes; el permiso clientes.seguimiento sigue gobernando
  // el acceso, solo no se muestra el acceso directo en el menú).
  // { key: "clientes.seguimiento", item: { href: "/seguimiento-clientes", label: "CRM", icon: UserCheck } },
  { key: "clientes.ayuda_memoria", item: { href: "/ayuda-memoria", label: "Ayuda Memoria", icon: BookOpen } },
  { key: "tomador_pedidos", item: { href: "/tomador-pedidos-v2", label: "Tomador de Pedidos", icon: ClipboardCheck } },
  { key: "seguimiento_pedidos", item: { href: "/seguimiento-pedidos", label: "Pedidos", icon: PackageSearch } },
  { key: "mis_pedidos", item: { href: "/mis-pedidos", label: "Mis Pedidos", icon: ShoppingCart } },
  { key: "marketing", item: marketingSidebarItem() },
  // Email Marketing salió del sidebar: vive como pestaña del módulo Marketing
  // (la ruta /campanas sigue activa y el permiso market.campanas la gobierna).
  // { key: "market.campanas", item: { href: "/campanas", label: "Campañas Mailing", icon: Send } },
  { key: "finanzas", item: { href: "/facturas", label: "Finanzas", icon: Receipt } },
  { key: "margen", item: { href: "/margen", label: "Margen", icon: TrendingUp } },
  { key: "rrhh.comisiones", item: { href: "/comisiones", label: "Comisiones", icon: DollarSign } },
  { key: "gastos", item: { href: "/gastos-empresariales", label: "Rendición de Gastos", icon: Banknote } },
  { key: "solicitud_credito", item: { href: "/solicitud-credito", label: "Solicitud de Crédito", icon: FileCheck } },
  // Visitas Técnicas oculto del sidebar para todos los roles: su acceso vive como
  // pestaña del Panel de Trabajo en el área Construcción (la ruta /visitas-tecnicas
  // sigue activa y el permiso postventa.visitas sigue gobernando el acceso).
  // { key: "postventa.visitas", item: { href: "/visitas-tecnicas", label: "Visita Técnica", icon: FileCheck } },
  { key: "postventa.reclamos", item: { href: "/reclamos-generales", label: "Reclamos", icon: AlertTriangle } },
  // etl_monitor no genera ítem extra: se accede por la pestaña de Configuración
  { key: "configuracion", item: { href: "/configuracion", label: "Configuración", icon: Settings } },
  { key: "mi_catalogo", item: { href: "/catalogo", label: "Mi Catálogo", icon: ExternalLink, isExternalCatalog: true } },
];

/**
 * Módulos que un rol TIENE por permiso pero que su menú no muestra como ítem
 * de primer nivel. Sin esto, los "extras" reponen al final justo lo que el
 * sidebar base sacó a propósito.
 *
 * El vendedor entra a la ficha del cliente desde su Panel de Trabajo (la obra
 * cuelga del cliente), no desde un ítem "Clientes": el permiso sigue haciendo
 * falta para que la ficha cargue, pero el menú queda como se estandarizó.
 */
const EXTRAS_OCULTOS_POR_ROL: Record<string, Set<string>> = {
  salesperson: new Set(["clientes"]),
};

/**
 * Construye el sidebar final del rol: base filtrado por permisos +
 * módulos extra otorgados que el base no contempla.
 */
export function buildSidebarItems(role: string | undefined, can: Can): SidebarItem[] {
  const base = SIDEBAR_CONFIG[role || ""] || [];
  const items = filterByPermissions(base, can);

  // El sidebar del admin es la referencia curada del sistema: tiene todos
  // los permisos pero solo muestra los módulos elegidos para su menú
  // (varias rutas quedan deliberadamente fuera del sidebar).
  if (role === "admin") return filterMarketingByRole(items, role);

  const covered = collectCoveredKeys(base);
  const ocultos = EXTRAS_OCULTOS_POR_ROL[role || ""] ?? new Set<string>();

  // Grupos extra: fusionar dentro del grupo existente si el rol ya lo tiene
  for (const group of EXTRA_GROUPS) {
    const missingChildren = group.children.filter(
      (child) => !covered.has(child.key) && !ocultos.has(child.key) && can(child.key),
    );
    if (missingChildren.length === 0) continue;

    const newChildren: SidebarItem[] = missingChildren.map(({ key: _key, ...child }) => ({ ...child }));
    const existing = items.find((item) => item.href === group.href && item.children && item.children.length > 0);
    if (existing) {
      existing.children = [...(existing.children || []), ...newChildren];
    } else {
      items.push({
        href: group.href,
        label: group.label,
        icon: group.icon,
        isPremium: group.isPremium,
        children: newChildren,
      });
    }
  }

  // Módulos sueltos extra
  for (const { key, item } of EXTRA_TOP_LEVEL) {
    if (covered.has(key) || ocultos.has(key) || !can(key)) continue;
    if (items.some((existing) => existing.href === item.href && !existing.children)) continue;
    items.push({ ...item, ...(item.children ? { children: item.children.map((c) => ({ ...c })) } : {}) });
  }

  return filterMarketingByRole(items, role);
}
