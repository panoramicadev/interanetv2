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
  Building2,
  Wrench,
  AlertTriangle,
  Warehouse,
  Banknote,
  Database
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
      href: "/visitas-tecnicas",
      label: "Visita Técnica",
      icon: FileCheck,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/marketing",
      label: "Marketing",
      icon: TrendingUp,
    },
    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
    },
    {
      href: "/inventario",
      label: "Inventario",
      icon: Warehouse,
    },
    {
      href: "/etl-monitor",
      label: "Monitor ETL",
      icon: Database,
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
      href: "/visitas-tecnicas",
      label: "Visita Técnica",
      icon: FileCheck,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/marketing",
      label: "Marketing",
      icon: TrendingUp,
    },
    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
    },
    {
      href: "/inventario",
      label: "Inventario",
      icon: Warehouse,
    },
    {
      href: "/etl-monitor",
      label: "Monitor ETL",
      icon: Database,
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
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/marketing",
      label: "Marketing",
      icon: TrendingUp,
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
  
  tecnico_obra: [
    {
      href: "/visitas-tecnicas",
      label: "Visitas Técnicas",
      icon: Wrench,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/clientes",
      label: "Gestión de Clientes",
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
      href: "/visitas-tecnicas",
      label: "Visitas Técnicas",
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

  // Roles organizacionales - Solo acceso a Reclamos Generales
  produccion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  logistica_bodega: [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
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
      href: "/inventario",
      label: "Inventario",
      icon: Warehouse,
      separator: true,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  planificacion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
  ],

  bodega_materias_primas: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
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
};