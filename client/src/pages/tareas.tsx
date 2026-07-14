import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckSquare,
  Camera,
  Clock,
  AlertCircle,
  AlertTriangle,
  User,
  Users,
  Building2,
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
  Palette
} from "lucide-react";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Task, type TaskAssignment, type InsertTaskAssignment, type TaskComment } from "@shared/schema";
import { RutasComercialesContent } from "@/pages/rutas-comerciales";
import { z } from "zod";

// SECURITY: Frontend schema that excludes createdByUserId to prevent user impersonation
const SEGMENTOS = [
  { value: "ferreterias", label: "Ferreterías" },
  { value: "construccion", label: "Construcción" },
  { value: "digital", label: "Industrial" },
  { value: "marketing", label: "Marketing" },
] as const;

// Tipos de actividad (subtareas) dentro de un seguimiento de cliente
const ACTIVIDAD_TIPOS = [
  { value: "llamada", label: "Llamada", badge: "bg-blue-100 text-blue-700" },
  { value: "visita", label: "Visita", badge: "bg-orange-100 text-orange-700" },
  { value: "cotizacion", label: "Cotización", badge: "bg-orange-100 text-orange-700" },
  { value: "cobranza", label: "Cobranza", badge: "bg-amber-100 text-amber-700" },
  { value: "correo", label: "Correo", badge: "bg-cyan-100 text-cyan-700" },
  { value: "otro", label: "Otro", badge: "bg-slate-100 text-slate-600" },
] as const;

// Los filtros del panel (estado, prioridad, cliente, segmento) se persisten en
// sessionStorage para no perderlos al entrar al detalle de un cliente/tarea y
// volver. Es transitorio: se limpia al cerrar la pestaña, no queda guardado
// para siempre.
const FILTERS_STORAGE_KEY = "tareas-panel-filtros";

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
  // El rol marketing solo trabaja el segmento "marketing": sin pestañas de categoría.
  const isMarketing = user?.role === 'marketing';

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
    // Admin ve/asigna TODOS los segmentos; los demás roles solo el suyo (effectiveSegment).
    if (user?.role !== 'admin' && effectiveSegment) {
      const scoped = SEGMENTOS.filter((seg) => effectiveSegment.includes(seg.value));
      if (scoped.length > 0) return scoped;
    }
    return SEGMENTOS;
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

  // Estado para controlar la pestaña activa
  const [activeTab, setActiveTab] = useState("tareas");

  // Estado para vista de detalle de tarea
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Task Groups state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Vista de agrupación: por Equipo (persona asignada), por Grupos (proyecto) o
  // Terminadas (todas las tareas completadas juntas). Por defecto arranca en Equipo.
  const [taskView, setTaskView] = useState<'equipo' | 'grupos' | 'terminadas'>('equipo');
  const groupByEquipo = taskView === 'equipo';
  // En Seguimiento no existen las vistas Grupos/Terminadas: si quedaron seleccionadas
  // desde la pestaña Tareas, volver siempre a Equipo al entrar a Seguimiento.
  useEffect(() => {
    if (activeTab === 'seguimiento' && taskView !== 'equipo') {
      setTaskView('equipo');
    }
  }, [activeTab, taskView]);
  const groupsInitializedRef = useRef(false);
  const [teamSearchFilter, setTeamSearchFilter] = useState("");

  // Selección múltiple / eliminación masiva (solo administrador)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Burbuja/tutorial sobre para qué sirven los grupos (recordada por navegador)
  const [showGroupsTutorial, setShowGroupsTutorial] = useState<boolean>(() => {
    try { return localStorage.getItem('tareas_groups_tutorial_dismissed') !== '1'; } catch { return true; }
  });
  const dismissGroupsTutorial = () => {
    setShowGroupsTutorial(false);
    try { localStorage.setItem('tareas_groups_tutorial_dismissed', '1'); } catch {}
  };
  const reopenGroupsTutorial = () => {
    setShowGroupsTutorial(true);
    try { localStorage.removeItem('tareas_groups_tutorial_dismissed'); } catch {}
  };

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

  // Collapse all groups by default on first load
  useEffect(() => {
    const groups = taskGroupsQuery.data;
    if (groups && groups.length > 0 && !groupsInitializedRef.current) {
      groupsInitializedRef.current = true;
      setCollapsedGroups(new Set(groups.map((g: any) => g.id)));
    }
  }, [taskGroupsQuery.data]);

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
        if (!old || !Array.isArray(old)) return [{ id: `temp-${Date.now()}`, ...newGroup, userId: '', color: newGroup.color || 'blue', sortOrder: 0, createdAt: new Date() }];
        return [...old, { id: `temp-${Date.now()}`, ...newGroup, userId: '', color: newGroup.color || 'blue', sortOrder: 0, createdAt: new Date() }];
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
    // Si el usuario tiene segmento asignado directamente
    if ((user as any)?.assignedSegment?.toLowerCase()?.includes('construcc')) {
      return true;
    }
    // Si es supervisor, verificar los segmentos de sus vendedores
    if ((user?.role === 'supervisor' || user?.role === 'encargado_area') && supervisorSalespeople && supervisorSalespeople.length > 0) {
      return supervisorSalespeople.some(sp =>
        sp.assignedSegment?.toLowerCase()?.includes('construcc')
      );
    }
    return false;
  })();
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
    enabled: !!user,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
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

    // Cliente filter
    if (clienteFilter === "with-client" && !(task as any).clienteId) return false;
    if (clienteFilter === "without-client" && (task as any).clienteId) return false;

    // Segmento filter (skip for salesperson - they see all their tasks regardless of segment)
    if (!isSalesperson && segmentoFilter !== "all") {
      const matchesSegment = (task as any).segmento === segmentoFilter;
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
      } else if (!(task as any).segmento || !matchesSegment) {
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

  // Selected task for detail view
  const selectedTask = selectedTaskId ? filteredTasks.find(t => t.id === selectedTaskId) || tasksQuery.data?.find(t => t.id === selectedTaskId) || null : null;

  // Get unique clients from tasks for filter dropdown
  const clientesEnTareas = Array.from(new Set(
    (tasksQuery.data || [])
      .filter((t) => (t as any).clienteNombre)
      .map((t) => (t as any).clienteNombre)
  ));

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

  const handleSubmit = (data: CreateTaskWithAssignmentsInput) => {
    // En modo seguimiento marcamos la tarea con payload.kind para la vista por-cliente
    const payload = seguimientoMode ? { kind: 'seguimiento_cliente' } : undefined;
    createTaskMutation.mutate({ ...data, ...(payload ? { payload } : {}) } as any);
  };

  const canCreateTasks = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || user.role === 'tecnico_obra';
  // Solo admin/supervisor/encargado pueden enviar Solicitudes de Marketing (debe coincidir
  // con el allowlist del backend en POST /api/marketing/solicitudes). El técnico de obra
  // conserva 'Nueva Tarea' para Seguimiento/Otras, pero no ve la opción de Marketing.
  const canRequestMarketing = user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area';

  // KPIs presentacionales — reutilizan la misma lógica de completado que las tarjetas
  const isTaskDone = (t: typeof filteredTasks[number]) =>
    t.status === 'completada' || t.assignments.some((a) => a.status === 'completed');
  const kpiTotal = filteredTasks.length;
  const kpiCompletadas = filteredTasks.filter(isTaskDone).length;
  const kpiPendientes = kpiTotal - kpiCompletadas;
  const kpiVencidas = filteredTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && !isTaskDone(t)
  ).length;

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
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 space-y-6">
      {/* Header */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/25">
                <CheckSquare className="w-5 h-5" />
              </span>
              Panel de Trabajo
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tareas del equipo, estimaciones de ventas y seguimiento de clientes
            </p>
          </div>
          {canCreateTasks && (
            <>
            <Button onClick={() => {
              // Desde la pestaña Seguimiento, saltar el selector y abrir directo el flujo de cliente.
              if (activeTab === 'seguimiento') {
                setTaskFlow('seguimiento');
                setSelectedClienteTask(null);
                setSearchClienteTask("");
                form.reset({ title: "", description: "", priority: "medium", segmento: segmentoFilter !== 'all' ? segmentoFilter : null, groupId: null, dueDate: "", clienteId: null, clienteNombre: null, assignments: [] });
                setShowCreateDialog(true);
              } else {
                setShowChooser(true);
              }
            }} className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-orange-600 hover:from-orange-700 hover:to-orange-700 text-white shadow-md shadow-orange-500/25 transition-all" data-testid="button-create-task">
              <Plus className="h-4 w-4 mr-2" />
              {activeTab === 'seguimiento' ? 'Nuevo Seguimiento' : 'Nueva Tarea'}
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
                setShowCreateDialog(open);
                if (open && segmentoFilter && segmentoFilter !== 'all') {
                  form.setValue('segmento', segmentoFilter);
                }
              }}>
              <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-orange-950/40 dark:via-slate-900 dark:to-orange-950/30">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-2.5 shadow-md shadow-orange-500/25">
                      <Plus className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-foreground">Nueva Tarea</DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        Completa los detalles y asigna a miembros del equipo
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
                          Información de la tarea
                        </div>
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4 space-y-4">
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Título *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ej: Visita cliente zona sur" className="bg-white border-slate-200 focus:border-orange-400 focus:ring-orange-400/20" {...field} data-testid="input-task-title" />
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
                          Clasificación y plazo
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
                                      {(user.role === 'admin' ? SEGMENTOS : visibleSegmentos).map((seg) => (
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
                                  <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Límite</FormLabel>
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
                            Cliente Asociado (Opcional)
                          </Label>
                          {selectedClienteTask ? (
                            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl">
                              <div className="flex-1">
                                <p className="font-medium text-sm text-gray-800">{selectedClienteTask.nokoen}</p>
                                <p className="text-xs text-gray-500">Código: {selectedClienteTask.koen}</p>
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
                                <p className="text-xs text-gray-500 italic">No se encontraron clientes</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section: Equipo */}
                      <div className={`space-y-3 ${seguimientoMode ? 'order-1' : 'order-4'}`}>
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
                                            className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
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
                                            className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
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
                        className="bg-gradient-to-r from-orange-600 to-orange-600 hover:from-orange-700 hover:to-orange-700 text-white shadow-md shadow-orange-500/25 px-6 font-semibold transition-all"
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
            <Dialog open={showChooser} onOpenChange={setShowChooser}>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>¿Qué querés crear?</DialogTitle>
                  <DialogDescription>Elegí el tipo de trabajo para este segmento.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  {([
                    { flow: 'seguimiento', icon: <Building2 className="h-5 w-5" />, title: 'Seguimiento a clientes', desc: 'Tarea ligada a un cliente activo (responsable → cliente → detalle).' },
                    { flow: 'marketing', icon: <TrendingUp className="h-5 w-5" />, title: 'Solicitud de Marketing', desc: 'Pedido a Marketing con fecha sugerida; la encargada fija el plazo final.' },
                    { flow: 'otras', icon: <CheckSquare className="h-5 w-5" />, title: 'Otras tareas', desc: 'Tarea general del equipo (formulario estándar).' },
                  ] as const).filter((opt) => opt.flow !== 'marketing' || canRequestMarketing).map((opt) => (
                    <button
                      key={opt.flow}
                      onClick={() => {
                        setShowChooser(false);
                        setTaskFlow(opt.flow);
                        setSelectedClienteTask(null);
                        setSearchClienteTask("");
                        form.reset({ title: "", description: "", priority: "medium", segmento: segmentoFilter !== 'all' ? segmentoFilter : null, groupId: null, dueDate: "", clienteId: null, clienteNombre: null, assignments: [] });
                        if (opt.flow === 'marketing') setShowMarketingDialog(true);
                        else setShowCreateDialog(true);
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
              </DialogContent>
            </Dialog>

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
        <div className={`overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 ${isMarketing ? 'hidden' : ''}`}>
          <TabsList className={`inline-flex w-max sm:w-full sm:grid h-auto gap-1.5 bg-slate-100/70 dark:bg-slate-800/60 p-1.5 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl ${(user?.role === 'tecnico_obra' || isMarketing) ? 'sm:grid-cols-4' : 'sm:grid-cols-5'}`}>
            <TabsTrigger value="tareas" data-testid="tab-tareas" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm rounded-lg">
              <CheckSquare className="h-4 w-4 mr-2 hidden sm:inline" />
              Tareas
            </TabsTrigger>
            <TabsTrigger value="seguimiento" data-testid="tab-seguimiento" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm rounded-lg">
              <Building2 className="h-4 w-4 mr-2 hidden sm:inline" />
              Seguimiento
            </TabsTrigger>
            {user?.role !== 'tecnico_obra' && !isMarketing && (
              <TabsTrigger value="estimacion" data-testid="tab-estimacion" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm rounded-lg">
                <TrendingUp className="h-4 w-4 mr-2 hidden sm:inline" />
                {esConstruccion ? 'Estimación Mensual' : 'Estimación de ventas'}
              </TabsTrigger>
            )}
            <TabsTrigger value="rutas-comerciales" data-testid="tab-rutas-comerciales" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm rounded-lg">
              <MapPin className="h-4 w-4 mr-2 hidden sm:inline" />
              Rutas Comerciales
            </TabsTrigger>
            <TabsTrigger value="calendario" data-testid="tab-calendario" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm rounded-lg">
              <CalendarIcon className="h-4 w-4 mr-2 hidden sm:inline" />
              Calendario
            </TabsTrigger>
          </TabsList>
        </div>

        {(activeTab === 'tareas' || activeTab === 'seguimiento') && (
        <div className="space-y-6">

          {/* Segment Tabs - hidden for salesperson y cuando solo hay un segmento visible
              (marketing / supervisor con segmento único): no tiene sentido mostrar una sola pestaña */}
          {!isSalesperson && visibleSegmentos.length > 1 && (
            <div className={`flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0 ${visibleSegmentos.length > 1 ? 'sm:grid sm:grid-cols-4' : 'sm:flex'}`}>
              {visibleSegmentos.map((seg) => (
                <button
                  key={seg.value}
                  onClick={() => setSegmentoFilter(seg.value)}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${segmentoFilter === seg.value
                    ? "bg-gradient-to-r from-orange-600 to-orange-600 text-white shadow-md shadow-orange-500/25"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/40 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                    }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          )}

          {/* Filters and View Toggle - solo administrador (los demás roles ven el listado ya scopeado por su rol) */}
          {user.role === 'admin' && (
          <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/70 dark:from-slate-900 dark:to-slate-900/80 overflow-hidden">
            <CardContent className="p-0">
              {/* Mobile: Collapsible Filters Header */}
              <div className="lg:hidden">
                <button
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  data-testid="button-toggle-filters"
                >
                  <div className="flex items-center gap-3">
                    <Filter className="h-5 w-5 text-orange-600" />
                    <span className="font-semibold text-sm text-gray-900">Filtros</span>
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-xs font-medium">
                      {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform text-gray-600 ${filtersExpanded ? 'rotate-180' : ''}`} />
                </button>

                {filtersExpanded && (
                  <div className="p-4 pt-0 space-y-3 border-t border-gray-200">
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

                    {/* Cliente Filter */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Cliente:</Label>
                      <Select value={clienteFilter} onValueChange={setClienteFilter}>
                        <SelectTrigger className="h-9 text-sm" data-testid="select-cliente-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="with-client">Con Cliente</SelectItem>
                          <SelectItem value="without-client">Sin Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: Always Visible Filters - barra moderna tipo combobox */}
              <div className="hidden lg:block px-4 py-3">
                <div className="flex items-center gap-1.5 flex-wrap justify-between">
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {/* View Mode Toggle */}
                    {(user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || user.role === 'tecnico_obra') && (
                      <>
                        <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-white/70 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex-shrink-0">
                            <Eye className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col leading-none">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Vista</span>
                            <Select value={viewMode} onValueChange={(value: "my-tasks" | "all-tasks") => setViewMode(value)}>
                              <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-1.5 w-auto bg-transparent font-semibold text-[13px] text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-view-mode">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="my-tasks">Mis Tareas</SelectItem>
                                <SelectItem value="all-tasks">Todas las Tareas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="w-px h-9 bg-slate-200/80 dark:bg-slate-700" />
                      </>
                    )}

                    {/* Status Filter */}
                    <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-white/70 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex-shrink-0">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Estado</span>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-1.5 w-auto bg-transparent font-semibold text-[13px] text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-status-filter">
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
                    <div className="w-px h-9 bg-slate-200/80 dark:bg-slate-700" />

                    {/* Priority Filter */}
                    <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-white/70 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Prioridad</span>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                          <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-1.5 w-auto bg-transparent font-semibold text-[13px] text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-priority-filter">
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
                    <div className="w-px h-9 bg-slate-200/80 dark:bg-slate-700" />

                    {/* Cliente Filter */}
                    <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl hover:bg-white/70 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 flex-shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Cliente</span>
                        <Select value={clienteFilter} onValueChange={setClienteFilter}>
                          <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-1.5 w-auto bg-transparent font-semibold text-[13px] text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60" data-testid="select-cliente-filter-desktop">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="with-client">Con Cliente</SelectItem>
                            <SelectItem value="without-client">Sin Cliente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0 text-xs font-semibold px-3.5 py-1.5 shadow-sm shadow-orange-500/25 rounded-full">
                    {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Contador compacto para roles sin filtros (todos menos administrador) */}
          {user.role !== 'admin' && (
            <div className="flex items-center justify-between">
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-xs font-medium px-3 py-1">
                {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}

          {/* Group Management Bar */}
          {/* Group Management Bar - hidden for salesperson */}
          {!isSalesperson && segmentoFilter !== "all" && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Equipo / Grupos — segmented control (Equipo a la izquierda) */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 shadow-inner">
                <button
                  onClick={() => setTaskView('equipo')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${taskView === 'equipo' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Users className="h-3.5 w-3.5" /> Mi Equipo
                </button>
                {activeTab !== 'seguimiento' && (
                  <>
                    <button
                      onClick={() => setTaskView('grupos')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${taskView === 'grupos' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Grupos
                    </button>
                    <button
                      onClick={() => setTaskView('terminadas')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${taskView === 'terminadas' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Check className="h-3.5 w-3.5" /> Terminadas
                    </button>
                  </>
                )}
              </div>

              {/* Acciones a la derecha */}
              <div className="flex items-center gap-1.5 ml-auto">
                {!showCreateGroup ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateGroup(true)}
                      className="h-8 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/50 shadow-sm transition-all"
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
                      className="h-6 px-2.5 text-[10px] bg-orange-600 hover:bg-orange-700 font-semibold"
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
                      className="h-8 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Cancelar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setSelectionMode(true)}
                      className="h-8 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50/50 shadow-sm transition-all"
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
          {showGroupsTutorial && !isSalesperson && segmentoFilter !== "all" && (
            <div className="relative animate-in fade-in slide-in-from-top-1 duration-300">
              {/* Puntita que apunta al botón "Nuevo Grupo" */}
              <div className="absolute -top-1.5 left-7 w-3 h-3 rotate-45 rounded-[3px] bg-orange-600 dark:bg-orange-500" />
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 to-orange-600 text-white p-4 pr-10 shadow-lg shadow-orange-500/25">
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

          {/* Tasks List - Modern Grouped Layout */}
          <div className="space-y-6">
            {tasksQuery.isLoading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium text-sm">Cargando tareas...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-20">
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 blur-lg opacity-25" />
                  <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <CheckSquare className="h-9 w-9 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                  {activeTab === 'seguimiento' ? "No hay seguimientos" : "No hay tareas"}
                </h3>
                <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                  {activeTab === 'seguimiento'
                    ? "Aún no hay clientes en seguimiento."
                    : (viewMode === "my-tasks" ? "No tienes tareas asignadas." : "No se encontraron tareas.")}
                </p>
                {canCreateTasks && (
                  <Button
                    onClick={() => {
                      if (segmentoFilter && segmentoFilter !== 'all') {
                        form.setValue('segmento', segmentoFilter);
                      }
                      setShowCreateDialog(true);
                    }}
                    className="bg-gradient-to-r from-orange-600 to-orange-600 hover:from-orange-700 hover:to-orange-700 text-white shadow-md shadow-orange-500/25 transition-all"
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
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
                const lockedByGroup = !!(task as any).groupId && selectedGroupIds.has((task as any).groupId);
                const isTaskSelected = selectedTaskIds.has(task.id) || lockedByGroup;

                return (
                  <div
                    key={task.id}
                    className={`group flex items-start gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md ${
                      selectionMode && isTaskSelected
                        ? 'bg-red-50 border-red-300 ring-1 ring-red-300'
                        : isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200/60 opacity-60'
                        : isOverdue
                          ? 'bg-white border-red-200 hover:border-red-300'
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
                      {task.description && (
                        <p className={`text-xs leading-relaxed line-clamp-1 ${isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {task.dueDate && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                            isOverdue ? 'bg-red-100 text-red-700' : isCompleted ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(task.dueDate), "dd MMM", { locale: es })}
                          </span>
                        )}
                        {(task as any).clienteNombre && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Building2 className="h-3 w-3" />
                            {(task as any).clienteNombre}
                          </span>
                        )}
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

                    {/* Right badges - show on hover */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {getPriorityBadge(task.priority ?? 'medium')}
                      {getStatusBadge(task.status ?? 'pendiente')}
                    </div>
                  </div>
                );
              };

              const groupColors = ['#3b82f6', '#f59e0b', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#f97316'];

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

              // Vista EQUIPO: agrupar por persona asignada, filas compactas tipo lista (rediseño).
              // Los vendedores no gestionan equipo → siempre ven la vista por Grupos.
              if (groupByEquipo && !isSalesperson) {
                type PersonGroup = { name: string; role: 'supervisor' | 'salesperson'; tasks: typeof filteredTasks };
                // Un supervisor que se co-asigna junto al vendedor que realmente ejecuta no debería
                // inflar su propio conteo de "tareas" — esas van a un balde aparte de supervisión.
                const byPerson: Record<string, PersonGroup> = {};
                const supervising: Record<string, PersonGroup> = {};
                const addTo = (bucket: Record<string, PersonGroup>, id: string, name: string, role: PersonGroup['role'], task: typeof filteredTasks[number]) => {
                  if (!bucket[id]) bucket[id] = { name, role, tasks: [] };
                  bucket[id].tasks.push(task);
                };

                activeTasks.forEach((task) => {
                  if (task.assignments.length === 0) {
                    addTo(byPerson, '__none__', 'Sin asignar', 'salesperson', task);
                    return;
                  }
                  const salespeople = task.assignments.filter(a => a.assigneeType === 'salesperson');
                  const supervisors = task.assignments.filter(a => a.assigneeType === 'supervisor');
                  const hasOperational = salespeople.length > 0;

                  salespeople.forEach((a) => {
                    const name = availableUsers?.find((u) => u.id === a.assigneeId)?.salespersonName
                      || availableSupervisors?.find((s) => s.id === a.assigneeId)?.salespersonName
                      || a.assigneeId;
                    addTo(byPerson, a.assigneeId, name, 'salesperson', task);
                  });

                  supervisors.forEach((a) => {
                    const name = availableSupervisors?.find((s) => s.id === a.assigneeId)?.salespersonName
                      || availableUsers?.find((u) => u.id === a.assigneeId)?.salespersonName
                      || a.assigneeId;
                    // Sin vendedor en la misma tarea → es una tarea propia del supervisor (legítima).
                    // Con vendedor en la misma tarea → el supervisor solo acompaña, no cuenta como suya.
                    addTo(hasOperational ? supervising : byPerson, a.assigneeId, name, 'supervisor', task);
                  });
                });

                const people = Object.entries(byPerson).sort((a, b) => b[1].tasks.length - a[1].tasks.length);
                const supervisingList = Object.entries(supervising).sort((a, b) => b[1].tasks.length - a[1].tasks.length);
                if (people.length === 0 && supervisingList.length === 0) {
                  return <p className="text-center text-sm text-slate-400 py-10">No hay tareas asignadas.</p>;
                }

                // Card de miembro del equipo — foco en la persona y sus clientes asignados.
                const renderPersonRow = (id: string, grp: PersonGroup, muted = false) => {
                  const completed = grp.tasks.filter(isTaskDone).length;
                  const total = grp.tasks.length;
                  const pct = total > 0 ? (completed / total) * 100 : 0;
                  const isCollapsed = collapsedGroups.has(id);
                  const done = pct === 100;
                  const isSupervisor = grp.role === 'supervisor';
                  // Anillo de progreso (SVG) alrededor del avatar.
                  const R = 20, C = 2 * Math.PI * R;
                  return (
                    <div
                      key={id}
                      className={`rounded-2xl border bg-white overflow-hidden transition-all duration-200 ${
                        muted
                          ? 'border-dashed border-slate-200 bg-slate-50/40'
                          : `border-slate-200/80 shadow-sm hover:shadow-md ${!isCollapsed ? 'ring-1 ring-orange-100' : ''}`
                      }`}
                    >
                      <button
                        onClick={() => toggleGroupCollapsed(id)}
                        className="w-full flex items-center gap-3.5 px-3.5 sm:px-4 py-3.5 hover:bg-slate-50/70 transition-colors text-left"
                      >
                        {/* Avatar con anillo de progreso */}
                        <div className="relative flex-shrink-0 w-[52px] h-[52px]">
                          <svg className="absolute inset-0 -rotate-90" width="52" height="52" viewBox="0 0 52 52">
                            <circle cx="26" cy="26" r={R} fill="none" strokeWidth="3" className="stroke-slate-100" />
                            {total > 0 && (
                              <circle
                                cx="26" cy="26" r={R} fill="none" strokeWidth="3" strokeLinecap="round"
                                stroke={done ? '#10b981' : muted ? '#cbd5e1' : '#f97316'}
                                strokeDasharray={C}
                                strokeDashoffset={C - (pct / 100) * C}
                                className="transition-all duration-700"
                              />
                            )}
                          </svg>
                          <div className={`absolute inset-[6px] rounded-full flex items-center justify-center text-sm font-bold ${
                            muted ? 'bg-slate-100 text-slate-500'
                              : isSupervisor ? 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'
                              : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                          }`}>
                            {grp.name.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        {/* Nombre + rol + clientes */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-sm font-semibold truncate ${muted ? 'text-slate-500' : 'text-slate-800'}`}>{grp.name}</span>
                            {isSupervisor && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0">Supervisor</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-slate-400">
                            <Building2 className="h-3 w-3" />
                            {total === 0 ? 'Sin clientes asignados' : `${total} cliente${total !== 1 ? 's' : ''} asignado${total !== 1 ? 's' : ''}`}
                          </div>
                        </div>

                        {/* Métrica de avance */}
                        {total > 0 && (
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className={`text-[13px] font-bold tabular-nums ${done ? 'text-emerald-600' : 'text-slate-700'}`}>
                              {completed}<span className="text-slate-300 font-medium">/{total}</span>
                            </span>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: done ? '#10b981' : muted ? '#cbd5e1' : '#f97316' }}
                              />
                            </div>
                          </div>
                        )}

                        <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform duration-200 flex-shrink-0 ${!isCollapsed ? 'rotate-90' : ''}`} />
                      </button>
                      {!isCollapsed && (
                        <div className="px-1.5 sm:px-2.5 pb-2.5 pt-0.5 space-y-1 sm:space-y-1.5 border-t border-slate-100/80 bg-slate-50/30">
                          {grp.tasks.map(renderTaskCard)}
                        </div>
                      )}
                    </div>
                  );
                };

                // Métricas de equipo (solo miembros operativos).
                const teamTotal = people.reduce((s, [, g]) => s + g.tasks.length, 0);
                const teamDone = people.reduce((s, [, g]) => s + g.tasks.filter(isTaskDone).length, 0);
                const teamPct = teamTotal > 0 ? Math.round((teamDone / teamTotal) * 100) : 0;

                return (
                  <>
                    {people.length > 0 && (
                      <>
                        {/* Resumen del equipo */}
                        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
                          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              <Users className="h-3 w-3" /> Equipo
                            </div>
                            <div className="text-2xl font-bold text-slate-800 leading-none">{people.length}</div>
                            <div className="text-[11px] text-slate-400 mt-1">persona{people.length !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              <Building2 className="h-3 w-3" /> Clientes
                            </div>
                            <div className="text-2xl font-bold text-slate-800 leading-none">{teamTotal}</div>
                            <div className="text-[11px] text-slate-400 mt-1">asignado{teamTotal !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              <Check className="h-3 w-3" /> Avance
                            </div>
                            <div className={`text-2xl font-bold leading-none ${teamPct === 100 ? 'text-emerald-600' : 'text-orange-600'}`}>{teamPct}%</div>
                            <div className="text-[11px] text-slate-400 mt-1">{teamDone}/{teamTotal} listo{teamDone !== 1 ? 's' : ''}</div>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {people.map(([id, grp]) => renderPersonRow(id, grp))}
                        </div>
                      </>
                    )}
                  </>
                );
              }

              return (
                <>
                  {/* Grouped Tasks - sorted by most pending first */}
                  {[...groups].sort((a, b) => {
                    const aTasks = groupedTasks[a.id] || [];
                    const bTasks = groupedTasks[b.id] || [];
                    const aPending = aTasks.filter(t => t.status !== 'completada' && !t.assignments.some(as => as.status === 'completed')).length;
                    const bPending = bTasks.filter(t => t.status !== 'completada' && !t.assignments.some(as => as.status === 'completed')).length;
                    return bPending - aPending;
                  }).map((group, groupIndex) => {
                    const tasks = groupedTasks[group.id] || [];
                    const completedCount = tasks.filter(t => {
                      if (t.status === 'completada') return true;
                      // Also check assignment-level completion (same logic as renderTaskCard)
                      const myAssign = t.assignments.find(a =>
                        (a.assigneeType === "supervisor" && a.assigneeId === user.id) ||
                        (a.assigneeType === "salesperson" && a.assigneeId === user.id) ||
                        (a.assigneeType === "user" && a.assigneeId === user.id)
                      );
                      const targetAssign = myAssign || (
                        (user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area')) ? t.assignments[0] : null
                      );
                      return targetAssign?.status === 'completed';
                    }).length;
                    const totalCount = tasks.length;
                    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                    const borderColor = group.color || groupColors[groupIndex % groupColors.length];
                    const isCollapsed = collapsedGroups.has(group.id);
                    const isGroupSelected = selectedGroupIds.has(group.id);

                    return (
                      <div
                        key={group.id}
                        className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                          selectionMode && isGroupSelected ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-200'
                        }`}
                        style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
                      >
                        {/* Group Header */}
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
                              className="p-1.5 rounded-lg text-white bg-orange-600 hover:bg-orange-700 transition-all flex-shrink-0 disabled:opacity-50"
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
                          className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-3 sm:py-3.5 hover:bg-slate-50/80 transition-colors group/header"
                        >
                          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}`} />
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: borderColor }}
                          />
                          <span className="text-sm font-bold text-slate-800 tracking-wide">{group.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-slate-100 text-slate-600 font-semibold">
                            {totalCount}
                          </Badge>

                          {/* Progress indicator */}
                          {totalCount > 0 && (
                            <div className="flex items-center gap-2 ml-auto mr-2">
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor: progressPercent === 100 ? '#10b981' : borderColor,
                                  }}
                                />
                              </div>
                              <span className={`text-[10px] font-semibold whitespace-nowrap ${progressPercent === 100 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {completedCount}/{totalCount}
                              </span>
                            </div>
                          )}

                          {/* Editar / eliminar grupo: solo el dueño del grupo o un administrador */}
                          {!selectionMode && (user.role === 'admin' || group.userId === user.id) && (
                            <div className={`flex items-center flex-shrink-0 ${totalCount > 0 ? '' : 'ml-auto'}`}>
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
                        </button>
                        )}
                        </div>

                        {/* Task List */}
                        {!isCollapsed && (
                          <div className="border-t border-slate-100 bg-slate-50/30">
                            {tasks.length > 0 ? (
                              <div className="px-1.5 sm:px-3 py-1.5 sm:py-2 space-y-1 sm:space-y-1.5">
                                {tasks.map(renderTaskCard)}
                              </div>
                            ) : (
                              <div className="px-5 py-4 text-center">
                                <p className="text-xs text-slate-400 italic">Sin tareas en este grupo</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Ungrouped Tasks */}
                  {ungrouped.length > 0 && (
                    <div className="space-y-1.5">
                      {groups.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 mt-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0" />
                          <span className="text-sm font-bold text-slate-500 tracking-wide">Sin grupo</span>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-slate-100 text-slate-500 font-semibold">
                            {ungrouped.length}
                          </Badge>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {ungrouped.map(renderTaskCard)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Barra flotante de acción para eliminación masiva - solo administrador */}
          {selectionMode && user.role === 'admin' && (() => {
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
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-2.5 border border-slate-700">
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
            tasks={filteredTasks}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            onTaskClick={(taskId) => {
              const task = filteredTasks.find(t => t.id === taskId);
              if (task) {
                setExpandedTasks(new Set([taskId]));
                setActiveTab((task as any).payload?.kind === 'seguimiento_cliente' ? "seguimiento" : "tareas");
              }
            }}
            salespeople={availableUsers}
            supervisors={availableSupervisors}
          />
        </TabsContent>

        {/* Técnico de Obra no tiene acceso a promesas de compra */}
        {user?.role !== 'tecnico_obra' && (
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
            />
          </TabsContent>
        )}

        {/* Rutas Comerciales — el supervisor crea rutas y asigna clientes; el vendedor ve las suyas */}
        <TabsContent value="rutas-comerciales" className="space-y-6">
          <RutasComercialesContent />
        </TabsContent>

      </Tabs>
    </div>
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
}) {
  // Estados locales para edición de promesas
  const [editPromesaDialogOpen, setEditPromesaDialogOpen] = useState(false);
  const [selectedPromesa, setSelectedPromesa] = useState<PromesaCumplimiento | null>(null);
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");

  // Query para obtener lista de vendedores (para filtro)
  const { data: salespeople = [] } = useQuery<Array<{ id: string; fullName: string; salespersonName: string }>>({
    queryKey: ['/api/users/salespeople'],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
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
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{esConstruccion ? 'Estimación Mensual' : 'Estimación Semanal'}</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-0.5 sm:mt-1">
            Registra compromisos de compra y compara con ventas reales
          </p>
        </div>
        <Button onClick={() => setCreatePromesaDialogOpen(true)} data-testid="button-nueva-promesa" size="sm" className="sm:h-10">
          <Plus className="mr-1 sm:mr-2 h-4 w-4" />
          Nueva Promesa
        </Button>
      </div>

      {/* Selector de período */}
      <Card>
        <CardHeader className="py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">{esConstruccion ? 'Selección de Mes' : 'Selección de Semana'}</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                {getPeriodLabel()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-periodo-anterior" className="h-8 w-8 p-0 sm:h-9 sm:w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} data-testid="button-periodo-actual" className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm">
                {esConstruccion ? 'Mes Actual' : 'Hoy'}
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-periodo-siguiente" className="h-8 w-8 p-0 sm:h-9 sm:w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen de cumplimiento Premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="relative overflow-hidden border-none shadow-lg group hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-orange-700 opacity-95 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp className="w-16 h-16 text-white" />
          </div>
          <CardContent className="relative p-6">
            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Prometido
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              ${resumen.totalPrometido.toLocaleString('es-CL')}
            </h3>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-none text-[10px] font-bold">
                {resumen.totalPromesas} PROMESAS
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg group hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-orange-700 opacity-95 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Building2 className="w-16 h-16 text-white" />
          </div>
          <CardContent className="relative p-6">
            <p className="text-orange-100 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Total Vendido
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              ${resumen.totalVendido.toLocaleString('es-CL')}
            </h3>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-none text-[10px] font-bold">
                FACTURAS + NVV
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg group hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-95 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
          <CardContent className="relative p-6">
            <p className="text-emerald-500 border border-white/20 px-2 py-0.5 rounded bg-white text-[10px] font-black uppercase tracking-wider mb-2 w-fit">
              Cumplidas
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              {resumen.cumplidas + resumen.superadas + resumen.cumplidasParcialmente}
            </h3>
            <p className="text-emerald-100 text-[10px] sm:text-xs font-medium">
              {resumen.superadas} superadas, {resumen.cumplidasParcialmente} parcial
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg group hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-600 opacity-95 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <AlertCircle className="w-16 h-16 text-white" />
          </div>
          <CardContent className="relative p-6">
            <p className="text-orange-500 border border-white/20 px-2 py-0.5 rounded bg-white text-[10px] font-black uppercase tracking-wider mb-2 w-fit">
              Incumplidas
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              {resumen.insuficientes + resumen.noCumplidas}
            </h3>
            <p className="text-orange-100 text-[10px] sm:text-xs font-medium">
              {resumen.insuficientes} insuficientes, {resumen.noCumplidas} sin ventas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de promesas con cumplimiento */}
      <Card>
        <CardHeader className="py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg">Detalle de Promesas</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">Comparación de compromisos vs. ventas reales</CardDescription>
            </div>
            {/* Filtro por vendedor (solo para admin/supervisor) */}
            {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && salespeople.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label className="text-xs sm:text-sm whitespace-nowrap">Vendedor:</Label>
                <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                  <SelectTrigger className="w-full sm:w-[200px] h-8 sm:h-10 text-xs sm:text-sm" data-testid="select-filtro-vendedor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {salespeople.map((salesperson) => (
                      <SelectItem key={salesperson.id} value={salesperson.id}>
                        {salesperson.fullName || salesperson.salespersonName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPromesas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : promesasCumplimiento.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay promesas registradas para esta semana</p>
            </div>
          ) : promesasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay promesas para el vendedor seleccionado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop view */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                        <th className="text-left py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendedor</th>
                      )}
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Prometido</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendido</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cumplimiento</th>
                      <th className="text-center py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {promesasFiltradas.map((item) => (
                      <tr
                        key={item.promesa.id}
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                        data-testid={`row-promesa-${item.promesa.id}`}
                        onClick={() => {
                          setSelectedPromesa(item);
                          setEditPromesaDialogOpen(true);
                        }}
                      >
                        {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                          <td className="py-3 px-4 text-sm">{getVendedorNombre(item.promesa.vendedorId)}</td>
                        )}
                        <td className="py-3 px-4 font-medium">{item.promesa.clienteNombre}</td>
                        <td className="text-right py-3 px-4">${parseFloat(item.promesa.montoPrometido).toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4">${item.ventasReales.toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className={item.cumplimiento >= 100 ? 'text-green-600 font-semibold' : item.cumplimiento >= 80 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {item.cumplimiento.toFixed(1)}%
                            </span>
                            {item.cumplimiento >= 100 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          {item.estado === 'superado' && (
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Superado
                            </Badge>
                          )}
                          {item.estado === 'cumplido' && (
                            <Badge className="bg-blue-500 text-white">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Cumplido
                            </Badge>
                          )}
                          {item.estado === 'cumplido_parcialmente' && (
                            <Badge className="bg-yellow-500 text-white">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Cumplido Parcialmente
                            </Badge>
                          )}
                          {item.estado === 'insuficiente' && (
                            <Badge className="bg-orange-500 text-white">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Insuficiente
                            </Badge>
                          )}
                          {item.estado === 'no_cumplido' && (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              No Cumplido
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{item.promesa.observaciones || '-'}</td>
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
                    className="cursor-pointer hover:shadow-md transition-shadow"
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
                            <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                              Superado
                            </Badge>
                          )}
                          {item.estado === 'cumplido' && (
                            <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                              Cumplido
                            </Badge>
                          )}
                          {item.estado === 'cumplido_parcialmente' && (
                            <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                              Parcial
                            </Badge>
                          )}
                          {item.estado === 'insuficiente' && (
                            <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                              Insufic.
                            </Badge>
                          )}
                          {item.estado === 'no_cumplido' && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 whitespace-nowrap">
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
                              <span className={`text-sm font-semibold ${item.cumplimiento >= 100 ? 'text-green-600' : item.cumplimiento >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {item.cumplimiento.toFixed(0)}%
                              </span>
                              {item.cumplimiento >= 100 ? (
                                <TrendingUp className="h-3 w-3 text-green-600" />
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
              className="sm:w-auto"
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
              className="sm:w-auto"
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

  // Reset form when promesa changes
  useEffect(() => {
    setVentasRealesManual(promesa.promesa.ventasRealesManual ? parseFloat(promesa.promesa.ventasRealesManual as any).toString() : "");
    setObservaciones(promesa.promesa.observaciones || "");
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

  const handleSubmit = () => {
    // Solo admin y supervisor pueden editar
    if (!['admin', 'supervisor', 'encargado_area'].includes(user?.role || '')) {
      toast({
        title: "No autorizado",
        description: "Solo administradores y supervisores pueden editar promesas",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      ventasRealesManual: ventasRealesManual ? parseFloat(ventasRealesManual) : null,
      observaciones: observaciones || null,
    });
  };

  const canEdit = ['admin', 'supervisor', 'encargado_area'].includes(user?.role || '');

  // Calcular cumplimiento y estado con los datos actuales del formulario
  const montoPrometido = parseFloat(promesa.promesa.montoPrometido);
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
            {canEdit ? 'Puede actualizar las ventas reales y observaciones' : 'Vista de solo lectura'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 px-1">
          {/* Información del Cliente */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Información del Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-blue-700 dark:text-blue-300">Cliente</Label>
                <p className="font-medium text-blue-900 dark:text-blue-100">{promesa.promesa.clienteNombre}</p>
              </div>
              <div>
                <Label className="text-sm text-blue-700 dark:text-blue-300">Tipo</Label>
                <p className="font-medium text-blue-900 dark:text-blue-100 capitalize">{promesa.promesa.clienteTipo || 'activo'}</p>
              </div>
              <div>
                <Label className="text-sm text-blue-700 dark:text-blue-300">Semana</Label>
                <p className="font-medium text-blue-900 dark:text-blue-100">Semana {promesa.promesa.numeroSemana} del {promesa.promesa.anio}</p>
              </div>
              <div>
                <Label className="text-sm text-blue-700 dark:text-blue-300">Periodo</Label>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {format(new Date(promesa.promesa.fechaInicio), 'dd MMM', { locale: es })} - {format(new Date(promesa.promesa.fechaFin), 'dd MMM', { locale: es })}
                </p>
              </div>
            </div>
          </div>

          {/* Monto Prometido */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Monto Prometido</Label>
            <div className="p-3 border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-2xl font-bold">${montoPrometido.toLocaleString('es-CL')}</p>
            </div>
          </div>

          {/* Ventas Reales */}
          <div>
            <Label htmlFor="ventasReales" className="text-sm font-semibold mb-2 block">
              Ventas Reales {canEdit && '*'}
            </Label>
            {canEdit ? (
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
              <div className="p-3 border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-2xl font-bold">${ventasActuales.toLocaleString('es-CL')}</p>
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
              <div className="flex items-center gap-3 p-3 border-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                <span className={`text-3xl font-bold ${cumplimientoActual >= 100 ? 'text-green-600' : cumplimientoActual >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {cumplimientoActual.toFixed(1)}%
                </span>
                {cumplimientoActual >= 100 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Estado</Label>
              <div className="p-3 border-2 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                {estadoActual === 'superado' && (
                  <Badge className="bg-green-500 text-white text-base px-4 py-2">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Superado
                  </Badge>
                )}
                {estadoActual === 'cumplido' && (
                  <Badge className="bg-blue-500 text-white text-base px-4 py-2">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Cumplido
                  </Badge>
                )}
                {estadoActual === 'cumplido_parcialmente' && (
                  <Badge className="bg-yellow-500 text-white text-base px-4 py-2">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Cumplido Parcialmente
                  </Badge>
                )}
                {estadoActual === 'insuficiente' && (
                  <Badge className="bg-orange-500 text-white text-base px-4 py-2">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Insuficiente
                  </Badge>
                )}
                {estadoActual === 'no_cumplido' && (
                  <Badge variant="destructive" className="text-base px-4 py-2">
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
            {canEdit ? (
              <Textarea
                id="observaciones-edit"
                placeholder="Notas adicionales (opcional)"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="min-h-20 resize-none"
                data-testid="textarea-observaciones-edit"
              />
            ) : (
              <div className="p-3 border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg min-h-20">
                <p className="text-sm">{observaciones || 'Sin observaciones'}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-3">
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between w-full">
            {/* Botón de eliminar a la izquierda (solo para admin/supervisor) */}
            {canEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="sm:w-auto"
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
                className="sm:w-auto"
                data-testid="button-cerrar"
              >
                {canEdit ? 'Cancelar' : 'Cerrar'}
              </Button>
              {canEdit && (
                <Button
                  onClick={handleSubmit}
                  disabled={updateMutation.isPending}
                  className="sm:w-auto"
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
}: TaskDetailDialogProps) {
  const { toast } = useToast();
  const [chatText, setChatText] = useState("");
  const [activeAssignmentChat, setActiveAssignmentChat] = useState<string>(
    task.assignments[0]?.id || ""
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>((task as any).groupId || "__none__");
  const [selectedSegmento, setSelectedSegmento] = useState<string>((task as any).segmento || "__none__");

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
  const canUpdateStatus = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area');
  const isCompleted = task.status === 'completada';
  // Un seguimiento de cliente es un espacio de trabajo (no una tarea que se completa):
  // muestra progreso de sus actividades en vez de "Marcar completada".
  const isSeguimientoCliente = (task as any).payload?.kind === 'seguimiento_cliente';
  // El seguimiento de cliente es un espacio de trabajo del vendedor asignado: aunque no sea
  // el creador de la tarea (solo admin/supervisor las crean), el vendedor asignado debe poder
  // registrar sus actividades y visitas/rutas. Por eso, para el panel de actividades habilitamos
  // también a quien tenga la tarea asignada, no solo a quien la creó (canEditTask).
  const isAssignedToMe = ((task as any).assignments || []).some((a: any) => a.assigneeId === user.id);
  const canManageSeguimiento = canEditTask || (isSeguimientoCliente && isAssignedToMe);
  const { data: actividades = [] } = useQuery<Array<{ id: string; tipo: string; descripcion: string | null; fecha: string | null; estado: string; responsableNombre: string | null }>>({
    queryKey: ['/api/tasks', task.id, 'actividades'],
    enabled: isSeguimientoCliente,
  });
  const actividadesTotal = actividades.length;
  const actividadesCompletadas = actividades.filter((a) => a.estado === 'completada').length;

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-1rem)]">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button onClick={onClose} className="mt-0.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex-shrink-0" title="Volver al listado">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className={`rounded-xl p-2.5 shadow-sm flex-shrink-0 ${
                isCompleted ? 'bg-emerald-600' :
                task.priority === 'high' ? 'bg-red-600' :
                'bg-gradient-to-br from-orange-500 to-orange-600'
              }`}>
                <CheckSquare className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">
                  {task.title}
                </h2>
                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>Creada {task.createdAt && format(new Date(task.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                  {(task as any).segmento && (
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-0 text-xs">
                      {SEGMENTOS.find(s => s.value === (task as any).segmento)?.label || (task as any).segmento}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isSeguimientoCliente ? (
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
          <HeaderMeta task={task} isSeguimiento={isSeguimientoCliente} />
        </div>

        {/* Layout: chat fijo (izq) + área principal con pestañas Detalle/info (der) */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Panel: Chat / Bitácora (permanente) */}
          <div className="lg:w-[400px] lg:flex-shrink-0 flex flex-col min-h-0 border-r border-slate-200 bg-slate-50/40">
            <div className="px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-orange-600" /> Bitácora / Chat
              </h4>
              {task.assignments.length > 1 && (
                <Select value={activeAssignmentChat} onValueChange={setActiveAssignmentChat}>
                  <SelectTrigger className="w-auto max-w-[150px] h-8 text-xs border-slate-200"><SelectValue placeholder="Asignación" /></SelectTrigger>
                  <SelectContent>
                    {task.assignments.map((a) => (<SelectItem key={a.id} value={a.id} className="text-xs">{getAssigneeName(a)}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {activeAssignmentChat && (
                <DetailChatPanel
                  taskId={task.id}
                  assignmentId={activeAssignmentChat}
                  assigneeName={getAssigneeName(task.assignments.find(a => a.id === activeAssignmentChat) || task.assignments[0])}
                  userRole={user.role}
                />
              )}
            </div>
            <DetailChatInput taskId={task.id} assignmentId={activeAssignmentChat} />
          </div>

          {/* Right Panel: pestañas (Detalle + info del cliente) */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            <Tabs defaultValue="detalle" className="flex-1 flex flex-col min-h-0">
              <div className="px-4 pt-3 pb-2 border-b border-slate-200 bg-white flex-shrink-0 overflow-x-auto">
                <TabsList className="bg-slate-100/80 h-9 p-1">
                  <TabsTrigger value="detalle" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
                    <Edit className="h-3.5 w-3.5 mr-1" /> Detalle
                  </TabsTrigger>
                  {isSeguimientoCliente && (
                    <TabsTrigger value="tareas" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600">
                      <CheckSquare className="h-3.5 w-3.5 mr-1" /> Tareas{actividadesTotal > 0 ? ` ${actividadesCompletadas}/${actividadesTotal}` : ''}
                    </TabsTrigger>
                  )}
                  {(task as any).clienteId && (
                    <>
                      <TabsTrigger value="cobranza" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><DollarSign className="h-3.5 w-3.5 mr-1" /> Cobranza</TabsTrigger>
                      <TabsTrigger value="productos" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><Package className="h-3.5 w-3.5 mr-1" /> Productos</TabsTrigger>
                      <TabsTrigger value="rutas" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><MapPin className="h-3.5 w-3.5 mr-1" /> Rutas</TabsTrigger>
                      <TabsTrigger value="marketing" className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-orange-600"><Palette className="h-3.5 w-3.5 mr-1" /> Marketing</TabsTrigger>
                    </>
                  )}
                </TabsList>
              </div>
              <div className="relative flex-1 min-h-0">
                {/* Detalle: descripción, enlaces, asignaciones, eliminar */}
                <TabsContent value="detalle" className="absolute inset-0 overflow-y-auto p-5 space-y-6 mt-0 data-[state=inactive]:hidden">
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
                        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm"
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
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center flex-shrink-0">
                          <Link2 className="h-4 w-4 text-orange-600" />
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
                        className="h-8 w-8 p-0 bg-orange-600 hover:bg-orange-700 text-white shadow-sm flex-shrink-0"
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
                      Eliminar Tarea
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminarán todas las asignaciones y comentarios asociados.
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
                {isSeguimientoCliente && (
                  <TabsContent value="tareas" className="absolute inset-0 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden">
                    <ActividadesPanel taskId={task.id} canManage={canManageSeguimiento} clienteId={String((task as any).clienteId || "")} clienteNombre={String((task as any).clienteNombre || "")} />
                  </TabsContent>
                )}

                {/* Info del cliente — cada pestaña usa toda el área */}
                {(task as any).clienteId && (
                  <>
                    <TabsContent value="cobranza" className="absolute inset-0 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden"><CobranzaPanel clienteNombre={String((task as any).clienteNombre || "")} /></TabsContent>
                    <TabsContent value="productos" className="absolute inset-0 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden"><ProductosPanel clienteNombre={String((task as any).clienteNombre || "")} /></TabsContent>
                    <TabsContent value="rutas" className="absolute inset-0 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden"><RutasClientePanel clienteId={String((task as any).clienteId || "")} clienteNombre={String((task as any).clienteNombre || "")} taskId={task.id} canManage={user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area' || (isSeguimientoCliente && isAssignedToMe)} /></TabsContent>
                    <TabsContent value="marketing" className="absolute inset-0 overflow-y-auto p-5 mt-0 data-[state=inactive]:hidden"><MarketingClientePanel clienteNombre={String((task as any).clienteNombre || "")} canManage={user.role === 'admin' || user.role === 'supervisor' || user.role === 'encargado_area'} /></TabsContent>
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
function DetailChatPanel({ taskId, assignmentId, assigneeName, userRole }: { taskId: string; assignmentId: string; assigneeName: string; userRole: string }) {
  const { toast } = useToast();
  const { data: comments = [], isLoading } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', taskId, 'assignments', assignmentId, 'comments'],
    refetchInterval: 3000,
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest('DELETE', `/api/tasks/${taskId}/assignments/${assignmentId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/tasks', taskId, 'assignments', assignmentId, 'comments'] });
      toast({ title: "Comentario eliminado" });
    },
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <MessageSquare className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Sin comentarios aún</p>
        <p className="text-xs text-slate-400 mt-1">Escribe el primer mensaje para {assigneeName}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="group bg-white rounded-xl p-3.5 border border-slate-200 hover:border-orange-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {comment.authorName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-xs font-semibold text-slate-800 truncate">{comment.authorName}</span>
            <span className="text-[10px] text-slate-400 flex-shrink-0">
              {comment.createdAt && format(new Date(comment.createdAt), "dd MMM, HH:mm", { locale: es })}
            </span>
            <div className="flex-1" />
            {userRole === 'admin' && (
              <button
                onClick={() => deleteCommentMutation.mutate(comment.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                title="Eliminar comentario"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-sm text-slate-700 pl-8 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
}

// ==================================================================================
// DetailChatInput - Input de chat para el panel de detalle
// ==================================================================================
function DetailChatInput({ taskId, assignmentId }: { taskId: string; assignmentId: string }) {
  const { toast } = useToast();
  const [text, setText] = useState("");

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
      setText("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    }
  });

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
    <div className="px-4 py-3 border-t border-slate-200 bg-white flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          className="flex-1 min-h-[40px] max-h-[120px] text-sm resize-none border-slate-200 focus:border-orange-400 focus:ring-orange-400/20 rounded-xl"
          rows={1}
          data-testid="chat-input-detail"
        />
        <Button
          type="submit"
          size="sm"
          className="h-10 w-10 p-0 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md"
          disabled={addCommentMutation.isPending || !text.trim()}
          data-testid="button-send-chat"
        >
          {addCommentMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
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

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest(`/api/tasks/${taskId}/assignments/${assignmentId}/comments/${commentId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/tasks', taskId, 'assignments', assignmentId, 'comments'] });
      toast({
        title: "Comentario eliminado",
        description: "El comentario ha sido eliminado",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el comentario",
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
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
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
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                      data-testid={`button-delete-comment-${comment.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
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
              className="h-8 px-4 bg-gradient-to-r from-blue-500 to-orange-600 hover:from-blue-600 hover:to-orange-700 text-white font-medium rounded-full"
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
  onTaskClick,
  salespeople,
  supervisors,
}: {
  tasks: Array<Task & { assignments: TaskAssignment[] }>;
  calendarMonth: Date;
  setCalendarMonth: (date: Date) => void;
  onTaskClick: (taskId: string) => void;
  salespeople: Array<{ id: string; salespersonName: string; role: string }> | undefined;
  supervisors: Array<{ id: string; salespersonName: string; role: string }> | undefined;
}) {
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);

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
                    <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm font-medium rounded-full ${isTodayDate ? 'bg-orange-600 text-white' : ''
                      }`}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Tareas del día */}
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
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
                      <div className="text-[10px] sm:text-xs text-gray-500 font-medium px-1.5">
                        +{dayTasks.length - 3} más
                      </div>
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
          <TabsContent value="cobranza" className="mt-0"><CobranzaPanel clienteNombre={clienteNombre} /></TabsContent>
          <TabsContent value="productos" className="mt-0"><ProductosPanel clienteNombre={clienteNombre} /></TabsContent>
          <TabsContent value="rutas" className="mt-0"><RutasClientePanel clienteId={clienteId} clienteNombre={clienteNombre} canManage={canManage} taskId={task.id} /></TabsContent>
          <TabsContent value="marketing" className="mt-0"><MarketingClientePanel clienteNombre={clienteNombre} canManage={canManage} /></TabsContent>
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

  const val = (v: any) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
  const num = (v: any) => (v === null || v === undefined || String(v).trim() === "" || isNaN(Number(v)) ? null : Number(v));

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

  const crlt = num(client?.crlt); // límite de crédito
  const cren = num(client?.cren); // crédito disponible
  const crsd = num(client?.crsd); // deuda / saldo
  const hasCredito = crlt !== null || cren !== null || crsd !== null;
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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-orange-600" />
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
              <p className="text-xs font-bold text-slate-800">{crlt !== null ? fmtCLP(crlt) : "—"}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2">
              <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Disponible</p>
              <p className="text-xs font-bold text-emerald-700">{cren !== null ? fmtCLP(cren) : "—"}</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 p-2">
              <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider">Deuda</p>
              <p className="text-xs font-bold text-red-700">{crsd !== null ? fmtCLP(crsd) : "—"}</p>
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

function CobranzaPanel({ clienteNombre }: { clienteNombre: string }) {
  const { data, isLoading } = useQuery<{ docs: Array<{ nudo: string; tido: string; vencimiento: string | null; saldo: number; vencida: boolean }> }>({
    queryKey: ["/api/clients/cartera", { name: clienteNombre }],
    enabled: !!clienteNombre,
  });
  const docs = data?.docs || [];
  const totalSaldo = docs.reduce((s, d) => s + (Number(d.saldo) || 0), 0);
  const totalVencido = docs.filter((d) => d.vencida).reduce((s, d) => s + (Number(d.saldo) || 0), 0);
  if (isLoading) return <p className="text-xs text-slate-400">Cargando cobranza…</p>;
  if (docs.length === 0) return <p className="text-xs text-slate-400 italic">Sin documentos pendientes.</p>;
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Saldo total</p>
          <p className="text-sm font-bold text-slate-800">{fmtCLP(totalSaldo)}</p>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
          <p className="text-[10px] text-red-500 uppercase font-bold tracking-wider">Vencido</p>
          <p className="text-sm font-bold text-red-700">{fmtCLP(totalVencido)}</p>
        </div>
      </div>
      <div className="space-y-1">
        {docs.map((d, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border ${d.vencida ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`}>
            <span className="font-medium text-slate-700 flex-shrink-0">{d.tido} {d.nudo}</span>
            <span className="text-slate-400 flex-1 text-center">{d.vencimiento || "—"}</span>
            <span className={`font-semibold flex-shrink-0 ${d.vencida ? "text-red-600" : "text-slate-700"}`}>{fmtCLP(Number(d.saldo))}</span>
          </div>
        ))}
      </div>
    </div>
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
  const [selRuta, setSelRuta] = useState("");
  const [completing, setCompleting] = useState<{ id: string; nombre: string } | null>(null);
  const [visitaRuta, setVisitaRuta] = useState("");
  const [visitaFecha, setVisitaFecha] = useState("");
  const [visitaNota, setVisitaNota] = useState("");

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
  const registrarVisita = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/rutas/${visitaRuta}/visitas`, { clienteId, clienteNombre, fecha: visitaFecha, nota: visitaNota.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/visitas/by-cliente", clienteId] });
      setVisitaFecha(""); setVisitaNota("");
      toast({ title: "Visita registrada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo registrar la visita.", variant: "destructive" }),
  });
  // Eliminar la ruta por completo (borra la ruta, sus clientes asignados y su histórico de visitas).
  const eliminarRutaMut = useMutation({
    mutationFn: async (rutaId: string) => apiRequest("DELETE", `/api/rutas/${rutaId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rutas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/visitas/by-cliente", clienteId] });
      toast({ title: "Ruta eliminada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo eliminar la ruta.", variant: "destructive" }),
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
                {canManage && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-slate-300 hover:text-red-500 flex-shrink-0" title="Eliminar ruta">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar la ruta "{r.nombre}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará la ruta junto con su histórico de visitas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => eliminarRutaMut.mutate(r.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Eliminar
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
            <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-700 text-xs" disabled={!selRuta || assign.isPending} onClick={() => assign.mutate()}>
              {assign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Asignar"}
            </Button>
          </div>
        )}
      </div>

      {/* Registrar visita (queda en el histórico) */}
      {canManage && rutasCliente.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> Registrar visita</h4>
          <div className="grid grid-cols-2 gap-2">
            <Select value={visitaRuta} onValueChange={setVisitaRuta}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ruta" /></SelectTrigger>
              <SelectContent>
                {rutasCliente.map((r) => (<SelectItem key={r.id} value={r.id} className="text-xs">{r.nombre}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input type="date" value={visitaFecha} onChange={(e) => setVisitaFecha(e.target.value)} className="h-8 text-xs" />
          </div>
          <Input value={visitaNota} onChange={(e) => setVisitaNota(e.target.value)} placeholder="Nota (opcional)…" className="h-8 text-xs" />
          <Button size="sm" className="w-full h-8 bg-orange-600 hover:bg-orange-700 text-xs" disabled={!visitaRuta || !visitaFecha || registrarVisita.isPending} onClick={() => registrarVisita.mutate()}>
            {registrarVisita.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1.5" /> Registrar visita</>}
          </Button>
        </div>
      )}

      {/* Histórico de visitas */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Histórico de visitas ({visitas.length})</h4>
        {visitas.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Sin visitas registradas.</p>
        ) : (
          <div className="space-y-1.5">
            {visitas.map((v) => (
              <div key={v.id} className="flex items-start gap-2.5 bg-white rounded-xl px-3 py-2 border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0"><MapPin className="h-4 w-4 text-orange-500" /></div>
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
                  {v.imagenUrl && (
                    <a href={v.imagenUrl} target="_blank" rel="noreferrer" className="block mt-1.5">
                      <img src={v.imagenUrl} alt="Evidencia de la visita" className="h-24 w-full max-w-[220px] object-cover rounded-lg border border-slate-200" />
                    </a>
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
function CompletarRutaDialog({ clienteId, clienteNombre, ruta, onClose }: { clienteId: string; clienteNombre: string; ruta: { id: string; nombre: string }; onClose: () => void }) {
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
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/by-cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas/visitas/by-cliente", clienteId] });
      toast({ title: "Ruta marcada como realizada" });
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

function MarketingClientePanel({ clienteNombre, canManage }: { clienteNombre: string; canManage: boolean }) {
  const { toast } = useToast();
  const [assignOpen, setAssignOpen] = useState(false);
  const { data = [], isLoading } = useQuery<Array<{ itemId: string; itemNombre: string; unidad: string; cantidadEnPoder: number }>>({
    queryKey: ["/api/marketing/inventario-por-cliente", { cliente: clienteNombre }],
    enabled: !!clienteNombre,
  });

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
  const createMutation = useMutation({
    mutationFn: async () => {
      const base = fechaSugerida ? new Date(fechaSugerida) : new Date();
      return apiRequest("POST", "/api/marketing/solicitudes", {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        urgencia,
        fechaEntrega: fechaSugerida || undefined,
        mes: base.getMonth() + 1,
        anio: base.getFullYear(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/solicitudes"] });
      toast({ title: "Solicitud enviada", description: "Marketing recibió tu pedido y definirá el plazo final." });
      onOpenChange(false);
      setTitulo(""); setDescripcion(""); setUrgencia("media"); setFechaSugerida("");
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
          <Button className="bg-orange-600 hover:bg-orange-700 text-white" disabled={!titulo.trim() || !descripcion.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
// ==================================================================================
function ActividadesPanel({ taskId, canManage, clienteId, clienteNombre }: { taskId: string; canManage: boolean; clienteId: string; clienteNombre?: string }) {
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

  const { data: actividades = [], isLoading } = useQuery<Array<{ id: string; tipo: string; descripcion: string | null; fecha: string | null; estado: string; responsableNombre: string | null; rutaNombre: string | null }>>({
    queryKey: ["/api/tasks", taskId, "actividades"],
  });
  const { data: rutas = [] } = useQuery<Array<{ id: string; nombre: string }>>({ queryKey: ["/api/rutas"], enabled: canManage });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-slate-800">Tareas del cliente</h4>
          {total > 0 && <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">{done}/{total}</Badge>}
        </div>
        {canManage && !showForm && (
          <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-700 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva actividad
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
          {tipo === "visita" && (
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
                <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-700 text-xs" disabled={!nuevaRuta.trim() || createRutaMut.isPending} onClick={() => createRutaMut.mutate()}>
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
            <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-700 text-xs flex-1" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1.5" /> Agregar</>}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Sin actividades. Agregá la primera acción con este cliente.</p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((a) => {
            const m = meta(a.tipo);
            const doneAct = a.estado === "completada";
            return (
              <div key={a.id} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 border transition-all ${doneAct ? "bg-slate-50/60 border-slate-100 opacity-70" : "bg-white border-slate-200"}`}>
                {canManage ? (
                  <button
                    onClick={() => toggleMut.mutate({ id: a.id, estado: doneAct ? "pendiente" : "completada" })}
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
// ==================================================================================
function HeaderMeta({ task, isSeguimiento = false }: { task: any; isSeguimiento?: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEditDate = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'encargado_area' || task.createdByUserId === user?.id;
  const [editing, setEditing] = useState(false);
  const [dateValue, setDateValue] = useState(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : "");
  const isCompleted = task.status === 'completada';
  const updateDueDate = useMutation({
    mutationFn: async (dueDate: string | null) => apiRequest("PATCH", `/api/tasks/${task.id}`, { dueDate }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" }); setEditing(false); toast({ title: "Fecha actualizada" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo actualizar la fecha.", variant: "destructive" }),
  });
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
  return (
    <div className="flex items-center gap-x-6 gap-y-2 mt-3 flex-wrap pl-[52px]">
      {task.clienteNombre && (
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente</span>
          <span className="font-semibold text-emerald-700 truncate">{task.clienteNombre}</span>
        </div>
      )}
      {!isSeguimiento && (
      <div className="flex items-center gap-1.5 text-sm">
        <CalendarIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha límite</span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <div className="w-[210px]"><DateTimePicker value={dateValue} onChange={setDateValue} /></div>
            <button onClick={() => updateDueDate.mutate(dateValue ? new Date(dateValue).toISOString() : null)} disabled={updateDueDate.isPending} className="text-[11px] font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-2 py-1 disabled:opacity-50">{updateDueDate.isPending ? "…" : "Guardar"}</button>
            <button onClick={() => setEditing(false)} className="text-[11px] text-slate-500 hover:bg-slate-100 rounded-lg px-2 py-1">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => canEditDate && setEditing(true)} className={`flex items-center gap-1 font-semibold ${overdue ? "text-red-600" : task.dueDate ? "text-slate-800" : "text-slate-400 italic"} ${canEditDate ? "hover:underline" : ""}`}>
            {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy, HH:mm", { locale: es }) : "Sin fecha"}
            {canEditDate && <Pencil className="h-3 w-3 text-slate-400" />}
          </button>
        )}
      </div>
      )}
    </div>
  );
}