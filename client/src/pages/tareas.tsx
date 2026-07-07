import { useEffect, useState, useRef } from "react";
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
  HelpCircle
} from "lucide-react";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Task, type TaskAssignment, type InsertTaskAssignment, type TaskComment } from "@shared/schema";
import { z } from "zod";

// SECURITY: Frontend schema that excludes createdByUserId to prevent user impersonation
const SEGMENTOS = [
  { value: "ferreterias", label: "Ferreterías" },
  { value: "construccion", label: "Construcción" },
  { value: "digital", label: "Industrial" },
  { value: "marketing", label: "Marketing" },
] as const;

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

  // View state - vendedores always see "my-tasks"
  const [viewMode, setViewMode] = useState<"my-tasks" | "all-tasks">(
    isSalesperson ? "my-tasks" : "all-tasks"
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [segmentoFilter, setSegmentoFilter] = useState<string>(isSalesperson ? "all" : "ferreterias");

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

  // Query for tasks with filters - Build query params properly to avoid [object Object] serialization
  const buildTasksQueryKey = () => {
    const params: string[] = [];
    if (statusFilter !== "all") params.push(`status=${statusFilter}`);
    if (priorityFilter !== "all") params.push(`priority=${priorityFilter}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return [`/api/tasks${queryString}`];
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

  // Query para obtener vendedores del supervisor (para detectar segmento CONSTRUCCION)
  const { data: supervisorSalespeople } = useQuery<Array<{ id: string; salespersonName: string; assignedSegment?: string }>>({
    queryKey: ['/api/supervisor', user?.id, 'salespeople'],
    queryFn: async () => {
      const response = await apiRequest(`/api/supervisor/${user?.id}/salespeople`);
      return response.json();
    },
    enabled: !!user && (user?.role === 'supervisor' || user?.role === 'encargado_area'),
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

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskWithAssignmentsInput) => {
      return await apiRequest("POST", "/api/tasks", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      setShowCreateDialog(false);
      form.reset();
      setSelectedClienteTask(null);
      setSearchClienteTask("");
      toast({
        title: "Tarea creada",
        description: "La tarea se ha creado exitosamente.",
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

    // Cliente filter
    if (clienteFilter === "with-client" && !(task as any).clienteId) return false;
    if (clienteFilter === "without-client" && (task as any).clienteId) return false;

    // Segmento filter (skip for salesperson - they see all their tasks regardless of segment)
    if (!isSalesperson && segmentoFilter !== "all") {
      if (!(task as any).segmento || (task as any).segmento !== segmentoFilter) return false;
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
    createTaskMutation.mutate(data);
  };

  const canCreateTasks = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || user.role === 'tecnico_obra';

  // KPIs presentacionales — reutilizan la misma lógica de completado que las tarjetas
  const isTaskDone = (t: typeof filteredTasks[number]) =>
    t.status === 'completada' || t.assignments.some((a) => a.status === 'completed');
  const kpiTotal = filteredTasks.length;
  const kpiCompletadas = filteredTasks.filter(isTaskDone).length;
  const kpiPendientes = kpiTotal - kpiCompletadas;
  const kpiVencidas = filteredTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && !isTaskDone(t)
  ).length;

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 space-y-6">
      {/* Header */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/25">
                <CheckSquare className="w-5 h-5" />
              </span>
              Panel de Trabajo
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tareas del equipo, estimaciones de ventas y seguimiento de clientes
            </p>
          </div>
          {canCreateTasks && (
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
                setShowCreateDialog(open);
                if (open && segmentoFilter && segmentoFilter !== 'all') {
                  form.setValue('segmento', segmentoFilter);
                }
              }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/25 transition-all" data-testid="button-create-task">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Tarea
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b bg-gradient-to-br from-indigo-50 via-white to-violet-50/60 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/30">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl p-2.5 shadow-md shadow-indigo-500/25">
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
                    <div className="space-y-5 overflow-y-auto flex-1 px-6 py-5">

                      {/* Section: Información */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center justify-center">
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
                                  <Input placeholder="Ej: Visita cliente zona sur" className="bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20" {...field} data-testid="input-task-title" />
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
                                    className="resize-none bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20"
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
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400 flex items-center justify-center">
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
                                      {SEGMENTOS.map((seg) => (
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
                                    <Input
                                      type="datetime-local"
                                      className="bg-white border-slate-200"
                                      {...field}
                                      value={field.value || ""}
                                      data-testid="input-task-due-date"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Cliente */}
                      <div className="space-y-3">
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
                            <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
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
                                      className="w-full px-3 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border-b last:border-b-0 transition-colors"
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
                      <div className="space-y-3">
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
                              <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800">
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
                                        <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 ${isChecked ? 'bg-indigo-50/80 dark:bg-indigo-950/30' : ''}`}>
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
                                            className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                          />
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                              {supervisor.salespersonName?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-slate-700 truncate">{supervisor.salespersonName}</p>
                                              <p className="text-[10px] text-indigo-500 font-medium">Supervisor</p>
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
                                        <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 ${isChecked ? 'bg-indigo-50/80 dark:bg-indigo-950/30' : ''}`}>
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
                                            className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
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
                        className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/25 px-6 font-semibold transition-all"
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
          )}
        </div>
      </div>

      {/* Tabs para Tareas, Calendario, Estimación Semanal/Mensual */}
      {/* Técnico de Obra no tiene acceso a la pestaña de promesas de compra */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className={`inline-flex w-max sm:w-full sm:grid h-auto gap-1.5 bg-slate-100/70 dark:bg-slate-800/60 p-1.5 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl ${user?.role === 'tecnico_obra' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            <TabsTrigger value="tareas" data-testid="tab-tareas" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg">
              <CheckSquare className="h-4 w-4 mr-2 hidden sm:inline" />
              Seguimiento
            </TabsTrigger>
            {user?.role !== 'tecnico_obra' && (
              <TabsTrigger value="estimacion" data-testid="tab-estimacion" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg">
                <TrendingUp className="h-4 w-4 mr-2 hidden sm:inline" />
                {esConstruccion ? 'Estimación Mensual' : 'Estimación de ventas'}
              </TabsTrigger>
            )}
            <TabsTrigger value="calendario" data-testid="tab-calendario" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg">
              <CalendarIcon className="h-4 w-4 mr-2 hidden sm:inline" />
              Calendario
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tareas" className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300">
              <div className="pointer-events-none absolute -right-5 -top-5 w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                  <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums text-slate-900 dark:text-white">{kpiTotal}</div>
                  <div className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-1">Tareas</div>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-sm hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all duration-300">
              <div className="pointer-events-none absolute -right-5 -top-5 w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums text-slate-900 dark:text-white">{kpiPendientes}</div>
                  <div className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-1">Pendientes</div>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-sm hover:shadow-lg hover:shadow-rose-500/10 hover:-translate-y-0.5 transition-all duration-300">
              <div className="pointer-events-none absolute -right-5 -top-5 w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-900/30 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/30">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums text-slate-900 dark:text-white">{kpiVencidas}</div>
                  <div className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-1">Vencidas</div>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-all duration-300">
              <div className="pointer-events-none absolute -right-5 -top-5 w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums text-slate-900 dark:text-white">{kpiCompletadas}</div>
                  <div className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-1">Completadas</div>
                </div>
              </div>
            </div>
          </div>

          {/* Segment Tabs - hidden for salesperson */}
          {!isSalesperson && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
              {SEGMENTOS.map((seg) => (
                <button
                  key={seg.value}
                  onClick={() => setSegmentoFilter(seg.value)}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${segmentoFilter === seg.value
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
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
                    <Filter className="h-5 w-5 text-indigo-600" />
                    <span className="font-semibold text-sm text-gray-900">Filtros</span>
                    <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium">
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
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 flex-shrink-0">
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

                  <Badge className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 text-xs font-semibold px-3.5 py-1.5 shadow-sm shadow-indigo-500/25 rounded-full">
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
              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-medium px-3 py-1">
                {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}

          {/* Group Management Bar */}
          {/* Group Management Bar - hidden for salesperson */}
          {!isSalesperson && segmentoFilter !== "all" && (
            <div className="flex items-center gap-2">
              {!showCreateGroup ? (
                <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateGroup(true)}
                  className="text-xs border-dashed border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Nuevo Grupo
                </Button>
                {!showGroupsTutorial && (
                  <button
                    onClick={reopenGroupsTutorial}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors"
                    title="¿Para qué sirven los grupos?"
                    aria-label="¿Para qué sirven los grupos?"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                )}
                </>
              ) : (
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 shadow-sm">
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
                    className="h-6 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700"
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
                    variant="outline"
                    size="sm"
                    onClick={exitSelectionMode}
                    className="text-xs border-slate-300 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Cancelar selección
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionMode(true)}
                    className="text-xs border-slate-300 text-slate-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50/50 transition-all"
                  >
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                    Seleccionar
                  </Button>
                )
              )}
            </div>
          )}

          {/* Burbuja tutorial: ¿para qué sirven los grupos? - cerrable */}
          {showGroupsTutorial && !isSalesperson && segmentoFilter !== "all" && (
            <div className="relative animate-in fade-in slide-in-from-top-1 duration-300">
              {/* Puntita que apunta al botón "Nuevo Grupo" */}
              <div className="absolute -top-1.5 left-7 w-3 h-3 rotate-45 rounded-[3px] bg-indigo-600 dark:bg-indigo-500" />
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-4 pr-10 shadow-lg shadow-indigo-500/25">
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
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium text-sm">Cargando tareas...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-20">
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 blur-lg opacity-25" />
                  <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <CheckSquare className="h-9 w-9 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No hay tareas</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                  {viewMode === "my-tasks" ? "No tienes tareas asignadas." : "No se encontraron tareas."}
                </p>
                {canCreateTasks && (
                  <Button
                    onClick={() => {
                      if (segmentoFilter && segmentoFilter !== 'all') {
                        form.setValue('segmento', segmentoFilter);
                      }
                      setShowCreateDialog(true);
                    }}
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/25 transition-all"
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

              filteredTasks.forEach(task => {
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
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                    }`}
                    onClick={() => {
                      if (!selectionMode) { setSelectedTaskId(task.id); return; }
                      if (lockedByGroup) return; // controlada por la selección del grupo
                      toggleTaskSelected(task.id);
                    }}
                  >
                    {/* Selection checkbox (modo selección admin) o círculo de completado */}
                    <div className="flex-shrink-0 pt-0.5">
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

              const groupColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#6366f1'];

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

                          {!selectionMode && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteGroupMutation.mutate(group.id); }}
                              className="opacity-0 group-hover/header:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all flex-shrink-0"
                              title="Eliminar grupo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </button>
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

          {/* Diálogo de Detalle de Tarea */}
          {selectedTask && (
            <TaskDetailDialog
              task={selectedTask}
              open={!!selectedTaskId}
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
          )}

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
        </TabsContent>

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
                setActiveTab("tareas");
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-95 group-hover:opacity-100 transition-opacity" />
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
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700 opacity-95 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Building2 className="w-16 h-16 text-white" />
          </div>
          <CardContent className="relative p-6">
            <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideCloseButton className="max-w-[95vw] lg:max-w-[1100px] max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={`rounded-lg p-2.5 shadow-sm flex-shrink-0 ${
                isCompleted ? 'bg-emerald-600' :
                task.priority === 'high' ? 'bg-red-600' :
                'bg-indigo-600'
              }`}>
                <CheckSquare className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold text-foreground truncate">
                  {task.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>Creada {task.createdAt && format(new Date(task.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                  {(task as any).segmento && (
                    <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0 text-xs">
                      {(task as any).segmento}
                    </Badge>
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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
        </div>

        {/* Department Change Bar */}
        {(user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || task.createdByUserId === user.id) && (
          <div className="flex items-center gap-2 px-6 py-3 bg-slate-100 border-b border-slate-200 flex-shrink-0 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Pestaña:
            </span>
            {SEGMENTOS.map((seg) => {
              const isActive = (task as any).segmento === seg.value;
              return (
                <button
                  key={seg.value}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                  disabled={updateTaskSegmentoMutation.isPending}
                  onClick={() => {
                    if (!isActive) {
                      updateTaskSegmentoMutation.mutate({ taskId: task.id, segmento: seg.value });
                      setSelectedSegmento(seg.value);
                    }
                  }}
                >
                  {seg.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Two-Panel Layout */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Panel: Task Info */}
          <div className="lg:w-[55%] overflow-y-auto border-r border-slate-200 p-5 space-y-5">
            {/* Description */}
            {task.description && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</h4>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Due Date - Editable */}
              {(() => {
                const canEditDate = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || task.createdByUserId === user.id;
                const [isEditingDate, setIsEditingDate] = useState(false);
                const [dateValue, setDateValue] = useState(
                  task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : ''
                );

                const updateDueDateMutation = useMutation({
                  mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate: string | null }) => {
                    return await apiRequest("PATCH", `/api/tasks/${taskId}`, { dueDate });
                  },
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
                    setIsEditingDate(false);
                    toast({
                      title: "Fecha actualizada",
                      description: "La fecha límite se ha actualizado.",
                    });
                  },
                  onError: (error: any) => {
                    toast({
                      title: "Error",
                      description: error.message || "No se pudo actualizar la fecha.",
                      variant: "destructive",
                    });
                  },
                });

                return (
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha Límite</p>
                    {isEditingDate ? (
                      <div className="space-y-2">
                        <input
                          type="datetime-local"
                          value={dateValue}
                          onChange={(e) => setDateValue(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              const dueDate = dateValue ? new Date(dateValue).toISOString() : null;
                              updateDueDateMutation.mutate({ taskId: task.id, dueDate });
                            }}
                            disabled={updateDueDateMutation.isPending}
                            className="flex-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50"
                          >
                            {updateDueDateMutation.isPending ? 'Guardando...' : 'Guardar'}
                          </button>
                          {task.dueDate && (
                            <button
                              onClick={() => {
                                setDateValue('');
                                updateDueDateMutation.mutate({ taskId: task.id, dueDate: null });
                              }}
                              disabled={updateDueDateMutation.isPending}
                              className="text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg px-2 py-1.5 transition-colors"
                            >
                              Quitar
                            </button>
                          )}
                          <button
                            onClick={() => setIsEditingDate(false)}
                            className="text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-lg px-2 py-1.5 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => canEditDate && setIsEditingDate(true)}
                        className={`${canEditDate ? 'cursor-pointer hover:bg-slate-100 rounded-lg -mx-1 px-1 py-0.5 transition-colors' : ''}`}
                        title={canEditDate ? 'Clic para editar fecha' : undefined}
                      >
                        {task.dueDate ? (
                          <div className={`flex items-center gap-1.5 text-sm font-semibold ${
                            new Date(task.dueDate) < new Date() && !isCompleted ? 'text-red-600' : 'text-slate-800'
                          }`}>
                            <CalendarIcon className="h-4 w-4" />
                            {format(new Date(task.dueDate), "dd MMM yyyy, HH:mm", { locale: es })}
                            {canEditDate && <Pencil className="h-3 w-3 text-slate-400 ml-auto" />}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-slate-400 italic">Sin fecha</span>
                            {canEditDate && <Pencil className="h-3 w-3 text-slate-400 ml-auto" />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Client */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cliente</p>
                {(task as any).clienteNombre ? (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <Building2 className="h-4 w-4" />
                    {(task as any).clienteNombre}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 italic">Sin cliente</span>
                )}
              </div>
            </div>



            {/* Group Assignment */}
            {(() => {
              const canAssignGroup = user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || task.createdByUserId === user.id;
              if (!canAssignGroup) return null;
              // Show groups matching task segmento, or all groups if task has no segmento
              const availableGroups = (task as any).segmento
                ? taskGroups.filter(g => g.segmento === (task as any).segmento)
                : taskGroups;
              if (availableGroups.length === 0) return null;
              const currentGroupId = (task as any).groupId || "__none__";
              const hasChanged = selectedGroupId !== currentGroupId;
              return (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Grupo
                  </h4>
                  <Select
                    value={selectedGroupId}
                    onValueChange={setSelectedGroupId}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200 text-sm">
                      <SelectValue placeholder="Seleccionar grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-slate-400 italic">Sin grupo</span>
                      </SelectItem>
                      {availableGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasChanged && (
                    <Button
                      size="sm"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm"
                      disabled={assignTaskToGroupMutation.isPending}
                      onClick={() => {
                        const groupId = selectedGroupId === "__none__" ? null : selectedGroupId;
                        assignTaskToGroupMutation.mutate({ taskId: task.id, groupId });
                      }}
                    >
                      {assignTaskToGroupMutation.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Guardando...</>
                      ) : (
                        <><Check className="h-3.5 w-3.5 mr-1.5" /> Guardar Grupo</>
                      )}
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Status Actions */}
            {canUpdateStatus && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cambiar Estado</h4>
                <div className="flex flex-wrap gap-2">
                  {['pendiente', 'en_progreso', 'completada'].map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={task.status === status ? "default" : "outline"}
                      className={`text-xs transition-all ${task.status === status 
                        ? status === 'completada' ? 'bg-green-600 hover:bg-green-700' 
                          : status === 'en_progreso' ? 'bg-amber-500 hover:bg-amber-600'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                        : ''
                      }`}
                      onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status })}
                      disabled={updateTaskStatusMutation.isPending || task.status === status}
                    >
                      {status === 'pendiente' && <Clock className="h-3.5 w-3.5 mr-1" />}
                      {status === 'en_progreso' && <Play className="h-3.5 w-3.5 mr-1" />}
                      {status === 'completada' && <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                      {status === 'pendiente' ? 'Pendiente' : status === 'en_progreso' ? 'En Progreso' : 'Completada'}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignments */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Asignaciones ({task.assignments.length})
              </h4>
              <div className="space-y-2">
                {task.assignments.map((assignment) => {
                  const assigneeName = getAssigneeName(assignment);
                  const myAssignment = (assignment.assigneeType === "supervisor" && assignment.assigneeId === user.id) ||
                    (assignment.assigneeType === "salesperson" && assignment.assigneeId === user.id);
                  
                  return (
                    <div key={assignment.id} className={`bg-white border rounded-xl p-4 transition-all ${
                      myAssignment ? 'border-indigo-200 bg-indigo-50/30 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            assignment.status === 'completada' ? 'bg-green-500' :
                            assignment.status === 'en_progreso' ? 'bg-amber-500' :
                            'bg-slate-400'
                          }`}>
                            {assigneeName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{assigneeName}</p>
                            <p className="text-xs text-slate-500 capitalize">{assignment.assigneeType}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusBadge(assignment.status ?? 'pendiente')}
                          {assignment.readAt && (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700">
                              <Eye className="h-3 w-3 mr-1" />
                              Leída
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Assignment Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        {myAssignment && !assignment.readAt && assignment.status === "pendiente" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => markAsReadMutation.mutate({
                              taskId: task.id,
                              assignmentId: assignment.id
                            })}
                            disabled={markAsReadMutation.isPending}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Acusar Recibo
                          </Button>
                        )}
                        {(user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') || myAssignment) && (
                          <Button
                            size="sm"
                            variant={assignment.status === 'completada' ? "default" : "outline"}
                            className={`h-7 px-2.5 text-xs ${assignment.status === 'completada' ? 'bg-green-600 hover:bg-green-700' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
                            onClick={() => {
                              const newStatus = assignment.status === 'completada' ? 'pendiente' : 'completada';
                              updateAssignmentMutation.mutate({
                                taskId: task.id,
                                assignmentId: assignment.id,
                                status: newStatus
                              });
                            }}
                            disabled={updateAssignmentMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {assignment.status === 'completada' ? 'Reabrir' : 'Completar'}
                          </Button>
                        )}
                      </div>
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
          </div>

          {/* Right Panel: Chat / Bitácora */}
          <div className="lg:w-[45%] flex flex-col min-h-0 bg-slate-50/50">
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-600" />
                  Bitácora / Chat
                </h4>
                {task.assignments.length > 1 && (
                  <Select value={activeAssignmentChat} onValueChange={setActiveAssignmentChat}>
                    <SelectTrigger className="w-auto max-w-[200px] h-8 text-xs border-slate-200">
                      <SelectValue placeholder="Asignación" />
                    </SelectTrigger>
                    <SelectContent>
                      {task.assignments.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {getAssigneeName(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Chat Messages */}
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

            {/* Chat Input */}
            <DetailChatInput
              taskId={task.id}
              assignmentId={activeAssignmentChat}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
          className="group bg-white rounded-xl p-3.5 border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
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
          className="flex-1 min-h-[40px] max-h-[120px] text-sm resize-none border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-xl"
          rows={1}
          data-testid="chat-input-detail"
        />
        <Button
          type="submit"
          size="sm"
          className="h-10 w-10 p-0 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md"
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
                className="group relative bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100 hover:shadow-sm transition-all"
                data-testid={`comment-${comment.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
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
              className="h-8 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-full"
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
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-gray-500 hover:text-indigo-600 transition-all group"
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
              <CalendarIcon className="h-5 w-5 text-indigo-600" />
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
                    <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm font-medium rounded-full ${isTodayDate ? 'bg-indigo-600 text-white' : ''
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