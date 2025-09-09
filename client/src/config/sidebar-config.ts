import { 
  LayoutDashboard, 
  Users, 
  Target, 
  Package, 
  FileText,
  Settings,
  ShoppingCart,
  Calculator,
  Palette,
  Wrench
} from "lucide-react";

interface SidebarItem {
  href: string;
  label: string;
  icon: any;
  disabled?: boolean;
  comingSoon?: boolean;
}

export const SIDEBAR_CONFIG: Record<string, SidebarItem[]> = {
  admin: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/metas",
      label: "Gestión de Metas",
      icon: Target,
    },
    {
      href: "/usuarios",
      label: "Gestión de Usuarios",
      icon: Settings,
    },
    {
      href: "/productos",
      label: "Gestión de Productos",
      icon: Package,
    },
    {
      href: "#presupuesto",
      label: "Crear Presupuesto",
      icon: Calculator,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#stock",
      label: "Revisión de Stock",
      icon: Package,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#herramientas",
      label: "Herramientas de Venta",
      icon: Wrench,
      disabled: true,
      comingSoon: true,
    },
  ],
  
  supervisor: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/mis-vendedores",
      label: "Mis Vendedores",
      icon: Users,
    },
    {
      href: "/metas",
      label: "Gestión de Metas",
      icon: Target,
    },
    {
      href: "/reportes",
      label: "Reportes",
      icon: FileText,
    },
    {
      href: "#presupuesto",
      label: "Crear Presupuesto",
      icon: Calculator,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#stock",
      label: "Revisión de Stock",
      icon: Package,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#herramientas",
      label: "Herramientas de Venta",
      icon: Wrench,
      disabled: true,
      comingSoon: true,
    },
  ],
  
  salesperson: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/mis-clientes",
      label: "Mis Clientes",
      icon: Users,
    },
    {
      href: "#presupuesto",
      label: "Crear Presupuesto",
      icon: Calculator,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#stock",
      label: "Revisión de Stock",
      icon: Package,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#herramientas",
      label: "Herramientas de Venta",
      icon: Wrench,
      disabled: true,
      comingSoon: true,
    },
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
      href: "#presupuesto",
      label: "Crear Presupuesto",
      icon: Calculator,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#stock",
      label: "Revisión de Stock",
      icon: Package,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#herramientas",
      label: "Herramientas de Venta",
      icon: Wrench,
      disabled: true,
      comingSoon: true,
    },
  ],
};