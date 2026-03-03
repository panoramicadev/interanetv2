import { useEffect, useState } from "react";
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
  Ban
} from "lucide-react";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Task, type TaskAssignment, type InsertTaskAssignment, type TaskComment } from "@shared/schema";
import { z } from "zod";

// SECURITY: Frontend schema that excludes createdByUserId to prevent user impersonation
const createTaskWithAssignmentsSchema = z.object({
  title: z.string().min(1, "Título es requerido"),
  description: z.string().optional(),
  type: z.enum(["texto", "formulario", "visita"]).default("texto"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().refine((date) => {
    if (!date) return true; // Allow empty dates
    // Accept datetime-local format (YYYY-MM-DDTHH:mm) and ISO format
    const datetimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return datetimeLocalPattern.test(date) || isoPattern.test(date) || !isNaN(Date.parse(date));
  }, {
    message: "Formato de fecha inválido. Use el selector de fecha.",
  }).optional().or(z.null()),
  clienteId: z.string().optional().or(z.null()), // Cliente asociado (opcional)
  clienteNombre: z.string().optional().or(z.null()), // Nombre del cliente (opcional)
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

  // View state
  const [viewMode, setViewMode] = useState<"my-tasks" | "all-tasks">(
    user?.role === 'salesperson' ? "my-tasks" : "all-tasks"
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [clienteFilter, setClienteFilter] = useState<string>("all");

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
  });

  // Query for available users (for assignments)
  const { data: availableUsers } = useQuery<Array<{ id: string; salespersonName: string; role: string }>>({
    queryKey: ["/api/users/salespeople"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'tecnico_obra',
  });

  // Query for available supervisors (for assignments)
  const { data: availableSupervisors } = useQuery<Array<{ id: string; salespersonName: string; role: string }>>({
    queryKey: ["/api/users/salespeople/supervisors"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'tecnico_obra',
  });

  // Query para obtener vendedores del supervisor (para detectar segmento CONSTRUCCION)
  const { data: supervisorSalespeople } = useQuery<Array<{ id: string; salespersonName: string; assignedSegment?: string }>>({
    queryKey: ['/api/supervisor', user?.id, 'salespeople'],
    queryFn: async () => {
      const response = await apiRequest(`/api/supervisor/${user?.id}/salespeople`);
      return response.json();
    },
    enabled: !!user && user?.role === 'supervisor',
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
    if (user?.role === 'supervisor' && supervisorSalespeople && supervisorSalespeople.length > 0) {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], type: "all" });
      toast({
        title: "Estado actualizado",
        description: "El estado de la asignación se ha actualizado.",
      });
    },
    onError: (error: any) => {
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

    return true;
  }) || [];

  // Get unique clients from tasks for filter dropdown
  const clientesEnTareas = [...new Set(
    (tasksQuery.data || [])
      .filter((t) => (t as any).clienteNombre)
      .map((t) => (t as any).clienteNombre)
  )];

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

  const canCreateTasks = user.role === 'admin' || user.role === 'supervisor' || user.role === 'tecnico_obra';

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 space-y-6">
      {/* Header Premium */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-xl border border-slate-700/50 p-6 sm:p-8 mb-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-1">
              <div className="w-8 h-[2px] bg-blue-500/50" />
              <span>Gestión de Equipo</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Tareas</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl font-medium">
              Gestiona tareas del equipo, estimaciones semanales y seguimiento de clientes
            </p>
          </div>
          {canCreateTasks && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg text-white font-bold border-none transition-all duration-300 hover:scale-105 active:scale-95" data-testid="button-create-task">
                  <Plus className="h-5 w-5 mr-2" />
                  Nueva Tarea
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-2xl">Crear Nueva Tarea</DialogTitle>
                  <DialogDescription>
                    Completa los detalles para crear una nueva tarea y asignarla a miembros del equipo.
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col min-h-0 flex-1">
                    <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                      {/* Task Details */}
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título *</FormLabel>
                            <FormControl>
                              <Input placeholder="Título de la tarea" {...field} data-testid="input-task-title" />
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
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Descripción detallada de la tarea"
                                className="resize-none"
                                rows={3}
                                {...field}
                                data-testid="textarea-task-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prioridad</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-task-priority">
                                    <SelectValue placeholder="Seleccionar prioridad" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Baja</SelectItem>
                                  <SelectItem value="medium">Media</SelectItem>
                                  <SelectItem value="high">Alta</SelectItem>
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
                              <FormLabel>Fecha Límite</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
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

                      {/* Cliente asociado (opcional) */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          Cliente Asociado (Opcional)
                        </Label>
                        {selectedClienteTask ? (
                          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
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
                                className="pl-10"
                                data-testid="input-search-cliente-task"
                              />
                            </div>
                            {searchClienteTask.length >= 2 && clientesTask.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border rounded-lg bg-white shadow-sm">
                                {clientesTask.map((cliente) => (
                                  <button
                                    key={cliente.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
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

                      {/* Assignments Section */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Asignar a *</Label>

                        {/* Supervisor Assignments */}
                        {availableSupervisors && availableSupervisors.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-600 flex items-center gap-2">
                              <User className="h-3 w-3" />
                              Supervisores
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                              {availableSupervisors.map((supervisor) => (
                                <FormField
                                  key={`supervisor-${supervisor.id}`}
                                  control={form.control}
                                  name="assignments"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.some(a => a.assigneeType === "supervisor" && a.assigneeId === supervisor.id)}
                                          onCheckedChange={(checked) => {
                                            const currentAssignments = field.value || [];
                                            if (checked) {
                                              field.onChange([...currentAssignments, { assigneeType: "supervisor", assigneeId: supervisor.id }]);
                                            } else {
                                              field.onChange(currentAssignments.filter(a => !(a.assigneeType === "supervisor" && a.assigneeId === supervisor.id)));
                                            }
                                          }}
                                          data-testid={`checkbox-supervisor-${supervisor.id}`}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-xs font-normal truncate">
                                        {supervisor.salespersonName}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Salesperson Assignments */}
                        {availableUsers && availableUsers.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-600 flex items-center gap-2">
                              <User className="h-3 w-3" />
                              Vendedores
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                              {availableUsers.map((salesperson) => (
                                <FormField
                                  key={`salesperson-${salesperson.id}`}
                                  control={form.control}
                                  name="assignments"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.some(a => a.assigneeType === "salesperson" && a.assigneeId === salesperson.id)}
                                          onCheckedChange={(checked) => {
                                            const currentAssignments = field.value || [];
                                            if (checked) {
                                              field.onChange([...currentAssignments, { assigneeType: "salesperson", assigneeId: salesperson.id }]);
                                            } else {
                                              field.onChange(currentAssignments.filter(a => !(a.assigneeType === "salesperson" && a.assigneeId === salesperson.id)));
                                            }
                                          }}
                                          data-testid={`checkbox-salesperson-${salesperson.id}`}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-xs font-normal truncate">
                                        {salesperson.salespersonName}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <FormMessage>
                          {form.formState.errors.assignments?.message}
                        </FormMessage>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t mt-4 flex-shrink-0">
                      <Button
                        type="button"
                        variant="outline"
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
                        className="bg-gradient-to-r from-blue-600 to-indigo-600"
                        data-testid="button-submit-task"
                      >
                        {createTaskMutation.isPending ? "Creando..." : "Crear Tarea"}
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
          <TabsList className={`inline-flex w-max sm:w-full sm:grid h-auto gap-2 bg-slate-100/50 p-1 border border-slate-200/60 rounded-xl ${user?.role === 'tecnico_obra' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            <TabsTrigger value="tareas" data-testid="tab-tareas" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-lg">
              <CheckSquare className="h-4 w-4 mr-2 hidden sm:inline" />
              Tareas
            </TabsTrigger>
            {user?.role !== 'tecnico_obra' && (
              <TabsTrigger value="estimacion" data-testid="tab-estimacion" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-lg">
                <TrendingUp className="h-4 w-4 mr-2 hidden sm:inline" />
                {esConstruccion ? 'Estimación Mensual' : 'Estimación Semanal'}
              </TabsTrigger>
            )}
            <TabsTrigger value="calendario" data-testid="tab-calendario" className="px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-lg">
              <CalendarIcon className="h-4 w-4 mr-2 hidden sm:inline" />
              Calendario
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tareas" className="space-y-6">

          {/* Filters and View Toggle */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-0">
              {/* Mobile: Collapsible Filters Header */}
              <div className="lg:hidden">
                <button
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  data-testid="button-toggle-filters"
                >
                  <div className="flex items-center gap-3">
                    <Filter className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-sm text-gray-900">Filtros</span>
                    <Badge className="bg-blue-100 text-blue-700 text-xs font-medium">
                      {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform text-gray-600 ${filtersExpanded ? 'rotate-180' : ''}`} />
                </button>

                {filtersExpanded && (
                  <div className="p-4 pt-0 space-y-3 border-t border-gray-200">
                    {/* View Mode Toggle */}
                    {(user.role === 'admin' || user.role === 'supervisor' || user.role === 'tecnico_obra') && (
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

              {/* Desktop: Always Visible Filters */}
              <div className="hidden lg:block py-5 px-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    {/* View Mode Toggle */}
                    {(user.role === 'admin' || user.role === 'supervisor' || user.role === 'tecnico_obra') && (
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Vista:</Label>
                        <Select value={viewMode} onValueChange={(value: "my-tasks" | "all-tasks") => setViewMode(value)}>
                          <SelectTrigger className="w-40 border-gray-300" data-testid="select-view-mode">
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
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Estado:</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-36 border-gray-300" data-testid="select-status-filter">
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
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Prioridad:</Label>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-32 border-gray-300" data-testid="select-priority-filter">
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
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Cliente:</Label>
                      <Select value={clienteFilter} onValueChange={setClienteFilter}>
                        <SelectTrigger className="w-36 border-gray-300" data-testid="select-cliente-filter-desktop">
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

                  <Badge className="bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1">
                    {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <div className="space-y-4">
            {tasksQuery.isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Cargando tareas...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <CheckSquare className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay tareas</h3>
                  <p className="text-gray-600 mb-6">
                    {viewMode === "my-tasks" ? "No tienes tareas asignadas." : "No se encontraron tareas."}
                  </p>
                  {canCreateTasks && (
                    <Button
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                      data-testid="button-create-first-task"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primera tarea
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'completada';
                const myAssignment = task.assignments.find(a =>
                  (a.assigneeType === "supervisor" && a.assigneeId === user.id) ||
                  (a.assigneeType === "salesperson" && a.assigneeId === user.id)
                );
                const canComplete = myAssignment && myAssignment.status !== "completada" &&
                  (user.role === 'admin' || user.role === 'supervisor' || myAssignment.assigneeId === user.id);

                return (
                  <Card key={task.id} className={`overflow-hidden border-l-4 shadow-sm hover:shadow-lg transition-all duration-200 ${isCompleted ? 'border-l-green-500 bg-green-50/30' :
                    task.priority === 'high' ? 'border-l-red-500' :
                      task.priority === 'low' ? 'border-l-gray-400' : 'border-l-blue-500'
                    }`}>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-4">
                        {/* Checkbox To-Do Style */}
                        <div className="flex-shrink-0 pt-0.5">
                          {canComplete ? (
                            <button
                              onClick={() => setConfirmCompleteTask({ taskId: task.id, assignmentId: myAssignment!.id })}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                                }`}
                              data-testid={`checkbox-complete-task-${task.id}`}
                            >
                              {isCompleted && <Check className="h-4 w-4" />}
                            </button>
                          ) : (
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isCompleted
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-200 bg-gray-50'
                              }`}>
                              {isCompleted && <Check className="h-4 w-4" />}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title Row */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className={`text-base font-semibold leading-tight ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`} data-testid={`text-task-title-${task.id}`}>
                              {task.title}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {getPriorityBadge(task.priority ?? 'medium')}
                              {getStatusBadge(task.status ?? 'pendiente')}
                            </div>
                          </div>

                          {/* Cliente Badge - Destacado */}
                          {(task as any).clienteNombre && (
                            <div className="mb-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                                <Building2 className="h-3.5 w-3.5" />
                                {(task as any).clienteNombre}
                              </span>
                            </div>
                          )}

                          {/* Description */}
                          {task.description && (
                            <p className={`text-sm mb-3 line-clamp-2 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`} data-testid={`text-task-description-${task.id}`}>
                              {task.description}
                            </p>
                          )}

                          {/* Meta Info Row */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            {task.dueDate && (
                              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${new Date(task.dueDate) < new Date() && !isCompleted
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                                }`}>
                                <CalendarIcon className="h-3.5 w-3.5" />
                                <span data-testid={`text-task-due-date-${task.id}`}>
                                  {format(new Date(task.dueDate), "dd MMM yyyy", { locale: es })}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700">
                              <User className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium truncate max-w-[150px]" data-testid={`text-task-assignee-${task.id}`}>
                                {task.assignments.length > 0
                                  ? task.assignments.map(a => {
                                    const assigneeName = availableUsers?.find(s => s.id === a.assigneeId)?.salespersonName ||
                                      availableSupervisors?.find(s => s.id === a.assigneeId)?.salespersonName ||
                                      a.assigneeId;
                                    return assigneeName;
                                  }).join(', ')
                                  : 'Sin asignar'}
                              </span>
                            </div>
                            {myAssignment && !myAssignment.readAt && myAssignment.status === "pendiente" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => markAsReadMutation.mutate({
                                  taskId: task.id,
                                  assignmentId: myAssignment.id
                                })}
                                disabled={markAsReadMutation.isPending}
                                data-testid={`button-acknowledge-assignment-${myAssignment.id}`}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Acusar Recibo
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expand Toggle */}
                        <button
                          onClick={() => toggleTaskExpanded(task.id)}
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          data-testid={`button-toggle-task-${task.id}`}
                        >
                          {expandedTasks.has(task.id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Collapsible open={expandedTasks.has(task.id)}>
                      <CollapsibleContent>
                        <CardContent className="pt-4 bg-gray-50">
                          <div className="pt-0">
                            <h4 className="text-sm font-bold mb-3 text-gray-900 uppercase tracking-wide">Asignaciones</h4>
                            <div className="space-y-3">
                              {task.assignments.map((assignment) => {
                                return (
                                  <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {getAssigneeDisplay(assignment)}
                                        {getStatusBadge(assignment.status ?? 'pendiente')}
                                        {assignment.readAt && (
                                          <Badge variant="outline" className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                                            <Eye className="h-3 w-3" />
                                            Leída {format(new Date(assignment.readAt), "dd/MM HH:mm", { locale: es })}
                                          </Badge>
                                        )}
                                      </div>

                                      {/* Comments Thread Component */}
                                      <CommentsThread
                                        taskId={task.id}
                                        assignmentId={assignment.id}
                                        isEditing={editingNoteAssignmentId === assignment.id && editingNoteTaskId === task.id}
                                        editingText={editingNoteText}
                                        setEditingText={setEditingNoteText}
                                        onStartEditing={() => {
                                          setEditingNoteAssignmentId(assignment.id);
                                          setEditingNoteTaskId(task.id);
                                          setEditingNoteText("");
                                        }}
                                        onCancelEditing={() => {
                                          setEditingNoteAssignmentId(null);
                                          setEditingNoteTaskId(null);
                                          setEditingNoteText("");
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })
            )}
          </div>

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
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
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
            {(user?.role === 'admin' || user?.role === 'supervisor') && salespeople.length > 0 && (
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
                      {(user?.role === 'admin' || user?.role === 'supervisor') && (
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
                        {(user?.role === 'admin' || user?.role === 'supervisor') && (
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
                            {(user?.role === 'admin' || user?.role === 'supervisor') && (
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
  const salespeopleEndpoint = user?.role === 'supervisor'
    ? `/api/supervisor/${user.id}/salespeople`
    : '/api/users/salespeople';

  const { data: salespeople = [] } = useQuery<Array<{ id: string; fullName: string; salespersonName: string }>>({
    queryKey: [salespeopleEndpoint],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
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
    if (!['admin', 'supervisor'].includes(user?.role || '')) {
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

  const canEdit = ['admin', 'supervisor'].includes(user?.role || '');

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
                  <button
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                    data-testid={`button-delete-comment-${comment.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-gray-500 hover:text-blue-600 transition-all group"
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
              <CalendarIcon className="h-5 w-5 text-blue-600" />
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
                    <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm font-medium rounded-full ${isTodayDate ? 'bg-blue-600 text-white' : ''
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