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
  ClipboardList,
  ClipboardCheck,
  DollarSign,
  TrendingUp
} from "lucide-react";

interface SidebarItem {
  href: string;
  label: string;
  icon: any;
  disabled?: boolean;
  comingSoon?: boolean;
  separator?: boolean; // Para mostrar separador después del item
}

export const SIDEBAR_CONFIG: Record<string, SidebarItem[]> = {
  admin: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/nvv",
      label: "Notas de Venta (NVV)",
      icon: TrendingUp,
    },
    {
      href: "/metas",
      label: "Gestión de Metas",
      icon: Target,
    },
    {
      href: "/ordenes",
      label: "Gestión de Órdenes",
      icon: FileText,
    },
    {
      href: "/usuarios",
      label: "Gestión de Usuarios",
      icon: User,
    },
    {
      href: "/productos",
      label: "Gestión de Productos",
      icon: Package,
    },
    {
      href: "/lista-precios",
      label: "Lista de Precios",
      icon: DollarSign,
    },
    {
      href: "/ecommerce",
      label: "eCommerce",
      icon: ShoppingCart,
    },
    {
      href: "/clientes",
      label: "Gestión de Clientes",
      icon: Users,
      separator: true, // Separador antes de Tomador de Pedidos
    },
    {
      href: "/tomador-pedidos",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
    },
    {
      href: "/tareas",
      label: "Panel de Tareas",
      icon: ClipboardList,
    },

    {
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
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
      href: "/nvv",
      label: "Notas de Venta (NVV)",
      icon: TrendingUp,
    },
    {
      href: "/metas",
      label: "Gestión de Metas",
      icon: Target,
    },
    {
      href: "/ordenes",
      label: "Gestión de Órdenes",
      icon: FileText,
    },
    {
      href: "/usuarios",
      label: "Gestión de Usuarios",
      icon: User,
    },
    {
      href: "/productos",
      label: "Gestión de Productos",
      icon: Package,
    },
    {
      href: "/lista-precios",
      label: "Lista de Precios",
      icon: DollarSign,
    },
    {
      href: "/ecommerce",
      label: "eCommerce",
      icon: ShoppingCart,
    },
    {
      href: "/clientes",
      label: "Gestión de Clientes",
      icon: Users,
      separator: true, // Separador antes de Tomador de Pedidos
    },
    {
      href: "/tomador-pedidos",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
    },
    {
      href: "/tareas",
      label: "Panel de Tareas",
      icon: ClipboardList,
    },

    {
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
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
      href: "/lista-precios",
      label: "Lista de Precios",
      icon: DollarSign,
    },
    {
      href: "/ordenes",
      label: "Gestión de Órdenes",
      icon: FileText,
      separator: true, // Separador antes de Tomador de Pedidos
    },
    {
      href: "/tomador-pedidos",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
    },
    {
      href: "/tareas",
      label: "Panel de Tareas",
      icon: ClipboardList,
    },

    {
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
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
      href: "#tintometria",
      label: "Calcular Tintometría",
      icon: Palette,
      disabled: true,
      comingSoon: true,
    },

  ],
};