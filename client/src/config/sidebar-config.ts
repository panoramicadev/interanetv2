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
  Database,
  Bell,
  Key,
  Calendar,
  ExternalLink,
  FileSpreadsheet,
  Sparkles,
  Gift
} from "lucide-react";

interface SidebarItem {
  href: string;
  label: string;
  icon: any;
  disabled?: boolean;
  comingSoon?: boolean;
  separator?: boolean; // Para mostrar separador después del item
  children?: SidebarItem[]; // Para submenús desplegables
  isExternalCatalog?: boolean; // Para el enlace dinámico al catálogo público
}

export const SIDEBAR_CONFIG: Record<string, SidebarItem[]> = {
  admin: [
    {
      href: "/ai-assistant",
      label: "Asistente AI",
      icon: Sparkles,
    },
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
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
      href: "/facturas",
      label: "Finanzas",
      icon: Receipt,
    },
    {
      href: "/ecommerce",
      label: "eCommerce",
      icon: ShoppingCart,
      children: [
        {
          href: "/ecommerce",
          label: "Gestión eCommerce",
          icon: ShoppingCart,
        },
        {
          href: "/panoramica-market",
          label: "Panorámica Market",
          icon: Gift,
        },
      ],
      separator: true,
    },
    {
      href: "/marketing",
      label: "Marketing",
      icon: TrendingUp,
    },
    {
      href: "/tareas",
      label: "Tareas",
      icon: CheckCircle2,
    },
    {
      href: "/tomador-pedidos",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
    },
    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
      separator: true,
    },
    {
      href: "/post-venta",
      label: "Post-Venta",
      icon: ClipboardCheck,
      children: [
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
      ],
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
    {
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/cmms",
          label: "Dashboard CMMS",
          icon: LayoutDashboard,
        },
        {
          href: "/cmms/mantenciones-planificadas",
          label: "Mantenciones Planificadas",
          icon: TrendingUp,
        },
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/equipos",
          label: "Equipos Críticos",
          icon: Settings,
        },
        {
          href: "/cmms/proveedores",
          label: "Proveedores",
          icon: Users,
        },
        {
          href: "/cmms/presupuesto",
          label: "Presupuesto",
          icon: DollarSign,
        },
        {
          href: "/cmms/gastos-materiales",
          label: "Gastos de Materiales",
          icon: Receipt,
        },
        {
          href: "/cmms/planes-preventivos",
          label: "Planes Preventivos",
          icon: Calendar,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
    },

    {
      href: "/configuracion",
      label: "Configuración",
      icon: Settings,
    },

  ],

  jefe_planta: [
    {
      href: "/ai-assistant",
      label: "Asistente AI",
      icon: Sparkles,
    },
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
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
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/cmms",
          label: "Dashboard CMMS",
          icon: LayoutDashboard,
        },
        {
          href: "/cmms/mantenciones-planificadas",
          label: "Mantenciones Planificadas",
          icon: TrendingUp,
        },
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/equipos",
          label: "Equipos Críticos",
          icon: Settings,
        },
        {
          href: "/cmms/proveedores",
          label: "Proveedores",
          icon: Users,
        },
        {
          href: "/cmms/presupuesto",
          label: "Presupuesto",
          icon: DollarSign,
        },
        {
          href: "/cmms/gastos-materiales",
          label: "Gastos de Materiales",
          icon: Receipt,
        },
        {
          href: "/cmms/planes-preventivos",
          label: "Planes Preventivos",
          icon: Calendar,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
    },
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

  mantencion: [
    {
      href: "/ai-assistant",
      label: "Asistente AI",
      icon: Sparkles,
    },
    {
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/cmms",
          label: "Dashboard CMMS",
          icon: LayoutDashboard,
        },
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/mantenciones-planificadas",
          label: "Mantenciones Planificadas",
          icon: TrendingUp,
        },
        {
          href: "/cmms/planes-preventivos",
          label: "Planes Preventivos",
          icon: Calendar,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
    },
  ],

  supervisor: [
    {
      href: "/ai-assistant",
      label: "Asistente AI",
      icon: Sparkles,
    },
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
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
      href: "/facturas",
      label: "Finanzas",
      icon: Receipt,
    },
    {
      href: "/ecommerce",
      label: "eCommerce",
      icon: ShoppingCart,
      children: [
        {
          href: "/ecommerce",
          label: "Gestión eCommerce",
          icon: ShoppingCart,
        },
        {
          href: "/panoramica-market",
          label: "Panorámica Market",
          icon: Gift,
        },
      ],
      separator: true,
    },
    {
      href: "/marketing",
      label: "Marketing",
      icon: TrendingUp,
    },
    {
      href: "/tareas",
      label: "Tareas",
      icon: CheckCircle2,
    },
    {
      href: "/tomador-pedidos",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
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
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/cmms",
          label: "Dashboard CMMS",
          icon: LayoutDashboard,
        },
        {
          href: "/cmms/mantenciones-planificadas",
          label: "Mantenciones Planificadas",
          icon: TrendingUp,
        },
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/equipos",
          label: "Equipos Críticos",
          icon: Settings,
        },
        {
          href: "/cmms/proveedores",
          label: "Proveedores",
          icon: Users,
        },
        {
          href: "/cmms/presupuesto",
          label: "Presupuesto",
          icon: DollarSign,
        },
        {
          href: "/cmms/gastos-materiales",
          label: "Gastos de Materiales",
          icon: Receipt,
        },
        {
          href: "/cmms/planes-preventivos",
          label: "Planes Preventivos",
          icon: Calendar,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
    },

    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
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
      href: "/ai-assistant",
      label: "Asistente AI",
      icon: Sparkles,
    },
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
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
      href: "/facturas",
      label: "Finanzas",
      icon: Receipt,
    },
    {
      href: "/ecommerce",
      label: "eCommerce",
      icon: ShoppingCart,
      children: [
        {
          href: "/panoramica-market",
          label: "Panorámica Market",
          icon: Gift,
        },
      ],
      separator: true,
    },
    {
      href: "/marketing",
      label: "Marketing",
      icon: TrendingUp,
      separator: true, // Separador antes de Tomador de Pedidos
    },
    {
      href: "/tareas",
      label: "Tareas",
      icon: CheckCircle2,
    },
    {
      href: "/tomador-pedidos",
      label: "Tomador de Pedidos",
      icon: ClipboardCheck,
    },
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
    },
    {
      href: "/catalogo",
      label: "Mi Catálogo",
      icon: ExternalLink,
      isExternalCatalog: true,
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
      href: "/tareas",
      label: "Tareas",
      icon: CheckSquare,
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
      href: "/visitas-tecnicas",
      label: "Visitas Técnicas",
      icon: FileCheck,
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

  // Roles organizacionales - Acceso a Reclamos Generales y Mantención
  produccion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
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
    {
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
    },
  ],

  planificacion: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
    },
  ],

  bodega_materias_primas: [
    {
      href: "/reclamos-generales",
      label: "Reclamos",
      icon: AlertTriangle,
    },
    {
      href: "/mantenciones",
      label: "Mantención",
      icon: Wrench,
      children: [
        {
          href: "/mantenciones",
          label: "Órdenes de Trabajo",
          icon: Wrench,
        },
        {
          href: "/cmms/calendario",
          label: "Calendario",
          icon: Calendar,
        },
      ],
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

  recursos_humanos: [
    {
      href: "/gastos-empresariales",
      label: "Rendición de Gastos",
      icon: Banknote,
    },
  ],
};