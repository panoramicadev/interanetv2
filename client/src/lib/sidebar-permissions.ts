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
} from "lucide-react";
import { SIDEBAR_CONFIG, type SidebarItem } from "@/config/sidebar-config";
import { PERMISSION_BY_HREF } from "@shared/permissions";

type Can = (key: string) => boolean;

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
  {
    href: "/mantenciones",
    label: "Mantención",
    icon: Wrench,
    children: [
      { key: "cmms.dashboard", href: "/cmms", label: "Dashboard CMMS", icon: LayoutDashboard },
      { key: "cmms.mantenciones_planificadas", href: "/cmms/mantenciones-planificadas", label: "Mantenciones Planificadas", icon: TrendingUp },
      { key: "cmms.ordenes", href: "/mantenciones", label: "Órdenes de Trabajo", icon: Wrench },
      { key: "cmms.equipos", href: "/cmms/equipos", label: "Equipos Críticos", icon: Settings },
      { key: "cmms.proveedores", href: "/cmms/proveedores", label: "Proveedores", icon: Users },
      { key: "cmms.presupuesto", href: "/cmms/presupuesto", label: "Presupuesto", icon: DollarSign },
      { key: "cmms.gastos_materiales", href: "/cmms/gastos-materiales", label: "Gastos de Materiales", icon: Receipt },
      { key: "cmms.planes_preventivos", href: "/cmms/planes-preventivos", label: "Planes Preventivos", icon: Calendar },
      { key: "cmms.calendario", href: "/cmms/calendario", label: "Calendario", icon: Calendar },
    ],
  },
];

const EXTRA_TOP_LEVEL: { key: string; item: SidebarItem }[] = [
  { key: "dashboard", item: { href: "/", label: "Dashboard", icon: LayoutDashboard } },
  { key: "productos", item: { href: "/productos", label: "Productos", icon: Package } },
  { key: "clientes", item: { href: "/clientes", label: "Clientes", icon: Users } },
  // Para roles cuyo sidebar base ya trae el grupo Panorámica Market, el CRM
  // vive como hijo del grupo (sidebar-config); este extra solo aplica a
  // roles sin ese grupo (ej: vendedor habilitado desde Gestión de Usuarios).
  { key: "clientes.seguimiento", item: { href: "/seguimiento-clientes", label: "CRM", icon: UserCheck } },
  { key: "clientes.ayuda_memoria", item: { href: "/ayuda-memoria", label: "Ayuda Memoria", icon: BookOpen } },
  { key: "tomador_pedidos", item: { href: "/tomador-pedidos-v2", label: "Tomador de Pedidos", icon: ClipboardCheck } },
  { key: "seguimiento_pedidos", item: { href: "/seguimiento-pedidos", label: "Pedidos", icon: PackageSearch } },
  { key: "mis_pedidos", item: { href: "/mis-pedidos", label: "Mis Pedidos", icon: ShoppingCart } },
  { key: "marketing", item: { href: "/marketing", label: "Marketing", icon: TrendingUp } },
  { key: "finanzas", item: { href: "/facturas", label: "Finanzas", icon: Receipt } },
  { key: "margen", item: { href: "/margen", label: "Margen", icon: TrendingUp } },
  { key: "rrhh.comisiones", item: { href: "/comisiones", label: "Comisiones", icon: DollarSign } },
  { key: "gastos", item: { href: "/gastos-empresariales", label: "Rendición de Gastos", icon: Banknote } },
  { key: "postventa.visitas", item: { href: "/visitas-tecnicas", label: "Visita Técnica", icon: FileCheck } },
  { key: "postventa.reclamos", item: { href: "/reclamos-generales", label: "Reclamos", icon: AlertTriangle } },
  // etl_monitor no genera ítem extra: se accede por la pestaña de Configuración
  { key: "configuracion", item: { href: "/configuracion", label: "Configuración", icon: Settings } },
  { key: "mi_catalogo", item: { href: "/catalogo", label: "Mi Catálogo", icon: ExternalLink, isExternalCatalog: true } },
];

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
  if (role === "admin") return items;

  const covered = collectCoveredKeys(base);

  // Grupos extra: fusionar dentro del grupo existente si el rol ya lo tiene
  for (const group of EXTRA_GROUPS) {
    const missingChildren = group.children.filter((child) => !covered.has(child.key) && can(child.key));
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
    if (covered.has(key) || !can(key)) continue;
    if (items.some((existing) => existing.href === item.href && !existing.children)) continue;
    items.push({ ...item });
  }

  return items;
}
