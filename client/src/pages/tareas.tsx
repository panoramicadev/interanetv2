import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SolicitudDetalleDialog } from "@/components/marketing/solicitud-detalle-dialog";
import { EvidenciaVisitaDialog, type VisitaEvidencia } from "@/components/rutas/evidencia-visita-dialog";
import { getProxiedUrl } from "@/components/ui/image-zoom-viewer";
import {
  CheckSquare,
  Camera,
  Clock,
  AlertCircle,
  AlertTriangle,
  User,
  Users,
  Building2,
  UserCheck,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Filter,
  Edit,
  MessageSquare,
  Eye,
  EyeOff,
  Search,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Circle,
  Play,
  Check,
  Ban,
  Send,
  X,
  ArrowLeft,
  FolderOpen,
  Pencil,
  HelpCircle,
  Link2,
  ExternalLink,
  DollarSign,
  Package,
  MapPin,
  Palette,
  HardHat,
  FileCheck,
  RotateCcw,
  Target,
  Wallet,
  Sparkles,
  Mic,
  Pause
} from "lucide-react";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Task, type TaskAssignment, type InsertTaskAssignment, type TaskComment } from "@shared/schema";
import { IA_AUTHOR_NAME, IA_MENTION, esMensajeDeIA, mencionaIA } from "@shared/ai-mention";
import { RutasComercialesContent, type RutasComercialesHandle } from "@/pages/rutas-comerciales";
import { VisitasTecnicasContent } from "@/pages/visitas-tecnicas";
import { ControlObrasContent, type ControlObrasHandle } from "@/pages/control-obras";
import { CreditoPanel, useCredito } from "@/components/clients/credito-panel";
import { EnviarCobranzaButton } from "@/components/clients/enviar-cobranza";
import { nivelCredito, useCreditoSemaforo } from "@/components/clients/credito-semaforo";
import { SeguimientoObrasContent } from "@/pages/obras-seguimiento";
import SeguimientoClientes, { type SeguimientoClientesHandle } from "@/pages/seguimiento-clientes";
import { usePermissions } from "@/hooks/usePermissions";
import { PanelChangesContext, PANEL_TAB_TO_SECTION, usePanelChangesController, usePanelHighlights } from "@/hooks/use-panel-changes";
import { PanelChangesBell } from "@/components/panel/PanelChangesBell";
import { z } from "zod";

// SECURITY: Frontend schema that excludes createdByUserId to prevent user impersonation
const SEGMENTOS = [
  { value: "ferreterias", label: "Ferreterías" },
  { value: "construccion", label: "Construcción" },
  { value: "digital", label: "Industrial" },
  { value: "marketing", label: "Marketing" },
] as const;

// Segmento del usuario: el valor del ERP puede llegar por distintos campos
// según de dónde salga el usuario (assignedSegment del panel de usuarios, o el
// `noruen`/`segmento` de ventas), igual que en el header del layout.
const segmentoDeUsuario = (u: unknown): string | null => {
  const raw = (u as any)?.assignedSegment ?? (u as any)?.segmento ?? (u as any)?.noruen;
  return typeof raw === 'string' && raw.trim() ? raw : null;
};

// ¿Ese segmento es Construcción? Se compara por el token distintivo y sin
// acentos porque la grafía del ERP varía ("CONSTRUCCION", "Construcción",
// "CONSTRUCTORAS"). Ningún otro segmento (Ferreterías, Industrial, MCT,
// Digital, Marketing) usa esa raíz, así que el match es seguro.
const esSegmentoConstruccion = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  const s = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return s.includes('construc');
};

// ¿Ese segmento es Industrial? En el ERP el área viaja como "digital" (ver
// SEGMENTOS), pero también puede llegar escrita "Industrial" según de dónde
// salga el usuario, así que se aceptan las dos grafías.
const esSegmentoIndustrial = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  const s = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return s.includes('digital') || s.includes('industrial');
};

// En Industrial la unidad de trabajo no es la tarea suelta sino el PROYECTO
// (un cliente que todavía no existe en el ERP, un producto en desarrollo): un
// espacio que no se completa de un clic, se completan las tareas que tiene
// adentro — exactamente como el seguimiento de cliente. Los proyectos nuevos se
// marcan con payload.kind; los que ya existían cuando se creó la pestaña no
// tienen esa marca y se reconocen por estar en el área.
const esTareaProyecto = (task: any, enIndustrial = false): boolean => {
  const kind = task?.payload?.kind;
  if (kind === 'seguimiento_cliente') return false;
  if (kind === 'proyecto') return true;
  return enIndustrial || esSegmentoIndustrial(task?.segmento);
};

// Tipos de actividad (subtareas) dentro de un seguimiento de cliente
const ACTIVIDAD_TIPOS = [
  { value: "llamada", label: "Llamada", badge: "bg-blue-100 text-blue-700" },
  { value: "visita", label: "Visita", badge: "bg-orange-100 text-orange-700" },
  { value: "cotizacion", label: "Cotización", badge: "bg-orange-100 text-orange-700" },
  { value: "cobranza", label: "Cobranza", badge: "bg-amber-100 text-amber-700" },
  { value: "correo", label: "Correo", badge: "bg-cyan-100 text-cyan-700" },
  { value: "revision", label: "Revisión", badge: "bg-violet-100 text-violet-700" },
  { value: "otro", label: "Otro", badge: "bg-slate-100 text-slate-600" },
] as const;

// Los filtros del panel (estado, prioridad, cliente, segmento) se persisten en
// sessionStorage para no perderlos al entrar al detalle de un cliente/tarea y
// volver. Es transitorio: se limpia al cerrar la pestaña, no queda guardado
// para siempre.
const FILTERS_STORAGE_KEY = "tareas-panel-filtros";

// Normaliza texto para el buscador de tareas: minúsculas y sin tildes, para
// que "López" calce con "lopez" y viceversa.
const normalizeSearchText = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ─── Seguimiento: pendientes y "sin movimiento" ───────────────────────
// El backend enriquece cada seguimiento de cliente con `actividadesPendientes`,
// `actividadesTotal` y `ultimaInteraccion` (ver enrichSeguimientoTasks en
// server/storage.ts). Estos helpers los traducen a lo que ve el supervisor.
const DIAS_SIN_MOVIMIENTO_ALERTA = 7;    // ámbar: mismo umbral que "sin interacción" del CRM
const DIAS_SIN_MOVIMIENTO_CRITICO = 30;  // rojo

/** Tareas internas pendientes del cliente (0 si el seguimiento no tiene ninguna). */
const pendientesDeCliente = (task: any): number => Number(task?.actividadesPendientes ?? 0);

/** Días enteros desde la última interacción; null si nunca hubo ninguna. */
const diasSinMovimiento = (task: any): number | null => {
  const raw = task?.ultimaInteraccion;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
};

/** "Hoy" · "Ayer" · "Hace 4 días" · "Hace 3 sem." · "Hace 2 meses" */
const etiquetaMovimiento = (dias: number | null): string => {
  if (dias === null) return "Sin movimientos";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} sem.`;
  const meses = Math.floor(dias / 30);
  return `Hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
};

/** Verde / ámbar / rojo según hace cuánto que no pasa nada con el cliente. */
const tonoMovimiento = (dias: number | null): string => {
  if (dias === null || dias >= DIAS_SIN_MOVIMIENTO_CRITICO) return "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400";
  if (dias >= DIAS_SIN_MOVIMIENTO_ALERTA) return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400";
};

type TareasFiltrosPersistidos = {
  status: string;
  priority: string;
  cliente: string;
  segmento: string;
};

function loadTareasFiltros(): Partial<TareasFiltrosPersistidos> {
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const createTaskWithAssignmentsSchema = z.object({
  title: z.string().min(1, "Título es requerido"),
  description: z.string().optional(),
  type: z.enum(["texto", "formulario", "visita"]).default("texto"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  segmento: z.string().optional().or(z.null()),
  groupId: z.string().optional().or(z.null()),
  dueDate: z.string().refine((date) => {
    if (!date) return true; // Allow empty dates
    // Accept datetime-local format (YYYY-MM-DDTHH:mm) and ISO format
    const datetimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return datetimeLocalPattern.test(date) || isoPattern.test(date) || !isNaN(Date.parse(date));
  }, {
    message: "Formato de fecha inválido. Use el selector de fecha.",
  }).optional().or(z.null()),
  clienteId: z.string().optional().or(z.null()),
  clienteNombre: z.string().optional().or(z.null()),
  assignments: z.array(z.object({
    assigneeType: z.enum(["supervisor", "salesperson"]),
    assigneeId: z.string().min(1, "Destinatario requerido"),
  })).min(1, "Debe asignar al menos un destinatario"),
});

type CreateTaskWithAssignmentsInput = z.infer<typeof createTaskWithAssignmentsSchema>;

// Interfaces para Promesas de Compra
interface PromesaCompra {
  id: string;
  vendedorId: string;
  clienteId: string;
  clienteNombre: string;
  clienteTipo: string | null;
  montoPrometido: string;
  ventasRealesManual: string | null;
  semana: string;
  anio: number;
  numeroSemana: number;
  fechaInicio: Date;
  fechaFin: Date;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PromesaCumplimiento {
  promesa: PromesaCompra;
  ventasReales: number;
  cumplimiento: number;
  estado: 'cumplido' | 'superado' | 'cumplido_parcialmente' | 'insuficiente' | 'no_cumplido';
}

// Ventas reales del período completo (no solo las de los clientes prometidos) y
// avance del mes contra la meta. Lo entrega /api/promesas-compra/resumen-ventas.
interface TotalesVendido {
  facturado: number;
  nvv: number;
  gdv: number;
  total: number;
}

interface ResumenVentasEstimacion {
  alcance: 'segmento' | 'vendedor' | 'equipo';
  periodo: TotalesVendido & { startDate: string; endDate: string };
  mes: TotalesVendido & {
    periodo: string;
    meta: number;
    metaOrigen: 'segmento' | 'vendedor' | 'equipo' | null;
    porcentaje: number;
    falta: number;
  };
}

interface Cliente {
  id: string;
  nokoen: string;
  koen: string;
}

export default function TareasPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task & { assignments: TaskAssignment[] } | null>(null);

  const isSalesperson = user?.role === 'salesperson';
  // Quién ve más de una cartera: los mismos roles que ya podían filtrar por vendedor
  // dentro de Estimación de ventas, ahora que ese selector subió al encabezado.
  const puedeFiltrarPorVendedor =
    user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'encargado_area';
  // El rol marketing solo trabaja el segmento "marketing": sin pestañas de categoría.
  const isMarketing = user?.role === 'marketing';
  // Marketing: sub-vista dentro del Panel de Trabajo. Antes el panel de solicitudes y
  // "Mis tareas" iban apilados y había que scrollear hasta el fondo para llegar a las
  // tareas. Ahora son dos sub-vistas ('solicitudes' = triage de pedidos del equipo /
  // 'tareas' = sus tareas propias) bajo una barra-resumen fija con los conteos.
  // El CRM (Seguimiento de Clientes) vive como pestaña; se muestra a quien tenga el permiso.
  const { can, isReady: permissionsReady } = usePermissions();
  const showCrmTab = !isMarketing && can("clientes.seguimiento");
  // Pestañas siempre presentes: Tareas, Seguimiento, Calendario (3).
  // Rutas Comerciales se muestra en todas las áreas salvo Construcción, que en su
  // lugar tiene Visitas Técnicas (ver showVisitasTab más abajo, junto a esConstruccion).
  // Estimación (solo Ferreterías) y Obras (solo Construcción) requieren además no ser
  // técnico ni marketing; CRM según permiso.
  // Marketing ya no es pestaña acá: el área completa vive en el módulo Marketing.
  const showExtraSegmentTabs = user?.role !== 'tecnico_obra' && !isMarketing;
  // Visitas Técnicas dejó de estar en el sidebar: su acceso vive en esta pestaña.
  const canVerVisitas = can("postventa.visitas");
  // Solicitud de Crédito salió del Panel de Trabajo: se pide desde su módulo
  // propio en el sidebar (/solicitud-credito).
  // Clases compartidas de las pestañas del panel: flex para centrar ícono + texto
  // (antes usaban `inline` + `mr-2`, que desalineaba verticalmente y hacía que los
  // íconos se vieran de distinto tamaño). El ícono es `shrink-0` para no deformarse.
  //
  // Pestaña activa = SUBRAYADO NEGRO, sin relleno (corrección del usuario, sep-2026,
  // para todas las áreas): la píldora naranja sólida competía con el botón de acción
  // y con los chips de contexto del encabezado. El borde inferior transparente está
  // también en la inactiva para que al cambiar de pestaña no salte el alto.
  const tabTriggerClass =
    "group inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 text-[#0a0a0a] dark:text-slate-200 hover:text-[#fd6301] dark:hover:text-white border-b-2 border-transparent bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold data-[state=active]:text-[#0a0a0a] data-[state=active]:border-[#0a0a0a] -mb-px dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white dark:data-[state=active]:border-slate-100 rounded-none whitespace-nowrap shrink-0";
  const tabIconClass = "h-4 w-4 shrink-0 hidden sm:block";

  // La pestaña activa se centra dentro del riel al montar y al cambiar de pestaña. Se
  // ajusta `scrollLeft` (no `scrollIntoView`, que arrastra el scroll de toda la página) y
  // sin animación: el re-layout del contenido al montarse aborta el scroll suave.
  const tabsListRef = useRef<HTMLDivElement>(null);

  // View state - vendedores always see "my-tasks"
  const [viewMode, setViewMode] = useState<"my-tasks" | "all-tasks">(
    isSalesperson ? "my-tasks" : "all-tasks"
  );

  // Filters — se rehidratan desde sessionStorage para sobrevivir al detalle
  // del cliente/tarea y volver (ver FILTERS_STORAGE_KEY).
  const [statusFilter, setStatusFilter] = useState<string>(() => loadTareasFiltros().status ?? "all");
  const [priorityFilter, setPriorityFilter] = useState<string>(() => loadTareasFiltros().priority ?? "all");
  const [clienteFilter, setClienteFilter] = useState<string>(() => loadTareasFiltros().cliente ?? "all");
  const [segmentoFilter, setSegmentoFilter] = useState<string>(
    () => loadTareasFiltros().segmento ?? (isSalesperson ? "all" : isMarketing ? "marketing" : "ferreterias")
  );

  // Supervisor: solo puede ver la pestaña de su segmento asignado
  // (ej: Patricio "Industrial" → assignedSegment "digital"). Los demás roles con acceso
  // al panel ven todos los segmentos. Fallback: si no tiene segmento asignado, ve todos.
  const isSupervisor = user?.role === 'supervisor';
  const assignedSegment = ((user as any)?.assignedSegment as string | undefined)?.toLowerCase() ?? "";

  // Vendedores del supervisor/encargado: se usan para (a) inferir su segmento cuando no lo
  // tiene asignado directamente y (b) detectar el segmento CONSTRUCCION más abajo.
  const { data: supervisorSalespeople } = useQuery<Array<{ id: string; salespersonName: string; assignedSegment?: string }>>({
    queryKey: ['/api/supervisor', user?.id, 'salespeople'],
    queryFn: async () => {
      const response = await apiRequest(`/api/supervisor/${user?.id}/salespeople`);
      return response.json();
    },
    enabled: !!user && (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // Segmento efectivo del supervisor/encargado: su assignedSegment directo o, si no lo tiene,
  // el segmento de su equipo de vendedores. Ej: Daniel Hermosilla no tiene segmento propio
  // pero su equipo es Ferreterías → se acota a esa única área y (al haber un solo segmento
  // visible) se ocultan las pestañas de categoría.
  const effectiveSegment = useMemo(() => {
    if (assignedSegment) return assignedSegment;
    if ((user?.role === 'supervisor' || user?.role === 'encargado_area') && supervisorSalespeople?.length) {
      const match = SEGMENTOS.find((seg) =>
        supervisorSalespeople.some((sp) => {
          const s = sp.assignedSegment?.toLowerCase() ?? "";
          return s.includes(seg.value) || s.includes(seg.label.toLowerCase());
        })
      );
      if (match) return match.value;
    }
    return "";
  }, [assignedSegment, user?.role, supervisorSalespeople]);

  const visibleSegmentos = useMemo(() => {
    // El rol marketing solo ve el segmento "marketing".
    if (isMarketing) {
      return SEGMENTOS.filter((seg) => seg.value === 'marketing');
    }
    // Para el resto, el área Marketing salió del Panel de Trabajo: se gestiona
    // completa en el módulo Marketing (/marketing).
    const comerciales = SEGMENTOS.filter((seg) => seg.value !== 'marketing');
    // Admin ve/asigna TODOS los segmentos; los demás roles solo el suyo (effectiveSegment).
    if (user?.role !== 'admin' && effectiveSegment) {
      const scoped = comerciales.filter((seg) => effectiveSegment.includes(seg.value));
      if (scoped.length > 0) return scoped;
    }
    return comerciales;
  }, [user?.role, effectiveSegment, isMarketing]);

  // Si el segmento activo no está entre los visibles (ej: supervisor con el default "ferreterias"),
  // reposicionar al primer segmento permitido para que aterrice directo en su área.
  useEffect(() => {
    if (isSalesperson) return;
    if (visibleSegmentos.length > 0 && !visibleSegmentos.some((seg) => seg.value === segmentoFilter)) {
      setSegmentoFilter(visibleSegmentos[0].value);
    }
  }, [visibleSegmentos, isSalesperson, segmentoFilter]);

  // Persiste los filtros del panel por la misma razón que el CRM: no perderlos
  // al abrir el detalle de un cliente/tarea (o navegar fuera) y volver.
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
        status: statusFilter,
        priority: priorityFilter,
        cliente: clienteFilter,
        segmento: segmentoFilter,
      }));
    } catch { /* ignore */ }
  }, [statusFilter, priorityFilter, clienteFilter, segmentoFilter]);

  // Expanded tasks for collapsible assignment details
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  // Filters collapsed state for mobile
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Notes editing state
  const [editingNoteAssignmentId, setEditingNoteAssignmentId] = useState<string | null>(null);
  const [editingNoteTaskId, setEditingNoteTaskId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Confirmación de completar tarea
  const [confirmCompleteTask, setConfirmCompleteTask] = useState<{ taskId: string, assignmentId: string } | null>(null);

  // Estados para Promesas de Compra
  const [searchClient, setSearchClient] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [createPromesaDialogOpen, setCreatePromesaDialogOpen] = useState(false);
  const [editPromesaDialogOpen, setEditPromesaDialogOpen] = useState(false);
  const [selectedPromesa, setSelectedPromesa] = useState<PromesaCumplimiento | null>(null);

  // Estado para vista Calendario
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Estado para controlar la pestaña activa. Se rehidrata desde ?tab= para
  // que "Volver" desde el detalle de un lead del CRM regrese a esta pestaña
  // y no a la raíz del panel.
  // Sin ?tab= el panel abre en SEGUIMIENTO para todos los usuarios (corrección del
  // usuario, ago-2026): es la pestaña con la que arranca el día el equipo comercial.
  // Seguimiento está siempre visible —es una de las tres pestañas fijas—, así que no
  // hay rol que aterrice en una pestaña que no existe para él.
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const validas = ["tareas", "seguimiento", "estimacion", "obras", "crm", "rutas-comerciales", "visitas-tecnicas", "calendario"];
    return tab && validas.includes(tab) ? tab : "seguimiento";
  });

  // Sub-pestaña del Seguimiento. En Construcción no alcanza con seguir clientes:
  // lo que se sigue es la obra, así que la pestaña se abre en dos vistas —los
  // clientes en seguimiento de siempre y el resumen de obras, donde cada una
  // tiene su ficha y su bitácora (ver pages/obras-seguimiento.tsx).
  const [seguimientoVista, setSeguimientoVista] = useState<"clientes" | "obras">("clientes");

  // Buscador de la pestaña Tareas: filtra en vivo por cliente, palabra clave,
  // descripción o asignado (con debounce, mismo patrón que el CRM).
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSearchDebounced, setTaskSearchDebounced] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTaskSearchDebounced(taskSearch), 250);
    return () => clearTimeout(t);
  }, [taskSearch]);

  // Buscador propio de la pestaña Seguimiento: filtra los clientes en seguimiento
  // (nombre del cliente, título del seguimiento o colaborador a cargo). Va aparte
  // del de Tareas para que cada pestaña conserve su búsqueda al ir y volver.
  const [seguimientoSearch, setSeguimientoSearch] = useState("");
  const [seguimientoSearchDebounced, setSeguimientoSearchDebounced] = useState("");
  const [showSeguimientoSuggestions, setShowSeguimientoSuggestions] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSeguimientoSearchDebounced(seguimientoSearch), 250);
    return () => clearTimeout(t);
  }, [seguimientoSearch]);

  // Cambios recientes del panel: badges por pestaña, campana junto a Área y
  // destacado de los ítems modificados al entrar a cada sección.
  const panelChanges = usePanelChangesController({
    enabled: isAuthenticated && !!user,
    segmentoFilter,
    activeTab,
  });

  // Si la URL pide la pestaña CRM pero el usuario no tiene el permiso
  // (link compartido), cae a Tareas en vez de quedar en una pestaña vacía.
  // Espera a que haya usuario: sin él `can()` siempre da false y resetearía
  // la pestaña en un refresh directo de /tareas?tab=crm.
  useEffect(() => {
    if (user && permissionsReady && !showCrmTab && activeTab === "crm") {
      setActiveTab("tareas");
    }
  }, [user, permissionsReady, showCrmTab, activeTab]);

  // Estado para vista de detalle de tarea
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Task Groups state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Vista de la pestaña Tareas: una sola lista plana ("lista") o las tareas
  // completadas juntas ("terminadas"). El agrupado por persona ya no vive acá:
  // esa vista de equipo es ahora la pestaña Seguimiento.
  const [taskView, setTaskView] = useState<'lista' | 'terminadas'>('lista');
  // Clave de la vista (sección + área) con la que se cerraron los grupos por última vez.
  const groupsInitializedRef = useRef<string | false>(false);
  // Grupos que ya pasaron por pantalla: sirve para cerrar solo los que llegan nuevos.
  const gruposVistosRef = useRef<Set<string>>(new Set());
  const [teamSearchFilter, setTeamSearchFilter] = useState("");
  // Seguimiento (vista de equipo): colaboradores sumados "a mano" desde el buscador,
  // para hacerles seguimiento aunque todavía no tengan ningún cliente asignado.
  const [extraSeguimientoMembers, setExtraSeguimientoMembers] = useState<
    Array<{ id: string; name: string; type: 'supervisor' | 'salesperson'; role?: string }>
  >([]);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  // Seguimiento: las cards de colaborador arrancan CERRADAS (vista general del
  // equipo primero, el detalle a un clic). Por eso se guarda lo abierto, no lo
  // colapsado como en los grupos de Tareas.
  const [expandedSeguimientoPeople, setExpandedSeguimientoPeople] = useState<Set<string>>(new Set());
  const togglePersonExpanded = (id: string) => {
    setExpandedSeguimientoPeople((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // Orden de la vista de equipo para tomar acción rápido: por pendientes o por
  // tiempo sin movimiento. Ordena tanto los clientes dentro de cada card como
  // las cards entre sí. 'default' = el orden histórico (más clientes primero).
  const [seguimientoOrden, setSeguimientoOrden] = useState<'default' | 'pendientes' | 'sin-movimiento'>('default');
  const toggleSeguimientoOrden = (orden: 'pendientes' | 'sin-movimiento') =>
    setSeguimientoOrden((prev) => (prev === orden ? 'default' : orden));

  // Selección múltiple / eliminación masiva (solo administrador). En celular queda
  // apagada siempre: el botón que la enciende vive en la barra de escritorio, y si
  // quedaba prendida desde el computador el teléfono mostraba casillas y una barra
  // negra al pie sin forma de salir (pedido del usuario, ago-2026).
  const [selectionModeRaw, setSelectionMode] = useState(false);
  // Celular vs. escritorio. Decide varias cosas de esta pantalla: el selector de
  // "qué crear" (panel lateral en vez de ventana), qué barras se muestran y la
  // selección múltiple.
  const esCelular = useIsMobile();
  const selectionMode = selectionModeRaw && !esCelular;
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Burbuja/tutorial sobre para qué sirven los grupos. Arranca CERRADA siempre: en celular
  // se comía media pantalla antes de la primera tarea, y quien ya sabe qué es un grupo no
  // necesita leerlo (corrección del usuario, ago-2026). Se abre a pedido con el botón de
  // ayuda que está al lado de "Nuevo Grupo".
  const [showGroupsTutorial, setShowGroupsTutorial] = useState(false);
  const dismissGroupsTutorial = () => setShowGroupsTutorial(false);
  const reopenGroupsTutorial = () => setShowGroupsTutorial(true);

  // Consolidated init query - fetches everything in one HTTP roundtrip
  const { data: tareasInit } = useQuery<{
    taskGroups: any[];
    tasks: any[];
    salespeople: any[];
    supervisors: any[];
  }>({
    queryKey: ['/api/tareas/init', { segmento: segmentoFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segmentoFilter && segmentoFilter !== 'all') params.append('segmento', segmentoFilter);
      const res = await fetch(`/api/tareas/init?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Init failed');
      return res.json();
    },
    enabled: isAuthenticated && !!user,
    staleTime: 30000, // 30 seconds
  });

  // Task Groups query
  const taskGroupsQuery = useQuery<Array<{ id: string; name: string; segmento: string; userId: string; color: string | null; sortOrder: number | null; createdAt: Date | null }>>({
    queryKey: ['/api/task-groups', { segmento: segmentoFilter }],
    enabled: isAuthenticated,
    placeholderData: tareasInit?.taskGroups as any,
  });

  // Los proyectos/grupos arrancan SIEMPRE cerrados: al entrar a la sección, al
  // cambiar de área y cada vez que se vuelve (pedido del usuario, ago-2026). Antes
  // se cerraban una sola vez por carga de la página, así que si abrías uno y te ibas
  // a otra sección, al volver seguía desplegado. Mientras estás parado en la sección
  // lo que abras a mano se respeta.
  useEffect(() => {
    const groups = taskGroupsQuery.data;
    if (!groups || groups.length === 0) return;
    const claveVista = `${activeTab}|${segmentoFilter}`;
    if (groupsInitializedRef.current !== claveVista) {
      groupsInitializedRef.current = claveVista;
      setCollapsedGroups(new Set(groups.map((g: any) => g.id)));
      return;
    }
    // Un grupo recién creado o recién llegado del servidor también entra cerrado.
    setCollapsedGroups((prev) => {
      const ids = groups.map((g: any) => g.id);
      const faltantes = ids.filter((id: string) => !prev.has(id) && !gruposVistosRef.current.has(id));
      if (faltantes.length === 0) return prev;
      const next = new Set(prev);
      faltantes.forEach((id: string) => next.add(id));
      return next;
    });
    groups.forEach((g: any) => gruposVistosRef.current.add(g.id));
  }, [taskGroupsQuery.data, activeTab, segmentoFilter]);

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; segmento: string; color?: string }) => {
      const res = await apiRequest('POST', '/api/task-groups', data);
      return await res.json();
    },
    onMutate: async (newGroup) => {
      // Cancel ALL task-groups queries (any segmento)
      await queryClient.cancelQueries({ queryKey: ['/api/task-groups'] });
      await queryClient.cancelQueries({ queryKey: ['/api/tareas/init'] });
      const previousGroups = queryClient.getQueriesData({ queryKey: ['/api/task-groups'] });
      // Optimistically add the new group to ALL matching queries
      queryClient.setQueriesData({ queryKey: ['/api/task-groups'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return [{ id: `temp-${Date.now()}`, ...newGroup, userId: '', color: newGroup.color || 'orange', sortOrder: 0, createdAt: new Date() }];
        return [...old, { id: `temp-${Date.now()}`, ...newGroup, userId: '', color: newGroup.color || 'orange', sortOrder: 0, createdAt: new Date() }];
      });
      setNewGroupName("");
      setShowCreateGroup(false);
      return { previousGroups };
    },
    onSuccess: () => {
      // Use refetchQueries (not invalidateQueries) because staleTime: Infinity prevents auto-refetch
      queryClient.refetchQueries({ queryKey: ['/api/task-groups'] });
      queryClient.refetchQueries({ queryKey: ['/api/tareas/init'] });
      toast({ title: "Grupo creado", description: "El grupo se ha creado exitosamente." });
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previousGroups) {
        context.previousGroups.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
      toast({ title: "Error", description: error.message || "No se pudo crear el grupo.", variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/task-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/task-groups'] });
      queryClient.refetchQueries({ queryKey: ['/api/tareas/init'] });
      queryClient.refetchQueries({ queryKey: ['/api/tasks'] });
      toast({ title: "Grupo eliminado" });
    },
  });

  // Renombrar grupo (inline). Solo el dueño del grupo o un administrador (backend lo valida).
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const renameGroupMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest('PATCH', `/api/task-groups/${id}`, { name });
      return await res.json();
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/task-groups'] });
      const previousGroups = queryClient.getQueriesData({ queryKey: ['/api/task-groups'] });
      queryClient.setQueriesData({ queryKey: ['/api/task-groups'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((g: any) => g.id === id ? { ...g, name } : g);
      });
      setEditingGroupId(null);
      setEditingGroupName("");
      return { previousGroups };
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/task-groups'] });
      queryClient.refetchQueries({ queryKey: ['/api/tareas/init'] });
      toast({ title: "Grupo actualizado" });
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previousGroups) {
        context.previousGroups.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
      toast({ title: "Error", description: error?.message || "No se pudo renombrar el grupo.", variant: "destructive" });
    },
  });
  const startEditingGroup = (id: string, currentName: string) => {
    setEditingGroupId(id);
    setEditingGroupName(currentName);
  };
  const submitEditingGroup = () => {
    const name = editingGroupName.trim();
    if (editingGroupId && name) {
      renameGroupMutation.mutate({ id: editingGroupId, name });
    } else {
      setEditingGroupId(null);
    }
  };

  // Eliminación masiva: borra las tareas seleccionadas (incluidas las de grupos
  // seleccionados) y luego los grupos ya vaciados.
  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ taskIds, groupIds }: { taskIds: string[]; groupIds: string[] }) => {
      for (const id of taskIds) {
        await apiRequest('DELETE', `/api/tasks/${id}`);
      }
      for (const id of groupIds) {
        await apiRequest('DELETE', `/api/task-groups/${id}`);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.refetchQueries({ queryKey: ['/api/tasks'] });
      queryClient.refetchQueries({ queryKey: ['/api/task-groups'] });
      queryClient.refetchQueries({ queryKey: ['/api/tareas/init'] });
      const partes: string[] = [];
      if (vars.taskIds.length) partes.push(`${vars.taskIds.length} tarea${vars.taskIds.length !== 1 ? 's' : ''}`);
      if (vars.groupIds.length) partes.push(`${vars.groupIds.length} grupo${vars.groupIds.length !== 1 ? 's' : ''}`);
      toast({ title: "Eliminación completada", description: partes.length ? `Se eliminó ${partes.join(' y ')}.` : undefined });
      exitSelectionMode();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "No se pudo completar la eliminación masiva.", variant: "destructive" });
    },
  });

  const assignTaskToGroupMutation = useMutation({
    mutationFn: async ({ taskId, groupId }: { taskId: string; groupId: string | null }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, { groupId });
    },
    onMutate: async ({ taskId, groupId }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });
      // Snapshot previous value for rollback
      const previousData = queryClient.getQueriesData({ queryKey: ['/api/tasks'] });
      // Optimistically update all matching task queries
      queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((t: any) => t.id === taskId ? { ...t, groupId } : t);
      });
      return { previousData };
    },
    onError: (_err, _vars, context: any) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
  });

  const toggleGroupCollapsed = (groupId: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setCollapsedGroups(next);
  };

  const toggleTaskSelected = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleGroupSelected = (groupId: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedTaskIds(new Set());
    setSelectedGroupIds(new Set());
  }

  // Resuelve las tareas y grupos a eliminar: las tareas marcadas individualmente
  // más todas las tareas visibles de los grupos marcados.
  const getBulkDeletionTargets = () => {
    const allTasks = (tasksQuery.data || tareasInit?.tasks || []) as Array<{ id: string; groupId?: string | null }>;
    const taskIds = new Set<string>(selectedTaskIds);
    allTasks.forEach(t => {
      if (t.groupId && selectedGroupIds.has(t.groupId)) taskIds.add(t.id);
    });
    return { taskIds: Array.from(taskIds), groupIds: Array.from(selectedGroupIds) };
  };

  // Al cambiar de segmento o de vista, limpiar la selección para no arrastrar
  // tareas/grupos de otro contexto a una eliminación masiva.
  useEffect(() => {
    setSelectedTaskIds(new Set());
    setSelectedGroupIds(new Set());
  }, [segmentoFilter, viewMode]);

  const toggleTaskExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "No autorizado",
        description: "Su sesión ha expirado. Redirigiendo al login...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/login");
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast, setLocation]);

  // Clave estructurada: ["/api/tasks", { status, priority }]. El fetcher por defecto
  // (getQueryFn) arma la URL con esos params, y —clave para el bug de tareas "fantasma"—
  // cualquier invalidate/refetch sobre ["/api/tasks"] hace match parcial con esta variante
  // filtrada. Antes la clave era un único string ["/api/tasks?status=..."], distinto de
  // ["/api/tasks"], por lo que con staleTime:Infinity una tarea borrada por el admin seguía
  // visible para el vendedor que tenía un filtro activo hasta recargar la página.
  const buildTasksQueryKey = () => {
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (priorityFilter !== "all") params.priority = priorityFilter;
    return Object.keys(params).length > 0 ? ["/api/tasks", params] : ["/api/tasks"];
  };

  const tasksQuery = useQuery<Array<Task & { assignments: TaskAssignment[] }>>({
    queryKey: buildTasksQueryKey(),
    enabled: !!user,
    placeholderData: tareasInit?.tasks as any,
  });

  // Query for available users (for assignments)
  const { data: availableUsers } = useQuery<Array<{ id: string; salespersonName: string; role: string }>>({
    queryKey: ["/api/users/salespeople"],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area') || user?.role === 'tecnico_obra',
    placeholderData: tareasInit?.salespeople as any,
  });

  // Vendedor del CRM: vive en el Panel (no en la pestaña) porque su selector va en el
  // encabezado, bajo el de Área (pedido del usuario, ago-2026). Se guarda por sesión con
  // el mismo criterio que los demás filtros del panel: entrar a un cliente y volver no
  // debe perder con quién estabas mirando el pipeline.
  const [crmVendedor, setCrmVendedor] = useState<string>(() => {
    try {
      return sessionStorage.getItem("panel-crm-vendedor") ?? "todos";
    } catch {
      return "todos";
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("panel-crm-vendedor", crmVendedor);
    } catch {
      /* sesión sin storage: el filtro simplemente no sobrevive al remonte */
    }
  }, [crmVendedor]);

  // Vendedor de Estimación de ventas: mismo criterio que el del CRM (pedido del usuario,
  // sep-2026). El selector vive en el encabezado del módulo, no dentro de la pestaña, así
  // que el filtro tiene que vivir acá arriba.
  const [estimacionVendedor, setEstimacionVendedor] = useState<string>(() => {
    try {
      return sessionStorage.getItem("panel-estimacion-vendedor") ?? "all";
    } catch {
      return "all";
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("panel-estimacion-vendedor", estimacionVendedor);
    } catch {
      /* sesión sin storage: el filtro simplemente no sobrevive al remonte */
    }
  }, [estimacionVendedor]);

  // Vendedor de la pestaña Obras: mismo criterio que el del CRM y Estimación, su
  // selector vive en el encabezado (pedido del usuario, sep-2026). "sin-asignar" trae
  // las obras que todavía no tienen dueño.
  const [obrasVendedor, setObrasVendedor] = useState<string>(() => {
    try {
      return sessionStorage.getItem("panel-obras-vendedor") ?? "all";
    } catch {
      return "all";
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("panel-obras-vendedor", obrasVendedor);
    } catch {
      /* sesión sin storage: el filtro simplemente no sobrevive al remonte */
    }
  }, [obrasVendedor]);

  // Vendedores que se ofrecen en el filtro "Vendedor" del panel (pedido del usuario,
  // sep-2026): solo los que tienen algo cargado este año —tareas, seguimiento, CRM,
  // estimación semanal, obras o proyectos— en el área que se está mirando. Antes el CRM
  // listaba todas las cuentas activas (clientes y demo incluidos) y Estimación usaba la
  // lista de asignación de tareas.
  const { data: vendedoresDelPanel = [] } = useQuery<Array<{ id: string; salespersonName: string }>>({
    queryKey: ["/api/panel/vendedores", segmentoFilter],
    queryFn: async () => {
      const res = await fetch(`/api/panel/vendedores?segmento=${encodeURIComponent(segmentoFilter)}`);
      if (!res.ok) throw new Error("Error al cargar vendedores");
      return res.json();
    },
    enabled: !!user && !isSalesperson,
  });

  // Query for available supervisors (for assignments)
  const { data: availableSupervisors } = useQuery<Array<{ id: string; salespersonName: string; role: string }>>({
    queryKey: ["/api/users/salespeople/supervisors"],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area') || user?.role === 'tecnico_obra',
    placeholderData: tareasInit?.supervisors as any,
  });

  // Queries para Promesas de Compra
  // Para Construcción usar período mensual (YYYY-MM), para otros usar semanal (YYYY-WW)
  // Supervisor: verificar si alguno de sus vendedores es de CONSTRUCCION
  const esConstruccion = (() => {
    // Admin (u otro rol con selector de Área): el área elegida es la fuente de verdad.
    if (segmentoFilter === 'construccion') {
      return true;
    }
    // Si el usuario tiene segmento asignado directamente (en cualquiera de los
    // campos por los que puede llegar el segmento del ERP).
    if (esSegmentoConstruccion(segmentoDeUsuario(user))) {
      return true;
    }
    // Si es supervisor, verificar los segmentos de sus vendedores
    if ((user?.role === 'supervisor' || user?.role === 'encargado_area') && supervisorSalespeople && supervisorSalespeople.length > 0) {
      return supervisorSalespeople.some(sp => esSegmentoConstruccion(sp.assignedSegment));
    }
    return false;
  })();

  // Estimación de ventas (promesas de compra) es exclusiva de Ferreterías: es la única
  // área que compromete compras semanales. Industrial y Construcción no la ven —
  // Construcción tiene "Obras" en su lugar e Industrial simplemente no tiene la pestaña.
  const esFerreterias = (() => {
    // Admin (u otro rol con selector de Área): el área elegida es la fuente de verdad.
    if (segmentoFilter === 'ferreterias') {
      return true;
    }
    // Con un área concreta seleccionada distinta de Ferreterías, no aplica.
    if (segmentoFilter !== 'all') {
      return false;
    }
    // Sin selector de área (vendedor, que ve "all"): su segmento asignado.
    if ((user as any)?.assignedSegment?.toLowerCase()?.includes('ferreter')) {
      return true;
    }
    if ((user?.role === 'supervisor' || user?.role === 'encargado_area') && supervisorSalespeople && supervisorSalespeople.length > 0) {
      return supervisorSalespeople.some(sp =>
        sp.assignedSegment?.toLowerCase()?.includes('ferreter')
      );
    }
    return false;
  })();

  // Industrial trabaja por proyectos: su primera pestaña deja de llamarse
  // "Tareas" y pasa a ser "Proyectos", donde cada ficha tiene sus tareas dentro
  // (ver esTareaProyecto). Mismo criterio de detección que Ferreterías.
  const esIndustrial = (() => {
    // Admin (u otro rol con selector de Área): el área elegida manda.
    if (segmentoFilter === 'digital') {
      return true;
    }
    if (segmentoFilter !== 'all') {
      return false;
    }
    // Sin selector de área (vendedor, que ve "all"): su segmento asignado.
    if (esSegmentoIndustrial(segmentoDeUsuario(user))) {
      return true;
    }
    if ((user?.role === 'supervisor' || user?.role === 'encargado_area') && supervisorSalespeople && supervisorSalespeople.length > 0) {
      return supervisorSalespeople.some(sp => esSegmentoIndustrial(sp.assignedSegment));
    }
    return false;
  })();
  // Marketing tiene su propio módulo y el técnico de obra no crea proyectos:
  // la pestaña solo cambia de nombre para el resto del panel.
  const modoProyectos = esIndustrial && showExtraSegmentTabs;
  // Los contadores y textos de la lista solo hablan de proyectos dentro de su
  // propia pestaña: en Seguimiento se siguen contando clientes.
  const vistaProyectos = modoProyectos && activeTab === 'tareas';

  // Construcción cambia dos pestañas: "Estimación de ventas" → "Obras" y
  // "Rutas Comerciales" → "Visitas Técnicas" (que salió del sidebar).
  const showEstimacionTab = showExtraSegmentTabs && esFerreterias;
  const showObrasTab = showExtraSegmentTabs && esConstruccion;
  // Rutas Comerciales es de las áreas que salen a la calle a visitar cartera:
  // Construcción tiene Visitas Técnicas en su lugar e Industrial trabaja por
  // proyectos, así que ninguna de las dos la muestra.
  const showRutasTab = !esConstruccion && !esIndustrial;
  const showVisitasTab = esConstruccion && canVerVisitas;
  // Las mismas pestañas que arma el riel, como datos: en celular se muestran en un
  // desplegable (ver el render) porque en una barra no entran y había que arrastrarlas.
  const tabsVisibles: { value: string; label: string; Icon: typeof CheckSquare }[] = [
    // Seguimiento primera, igual que en el riel: es donde aterriza el panel.
    // Va con UserCheck, no con el edificio: el edificio es el ícono del Área, y en el
    // encabezado los dos chips quedaban idénticos uno arriba del otro (corrección del
    // usuario, ago-2026). Lo que se sigue acá además son clientes, no locales.
    { value: "seguimiento", label: "Seguimiento", Icon: UserCheck },
    { value: "tareas", label: modoProyectos ? "Proyectos" : "Tareas", Icon: modoProyectos ? FolderOpen : CheckSquare },
    ...(showEstimacionTab ? [{ value: "estimacion", label: "Estimación de ventas", Icon: TrendingUp }] : []),
    ...(showObrasTab ? [{ value: "obras", label: "Obras", Icon: HardHat }] : []),
    ...(showCrmTab ? [{ value: "crm", label: "CRM", Icon: Users }] : []),
    ...(showRutasTab ? [{ value: "rutas-comerciales", label: "Rutas Comerciales", Icon: MapPin }] : []),
    ...(showVisitasTab ? [{ value: "visitas-tecnicas", label: "Visitas Técnicas", Icon: FileCheck }] : []),
    { value: "calendario", label: "Calendario", Icon: CalendarIcon },
  ];
  const tabActiva = tabsVisibles.find((t) => t.value === activeTab) ?? tabsVisibles[0];

  const visibleTabCount =
    3 + (showRutasTab ? 1 : 0) + (showVisitasTab ? 1 : 0) + (showEstimacionTab ? 1 : 0) + (showObrasTab ? 1 : 0) + (showCrmTab ? 1 : 0);
  // Centrar la pestaña activa dentro del riel (ver el comentario de tabsListRef).
  useEffect(() => {
    const riel = tabsListRef.current;
    if (!riel) return;
    const id = requestAnimationFrame(() => {
      const activa = riel.querySelector<HTMLElement>('[data-state="active"]');
      if (!activa) return;
      // Se mide con rects y no con offsetLeft: el riel no está posicionado, así que el
      // offsetParent de la pestaña es un ancestro y offsetLeft no sirve como referencia.
      const cajaRiel = riel.getBoundingClientRect();
      const cajaActiva = activa.getBoundingClientRect();
      riel.scrollLeft += (cajaActiva.left - cajaRiel.left) - (cajaRiel.width - cajaActiva.width) / 2;
    });
    return () => cancelAnimationFrame(id);
  }, [activeTab]);

  const tabsGridClass =
    ({ 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 7: 'sm:grid-cols-7', 8: 'sm:grid-cols-8' } as Record<number, string>)[visibleTabCount] ?? 'sm:grid-cols-6';

  // Si el usuario venía parado en una pestaña que el área actual no ofrece
  // (Estimación solo existe en Ferreterías; Rutas Comerciales no existe en
  // Construcción; Visitas Técnicas y Obras solo existen ahí), regresa a Tareas
  // para no quedar en una pestaña sin trigger.
  useEffect(() => {
    if (!showEstimacionTab && activeTab === "estimacion") {
      setActiveTab("tareas");
    }
    if (!showRutasTab && activeTab === "rutas-comerciales") {
      setActiveTab("tareas");
    }
    if (!showObrasTab && activeTab === "obras") {
      setActiveTab("tareas");
    }
    if (!showVisitasTab && activeTab === "visitas-tecnicas") {
      setActiveTab("tareas");
    }
    // La sub-vista de obras del Seguimiento existe solo donde existe la pestaña
    // Obras: cambiando de área vuelve a los clientes en seguimiento.
    if (!showObrasTab && seguimientoVista === "obras") {
      setSeguimientoVista("clientes");
    }
  }, [showEstimacionTab, showObrasTab, showRutasTab, showVisitasTab, activeTab, seguimientoVista]);

  const currentPeriod = esConstruccion
    ? `${getYear(selectedWeek)}-${String(selectedWeek.getMonth() + 1).padStart(2, '0')}`
    : `${getYear(selectedWeek)}-${String(getISOWeek(selectedWeek)).padStart(2, '0')}`;
  const currentYear = getYear(selectedWeek);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clients/search', searchClient],
    queryFn: async () => {
      if (!searchClient || searchClient.length < 3) {
        return [];
      }
      const response = await apiRequest(`/api/clients/search?q=${encodeURIComponent(searchClient)}`);
      return response.json();
    },
    enabled: searchClient.length >= 3,
  });

  const { data: promesasCumplimiento = [], isLoading: isLoadingPromesas } = useQuery<PromesaCumplimiento[]>({
    queryKey: ['/api/promesas-compra/cumplimiento/reporte', currentYear, currentPeriod, esConstruccion],
    queryFn: async () => {
      const response = await apiRequest(`/api/promesas-compra/cumplimiento/reporte?anio=${currentYear}&semana=${currentPeriod}`);
      return response.json();
    },
    // Solo Ferreterías tiene la pestaña: no gastar el request en las demás áreas.
    enabled: !!user && showEstimacionTab,
  });

  // Navegación de período: meses para Construcción, semanas para otros
  const goToPreviousWeek = () => {
    setSelectedWeek(prev => esConstruccion ? subMonths(prev, 1) : subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setSelectedWeek(prev => esConstruccion ? addMonths(prev, 1) : addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(new Date());
  };

  // Estado para búsqueda de clientes en el formulario de tareas
  const [searchClienteTask, setSearchClienteTask] = useState("");
  const [selectedClienteTask, setSelectedClienteTask] = useState<Cliente | null>(null);

  // Query para buscar clientes en el formulario de tareas
  const { data: clientesTask = [] } = useQuery<Cliente[]>({
    queryKey: ['/api/clients/search', 'task-form', searchClienteTask],
    queryFn: async () => {
      if (!searchClienteTask || searchClienteTask.length < 2) {
        return [];
      }
      const response = await apiRequest(`/api/clients/search?q=${encodeURIComponent(searchClienteTask)}`);
      return response.json();
    },
    enabled: searchClienteTask.length >= 2,
  });

  // Form setup
  const form = useForm<CreateTaskWithAssignmentsInput>({
    resolver: zodResolver(createTaskWithAssignmentsSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      segmento: null,
      groupId: null,
      dueDate: "",
      clienteId: null,
      clienteNombre: null,
      assignments: [],
    },
  });

  // El alta de obra vive dentro de la pestaña Obras; el (+) del header la abre
  // desde afuera cuando esa pestaña es la activa (ver `accionNueva`).
  const obrasRef = useRef<ControlObrasHandle>(null);
  // Mismo mecanismo para el alta de ruta comercial y de cliente del CRM: cada
  // pestaña resuelve qué hace el (+) del header (ver `accionNueva`).
  const rutasRef = useRef<RutasComercialesHandle>(null);
  const crmRef = useRef<SeguimientoClientesHandle>(null);
  const puedeCrearRutas = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'encargado_area';

  // "Añadir obra" desde la sub-vista de obras del Seguimiento: la pestaña Obras
  // todavía no está montada (Radix desmonta el contenido inactivo), así que el
  // handle recién existe después de cambiar de pestaña. Queda pendiente y el
  // efecto abre el formulario cuando ya hay a quién pedírselo.
  const [altaObraPendiente, setAltaObraPendiente] = useState(false);
  useEffect(() => {
    if (!altaObraPendiente || activeTab !== 'obras') return;
    obrasRef.current?.nuevaObra();
    setAltaObraPendiente(false);
  }, [altaObraPendiente, activeTab]);

  // Selector "Nueva Tarea": seguimiento de cliente / solicitud de marketing / otras tareas
  const [showChooser, setShowChooser] = useState(false);
  const [taskFlow, setTaskFlow] = useState<'otras' | 'seguimiento' | 'marketing'>('otras');
  const [showMarketingDialog, setShowMarketingDialog] = useState(false);
  const seguimientoMode = taskFlow === 'seguimiento';

  // En modo seguimiento el título por defecto es el nombre del cliente
  useEffect(() => {
    if (seguimientoMode && selectedClienteTask) {
      form.setValue('title', selectedClienteTask.nokoen || '');
    }
  }, [seguimientoMode, selectedClienteTask]);

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskWithAssignmentsInput) => {
      return await apiRequest("POST", "/api/tasks", taskData);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      setShowCreateDialog(false);
      form.reset();
      setSelectedClienteTask(null);
      setSearchClienteTask("");
      // Aterrizar en la pestaña donde el ítem recién creado será visible.
      const esSeguimiento = (vars as any)?.payload?.kind === 'seguimiento_cliente';
      setActiveTab(esSeguimiento ? "seguimiento" : "tareas");
      toast({
        title: esSeguimiento ? "Seguimiento creado" : "Tarea creada",
        description: esSeguimiento ? "El seguimiento se ha creado exitosamente." : "La tarea se ha creado exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error("Task creation error:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la tarea.",
        variant: "destructive",
      });
    },
  });

  // Devuelve una asignación a pendiente. Vive aparte de la mutación porque el
  // aviso de "tarea completada" ofrece deshacer, y desde su propio onSuccess la
  // mutación no puede referenciarse a sí misma.
  const reabrirAsignacion = async (taskId: string, assignmentId: string) => {
    try {
      await apiRequest("PATCH", `/api/tasks/${taskId}/assignments/${assignmentId}`, { status: 'pending' });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudo reabrir la tarea.",
        variant: "destructive",
      });
    }
  };

  // Update assignment status mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ taskId, assignmentId, status, notes }: { taskId: string; assignmentId: string; status?: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}/assignments/${assignmentId}`, {
        status: status || undefined,
        notes: notes || undefined
      });
    },
    onMutate: async ({ taskId, assignmentId, status }) => {
      // Optimistic update: immediately update the UI
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previousTasks = queryClient.getQueryData(["/api/tasks"]);
      queryClient.setQueryData(["/api/tasks"], (old: any) => {
        if (!old) return old;
        return old.map((t: any) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            status: status === 'completed' ? 'completada' : t.status,
            assignments: t.assignments.map((a: any) =>
              a.id === assignmentId ? { ...a, status: status || a.status } : a
            ),
          };
        });
      });
      return { previousTasks };
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      // Completar saca la tarea de la lista (se va a "Terminadas"). Sin este aviso
      // la tarea simplemente desaparece y no se ve cómo volver atrás.
      if (vars.status === 'completed') {
        toast({
          title: "Tarea completada",
          description: 'Pasó a "Terminadas". Podés reabrirla desde ahí.',
          action: (
            <ToastAction
              altText="Reabrir la tarea"
              onClick={() => reabrirAsignacion(vars.taskId, vars.assignmentId)}
            >
              Reabrir
            </ToastAction>
          ),
        });
      }
    },
    onError: (error: any, _vars, context: any) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }
      console.error("Assignment update error:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado.",
        variant: "destructive",
      });
    },
  });

  // Mark assignment as read mutation (acusar recibo)
  const markAsReadMutation = useMutation({
    mutationFn: async ({ taskId, assignmentId }: { taskId: string; assignmentId: string }) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}/assignments/${assignmentId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      toast({
        title: "Recibo acusado",
        description: "Has confirmado que recibiste la tarea.",
      });
    },
    onError: (error: any) => {
      console.error("Mark as read error:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo acusar recibo.",
        variant: "destructive",
      });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Área efectiva de una tarea, para el filtro de arriba.
  //
  // Antes se usaba `task.segmento` a secas y las tareas guardadas SIN área
  // quedaban invisibles con cualquier área seleccionada: solo aparecían con el
  // filtro en "todas", que casi nadie usa. Así se perdieron de vista 8
  // seguimientos de obra cargados en lote, que ni el administrador ni el
  // supervisor veían aunque el vendedor sí los tenía.
  //
  // Ahora, si la tarea no trae área, se deduce del área del colaborador que la
  // tiene asignada. Si tampoco se puede deducir, la tarea se muestra en todas
  // las áreas: preferimos que aparezca de más y no que desaparezca.
  const raizArea = (s?: string | null) => normalizeSearchText(s || "").trim().replace(/s+$/, "");
  const areaEfectivaDeTarea = (task: any): string | null => {
    const propia = (task?.segmento || "").trim();
    if (propia) return propia;
    for (const a of task?.assignments || []) {
      const persona =
        availableUsers?.find((u) => u.id === a.assigneeId) ||
        availableSupervisors?.find((u) => u.id === a.assigneeId);
      const raiz = raizArea(segmentoDeUsuario(persona));
      if (!raiz) continue;
      const match = SEGMENTOS.find(
        (seg) => raizArea(seg.value) === raiz || raizArea(seg.label) === raiz,
      );
      if (match) return match.value;
    }
    return null;
  };

  // Filter tasks based on view mode and user role
  const filteredTasks = tasksQuery.data?.filter((task) => {
    // View mode filter
    if (viewMode === "my-tasks") {
      // Show tasks assigned to me or that I created
      const isAssignedToMe = task.assignments.some(assignment =>
        (assignment.assigneeType === "supervisor" && assignment.assigneeId === user.id) ||
        (assignment.assigneeType === "salesperson" && assignment.assigneeId === user.id)
      );
      const isCreatedByMe = task.createdByUserId === user.id;
      if (!isAssignedToMe && !isCreatedByMe) return false;
    }

    // Separación por pestaña: "Tareas" (normales) vs "Seguimiento" (clientes).
    // Otras pestañas (ej. calendario) no aplican este filtro y ven todo.
    const isSeguimientoTask = (task as any).payload?.kind === 'seguimiento_cliente';
    if (activeTab === 'seguimiento' && !isSeguimientoTask) return false;
    if (activeTab === 'tareas' && isSeguimientoTask) return false;

    // Buscador: cada término debe calzar en título, descripción, cliente o
    // asignado (sin tildes ni mayúsculas). Aplica en Tareas;
    // Seguimiento tiene su propio buscador de equipo.
    if (activeTab === 'tareas' && taskSearchDebounced.trim()) {
      const terms = normalizeSearchText(taskSearchDebounced).split(/\s+/).filter(Boolean);
      const assigneeNames = task.assignments
        .map((a) =>
          availableUsers?.find((s) => s.id === a.assigneeId)?.salespersonName ||
          availableSupervisors?.find((s) => s.id === a.assigneeId)?.salespersonName ||
          "")
        .join(" ");
      const haystack = normalizeSearchText(
        `${task.title} ${task.description ?? ""} ${(task as any).clienteNombre ?? ""} ${assigneeNames}`,
      );
      if (!terms.every((t) => haystack.includes(t))) return false;
    }

    // Buscador de Seguimiento: mismo criterio (cliente, título, colaborador).
    if (activeTab === 'seguimiento' && seguimientoSearchDebounced.trim()) {
      const terms = normalizeSearchText(seguimientoSearchDebounced).split(/\s+/).filter(Boolean);
      const assigneeNames = task.assignments
        .map((a) =>
          availableUsers?.find((s) => s.id === a.assigneeId)?.salespersonName ||
          availableSupervisors?.find((s) => s.id === a.assigneeId)?.salespersonName ||
          "")
        .join(" ");
      const haystack = normalizeSearchText(
        `${task.title} ${task.description ?? ""} ${(task as any).clienteNombre ?? ""} ${assigneeNames}`,
      );
      if (!terms.every((t) => haystack.includes(t))) return false;
    }

    // Cliente filter
    if (clienteFilter === "with-client" && !(task as any).clienteId) return false;
    if (clienteFilter === "without-client" && (task as any).clienteId) return false;

    // Segmento filter (skip for salesperson - they see all their tasks regardless of segment)
    if (!isSalesperson && segmentoFilter !== "all") {
      const areaEfectiva = areaEfectivaDeTarea(task);
      const matchesSegment = areaEfectiva === segmentoFilter;
      if (isMarketing) {
        // Marketing ve su segmento MÁS las tareas que le asignaron/creó (de cualquier
        // segmento) — "sus tareas de marketing y las otras que le van asociando".
        const isMine =
          task.createdByUserId === user.id ||
          task.assignments.some(
            (a) =>
              (a.assigneeType === "supervisor" ||
                a.assigneeType === "salesperson" ||
                (a as any).assigneeType === "user") &&
              a.assigneeId === user.id,
          );
        if (!matchesSegment && !isMine) return false;
      } else if (areaEfectiva && !matchesSegment) {
        return false;
      }
    }

    return true;
  })?.sort((a, b) => {
    // 1. Completed tasks go to the bottom
    const aCompleted = a.status === 'completada' || a.assignments.some(as => as.status === 'completed') ? 1 : 0;
    const bCompleted = b.status === 'completada' || b.assignments.some(as => as.status === 'completed') ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    // 2. High priority first
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const aPrio = priorityOrder[a.priority ?? 'medium'] ?? 1;
    const bPrio = priorityOrder[b.priority ?? 'medium'] ?? 1;
    return aPrio - bPrio;
  }) || [];

  // Calendario: mostrar únicamente lo relacionado de cualquier forma con el
  // usuario logueado (tareas que creó o que le fueron asignadas), sin importar
  // el rol ni los filtros de las otras pestañas. Se deriva de todos los datos
  // (no de filteredTasks) para que el calendario sea siempre "lo mío".
  const calendarTasks = (tasksQuery.data || []).filter((task) => {
    const isCreatedByMe = task.createdByUserId === user.id;
    const isAssignedToMe = task.assignments.some(
      (a) =>
        (a.assigneeType === "supervisor" ||
          a.assigneeType === "salesperson" ||
          (a as any).assigneeType === "user") &&
        a.assigneeId === user.id,
    );
    return isCreatedByMe || isAssignedToMe;
  });

  // Selected task for detail view
  const selectedTask = selectedTaskId ? filteredTasks.find(t => t.id === selectedTaskId) || tasksQuery.data?.find(t => t.id === selectedTaskId) || null : null;

  // Get unique clients from tasks for filter dropdown
  const clientesEnTareas = Array.from(new Set(
    (tasksQuery.data || [])
      .filter((t) => (t as any).clienteNombre)
      .map((t) => (t as any).clienteNombre)
  ));

  // Semáforo de crédito de la lista de Seguimiento: la cartera de todos los
  // clientes en seguimiento en UNA consulta (una fila no puede pedir la suya).
  // Se arma con todos los seguimientos, no con los filtrados, para que buscar no
  // dispare una consulta nueva por cada tecla.
  const codigosEnSeguimiento = useMemo(
    () => Array.from(new Set(
      (tasksQuery.data || [])
        .filter((t) => (t as any).payload?.kind === 'seguimiento_cliente')
        .map((t) => String((t as any).clienteId || "").trim())
        .filter((c) => c && c !== 'PROSPECTO')
    )),
    [tasksQuery.data],
  );
  const { data: creditoPorCliente } = useCreditoSemaforo(codigosEnSeguimiento);

  // Clientes que hoy están en seguimiento — alimentan las sugerencias del
  // buscador de esa pestaña (el título del seguimiento es el nombre del cliente
  // cuando la tarea no trae clienteNombre).
  const clientesEnSeguimiento = Array.from(new Set(
    (tasksQuery.data || [])
      .filter((t) => (t as any).payload?.kind === 'seguimiento_cliente')
      .map((t) => String((t as any).clienteNombre || t.title || "").trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es'));

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pendiente": return <Clock className="h-4 w-4 text-blue-500" />;
      case "en_progreso": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "completada": return <CheckSquare className="h-4 w-4 text-green-500" />;
      case "bloqueada": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "cancelada": return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pendiente: "outline",
      en_progreso: "secondary",
      completada: "default",
      bloqueada: "destructive",
      cancelada: "outline",
    };

    const labels: Record<string, string> = {
      pendiente: "Pendiente",
      en_progreso: "En Progreso",
      completada: "Completada",
      bloqueada: "Bloqueada",
      cancelada: "Cancelada",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      low: "secondary",
      medium: "secondary",
      high: "destructive",
    };

    const labels: Record<string, string> = {
      low: "Baja",
      medium: "Media",
      high: "Alta",
    };

    return (
      <Badge variant={variants[priority] || "outline"}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  const getAssigneeDisplay = (assignment: TaskAssignment) => {
    if (assignment.assigneeType === "supervisor") {
      const supervisorInfo = availableSupervisors?.find(s => s.id === assignment.assigneeId);
      return (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>{supervisorInfo?.salespersonName || assignment.assigneeId}</span>
        </div>
      );
    } else if (assignment.assigneeType === "salesperson") {
      const salespersonInfo = availableUsers?.find(u => u.id === assignment.assigneeId);
      return (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>{salespersonInfo?.salespersonName || assignment.assigneeId}</span>
        </div>
      );
    }
    return null;
  };

  // A quién le llega una tarea nueva. Ya no se elige a mano (pedido del usuario,
  // ago-2026): el selector "Equipo asignado" salió del formulario y la tarea queda
  // siempre para el que la crea, su supervisor y la administración.
  //
  // - el que la crea, porque si no queda fuera: al vendedor solo le aparecen las
  //   tareas donde figura como asignado, no las que escribió.
  // - su supervisor, tomado de la ficha del creador. Si en su ficha no hay
  //   supervisor cargado, ese no se agrega y la tarea igual se crea.
  // - la administración: todas las cuentas de rol admin.
  //
  // La lista de gente sale de la carga inicial del panel, que llega para todos los
  // roles; `availableUsers` (que no se pide para vendedor ni marketing) va primero
  // por si ya está fresca.
  const personasDelSistema = (availableUsers || tareasInit?.salespeople || []) as Array<{ id: string; role: string }>;
  const asignacionesPorDefecto = (): CreateTaskWithAssignmentsInput['assignments'] => {
    const ids: string[] = [user.id];
    const supervisorDelCreador = (user as any).supervisorId as string | undefined | null;
    if (supervisorDelCreador) ids.push(supervisorDelCreador);
    personasDelSistema.forEach((p) => { if (p.role === 'admin') ids.push(p.id); });
    // Sin repetidos: el creador puede ser él mismo un admin, o su propio supervisor.
    return Array.from(new Set(ids)).map((id) => {
      const rol = personasDelSistema.find((p) => p.id === id)?.role;
      return { assigneeType: rol === 'supervisor' ? 'supervisor' : 'salesperson', assigneeId: id } as const;
    });
  };

  const handleSubmit = (data: CreateTaskWithAssignmentsInput) => {
    // En modo seguimiento marcamos la tarea con payload.kind para la vista por-cliente.
    // En Industrial lo que se crea desde esta pestaña es un proyecto, que también
    // es un espacio de trabajo con tareas adentro (ver esTareaProyecto).
    const payload = seguimientoMode
      ? { kind: 'seguimiento_cliente' }
      : modoProyectos
        ? { kind: 'proyecto' }
        : undefined;
    // En "Nuevo seguimiento" el asignado ES el colaborador al que se le entrega el
    // cliente, así que ahí manda lo que se eligió en pantalla. En el resto de las
    // tareas y proyectos la asignación es automática (ver `asignacionesPorDefecto`).
    const assignments = seguimientoMode ? data.assignments : asignacionesPorDefecto();
    createTaskMutation.mutate({ ...data, assignments, ...(payload ? { payload } : {}) } as any);
  };

  // Abre el flujo "Nuevo Seguimiento" (responsable → cliente). Si se pasa un miembro,
  // queda preseleccionado como responsable para asignarle su primer cliente en un paso.
  const openNuevoSeguimiento = (member?: { id: string; type: 'supervisor' | 'salesperson' }) => {
    setTaskFlow('seguimiento');
    setSelectedClienteTask(null);
    setSearchClienteTask("");
    form.reset({
      title: "", description: "", priority: "medium",
      segmento: segmentoFilter !== 'all' ? segmentoFilter : null,
      groupId: null, dueDate: "", clienteId: null, clienteNombre: null,
      // Acá el asignado es el responsable del seguimiento, no el equipo que se
      // entera: si no vino elegido de antes, la lista arranca vacía para que se
      // elija en pantalla (no se le aplica la asignación automática de las tareas).
      assignments: member ? [{ assigneeType: member.type, assigneeId: member.id }] : [],
    });
    setShowCreateDialog(true);
  };

  // El vendedor crea, edita y marca sus propias tareas dentro de su pestaña
  // (debe coincidir con el allowlist del backend en POST /api/tasks).
  const canCreateTasks = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || user.role === 'salesperson' || user.role === 'tecnico_obra' || user.role === 'marketing';
  // Quién puede enviar Solicitudes de Marketing (debe coincidir con el allowlist del backend
  // en POST /api/marketing/solicitudes): admin/supervisor/encargado y el vendedor, que canaliza
  // pedidos de sus clientes. Ya no es un botón propio: es una opción más del
  // selector "¿Qué querés crear?". El técnico de obra no la ve.
  const canRequestMarketing = user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area' || user.role === 'salesperson';

  // KPIs presentacionales — reutilizan la misma lógica de completado que las tarjetas
  const isTaskDone = (t: typeof filteredTasks[number]) =>
    t.status === 'completada' || t.assignments.some((a) => a.status === 'completed');
  const kpiTotal = filteredTasks.length;
  const kpiCompletadas = filteredTasks.filter(isTaskDone).length;
  const kpiPendientes = kpiTotal - kpiCompletadas;
  const kpiVencidas = filteredTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && !isTaskDone(t)
  ).length;

  // Qué pill de Vendedor corresponde a la pestaña que se está mirando (ninguno en las
  // demás: un filtro que no filtra nada de lo que se ve confunde más de lo que ayuda).
  const opcionesVendedor = vendedoresDelPanel.map((v) => ({ id: v.id, nombre: v.salespersonName }));

  // Si el vendedor guardado de la sesión ya no está en la lista (cambió de área, o dejó
  // de tener movimiento), el Select quedaría en blanco: se vuelve a "todos".
  //
  // Va ARRIBA del early return del detalle de tarea a propósito: abajo quedaba como un
  // hook que solo se ejecutaba en la vista de lista, y al abrir la ficha de un cliente
  // React contaba menos hooks que en el render anterior ("Rendered fewer hooks than
  // expected") y tiraba abajo la página entera —pantalla en blanco (sep-2026).
  useEffect(() => {
    if (opcionesVendedor.length === 0) return;
    if (crmVendedor !== 'todos' && !opcionesVendedor.some((v) => v.id === crmVendedor)) setCrmVendedor('todos');
    if (estimacionVendedor !== 'all' && !opcionesVendedor.some((v) => v.id === estimacionVendedor)) setEstimacionVendedor('all');
    if (obrasVendedor !== 'all' && obrasVendedor !== 'sin-asignar' && !opcionesVendedor.some((v) => v.id === obrasVendedor)) setObrasVendedor('all');
  }, [vendedoresDelPanel]);

  // El detalle de tarea se muestra como PÁGINA dentro del área de contenido
  // (el sidebar del DashboardLayout queda visible a la izquierda), no como modal.
  if (selectedTaskId && selectedTask) {
    return (
      <div className="p-2 sm:p-3">
        <TaskDetailDialog
          task={selectedTask}
          open
          onClose={() => setSelectedTaskId(null)}
          user={user}
          availableUsers={availableUsers}
          availableSupervisors={availableSupervisors}
          getStatusBadge={getStatusBadge}
          getPriorityBadge={getPriorityBadge}
          updateAssignmentMutation={updateAssignmentMutation}
          markAsReadMutation={markAsReadMutation}
          taskGroups={taskGroupsQuery.data || []}
          assignTaskToGroupMutation={assignTaskToGroupMutation}
          esProyecto={esTareaProyecto(selectedTask, modoProyectos)}
        />
      </div>
    );
  }

  // Botón (+) del header: hace lo que dice la pestaña que se está mirando.
  // Antes era un único "Nueva Tarea" (y para el vendedor, un "Solicitar a
  // Marketing" que no tenía que ver con lo que estaba haciendo).
  const accionNueva: { label: string; onClick: () => void } = (() => {
    if (activeTab === 'obras') {
      return { label: 'Añadir obra', onClick: () => obrasRef.current?.nuevaObra() };
    }
    if (activeTab === 'seguimiento') {
      // La sub-vista de obras es de lectura y bitácora; el alta sigue viviendo
      // en la pestaña Obras, así que el (+) salta para allá y abre el formulario
      // cuando esa pestaña ya se montó (ver `altaObraPendiente`).
      if (seguimientoVista === 'obras') {
        return {
          label: 'Añadir obra',
          onClick: () => { setAltaObraPendiente(true); setActiveTab('obras'); },
        };
      }
      return { label: 'Añadir seguimiento', onClick: () => openNuevoSeguimiento() };
    }
    if (activeTab === 'crm') {
      return { label: 'Nuevo cliente', onClick: () => crmRef.current?.nuevoCliente() };
    }
    // Estimación de ventas: el (+) abre la promesa (su botón subió al encabezado,
    // pedido del usuario sep-2026). El diálogo lo controla el Panel, así que no
    // hace falta un ref a la pestaña.
    if (activeTab === 'estimacion') {
      return { label: 'Nueva promesa', onClick: () => setCreatePromesaDialogOpen(true) };
    }
    // Crear rutas es de supervisor/encargado/admin (mismo `canManage` que usa el
    // módulo): al vendedor no le ofrecemos una acción que no puede hacer y el
    // (+) vuelve a ser la tarea.
    if (activeTab === 'rutas-comerciales' && puedeCrearRutas) {
      return { label: 'Nueva ruta', onClick: () => rutasRef.current?.nuevaRuta() };
    }
    return {
      label: modoProyectos ? 'Añadir proyecto' : 'Añadir tarea',
      onClick: () => {
        if (isMarketing) {
          // La encargada de Marketing crea directo una tarea de su área:
          // saltar el selector y abrir el formulario estándar con segmento = marketing.
          setTaskFlow('otras');
          setSelectedClienteTask(null);
          setSearchClienteTask("");
          form.reset({ title: "", description: "", priority: "medium", segmento: 'marketing', groupId: null, dueDate: "", clienteId: null, clienteNombre: null, assignments: asignacionesPorDefecto() });
          setShowCreateDialog(true);
          return;
        }
        setShowChooser(true);
      },
    };
  })();

  // Botón naranjo del encabezado. Se declara una sola vez porque tiene dos lugares
  // posibles: junto al Vendedor (escritorio, cuando esa pestaña filtra por cartera) o
  // a la derecha del Área / al final de la pila en celular.
  const botonAccionNueva = (
    <Button onClick={accionNueva.onClick} className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all" data-testid="button-create-task">
      <Plus className="h-4 w-4 mr-2" />
      {accionNueva.label}
    </Button>
  );

  // En Seguimiento (vista Clientes) el alta ya vive abajo, en la barra de la
  // cartera ("Nuevo seguimiento", al lado de "Agregar colaborador") y en el
  // estado vacío: ahí es donde se está mirando el equipo. Repetirla arriba
  // dejaba dos botones naranjos para la misma acción, así que el (+) del header
  // desaparece en esa vista — en celular y en escritorio por igual. Solo para
  // quien ve esa barra (mismo permiso que la habilita); a los demás les sigue
  // quedando el botón de arriba como único camino.
  // Vale para TODOS los roles por igual (pedido del usuario, ago-2026): la pantalla se
  // ve igual para cualquiera que entre, no cambia según el cargo.
  const altaSeguimientoEnLaLista =
    activeTab === 'seguimiento' && seguimientoVista === 'clientes';

  // En Obras el (+) bajó a la barra de la cartera, al lado de "Agregar constructora":
  // ahí están las dos acciones de la pantalla, y arriba quedaba lejos de lo que se mira.
  const mostrarBotonAccion = activeTab !== 'obras' && !altaSeguimientoEnLaLista;

  // Selector de Área — la card-pill con el ícono de edificio y el dropdown de segmento.
  // Vive SIEMPRE en el header (junto a "Nueva Tarea"), en todas las pestañas, para
  // que el administrador pueda cambiar de área desde cualquier vista.
  const areaSelector = (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm">
      {/* Ícono naranjo suelto, sin recuadro de color detrás (corrección del usuario,
          ago-2026). El Área es el contexto del módulo, no una acción: primero se le
          quitó el relleno sólido —competía con el botón principal— y después también
          el tinte claro, que seguía leyéndose como un botón chico. */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg text-[#fd6301] flex-shrink-0">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-900 dark:text-slate-100 mb-0.5">Área</span>
        <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
          <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-1.5 w-auto bg-transparent font-normal text-[13px] text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleSegmentos.map((seg) => (
              <SelectItem key={seg.value} value={seg.value}>{seg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // Selector de Vendedor: mismo pill que el de Área, una fila más abajo (pedido del
  // usuario, ago-2026). Lo usan la pestaña CRM y la de Estimación de ventas —las dos
  // filtran por cartera— y solo aparece para quien ve más de una: un vendedor mira la
  // suya y el selector no tendría nada que elegir.
  const pillVendedor = (opts: {
    value: string;
    onChange: (v: string) => void;
    opciones: Array<{ id: string; nombre: string }>;
    valorTodos: string;
    etiquetaTodos: string;
    /** Opciones propias de la pestaña que van justo debajo de "Todos". */
    extras?: Array<{ id: string; nombre: string }>;
    testId: string;
  }) => (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg text-[#fd6301] flex-shrink-0">
        {/* `User`, no `UserCheck`: ese último es el ícono de la pestaña Seguimiento y
            dos controles con el mismo ícono se leen como el mismo control. */}
        <User className="h-4 w-4" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-900 dark:text-slate-100 mb-0.5">Vendedor</span>
        <Select value={opts.value} onValueChange={opts.onChange}>
          <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-1.5 w-auto bg-transparent font-normal text-[13px] text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid={opts.testId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={opts.valorTodos}>{opts.etiquetaTodos}</SelectItem>
            {(opts.extras ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
            ))}
            {opts.opciones.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // Recibe un sufijo para el data-testid porque en celular y en escritorio se dibuja
  // en lugares distintos de la pila (una sola de las dos copias es visible a la vez).
  const selectorVendedorPara = (sufijo = '') => {
    if (isSalesperson) return null;
    // Con un solo vendedor el filtro no filtra nada: se esconde entero (pedido del
    // usuario, sep-2026) en vez de ofrecer un desplegable de una sola opción.
    if (opcionesVendedor.length < 2) return null;
    if (activeTab === 'crm') {
      return pillVendedor({
        value: crmVendedor,
        onChange: setCrmVendedor,
        opciones: opcionesVendedor,
        valorTodos: 'todos',
        etiquetaTodos: 'Todos los vendedores',
        testId: `select-vendedor-panel${sufijo}`,
      });
    }
    if (activeTab === 'obras' && puedeFiltrarPorVendedor) {
      return pillVendedor({
        value: obrasVendedor,
        onChange: setObrasVendedor,
        opciones: opcionesVendedor,
        valorTodos: 'all',
        etiquetaTodos: 'Todos',
        // Las obras que quedaron sin dueño: se filtran acá para poder asignarles
        // vendedor desde el formulario de la obra.
        extras: [{ id: 'sin-asignar', nombre: 'Sin asignar' }],
        testId: `select-obras-vendedor${sufijo}`,
      });
    }
    if (activeTab === 'estimacion' && puedeFiltrarPorVendedor) {
      return pillVendedor({
        value: estimacionVendedor,
        onChange: setEstimacionVendedor,
        opciones: opcionesVendedor,
        valorTodos: 'all',
        etiquetaTodos: 'Todos',
        testId: `select-filtro-vendedor${sufijo}`,
      });
    }
    return null;
  };
  const hayselectorVendedor = selectorVendedorPara() !== null;

  // Badge naranja de cambios no vistos de una pestaña (misma familia que el
  // pill de conteo de Solicitudes de Marketing).
  const tabChangeBadge = (tab: string) => {
    const section = PANEL_TAB_TO_SECTION[tab];
    const count = section ? panelChanges.counts[section] ?? 0 : 0;
    if (!count) return null;
    return (
      <span
        /* Antes se invertía a blanco sobre la píldora naranja; con la pestaña activa
           sin relleno el badge se queda siempre naranjo con texto blanco. */
        className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#fd6301] text-white text-[10px] font-bold shadow-sm shadow-orange-500/30"
        data-testid={`badge-tab-changes-${tab}`}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  // Radix solo dispara onValueChange al CAMBIAR de pestaña; al re-pinchar la
  // activa igual damos por vistos sus cambios (el badge desaparece y las
  // tarjetas modificadas quedan destacadas).
  // Selector de sección para celular. Vive en el encabezado, arriba de todo, justo debajo
  // del título del módulo (corrección del usuario, ago-2026): es lo primero que hay que
  // saber al entrar —en qué sección estás— y abajo del botón de acción quedaba escondido.
  const selectorSeccionMovil = (
    <div className={`sm:hidden ${isMarketing ? 'hidden' : ''}`}>
      <Select value={activeTab} onValueChange={setActiveTab}>
        <SelectTrigger
          className="w-full h-auto gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm focus:ring-0 focus:ring-offset-0 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-60"
          data-testid="select-tab-movil"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Ícono naranjo suelto, igual que el del Área: las dos tarjetas van una
                sobre la otra y cualquier fondo las hacía competir con el botón. */}
            <div className="flex items-center justify-center w-9 h-9 rounded-xl text-[#fd6301] shrink-0">
              <tabActiva.Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start leading-none min-w-0">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-900 dark:text-slate-100 mb-0.5">Sección</span>
              <span className="font-normal text-sm text-slate-700 dark:text-slate-100 truncate">{tabActiva.label}</span>
            </div>
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-2xl">
          {tabsVisibles.map(({ value, label, Icon }) => (
            <SelectItem key={value} value={value} className="rounded-lg" data-testid={`select-tab-${value}`}>
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-[#fd6301]" />
                {label}
                {tabChangeBadge(value)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const handleTabTriggerClick = (tab: string) => {
    if (tab !== activeTab) return; // el cambio de pestaña lo maneja el efecto del hook
    const section = PANEL_TAB_TO_SECTION[tab];
    if (section) panelChanges.enterSection(section);
  };

  // Sugerencias del buscador: clientes presentes en las tareas que calzan con
  // lo tipeado ("identifica clientes"); elegir uno filtra la lista por él.
  const searchSuggestions = taskSearch.trim().length >= 1
    ? clientesEnTareas
        .filter((c) => normalizeSearchText(String(c)).includes(normalizeSearchText(taskSearch.trim())))
        .slice(0, 6)
    : [];

  // Buscador de tareas — tarjeta-pill de la misma familia que Vista/Estado/Prioridad.
  const taskSearchBox = (
    <div className="relative flex-1 min-w-[220px] max-w-md">
      <div className="flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-3 py-2.5 shadow-sm hover:border-sky-200 hover:shadow focus-within:border-sky-300 transition-all">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 flex-shrink-0">
          <Search className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-none flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Buscar</span>
          <input
            value={taskSearch}
            onChange={(e) => { setTaskSearch(e.target.value); setShowSearchSuggestions(true); }}
            onFocus={() => setShowSearchSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 150)}
            placeholder="Cliente o palabra clave…"
            className="h-5 w-full bg-transparent border-0 outline-none font-semibold text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500 p-0"
            data-testid="input-task-search"
          />
        </div>
        {taskSearch && (
          <button
            onClick={() => { setTaskSearch(""); setShowSearchSuggestions(false); }}
            className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
            data-testid="button-clear-task-search"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showSearchSuggestions && searchSuggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">Clientes</div>
          {searchSuggestions.map((c) => (
            <button
              key={String(c)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setTaskSearch(String(c)); setShowSearchSuggestions(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
              data-testid={`suggestion-cliente-${String(c)}`}
            >
              <Building2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">{String(c)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Buscador de la pestaña Seguimiento: filtra los clientes en seguimiento sin
  // importar de quién sean. Con sugerencias de los clientes que ya están en
  // seguimiento, para llegar en dos teclas al que se busca.
  const seguimientoSuggestions = seguimientoSearch.trim().length >= 1
    ? clientesEnSeguimiento
        .filter((c) => normalizeSearchText(c).includes(normalizeSearchText(seguimientoSearch.trim())))
        .slice(0, 6)
    : [];

  const seguimientoSearchBox = (
    <div className="relative flex-1 min-w-[220px]">
      <div className="flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-3 py-2.5 shadow-sm hover:border-orange-200 hover:shadow focus-within:border-orange-300 transition-all">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex-shrink-0">
          <Search className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-none flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-900 dark:text-slate-100 mb-0.5">Buscar cliente</span>
          <input
            value={seguimientoSearch}
            onChange={(e) => { setSeguimientoSearch(e.target.value); setShowSeguimientoSuggestions(true); }}
            onFocus={() => setShowSeguimientoSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSeguimientoSuggestions(false), 150)}
            placeholder="Nombre del cliente o del colaborador…"
            className="h-5 w-full bg-transparent border-0 outline-none font-semibold text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500 p-0"
            data-testid="input-seguimiento-search"
          />
        </div>
        {seguimientoSearch && (
          <button
            onClick={() => { setSeguimientoSearch(""); setShowSeguimientoSuggestions(false); }}
            className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
            data-testid="button-clear-seguimiento-search"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showSeguimientoSuggestions && seguimientoSuggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">Clientes en seguimiento</div>
          {seguimientoSuggestions.map((c) => (
            <button
              key={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setSeguimientoSearch(c); setShowSeguimientoSuggestions(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
              data-testid={`suggestion-seguimiento-${c}`}
            >
              <Building2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <PanelChangesContext.Provider value={panelChanges}>
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 space-y-6">
      {/* Header */}
      <div className="space-y-4 sm:space-y-6">
        {/* `relative` para poder anclar la campana arriba a la derecha en celular. */}
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/25">
                <CheckSquare className="w-5 h-5" />
              </span>
              Panel de Trabajo
            </h1>
            {/* La bajada del módulo no se muestra en celular (corrección del usuario,
                ago-2026): ocupaba dos líneas de la primera pantalla para explicar algo
                que el propio panel ya muestra. */}
            <p className="hidden sm:block text-sm text-muted-foreground">
              Gestiona tareas del equipo, estimaciones de ventas y seguimiento de clientes
            </p>
          </div>
          {(canCreateTasks || canRequestMarketing) && (
            <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {/* Campana de cambios + Selector de Área — el selector reemplaza las pestañas de segmento; solo cuando hay más de un área visible.
                  En celular la campana se ancla arriba a la derecha del encabezado, a la
                  altura del título, y el Área queda sola en su fila, arriba de la sección
                  (corrección del usuario, ago-2026): primero se elige el área, después la
                  sección. Se mueve con posición, sin dibujar dos campanas: una sola vive
                  en el árbol y la otra copia traería su propio estado. */}
              {/* Área y Vendedor apilados: los dos son contexto del CRM y se leen de
                  arriba hacia abajo (área → vendedor), no uno al lado del otro
                  (corrección del usuario, ago-2026). La campana sigue en la fila del
                  Área. */}
              <div className="flex flex-col gap-2">
                {/* `sm:justify-end`: cuando abajo va la fila del botón + Vendedor, esta
                    fila es más angosta y el Área quedaba flotando al medio, sin calzar
                    con el borde derecho del Vendedor (corrección del usuario, sep-2026).
                    En celular no aplica: ahí el Área va pegada a la izquierda. */}
                <div className="flex items-center gap-2 sm:justify-end">
                  <div className="absolute -top-1 right-0 sm:static">
                    <PanelChangesBell changes={panelChanges} onNavigate={setActiveTab} />
                  </div>
                  {!isSalesperson && visibleSegmentos.length > 1 && areaSelector}
                </div>
                {/* Cuando hay pill de Vendedor, el botón de acción se sienta a su
                    izquierda en esa misma fila (pedido del usuario, sep-2026): arriba
                    quedaba solo, con un hueco vacío al lado del Vendedor. Esta fila es
                    solo de escritorio; en celular el Vendedor baja debajo de la Sección
                    y el botón cierra la pila. */}
                {hayselectorVendedor && (
                  <div className="hidden sm:flex items-center justify-end gap-2">
                    {mostrarBotonAccion && botonAccionNueva}
                    {selectorVendedorPara()}
                  </div>
                )}
              </div>
              {selectorSeccionMovil}
              {/* Celular: la Sección va ARRIBA del Vendedor (corrección del usuario,
                  sep-2026). El orden de la pila queda Área → Sección → Vendedor → acción:
                  primero dónde estoy parado, y recién ahí con qué cartera lo miro. */}
              {hayselectorVendedor && (
                <div className="sm:hidden">{selectorVendedorPara('-movil')}</div>
              )}
              {/* Sin pill de Vendedor el botón se queda donde siempre, a la derecha del
                  Área. Con pill, en escritorio se dibuja arriba (junto al Vendedor) y acá
                  solo queda la copia de celular. */}
              {mostrarBotonAccion && (
                <div className={hayselectorVendedor ? 'sm:hidden' : undefined}>{botonAccionNueva}</div>
              )}
            </div>
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
                setShowCreateDialog(open);
                if (open && isMarketing) {
                  // La encargada de Marketing siempre crea tareas de su área.
                  form.setValue('segmento', 'marketing');
                } else if (open && segmentoFilter && segmentoFilter !== 'all') {
                  form.setValue('segmento', segmentoFilter);
                }
              }}>
              <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-orange-950/40 dark:via-slate-900 dark:to-orange-950/30">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-orange-500 to-[#fd6301] rounded-xl p-2.5 shadow-md shadow-orange-500/25">
                      <Plus className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-foreground">{modoProyectos && !seguimientoMode ? 'Nuevo Proyecto' : 'Nueva Tarea'}</DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        {modoProyectos && !seguimientoMode
                          ? 'Ponle nombre al proyecto y asígnalo; sus tareas se agregan adentro'
                          : 'Completa los detalles y asigna a miembros del equipo'}
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col min-h-0 flex-1">
                    <div className="flex flex-col gap-5 overflow-y-auto flex-1 px-6 py-5">

                      {/* Section: Información */}
                      <div className={`space-y-3 ${seguimientoMode ? 'order-3' : 'order-1'}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center">
                            <Pencil className="w-3.5 h-3.5" />
                          </span>
                          {modoProyectos && !seguimientoMode ? 'Información del proyecto' : 'Información de la tarea'}
                        </div>
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4 space-y-4">
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{modoProyectos && !seguimientoMode ? 'Nombre del proyecto *' : 'Título *'}</FormLabel>
                                <FormControl>
                                  <Input placeholder={modoProyectos && !seguimientoMode ? "Ej: Planta Aconcagua — recubrimiento estructural" : "Ej: Visita cliente zona sur"} className="bg-white border-slate-200 focus:border-orange-400 focus:ring-orange-400/20" {...field} data-testid="input-task-title" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Agrega detalles, instrucciones o contexto..."
                                    className="resize-none bg-white border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                                    rows={3}
                                    {...field}
                                    data-testid="textarea-task-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Section: Clasificación */}
                      <div className={`space-y-3 ${seguimientoMode ? 'order-4' : 'order-2'}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center">
                            <CalendarIcon className="w-3.5 h-3.5" />
                          </span>
                          {seguimientoMode ? "Clasificación y revisión" : "Clasificación y plazo"}
                        </div>
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name="segmento"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Segmento</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || ""}>
                                    <FormControl>
                                      <SelectTrigger className="bg-white border-slate-200" data-testid="select-task-segmento">
                                        <SelectValue placeholder="Seleccionar" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {/* Mismas áreas que el selector del panel: Marketing ya no
                                          se asigna desde acá (va por Solicitud de Marketing). */}
                                      {visibleSegmentos.map((seg) => (
                                        <SelectItem key={seg.value} value={seg.value}>{seg.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="groupId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Grupo</FormLabel>
                                  <Select onValueChange={(v) => field.onChange(v === 'none' ? null : v)} value={field.value || 'none'}>
                                    <FormControl>
                                      <SelectTrigger className="bg-white border-slate-200" data-testid="select-task-group">
                                        <SelectValue placeholder="Sin grupo" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">Sin grupo</SelectItem>
                                      {(taskGroupsQuery.data || []).map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                          <span className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full bg-${group.color || 'blue'}-500`} />
                                            {group.name}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="dueDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{seguimientoMode ? "Fecha de Revisión (opcional)" : modoProyectos ? "Fecha Objetivo (opcional)" : "Fecha Límite"}</FormLabel>
                                  <FormControl>
                                    <DateTimePicker value={field.value || ""} onChange={field.onChange} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Cliente */}
                      <div className={`space-y-3 ${seguimientoMode ? 'order-2' : 'order-3'}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center">
                            <Building2 className="w-3.5 h-3.5" />
                          </span>
                          Asociaciones
                        </div>
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4 space-y-3">
                          <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" />
                            {modoProyectos && !seguimientoMode ? 'Posible cliente o producto (Opcional)' : 'Cliente Asociado (Opcional)'}
                          </Label>
                          {selectedClienteTask ? (
                            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl">
                              <div className="flex-1">
                                <p className="font-medium text-sm text-gray-800">{selectedClienteTask.nokoen}</p>
                                <p className="text-xs text-gray-500">{selectedClienteTask.koen === 'PROSPECTO' ? 'Posible cliente (aún no está en el sistema)' : `Código: ${selectedClienteTask.koen}`}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedClienteTask(null);
                                  form.setValue("clienteId", null);
                                  form.setValue("clienteNombre", null);
                                  setSearchClienteTask("");
                                }}
                                className="text-red-500 hover:text-red-700"
                                data-testid="button-remove-cliente"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="Buscar cliente por nombre o código..."
                                  value={searchClienteTask}
                                  onChange={(e) => setSearchClienteTask(e.target.value)}
                                  className="pl-10 bg-white border-slate-200"
                                  data-testid="input-search-cliente-task"
                                />
                              </div>
                              {searchClienteTask.length >= 2 && clientesTask.length > 0 && (
                                <div className="max-h-40 overflow-y-auto border rounded-lg bg-white shadow-sm">
                                  {clientesTask.map((cliente) => (
                                    <button
                                      key={cliente.id}
                                      type="button"
                                      className="w-full px-3 py-2 text-left hover:bg-orange-50 dark:hover:bg-orange-950/30 border-b last:border-b-0 transition-colors"
                                      onClick={() => {
                                        setSelectedClienteTask(cliente);
                                        form.setValue("clienteId", cliente.koen);
                                        form.setValue("clienteNombre", cliente.nokoen);
                                        setSearchClienteTask("");
                                      }}
                                      data-testid={`cliente-option-${cliente.id}`}
                                    >
                                      <p className="font-medium text-sm">{cliente.nokoen}</p>
                                      <p className="text-xs text-gray-500">Código: {cliente.koen}</p>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {searchClienteTask.length >= 2 && clientesTask.length === 0 && (
                                modoProyectos && !seguimientoMode ? (
                                  // Los proyectos de Industrial suelen nacer con un posible
                                  // cliente (o un producto en desarrollo) que todavía no
                                  // existe en el ERP: se anota a mano como prospecto.
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left rounded-lg border border-dashed border-orange-300 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-xs font-medium transition-colors"
                                    onClick={() => {
                                      const nombre = searchClienteTask.trim();
                                      if (!nombre) return;
                                      setSelectedClienteTask({ id: 'PROSPECTO', koen: 'PROSPECTO', nokoen: nombre } as any);
                                      form.setValue("clienteId", 'PROSPECTO');
                                      form.setValue("clienteNombre", nombre);
                                      setSearchClienteTask("");
                                    }}
                                    data-testid="button-cliente-prospecto"
                                  >
                                    <Plus className="h-3.5 w-3.5 inline mr-1.5" />
                                    Usar «{searchClienteTask.trim()}» como posible cliente
                                  </button>
                                ) : (
                                  <p className="text-xs text-gray-500 italic">No se encontraron clientes</p>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section: Equipo — el vendedor no asigna trabajo a terceros:
                          lo que crea queda a su nombre, así que no ve el selector. */}
                      <div className={`space-y-3 ${seguimientoMode ? 'order-1' : 'order-4'} ${!seguimientoMode ? 'hidden' : ''}`}>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5" />
                          </span>
                          Equipo asignado *
                        </div>
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4 space-y-3">
                          {/* Search filter for team members */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Buscar miembro del equipo..."
                              value={teamSearchFilter}
                              onChange={(e) => setTeamSearchFilter(e.target.value)}
                              className="pl-10 bg-white border-slate-200 h-9 text-sm"
                            />
                          </div>
                          {/* Selected count badge */}
                          {(form.watch('assignments') || []).length > 0 && (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800">
                                <Users className="h-3 w-3 mr-1" />
                                {(form.watch('assignments') || []).length} seleccionado{(form.watch('assignments') || []).length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          )}
                          {/* All team members in one list */}
                          <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {availableSupervisors && availableSupervisors.filter(s => !teamSearchFilter || s.salespersonName.toLowerCase().includes(teamSearchFilter.toLowerCase())).length > 0 && (
                              <>
                                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10">Supervisores</div>
                                {availableSupervisors.filter(s => !teamSearchFilter || s.salespersonName.toLowerCase().includes(teamSearchFilter.toLowerCase())).map((supervisor) => (
                                  <FormField
                                    key={`supervisor-${supervisor.id}`}
                                    control={form.control}
                                    name="assignments"
                                    render={({ field }) => {
                                      const isChecked = field.value?.some(a => a.assigneeType === "supervisor" && a.assigneeId === supervisor.id);
                                      return (
                                        <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-orange-50/50 dark:hover:bg-orange-950/20 ${isChecked ? 'bg-orange-50/80 dark:bg-orange-950/30' : ''}`}>
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                              const currentAssignments = field.value || [];
                                              if (checked) {
                                                field.onChange([...currentAssignments, { assigneeType: "supervisor", assigneeId: supervisor.id }]);
                                              } else {
                                                field.onChange(currentAssignments.filter(a => !(a.assigneeType === "supervisor" && a.assigneeId === supervisor.id)));
                                              }
                                            }}
                                            data-testid={`checkbox-supervisor-${supervisor.id}`}
                                            className="data-[state=checked]:bg-[#fd6301] data-[state=checked]:border-orange-600"
                                          />
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                              {supervisor.salespersonName?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-slate-700 truncate">{supervisor.salespersonName}</p>
                                              <p className="text-[10px] text-orange-500 font-medium">Supervisor</p>
                                            </div>
                                          </div>
                                        </label>
                                      );
                                    }}
                                  />
                                ))}
                              </>
                            )}
                            {availableUsers && availableUsers.filter(s => !teamSearchFilter || s.salespersonName.toLowerCase().includes(teamSearchFilter.toLowerCase())).length > 0 && (
                              <>
                                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10">Vendedores</div>
                                {availableUsers.filter(s => !teamSearchFilter || s.salespersonName.toLowerCase().includes(teamSearchFilter.toLowerCase())).map((salesperson) => (
                                  <FormField
                                    key={`salesperson-${salesperson.id}`}
                                    control={form.control}
                                    name="assignments"
                                    render={({ field }) => {
                                      const isChecked = field.value?.some(a => a.assigneeType === "salesperson" && a.assigneeId === salesperson.id);
                                      return (
                                        <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-orange-50/50 dark:hover:bg-orange-950/20 ${isChecked ? 'bg-orange-50/80 dark:bg-orange-950/30' : ''}`}>
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                              const currentAssignments = field.value || [];
                                              if (checked) {
                                                field.onChange([...currentAssignments, { assigneeType: "salesperson", assigneeId: salesperson.id }]);
                                              } else {
                                                field.onChange(currentAssignments.filter(a => !(a.assigneeType === "salesperson" && a.assigneeId === salesperson.id)));
                                              }
                                            }}
                                            data-testid={`checkbox-salesperson-${salesperson.id}`}
                                            className="data-[state=checked]:bg-[#fd6301] data-[state=checked]:border-orange-600"
                                          />
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                              {salesperson.salespersonName?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-slate-700 truncate">{salesperson.salespersonName}</p>
                                              <p className="text-[10px] text-blue-500 font-medium">Vendedor</p>
                                            </div>
                                          </div>
                                        </label>
                                      );
                                    }}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                          <FormMessage>
                            {form.formState.errors.assignments?.message}
                          </FormMessage>
                        </div>
                      </div>

                    </div>

                    {/* Premium Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-slate-200 text-slate-600 hover:bg-slate-100"
                        onClick={() => {
                          setShowCreateDialog(false);
                          form.reset();
                          setSelectedClienteTask(null);
                          setSearchClienteTask("");
                        }}
                        data-testid="button-cancel-task"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createTaskMutation.isPending}
                        className="bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 px-6 font-semibold transition-all"
                        data-testid="button-submit-task"
                      >
                        {createTaskMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</>
                        ) : (
                          <><Plus className="h-4 w-4 mr-2" /> Crear Tarea</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Selector de tipo de tarea (Etapa 1) */}
            {/* Selector de qué crear. En celular entra como panel lateral desde la
                izquierda, con el mismo diseño que los filtros del Dashboard (pedido del
                usuario, ago-2026): la ventana al centro tapaba la pantalla completa. En
                computador sigue siendo la ventana de siempre. Las tres opciones se
                arman una sola vez y se muestran en el envase que corresponda. */}
            {(() => {
              const opciones = (
                <div className="grid gap-3 py-2">
                  {([
                    { flow: 'seguimiento', icon: <Building2 className="h-5 w-5" />, title: 'Seguimiento a clientes', desc: 'Tarea ligada a un cliente activo (responsable → cliente → detalle).' },
                    { flow: 'marketing', icon: <TrendingUp className="h-5 w-5" />, title: 'Solicitud de Marketing', desc: 'Pedido a Marketing con fecha sugerida; la encargada fija el plazo final.' },
                    // En Industrial el trabajo propio del área es el proyecto (posible
                    // cliente todavía no creado en el sistema, producto en desarrollo).
                    {
                      flow: 'otras',
                      icon: modoProyectos ? <FolderOpen className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />,
                      title: modoProyectos ? 'Proyecto' : 'Otras tareas',
                      desc: modoProyectos
                        ? 'Espacio de trabajo del área con sus propias tareas adentro.'
                        : 'Tarea general del equipo (formulario estándar).',
                    },
                  ] as const).filter((opt) => opt.flow !== 'marketing' || canRequestMarketing).map((opt) => (
                    <button
                      key={opt.flow}
                      onClick={() => {
                        setShowChooser(false);
                        setTaskFlow(opt.flow);
                        setSelectedClienteTask(null);
                        setSearchClienteTask("");
                        form.reset({ title: "", description: "", priority: "medium", segmento: segmentoFilter !== 'all' ? segmentoFilter : null, groupId: null, dueDate: "", clienteId: null, clienteNombre: null, assignments: asignacionesPorDefecto() });
                        // En celular el selector es un panel lateral: si el formulario se
                        // abre en el mismo instante, los dos se pisan y el paso siguiente
                        // no llegaba a aparecer. Se espera a que el panel termine de
                        // cerrarse y recién ahí se abre el formulario.
                        const abrirSiguiente = () => {
                          if (opt.flow === 'marketing') setShowMarketingDialog(true);
                          else setShowCreateDialog(true);
                        };
                        if (esCelular) setTimeout(abrirSiguiente, 320);
                        else abrirSiguiente();
                      }}
                      className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 text-left transition-all"
                      data-testid={`task-flow-${opt.flow}`}
                    >
                      <span className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">{opt.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-800">{opt.title}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
              if (esCelular) {
                return (
                  <Drawer open={showChooser} onOpenChange={setShowChooser} direction="left" shouldScaleBackground={false}>
                    <DrawerContent side="left" className="h-full w-[92vw] max-w-[26rem] sm:w-[24rem]">
                      <DrawerHeader className="text-left px-5 pt-6 pb-0">
                        <DrawerTitle>¿Qué querés crear?</DrawerTitle>
                        <DrawerDescription>Elegí el tipo de trabajo para este segmento.</DrawerDescription>
                      </DrawerHeader>
                      <div className="px-5 pb-6 overflow-y-auto flex-1">
                        {opciones}
                      </div>
                    </DrawerContent>
                  </Drawer>
                );
              }
              return (
                <Dialog open={showChooser} onOpenChange={setShowChooser}>
                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle>¿Qué querés crear?</DialogTitle>
                      <DialogDescription>Elegí el tipo de trabajo para este segmento.</DialogDescription>
                    </DialogHeader>
                    {opciones}
                  </DialogContent>
                </Dialog>
              );
            })()}

            {/* Solicitud de Marketing (Etapa 1) */}
            <MarketingSolicitudDialog
              open={showMarketingDialog}
              onOpenChange={setShowMarketingDialog}
              segmento={segmentoFilter !== 'all' ? segmentoFilter : null}
            />
            </>
          )}
        </div>
      </div>

      {/* Tabs para Tareas, Calendario, Estimación Semanal/Mensual */}
      {/* Técnico de Obra no tiene acceso a la pestaña de promesas de compra */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Marketing no ve pestañas: aterriza directo en su lista de tareas. */}
        {/* En celular las pestañas van en un desplegable, no en el riel: en una barra no
            entran y había que arrastrarlas a ciegas para saber dónde estabas parado
            (corrección del usuario, ago-2026). Es el mismo control con el que se elige la
            vista en el panel de filtros del dashboard. De `sm` para arriba vuelve el riel
            de pestañas, donde sí entran. */}
        {/* En celular el selector de sección ya está arriba, dentro del encabezado
            (ver `selectorSeccionMovil`). Acá queda solo el riel de escritorio. */}
        {/* Riel de pestañas (sin track: sobre el fondo blanco de la página, texto
            negro y la activa marcada con una línea negra abajo, sin relleno): de
            tablet para arriba. La línea base gris corre bajo TODAS las pestañas
            para que el riel se lea como una sola barra en cualquier área. */}
        <div className={`hidden sm:block ${isMarketing ? 'hidden' : ''}`}>
          <TabsList
            ref={tabsListRef}
            className={`flex w-full justify-start overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:overflow-visible h-auto gap-1.5 bg-transparent dark:bg-transparent p-0 border-0 border-b border-slate-200 dark:border-slate-800 rounded-none ${tabsGridClass}`}
          >
            {/* En Industrial esta pestaña es "Proyectos": mismo espacio, otra
                unidad de trabajo (ver modoProyectos). El value se mantiene en
                "tareas" para no romper filtros, avisos ni enlaces guardados. */}
            {/* Seguimiento va PRIMERA (corrección del usuario, ago-2026): es la pestaña con
                la que el equipo comercial arranca el día, y es también donde aterriza el
                panel cuando se entra sin `?tab=`. */}
            <TabsTrigger value="seguimiento" data-testid="tab-seguimiento" className={tabTriggerClass} onClick={() => handleTabTriggerClick("seguimiento")}>
              <UserCheck className={tabIconClass} />
              Seguimiento
              {tabChangeBadge("seguimiento")}
            </TabsTrigger>
            <TabsTrigger value="tareas" data-testid="tab-tareas" className={tabTriggerClass} onClick={() => handleTabTriggerClick("tareas")}>
              {modoProyectos ? <FolderOpen className={tabIconClass} /> : <CheckSquare className={tabIconClass} />}
              {modoProyectos ? 'Proyectos' : 'Tareas'}
              {tabChangeBadge("tareas")}
            </TabsTrigger>
            {/* Estimación de ventas solo aplica a Ferreterías (ver showEstimacionTab). */}
            {showEstimacionTab && (
              <TabsTrigger value="estimacion" data-testid="tab-estimacion" className={tabTriggerClass} onClick={() => handleTabTriggerClick("estimacion")}>
                <TrendingUp className={tabIconClass} />
                Estimación de ventas
                {tabChangeBadge("estimacion")}
              </TabsTrigger>
            )}
            {showObrasTab && (
              <TabsTrigger value="obras" data-testid="tab-obras" className={tabTriggerClass}>
                <HardHat className={tabIconClass} />
                Obras
              </TabsTrigger>
            )}
            {/* La pestaña Marketing salió del Panel de Trabajo: el área vive completa
                en el módulo Marketing (/marketing). */}
            {showCrmTab && (
              <TabsTrigger value="crm" data-testid="tab-crm" className={tabTriggerClass} onClick={() => handleTabTriggerClick("crm")}>
                <Users className={tabIconClass} />
                CRM
                {tabChangeBadge("crm")}
              </TabsTrigger>
            )}
            {/* Rutas Comerciales no aplica a Construcción: ahí su lugar lo toma Visitas Técnicas. */}
            {showRutasTab && (
              <TabsTrigger value="rutas-comerciales" data-testid="tab-rutas-comerciales" className={tabTriggerClass} onClick={() => handleTabTriggerClick("rutas-comerciales")}>
                <MapPin className={tabIconClass} />
                Rutas Comerciales
                {tabChangeBadge("rutas-comerciales")}
              </TabsTrigger>
            )}
            {showVisitasTab && (
              <TabsTrigger value="visitas-tecnicas" data-testid="tab-visitas-tecnicas" className={tabTriggerClass}>
                <FileCheck className={tabIconClass} />
                Visitas Técnicas
              </TabsTrigger>
            )}
            {/* Solicitud de Crédito ya NO es pestaña del panel: vive solo en su
                ítem del sidebar (/solicitud-credito). */}
            <TabsTrigger value="calendario" data-testid="tab-calendario" className={tabTriggerClass}>
              <CalendarIcon className={tabIconClass} />
              Calendario
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Seguimiento en Construcción: clientes u obras. La obra es la unidad
            que se sigue en el área (avanza, se queda sin material y hay que ir a
            verla), así que tiene su propia vista con ficha y bitácora. */}
        {activeTab === 'seguimiento' && showObrasTab && (
          <div className="flex items-center gap-0.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 w-max">
            {([
              { key: "clientes", label: "Clientes", icon: Users },
              { key: "obras", label: "Obras", icon: HardHat },
            ] as const).map((v) => (
              <button
                key={v.key}
                onClick={() => setSeguimientoVista(v.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  seguimientoVista === v.key
                    ? "bg-white dark:bg-slate-900 text-orange-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                data-testid={`button-seguimiento-vista-${v.key}`}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Obras del Seguimiento: resumen de la cartera y, al abrir una, su
            ficha completa con la bitácora. */}
        {activeTab === 'seguimiento' && showObrasTab && seguimientoVista === 'obras' && (
          <SeguimientoObrasContent onIrAObras={() => setActiveTab('obras')} />
        )}

        {(activeTab === 'tareas' || (activeTab === 'seguimiento' && seguimientoVista === 'clientes')) && (
        <div className="space-y-6">

          {/* El selector de Área (antes pestañas de segmento) vive ahora arriba, junto al botón "Nueva Tarea". */}

          {/* Filters and View Toggle - solo administrador y solo en la pestaña Tareas (Seguimiento no usa estos filtros) */}
          {user.role === 'admin' && activeTab !== 'seguimiento' && (
          // Sin overflow-hidden: el dropdown de sugerencias del buscador debe poder salir de la card
          <Card className="hidden lg:block rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/70 dark:from-slate-900 dark:to-slate-900/80">
            <CardContent className="p-0">
              {/* Filtros plegables de celular: se dejaron FUERA del formato móvil
                  (corrección del usuario, ago-2026). La tarjeta era una fila más de
                  chrome antes de la primera tarea y empujaba la lista fuera de la
                  primera pantalla. De `lg` para arriba sigue el bloque de filtros de
                  siempre, acá abajo. Si hay que devolverle la búsqueda al celular, va
                  como lupa en la fila de acciones, no como esta tarjeta. */}
              <div className="hidden">
                <button
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  data-testid="button-toggle-filters"
                >
                  <div className="flex items-center gap-3">
                    <Filter className="h-5 w-5 text-orange-600" />
                    <span className="font-semibold text-sm text-gray-900">Filtros</span>
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-xs font-medium">
                      {filteredTasks.length} {vistaProyectos ? 'proyecto' : 'tarea'}{filteredTasks.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform text-gray-600 ${filtersExpanded ? 'rotate-180' : ''}`} />
                </button>

                {filtersExpanded && (
                  <div className="p-4 pt-0 space-y-3 border-t border-gray-200">
                    {/* Buscador (móvil) */}
                    <div className="space-y-1.5 pt-3">
                      <Label className="text-xs font-medium text-muted-foreground">Buscar:</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          placeholder="Cliente o palabra clave…"
                          className="h-9 pl-9 text-sm"
                          data-testid="input-task-search-mobile"
                        />
                      </div>
                    </div>

                    {/* View Mode Toggle */}
                    {(user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || user.role === 'tecnico_obra') && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Vista:</Label>
                        <Select value={viewMode} onValueChange={(value: "my-tasks" | "all-tasks") => setViewMode(value)}>
                          <SelectTrigger className="h-9 text-sm" data-testid="select-view-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="my-tasks">Mis Tareas</SelectItem>
                            <SelectItem value="all-tasks">Todas las Tareas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Status Filter */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Estado:</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 text-sm" data-testid="select-status-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="pendiente">Pendientes</SelectItem>
                          <SelectItem value="en_progreso">En Progreso</SelectItem>
                          <SelectItem value="completada">Completadas</SelectItem>
                          <SelectItem value="bloqueada">Bloqueadas</SelectItem>
                          <SelectItem value="cancelada">Canceladas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority Filter */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Prioridad:</Label>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="h-9 text-sm" data-testid="select-priority-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="low">Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: Always Visible Filters - cada filtro es una tarjeta-pill con aire propio */}
              <div className="hidden lg:block px-5 py-4">
                <div className="flex items-center gap-4 flex-wrap justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* View Mode Toggle */}
                    {(user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || user.role === 'tecnico_obra') && (
                      <div className="flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-orange-200 hover:shadow transition-all">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex-shrink-0">
                          <Eye className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Vista</span>
                          <Select value={viewMode} onValueChange={(value: "my-tasks" | "all-tasks") => setViewMode(value)}>
                            <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-view-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="my-tasks">Mis Tareas</SelectItem>
                              <SelectItem value="all-tasks">Todas las Tareas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Status Filter */}
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-emerald-200 hover:shadow transition-all">
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex-shrink-0">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Estado</span>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-status-filter">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="pendiente">Pendientes</SelectItem>
                            <SelectItem value="en_progreso">En Progreso</SelectItem>
                            <SelectItem value="completada">Completadas</SelectItem>
                            <SelectItem value="bloqueada">Bloqueadas</SelectItem>
                            <SelectItem value="cancelada">Canceladas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Priority Filter */}
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-amber-200 hover:shadow transition-all">
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Prioridad</span>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                          <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-priority-filter">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="medium">Media</SelectItem>
                            <SelectItem value="low">Baja</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Buscador AJAX: cliente o palabra clave */}
                    {taskSearchBox}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full">
                      {filteredTasks.length} {vistaProyectos ? 'proyecto' : 'tarea'}{filteredTasks.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Contador compacto para roles sin filtros (todos menos administrador) — con buscador */}
          {user.role !== 'admin' && activeTab !== 'seguimiento' && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {taskSearchBox}
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-xs font-medium px-3 py-1">
                {filteredTasks.length} {vistaProyectos ? 'proyecto' : 'tarea'}{filteredTasks.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}

          {/* Vendedores: su Seguimiento es una lista simple (no gestionan equipo),
              así que el buscador de clientes va acá arriba. Los demás roles lo
              tienen dentro de la vista por colaborador. */}
          {activeTab === 'seguimiento' && isSalesperson && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {seguimientoSearchBox}
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-xs font-medium px-3 py-1">
                {filteredTasks.length} cliente{filteredTasks.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}

          {/* Group Management Bar */}
          {/* Group Management Bar - hidden for salesperson y oculta en Seguimiento (Mi Equipo / Nuevo Grupo / ayuda / Seleccionar) */}
          {/* En celular esta barra no se muestra (pedido del usuario, ago-2026): el
              cambio Proyectos/Terminadas, "Nuevo Grupo", la ayuda y "Seleccionar" son
              trabajo de escritorio y empujaban la lista fuera de la primera pantalla. */}
          {!isSalesperson && segmentoFilter !== "all" && activeTab !== 'seguimiento' && !esCelular && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Tareas / Terminadas — la vista por persona vive ahora en Seguimiento */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 shadow-inner">
                <button
                  onClick={() => setTaskView('lista')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${taskView === 'lista' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {modoProyectos ? <FolderOpen className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />} {modoProyectos ? 'Proyectos' : 'Tareas'}
                </button>
                <button
                  onClick={() => setTaskView('terminadas')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${taskView === 'terminadas' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Check className="h-3.5 w-3.5" /> Terminadas
                  {kpiCompletadas > 0 && (
                    <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${taskView === 'terminadas' ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500 text-white'}`}>
                      {kpiCompletadas}
                    </span>
                  )}
                </button>
              </div>

              {/* Acciones a la derecha */}
              <div className="flex items-center gap-1.5 ml-auto">
                {!showCreateGroup ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateGroup(true)}
                      className="h-8 rounded-2xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/50 shadow-sm transition-all"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Nuevo Grupo
                    </Button>
                    {!showGroupsTutorial && (
                      <button
                        onClick={reopenGroupsTutorial}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 border border-slate-200 bg-white hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50/50 shadow-sm transition-all"
                        title="¿Para qué sirven los grupos?"
                        aria-label="¿Para qué sirven los grupos?"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 bg-white border border-orange-200 rounded-xl px-3 py-1.5 shadow-sm">
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Nombre del grupo..."
                      className="h-7 text-xs border-0 shadow-none p-0 focus-visible:ring-0 w-40"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newGroupName.trim()) {
                          createGroupMutation.mutate({ name: newGroupName.trim(), segmento: segmentoFilter });
                        }
                        if (e.key === 'Escape') { setShowCreateGroup(false); setNewGroupName(""); }
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-6 px-2.5 text-[10px] bg-[#fd6301] hover:bg-[#e35400] font-semibold"
                      disabled={!newGroupName.trim() || createGroupMutation.isPending}
                      onClick={() => newGroupName.trim() && createGroupMutation.mutate({ name: newGroupName.trim(), segmento: segmentoFilter })}
                    >
                      {createGroupMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Crear'}
                    </Button>
                    <button onClick={() => { setShowCreateGroup(false); setNewGroupName(""); }} className="text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Selección múltiple para eliminación masiva - solo administrador */}
                {user.role === 'admin' && (
                  selectionMode ? (
                    <Button
                      size="sm"
                      onClick={exitSelectionMode}
                      className="h-8 rounded-2xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Cancelar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setSelectionMode(true)}
                      className="h-8 rounded-2xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50/50 shadow-sm transition-all"
                    >
                      <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                      Seleccionar
                    </Button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Burbuja tutorial: ¿para qué sirven los grupos? - cerrable */}
          {showGroupsTutorial && !isSalesperson && segmentoFilter !== "all" && activeTab !== 'seguimiento' && (
            <div className="relative animate-in fade-in slide-in-from-top-1 duration-300">
              {/* Puntita que apunta al botón "Nuevo Grupo" */}
              <div className="absolute -top-1.5 left-7 w-3 h-3 rotate-45 rounded-[3px] bg-[#fd6301] dark:bg-orange-500" />
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#fd6301] to-[#fd6301] text-white p-4 pr-10 shadow-lg shadow-orange-500/25">
                {/* Brillo decorativo */}
                <div className="pointer-events-none absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                <button
                  onClick={dismissGroupsTutorial}
                  className="absolute top-3 right-3 p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                  title="Cerrar"
                  aria-label="Cerrar tutorial"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="relative flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold mb-1">¿Para qué sirven los grupos?</h4>
                    <p className="text-xs text-white/90 leading-relaxed max-w-2xl">
                      Los grupos ordenan tus tareas por <strong>proyecto, campaña o área</strong> (por ejemplo "Meta Ads", "Sitio Web" o "App Panorámica").
                      Crea uno con <strong>Nuevo Grupo</strong>, asigna tareas y sigue el avance de cada uno con su barra de progreso.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* La bandeja de Solicitudes de Marketing dejó de vivir acá: ahora está
              en el módulo Marketing. */}

          {/* Acá iba la ayuda "El círculo completa la tarea…". Se sacó de todas las
              secciones (pedido del usuario, ago-2026): ocupaba dos líneas arriba de la
              lista en cada pantalla. El círculo sigue funcionando igual. */}

          {/* Tasks List - Modern Grouped Layout */}
          <div className="space-y-6">
            {tasksQuery.isLoading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium text-sm">Cargando tareas...</p>
              </div>
            ) : (filteredTasks.length === 0 && activeTab !== 'seguimiento') ? (
              <div className="text-center py-20">
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-500 to-[#fd6301] blur-lg opacity-25" />
                  <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-[#fd6301] flex items-center justify-center shadow-lg shadow-orange-500/25">
                    {modoProyectos ? <FolderOpen className="h-9 w-9 text-white" /> : <CheckSquare className="h-9 w-9 text-white" />}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                  {modoProyectos ? 'No hay proyectos' : 'No hay tareas'}
                </h3>
                <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                  {modoProyectos
                    ? (viewMode === "my-tasks" ? "No tienes proyectos asignados." : "No se encontraron proyectos.")
                    : (viewMode === "my-tasks" ? "No tienes tareas asignadas." : "No se encontraron tareas.")}
                </p>
                {canCreateTasks && (
                  // Mismo camino que el (+) del header: abrir el diálogo "a mano"
                  // se saltaba el reset del formulario y dejaba la asignación vacía.
                  <Button
                    onClick={accionNueva.onClick}
                    className="bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primera tarea
                  </Button>
                )}
              </div>
            ) : (() => {
              // Use init data as immediate fallback to prevent flash
              const groups = taskGroupsQuery.data || tareasInit?.taskGroups || [];
              const groupedTasks: Record<string, typeof filteredTasks> = {};
              const ungrouped: typeof filteredTasks = [];

              // Las tareas terminadas se separan en su propia pestaña "Terminadas".
              // Equipo/Grupos muestran solo las pendientes; Terminadas muestra las completadas.
              // Solo separamos cuando la pestaña Terminadas está disponible (mismo gate que el
              // toggle Equipo/Grupos); si no, no habría forma de ver las tareas completadas.
              const showTerminadasTab = !isSalesperson && segmentoFilter !== "all";
              const completedTasks = showTerminadasTab ? filteredTasks.filter(isTaskDone) : [];
              const activeTasks = showTerminadasTab ? filteredTasks.filter(t => !isTaskDone(t)) : filteredTasks;
              const viewTasks = taskView === 'terminadas' ? completedTasks : activeTasks;

              viewTasks.forEach(task => {
                const gId = (task as any).groupId;
                if (gId && groups.find((g: any) => g.id === gId)) {
                  if (!groupedTasks[gId]) groupedTasks[gId] = [];
                  groupedTasks[gId].push(task);
                } else {
                  ungrouped.push(task);
                }
              });

              const renderTaskCard = (task: typeof filteredTasks[0]) => {
                const myAssignment = task.assignments.find(a =>
                  (a.assigneeType === "supervisor" && a.assigneeId === user.id) ||
                  (a.assigneeType === "salesperson" && a.assigneeId === user.id) ||
                  (a.assigneeType === "user" && a.assigneeId === user.id)
                );
                const targetAssignment = myAssignment || (
                  (user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area')) ? task.assignments[0] : null
                );
                const isCompleted = task.status === 'completada' || (targetAssignment?.status === 'completed');
                const canComplete = targetAssignment &&
                  (user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || (myAssignment && myAssignment.assigneeId === user.id));
                // En seguimiento la fecha es una revisión programada del cliente, no una
                // fecha límite: no aplica la lógica de "vencida" (borde/badge rojos).
                const isSeguimientoCard = (task as any).payload?.kind === 'seguimiento_cliente';
                // En Industrial la ficha es un proyecto: como el seguimiento, muestra
                // cuántas de sus tareas internas quedan pendientes.
                const isProyectoCard = !isSeguimientoCard && esTareaProyecto(task, modoProyectos);
                // Seguimiento: tareas internas sin completar y tiempo sin interacción.
                const pendientes = isSeguimientoCard || isProyectoCard ? pendientesDeCliente(task) : 0;
                const dias = isSeguimientoCard ? diasSinMovimiento(task) : null;
                // Semáforo de crédito: sale de la cartera del ERP que ya se pidió para
                // toda la lista. Un cliente con código y sin fila en la respuesta no
                // tiene documentos pendientes → está al día. Sin código (prospecto) no
                // se sabe nada de su deuda y no se muestra semáforo.
                const codigoCliente = String((task as any).clienteId || "").trim();
                const credito = isSeguimientoCard && creditoPorCliente && codigoCliente && codigoCliente !== 'PROSPECTO'
                  ? nivelCredito(creditoPorCliente[codigoCliente] ?? { overdue: 0, upcoming: 0 })
                  : null;
                const isOverdue = !isSeguimientoCard && task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
                const lockedByGroup = !!(task as any).groupId && selectedGroupIds.has((task as any).groupId);
                const isTaskSelected = selectedTaskIds.has(task.id) || lockedByGroup;
                // Cambio reciente no visto hasta esta visita: la tarjeta queda destacada.
                const isRecentChange =
                  panelChanges.highlights.tareas?.has(task.id) ||
                  panelChanges.highlights.seguimiento?.has(task.id) ||
                  panelChanges.highlights.marketing?.has(task.id);

                return (
                  <div
                    key={task.id}
                    // En celular la tarjeta se parte en dos líneas: arriba el título y su
                    // detalle usando TODO el ancho, y abajo los chips de estado. Antes los
                    // chips iban al costado en la misma línea y dejaban al texto una
                    // columna de dos dedos, con el nombre del proyecto cayendo letra por
                    // letra hacia abajo (corrección del usuario, ago-2026).
                    className={`group flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md ${
                      selectionMode && isTaskSelected
                        ? 'bg-red-50 border-red-300 ring-1 ring-red-300'
                        : isCompleted
                        ? `bg-emerald-50/40 border-emerald-200/60 ${isRecentChange ? 'ring-2 ring-[#fd6301]/25 opacity-90' : 'opacity-60'}`
                        : isOverdue
                          ? 'bg-white border-red-200 hover:border-red-300'
                          : isRecentChange
                            ? 'bg-orange-50/70 border-orange-300 ring-2 ring-[#fd6301]/25 hover:border-orange-400'
                            : 'bg-white border-slate-200 hover:border-orange-200'
                    }`}
                    onClick={() => {
                      if (!selectionMode) { setSelectedTaskId(task.id); return; }
                      if (lockedByGroup) return; // controlada por la selección del grupo
                      toggleTaskSelected(task.id);
                    }}
                  >
                    {/* Selection checkbox (modo selección admin) o círculo de completado */}
                    {/* En Seguimiento no se marcan clientes como completados → ocultar el círculo (salvo modo selección admin) */}
                    <div className={`flex-shrink-0 pt-0.5 ${activeTab === 'seguimiento' && !selectionMode ? 'hidden' : ''}`}>
                      {selectionMode ? (
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isTaskSelected
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'border-slate-300 bg-white'
                        } ${lockedByGroup ? 'opacity-70' : ''}`}>
                          {isTaskSelected && <Check className="h-3 w-3" />}
                        </div>
                      ) : canComplete || (targetAssignment && targetAssignment.status === "completed") ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (targetAssignment) {
                              const newStatus = targetAssignment.status === "completed" ? "pending" : "completed";
                              updateAssignmentMutation.mutate({
                                taskId: task.id,
                                assignmentId: targetAssignment.id,
                                status: newStatus
                              });
                            }
                          }}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-white scale-110'
                              : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
                          }`}
                          title={isCompleted ? 'Reabrir la tarea' : 'Marcar como completada'}
                          disabled={updateAssignmentMutation.isPending}
                        >
                          {isCompleted && <Check className="h-3 w-3" />}
                        </button>
                      ) : (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'
                        }`}>
                          {isCompleted && <Check className="h-3 w-3" />}
                        </div>
                      )}
                    </div>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[13px] sm:text-sm font-medium leading-snug ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                          {task.title}
                        </span>
                        {task.priority === 'high' && !isCompleted && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="Alta prioridad" />
                        )}
                      </div>
                      {/* Debajo del título va el ÚLTIMO MOVIMIENTO —el último mensaje del
                          chat o la última actividad registrada, con su fecha— en vez de la
                          descripción, el proyecto y el responsable (pedido del usuario,
                          ago-2026): en la lista lo que se quiere saber es en qué quedó cada
                          tarea, no lo que decía cuando se creó. Si todavía no pasó nada, se
                          muestra la descripción como antes. */}
                      {(() => {
                        const mov = (task as any).ultimoMovimiento;
                        if (mov?.texto) {
                          return (
                            <p className={`text-xs leading-relaxed line-clamp-2 ${isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                              <span className="font-semibold text-slate-400">
                                {format(new Date(mov.fecha), "dd MMM", { locale: es })} ·{' '}
                              </span>
                              {mov.texto}
                            </p>
                          );
                        }
                        if (task.description) {
                          return (
                            <p className={`text-xs leading-relaxed line-clamp-1 ${isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                              {task.description}
                            </p>
                          );
                        }
                        return null;
                      })()}
                      <div className="hidden sm:flex items-center gap-2 mt-1.5 flex-wrap">
                        {task.dueDate && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                            isSeguimientoCard ? 'bg-violet-50 text-violet-700' :
                            isOverdue ? 'bg-red-100 text-red-700' : isCompleted ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            <CalendarIcon className="h-3 w-3" />
                            {isSeguimientoCard ? `Revisión ${format(new Date(task.dueDate), "dd MMM", { locale: es })}` : format(new Date(task.dueDate), "dd MMM", { locale: es })}
                          </span>
                        )}
                        {(task as any).clienteNombre && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Building2 className="h-3 w-3" />
                            {(task as any).clienteNombre}
                          </span>
                        )}
                        {/* Chip de grupo — el grupo pasa a ser una etiqueta de color en la tarjeta */}
                        {(() => {
                          const gId = (task as any).groupId;
                          const gi = gId ? groups.findIndex((g: any) => g.id === gId) : -1;
                          if (gi < 0) return null;
                          const grp: any = groups[gi];
                          // Por el mismo camino que la franja del proyecto: si no, el
                          // nombre guardado ('blue') se usaba como color crudo y el chip
                          // salía azul puro dentro de una lista naranja.
                          const color = resolveGroupColor(grp.color, gi);
                          return (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${color}1a`, color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              {grp.name}
                            </span>
                          );
                        })()}
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <User className="h-3 w-3" />
                          {task.assignments.length > 0
                            ? task.assignments.map(a =>
                              availableUsers?.find(s => s.id === a.assigneeId)?.salespersonName ||
                              availableSupervisors?.find(s => s.id === a.assigneeId)?.salespersonName ||
                              a.assigneeId
                            ).join(', ')
                            : 'Sin asignar'}
                        </span>
                      </div>
                    </div>

                    {/* Reabrir — el círculo también des-completa, pero una tarea terminada
                        sale de la lista y ese camino de vuelta no se ve. Acá queda dicho. */}
                    {isCompleted && canComplete && targetAssignment && !selectionMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-semibold border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAssignmentMutation.mutate({
                            taskId: task.id,
                            assignmentId: targetAssignment.id,
                            status: 'pending',
                          });
                        }}
                        disabled={updateAssignmentMutation.isPending}
                        data-testid={`button-reabrir-${task.id}`}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reabrir
                      </Button>
                    )}

                    {/* Estado del cliente (seguimiento): SIEMPRE visible.
                        El estado/prioridad de la tarea no aplican acá —un seguimiento
                        no se "completa"—; lo que importa es si tiene tareas internas
                        pendientes y hace cuánto que no pasa nada con el cliente. */}
                    {isSeguimientoCard ? (
                      <div className="flex flex-row flex-wrap items-start gap-1 w-full mt-1 sm:w-auto sm:mt-0 sm:flex-col sm:items-end sm:flex-shrink-0">
                        {pendientes > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-[#fd6301]/10 text-[#c74e01] dark:bg-orange-500/15 dark:text-orange-400 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
                            title={`${pendientes} tarea${pendientes !== 1 ? 's' : ''} interna${pendientes !== 1 ? 's' : ''} sin completar`}
                            data-testid={`badge-pendiente-${task.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            {pendientes === 1 ? 'Pendiente' : `${pendientes} pendientes`}
                          </span>
                        ) : (task as any).actividadesTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                            <Check className="h-3 w-3" />
                            Al día
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                            Sin tareas
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${tonoMovimiento(dias)}`}
                          title="Última interacción registrada con el cliente"
                          data-testid={`badge-movimiento-${task.id}`}
                        >
                          <AlertCircle className="h-3 w-3" />
                          {etiquetaMovimiento(dias)}
                        </span>
                        {credito && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${credito.chip}`}
                            title="Estado de la deuda del cliente en el ERP"
                            data-testid={`badge-credito-${task.id}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${credito.punto}`} />
                            Crédito: {credito.label}
                          </span>
                        )}
                      </div>
                    ) : isProyectoCard ? (
                      /* Proyecto: avance de sus tareas siempre visible; prioridad y
                         estado siguen apareciendo al pasar el mouse, como en una tarea. */
                      <div className="flex flex-wrap items-center gap-1.5 w-full mt-1 sm:w-auto sm:mt-0 sm:flex-shrink-0">
                        {pendientes > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-[#fd6301]/10 text-[#c74e01] dark:bg-orange-500/15 dark:text-orange-400 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
                            title={`${pendientes} tarea${pendientes !== 1 ? 's' : ''} del proyecto sin completar`}
                            data-testid={`badge-pendiente-${task.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            {pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`}
                          </span>
                        ) : (task as any).actividadesTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                            <Check className="h-3 w-3" />
                            Al día
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                            Sin tareas
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {getPriorityBadge(task.priority ?? 'medium')}
                          {getStatusBadge(task.status ?? 'pendiente')}
                        </span>
                      </div>
                    ) : (
                      /* Chips de prioridad y estado: aparecen al pasar el mouse. En celular
                         no se muestran —no hay "pasar el mouse"— y además, aunque invisibles,
                         seguían ocupando su lugar y le robaban ancho al título (corrección
                         del usuario, ago-2026). */
                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {getPriorityBadge(task.priority ?? 'medium')}
                        {getStatusBadge(task.status ?? 'pendiente')}
                      </div>
                    )}
                  </div>
                );
              };

              // Escala de naranjos de la marca (pedido del usuario, ago-2026): los grupos
              // se distinguen por intensidad, no por colores distintos. Antes la lista
              // salía azul, morada, rosada y verde y no se parecía al resto del panel.
              const groupColors = ['#fd6301', '#ff8c3d', '#e35400', '#ffb37a', '#b34400', '#ff7a1a', '#9a3a00', '#ffc9a3'];
              // Los grupos guardan su color como nombre Tailwind ('blue', 'indigo'…) o como hex.
              // Sin normalizar, un nombre se usa como color CSS crudo (ej. 'blue' → azul puro #00f),
              // que sale saturado y desentona con la paleta. Lo mapeamos a un hex armónico.
              const NAMED_COLOR_HEX: Record<string, string> = {
                slate: '#64748b', gray: '#6b7280', red: '#ef4444', orange: '#f97316', amber: '#f59e0b',
                yellow: '#eab308', lime: '#84cc16', green: '#10b981', emerald: '#10b981', teal: '#14b8a6',
                // 'blue' era el color por defecto con el que se guardaban TODOS los grupos,
                // no una elección de nadie: por eso la lista entera salía azul. Se mapea al
                // naranjo de marca (pedido del usuario, ago-2026).
                cyan: '#06b6d4', sky: '#0ea5e9', blue: '#fd6301', indigo: '#6366f1', violet: '#8b5cf6',
                purple: '#8b5cf6', fuchsia: '#d946ef', pink: '#ec4899', rose: '#f43f5e',
              };
              const resolveGroupColor = (raw: string | null | undefined, i: number): string => {
                if (raw) {
                  if (raw.startsWith('#')) return raw;
                  if (NAMED_COLOR_HEX[raw]) return NAMED_COLOR_HEX[raw];
                }
                return groupColors[i % groupColors.length];
              };
              const hexToRgba = (hex: string, alpha: number): string => {
                let h = hex.replace('#', '');
                if (h.length === 3) h = h.split('').map((c) => c + c).join('');
                const int = parseInt(h, 16);
                return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
              };

              // Vista TERMINADAS: todas las tareas completadas juntas, en una sola lista.
              if (taskView === 'terminadas') {
                if (completedTasks.length === 0) {
                  return (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                        <Check className="h-7 w-7 text-emerald-500" />
                      </div>
                      <h3 className="text-base font-bold text-slate-700 dark:text-white mb-1">Sin tareas terminadas</h3>
                      <p className="text-sm text-slate-500">Las tareas que completes aparecerán aquí.</p>
                    </div>
                  );
                }
                return (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-emerald-50/40">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Check className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">Terminadas</span>
                      <span className="text-xs text-slate-400 font-medium">{completedTasks.length}</span>
                    </div>
                    <div className="px-1.5 sm:px-3 py-2 space-y-1 sm:space-y-1.5">
                      {completedTasks.map(renderTaskCard)}
                    </div>
                  </div>
                );
              }

              // Vista SEGUIMIENTO = MI EQUIPO: cada colaborador (usuario del sistema) es una
              // card con sus clientes en seguimiento. Aparece aunque tenga 0 clientes, y se
              // puede sumar a cualquier usuario "a mano" con el buscador. Para Marketing, su
              // "trabajo asignado" son las solicitudes que recibe (bandeja arriba de todo).
              // Los vendedores no gestionan equipo → ven su seguimiento como lista simple abajo.
              if (activeTab === 'seguimiento' && !isSalesperson) {
                type PersonGroup = { name: string; role: 'supervisor' | 'salesperson'; tasks: typeof filteredTasks };
                const canManageTeam = user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area';
                const byPerson: Record<string, PersonGroup> = {};
                const addTo = (id: string, name: string, role: PersonGroup['role'], task: typeof filteredTasks[number]) => {
                  if (!byPerson[id]) byPerson[id] = { name, role, tasks: [] };
                  byPerson[id].tasks.push(task);
                };
                const nameFor = (id: string) =>
                  availableSupervisors?.find((s) => s.id === id)?.salespersonName
                  || availableUsers?.find((u) => u.id === id)?.salespersonName
                  || id;

                // Al crear un seguimiento se marca también al supervisor para que le llegue,
                // pero acá el equipo son los vendedores: sus cards duplicaban toda la cartera.
                // Un cliente asignado SOLO al supervisor queda en "Sin asignar", que es lo que
                // realmente pasa: nadie del equipo lo está siguiendo.
                filteredTasks.forEach((task) => {
                  const vendedores = task.assignments.filter((a) => a.assigneeType !== 'supervisor');
                  if (vendedores.length === 0) {
                    // Industrial la lleva su encargado en persona, sin vendedores por
                    // debajo: un cliente asignado solo a él no está "sin asignar", es
                    // suyo, y su card tiene que llevar su nombre.
                    const encargado = esIndustrial
                      ? task.assignments.find((a) => a.assigneeType === 'supervisor')
                      : undefined;
                    if (encargado) {
                      addTo(encargado.assigneeId, nameFor(encargado.assigneeId), 'supervisor', task);
                      return;
                    }
                    addTo('__none__', 'Sin asignar', 'salesperson', task);
                    return;
                  }
                  vendedores.forEach((a) => {
                    addTo(a.assigneeId, nameFor(a.assigneeId), 'salesperson', task);
                  });
                });

                // Miembros del equipo que deben aparecer AUNQUE tengan 0 clientes:
                //  - supervisor/encargado: sus vendedores (su equipo por defecto)
                //  - cualquiera: los colaboradores sumados a mano desde el buscador
                const ensureMember = (id: string, name: string, role: PersonGroup['role']) => {
                  if (id && id !== user.id && !byPerson[id]) byPerson[id] = { name, role, tasks: [] };
                };
                // Con el buscador activo solo importan las coincidencias: no sumamos
                // colaboradores vacíos ni dejamos cards en cero ensuciando el resultado.
                const searching = seguimientoSearchDebounced.trim().length > 0;
                if (!searching) {
                  if (user.role === 'supervisor' || user.role === 'encargado_area') {
                    (supervisorSalespeople || []).forEach((sp) => ensureMember(sp.id, sp.salespersonName, 'salesperson'));
                  }
                  extraSeguimientoMembers
                    .filter((m) => m.type !== 'supervisor')
                    .forEach((m) => ensureMember(m.id, m.name, m.type));
                }

                // Resumen accionable de un colaborador: cuántos de sus clientes
                // tienen tareas internas pendientes y cuántos llevan demasiado
                // tiempo sin ninguna interacción.
                // Se calcula UNA vez por colaborador: el orden de las cards lo consulta
                // en cada comparación y recalcularlo ahí es cuadrático.
                const resumenCache = new Map<string, { conPendientes: number; pendientesTotal: number; frenados: number }>();
                const resumenPersona = (personaId: string, g: PersonGroup) => {
                  const hit = resumenCache.get(personaId);
                  if (hit) return hit;
                  const resumen = {
                    conPendientes: g.tasks.filter((t) => pendientesDeCliente(t) > 0).length,
                    pendientesTotal: g.tasks.reduce((n, t) => n + pendientesDeCliente(t), 0),
                    frenados: g.tasks.filter((t) => {
                      const d = diasSinMovimiento(t);
                      return d === null || d >= DIAS_SIN_MOVIMIENTO_ALERTA;
                    }).length,
                  };
                  resumenCache.set(personaId, resumen);
                  return resumen;
                };

                // Orden de los clientes dentro de una card, según el botón activo.
                const ordenarClientes = (lista: PersonGroup['tasks']) => {
                  if (seguimientoOrden === 'default') return lista;
                  return [...lista].sort((a, b) => {
                    if (seguimientoOrden === 'pendientes') {
                      return pendientesDeCliente(b) - pendientesDeCliente(a);
                    }
                    // Sin movimientos primero: los que nunca tuvieron interacción arriba.
                    const da = diasSinMovimiento(a), db = diasSinMovimiento(b);
                    if (da === null && db === null) return 0;
                    if (da === null) return -1;
                    if (db === null) return 1;
                    return db - da;
                  });
                };

                const people = Object.entries(byPerson)
                  .filter(([, g]) => !searching || g.tasks.length > 0)
                  .sort((a, b) => {
                    if (seguimientoOrden === 'pendientes') {
                      const diff = resumenPersona(b[0], b[1]).pendientesTotal - resumenPersona(a[0], a[1]).pendientesTotal;
                      if (diff !== 0) return diff;
                    } else if (seguimientoOrden === 'sin-movimiento') {
                      const diff = resumenPersona(b[0], b[1]).frenados - resumenPersona(a[0], a[1]).frenados;
                      if (diff !== 0) return diff;
                    }
                    return b[1].tasks.length - a[1].tasks.length;
                  });

                // Pool del buscador "agregar puntual": cualquier usuario del sistema no listado aún.
                const alreadyIn = new Set(Object.keys(byPerson));
                // Solo vendedores: sumar un supervisor dejaría una card que nunca se llena.
                const addPool = ((availableUsers || []).map((u) => ({ id: u.id, name: u.salespersonName, type: 'salesperson' as const })))
                  .filter((p) => !alreadyIn.has(p.id) && (!addMemberSearch || p.name.toLowerCase().includes(addMemberSearch.toLowerCase())));

                // Card de colaborador — foco en la persona y sus clientes en seguimiento.
                const renderPersonRow = (id: string, grp: PersonGroup) => {
                  const total = grp.tasks.length;
                  const resumen = resumenPersona(id, grp);
                  // El anillo mide clientes SIN tareas internas pendientes: un seguimiento
                  // nunca se completa, así que "avance" acá es "cuántos están al día".
                  const alDia = total - resumen.conPendientes;
                  const pct = total > 0 ? (alDia / total) * 100 : 0;
                  // Arrancan cerradas; buscando, se abren solas para mostrar las coincidencias.
                  const isCollapsed = !expandedSeguimientoPeople.has(id) && !searching;
                  const done = total > 0 && resumen.conPendientes === 0;
                  const isSupervisor = grp.role === 'supervisor';
                  const isNone = id === '__none__';
                  const clientesOrdenados = ordenarClientes(grp.tasks);
                  const R = 20, C = 2 * Math.PI * R;
                  return (
                    <div
                      key={id}
                      className={`rounded-2xl border bg-white overflow-hidden transition-all duration-200 ${
                        total === 0
                          ? 'border-dashed border-slate-200 bg-slate-50/40'
                          : `border-slate-200/80 shadow-sm hover:shadow-md ${!isCollapsed ? 'ring-1 ring-orange-100' : ''}`
                      }`}
                    >
                      <button
                        onClick={() => togglePersonExpanded(id)}
                        className="w-full flex items-center gap-3.5 px-3.5 sm:px-4 py-3.5 hover:bg-slate-50/70 transition-colors text-left"
                        data-testid={`button-toggle-persona-${id}`}
                      >
                        {/* Avatar con anillo de progreso */}
                        <div className="relative flex-shrink-0 w-[52px] h-[52px]">
                          <svg className="absolute inset-0 -rotate-90" width="52" height="52" viewBox="0 0 52 52">
                            <circle cx="26" cy="26" r={R} fill="none" strokeWidth="3" className="stroke-slate-100" />
                            {total > 0 && (
                              <circle
                                cx="26" cy="26" r={R} fill="none" strokeWidth="3" strokeLinecap="round"
                                stroke={done ? '#10b981' : '#f97316'}
                                strokeDasharray={C}
                                strokeDashoffset={C - (pct / 100) * C}
                                className="transition-all duration-700"
                              />
                            )}
                          </svg>
                          <div className={`absolute inset-[6px] rounded-full flex items-center justify-center text-sm font-bold ${
                            total === 0 ? 'bg-slate-100 text-slate-500'
                              : isSupervisor ? 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'
                              : 'bg-gradient-to-br from-orange-400 to-[#fd6301] text-white'
                          }`}>
                            {grp.name.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        {/* Nombre + rol + clientes */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-sm font-semibold truncate ${total === 0 ? 'text-slate-500' : 'text-slate-800'}`}>{grp.name}</span>
                            {isSupervisor && !isNone && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0">Supervisor</span>
                            )}
                          </div>
                          <div className="flex items-center gap-x-2 gap-y-1 mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                              <Building2 className="h-3 w-3" />
                              {total === 0 ? 'Sin clientes asignados' : `${total} cliente${total !== 1 ? 's' : ''} en seguimiento`}
                            </span>
                            {/* Radiografía del colaborador sin abrir su card */}
                            {resumen.conPendientes > 0 && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-[#fd6301]/10 text-[#c74e01] px-2 py-0.5 text-[10px] font-bold"
                                data-testid={`chip-pendientes-${id}`}
                              >
                                <Clock className="h-3 w-3" />
                                {resumen.conPendientes} con pendientes
                              </span>
                            )}
                            {resumen.frenados > 0 && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-bold"
                                title={`Sin interacción hace ${DIAS_SIN_MOVIMIENTO_ALERTA} días o más`}
                                data-testid={`chip-frenados-${id}`}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {resumen.frenados} sin movimiento
                              </span>
                            )}
                            {total > 0 && resumen.conPendientes === 0 && resumen.frenados === 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                                <Check className="h-3 w-3" />
                                Todo al día
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Métrica: clientes al día sobre el total de su cartera */}
                        {total > 0 && (
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className={`text-[13px] font-bold tabular-nums ${done ? 'text-emerald-600' : 'text-slate-700'}`} title="Clientes sin tareas internas pendientes">
                              {alDia}<span className="text-slate-300 font-medium">/{total}</span>
                              <span className="ml-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">al día</span>
                            </span>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: done ? '#10b981' : '#f97316' }}
                              />
                            </div>
                          </div>
                        )}

                        <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform duration-200 flex-shrink-0 ${!isCollapsed ? 'rotate-90' : ''}`} />
                      </button>
                      {!isCollapsed && (
                        <div className="px-1.5 sm:px-2.5 pb-2.5 pt-0.5 space-y-1 sm:space-y-1.5 border-t border-slate-100/80 bg-slate-50/30">
                          {clientesOrdenados.length > 0 ? (
                            clientesOrdenados.map(renderTaskCard)
                          ) : (
                            <div className="px-3 py-4 text-center">
                              <p className="text-xs text-slate-400 mb-2.5">Todavía no tiene clientes en seguimiento.</p>
                              {canManageTeam && !isNone && (
                                <button
                                  onClick={() => openNuevoSeguimiento({ id, type: grp.role })}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg px-3 py-1.5 transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Asignar primer cliente
                                </button>
                              )}
                            </div>
                          )}
                          {/* Sumar otro cliente a un colaborador que ya tiene seguimientos */}
                          {grp.tasks.length > 0 && canManageTeam && !isNone && (
                            <button
                              onClick={() => openNuevoSeguimiento({ id, type: grp.role })}
                              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-orange-600 hover:bg-orange-50 border border-dashed border-slate-200 hover:border-orange-200 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" /> Asignar otro cliente
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                };

                // Métricas de equipo — POR TAREA, no por tarjeta.
                //
                // Un seguimiento asignado al vendedor y también a su supervisor
                // aparece en las dos tarjetas, que es correcto: los dos lo
                // tienen. Sumar los largos de cada tarjeta lo contaba dos veces
                // y el total del supervisor salía inflado.
                const tareasDelEquipo = new Map<string, typeof filteredTasks[number]>();
                people.forEach(([, g]) => g.tasks.forEach((t) => tareasDelEquipo.set(t.id, t)));
                const teamTotal = tareasDelEquipo.size;
                const clientesDelEquipo = Array.from(tareasDelEquipo.values());
                const teamConPendientes = clientesDelEquipo.filter((t) => pendientesDeCliente(t) > 0).length;
                const teamPendientesTotal = clientesDelEquipo.reduce((n, t) => n + pendientesDeCliente(t), 0);
                const teamFrenados = clientesDelEquipo.filter((t) => {
                  const d = diasSinMovimiento(t);
                  return d === null || d >= DIAS_SIN_MOVIMIENTO_ALERTA;
                }).length;

                return (
                  <div className="space-y-4">
                    {/* Buscar y las dos acciones de la vista van ARRIBA DE TODO, pegadas
                        al selector de Sección (corrección del usuario, sep-2026): son con lo
                        que se entra a trabajar, y quedaban abajo del resumen, a un scroll en
                        celular. El resumen del equipo pasa a leerse después. */}
                    {/* Buscador de clientes en seguimiento */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {seguimientoSearchBox}
                      {searching && (
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap" data-testid="text-seguimiento-search-count">
                          {teamTotal} resultado{teamTotal !== 1 ? 's' : ''}
                          {teamTotal > 0 && <span className="text-slate-400 font-medium"> en {people.length} colaborador{people.length !== 1 ? 'es' : ''}</span>}
                        </span>
                      )}
                    </div>

                    {/* Buscador para sumar puntualmente cualquier colaborador del sistema */}
                    {canManageTeam && (
                      // En reposo los dos botones van sueltos, sin tarjeta que los
                      // encierre (corrección del usuario, ago-2026): la caja blanca con
                      // borde parecía una sección más y competía con las tarjetas de
                      // arriba. El recuadro vuelve solo cuando se abre el buscador de
                      // colaboradores, que sí es un panel con contenido propio.
                      <div className={showAddMember ? "rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm" : ""}>
                        {!showAddMember ? (
                          /* Mismo molde que los botones del encabezado (corrección del
                             usuario, sep-2026): rounded-2xl y alto normal, no los chips
                             chicos de antes. El secundario va blanco con borde gris; el
                             naranjo sólido queda solo para la acción principal. */
                          /* En celular van apilados y a todo el ancho: uno al lado del
                             otro, "Agregar colaborador" parte la palabra en dos líneas. */
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <button
                              onClick={() => { setShowAddMember(true); setAddMemberSearch(""); }}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-orange-200 hover:text-[#fd6301] rounded-2xl shadow-sm transition-all"
                              data-testid="button-agregar-colaborador"
                            >
                              <Plus className="h-4 w-4" /> Agregar colaborador
                            </button>
                            <button
                              onClick={() => openNuevoSeguimiento()}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold whitespace-nowrap text-white bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] rounded-2xl shadow-md shadow-orange-500/25 transition-all"
                              data-testid="button-nuevo-seguimiento"
                            >
                              <Building2 className="h-4 w-4" /> Nuevo seguimiento
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  autoFocus
                                  placeholder="Buscar colaborador del sistema..."
                                  value={addMemberSearch}
                                  onChange={(e) => setAddMemberSearch(e.target.value)}
                                  className="pl-10 bg-white border-slate-200 h-9 text-sm"
                                />
                              </div>
                              <button
                                onClick={() => { setShowAddMember(false); setAddMemberSearch(""); }}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                title="Cerrar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
                              {addPool.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4">
                                  {addMemberSearch.length > 0 ? 'Sin coincidencias.' : 'No hay más colaboradores para agregar.'}
                                </p>
                              ) : (
                                addPool.slice(0, 30).map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => {
                                      setExtraSeguimientoMembers((prev) => prev.some((m) => m.id === p.id) ? prev : [...prev, { id: p.id, name: p.name, type: p.type }]);
                                      setShowAddMember(false);
                                      setAddMemberSearch("");
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-orange-50/60 transition-colors text-left"
                                  >
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-gradient-to-br from-orange-400 to-[#fd6301]`}>
                                      {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">Vendedor</p>
                                    </div>
                                    <Plus className="h-4 w-4 text-orange-500 ml-auto flex-shrink-0" />
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resumen del equipo — la foto del área de un vistazo. Va debajo del
                        buscador y de las acciones (corrección del usuario, sep-2026). Misma
                        posición en celular y en escritorio; la grilla baja a 2 columnas sola. */}
                    {people.length > 0 && (() => {
                      // Mismo molde que las tarjetas del CRM (pedido del usuario, ago-2026):
                      // ícono en negro y suelto, número grande y el nombre debajo en gris.
                      // Centrado en celular; en pantalla grande el ícono pasa al costado.
                      const TarjetaResumen = ({ icono, valor, etiqueta, tono, testId }: {
                        icono: React.ReactNode; valor: React.ReactNode; etiqueta: string; tono?: string; testId?: string;
                      }) => (
                        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800/40 dark:border-slate-700/60 p-4 shadow-sm flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left gap-2 sm:gap-3">
                          <span className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0 text-slate-900 dark:text-slate-100">
                            {icono}
                          </span>
                          <div className="min-w-0">
                            <div className={`text-2xl font-bold leading-none tabular-nums ${tono ?? 'text-slate-900 dark:text-slate-100'}`} data-testid={testId}>
                              {valor}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{etiqueta}</p>
                          </div>
                        </div>
                      );
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                          <TarjetaResumen
                            icono={<Users className="h-5 w-5" />}
                            valor={people.length}
                            etiqueta={`persona${people.length !== 1 ? 's' : ''}`}
                          />
                          <TarjetaResumen
                            icono={<Building2 className="h-5 w-5" />}
                            valor={teamTotal}
                            etiqueta="en seguimiento"
                          />
                          {/* Un seguimiento no se "completa": lo accionable es cuántos
                              clientes tienen tareas internas abiertas y cuántos están frenados. */}
                          <TarjetaResumen
                            icono={<Clock className="h-5 w-5" />}
                            valor={teamConPendientes}
                            etiqueta={`${teamPendientesTotal} tarea${teamPendientesTotal !== 1 ? 's' : ''} abierta${teamPendientesTotal !== 1 ? 's' : ''}`}
                            tono={teamConPendientes > 0 ? 'text-[#fd6301]' : undefined}
                            testId="kpi-con-pendientes"
                          />
                          <TarjetaResumen
                            icono={<AlertTriangle className="h-5 w-5" />}
                            valor={teamFrenados}
                            etiqueta={`hace ${DIAS_SIN_MOVIMIENTO_ALERTA}+ días`}
                            tono={teamFrenados > 0 ? 'text-[#fd6301]' : undefined}
                            testId="kpi-sin-movimiento"
                          />
                        </div>
                      );
                    })()}

                    {/* Marketing: sus solicitudes son su trabajo asignado */}
                    {isMarketing && <MarketingSolicitudesInbox />}

                    {/* Acá vivía la franja de herramientas de la vista: los chips
                        "Ver primero" (Pendientes / Sin movimientos) y el "Expandir todo".
                        Se sacaron los tres (pedido del usuario, ago-2026): lo que decían
                        ya se lee en las tarjetas de arriba y en los badges de cada
                        colaborador, y ocupaban una franja entera antes de llegar al
                        equipo. Cada tarjeta se sigue abriendo una por una, y la lista
                        queda en su orden por defecto; `seguimientoOrden` y
                        `expandedSeguimientoPeople` siguen vivos por si vuelven a
                        ofrecerse desde otro lado. */}

                    {people.length > 0 ? (
                      <>
                        <div className="space-y-2.5">
                          {people.map(([id, grp]) => renderPersonRow(id, grp))}
                        </div>
                      </>
                    ) : searching ? (
                      <div className="text-center py-14">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <Search className="h-7 w-7 text-slate-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-white mb-1">Sin coincidencias</h3>
                        <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
                          Ningún cliente en seguimiento coincide con «{seguimientoSearchDebounced.trim()}».
                        </p>
                        <button
                          onClick={() => setSeguimientoSearch("")}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-4 py-2 transition-colors"
                        >
                          <X className="h-4 w-4" /> Limpiar búsqueda
                        </button>
                      </div>
                    ) : !isMarketing ? (
                      <div className="text-center py-14">
                        <div className="w-14 h-14 rounded-2xl bg-[#fd6301] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#fd6301]/25">
                          <Users className="h-7 w-7 text-white" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-white mb-1">Aún no hay seguimientos</h3>
                        <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
                          Elige un colaborador de tu equipo y asígnale sus clientes para empezar a hacerle seguimiento.
                        </p>
                        {canManageTeam && (
                          <button
                            onClick={() => openNuevoSeguimiento()}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#fd6301] hover:bg-[#e35400] rounded-lg px-4 py-2 transition-colors"
                          >
                            <Plus className="h-4 w-4" /> Nuevo seguimiento
                          </button>
                        )}
                      </div>
                    ) : (
                      // Marketing sin solicitudes ni seguimientos propios (la bandeja de
                      // arriba se oculta sola cuando está vacía).
                      <div className="text-center py-14">
                        <div className="w-14 h-14 rounded-2xl bg-[#fd6301] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#fd6301]/25">
                          <TrendingUp className="h-7 w-7 text-white" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-white mb-1">Sin solicitudes por ahora</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          Cuando el equipo te envíe solicitudes de marketing, aparecerán aquí para que las aceptes o rechaces.
                        </p>
                      </div>
                    )}
                  </div>
                );
              }

              // VISTA POR GRUPOS (pestaña Tareas): las tareas se agrupan en secciones
              // colapsables según su grupo (proyecto), con las "Sin grupo" al final.
              // Si no hay grupos definidos, degrada a una lista plana simple.
              if (viewTasks.length === 0) {
                return (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#fd6301] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#fd6301]/25">
                      <CheckSquare className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-base font-bold text-slate-700 dark:text-white mb-1">No hay tareas pendientes</h3>
                    <p className="text-sm text-slate-500">Las tareas activas aparecerán aquí.</p>
                  </div>
                );
              }

              // Solo mostramos las secciones por grupo cuando existen grupos con tareas
              // en la vista actual; si no, una lista plana simple.
              const groupsWithTasks = groups.filter((g: any) => (groupedTasks[g.id] || []).length > 0);
              if (groupsWithTasks.length === 0) {
                return (
                  <div className="space-y-1.5">
                    {viewTasks.map(renderTaskCard)}
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {/* Grupos ordenados por más pendientes primero */}
                  {[...groupsWithTasks].sort((a, b) => {
                    const aTasks = groupedTasks[a.id] || [];
                    const bTasks = groupedTasks[b.id] || [];
                    const aPending = aTasks.filter(t => t.status !== 'completada' && !t.assignments.some(as => as.status === 'completed')).length;
                    const bPending = bTasks.filter(t => t.status !== 'completada' && !t.assignments.some(as => as.status === 'completed')).length;
                    return bPending - aPending;
                  }).map((group, groupIndex) => {
                    const tasks = groupedTasks[group.id] || [];
                    // Con búsqueda activa: ocultar grupos sin coincidencias.
                    if (taskSearchDebounced.trim() && tasks.length === 0) return null;
                    const completedCount = tasks.filter(t => {
                      if (t.status === 'completada') return true;
                      const myAssign = t.assignments.find(a =>
                        (a.assigneeType === "supervisor" && a.assigneeId === user.id) ||
                        (a.assigneeType === "salesperson" && a.assigneeId === user.id) ||
                        (a.assigneeType === "user" && a.assigneeId === user.id)
                      );
                      const targetAssign = myAssign || (
                        (user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area') ? t.assignments[0] : null
                      );
                      return targetAssign?.status === 'completed';
                    }).length;
                    const totalCount = tasks.length;
                    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                    const borderColor = resolveGroupColor(group.color, groupIndex);
                    // Con búsqueda activa los grupos se expanden para mostrar las coincidencias.
                    const isCollapsed = collapsedGroups.has(group.id) && !taskSearchDebounced.trim();
                    const isGroupSelected = selectedGroupIds.has(group.id);
                    // El dueño del grupo o un admin puede renombrar/eliminar. Los vendedores
                    // no gestionan grupos → solo los ven colapsables.
                    const canManageGroup = !isSalesperson && (user.role === 'admin' || group.userId === user.id);

                    return (
                      <div
                        key={group.id}
                        className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                          selectionMode && isGroupSelected ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-200/80'
                        } ${!isCollapsed && !(selectionMode && isGroupSelected) ? 'shadow-md' : ''}`}
                        style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
                      >
                        {/* Encabezado del grupo */}
                        <div className="flex items-center">
                          {selectionMode && user.role === 'admin' && (
                            <div
                              className="pl-2.5 sm:pl-4 flex items-center flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); toggleGroupSelected(group.id); }}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                                isGroupSelected ? 'bg-red-600 border-red-600 text-white' : 'border-slate-300 bg-white hover:border-red-400'
                              }`}>
                                {isGroupSelected && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                          )}
                          {editingGroupId === group.id ? (
                            <div className="flex-1 min-w-0 flex items-center gap-2 px-2.5 sm:px-4 py-2.5">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: borderColor }} />
                              <Input
                                autoFocus
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); submitEditingGroup(); }
                                  if (e.key === 'Escape') { e.preventDefault(); setEditingGroupId(null); }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 text-sm flex-1 min-w-0 border-orange-300 focus-visible:ring-orange-400/30"
                                placeholder="Nombre del grupo"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); submitEditingGroup(); }}
                                disabled={renameGroupMutation.isPending || !editingGroupName.trim()}
                                className="p-1.5 rounded-lg text-white bg-[#fd6301] hover:bg-[#e35400] transition-all flex-shrink-0 disabled:opacity-50"
                                title="Guardar nombre"
                              >
                                {renameGroupMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingGroupId(null); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all flex-shrink-0"
                                title="Cancelar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleGroupCollapsed(group.id)}
                              className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-4 py-3 hover:bg-slate-50/70 transition-colors group/header text-left"
                            >
                              {/* Chip de identidad: inicial sobre un tinte del color del
                                  grupo. En celular no se muestra (pedido del usuario,
                                  ago-2026): repetía la primera letra del nombre que está
                                  al lado y la franja de color ya identifica la fila. */}
                              <div
                                className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center flex-shrink-0 text-[13px] font-bold"
                                style={{ backgroundColor: hexToRgba(borderColor, 0.14), color: borderColor }}
                              >
                                {(group.name?.charAt(0) || '·').toUpperCase()}
                              </div>

                              {/* Nombre + resumen */}
                              <div className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-800 truncate">{group.name}</span>
                                <span className="block mt-0.5 text-[11px] font-medium text-slate-400">
                                  {totalCount} tarea{totalCount !== 1 ? 's' : ''}
                                  {progressPercent === 100
                                    ? ' · completado'
                                    : completedCount > 0
                                      ? ` · ${completedCount} lista${completedCount !== 1 ? 's' : ''}`
                                      : ''}
                                </span>
                              </div>

                              {/* Indicador de progreso */}
                              {totalCount > 0 && (
                                <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                                  <div className="w-16 sm:w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${progressPercent}%`,
                                        backgroundColor: progressPercent === 100 ? '#10b981' : borderColor,
                                      }}
                                    />
                                  </div>
                                  <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${progressPercent === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {completedCount}<span className="text-slate-300 font-medium">/{totalCount}</span>
                                  </span>
                                </div>
                              )}

                              {/* Renombrar / eliminar: solo el dueño del grupo o un admin */}
                              {!selectionMode && canManageGroup && (
                                <div className="flex items-center flex-shrink-0">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); startEditingGroup(group.id, group.name); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startEditingGroup(group.id, group.name); } }}
                                    className="opacity-0 group-hover/header:opacity-100 p-1.5 rounded-lg hover:bg-orange-50 text-slate-300 hover:text-orange-600 transition-all cursor-pointer"
                                    title="Renombrar grupo"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); deleteGroupMutation.mutate(group.id); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); deleteGroupMutation.mutate(group.id); } }}
                                    className="opacity-0 group-hover/header:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all cursor-pointer"
                                    title="Eliminar grupo"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </span>
                                </div>
                              )}

                              <ChevronRight className={`h-4 w-4 text-slate-300 flex-shrink-0 transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}`} />
                            </button>
                          )}
                        </div>

                        {/* Tareas del grupo */}
                        {!isCollapsed && (
                          <div className="border-t border-slate-100 bg-slate-50/30">
                            <div className="px-1.5 sm:px-3 py-1.5 sm:py-2 space-y-1 sm:space-y-1.5">
                              {tasks.map(renderTaskCard)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Tareas sin grupo */}
                  {ungrouped.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 px-3 py-2 mt-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0" />
                        <span className="text-sm font-bold text-slate-500 tracking-wide">Sin grupo</span>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-slate-100 text-slate-500 font-semibold">
                          {ungrouped.length}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        {ungrouped.map(renderTaskCard)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Barra flotante de acción para eliminación masiva - solo administrador */}
          {/* La barra negra de selección tampoco va en celular: el modo seleccionar se
              activa desde la barra de escritorio, y en el teléfono quedaba flotando al
              pie, pisada por el botón del menú (pedido del usuario, ago-2026). */}
          {selectionMode && user.role === 'admin' && !esCelular && (() => {
            const { taskIds, groupIds } = getBulkDeletionTargets();
            const partes: string[] = [];
            if (taskIds.length) partes.push(`${taskIds.length} tarea${taskIds.length !== 1 ? 's' : ''}`);
            if (groupIds.length) partes.push(`${groupIds.length} grupo${groupIds.length !== 1 ? 's' : ''}`);
            const label = partes.join(' y ');
            const total = taskIds.length + groupIds.length;
            // Concordancia: solo tareas → femenino; si hay grupos → masculino
            const suffix = groupIds.length === 0
              ? (taskIds.length === 1 ? 'a' : 'as')
              : (total === 1 ? 'o' : 'os');
            return (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-2.5 border border-slate-700">
                <span className="text-sm font-medium whitespace-nowrap">
                  {total === 0 ? 'Selecciona tareas o grupos' : `${label} seleccionad${suffix}`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={exitSelectionMode}
                  className="h-8 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={total === 0 || bulkDeleteMutation.isPending}
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="h-8 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Trash2 className="h-4 w-4 mr-1.5" /> Eliminar</>
                  )}
                </Button>
              </div>
            );
          })()}

          {/* Confirmación de eliminación masiva */}
          <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar la selección?</AlertDialogTitle>
                <AlertDialogDescription>
                  {(() => {
                    const { taskIds, groupIds } = getBulkDeletionTargets();
                    const partes: string[] = [];
                    if (taskIds.length) partes.push(`${taskIds.length} tarea${taskIds.length !== 1 ? 's' : ''}`);
                    if (groupIds.length) partes.push(`${groupIds.length} grupo${groupIds.length !== 1 ? 's' : ''}`);
                    return (
                      <>
                        Se eliminará{taskIds.length + groupIds.length !== 1 ? 'n' : ''} <strong>{partes.join(' y ')}</strong>.
                        {groupIds.length > 0 && ' Al eliminar un grupo también se eliminan las tareas que contiene.'}
                        {' '}Esta acción no se puede deshacer.
                      </>
                    );
                  })()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    bulkDeleteMutation.mutate(getBulkDeletionTargets());
                    setShowBulkDeleteConfirm(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* El detalle de tarea se muestra como página (early return arriba), con el sidebar visible. */}

          {/* Diálogo de confirmación para completar tarea */}
          <AlertDialog open={!!confirmCompleteTask} onOpenChange={(open) => !open && setConfirmCompleteTask(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  ¿Deseas marcar esta tarea como completada?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción marcará tu asignación como completada. Asegúrate de haber finalizado todas las actividades relacionadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    if (confirmCompleteTask) {
                      updateAssignmentMutation.mutate({
                        taskId: confirmCompleteTask.taskId,
                        assignmentId: confirmCompleteTask.assignmentId,
                        status: "completada"
                      });
                      setConfirmCompleteTask(null);
                    }
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Sí, completar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        )}

        {/* Vista Calendario */}
        <TabsContent value="calendario" className="space-y-6">
          <CalendarViewTab
            tasks={calendarTasks}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            onOpenDetail={(taskId) => setSelectedTaskId(taskId)}
            getStatusBadge={getStatusBadge}
            getPriorityBadge={getPriorityBadge}
            salespeople={availableUsers}
            supervisors={availableSupervisors}
          />
        </TabsContent>

        {/* Promesas de compra: solo Ferreterías (Construcción tiene "Obras" en su lugar,
            Industrial no las usa) y nunca para Técnico de Obra ni Marketing. */}
        {showEstimacionTab && (
          <TabsContent value="estimacion" className="space-y-6">
            <EstimacionSemanalTab
              selectedWeek={selectedWeek}
              promesasCumplimiento={promesasCumplimiento}
              isLoadingPromesas={isLoadingPromesas}
              goToPreviousWeek={goToPreviousWeek}
              goToNextWeek={goToNextWeek}
              goToCurrentWeek={goToCurrentWeek}
              createPromesaDialogOpen={createPromesaDialogOpen}
              setCreatePromesaDialogOpen={setCreatePromesaDialogOpen}
              clientes={clientes}
              searchClient={searchClient}
              setSearchClient={setSearchClient}
              user={user}
              esConstruccion={esConstruccion}
              vendedorFilter={estimacionVendedor}
            />
          </TabsContent>
        )}

        {/* Obras — módulo propio de Construcción (reemplaza Estimación de ventas):
            control de avance por obra de cada constructora (ex planilla Excel). */}
        {showObrasTab && (
          <TabsContent value="obras" className="space-y-6">
            <ControlObrasContent
              ref={obrasRef}
              vendedorFiltro={obrasVendedor}
              onVerTodaLaCartera={() => setObrasVendedor('all')}
            />
          </TabsContent>
        )}

        {/* Rutas Comerciales — el supervisor crea rutas y asigna clientes; el vendedor ve las suyas */}
        {showRutasTab && (
          <TabsContent value="rutas-comerciales" className="space-y-6">
            <RutasComercialesContent ref={rutasRef} embebido />
          </TabsContent>
        )}

        {/* Visitas Técnicas — módulo propio de Construcción (salió del sidebar y vive acá) */}
        {showVisitasTab && (
          <TabsContent value="visitas-tecnicas" className="space-y-6">
            <VisitasTecnicasContent embedded />
          </TabsContent>
        )}

        {/* CRM — pipeline de Seguimiento de Clientes embebido como pestaña del Panel de Trabajo */}
        {showCrmTab && (
          <TabsContent value="crm" className="space-y-6">
            <SeguimientoClientes ref={crmRef} segmentoArea={segmentoFilter} vendedorFiltro={crmVendedor} />
          </TabsContent>
        )}

      </Tabs>
    </div>
    </PanelChangesContext.Provider>
  );
}

// Componente de pestaña de Estimación Semanal/Mensual (Promesas de Compra)
function EstimacionSemanalTab({
  selectedWeek,
  promesasCumplimiento,
  isLoadingPromesas,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek,
  createPromesaDialogOpen,
  setCreatePromesaDialogOpen,
  clientes,
  searchClient,
  setSearchClient,
  user,
  esConstruccion,
  vendedorFilter,
}: {
  selectedWeek: Date;
  promesasCumplimiento: PromesaCumplimiento[];
  isLoadingPromesas: boolean;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  createPromesaDialogOpen: boolean;
  setCreatePromesaDialogOpen: (open: boolean) => void;
  clientes: Cliente[];
  searchClient: string;
  setSearchClient: (value: string) => void;
  user: any;
  esConstruccion: boolean;
  /** Filtro de cartera. Vive en el Panel: su selector está en el encabezado del
      módulo, junto al de Área (pedido del usuario, sep-2026). */
  vendedorFilter: string;
}) {
  // Estados locales para edición de promesas
  const [editPromesaDialogOpen, setEditPromesaDialogOpen] = useState(false);
  const [selectedPromesa, setSelectedPromesa] = useState<PromesaCumplimiento | null>(null);
  // Promesas con cambios recientes no vistos: quedan destacadas al entrar.
  const estimacionHighlights = usePanelHighlights('estimacion');

  // Query para obtener lista de vendedores (para filtro)
  const { data: salespeople = [] } = useQuery<Array<{ id: string; fullName: string; salespersonName: string }>>({
    queryKey: ['/api/users/salespeople'],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // Rango de fechas del período mostrado (semana en Ferreterías, mes en Construcción)
  const rangoPeriodo = esConstruccion
    ? {
        desde: format(startOfMonth(selectedWeek), 'yyyy-MM-dd'),
        hasta: format(endOfMonth(selectedWeek), 'yyyy-MM-dd'),
      }
    : {
        desde: format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        hasta: format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };

  // Vendido TOTAL del período (facturado + NVV + GDV), no solo el de los clientes
  // prometidos, más el avance del mes contra la meta. El backend acota por rol:
  // el vendedor solo ve lo suyo y el supervisor lo de su equipo.
  const {
    data: resumenVentas,
    isError: errorResumenVentas,
  } = useQuery<ResumenVentasEstimacion>({
    queryKey: ['/api/promesas-compra/resumen-ventas', rangoPeriodo.desde, rangoPeriodo.hasta, vendedorFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: rangoPeriodo.desde, endDate: rangoPeriodo.hasta });
      if (vendedorFilter !== 'all') params.set('vendedorId', vendedorFilter);
      const response = await apiRequest(`/api/promesas-compra/resumen-ventas?${params.toString()}`);
      return response.json();
    },
    enabled: !!user,
    // La consulta barre todo el mes del segmento y puede tardar: si falla
    // (sesión recién renovada, corte de red) se reintenta en vez de dejar los
    // cuadros en cero, que se lee como "no vendí nada".
    retry: 2,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Filtrar promesas válidas y por vendedor
  const promesasValidas = promesasCumplimiento.filter(p => p.promesa != null);
  const promesasFiltradas = vendedorFilter === "all"
    ? promesasValidas
    : promesasValidas.filter(p => p.promesa.vendedorId === vendedorFilter);

  // Calcular resumen
  const resumen = {
    totalPromesas: promesasFiltradas.length,
    totalPrometido: promesasFiltradas.reduce((sum, p) => sum + parseFloat(p.promesa.montoPrometido), 0),
    totalVendido: promesasFiltradas.reduce((sum, p) => sum + p.ventasReales, 0),
    cumplidas: promesasFiltradas.filter(p => p.estado === 'cumplido').length,
    superadas: promesasFiltradas.filter(p => p.estado === 'superado').length,
    cumplidasParcialmente: promesasFiltradas.filter(p => p.estado === 'cumplido_parcialmente').length,
    insuficientes: promesasFiltradas.filter(p => p.estado === 'insuficiente').length,
    noCumplidas: promesasFiltradas.filter(p => p.estado === 'no_cumplido').length,
  };

  // Función para obtener nombre de vendedor
  const getVendedorNombre = (vendedorId: string) => {
    const vendedor = salespeople.find(v => v.id === vendedorId);
    return vendedor?.fullName || vendedor?.salespersonName || 'Desconocido';
  };

  const getPeriodLabel = () => {
    if (esConstruccion) {
      return format(selectedWeek, 'MMMM yyyy', { locale: es });
    }
    const monthStart = new Date(selectedWeek.getFullYear(), selectedWeek.getMonth(), 1);
    const firstMonday = startOfWeek(monthStart, { weekStartsOn: 1 });
    const weekNum = Math.floor((selectedWeek.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return `Semana ${weekNum} de ${format(selectedWeek, 'MMMM', { locale: es })} (${format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'dd MMM', { locale: es })} - ${format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'dd MMM', { locale: es })})`;
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          {/* Mismo tamaño que el ícono del título del módulo ("Panel de Trabajo"):
              40px y esquina xl (corrección del usuario, ago-2026). La bajada
              "Registra compromisos de compra…" se sacó: explicaba lo que la propia
              pantalla muestra y ocupaba dos líneas en celular. */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] flex items-center justify-center shadow-md shadow-orange-500/25 flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{esConstruccion ? 'Estimación Mensual' : 'Estimación Semanal'}</h2>
          </div>
        </div>
        {/* El filtro de Vendedor y el botón "Nueva Promesa" que vivían acá subieron al
            encabezado del módulo (pedido del usuario, sep-2026): quedan en la misma fila
            que el Área y el botón de las demás pestañas, en vez de repetir una barra de
            acciones a media pantalla. */}
      </div>

      {/* Selector de período */}
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#fd6301] text-white flex-shrink-0 shadow-md shadow-[#fd6301]/25">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-900 dark:text-slate-100 mb-0.5">{esConstruccion ? 'Selección de Mes' : 'Selección de Semana'}</span>
                <span className="font-normal text-sm text-slate-700 dark:text-slate-200">{getPeriodLabel()}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-periodo-anterior" className="h-8 w-8 p-0 sm:h-9 sm:w-9 rounded-lg border-slate-200 dark:border-slate-700 hover:border-orange-200 hover:text-orange-600 transition-all">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} data-testid="button-periodo-actual" className="h-8 px-3 sm:h-9 sm:px-4 text-xs sm:text-sm rounded-2xl font-semibold border-slate-200 dark:border-slate-700 hover:border-orange-200 hover:text-orange-600 transition-all">
                {esConstruccion ? 'Mes Actual' : 'Hoy'}
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-periodo-siguiente" className="h-8 w-8 p-0 sm:h-9 sm:w-9 rounded-lg border-slate-200 dark:border-slate-700 hover:border-orange-200 hover:text-orange-600 transition-all">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen de cumplimiento — dos indicadores por marco */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Prometido vs. Vendido de las promesas */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x divide-slate-200/70 dark:divide-slate-800">
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">Prometido</span>
                  <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-4 w-4 text-[#fd6301]" />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-normal text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                  ${resumen.totalPrometido.toLocaleString('es-CL')}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{resumen.totalPromesas} promesas</p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">Vendido</span>
                  <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-[#fd6301]" />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-normal text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                  ${resumen.totalVendido.toLocaleString('es-CL')}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">NVV + GDV de lo prometido</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cumplidas vs. Incumplidas */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x divide-slate-200/70 dark:divide-slate-800">
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">Cumplidas</span>
                  <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-[#fd6301]" />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-bold text-[#fd6301] tracking-tight tabular-nums">
                  {resumen.cumplidas + resumen.superadas + resumen.cumplidasParcialmente}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{resumen.superadas} superadas · {resumen.cumplidasParcialmente} parcial</p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">Incumplidas</span>
                  <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-4 w-4 text-[#fd6301]" />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                  {resumen.insuficientes + resumen.noCumplidas}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{resumen.insuficientes} insufic. · {resumen.noCumplidas} sin ventas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendido TOTAL del período: no depende de lo prometido. Ojo: facturado y
            GDV pueden ser la misma venta en dos momentos, por eso va el desglose. */}
        <Card className="border border-orange-200 dark:border-orange-900/40 shadow-sm rounded-2xl" data-testid="card-total-vendido">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#fd6301]">
                Total vendido {esConstruccion ? 'del mes' : 'de la semana'}
              </span>
              <div className="h-8 w-8 rounded-xl bg-[#fd6301] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#fd6301]/25">
                <Wallet className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
              {resumenVentas
                ? `$${resumenVentas.periodo.total.toLocaleString('es-CL')}`
                : errorResumenVentas
                  ? <span className="text-base font-semibold text-red-600">No se pudo calcular</span>
                  : <span className="text-slate-300">—</span>}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {!resumenVentas
                ? (errorResumenVentas ? 'Vuelve a entrar a la pestaña para reintentar' : 'Calculando…')
                : resumenVentas.alcance === 'segmento'
                  ? 'Todo el segmento Ferreterías'
                  : resumenVentas.alcance === 'equipo'
                    ? 'Todos los vendedores de tu equipo'
                    : 'Solo el vendedor seleccionado'}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800">
              {([
                { etiqueta: 'Facturado', valor: resumenVentas?.periodo.facturado ?? 0 },
                { etiqueta: 'NVV', valor: resumenVentas?.periodo.nvv ?? 0 },
                { etiqueta: 'GDV', valor: resumenVentas?.periodo.gdv ?? 0 },
              ]).map(({ etiqueta, valor }) => (
                <div key={etiqueta} className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{etiqueta}</p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums truncate">
                    ${valor.toLocaleString('es-CL')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Avance contra la meta. La meta siempre es MENSUAL, así que se compara
            con lo vendido en todo el mes al que pertenece el período mostrado. */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl" data-testid="card-meta-mes">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                Meta de {format(selectedWeek, 'MMMM', { locale: es })}
              </span>
              <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <Target className="h-4 w-4 text-slate-500" />
              </div>
            </div>
            {(resumenVentas?.mes.meta ?? 0) > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                    {(resumenVentas?.mes.porcentaje ?? 0).toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums truncate">
                    de ${(resumenVentas?.mes.meta ?? 0).toLocaleString('es-CL')}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-[#fd6301] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, resumenVentas?.mes.porcentaje ?? 0))}%` }}
                  />
                </div>
                <p className="text-[11px] mt-2 tabular-nums">
                  {(resumenVentas?.mes.falta ?? 0) > 0 ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      Faltan <span className="font-semibold text-slate-700 dark:text-slate-200">${(resumenVentas?.mes.falta ?? 0).toLocaleString('es-CL')}</span> para la meta
                    </span>
                  ) : (
                    <span className="font-semibold text-emerald-600">Meta cumplida</span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Sobre ${(resumenVentas?.mes.total ?? 0).toLocaleString('es-CL')} vendidos en el mes (facturado + NVV + GDV)
                </p>
              </>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold text-slate-300 dark:text-slate-600 tracking-tight">—</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {resumenVentas
                    ? 'Sin meta cargada para este mes'
                    : errorResumenVentas
                      ? 'No se pudo calcular'
                      : 'Calculando…'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de promesas con cumplimiento */}
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
        <CardHeader className="py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">Detalle de Promesas</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">Comparación de compromisos vs. ventas reales</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPromesas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#fd6301]" />
            </div>
          ) : promesasCumplimiento.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fd6301] shadow-md shadow-[#fd6301]/25">
                <CalendarIcon className="h-7 w-7 text-white" />
              </div>
              <p className="font-medium">No hay promesas registradas para esta semana</p>
            </div>
          ) : promesasFiltradas.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fd6301] shadow-md shadow-[#fd6301]/25">
                <Filter className="h-7 w-7 text-white" />
              </div>
              <p className="font-medium">No hay promesas para el vendedor seleccionado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop view */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                        <th className="text-left py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Vendedor</th>
                      )}
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cliente</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Prometido</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Vendido</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cumplimiento</th>
                      <th className="text-center py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {promesasFiltradas.map((item) => (
                      <tr
                        key={item.promesa.id}
                        className={`hover:bg-orange-50/40 dark:hover:bg-orange-950/20 cursor-pointer transition-colors ${
                          estimacionHighlights.has(item.promesa.id) ? 'bg-orange-50/70 dark:bg-orange-950/30 shadow-[inset_3px_0_0_#fd6301]' : ''
                        }`}
                        data-testid={`row-promesa-${item.promesa.id}`}
                        onClick={() => {
                          setSelectedPromesa(item);
                          setEditPromesaDialogOpen(true);
                        }}
                      >
                        {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                          <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">{getVendedorNombre(item.promesa.vendedorId)}</td>
                        )}
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">{item.promesa.clienteNombre}</td>
                        <td className="text-right py-3 px-4 text-slate-700 dark:text-slate-200 tabular-nums">${parseFloat(item.promesa.montoPrometido).toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4 text-slate-700 dark:text-slate-200 tabular-nums">${item.ventasReales.toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`tabular-nums ${item.cumplimiento >= 100 ? 'text-emerald-600 font-semibold' : item.cumplimiento >= 80 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold'}`}>
                              {item.cumplimiento.toFixed(1)}%
                            </span>
                            {item.cumplimiento >= 100 ? (
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          {item.estado === 'superado' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 font-medium rounded-full">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Superado
                            </Badge>
                          )}
                          {item.estado === 'cumplido' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 font-medium rounded-full">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Cumplido
                            </Badge>
                          )}
                          {item.estado === 'cumplido_parcialmente' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 font-medium rounded-full">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Parcialmente
                            </Badge>
                          )}
                          {item.estado === 'insuficiente' && (
                            <Badge variant="outline" className="bg-orange-50 text-[#fd6301] border-orange-200 dark:bg-orange-950/40 dark:border-orange-900 font-medium rounded-full">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Insuficiente
                            </Badge>
                          )}
                          {item.estado === 'no_cumplido' && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 font-medium rounded-full">
                              <XCircle className="mr-1 h-3 w-3" />
                              No Cumplido
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-500 dark:text-slate-400">{item.promesa.observaciones || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="lg:hidden space-y-2">
                {promesasFiltradas.map((item) => (
                  <Card
                    key={item.promesa.id}
                    className={`rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-all ${
                      estimacionHighlights.has(item.promesa.id)
                        ? 'border-orange-300 ring-2 ring-[#fd6301]/25 bg-orange-50/50 dark:bg-orange-950/20'
                        : 'border-slate-200/70 dark:border-slate-800 hover:border-orange-200'
                    }`}
                    data-testid={`card-promesa-${item.promesa.id}`}
                    onClick={() => {
                      setSelectedPromesa(item);
                      setEditPromesaDialogOpen(true);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{item.promesa.clienteNombre}</p>
                            {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                              <p className="text-[10px] text-muted-foreground">
                                Vendedor: {getVendedorNombre(item.promesa.vendedorId)}
                              </p>
                            )}
                            {item.promesa.observaciones && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.promesa.observaciones}</p>
                            )}
                          </div>
                          {item.estado === 'superado' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              Superado
                            </Badge>
                          )}
                          {item.estado === 'cumplido' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              Cumplido
                            </Badge>
                          )}
                          {item.estado === 'cumplido_parcialmente' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              Parcial
                            </Badge>
                          )}
                          {item.estado === 'insuficiente' && (
                            <Badge variant="outline" className="bg-orange-50 text-[#fd6301] border-orange-200 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              Insufic.
                            </Badge>
                          )}
                          {item.estado === 'no_cumplido' && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              No Cump.
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Prometido</p>
                            <p className="text-sm font-semibold">${(parseFloat(item.promesa.montoPrometido) / 1000000).toFixed(1)}M</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Vendido</p>
                            <p className="text-sm font-semibold">${(item.ventasReales / 1000000).toFixed(1)}M</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Cumplim.</p>
                            <div className="flex items-center gap-1">
                              <span className={`text-sm font-semibold ${item.cumplimiento >= 100 ? 'text-emerald-600' : item.cumplimiento >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                                {item.cumplimiento.toFixed(0)}%
                              </span>
                              {item.cumplimiento >= 100 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear promesa */}
      <CreatePromesaDialog
        open={createPromesaDialogOpen}
        onOpenChange={setCreatePromesaDialogOpen}
        selectedWeek={selectedWeek}
        clientes={clientes}
        searchClient={searchClient}
        setSearchClient={setSearchClient}
        user={user}
        esConstruccion={esConstruccion}
      />

      {/* Dialog para editar promesa */}
      {selectedPromesa && (
        <EditPromesaDialog
          open={editPromesaDialogOpen}
          onOpenChange={setEditPromesaDialogOpen}
          promesa={selectedPromesa}
          user={user}
        />
      )}
    </div>
  );
}

// Dialog para crear promesa
function CreatePromesaDialog({
  open,
  onOpenChange,
  selectedWeek,
  clientes,
  searchClient,
  setSearchClient,
  user,
  esConstruccion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWeek: Date;
  clientes: Cliente[];
  searchClient: string;
  setSearchClient: (value: string) => void;
  user: any;
  esConstruccion: boolean;
}) {
  const { toast } = useToast();
  const [clienteTipo, setClienteTipo] = useState<"activo" | "potencial">("activo");
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [manualClienteNombre, setManualClienteNombre] = useState("");
  const [manualClienteId, setManualClienteId] = useState("");
  const [montoPrometido, setMontoPrometido] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [dialogWeek, setDialogWeek] = useState(selectedWeek);
  const [selectedSalesperson, setSelectedSalesperson] = useState("");

  // Query para obtener lista de vendedores (solo admin/supervisor)
  // Supervisores solo ven vendedores de su segmento, admin ve todos
  const salespeopleEndpoint = (user?.role === 'supervisor' || user?.role === 'encargado_area')
    ? `/api/supervisor/${user.id}/salespeople`
    : '/api/users/salespeople';

  const { data: salespeople = [] } = useQuery<Array<{ id: string; fullName: string; salespersonName: string }>>({
    queryKey: [salespeopleEndpoint],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // Actualizar dialogWeek cuando cambia selectedWeek externamente
  useEffect(() => {
    setDialogWeek(selectedWeek);
  }, [selectedWeek]);

  // Establecer vendedor por defecto según rol
  useEffect(() => {
    if (user?.role === 'salesperson') {
      setSelectedSalesperson(user.id);
    } else if (salespeople.length > 0 && !selectedSalesperson) {
      // Para admin/supervisor, no pre-seleccionar ninguno
      setSelectedSalesperson("");
    }
  }, [user, salespeople]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/promesas-compra', data);
    },
    onSuccess: () => {
      // Invalidate all promesas queries with exact and partial matches
      queryClient.invalidateQueries({
        queryKey: ['/api/promesas-compra']
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/promesas-compra/cumplimiento/reporte']
      });
      // Force refetch
      queryClient.refetchQueries({
        queryKey: ['/api/promesas-compra/cumplimiento/reporte']
      });
      toast({
        title: "Promesa creada",
        description: "La promesa de compra se ha registrado correctamente",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la promesa",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setClienteTipo("activo");
    setSelectedClient(null);
    setManualClienteNombre("");
    setManualClienteId("");
    setMontoPrometido("");
    setObservaciones("");
    setSearchClient("");
    setDialogWeek(selectedWeek);
    if (user?.role !== 'salesperson') {
      setSelectedSalesperson("");
    }
  };

  const handleSubmit = () => {
    // Validación de vendedor
    if (!selectedSalesperson) {
      toast({
        title: "Error",
        description: "Por favor seleccione un vendedor",
        variant: "destructive",
      });
      return;
    }

    // Validación según tipo de cliente
    if (clienteTipo === "potencial") {
      if (!manualClienteNombre.trim() || !montoPrometido) {
        toast({
          title: "Error",
          description: "Por favor complete todos los campos requeridos",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!selectedClient || !montoPrometido) {
        toast({
          title: "Error",
          description: "Por favor seleccione un cliente y complete el monto",
          variant: "destructive",
        });
        return;
      }
    }

    const year = getYear(dialogWeek);

    let periodStart: Date;
    let periodEnd: Date;
    let periodKey: string;
    let periodNumber: number;

    if (esConstruccion) {
      // Para Construcción: períodos mensuales
      periodStart = startOfMonth(dialogWeek);
      periodEnd = endOfMonth(dialogWeek);
      const monthIndex = dialogWeek.getMonth() + 1;
      periodKey = `${year}-${String(monthIndex).padStart(2, '0')}`;
      periodNumber = monthIndex;
    } else {
      // Para otros segmentos: períodos semanales
      periodStart = startOfWeek(dialogWeek, { weekStartsOn: 1 });
      periodEnd = endOfWeek(dialogWeek, { weekStartsOn: 1 });

      // IMPORTANTE: Si el fin de semana cae en el mes siguiente, cortarlo en el último día del mes actual
      const currentMonth = dialogWeek.getMonth();
      const lastDayOfMonth = new Date(dialogWeek.getFullYear(), currentMonth + 1, 0);

      if (periodEnd.getMonth() !== currentMonth) {
        periodEnd = lastDayOfMonth;
      }

      const weekNumber = getISOWeek(dialogWeek);
      periodKey = `${year}-${String(weekNumber).padStart(2, '0')}`;
      periodNumber = weekNumber;
    }

    createMutation.mutate({
      vendedorId: selectedSalesperson,
      clienteId: clienteTipo === "potencial" ? (manualClienteId.trim() || 'PROSPECTO') : selectedClient!.koen,
      clienteNombre: clienteTipo === "potencial" ? manualClienteNombre.trim() : selectedClient!.nokoen,
      clienteTipo: clienteTipo,
      montoPrometido: parseFloat(montoPrometido),
      semana: periodKey,
      anio: year,
      numeroSemana: periodNumber,
      fechaInicio: format(periodStart, 'yyyy-MM-dd'),
      fechaFin: format(periodEnd, 'yyyy-MM-dd'),
      observaciones: observaciones || null,
    });
  };

  // Calcular valores para visualización del período
  const displayYear = getYear(dialogWeek);
  const monthName = format(dialogWeek, 'MMMM yyyy', { locale: es });

  let displayStart: Date;
  let displayEnd: Date;
  let displayLabel: string;

  if (esConstruccion) {
    // Para Construcción: mostrar mes completo
    displayStart = startOfMonth(dialogWeek);
    displayEnd = endOfMonth(dialogWeek);
    displayLabel = format(dialogWeek, 'MMMM yyyy', { locale: es });
  } else {
    // Para otros segmentos: mostrar semana
    displayStart = startOfWeek(dialogWeek, { weekStartsOn: 1 });
    displayEnd = endOfWeek(dialogWeek, { weekStartsOn: 1 });

    const currentMonth = dialogWeek.getMonth();
    const lastDayOfMonth = new Date(dialogWeek.getFullYear(), currentMonth + 1, 0);

    if (displayEnd.getMonth() !== currentMonth) {
      displayEnd = lastDayOfMonth;
    }

    // Calcular semana del mes (1-5)
    const monthStartDate = new Date(dialogWeek.getFullYear(), dialogWeek.getMonth(), 1);
    const firstMonday = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    const weekOfMonth = Math.floor((dialogWeek.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    displayLabel = `Semana ${weekOfMonth} de ${format(dialogWeek, 'MMMM', { locale: es })}`;
  }

  // Handler para limpiar campos al cambiar tipo de cliente
  const handleClienteTipoChange = (tipo: "activo" | "potencial") => {
    setClienteTipo(tipo);
    setSelectedClient(null);
    setManualClienteNombre("");
    setManualClienteId("");
    setSearchClient("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-crear-promesa">
        <DialogHeader>
          <DialogTitle className="text-xl">Nueva Promesa de Compra</DialogTitle>
          <DialogDescription className="text-sm">
            Complete la información del compromiso de compra
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Periodo de la Promesa */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 block">
              Periodo de la Promesa {esConstruccion ? '(Mensual)' : '(Semanal)'}
            </Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogWeek(prev => esConstruccion ? subMonths(prev, 1) : subWeeks(prev, 1))}
                className="h-8"
                data-testid="button-prev-period"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center">
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  {displayLabel}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  {format(displayStart, 'dd MMM', { locale: es })} - {format(displayEnd, 'dd MMM', { locale: es })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogWeek(prev => esConstruccion ? addMonths(prev, 1) : addWeeks(prev, 1))}
                className="h-8"
                data-testid="button-next-period"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Vendedor */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Vendedor *</Label>
            {user?.role === 'salesperson' ? (
              <div className="p-3 border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="font-medium text-gray-700 dark:text-gray-300">{user.fullName || user.email}</p>
                <p className="text-sm text-muted-foreground">Este compromiso se registrará a tu nombre</p>
              </div>
            ) : (
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                <SelectTrigger className="h-11" data-testid="select-vendedor">
                  <SelectValue placeholder="Selecciona un vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  {salespeople.map((salesperson) => (
                    <SelectItem key={salesperson.id} value={salesperson.id}>
                      {salesperson.fullName || salesperson.salespersonName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tipo de Cliente */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Tipo de Cliente *</Label>
            <RadioGroup
              value={clienteTipo}
              onValueChange={handleClienteTipoChange}
              className="grid grid-cols-2 gap-3"
            >
              <div className={`flex items-center space-x-3 border-2 rounded-lg p-3 cursor-pointer transition-all ${clienteTipo === "activo"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}>
                <RadioGroupItem value="activo" id="activo" data-testid="radio-cliente-activo" />
                <Label htmlFor="activo" className="font-medium cursor-pointer flex-1">
                  Cliente Activo
                </Label>
              </div>
              <div className={`flex items-center space-x-3 border-2 rounded-lg p-3 cursor-pointer transition-all ${clienteTipo === "potencial"
                ? "border-purple-500 bg-purple-50 dark:bg-purple-950"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}>
                <RadioGroupItem value="potencial" id="potencial" data-testid="radio-cliente-potencial" />
                <Label htmlFor="potencial" className="font-medium cursor-pointer flex-1">
                  Cliente Potencial
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Información del Cliente */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold block">
              {clienteTipo === "activo" ? "Seleccionar Cliente *" : "Datos del Cliente Potencial *"}
            </Label>

            {clienteTipo === "activo" ? (
              // Cliente Activo - Buscador
              <>
                {selectedClient ? (
                  <div className="flex items-center gap-3 p-3 border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 dark:text-green-100">{selectedClient.nokoen}</p>
                      <p className="text-sm text-green-700 dark:text-green-300">Código: {selectedClient.koen}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClient(null)}
                      className="hover:bg-green-100 dark:hover:bg-green-900"
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente por nombre o código..."
                        value={searchClient}
                        onChange={(e) => setSearchClient(e.target.value)}
                        className="pl-9 h-11"
                        data-testid="input-buscar-cliente"
                      />
                    </div>
                    {searchClient && clientes.length > 0 && (
                      <div className="max-h-52 overflow-y-auto border rounded-lg shadow-sm">
                        {clientes.map((cliente) => (
                          <button
                            key={cliente.id}
                            onClick={() => setSelectedClient(cliente)}
                            className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors border-b last:border-b-0"
                            data-testid={`button-seleccionar-cliente-${cliente.koen}`}
                          >
                            <p className="font-medium text-sm">{cliente.nokoen}</p>
                            <p className="text-xs text-muted-foreground">Código: {cliente.koen}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Cliente Potencial - Entrada Manual
              <div className="space-y-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <div>
                  <Label htmlFor="manualNombre" className="text-sm font-medium mb-1.5 block">
                    Nombre del Cliente *
                  </Label>
                  <Input
                    id="manualNombre"
                    placeholder="Ingrese el nombre completo del cliente"
                    value={manualClienteNombre}
                    onChange={(e) => setManualClienteNombre(e.target.value)}
                    className="h-10"
                    data-testid="input-manual-nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="manualCodigo" className="text-sm font-medium mb-1.5 block">
                    Código del Cliente (Opcional)
                  </Label>
                  <Input
                    id="manualCodigo"
                    placeholder="Ej: PROSP001"
                    value={manualClienteId}
                    onChange={(e) => setManualClienteId(e.target.value)}
                    className="h-10"
                    data-testid="input-manual-codigo"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Si no se especifica, se generará automáticamente
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Monto Prometido */}
          <div>
            <Label htmlFor="monto" className="text-sm font-semibold mb-2 block">
              Monto Prometido *
            </Label>
            <Input
              id="monto"
              type="number"
              placeholder="Ej: 1500000"
              value={montoPrometido}
              onChange={(e) => setMontoPrometido(e.target.value)}
              className="h-11 text-base"
              data-testid="input-monto-prometido"
            />
          </div>

          {/* Observaciones */}
          <div>
            <Label htmlFor="observaciones" className="text-sm font-semibold mb-2 block">
              Observaciones
            </Label>
            <Textarea
              id="observaciones"
              placeholder="Notas adicionales (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="min-h-20 resize-none"
              data-testid="textarea-observaciones"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-3">
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="sm:w-auto rounded-2xl"
              data-testid="button-cancelar"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                !selectedSalesperson ||
                (clienteTipo === "activo" && !selectedClient) ||
                (clienteTipo === "potencial" && !manualClienteNombre.trim()) ||
                !montoPrometido
              }
              className="sm:w-auto rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
              data-testid="button-guardar-promesa"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Promesa'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dialog para editar promesa (ver detalles y actualizar ventas reales)
function EditPromesaDialog({
  open,
  onOpenChange,
  promesa,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promesa: PromesaCumplimiento;
  user: any;
}) {
  const { toast } = useToast();
  const [ventasRealesManual, setVentasRealesManual] = useState(
    promesa.promesa.ventasRealesManual ? parseFloat(promesa.promesa.ventasRealesManual as any).toString() : ""
  );
  const [observaciones, setObservaciones] = useState(promesa.promesa.observaciones || "");
  const [montoPrometidoEdit, setMontoPrometidoEdit] = useState(
    promesa.promesa.montoPrometido ? parseFloat(promesa.promesa.montoPrometido).toString() : ""
  );

  // Reset form when promesa changes
  useEffect(() => {
    setVentasRealesManual(promesa.promesa.ventasRealesManual ? parseFloat(promesa.promesa.ventasRealesManual as any).toString() : "");
    setObservaciones(promesa.promesa.observaciones || "");
    setMontoPrometidoEdit(promesa.promesa.montoPrometido ? parseFloat(promesa.promesa.montoPrometido).toString() : "");
  }, [promesa]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/promesas-compra/${promesa.promesa.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/promesas-compra/cumplimiento/reporte']
      });
      // Force refetch
      queryClient.refetchQueries({
        queryKey: ['/api/promesas-compra/cumplimiento/reporte']
      });
      toast({
        title: "Promesa actualizada",
        description: "Los datos se han actualizado correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la promesa",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/promesas-compra/${promesa.promesa.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/promesas-compra/cumplimiento/reporte']
      });
      // Force refetch
      queryClient.refetchQueries({
        queryKey: ['/api/promesas-compra/cumplimiento/reporte']
      });
      toast({
        title: "Promesa eliminada",
        description: "La promesa se ha eliminado correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la promesa",
        variant: "destructive",
      });
    },
  });

  // Permisos (ago-2026): el vendedor fija el monto al crear la promesa y después
  // ya no lo mueve ni la elimina; sí sigue registrando sus ventas reales y notas.
  const esAdminOSupervisor = ['admin', 'supervisor', 'encargado_area'].includes(user?.role || '');
  const esVendedorDeLaPromesa = user?.role === 'salesperson' && promesa.promesa.vendedorId === user?.id;
  const puedeEditarMonto = esAdminOSupervisor;
  const puedeEditarSeguimiento = esAdminOSupervisor || esVendedorDeLaPromesa;
  const puedeEliminar = esAdminOSupervisor;

  const handleSubmit = () => {
    if (!puedeEditarSeguimiento) {
      toast({
        title: "No autorizado",
        description: "No puedes editar esta promesa",
        variant: "destructive",
      });
      return;
    }

    const cambios: any = {
      ventasRealesManual: ventasRealesManual ? parseFloat(ventasRealesManual) : null,
      observaciones: observaciones || null,
    };

    if (puedeEditarMonto) {
      const monto = parseFloat(montoPrometidoEdit);
      if (!montoPrometidoEdit || !isFinite(monto) || monto <= 0) {
        toast({
          title: "Monto inválido",
          description: "El monto prometido debe ser mayor que cero",
          variant: "destructive",
        });
        return;
      }
      cambios.montoPrometido = monto;
    }

    updateMutation.mutate(cambios);
  };

  // Calcular cumplimiento y estado con los datos actuales del formulario
  const montoEditado = parseFloat(montoPrometidoEdit);
  const montoPrometido = puedeEditarMonto && isFinite(montoEditado) && montoEditado > 0
    ? montoEditado
    : parseFloat(promesa.promesa.montoPrometido);
  const ventasActuales = ventasRealesManual ? parseFloat(ventasRealesManual) : promesa.ventasReales;
  const cumplimientoActual = montoPrometido > 0 ? (ventasActuales / montoPrometido) * 100 : 0;

  let estadoActual: 'cumplido' | 'superado' | 'cumplido_parcialmente' | 'insuficiente' | 'no_cumplido';
  if (cumplimientoActual >= 100) {
    estadoActual = cumplimientoActual > 100 ? 'superado' : 'cumplido';
  } else if (cumplimientoActual >= 80) {
    estadoActual = 'cumplido_parcialmente';
  } else if (cumplimientoActual > 0) {
    estadoActual = 'insuficiente';
  } else {
    estadoActual = 'no_cumplido';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-editar-promesa">
        <DialogHeader>
          <DialogTitle className="text-xl">Detalle de Promesa de Compra</DialogTitle>
          <DialogDescription className="text-sm">
            {puedeEditarMonto
              ? 'Puede actualizar el monto prometido, las ventas reales y las observaciones'
              : puedeEditarSeguimiento
                ? 'Puede actualizar las ventas reales y observaciones'
                : 'Vista de solo lectura'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 px-1">
          {/* Información del Cliente */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#fd6301] text-white shadow-md shadow-[#fd6301]/25">
                <Building2 className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Información del Cliente</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Cliente</Label>
                <p className="font-medium text-slate-800 dark:text-slate-100">{promesa.promesa.clienteNombre}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Tipo</Label>
                <p className="font-medium text-slate-800 dark:text-slate-100 capitalize">{promesa.promesa.clienteTipo || 'activo'}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Semana</Label>
                <p className="font-medium text-slate-800 dark:text-slate-100">Semana {promesa.promesa.numeroSemana} del {promesa.promesa.anio}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Periodo</Label>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {format(new Date(promesa.promesa.fechaInicio), 'dd MMM', { locale: es })} - {format(new Date(promesa.promesa.fechaFin), 'dd MMM', { locale: es })}
                </p>
              </div>
            </div>
          </div>

          {/* Monto Prometido — editable solo para admin/supervisor */}
          <div>
            <Label htmlFor="montoPrometido-edit" className="text-sm font-semibold mb-2 block">
              Monto Prometido {puedeEditarMonto && '*'}
            </Label>
            {puedeEditarMonto ? (
              <>
                <Input
                  id="montoPrometido-edit"
                  type="number"
                  placeholder="Monto comprometido por el cliente"
                  value={montoPrometidoEdit}
                  onChange={(e) => setMontoPrometidoEdit(e.target.value)}
                  className="h-11 text-base"
                  data-testid="input-monto-prometido-edit"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Original: ${parseFloat(promesa.promesa.montoPrometido).toLocaleString('es-CL')}
                </p>
              </>
            ) : (
              <div className="p-3 border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">${montoPrometido.toLocaleString('es-CL')}</p>
              </div>
            )}
          </div>

          {/* Ventas Reales */}
          <div>
            <Label htmlFor="ventasReales" className="text-sm font-semibold mb-2 block">
              Ventas Reales {puedeEditarSeguimiento && '*'}
            </Label>
            {puedeEditarSeguimiento ? (
              <>
                <Input
                  id="ventasReales"
                  type="number"
                  placeholder="Ingrese el monto real vendido"
                  value={ventasRealesManual}
                  onChange={(e) => setVentasRealesManual(e.target.value)}
                  className="h-11 text-base"
                  data-testid="input-ventas-reales"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {ventasRealesManual
                    ? `Monto manual ingresado`
                    : `Ventas automáticas detectadas: $${promesa.ventasReales.toLocaleString('es-CL')}`
                  }
                </p>
              </>
            ) : (
              <div className="p-3 border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">${ventasActuales.toLocaleString('es-CL')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {promesa.promesa.ventasRealesManual ? 'Monto manual ingresado' : 'Ventas automáticas detectadas'}
                </p>
              </div>
            )}
          </div>

          {/* Cumplimiento y Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Cumplimiento</Label>
              <div className="flex items-center gap-3 p-3 border border-slate-200/70 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900">
                <span className={`text-3xl font-bold tabular-nums ${cumplimientoActual >= 100 ? 'text-emerald-600' : cumplimientoActual >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                  {cumplimientoActual.toFixed(1)}%
                </span>
                {cumplimientoActual >= 100 ? (
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Estado</Label>
              <div className="p-3 border border-slate-200/70 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                {estadoActual === 'superado' && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 text-sm font-medium px-4 py-1.5 rounded-full">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Superado
                  </Badge>
                )}
                {estadoActual === 'cumplido' && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 text-sm font-medium px-4 py-1.5 rounded-full">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Cumplido
                  </Badge>
                )}
                {estadoActual === 'cumplido_parcialmente' && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 text-sm font-medium px-4 py-1.5 rounded-full">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Cumplido Parcialmente
                  </Badge>
                )}
                {estadoActual === 'insuficiente' && (
                  <Badge variant="outline" className="bg-orange-50 text-[#fd6301] border-orange-200 dark:bg-orange-950/40 dark:border-orange-900 text-sm font-medium px-4 py-1.5 rounded-full">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Insuficiente
                  </Badge>
                )}
                {estadoActual === 'no_cumplido' && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 text-sm font-medium px-4 py-1.5 rounded-full">
                    <XCircle className="mr-2 h-4 w-4" />
                    No Cumplido
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <Label htmlFor="observaciones-edit" className="text-sm font-semibold mb-2 block">
              Observaciones
            </Label>
            {puedeEditarSeguimiento ? (
              <Textarea
                id="observaciones-edit"
                placeholder="Notas adicionales (opcional)"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="min-h-20 resize-none"
                data-testid="textarea-observaciones-edit"
              />
            ) : (
              <div className="p-3 border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl min-h-20">
                <p className="text-sm text-slate-600 dark:text-slate-300">{observaciones || 'Sin observaciones'}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-3">
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between w-full">
            {/* Botón de eliminar a la izquierda (solo para admin/supervisor) */}
            {puedeEliminar && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="sm:w-auto rounded-2xl"
                    data-testid="button-eliminar-promesa"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. La promesa de compra será eliminada permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        'Eliminar'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Botones de acción a la derecha */}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="sm:w-auto rounded-2xl"
                data-testid="button-cerrar"
              >
                {puedeEditarSeguimiento ? 'Cancelar' : 'Cerrar'}
              </Button>
              {puedeEditarSeguimiento && (
                <Button
                  onClick={handleSubmit}
                  disabled={updateMutation.isPending}
                  className="sm:w-auto rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
                  data-testid="button-actualizar-promesa"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    'Actualizar Promesa'
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================================================================================
// TaskDetailDialog - Vista de detalle de tarea con panel de chat
// ==================================================================================
interface TaskDetailDialogProps {
  task: Task & { assignments: TaskAssignment[] };
  open: boolean;
  onClose: () => void;
  user: any;
  availableUsers: Array<{ id: string; salespersonName: string; role: string }> | undefined;
  availableSupervisors: Array<{ id: string; salespersonName: string; role: string }> | undefined;
  getStatusBadge: (status: string) => JSX.Element;
  getPriorityBadge: (priority: string) => JSX.Element;
  updateAssignmentMutation: any;
  markAsReadMutation: any;
  taskGroups: Array<{ id: string; name: string; segmento: string; userId: string; color: string | null; sortOrder: number | null; createdAt: Date | null }>;
  assignTaskToGroupMutation: any;
  /** Industrial: la ficha es un proyecto, no una tarea suelta (ver esTareaProyecto). */
  esProyecto?: boolean;
}

function TaskDetailDialog({
  task,
  open,
  onClose,
  user,
  availableUsers,
  availableSupervisors,
  getStatusBadge,
  getPriorityBadge,
  updateAssignmentMutation,
  markAsReadMutation,
  taskGroups,
  assignTaskToGroupMutation,
  esProyecto = false,
}: TaskDetailDialogProps) {
  const { toast } = useToast();
  const [chatText, setChatText] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>((task as any).groupId || "__none__");
  const [selectedSegmento, setSelectedSegmento] = useState<string>((task as any).segmento || "__none__");

  // El asistente IA es un integrante más del chat: mientras prepara su respuesta
  // el hilo muestra "escribiendo…". El estado vive acá porque lo dispara el
  // composer y lo pinta el panel de mensajes (y hay una copia de cada uno para
  // desktop y para la pestaña de móvil).
  const [iaPensando, setIaPensando] = useState(false);

  // Pestaña activa del panel derecho. En móvil el chat es una pestaña más y es la
  // que se abre primero (en desktop vive en su columna fija y arranca en Detalle).
  const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 1024;
  const [activeDetailTab, setActiveDetailTab] = useState<string>(() => (isNarrow() ? "chat" : "detalle"));
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    // Al pasar a desktop el chat deja de ser pestaña: hay que mover el foco o el
    // área queda en blanco.
    const onChange = () => setActiveDetailTab((t) => (mql.matches && t === "chat" ? "detalle" : t));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Cobranza y Productos se resuelven por nombre de cliente (no necesitan clienteId).
  const hasClienteNombre = Boolean(String((task as any).clienteNombre || "").trim());

  // Quién puede editar el contenido de la tarea (descripción, enlaces, etc.)
  const canEditTask = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || task.createdByUserId === user.id;

  // Edición de la descripción (inline)
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState<string>(task.description || "");
  const updateDescriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/tareas/init"], type: "all" });
      setIsEditingDescription(false);
      toast({ title: "Descripción actualizada" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar la descripción.", variant: "destructive" });
    },
  });

  // Enlaces de Google Drive (guardados en payload.driveLinks)
  const driveLinks: Array<{ url: string; label?: string }> = Array.isArray((task as any).payload?.driveLinks)
    ? (task as any).payload.driveLinks
    : [];
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const updateDriveLinksMutation = useMutation({
    mutationFn: async (links: Array<{ url: string; label?: string }>) => {
      return await apiRequest("PATCH", `/api/tasks/${task.id}`, { driveLinks: links });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/tareas/init"], type: "all" });
      setNewLinkUrl("");
      setNewLinkLabel("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo guardar el enlace.", variant: "destructive" });
    },
  });
  const normalizeUrl = (raw: string) => {
    const t = raw.trim();
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };
  const addDriveLink = () => {
    const url = normalizeUrl(newLinkUrl);
    if (!url) return;
    updateDriveLinksMutation.mutate([...driveLinks, { url, label: newLinkLabel.trim() || undefined }]);
  };
  const removeDriveLink = (index: number) => {
    updateDriveLinksMutation.mutate(driveLinks.filter((_, i) => i !== index));
  };

  // Update task segmento mutation
  const updateTaskSegmentoMutation = useMutation({
    mutationFn: async ({ taskId, segmento }: { taskId: string; segmento: string | null }) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, { segmento });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      toast({
        title: "Departamento actualizado",
        description: "El departamento de la tarea se ha actualizado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el departamento.",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      onClose();
      toast({
        title: "Tarea eliminada",
        description: "La tarea se ha eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la tarea.",
        variant: "destructive",
      });
    },
  });

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      toast({
        title: "Estado actualizado",
        description: "El estado de la tarea se ha actualizado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado.",
        variant: "destructive",
      });
    },
  });

  const getAssigneeName = (assignment: TaskAssignment) => {
    return availableUsers?.find(s => s.id === assignment.assigneeId)?.salespersonName ||
      availableSupervisors?.find(s => s.id === assignment.assigneeId)?.salespersonName ||
      assignment.assigneeId;
  };

  const canDeleteTask = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || task.createdByUserId === user.id;
  // El creador de la tarea también puede marcarla completada/reabrirla (coincide con el backend
  // canUpdate en PATCH /api/tasks/:id) — habilita al rol marketing sobre las tareas que crea.
  const canUpdateStatus = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || task.createdByUserId === user.id;
  const isCompleted = task.status === 'completada';
  // Un seguimiento de cliente es un espacio de trabajo (no una tarea que se completa):
  // muestra progreso de sus actividades en vez de "Marcar completada".
  const isSeguimientoCliente = (task as any).payload?.kind === 'seguimiento_cliente';
  // Un proyecto de Industrial funciona igual: tampoco se completa de un clic, se
  // completan las tareas que tiene adentro. Los dos son "espacios de trabajo".
  const esEspacioTrabajo = isSeguimientoCliente || esProyecto;
  // El seguimiento de cliente es un espacio de trabajo del vendedor asignado: aunque no sea
  // el creador de la tarea (solo admin/supervisor las crean), el vendedor asignado debe poder
  // registrar sus actividades y visitas/rutas. Por eso, para el panel de actividades habilitamos
  // también a quien tenga la tarea asignada, no solo a quien la creó (canEditTask).
  const isAssignedToMe = ((task as any).assignments || []).some((a: any) => a.assigneeId === user.id);
  const canManageSeguimiento = canEditTask || (esEspacioTrabajo && isAssignedToMe);
  const { data: actividades = [] } = useQuery<Array<{ id: string; tipo: string; descripcion: string | null; fecha: string | null; estado: string; responsableNombre: string | null }>>({
    queryKey: ['/api/tasks', task.id, 'actividades'],
    enabled: esEspacioTrabajo,
  });
  const actividadesTotal = actividades.length;
  const actividadesCompletadas = actividades.filter((a) => a.estado === 'completada').length;

  return (
    // En desktop es una página dentro del layout (alto fijo para que el chat y
    // las pestañas tengan su propio scroll). Fuera de desktop es una HOJA a
    // pantalla completa (fixed, z-50): el layout móvil tiene una barra fija
    // abajo (z-40, 56px + safe area) y una tarjeta de 100dvh quedaba tapada por
    // ella — la página scrolleaba, el título se cortaba arriba y quedaba un
    // hueco abajo. Tapando la barra el chat usa toda la pantalla y el composer
    // queda siempre a la vista; se sale con la flecha o la X del encabezado.
    // dvh, no vh: con 100vh la barra del navegador móvil tapaba el input.
    <div className="flex flex-col bg-white overflow-hidden fixed inset-0 z-50 h-[100dvh] pb-[env(safe-area-inset-bottom)] lg:static lg:z-auto lg:pb-0 lg:h-[calc(100vh-1rem)] lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm">
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-2 sm:gap-4">
            <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
              <button onClick={onClose} className="mt-0.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex-shrink-0" title="Volver al listado">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className={`rounded-xl p-2.5 shadow-sm flex-shrink-0 ${
                isCompleted ? 'bg-emerald-600' :
                task.priority === 'high' ? 'bg-red-600' :
                'bg-gradient-to-br from-orange-500 to-[#fd6301]'
              }`}>
                <CheckSquare className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">
                  {task.title}
                </h2>
                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="hidden sm:inline">Creada {task.createdAt && format(new Date(task.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                  {(task as any).segmento && (
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-0 text-xs">
                      {SEGMENTOS.find(s => s.value === (task as any).segmento)?.label || (task as any).segmento}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
              {esEspacioTrabajo ? (
                <Badge className="text-xs font-semibold border-0 bg-orange-100 text-orange-700 flex items-center gap-1.5 px-3 py-1.5">
                  <CheckSquare className="h-3.5 w-3.5" /> {actividadesCompletadas}/{actividadesTotal} tareas
                </Badge>
              ) : canUpdateStatus ? (
                <Button
                  size="sm"
                  onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: isCompleted ? 'pendiente' : 'completada' })}
                  disabled={updateTaskStatusMutation.isPending}
                  className={`text-xs font-semibold shadow-sm ${isCompleted ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                  data-testid="button-complete-task"
                >
                  {updateTaskStatusMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : isCompleted
                      ? <><Circle className="h-3.5 w-3.5 mr-1.5" /> Reabrir</>
                      : <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Marcar completada</>}
                </Button>
              ) : null}
              <Badge className={`text-xs font-semibold border-0 ${
                task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                task.priority === 'low' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}>
                {task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baja' : 'Media'}
              </Badge>
              <Badge className={`text-xs font-semibold flex items-center gap-1 border-0 ${
                task.status === 'completada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                task.status === 'en_progreso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {task.status === 'completada' ? <CheckSquare className="h-3.5 w-3.5" /> :
                 task.status === 'en_progreso' ? <AlertCircle className="h-3.5 w-3.5" /> :
                 <Clock className="h-3.5 w-3.5" />}
                {task.status === 'completada' ? 'Completada' : task.status === 'en_progreso' ? 'En Progreso' : 'Pendiente'}
              </Badge>
              <button
                onClick={onClose}
                className="ml-2 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <HeaderMeta task={task} isSeguimiento={isSeguimientoCliente} esProyecto={esProyecto} />
        </div>

        {/* Layout: chat fijo (izq) + área principal con pestañas Detalle/info (der).
            En móvil no caben las dos columnas: el chat pasa a ser una pestaña más
            (la que se abre por defecto) para que cada sección use todo el alto. */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Panel: Chat / Bitácora (permanente en desktop) */}
          <div className="hidden lg:flex lg:w-[400px] lg:flex-shrink-0 flex-col min-h-0 border-r border-slate-200 bg-slate-50/40">
            <div className="px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0 flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-orange-600" /> Bitácora / Chat
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <DetailChatPanel taskId={task.id} iaPensando={iaPensando} />
            </div>
            <DetailChatInput taskId={task.id} onIaPensando={setIaPensando} />
          </div>

          {/* Right Panel: pestañas (Detalle + info del cliente) */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-2 sm:px-4 pt-2 sm:pt-3 pb-2 border-b border-slate-200 bg-white flex-shrink-0 overflow-x-auto">
                <TabsList className="bg-slate-100/80 h-9 p-1 w-max">
                  {/* El chat solo es pestaña en móvil; en desktop vive en la columna izquierda. */}
                  <TabsTrigger value="chat" className="lg:hidden text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat
                  </TabsTrigger>
                  <TabsTrigger value="detalle" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
                    <Edit className="h-3.5 w-3.5 mr-1" /> Detalle
                  </TabsTrigger>
                  {esEspacioTrabajo && (
                    <TabsTrigger value="tareas" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
                      <CheckSquare className="h-3.5 w-3.5 mr-1" /> Tareas{actividadesTotal > 0 ? ` ${actividadesCompletadas}/${actividadesTotal}` : ''}
                    </TabsTrigger>
                  )}
                  {/* Cobranza y Productos solo necesitan el nombre del cliente: los
                      seguimientos que llegan sin clienteId también los muestran, que
                      era justo lo que faltaba para no ir a vender a alguien que debe. */}
                  {hasClienteNombre && (
                    <>
                      <TabsTrigger value="cobranza" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><DollarSign className="h-3.5 w-3.5 mr-1" /> Cobranza</TabsTrigger>
                      <TabsTrigger value="productos" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><Package className="h-3.5 w-3.5 mr-1" /> Productos</TabsTrigger>
                    </>
                  )}
                  {(task as any).clienteId && (
                    <>
                      <TabsTrigger value="rutas" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><MapPin className="h-3.5 w-3.5 mr-1" /> Rutas</TabsTrigger>
                      <TabsTrigger value="marketing" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><Palette className="h-3.5 w-3.5 mr-1" /> Marketing</TabsTrigger>
                    </>
                  )}
                </TabsList>
              </div>
              <div className="relative flex-1 min-h-0">
                {/* Chat en móvil: usa todo el alto disponible, con su input abajo */}
                <TabsContent value="chat" className="lg:hidden absolute inset-0 flex flex-col min-h-0 mt-0 bg-slate-50/40 data-[state=inactive]:hidden">
                  <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
                    <DetailChatPanel taskId={task.id} iaPensando={iaPensando} />
                  </div>
                  <DetailChatInput taskId={task.id} onIaPensando={setIaPensando} />
                </TabsContent>

                {/* Detalle: descripción, enlaces, asignaciones, eliminar */}
                <TabsContent value="detalle" className="absolute inset-0 overflow-y-auto p-4 sm:p-5 space-y-6 mt-0 data-[state=inactive]:hidden">
            {/* Información del cliente */}
            {(task as any).clienteId && (
              <ClienteInfoPanel clienteId={String((task as any).clienteId)} clienteNombre={String((task as any).clienteNombre || "")} />
            )}

            {/* Description - Editable */}
            {(task.description || canEditTask) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</h4>
                  {canEditTask && !isEditingDescription && (
                    <button
                      onClick={() => { setDescriptionDraft(task.description || ""); setIsEditingDescription(true); }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg px-2 py-1 transition-colors"
                      title="Editar descripción"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  )}
                </div>
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      autoFocus
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      placeholder="Describe la tarea..."
                      className="w-full min-h-[110px] text-sm resize-y border-orange-200 focus-visible:ring-orange-400/30 focus-visible:border-orange-400 rounded-xl bg-white"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-[#fd6301] hover:bg-[#e35400] text-white font-semibold text-xs shadow-sm"
                        disabled={updateDescriptionMutation.isPending}
                        onClick={() => updateDescriptionMutation.mutate(descriptionDraft.trim())}
                      >
                        {updateDescriptionMutation.isPending ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Guardando...</>
                        ) : (
                          <><Check className="h-3.5 w-3.5 mr-1.5" /> Guardar</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-500 hover:bg-slate-100"
                        onClick={() => { setIsEditingDescription(false); setDescriptionDraft(task.description || ""); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : task.description ? (
                  <p
                    onClick={() => canEditTask && (setDescriptionDraft(task.description || ""), setIsEditingDescription(true))}
                    className={`text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100 whitespace-pre-wrap ${canEditTask ? 'cursor-pointer hover:border-orange-200 hover:bg-orange-50/40 transition-colors' : ''}`}
                  >
                    {task.description}
                  </p>
                ) : (
                  <button
                    onClick={() => { setDescriptionDraft(""); setIsEditingDescription(true); }}
                    className="w-full text-left text-sm text-slate-400 italic bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/40 transition-colors"
                  >
                    Agregar una descripción…
                  </button>
                )}
              </div>
            )}

            {/* Google Drive Links */}
            {(driveLinks.length > 0 || canEditTask) && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" />
                  Enlaces de Google Drive
                </h4>

                {driveLinks.length > 0 ? (
                  <div className="space-y-1.5">
                    {driveLinks.map((link, i) => (
                      <div
                        key={`${link.url}-${i}`}
                        className="group flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2.5 hover:border-orange-200 hover:shadow-sm transition-all"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#fd6301] shadow-md shadow-[#fd6301]/25 flex items-center justify-center flex-shrink-0">
                          <Link2 className="h-4 w-4 text-white" />
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1"
                          title={link.url}
                        >
                          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-orange-700 transition-colors">
                            {link.label || 'Enlace de Drive'}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{link.url}</p>
                        </a>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-all flex-shrink-0"
                          title="Abrir enlace"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {canEditTask && (
                          <button
                            onClick={() => removeDriveLink(i)}
                            disabled={updateDriveLinksMutation.isPending}
                            className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all flex-shrink-0 disabled:opacity-50"
                            title="Quitar enlace"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sin enlaces todavía.</p>
                )}

                {canEditTask && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-2.5 space-y-2">
                    <Input
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Nombre (opcional)"
                      className="h-8 text-sm bg-white border-slate-200 focus-visible:ring-orange-400/30 focus-visible:border-orange-400"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDriveLink(); } }}
                        placeholder="Pega el enlace de Drive…"
                        className="h-8 text-sm flex-1 bg-white border-slate-200 focus-visible:ring-orange-400/30 focus-visible:border-orange-400"
                      />
                      <Button
                        size="sm"
                        className="h-8 w-8 p-0 bg-[#fd6301] hover:bg-[#e35400] text-white shadow-sm flex-shrink-0"
                        disabled={updateDriveLinksMutation.isPending || !newLinkUrl.trim()}
                        onClick={addDriveLink}
                        title="Agregar enlace"
                      >
                        {updateDriveLinksMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assignments */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Asignaciones ({task.assignments.length})
              </h4>
              <div className="space-y-1.5">
                {task.assignments.map((assignment) => {
                  const assigneeName = getAssigneeName(assignment);
                  const myAssignment = (assignment.assigneeType === "supervisor" && assignment.assigneeId === user.id) ||
                    (assignment.assigneeType === "salesperson" && assignment.assigneeId === user.id);
                  const canComplete = user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area' || myAssignment;

                  return (
                    <div key={assignment.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all ${
                      myAssignment ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                        assignment.status === 'completada' ? 'bg-green-500' :
                        assignment.status === 'en_progreso' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`}>
                        {assigneeName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{assigneeName}</p>
                        <p className="text-[10px] text-slate-500 capitalize leading-tight">{assignment.assigneeType}</p>
                      </div>
                      {getStatusBadge(assignment.status ?? 'pendiente')}
                      {assignment.readAt && (
                        <span title="Leída" className="text-orange-500 flex-shrink-0"><Eye className="h-3.5 w-3.5" /></span>
                      )}
                      {myAssignment && !assignment.readAt && assignment.status === "pendiente" && (
                        <button
                          onClick={() => markAsReadMutation.mutate({ taskId: task.id, assignmentId: assignment.id })}
                          disabled={markAsReadMutation.isPending}
                          title="Acusar recibo"
                          className="flex-shrink-0 p-1 rounded-md text-orange-600 hover:bg-orange-100 transition-colors disabled:opacity-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canComplete && (
                        <button
                          onClick={() => {
                            const newStatus = assignment.status === 'completada' ? 'pendiente' : 'completada';
                            updateAssignmentMutation.mutate({ taskId: task.id, assignmentId: assignment.id, status: newStatus });
                          }}
                          disabled={updateAssignmentMutation.isPending}
                          title={assignment.status === 'completada' ? 'Reabrir' : 'Completar'}
                          className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                            assignment.status === 'completada'
                              ? 'text-green-700 bg-green-100 hover:bg-green-200'
                              : 'text-green-700 hover:bg-green-50 border border-green-200'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          {assignment.status === 'completada' ? 'Reabrir' : 'Completar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delete Task */}
            {canDeleteTask && (
              <div className="pt-3 border-t border-slate-200">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="text-xs">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {esProyecto ? 'Eliminar Proyecto' : 'Eliminar Tarea'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{esProyecto ? '¿Eliminar este proyecto?' : '¿Eliminar esta tarea?'}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {esProyecto
                          ? 'Esta acción no se puede deshacer. Se eliminarán sus tareas, asignaciones y comentarios.'
                          : 'Esta acción no se puede deshacer. Se eliminarán todas las asignaciones y comentarios asociados.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
                </TabsContent>

                {/* Tareas del cliente (subtareas / actividades tipadas) */}
                {esEspacioTrabajo && (
                  <TabsContent value="tareas" className="absolute inset-0 overflow-y-auto p-4 sm:p-5 mt-0 data-[state=inactive]:hidden">
                    <ActividadesPanel taskId={task.id} canManage={canManageSeguimiento} clienteId={String((task as any).clienteId || "")} clienteNombre={String((task as any).clienteNombre || "")} esProyecto={esProyecto} />
                  </TabsContent>
                )}

                {/* Info del cliente — cada pestaña usa toda el área */}
                {hasClienteNombre && (
                  <>
                    <TabsContent value="cobranza" className="absolute inset-0 overflow-y-auto p-4 sm:p-5 mt-0 data-[state=inactive]:hidden"><CobranzaPanel clienteNombre={String((task as any).clienteNombre || "")} /></TabsContent>
                    <TabsContent value="productos" className="absolute inset-0 overflow-y-auto p-4 sm:p-5 mt-0 data-[state=inactive]:hidden"><ProductosPanel clienteNombre={String((task as any).clienteNombre || "")} /></TabsContent>
                  </>
                )}
                {(task as any).clienteId && (
                  <>
                    <TabsContent value="rutas" className="absolute inset-0 overflow-y-auto p-4 sm:p-5 mt-0 data-[state=inactive]:hidden"><RutasClientePanel clienteId={String((task as any).clienteId || "")} clienteNombre={String((task as any).clienteNombre || "")} taskId={task.id} canManage={user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area' || (isSeguimientoCliente && isAssignedToMe)} /></TabsContent>
                    <TabsContent value="marketing" className="absolute inset-0 overflow-y-auto p-4 sm:p-5 mt-0 data-[state=inactive]:hidden"><MarketingClientePanel clienteId={String((task as any).clienteId || "")} clienteNombre={String((task as any).clienteNombre || "")} canManage={user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area'} /></TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          </div>
        </div>
    </div>
  );
}

// ==================================================================================
// DetailChatPanel - Panel de mensajes del chat en el detalle
// ==================================================================================
// La conversación es la bitácora del cliente: se lee para saber qué se le dijo y
// qué contestó. Por eso NO se puede borrar (ni el autor ni el admin) — antes se
// podía y quedaban acuerdos con clientes sin rastro. El backend también lo
// rechaza (DELETE /api/tasks/:id/comments/:commentId responde 403).
//
// El asistente IA es un integrante más del hilo: sus mensajes llegan en la misma
// lista, firmados por "Panorámica AI", y se pintan con la identidad del asistente
// (azul + chispa, la misma de components/ai-chat) para distinguirlos de las
// personas sin sacarlos de la conversación.
function DetailChatPanel({ taskId, iaPensando = false }: { taskId: string; iaPensando?: boolean }) {
  const { user } = useAuth();
  // Hilo único de la tarea (todas las asignaciones) estilo WhatsApp: no se filtra por miembro.
  const { data: comments = [], isLoading } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', taskId, 'comments'],
    refetchInterval: 3000,
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length, iaPensando]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (comments.length === 0 && !iaPensando) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <MessageSquare className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Sin mensajes aún</p>
        <p className="text-xs text-slate-400 mt-1">Escribe el primer mensaje de esta bitácora</p>
        <p className="text-xs text-slate-400 mt-2">
          Escribe <span className="font-semibold text-blue-600">{IA_MENTION}</span> para preguntarle al asistente
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {comments.map((comment) => {
        const esIA = esMensajeDeIA(comment.authorId);
        const isMine = !esIA && comment.authorId === user?.id;
        return (
          <div key={comment.id} className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
            {!isMine && (
              <span className={`text-[11px] font-semibold ml-1 mb-0.5 flex items-center gap-1 ${esIA ? 'text-blue-600' : 'text-slate-500'}`}>
                {esIA && <Sparkles className="h-3 w-3" />}
                {comment.authorName}
              </span>
            )}
            <div className="flex items-end gap-1.5 max-w-[85%]">
              <div
                className={`rounded-2xl px-3 py-2 shadow-sm ${
                  isMine
                    ? 'bg-[#fd6301] text-white rounded-br-md'
                    : esIA
                      ? 'bg-blue-50 border border-blue-200 text-slate-700 rounded-bl-md'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                }`}
                data-testid={esIA ? 'chat-mensaje-ia' : undefined}
              >
                {(comment as any).audioUrl ? (
                  <AudioMensaje url={(comment as any).audioUrl} duracionMs={(comment as any).audioDurationMs} texto={comment.content} isMine={isMine} />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
                )}
                <span className={`block text-[10px] mt-0.5 text-right ${isMine ? 'text-white/70' : esIA ? 'text-blue-400' : 'text-slate-400'}`}>
                  {comment.createdAt && format(new Date(comment.createdAt), "dd MMM, HH:mm", { locale: es })}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* El asistente está preparando su respuesta */}
      {iaPensando && (
        <div className="flex flex-col items-start" data-testid="chat-ia-escribiendo">
          <span className="text-[11px] font-semibold text-blue-600 ml-1 mb-0.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {IA_AUTHOR_NAME}
          </span>
          <div className="rounded-2xl rounded-bl-md bg-blue-50 border border-blue-200 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              <span className="ml-1.5 text-[11px] font-medium text-blue-600">escribiendo…</span>
            </div>
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
}

// ==================================================================================
// AudioMensaje - Mensaje de voz dentro de la burbuja: play/pausa, barra y
// transcripción. Sin los controles nativos del navegador: en iOS ocupan toda la
// burbuja y se ven distintos en cada celular.
// ==================================================================================
const formatDuracion = (ms?: number | null) => {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function AudioMensaje({ url, duracionMs, texto, isMine }: { url: string; duracionMs?: number | null; texto: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progreso, setProgreso] = useState(0); // 0..1
  const [duracion, setDuracion] = useState<number>((duracionMs || 0) / 1000);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play(); else el.pause();
  };

  const tono = isMine ? 'text-white' : 'text-slate-700';
  const barra = isMine ? 'bg-white/30' : 'bg-slate-200';
  const barraLlena = isMine ? 'bg-white' : 'bg-[#fd6301]';
  const boton = isMine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-[#fd6301] hover:bg-[#e35400] text-white';
  const esTranscripcion = texto && !texto.startsWith('🎤');

  return (
    <div className="min-w-[200px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgreso(0); }}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDuracion(d); }}
        onTimeUpdate={(e) => { const el = e.currentTarget; if (el.duration > 0) setProgreso(el.currentTime / el.duration); }}
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${boton}`}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          data-testid="audio-play"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className={`h-1.5 rounded-full ${barra} overflow-hidden cursor-pointer`}
            onClick={(e) => {
              const el = audioRef.current;
              if (!el || !Number.isFinite(el.duration)) return;
              const r = e.currentTarget.getBoundingClientRect();
              el.currentTime = ((e.clientX - r.left) / r.width) * el.duration;
            }}
          >
            <div className={`h-full rounded-full ${barraLlena}`} style={{ width: `${Math.round(progreso * 100)}%` }} />
          </div>
          <span className={`block text-[10px] mt-1 ${isMine ? 'text-white/70' : 'text-slate-400'}`}>
            {playing && audioRef.current ? formatDuracion(audioRef.current.currentTime * 1000) : formatDuracion(duracion * 1000)} · voz
          </span>
        </div>
      </div>
      {esTranscripcion && (
        <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words mt-2 ${tono}`}>{texto}</p>
      )}
    </div>
  );
}

// ==================================================================================
// DetailChatInput - Input de chat para el panel de detalle
// ==================================================================================
// Además de publicar el mensaje, este composer es la puerta del asistente: si el
// texto nombra a la IA (@IA), después de guardar el mensaje de la persona se le
// pide la respuesta al backend, que la publica en el mismo hilo. El mensaje del
// equipo aparece al instante; la respuesta llega cuando el modelo termina.
function DetailChatInput({ taskId, onIaPensando }: { taskId: string; onIaPensando?: (v: boolean) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Si se le pregunta dos veces seguidas, el "escribiendo…" tiene que quedar
  // hasta que conteste la última: se cuentan las consultas en vuelo.
  const consultasIA = useRef(0);

  const preguntarIA = async (pregunta: string) => {
    consultasIA.current += 1;
    onIaPensando?.(true);
    try {
      await apiRequest(`/api/tasks/${taskId}/asistente`, {
        method: 'POST',
        data: { pregunta },
      });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks', taskId, 'comments'] });
    } catch (error: any) {
      toast({
        title: "El asistente no pudo responder",
        description: error?.message || "Intenta de nuevo en un momento.",
        variant: "destructive",
      });
    } finally {
      consultasIA.current -= 1;
      if (consultasIA.current <= 0) onIaPensando?.(false);
    }
  };

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        data: { content },
      });
      return response.json();
    },
    onSuccess: (_data, content: string) => {
      queryClient.refetchQueries({ queryKey: ['/api/tasks', taskId, 'comments'] });
      setText("");
      if (mencionaIA(content)) void preguntarIA(content);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    }
  });

  // ── Mensaje de voz ──
  // Tocar el micrófono graba; tocar de nuevo manda. Se sube al backend, que lo
  // guarda y lo transcribe; el mensaje aparece con el audio y el texto. Si la
  // transcripción nombra al asistente, se le pregunta igual que por escrito.
  const puedeGrabar = typeof window !== 'undefined'
    && typeof (window as any).MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
  const [grabando, setGrabando] = useState(false);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inicioRef = useRef(0);
  const descartarRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const AUDIO_MAX_SEGUNDOS = 180;

  const detenerTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const enviarAudio = async (blob: Blob, duracionMs: number) => {
    setSubiendoAudio(true);
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('audio', blob, `voz.${ext}`);
      form.append('duracionMs', String(duracionMs));
      const res = await apiRequest(`/api/tasks/${taskId}/comments/audio`, { method: 'POST', data: form });
      const comment = await res.json();
      await queryClient.refetchQueries({ queryKey: ['/api/tasks', taskId, 'comments'] });
      if (comment?.content && mencionaIA(comment.content)) void preguntarIA(comment.content);
    } catch (error: any) {
      toast({ title: "No se pudo enviar el audio", description: error?.message || "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setSubiendoAudio(false);
    }
  };

  const empezarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Chrome/Android graban webm (opus); Safari/iOS solo mp4. Se elige lo que
      // el navegador soporte; sin opciones, MediaRecorder usa su default.
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      descartarRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        detenerTimer();
        setGrabando(false);
        setSegundos(0);
        const duracionMs = Date.now() - inicioRef.current;
        if (descartarRef.current || chunksRef.current.length === 0 || duracionMs < 500) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || 'audio/webm' });
        void enviarAudio(blob, duracionMs);
      };
      recorderRef.current = rec;
      inicioRef.current = Date.now();
      rec.start();
      setGrabando(true);
      setSegundos(0);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - inicioRef.current) / 1000);
        setSegundos(s);
        if (s >= AUDIO_MAX_SEGUNDOS) recorderRef.current?.stop();
      }, 250);
    } catch {
      toast({ title: "Sin acceso al micrófono", description: "Permite el micrófono en el navegador para grabar.", variant: "destructive" });
    }
  };

  const terminarGrabacion = (descartar = false) => {
    descartarRef.current = descartar;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  };

  // Si se cierra el detalle a mitad de una grabación, soltar el micrófono.
  useEffect(() => () => { descartarRef.current = true; recorderRef.current?.state === 'recording' && recorderRef.current.stop(); detenerTimer(); }, []);

  // Nombrar al asistente desde el botón: deja el @IA al principio y el foco al
  // final para seguir escribiendo la pregunta.
  const mencionarIA = () => {
    setText((t) => (mencionaIA(t) ? t : t.trim() ? `${IA_MENTION} ${t.trimStart()}` : `${IA_MENTION} `));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (text.trim()) {
      addCommentMutation.mutate(text.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    // En móvil el detalle es una hoja a pantalla completa que tapa la barra del
    // menú: no hay nada que esquivar y el ancho entero es para escribir.
    <div className="px-3 lg:px-4 py-3 border-t border-slate-200 bg-white flex-shrink-0">
      {grabando ? (
        /* Grabando: el campo se reemplaza por el contador; X descarta, el botón
           naranjo manda. */
        <div className="flex items-center gap-2" data-testid="chat-grabando">
          <button
            type="button"
            onClick={() => terminarGrabacion(true)}
            className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
            aria-label="Descartar grabación"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex-1 h-10 rounded-xl border border-red-200 bg-red-50 px-3 flex items-center gap-2 text-sm text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-semibold tabular-nums">{formatDuracion(segundos * 1000)}</span>
            <span className="text-red-500/80 truncate">Grabando…</span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => terminarGrabacion(false)}
            className="h-10 w-10 p-0 rounded-xl bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#fd6301] hover:to-[#e35400] shadow-md"
            aria-label="Enviar audio"
            data-testid="button-enviar-audio"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Llamar al asistente: queda junto al campo porque es una forma más de
            escribir el mensaje, no una acción aparte del chat. En móvil va solo
            el ícono: el ancho es para escribir. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={mencionarIA}
          title="Preguntarle al asistente en este chat"
          aria-label="Preguntarle al asistente"
          className={`h-10 w-10 p-0 sm:w-auto sm:px-2.5 rounded-xl border-slate-200 gap-1 text-xs font-semibold transition-colors ${
            mencionaIA(text)
              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
              : 'text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'
          }`}
          data-testid="button-mencionar-ia"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">IA</span>
        </Button>
        {/* text-base en móvil: con menos de 16px iOS hace zoom al enfocar el campo
            y la pantalla queda corrida y agrandada. El placeholder es corto para
            que no se parta en dos líneas y agrande la caja. */}
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje…"
          enterKeyHint="send"
          className="flex-1 min-h-[40px] max-h-[120px] text-base md:text-sm resize-none border-slate-200 focus:border-orange-400 focus:ring-orange-400/20 rounded-xl"
          rows={1}
          data-testid="chat-input-detail"
        />
        {/* Con el campo vacío el botón es el micrófono (como WhatsApp); apenas
            hay texto pasa a ser enviar. Así no se suma un botón más a la fila. */}
        {!text.trim() && puedeGrabar ? (
          <Button
            type="button"
            size="sm"
            onClick={empezarGrabacion}
            disabled={subiendoAudio}
            className="h-10 w-10 p-0 rounded-xl bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#fd6301] hover:to-[#e35400] shadow-md"
            aria-label="Grabar mensaje de voz"
            data-testid="button-grabar-audio"
          >
            {subiendoAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            className="h-10 w-10 p-0 rounded-xl bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#fd6301] hover:to-[#e35400] shadow-md"
            disabled={addCommentMutation.isPending || !text.trim()}
            data-testid="button-send-chat"
          >
            {addCommentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        )}
      </form>
      )}
    </div>
  );
}

// ==================================================================================
// CommentsThread - Componente de comentarios en hilo moderno
// ==================================================================================
interface CommentsThreadProps {
  taskId: string;
  assignmentId: string;
  isEditing: boolean;
  editingText: string;
  setEditingText: (text: string) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
}

function CommentsThread({
  taskId,
  assignmentId,
  isEditing,
  editingText,
  setEditingText,
  onStartEditing,
  onCancelEditing
}: CommentsThreadProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch comments for this assignment
  const { data: comments = [], isLoading } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', taskId, 'assignments', assignmentId, 'comments'],
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(`/api/tasks/${taskId}/assignments/${assignmentId}/comments`, {
        method: 'POST',
        data: { content },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/tasks', taskId, 'assignments', assignmentId, 'comments'] });
      onCancelEditing();
      toast({
        title: "Comentario agregado",
        description: "Tu comentario ha sido publicado",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo agregar el comentario",
        variant: "destructive"
      });
    }
  });

  const handleSubmitComment = () => {
    if (editingText.trim()) {
      addCommentMutation.mutate(editingText.trim());
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{comments.length} comentario{comments.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="group relative bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-3 border border-blue-100 hover:shadow-sm transition-all"
                data-testid={`comment-${comment.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-[#fd6301] flex items-center justify-center text-white text-xs font-bold">
                        {comment.authorName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {comment.authorName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {comment.createdAt && format(new Date(comment.createdAt), "dd MMM, HH:mm", { locale: es })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 pl-8 leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                  {/* Sin botón de borrar: los comentarios del hilo son bitácora. */}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Add Comment Form */}
      {isEditing ? (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-3 shadow-sm">
          <Textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            placeholder="Escribe tu comentario..."
            className="text-sm min-h-[70px] border-0 focus-visible:ring-0 resize-none bg-transparent p-0"
            data-testid={`textarea-comment-${assignmentId}`}
            autoFocus
          />
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-gray-500"
              onClick={onCancelEditing}
              data-testid={`button-cancel-comment-${assignmentId}`}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 px-4 bg-gradient-to-r from-blue-500 to-[#fd6301] hover:from-blue-600 hover:to-[#e35400] text-white font-medium rounded-full"
              onClick={handleSubmitComment}
              disabled={addCommentMutation.isPending || !editingText.trim()}
              data-testid={`button-submit-comment-${assignmentId}`}
            >
              {addCommentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Publicar
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={onStartEditing}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 text-gray-500 hover:text-orange-600 transition-all group"
          data-testid={`button-add-comment-${assignmentId}`}
        >
          <div className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-medium">Agregar comentario</span>
        </button>
      )}
    </div>
  );
}

// Componente de Vista Calendario
function CalendarViewTab({
  tasks,
  calendarMonth,
  setCalendarMonth,
  onOpenDetail,
  getStatusBadge,
  getPriorityBadge,
  salespeople,
  supervisors,
}: {
  tasks: Array<Task & { assignments: TaskAssignment[] }>;
  calendarMonth: Date;
  setCalendarMonth: (date: Date) => void;
  onOpenDetail: (taskId: string) => void;
  getStatusBadge: (status: string) => JSX.Element;
  getPriorityBadge: (priority: string) => JSX.Element;
  salespeople: Array<{ id: string; salespersonName: string; role: string }> | undefined;
  supervisors: Array<{ id: string; salespersonName: string; role: string }> | undefined;
}) {
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);

  // Popup de vista rápida: clic en una tarea del calendario → info resumida;
  // "+N más" → lista de todas las tareas de ese día.
  const [popupTask, setPopupTask] = useState<(Task & { assignments: TaskAssignment[] }) | null>(null);
  const [popupDay, setPopupDay] = useState<Date | null>(null);

  const assigneeName = (a: TaskAssignment) =>
    salespeople?.find((s) => s.id === a.assigneeId)?.salespersonName ||
    supervisors?.find((s) => s.id === a.assigneeId)?.salespersonName ||
    "Sin nombre";

  const getDaysInMonth = () => {
    const days: Date[] = [];
    const firstDayOfWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
    const lastDayOfWeek = endOfWeek(monthEnd, { weekStartsOn: 1 });

    let currentDay = firstDayOfWeek;
    while (currentDay <= lastDayOfWeek) {
      days.push(currentDay);
      currentDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
    }
    return days;
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return (
        taskDate.getDate() === day.getDate() &&
        taskDate.getMonth() === day.getMonth() &&
        taskDate.getFullYear() === day.getFullYear()
      );
    });
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-blue-500';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completada': return 'bg-green-100 border-green-300 text-green-800';
      case 'en_progreso': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'bloqueada': return 'bg-red-100 border-red-300 text-red-800';
      case 'cancelada': return 'bg-gray-100 border-gray-300 text-gray-500 line-through';
      default: return 'bg-white border-gray-200 text-gray-800';
    }
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return (
      day.getDate() === today.getDate() &&
      day.getMonth() === today.getMonth() &&
      day.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === calendarMonth.getMonth();
  };

  const days = getDaysInMonth();
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="space-y-4">
      {/* Header del Calendario */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-orange-600" />
              Vista Calendario
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                className="h-8 w-8 p-0"
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium text-sm min-w-[140px] text-center">
                {format(calendarMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                className="h-8 w-8 p-0"
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth(new Date())}
                className="h-8 px-3 ml-2"
                data-testid="button-today"
              >
                Hoy
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid del Calendario */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Días de la semana */}
          <div className="grid grid-cols-7 bg-gray-50 border-b">
            {weekDays.map((day) => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const dayTasks = getTasksForDay(day);
              const isInCurrentMonth = isCurrentMonth(day);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={index}
                  className={`min-h-[100px] sm:min-h-[120px] border-b border-r p-1 sm:p-2 ${!isInCurrentMonth ? 'bg-gray-50' : 'bg-white'
                    } ${isTodayDate ? 'bg-blue-50' : ''}`}
                >
                  {/* Número del día */}
                  <div className={`text-right mb-1 ${!isInCurrentMonth ? 'text-gray-400' : ''}`}>
                    <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm font-medium rounded-full ${isTodayDate ? 'bg-[#fd6301] text-white' : ''
                      }`}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Tareas del día */}
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setPopupTask(task)}
                        className={`w-full text-left px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-medium truncate border transition-all hover:shadow-md ${getStatusColor(task.status)}`}
                        title={task.title}
                        data-testid={`calendar-task-${task.id}`}
                      >
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                          <span className="truncate">{task.title}</span>
                        </div>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <button
                        onClick={() => setPopupDay(day)}
                        className="w-full text-left text-[10px] sm:text-xs text-gray-500 hover:text-orange-600 font-medium px-1.5 transition-colors"
                        data-testid={`calendar-more-${format(day, 'yyyy-MM-dd')}`}
                      >
                        +{dayTasks.length - 3} más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <Card className="border-0 shadow-sm">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-medium text-gray-700">Prioridad:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-gray-600">Alta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-gray-600">Media</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <span className="text-gray-600">Baja</span>
            </div>
            <span className="mx-2 text-gray-300">|</span>
            <span className="font-medium text-gray-700">Estado:</span>
            <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800 text-[10px]">Completada</Badge>
            <Badge variant="outline" className="bg-yellow-100 border-yellow-300 text-yellow-800 text-[10px]">En Progreso</Badge>
            <Badge variant="outline" className="bg-white border-gray-200 text-gray-800 text-[10px]">Pendiente</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Popup de vista rápida de la tarea */}
      <Dialog open={!!popupTask} onOpenChange={(open) => { if (!open) setPopupTask(null); }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl" data-testid="calendar-task-popup">
          {popupTask && (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-orange-950/40 dark:via-slate-900 dark:to-orange-950/30">
                <div className="flex items-start gap-3">
                  <div className="bg-gradient-to-br from-orange-500 to-[#fd6301] rounded-xl p-2.5 shadow-md shadow-orange-500/25 flex-shrink-0">
                    <CalendarIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-lg font-bold text-foreground leading-snug pr-6">
                      {popupTask.title}
                    </DialogTitle>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {getStatusBadge(popupTask.status ?? 'pendiente')}
                      {getPriorityBadge(popupTask.priority ?? 'medium')}
                      {(popupTask as any).segmento && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-900">
                          <Building2 className="h-3 w-3 mr-1" />
                          {SEGMENTOS.find((s) => s.value === (popupTask as any).segmento)?.label ?? (popupTask as any).segmento}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="px-6 py-5 space-y-4">
                {popupTask.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {popupTask.description}
                  </p>
                )}

                <div className="space-y-2.5 text-sm">
                  {popupTask.dueDate && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#fd6301] text-white dark:text-white flex-shrink-0 shadow-md shadow-[#fd6301]/25">
                        <Clock className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-slate-700 dark:text-slate-200 capitalize">
                        {format(new Date(popupTask.dueDate), "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </span>
                    </div>
                  )}
                  {(popupTask as any).clienteNombre && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-slate-700 dark:text-slate-200 truncate">{(popupTask as any).clienteNombre}</span>
                    </div>
                  )}
                </div>

                {popupTask.assignments.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Users className="h-3.5 w-3.5" /> Asignados
                    </div>
                    <div className="space-y-1">
                      {popupTask.assignments.map((a) => {
                        const done = a.status === 'completada' || a.status === 'completed';
                        const dotColor = done ? 'bg-green-500' : a.status === 'en_progreso' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600';
                        return (
                          <div key={a.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-[#fd6301] text-white text-xs font-bold flex-shrink-0">
                              {assigneeName(a).charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">{assigneeName(a)}</span>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} title={done ? 'Completada' : a.status === 'en_progreso' ? 'En progreso' : 'Pendiente'} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-end gap-2">
                <Button variant="outline" className="rounded-2xl" onClick={() => setPopupTask(null)} data-testid="calendar-popup-close">
                  Cerrar
                </Button>
                <Button
                  className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
                  onClick={() => {
                    const id = popupTask.id;
                    setPopupTask(null);
                    onOpenDetail(id);
                  }}
                  data-testid="calendar-popup-detail"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver detalle completo
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Popup con todas las tareas de un día ("+N más") */}
      <Dialog open={!!popupDay} onOpenChange={(open) => { if (!open) setPopupDay(null); }}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden rounded-2xl" data-testid="calendar-day-popup">
          {popupDay && (
            <>
              <div className="px-6 py-5 border-b bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-orange-950/40 dark:via-slate-900 dark:to-orange-950/30">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-orange-500 to-[#fd6301] rounded-xl p-2.5 shadow-md shadow-orange-500/25">
                    <CalendarIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground capitalize">
                      {format(popupDay, "EEEE d 'de' MMMM", { locale: es })}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {getTasksForDay(popupDay).length} tarea{getTasksForDay(popupDay).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-4 space-y-1.5 max-h-[50vh] overflow-y-auto">
                {getTasksForDay(popupDay).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => { setPopupDay(null); setPopupTask(task); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-all hover:shadow-md ${getStatusColor(task.status)}`}
                    data-testid={`calendar-day-task-${task.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                      <span className="truncate">{task.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================================================================================
// ClientIntelTabs — pestañas de información del cliente dentro del modal de tarea (Etapa 2)
// Cobranza · Productos · Rutas · Marketing. Reemplazan la barra de cambio de segmento.
// ==================================================================================
const fmtCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n) || 0);

function ClientIntelTabs({ task, user }: { task: any; user: any }) {
  const clienteId = String(task.clienteId || "");
  const clienteNombre = String(task.clienteNombre || "");
  const canManage = user.role === "admin" || user.role === "supervisor" || user.role === "encargado_area";
  return (
    <div className="border-b bg-slate-50/70 flex-shrink-0">
      <Tabs defaultValue="cobranza" className="w-full">
        <div className="px-4 pt-2.5">
          <TabsList className="bg-slate-100/80 h-9 p-1">
            <TabsTrigger value="cobranza" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
              <DollarSign className="h-3.5 w-3.5 mr-1" /> Cobranza
            </TabsTrigger>
            <TabsTrigger value="productos" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
              <Package className="h-3.5 w-3.5 mr-1" /> Productos
            </TabsTrigger>
            <TabsTrigger value="rutas" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
              <MapPin className="h-3.5 w-3.5 mr-1" /> Rutas
            </TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
              <Palette className="h-3.5 w-3.5 mr-1" /> Marketing
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="px-4 py-3 max-h-72 overflow-y-auto">
          <TabsContent value="cobranza" className="mt-0"><CobranzaPanel clienteNombre={clienteNombre} variant="compact" /></TabsContent>
          <TabsContent value="productos" className="mt-0"><ProductosPanel clienteNombre={clienteNombre} /></TabsContent>
          <TabsContent value="rutas" className="mt-0"><RutasClientePanel clienteId={clienteId} clienteNombre={clienteNombre} canManage={canManage} taskId={task.id} /></TabsContent>
          <TabsContent value="marketing" className="mt-0"><MarketingClientePanel clienteId={clienteId} clienteNombre={clienteNombre} canManage={canManage} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Ficha completa del cliente asociado a la tarea (todo lo que hay en la BD).
function ClienteInfoPanel({ clienteId, clienteNombre }: { clienteId: string; clienteNombre: string }) {
  const { data: client, isLoading } = useQuery<any>({
    queryKey: ["/api/clients", clienteId],
    queryFn: async () => { const r = await apiRequest(`/api/clients/${encodeURIComponent(clienteId)}`); return r.json(); },
    enabled: !!clienteId,
  });
  // Crédito: los mismos números que la pestaña Cobranza (misma query, mismos
  // documentos del ERP). Antes esta ficha leía crlt/cren/crsd de la tabla clients,
  // que viene incompleta, y las dos pestañas mostraban cifras distintas del mismo
  // cliente: acá salía "límite $0 · deuda $100.000" y en Cobranza lo contrario.
  const { data: credito } = useCredito(clienteNombre);

  const val = (v: any) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando información del cliente…
      </div>
    );
  }

  const nombre = val(client?.nokoenamp) || val(client?.nokoen) || clienteNombre || "Cliente";
  const codigo = val(client?.koen) || clienteId;
  const rut = val(client?.rten);

  // Campos (label, value) — solo se muestran los que tienen dato.
  const fields: Array<[string, string | null]> = [
    ["Giro", val(client?.gien)],
    ["Sector", val(client?.sien)],
    ["Dirección", val(client?.dien)],
    ["Comuna", val(client?.comuna)],
    ["Ciudad", val(client?.cmen)],
    ["Provincia", val(client?.provincia)],
    ["Teléfono", val(client?.foen)],
    ["Email", val(client?.email)],
    ["Email comercial", val(client?.emailcomer)],
    ["Condición de pago", val(client?.cpen)],
    ["Lista de precios", val(client?.lcen)],
    ["Ruta", val(client?.ruen)],
    ["Cobrador", val(client?.cobrador)],
  ];
  const shown = fields.filter(([, v]) => v);

  const limite = credito?.credit.limit ?? null;      // línea asignada (ficha/ERP)
  const disponible = credito?.credit.available ?? null; // línea − deuda
  const deuda = credito ? credito.credit.used : null;   // documentos pendientes del ERP
  const hasCredito = !!credito;
  const observaciones = val(client?.oben);
  const bloqueado = Number(client?.bloqueado) === 1;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5" />
        Información del cliente
      </h4>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        {/* Cabecera */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#fd6301] shadow-md shadow-[#fd6301]/25 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 leading-tight">{nombre}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              {codigo && <span className="text-[11px] text-slate-500">Cód. {codigo}</span>}
              {rut && <span className="text-[11px] text-slate-500">· RUT {rut}</span>}
              {bloqueado && (
                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                  <Ban className="h-2.5 w-2.5 mr-1" /> Bloqueado
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Crédito */}
        {hasCredito && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Límite crédito</p>
              <p className="text-xs font-bold text-slate-800">{limite !== null ? fmtCLP(limite) : "Sin línea"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2">
              <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Disponible</p>
              <p className="text-xs font-bold text-emerald-700">{disponible !== null ? fmtCLP(disponible) : "Sin línea"}</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-2">
              <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider">Deuda</p>
              <p className="text-xs font-bold text-red-700">{deuda !== null ? fmtCLP(deuda) : "—"}</p>
            </div>
          </div>
        )}

        {/* Campos */}
        {shown.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1">
            {shown.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">{label}</p>
                <p className="text-xs text-slate-700 break-words">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Observaciones */}
        {observaciones && (
          <div className="pt-1">
            <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Observaciones</p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{observaciones}</p>
          </div>
        )}

        {shown.length === 0 && !hasCredito && !observaciones && (
          <p className="text-xs text-slate-400 italic">Sin datos adicionales del cliente.</p>
        )}
      </div>
    </div>
  );
}

// Cobranza del cliente dentro del modal de tarea. Es el MISMO panel (y la misma
// query) que la pestaña Crédito de la ficha del cliente, así los dos nunca
// muestran cifras distintas para el mismo cliente. La pestaña usa la versión
// completa (misma info que en Clientes: línea, antigüedad y documentos); la
// compacta queda para bloques con poco alto.
function CobranzaPanel({ clienteNombre, variant = "full" }: { clienteNombre: string; variant?: "full" | "compact" }) {
  // El botón "Enviar cobranza" es el mismo de la ficha del cliente: se cobra
  // desde acá sin tener que salir del Panel de Trabajo. Va siempre, en todos los
  // seguimientos (ferretería, construcción, industrial) y aunque el cliente no
  // tenga facturas pendientes: el monto y la fecha se pueden escribir a mano.
  // Sólo se esconde a quien no tiene permiso de mandar cobranzas.
  if (!clienteNombre) return <p className="text-xs text-slate-400 italic">Sin cliente asociado.</p>;
  return (
    <CreditoPanel
      clientName={clienteNombre}
      variant={variant}
      footer={
        <div className="pt-1">
          <EnviarCobranzaButton clientName={clienteNombre} testId="button-enviar-cobranza-tarea" />
        </div>
      }
    />
  );
}

function ProductosPanel({ clienteNombre }: { clienteNombre: string }) {
  const { data = [], isLoading } = useQuery<Array<{ productName: string; totalPurchases: number; transactionCount: number; lastPurchase: string }>>({
    queryKey: ["/api/sales/client/products", clienteNombre],
    queryFn: async () => {
      const r = await apiRequest(`/api/sales/client/${encodeURIComponent(clienteNombre)}/products`);
      return r.json();
    },
    enabled: !!clienteNombre,
  });
  if (isLoading) return <p className="text-xs text-slate-400">Cargando productos…</p>;
  if (data.length === 0) return <p className="text-xs text-slate-400 italic">Sin compras registradas.</p>;
  return (
    <div className="space-y-1">
      {data.slice(0, 25).map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
          <Package className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
          <span className="font-medium text-slate-700 truncate flex-1">{p.productName}</span>
          <span className="text-slate-400 flex-shrink-0">{p.transactionCount}×</span>
          <span className="font-semibold text-emerald-700 flex-shrink-0">{fmtCLP(Number(p.totalPurchases))}</span>
        </div>
      ))}
    </div>
  );
}

function RutasClientePanel({ clienteId, clienteNombre, canManage, taskId }: { clienteId: string; clienteNombre: string; canManage: boolean; taskId?: string }) {
  const { toast } = useToast();
  // Quitar al cliente de una ruta (desde la papelera) es exclusivo del admin; canManage sigue controlando asignar/marcar visitas.
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "admin";
  const [selRuta, setSelRuta] = useState("");
  const [completing, setCompleting] = useState<{ id: string; nombre: string } | null>(null);
  // Visor de la evidencia (foto + geo + nota) del histórico de visitas.
  const [viewer, setViewer] = useState<{ visitas: VisitaEvidencia[]; index: number } | null>(null);

  const { data: rutasCliente = [], isLoading } = useQuery<Array<{ id: string; nombre: string; estado: string; fecha: string | null; visitado: boolean | null; fechaVisita: string | null }>>({
    queryKey: ["/api/rutas/by-cliente", clienteId],
    queryFn: async () => { const r = await apiRequest(`/api/rutas/by-cliente/${encodeURIComponent(clienteId)}`); return r.json(); },
    enabled: !!clienteId,
  });
  const { data: allRutas = [] } = useQuery<Array<{ id: string; nombre: string; fecha?: string | null }>>({ queryKey: ["/api/rutas"], enabled: canManage });
  const { data: visitas = [] } = useQuery<Array<{ id: string; rutaId: string; rutaNombre: string | null; fecha: string; nota: string | null; imagenUrl: string | null; lat: string | null; lng: string | null; registradoPorNombre: string | null }>>({
    queryKey: ["/api/rutas/visitas/by-cliente", clienteId],
    queryFn: async () => { const r = await apiRequest(`/api/rutas/visitas/by-cliente/${encodeURIComponent(clienteId)}`); return r.json(); },
    enabled: !!clienteId,
  });

  const assign = useMutation({
    mutationFn: async () => {
      const ruta = allRutas.find((r) => r.id === selRuta);
      await apiRequest("POST", `/api/rutas/${selRuta}/clientes`, { clienteId, clienteNombre });
      // Al asignar la ruta se crea automáticamente una tarea (actividad tipo visita)
      // ligada a la ruta; al completarla, la ruta queda marcada como realizada.
      if (taskId) {
        await apiRequest("POST", `/api/tasks/${taskId}/actividades`, {
          tipo: "visita",
          descripcion: `Visita de ruta: ${ruta?.nombre || clienteNombre}`,
          fecha: ruta?.fecha || undefined,
          rutaId: selRuta,
          rutaNombre: ruta?.nombre || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] });
      if (taskId) queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "actividades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/visitas/by-cliente", clienteId] });
      setSelRuta("");
      toast({ title: "Ruta asignada", description: taskId ? "Se creó una tarea de visita para esta ruta." : undefined });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo asignar.", variant: "destructive" }),
  });
  // Quitar SOLO a este cliente de la ruta: desasocia al cliente sin borrar la ruta
  // ni su histórico de visitas (la ruta sigue existiendo en el apartado de Rutas).
  const quitarDeRutaMut = useMutation({
    mutationFn: async (rutaId: string) => apiRequest("DELETE", `/api/rutas/${rutaId}/clientes/${encodeURIComponent(clienteId)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/visitas/by-cliente", clienteId] });
      toast({ title: "Cliente quitado de la ruta" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo quitar de la ruta.", variant: "destructive" }),
  });
  // Marcar la ruta como realizada / pendiente para este cliente (para saber si se hizo).
  const toggleVisitado = useMutation({
    mutationFn: async ({ rutaId, visitado }: { rutaId: string; visitado: boolean }) =>
      apiRequest("PATCH", `/api/rutas/${rutaId}/clientes/${encodeURIComponent(clienteId)}/visitado`, { visitado }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo actualizar el estado.", variant: "destructive" }),
  });
  const yaEn = new Set(rutasCliente.map((r) => r.id));

  return (
    <div className="space-y-5">
      {completing && (
        <CompletarRutaDialog clienteId={clienteId} clienteNombre={clienteNombre} ruta={completing} onClose={() => setCompleting(null)} />
      )}
      {viewer && (
        <EvidenciaVisitaDialog visitas={viewer.visitas} startIndex={viewer.index} onClose={() => setViewer(null)} />
      )}
      {/* Rutas del cliente */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Rutas del cliente</h4>
        {isLoading ? (
          <p className="text-xs text-slate-400">Cargando rutas…</p>
        ) : rutasCliente.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Este cliente no está en ninguna ruta.</p>
        ) : (
          <div className="space-y-1.5">
            {rutasCliente.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs bg-white rounded-xl px-3 py-2 border border-slate-100">
                <MapPin className="h-4 w-4 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-700 block truncate">{r.nombre}</span>
                  {r.fecha && <span className="text-[10px] text-slate-400 flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {format(new Date(r.fecha), "dd MMM yyyy", { locale: es })}</span>}
                </div>
                {/* Estado por cliente: realizada / pendiente (para saber si la ruta se hizo) */}
                {canManage ? (
                  <button
                    onClick={() => r.visitado ? toggleVisitado.mutate({ rutaId: r.id, visitado: false }) : setCompleting({ id: r.id, nombre: r.nombre })}
                    disabled={toggleVisitado.isPending}
                    title={r.visitado ? "Marcar como pendiente" : "Marcar como realizada"}
                    className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${r.visitado ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100" : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"}`}
                  >
                    {r.visitado
                      ? <><Check className="h-3 w-3" /> Realizada{r.fechaVisita ? ` · ${format(new Date(r.fechaVisita), "dd MMM", { locale: es })}` : ""}</>
                      : <><Clock className="h-3 w-3" /> Pendiente</>}
                  </button>
                ) : (
                  <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${r.visitado ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {r.visitado ? `Realizada${r.fechaVisita ? ` · ${format(new Date(r.fechaVisita), "dd MMM", { locale: es })}` : ""}` : "Pendiente"}
                  </Badge>
                )}
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-slate-300 hover:text-red-500 flex-shrink-0" title="Quitar de esta ruta">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Quitar este cliente de la ruta "{r.nombre}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Solo se desasociará este cliente de la ruta. La ruta y su histórico de visitas se conservan en el apartado de Rutas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => quitarDeRutaMut.mutate(r.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Quitar de la ruta
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
        {canManage && allRutas.filter((r) => !yaEn.has(r.id)).length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Select value={selRuta} onValueChange={setSelRuta}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Asignar a una ruta…" /></SelectTrigger>
              <SelectContent>
                {allRutas.filter((r) => !yaEn.has(r.id)).map((r) => (<SelectItem key={r.id} value={r.id} className="text-xs">{r.nombre}{r.fecha ? ` · ${format(new Date(r.fecha), "dd MMM", { locale: es })}` : ""}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 bg-[#fd6301] hover:bg-[#e35400] text-xs" disabled={!selRuta || assign.isPending} onClick={() => assign.mutate()}>
              {assign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Asignar"}
            </Button>
          </div>
        )}
      </div>

      {/* Histórico de visitas */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Histórico de visitas ({visitas.length})</h4>
        {visitas.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Sin visitas registradas.</p>
        ) : (
          <div className="space-y-1.5">
            {visitas.map((v) => (
              <div key={v.id} className="flex items-start gap-2.5 bg-white rounded-xl px-3 py-2 border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-[#fd6301] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#fd6301]/25"><MapPin className="h-4 w-4 text-white" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">{format(new Date(v.fecha), "dd MMM yyyy", { locale: es })}</span>
                    {v.rutaNombre && <span className="text-[11px] text-slate-400 truncate">· {v.rutaNombre}</span>}
                  </div>
                  {v.nota && <p className="text-[11px] text-slate-500 mt-0.5">{v.nota}</p>}
                  {v.lat != null && v.lng != null && (
                    <a href={`https://www.google.com/maps?q=${v.lat},${v.lng}`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Ver ubicación</a>
                  )}
                  {v.registradoPorNombre && <p className="text-[10px] text-slate-400 mt-0.5">por {v.registradoPorNombre}</p>}
                  {/* La foto abre en el visor (zoom/rotar) en vez de una pestaña nueva. */}
                  {v.imagenUrl && (
                    <button
                      type="button"
                      onClick={() => setViewer({ visitas: visitas as VisitaEvidencia[], index: visitas.findIndex((x) => x.id === v.id) })}
                      className="block mt-1.5 rounded-lg overflow-hidden border border-slate-200 hover:border-[#fd6301] transition-colors"
                      title="Ver evidencia de la visita"
                    >
                      <img src={getProxiedUrl(v.imagenUrl)} alt="Evidencia de la visita" loading="lazy" className="h-24 w-full max-w-[220px] object-cover" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Diálogo para completar una ruta: permite adjuntar una foto (cámara o galería) y detecta
// la geolocalización del dispositivo. Al confirmar marca la ruta como realizada para el
// cliente y guarda la evidencia (foto + coordenadas) en el histórico de visitas.
function CompletarRutaDialog({ clienteId, clienteNombre, ruta, onClose, actividadId, taskId }: { clienteId: string; clienteNombre: string; ruta: { id: string; nombre: string }; onClose: () => void; actividadId?: string; taskId?: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [nota, setNota] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);

  const detectGeo = () => {
    if (!("geolocation" in navigator)) { setGeoStatus("error"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoStatus("ok"); },
      () => { setGeoStatus("error"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };
  // Al abrir el diálogo intenta detectar la ubicación automáticamente.
  useEffect(() => { detectGeo(); }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      let imagenUrl: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) throw new Error("No se pudo subir la imagen");
        imagenUrl = (await res.json()).url || null;
      }
      await apiRequest("PATCH", `/api/rutas/${ruta.id}/clientes/${encodeURIComponent(clienteId)}/visitado`, {
        visitado: true,
        imagenUrl,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        nota: nota.trim() || null,
        clienteNombre,
      });
      // Si venimos de completar una actividad "visita" de "Tareas del cliente", marcarla
      // también como completada para que el check quede reflejado en esa lista.
      if (actividadId) {
        await apiRequest("PATCH", `/api/tasks/actividades/${actividadId}`, { estado: "completada" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/visitas/by-cliente", clienteId] });
      // Para que la evidencia aparezca al tiro en el apartado Rutas.
      queryClient.invalidateQueries({ queryKey: [`/api/rutas/${ruta.id}/visitas`] });
      queryClient.invalidateQueries({ queryKey: [`/api/rutas/${ruta.id}/clientes`] });
      if (taskId) queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "actividades"] });
      toast({ title: actividadId ? "Visita completada" : "Ruta marcada como realizada" });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo completar la ruta.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Completar ruta</DialogTitle>
          <DialogDescription>{ruta.nombre} · {clienteNombre}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Foto de la visita</label>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Foto de la visita" className="w-full h-40 object-cover rounded-lg border border-slate-200" />
                <button type="button" onClick={() => { setFile(null); setPreview(""); }} className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-1 text-slate-500 hover:text-red-500 shadow-sm"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 h-28 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-orange-300 text-slate-400 hover:text-orange-500 transition-colors">
                <Camera className="h-6 w-6" />
                <span className="text-xs">Tomar o subir foto</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
              </label>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Ubicación</label>
            <div className="flex items-center gap-2 text-xs">
              {geoStatus === "loading" && <span className="text-slate-400 flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Detectando ubicación…</span>}
              {geoStatus === "ok" && geo && (
                <a href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`} target="_blank" rel="noreferrer" className="text-green-600 font-medium flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</a>
              )}
              {geoStatus === "error" && <span className="text-amber-600">No se pudo detectar la ubicación.</span>}
              {geoStatus === "idle" && <span className="text-slate-400">Sin ubicación.</span>}
              {geoStatus !== "loading" && (
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={detectGeo}>{geoStatus === "ok" ? "Actualizar" : "Detectar"}</Button>
              )}
            </div>
          </div>
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)…" className="h-8 text-xs" />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />} Marcar realizada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarketingClientePanel({ clienteId, clienteNombre, canManage }: { clienteId?: string; clienteNombre: string; canManage: boolean }) {
  const { toast } = useToast();
  const [assignOpen, setAssignOpen] = useState(false);
  const { data = [], isLoading } = useQuery<Array<{ itemId: string; itemNombre: string; unidad: string; cantidadEnPoder: number }>>({
    queryKey: ["/api/marketing/inventario-por-cliente", { cliente: clienteNombre }],
    enabled: !!clienteNombre,
  });

  // Tareas del área Marketing asociadas a este cliente (por id o por nombre).
  // Reusa la caché de ["/api/tasks"] que ya alimenta el listado principal.
  const { data: allTasks = [], isLoading: isLoadingTasks } = useQuery<Array<any>>({
    queryKey: ["/api/tasks"],
    enabled: !!clienteNombre || !!clienteId,
  });
  const tareasMarketing = (allTasks || []).filter((t) => {
    if (t.segmento !== "marketing") return false;
    const matchId = clienteId && String(t.clienteId || "") === String(clienteId);
    const matchNombre = clienteNombre && String(t.clienteNombre || "") === String(clienteNombre);
    return matchId || matchNombre;
  });
  const estadoTarea = (t: any): { done: boolean; label: string; cls: string } => {
    const done = t.status === "completada" || (t.assignments || []).some((a: any) => a.status === "completed");
    if (done) return { done, label: "Terminada", cls: "bg-green-100 text-green-700" };
    if (t.status === "en_proceso" || t.status === "en_progreso") return { done, label: "En proceso", cls: "bg-blue-100 text-blue-700" };
    return { done, label: "Pendiente", cls: "bg-amber-100 text-amber-700" };
  };

  // Refrescar tanto lo que tiene el cliente como el inventario global (el stock cambió).
  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/marketing/inventario-por-cliente", { cliente: clienteNombre }] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketing/inventario"] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketing/inventario/summary"] });
  };

  // Devolución: el cliente reintegra elementos → suma stock de vuelta al inventario.
  const devolverMutation = useMutation({
    mutationFn: async ({ itemId, cantidad }: { itemId: string; cantidad: number }) =>
      apiRequest("POST", `/api/marketing/inventario/${itemId}/movimientos`, { tipo: "devolucion", cantidad, clienteNombre }),
    onSuccess: () => { refetchAll(); toast({ title: "Devolución registrada", description: "Stock reintegrado al inventario." }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Tareas de Marketing asociadas al cliente */}
      <div className="space-y-2">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tareas de marketing</p>
        {isLoadingTasks ? (
          <p className="text-xs text-slate-400">Cargando tareas…</p>
        ) : tareasMarketing.length === 0 ? (
          <p className="text-xs text-slate-400 italic">El cliente no tiene tareas de marketing asociadas.</p>
        ) : (
          <div className="space-y-1">
            {tareasMarketing.map((t) => {
              const est = estadoTarea(t);
              return (
                <div key={t.id} className="flex items-center gap-2 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                  <Palette className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                  <span className={`font-medium flex-1 truncate ${est.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{t.title}</span>
                  {t.dueDate && (
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{format(new Date(t.dueDate), "dd MMM", { locale: es })}</span>
                  )}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${est.cls}`}>{est.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Elementos entregados</p>
        {canManage && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAssignOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Entregar
          </Button>
        )}
      </div>
      {isLoading ? (
        <p className="text-xs text-slate-400">Cargando elementos…</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-slate-400 italic">El cliente no tiene elementos de marketing registrados.</p>
      ) : (
        <div className="space-y-1">
          {data.map((m) => (
            <div key={m.itemId} className="flex items-center gap-2 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
              <Palette className="h-3.5 w-3.5 text-pink-400 flex-shrink-0" />
              <span className="font-medium text-slate-700 flex-1 truncate">{m.itemNombre}</span>
              <span className="font-semibold text-slate-700 flex-shrink-0">{m.cantidadEnPoder} {m.unidad}</span>
              {canManage && (
                <button
                  className="text-[10px] font-medium text-slate-400 hover:text-orange-600 flex-shrink-0 disabled:opacity-50"
                  disabled={devolverMutation.isPending}
                  onClick={() => {
                    const raw = window.prompt(`¿Cuántas ${m.unidad} devuelve de "${m.itemNombre}"? (máx ${m.cantidadEnPoder})`, String(m.cantidadEnPoder));
                    if (raw == null) return;
                    const cantidad = parseInt(raw, 10);
                    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
                    if (cantidad > m.cantidadEnPoder) { toast({ title: "Cantidad inválida", description: "No puede exceder lo que tiene el cliente.", variant: "destructive" }); return; }
                    devolverMutation.mutate({ itemId: m.itemId, cantidad });
                  }}
                >Devolver</button>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
      {assignOpen && (
        <AssignMarketingDialog open={assignOpen} onOpenChange={setAssignOpen} clienteNombre={clienteNombre} onDone={refetchAll} />
      )}
    </div>
  );
}

// Diálogo para entregar un elemento del inventario de marketing a un cliente.
// Crea un movimiento 'salida' que el backend descuenta del stock automáticamente.
function AssignMarketingDialog({ open, onOpenChange, clienteNombre, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; clienteNombre: string; onDone: () => void }) {
  const { toast } = useToast();
  const [itemId, setItemId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [nota, setNota] = useState("");

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/marketing/inventario"],
    enabled: open,
  });
  const disponibles = items.filter((i) => Number(i.cantidad) > 0);
  const selected = items.find((i) => i.id === itemId);
  const stock = selected ? Number(selected.cantidad) : 0;
  const qty = parseInt(cantidad, 10);
  const invalid = !itemId || !Number.isFinite(qty) || qty <= 0 || qty > stock;

  const assignMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/marketing/inventario/${itemId}/movimientos`, {
        tipo: "salida",
        cantidad: qty,
        clienteNombre,
        nota: nota.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Elemento entregado", description: "Stock descontado del inventario." });
      onDone();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Entregar elemento de marketing</DialogTitle>
          <DialogDescription>Se descuenta del inventario y queda registrado a nombre de {clienteNombre}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Elemento</label>
            <Select value={itemId} onValueChange={(v) => { setItemId(v); setCantidad("1"); }}>
              <SelectTrigger><SelectValue placeholder={isLoading ? "Cargando…" : (disponibles.length ? "Selecciona un elemento" : "Sin stock disponible")} /></SelectTrigger>
              <SelectContent>
                {disponibles.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.nombre} — {i.cantidad} {i.unidad} disp.</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Cantidad {selected ? `(máx ${stock} ${selected.unidad})` : ""}</label>
            <Input type="number" min={1} max={stock || undefined} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Nota (opcional)</label>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: entregado en visita" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={invalid || assignMutation.isPending} onClick={() => assignMutation.mutate()}>
            {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================================================================================
// MarketingSolicitudDialog — "Solicitud de Marketing" desde el Panel (Etapa 1).
// Reutiliza el módulo Marketing existente (/api/marketing/solicitudes): el solicitante
// manda una fecha sugerida; la encargada de Marketing fija el plazo final en su módulo.
// ==================================================================================
function MarketingSolicitudDialog({ open, onOpenChange, segmento }: { open: boolean; onOpenChange: (o: boolean) => void; segmento: string | null }) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState("media");
  const [fechaSugerida, setFechaSugerida] = useState("");
  // Cliente de origen (opcional): cuando el pedido nace de un cliente que atiende un vendedor.
  const [searchCliente, setSearchCliente] = useState("");
  const [clienteSel, setClienteSel] = useState<{ koen: string; nokoen: string } | null>(null);
  const { data: clientesResult = [] } = useQuery<Array<{ id: string; koen: string; nokoen: string }>>({
    queryKey: ['/api/clients/search', 'solicitud-marketing', searchCliente],
    queryFn: async () => {
      if (searchCliente.length < 2) return [];
      const response = await apiRequest(`/api/clients/search?q=${encodeURIComponent(searchCliente)}`);
      return response.json();
    },
    enabled: open && searchCliente.length >= 2,
  });
  const reset = () => {
    setTitulo(""); setDescripcion(""); setUrgencia("media"); setFechaSugerida("");
    setSearchCliente(""); setClienteSel(null);
  };
  const createMutation = useMutation({
    mutationFn: async () => {
      const base = fechaSugerida ? new Date(fechaSugerida) : new Date();
      return apiRequest("POST", "/api/marketing/solicitudes", {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        urgencia,
        fechaEntrega: fechaSugerida || undefined,
        clienteId: clienteSel?.koen || undefined,
        clienteNombre: clienteSel?.nokoen || undefined,
        // Área desde la que se pide: con esto la bandeja de Marketing se acota al área
        // seleccionada en el Panel. Si no hay área elegida (vendedor, que ve "todas"),
        // el backend cae al segmento asignado del usuario.
        segmento: segmento || undefined,
        mes: base.getMonth() + 1,
        anio: base.getFullYear(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/solicitudes"] });
      toast({ title: "Solicitud enviada", description: "Marketing recibió tu pedido y definirá el plazo final." });
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo enviar la solicitud.", variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-orange-600" /> Solicitud de Marketing</DialogTitle>
          <DialogDescription>Enviá tu pedido con una fecha sugerida. La encargada de Marketing fijará el plazo final.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Gigantografía para local zona sur" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción *</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder="Detallá qué necesitás de Marketing…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente (opcional)</Label>
            {clienteSel ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50/50">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate">{clienteSel.nokoen}</p>
                  <p className="text-xs text-slate-500">Código: {clienteSel.koen}</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setClienteSel(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Input value={searchCliente} onChange={(e) => setSearchCliente(e.target.value)} placeholder="Buscá el cliente que pidió esto…" />
                {searchCliente.length >= 2 && clientesResult.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border rounded-lg bg-white shadow-sm">
                    {clientesResult.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-orange-50 border-b last:border-b-0 transition-colors"
                        onClick={() => { setClienteSel({ koen: c.koen, nokoen: c.nokoen }); setSearchCliente(""); }}
                      >
                        <p className="font-medium text-sm">{c.nokoen}</p>
                        <p className="text-xs text-gray-500">Código: {c.koen}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha sugerida</Label>
              <Input type="date" value={fechaSugerida} onChange={(e) => setFechaSugerida(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Urgencia</Label>
              <Select value={urgencia} onValueChange={setUrgencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-[#fd6301] hover:bg-[#e35400] text-white" disabled={!titulo.trim() || !descripcion.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================================================================================
// MarketingSolicitudesInbox — Bandeja de solicitudes que el equipo (supervisores/
// encargados) envía a Marketing. La encargada las ve acá, las ACEPTA fijando un plazo
// final (pasan a "En mi flujo") o las RECHAZA indicando un motivo.
// ==================================================================================
interface SolicitudMarketingItem {
  id: string;
  titulo: string;
  descripcion?: string | null;
  urgencia?: string | null;
  estado: string;
  supervisorName?: string | null;
  solicitanteRol?: string | null;
  segmento?: string | null;
  clienteNombre?: string | null;
  fechaSolicitud?: string | null;
  fechaEntrega?: string | null;
  fechaCompletado?: string | null;
  motivoRechazo?: string | null;
}

const ROL_LABEL: Record<string, string> = {
  salesperson: "Vendedor",
  supervisor: "Supervisor",
  encargado_area: "Encargado",
  admin: "Admin",
};

const URGENCIA_STYLES: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
  baja: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatFechaCorta(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v.includes("T") ? v : `${v}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// viewer: 'marketing' = la encargada gestiona su bandeja (comportamiento original);
// 'admin' = ve todas las solicitudes y también puede gestionarlas (el backend se lo
// permite); 'solicitante' = supervisor/encargado/vendedor solo ve el estado de las
// solicitudes que él mismo envió (el GET ya viene scopeado por rol desde el server).
// segmento: área seleccionada en el Panel de Trabajo. El panel se navega por área, así
// que la bandeja se acota a los pedidos originados en esa área (en Construcción no se
// revisan los de Ferreterías). null/'all'/'marketing' = sin acotar.
function MarketingSolicitudesInbox({ viewer = 'marketing', segmento = null }: { viewer?: 'marketing' | 'admin' | 'solicitante'; segmento?: string | null }) {
  const { toast } = useToast();
  const canManage = viewer !== 'solicitante';
  // Solicitudes con cambios recientes no vistos: quedan destacadas al entrar.
  const marketingHighlights = usePanelHighlights('marketing');
  const solicitudCardClass = (id: string, extra = "") =>
    `rounded-xl border p-3.5 shadow-sm cursor-pointer hover:shadow-md hover:border-orange-200 transition-all ${extra} ${
      marketingHighlights.has(id)
        ? 'border-orange-300 ring-2 ring-[#fd6301]/25 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-800'
        : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700'
    }`;
  const [aceptar, setAceptar] = useState<SolicitudMarketingItem | null>(null);
  const [rechazar, setRechazar] = useState<SolicitudMarketingItem | null>(null);
  const [plazo, setPlazo] = useState("");
  const [motivo, setMotivo] = useState("");
  // Ficha con el chat hacia la otra parte: se guarda el id para que refleje siempre
  // el último estado de la solicitud y no un snapshot.
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data: todasLasSolicitudes = [], isLoading } = useQuery<SolicitudMarketingItem[]>({
    queryKey: ["/api/marketing/solicitudes"],
  });

  // Acotar al área seleccionada. Las solicitudes sin `segmento` (las previas a la columna
  // que no se pudieron atribuir, o las de un admin sin área) no pertenecen a ninguna en
  // particular: se muestran en todas marcadas como "Sin área" para que no queden
  // invisibles en el panel.
  const areaActiva = segmento && segmento !== 'all' && segmento !== 'marketing' ? segmento : null;
  const solicitudes = useMemo(
    () =>
      areaActiva
        ? todasLasSolicitudes.filter((s) => !s.segmento || s.segmento === areaActiva)
        : todasLasSolicitudes,
    [todasLasSolicitudes, areaActiva],
  );
  // Badge para las que no tienen área atribuida (solo aporta cuando hay área activa).
  const sinAreaBadge = (s: SolicitudMarketingItem) =>
    areaActiva && !s.segmento ? (
      <Badge variant="outline" className="text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">
        SIN ÁREA
      </Badge>
    ) : null;

  const estadoMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, any> }) =>
      apiRequest("POST", `/api/marketing/solicitudes/${id}/estado`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/solicitudes"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo actualizar la solicitud.", variant: "destructive" }),
  });

  const pendientes = solicitudes.filter((s) => s.estado === "solicitado");
  const enFlujo = solicitudes.filter((s) => s.estado === "en_proceso");
  // El solicitante también ve el desenlace: sin esto, una solicitud rechazada o
  // completada vuelve a "desaparecer" de su vista sin explicación (el motivo del
  // rechazo solo queda guardado en motivoRechazo).
  const resueltas = viewer === "solicitante"
    ? solicitudes
        .filter((s) => s.estado === "rechazado" || s.estado === "completado")
        .sort((a, b) => new Date(b.fechaSolicitud || 0).getTime() - new Date(a.fechaSolicitud || 0).getTime())
    : [];

  const confirmarAceptar = () => {
    if (!aceptar) return;
    estadoMutation.mutate(
      { id: aceptar.id, body: { estado: "en_proceso", fechaEntrega: plazo || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Solicitud aceptada", description: "Pasó a tu flujo de trabajo." });
          setAceptar(null); setPlazo("");
        },
      },
    );
  };

  const confirmarRechazar = () => {
    if (!rechazar || !motivo.trim()) return;
    estadoMutation.mutate(
      { id: rechazar.id, body: { estado: "rechazado", motivoRechazo: motivo.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Solicitud rechazada", description: "Se notificó el motivo al solicitante." });
          setRechazar(null); setMotivo("");
        },
      },
    );
  };

  if (isLoading || (pendientes.length === 0 && enFlujo.length === 0 && resueltas.length === 0)) return null;

  return (
    <div className="space-y-5 mb-6">
      {/* Pendientes de aceptación */}
      {pendientes.length > 0 && (
        <div className="rounded-2xl border border-orange-200/70 bg-orange-50/40 dark:bg-orange-900/10 dark:border-orange-800/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-[#fd6301] flex items-center justify-center shadow-sm">
              <Send className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                {viewer === 'solicitante' ? 'Mis solicitudes a Marketing' : 'Solicitudes del equipo'}
              </h3>
              <p className="text-xs text-slate-500">
                {viewer === 'solicitante'
                  ? 'Esperando aceptación de Marketing'
                  : viewer === 'admin'
                    ? 'Pedidos pendientes de aceptación por Marketing'
                    : 'Pedidos que esperan tu aprobación'}
              </p>
            </div>
            <Badge className="ml-auto bg-[#fd6301] text-white font-semibold">{pendientes.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {pendientes.map((s) => (
              <div key={s.id} className={solicitudCardClass(s.id)} onClick={() => setDetalleId(s.id)} data-testid={`card-solicitud-${s.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{s.titulo}</span>
                      {s.urgencia && (
                        <Badge variant="outline" className={`text-[10px] font-semibold border ${URGENCIA_STYLES[s.urgencia] || URGENCIA_STYLES.baja}`}>
                          {s.urgencia.toUpperCase()}
                        </Badge>
                      )}
                      {sinAreaBadge(s)}
                    </div>
                    {s.descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.descripcion}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {s.supervisorName || "—"}{s.solicitanteRol && ROL_LABEL[s.solicitanteRol] ? ` · ${ROL_LABEL[s.solicitanteRol]}` : ""}</span>
                      {s.clienteNombre && <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {s.clienteNombre}</span>}
                      {s.fechaEntrega && <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Sugerida: {formatFechaCorta(s.fechaEntrega)}</span>}
                    </div>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold bg-[#fd6301] hover:bg-[#e35400] text-white flex-1"
                      onClick={(e) => { e.stopPropagation(); setAceptar(s); setPlazo(s.fechaEntrega || ""); }}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Aceptar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 flex-1"
                      onClick={(e) => { e.stopPropagation(); setRechazar(s); setMotivo(""); }}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Rechazar
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1">
                      <Clock className="h-3 w-3" /> Esperando aceptación
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#fd6301]">
                      <MessageSquare className="h-3 w-3" /> Toca para conversar con Marketing
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* En mi flujo (aceptadas) */}
      {enFlujo.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white/60 dark:bg-slate-900/40 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <Play className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                {viewer === 'marketing' ? 'En mi flujo' : 'En proceso'}
              </h3>
              <p className="text-xs text-slate-500">
                {viewer === 'solicitante' ? 'Aceptadas por Marketing, en curso' : 'Solicitudes aceptadas en curso'}
              </p>
            </div>
            <Badge className="ml-auto bg-emerald-500 text-white font-semibold">{enFlujo.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {enFlujo.map((s) => (
              <div key={s.id} className={solicitudCardClass(s.id)} onClick={() => setDetalleId(s.id)} data-testid={`card-solicitud-${s.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{s.titulo}</span>
                      {sinAreaBadge(s)}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {s.supervisorName || "—"}</span>
                      {s.clienteNombre && <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {s.clienteNombre}</span>}
                      {s.fechaEntrega && (
                        <span className="inline-flex items-center gap-1 text-orange-600 font-medium"><CalendarIcon className="h-3 w-3" /> Plazo: {formatFechaCorta(s.fechaEntrega)}</span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                      disabled={estadoMutation.isPending}
                      onClick={(e) => { e.stopPropagation(); estadoMutation.mutate({ id: s.id, body: { estado: "completado" } }, { onSuccess: () => toast({ title: "Solicitud completada" }) }); }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" /> Completar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resueltas (solo solicitante): rechazadas con su motivo + completadas */}
      {resueltas.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white/60 dark:bg-slate-900/40 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-500 flex items-center justify-center shadow-sm">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">Resueltas</h3>
              <p className="text-xs text-slate-500">Solicitudes que Marketing completó o rechazó</p>
            </div>
            <Badge className="ml-auto bg-slate-500 text-white font-semibold">{resueltas.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {resueltas.map((s) => (
              <div key={s.id} className={solicitudCardClass(s.id, "opacity-90")} onClick={() => setDetalleId(s.id)} data-testid={`card-solicitud-${s.id}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{s.titulo}</span>
                  {s.estado === "rechazado" ? (
                    <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Rechazada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Completada
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                  {s.clienteNombre && <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {s.clienteNombre}</span>}
                  {s.fechaSolicitud && <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> Enviada: {formatFechaCorta(s.fechaSolicitud)}</span>}
                </div>
                {s.estado === "rechazado" && s.motivoRechazo && (
                  <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-lg px-2.5 py-1.5 mt-2">
                    <span className="font-semibold">Motivo:</span> {s.motivoRechazo}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ficha de la solicitud + chat con la otra parte */}
      <SolicitudDetalleDialog
        solicitud={solicitudes.find((s) => s.id === detalleId) ?? null}
        open={!!detalleId}
        onOpenChange={(o) => { if (!o) setDetalleId(null); }}
        canManage={canManage}
      />

      {/* Dialog: aceptar + fijar plazo */}
      <Dialog open={!!aceptar} onOpenChange={(o) => { if (!o) { setAceptar(null); setPlazo(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-[#fd6301]" /> Aceptar solicitud</DialogTitle>
            <DialogDescription>Definí el plazo final para "{aceptar?.titulo}". Pasará a tu flujo de trabajo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha límite</Label>
            <Input type="date" value={plazo} onChange={(e) => setPlazo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAceptar(null); setPlazo(""); }}>Cancelar</Button>
            <Button className="bg-[#fd6301] hover:bg-[#e35400] text-white" disabled={estadoMutation.isPending} onClick={confirmarAceptar}>
              {estadoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar y agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: rechazar + motivo */}
      <Dialog open={!!rechazar} onOpenChange={(o) => { if (!o) { setRechazar(null); setMotivo(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" /> Rechazar solicitud</DialogTitle>
            <DialogDescription>Indicá por qué rechazás "{rechazar?.titulo}". El solicitante verá el motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motivo del rechazo *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ej: No hay presupuesto este mes / falta información…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRechazar(null); setMotivo(""); }}>Cancelar</Button>
            <Button variant="destructive" disabled={!motivo.trim() || estadoMutation.isPending} onClick={confirmarRechazar}>
              {estadoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// El panel administrativo de solicitudes de Marketing (antes MarketingManagerPanel,
// que vivía acá dentro) se movió al módulo Marketing: `pages/marketing/bandeja-
// solicitudes.tsx`. Era una segunda implementación de la misma bandeja, con otra
// UX que la del módulo, y sostenerlas en paralelo era la causa del desorden.

// ==================================================================================
// DateTimePicker — selector de fecha (calendario) + hora en un popover.
// value/onChange usan el formato "YYYY-MM-DDTHH:mm" (datetime-local), compatible con el schema.
// ==================================================================================
function DateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value) : undefined;
  const dateValid = !!parsed && !isNaN(parsed.getTime());
  const timeStr = value && value.includes("T") ? (value.split("T")[1]?.slice(0, 5) || "12:00") : "12:00";

  const setDatePart = (d?: Date) => {
    if (!d) { onChange(""); return; }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}T${timeStr}`);
    setOpen(false);
  };
  const setTimePart = (t: string) => {
    const base = dateValid ? value.split("T")[0] : format(new Date(), "yyyy-MM-dd");
    onChange(`${base}T${t || "12:00"}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 h-10 text-sm text-left hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 transition-colors"
          data-testid="input-task-due-date"
        >
          <CalendarIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
          {dateValid
            ? <span className="text-slate-800">{format(parsed!, "dd MMM yyyy, HH:mm", { locale: es })}</span>
            : <span className="text-slate-400">Seleccionar fecha y hora</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValid ? parsed : undefined}
          onSelect={(d) => setDatePart(d || undefined)}
          initialFocus
          locale={es}
        />
        <div className="border-t border-slate-100 p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimePart(e.target.value)}
            className="flex-1 border border-slate-200 rounded-md px-2 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
          />
          {value && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-xs text-slate-400 hover:text-red-500 px-1">
              Limpiar
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ==================================================================================
// ActividadesPanel — subtareas / actividades tipadas de un seguimiento de cliente.
// Cada actividad: tipo + fecha + descripción opcional + estado (pendiente/completada).
// El mismo panel son las tareas de un proyecto de Industrial (`esProyecto`): solo
// cambian los textos y, sin cliente del ERP, no se ofrece ligar la visita a una ruta.
// ==================================================================================
function ActividadesPanel({ taskId, canManage, clienteId, clienteNombre, esProyecto = false }: { taskId: string; canManage: boolean; clienteId: string; clienteNombre?: string; esProyecto?: boolean }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("llamada");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [rutaId, setRutaId] = useState("");
  // Creación de ruta "al vuelo": cuando no hay rutas (o se quiere una nueva) el vendedor
  // escribe un nombre y la ruta se crea en el momento, sin depender de que un supervisor
  // se la haya asignado antes. La fecha de la actividad puede ser pasada o futura.
  const [creatingRuta, setCreatingRuta] = useState(false);
  const [nuevaRuta, setNuevaRuta] = useState("");
  // Actividad "visita" que se está completando: abre el diálogo de foto/evidencia.
  const [completingVisita, setCompletingVisita] = useState<{ actId: string; rutaId: string; rutaNombre: string } | null>(null);

  const { data: actividades = [], isLoading } = useQuery<Array<{ id: string; tipo: string; descripcion: string | null; fecha: string | null; estado: string; responsableNombre: string | null; rutaId: string | null; rutaNombre: string | null }>>({
    queryKey: ["/api/tasks", taskId, "actividades"],
  });
  // Ligar una visita a una ruta comercial exige un cliente del ERP: los proyectos
  // de posibles clientes (o de producto) no lo tienen y no ofrecen esa opción.
  const puedeLigarRuta = !!clienteId && clienteId !== 'PROSPECTO';
  const { data: rutas = [] } = useQuery<Array<{ id: string; nombre: string }>>({ queryKey: ["/api/rutas"], enabled: canManage && puedeLigarRuta });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "actividades"] });
    // el histórico y el estado de la pestaña Rutas también reflejan lo hecho desde acá
    queryClient.invalidateQueries({ queryKey: ["/api/rutas/visitas/by-cliente", clienteId] });
    queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] });
  };

  const createRutaMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/rutas/quick", { nombre: nuevaRuta.trim(), clienteId, clienteNombre });
      return r.json();
    },
    onSuccess: (ruta: { id: string; nombre: string }) => {
      // Seed inmediato del cache para que el <Select> muestre la ruta recién creada
      // (y createMut pueda resolver rutaNombre) antes de que llegue el refetch.
      queryClient.setQueryData<Array<{ id: string; nombre: string }>>(["/api/rutas"], (old) =>
        Array.isArray(old) ? [ruta, ...old.filter((r) => r.id !== ruta.id)] : [ruta]);
      queryClient.invalidateQueries({ queryKey: ["/api/rutas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] });
      setRutaId(ruta.id);
      setCreatingRuta(false);
      setNuevaRuta("");
      toast({ title: "Ruta creada", description: ruta.nombre });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo crear la ruta.", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const rutaNombre = tipo === "visita" && rutaId ? (rutas.find((r) => r.id === rutaId)?.nombre || undefined) : undefined;
      return apiRequest("POST", `/api/tasks/${taskId}/actividades`, {
        tipo,
        fecha: fecha || undefined,
        descripcion: descripcion.trim() || undefined,
        rutaId: tipo === "visita" && rutaId ? rutaId : undefined,
        rutaNombre,
      });
    },
    onSuccess: () => { invalidate(); setShowForm(false); setTipo("llamada"); setFecha(""); setDescripcion(""); setRutaId(""); toast({ title: "Actividad agregada" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo agregar.", variant: "destructive" }),
  });
  const toggleMut = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => apiRequest("PATCH", `/api/tasks/actividades/${id}`, { estado }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/tasks/actividades/${id}`),
    onSuccess: invalidate,
  });

  const meta = (t: string) => ACTIVIDAD_TIPOS.find((x) => x.value === t) || ACTIVIDAD_TIPOS[ACTIVIDAD_TIPOS.length - 1];
  const sorted = [...actividades].sort((a, b) => {
    const aDone = a.estado === "completada" ? 1 : 0;
    const bDone = b.estado === "completada" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (a.fecha || "").localeCompare(b.fecha || "");
  });
  const total = actividades.length;
  const done = actividades.filter((a) => a.estado === "completada").length;

  return (
    <div className="space-y-3">
      {completingVisita && (
        <CompletarRutaDialog
          clienteId={clienteId}
          clienteNombre={clienteNombre || ""}
          ruta={{ id: completingVisita.rutaId, nombre: completingVisita.rutaNombre }}
          actividadId={completingVisita.actId}
          taskId={taskId}
          onClose={() => setCompletingVisita(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-slate-800">{esProyecto ? "Tareas del proyecto" : "Tareas del cliente"}</h4>
          {total > 0 && <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">{done}/{total}</Badge>}
        </div>
        {canManage && !showForm && (
          <Button size="sm" className="h-8 bg-[#fd6301] hover:bg-[#e35400] text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> {esProyecto ? "Nueva tarea" : "Nueva actividad"}
          </Button>
        )}
      </div>

      {canManage && showForm && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVIDAD_TIPOS.map((t) => (<SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 text-xs" title="Podés registrar una fecha pasada o futura" />
          </div>
          {tipo === "visita" && puedeLigarRuta && (
            creatingRuta ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={nuevaRuta}
                  onChange={(e) => setNuevaRuta(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nuevaRuta.trim() && !createRutaMut.isPending) createRutaMut.mutate(); }}
                  placeholder="Nombre de la ruta nueva…"
                  className="h-8 text-xs flex-1"
                />
                <Button size="sm" className="h-8 bg-[#fd6301] hover:bg-[#e35400] text-xs" disabled={!nuevaRuta.trim() || createRutaMut.isPending} onClick={() => createRutaMut.mutate()}>
                  {createRutaMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Crear"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" onClick={() => { setCreatingRuta(false); setNuevaRuta(""); }}>Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select value={rutaId} onValueChange={setRutaId}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Ruta (queda en el histórico de Rutas)…" /></SelectTrigger>
                  <SelectContent>
                    {rutas.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400">No hay rutas creadas — usá "Nueva"</div>
                    ) : rutas.map((r) => (<SelectItem key={r.id} value={r.id} className="text-xs">{r.nombre}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50 whitespace-nowrap" onClick={() => setCreatingRuta(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
                </Button>
              </div>
            )
          )}
          <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Descripción (opcional)…" className="text-xs resize-none" />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 bg-[#fd6301] hover:bg-[#e35400] text-xs flex-1" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1.5" /> Agregar</>}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-slate-400 italic">{esProyecto ? "Sin tareas todavía. Agregá la primera acción del proyecto." : "Sin actividades. Agregá la primera acción con este cliente."}</p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((a) => {
            const m = meta(a.tipo);
            const doneAct = a.estado === "completada";
            return (
              <div key={a.id} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 border transition-all ${doneAct ? "bg-slate-50/60 border-slate-100 opacity-70" : "bg-white border-slate-200"}`}>
                {canManage ? (
                  <button
                    onClick={() => {
                      // Completar una visita ligada a una ruta pide foto/evidencia (igual que
                      // "Realizada" en la pestaña Rutas). Desmarcar o cualquier otro tipo es directo.
                      if (!doneAct && a.tipo === "visita" && a.rutaId) {
                        setCompletingVisita({ actId: a.id, rutaId: a.rutaId, rutaNombre: a.rutaNombre || "Visita de ruta" });
                      } else {
                        toggleMut.mutate({ id: a.id, estado: doneAct ? "pendiente" : "completada" });
                      }
                    }}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${doneAct ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-emerald-400"}`}
                  >
                    {doneAct && <Check className="h-3 w-3" />}
                  </button>
                ) : (
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${doneAct ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200"}`}>
                    {doneAct && <Check className="h-3 w-3" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] border-0 ${m.badge}`}>{m.label}</Badge>
                    {a.fecha && <span className="text-[11px] text-slate-400">{format(new Date(a.fecha), "dd MMM yyyy", { locale: es })}</span>}
                    {a.rutaNombre && <span className="text-[11px] text-orange-500 flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {a.rutaNombre}</span>}
                  </div>
                  {a.descripcion && <p className={`text-xs mt-0.5 ${doneAct ? "text-slate-400 line-through" : "text-slate-600"}`}>{a.descripcion}</p>}
                </div>
                {canManage && (
                  <button onClick={() => deleteMut.mutate(a.id)} className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================================================================================
// HeaderMeta — Fecha límite (editable) + Cliente en la cabecera del detalle de tarea.
// En un seguimiento de cliente la fecha no es un plazo: es la "Fecha de Revisión"
// (opcional, solo día) y al guardarla queda registrada también como actividad
// 'revision' en "Tareas del cliente" (lo sincroniza el backend).
// ==================================================================================
function HeaderMeta({ task, isSeguimiento = false, esProyecto = false }: { task: any; isSeguimiento?: boolean; esProyecto?: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  // El seguimiento es el espacio de trabajo del vendedor asignado: puede registrar la
  // fecha de revisión aunque no haya creado la tarea (el backend limita ese caso a dueDate).
  const isAssignedToMe = ((task.assignments || []) as any[]).some((a) => a.assigneeId === user?.id);
  const canEditDate = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'encargado_area' || task.createdByUserId === user?.id || (isSeguimiento && isAssignedToMe);
  const [editing, setEditing] = useState(false);
  const [dateValue, setDateValue] = useState(task.dueDate ? format(new Date(task.dueDate), isSeguimiento ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm") : "");
  const isCompleted = task.status === 'completada';
  const updateDueDate = useMutation({
    mutationFn: async (dueDate: string | null) => apiRequest("PATCH", `/api/tasks/${task.id}`, { dueDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      // la revisión se refleja como actividad en la pestaña Tareas del cliente
      if (isSeguimiento) queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "actividades"] });
      setEditing(false);
      toast({ title: isSeguimiento ? "Fecha de revisión actualizada" : "Fecha actualizada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo actualizar la fecha.", variant: "destructive" }),
  });
  const overdue = !isSeguimiento && task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
  const save = () => {
    if (!dateValue) return updateDueDate.mutate(null);
    // La revisión es solo fecha: se guarda a mediodía local para evitar corrimientos de zona horaria.
    updateDueDate.mutate(new Date(isSeguimiento ? `${dateValue}T12:00:00` : dateValue).toISOString());
  };
  return (
    <div className="flex items-center gap-x-4 sm:gap-x-6 gap-y-2 mt-3 flex-wrap pl-0 sm:pl-[52px]">
      {task.clienteNombre && (
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente</span>
          <span className="font-semibold text-emerald-700 truncate">{task.clienteNombre}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-sm">
        <CalendarIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isSeguimiento ? "Fecha de Revisión" : esProyecto ? "Fecha objetivo" : "Fecha límite"}</span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            {isSeguimiento ? (
              <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="h-8 w-[150px] text-xs" />
            ) : (
              <div className="w-[210px]"><DateTimePicker value={dateValue} onChange={setDateValue} /></div>
            )}
            <button onClick={save} disabled={updateDueDate.isPending} className="text-[11px] font-semibold bg-[#fd6301] hover:bg-[#e35400] text-white rounded-lg px-2 py-1 disabled:opacity-50">{updateDueDate.isPending ? "…" : "Guardar"}</button>
            <button onClick={() => setEditing(false)} className="text-[11px] text-slate-500 hover:bg-slate-100 rounded-lg px-2 py-1">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => canEditDate && setEditing(true)} className={`flex items-center gap-1 font-semibold ${overdue ? "text-red-600" : task.dueDate ? (isSeguimiento ? "text-violet-700" : "text-slate-800") : "text-slate-400 italic"} ${canEditDate ? "hover:underline" : ""}`}>
            {task.dueDate
              ? format(new Date(task.dueDate), isSeguimiento ? "dd MMM yyyy" : "dd MMM yyyy, HH:mm", { locale: es })
              : isSeguimiento ? (canEditDate ? "Registrar fecha de revisión" : "Sin fecha de revisión") : "Sin fecha"}
            {canEditDate && <Pencil className="h-3 w-3 text-slate-400" />}
          </button>
        )}
      </div>
    </div>
  );
}