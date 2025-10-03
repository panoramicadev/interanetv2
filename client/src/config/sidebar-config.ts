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
  TrendingUp,
  Receipt,
  CheckCircle2,
  FileCheck,
  ChevronDown,
  PaintBucket,
  Building2
} from "lucide-react";

interface SidebarItem {
  href: string;
  label: string;
  icon: any;
  disabled?: boolean;
  comingSoon?: boolean;
  separator?: boolean; // Para mostrar separador después del item
  children?: SidebarItem[]; // Para submenús desplegables
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
      href: "/ordenes",
      label: "Facturas",
      icon: Receipt,
    },
    {
      href: "/nvv",
      label: "Notas de Venta (NVV)",
      icon: TrendingUp,
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
    },
    {
      href: "/obras",
      label: "Obras",
      icon: Building2,
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
      href: "/visitas-tecnicas",
      label: "Visita Técnica",
      icon: FileCheck,
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
  
  supervisor: [
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
      href: "/ordenes",
      label: "Facturas",
      icon: Receipt,
    },
    {
      href: "/nvv",
      label: "Notas de Venta (NVV)",
      icon: TrendingUp,
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
    },
    {
      href: "/obras",
      label: "Obras",
      icon: Building2,
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
      href: "/visitas-tecnicas",
      label: "Visita Técnica",
      icon: FileCheck,
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
      label: "Facturas",
      icon: Receipt,
    },
    {
      href: "/nvv",
      label: "Notas de Venta (NVV)",
      icon: TrendingUp,
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
};