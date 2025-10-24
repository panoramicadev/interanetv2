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
  Loader2
} from "lucide-react";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Task, type TaskAssignment, type InsertTaskAssignment } from "@shared/schema";
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
  assignments: z.array(z.object({
    assigneeType: z.enum(["user", "segment"]),
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
  
  // Expanded tasks for collapsible assignment details
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  // Filters collapsed state for mobile
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Estados para Promesas de Compra
  const [searchClient, setSearchClient] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [createPromesaDialogOpen, setCreatePromesaDialogOpen] = useState(false);
  const [editPromesaDialogOpen, setEditPromesaDialogOpen] = useState(false);
  const [selectedPromesa, setSelectedPromesa] = useState<PromesaCumplimiento | null>(null);

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
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Query for available segments (for assignments)
  const { data: availableSegments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  // Queries para Promesas de Compra
  const currentWeek = `${getYear(selectedWeek)}-${String(getISOWeek(selectedWeek)).padStart(2, '0')}`;
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
    queryKey: ['/api/promesas-compra/cumplimiento/reporte', currentYear, currentWeek],
    queryFn: async () => {
      const response = await apiRequest(`/api/promesas-compra/cumplimiento/reporte?anio=${currentYear}&semana=${currentWeek}`);
      return response.json();
    },
    enabled: !!user,
  });

  const goToPreviousWeek = () => {
    setSelectedWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setSelectedWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(new Date());
  };

  // Form setup
  const form = useForm<CreateTaskWithAssignmentsInput>({
    resolver: zodResolver(createTaskWithAssignmentsSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
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
    if (viewMode === "my-tasks") {
      // Show tasks assigned to me or that I created
      const isAssignedToMe = task.assignments.some(assignment => 
        (assignment.assigneeType === "user" && assignment.assigneeId === user.id) ||
        (assignment.assigneeType === "segment" && assignment.assigneeId === (user as any).assignedSegment)
      );
      const isCreatedByMe = task.createdByUserId === user.id;
      return isAssignedToMe || isCreatedByMe;
    }
    return true; // Show all tasks for "all-tasks" mode
  }) || [];

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-blue-500" />;
      case "in_progress": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "completed": return <CheckSquare className="h-4 w-4 text-green-500" />;
      case "blocked": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "cancelled": return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      in_progress: "secondary",
      completed: "default",
      blocked: "destructive",
      cancelled: "outline",
    };
    
    const labels: Record<string, string> = {
      pending: "Pendiente",
      in_progress: "En Progreso", 
      completed: "Completada",
      blocked: "Bloqueada",
      cancelled: "Cancelada",
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
    if (assignment.assigneeType === "user") {
      const userInfo = availableUsers?.find(u => u.id === assignment.assigneeId);
      return (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>{userInfo?.salespersonName || assignment.assigneeId}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>{assignment.assigneeId}</span>
        </div>
      );
    }
  };

  const handleSubmit = (data: CreateTaskWithAssignmentsInput) => {
    createTaskMutation.mutate(data);
  };

  const canCreateTasks = user.role === 'admin' || user.role === 'supervisor';

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900" data-testid="page-title">
          Panel de Tareas
        </h1>
        <p className="text-gray-600 text-sm md:text-base">
          Gestiona tareas del equipo y estimaciones semanales
        </p>
      </div>

      {/* Tabs para Tareas y Estimación Semanal */}
      <Tabs defaultValue="estimacion" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="estimacion" data-testid="tab-estimacion">Estimación Semanal</TabsTrigger>
          <TabsTrigger value="tareas" data-testid="tab-tareas">Tareas</TabsTrigger>
        </TabsList>

        <TabsContent value="tareas" className="space-y-6">
          {/* Botón Nueva Tarea */}
          {canCreateTasks && (
            <div className="flex justify-end">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" data-testid="button-create-task">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tarea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] h-screen sm:h-auto sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Crear Nueva Tarea</DialogTitle>
                <DialogDescription>
                  Completa los detalles para crear una nueva tarea y asignarla a miembros del equipo o segmentos.
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

                  {/* Assignments Section */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Asignar a *</Label>
                    
                    {/* User Assignments */}
                    {availableUsers && availableUsers.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600 flex items-center gap-2">
                          <User className="h-3 w-3" />
                          Usuarios
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                          {availableUsers.map((user) => (
                            <FormField
                              key={`user-${user.id}`}
                              control={form.control}
                              name="assignments"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.some(a => a.assigneeType === "user" && a.assigneeId === user.id)}
                                      onCheckedChange={(checked) => {
                                        const currentAssignments = field.value || [];
                                        if (checked) {
                                          field.onChange([...currentAssignments, { assigneeType: "user", assigneeId: user.id }]);
                                        } else {
                                          field.onChange(currentAssignments.filter(a => !(a.assigneeType === "user" && a.assigneeId === user.id)));
                                        }
                                      }}
                                      data-testid={`checkbox-user-${user.id}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-xs font-normal truncate">
                                    {user.salespersonName}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Segment Assignments */}
                    {availableSegments && availableSegments.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600 flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          Segmentos
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                          {availableSegments.map((segment) => (
                            <FormField
                              key={`segment-${segment}`}
                              control={form.control}
                              name="assignments"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.some(a => a.assigneeType === "segment" && a.assigneeId === segment)}
                                      onCheckedChange={(checked) => {
                                        const currentAssignments = field.value || [];
                                        if (checked) {
                                          field.onChange([...currentAssignments, { assigneeType: "segment", assigneeId: segment }]);
                                        } else {
                                          field.onChange(currentAssignments.filter(a => !(a.assigneeType === "segment" && a.assigneeId === segment)));
                                        }
                                      }}
                                      data-testid={`checkbox-segment-${segment}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-xs font-normal truncate">
                                    {segment}
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
                      onClick={() => setShowCreateDialog(false)}
                      data-testid="button-cancel-task"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTaskMutation.isPending}
                      data-testid="button-submit-task"
                    >
                      {createTaskMutation.isPending ? "Creando..." : "Crear Tarea"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
            </div>
        )}

      {/* Filters and View Toggle */}
      <Card>
        <CardContent className="p-0">
          {/* Mobile: Collapsible Filters Header */}
          <div className="lg:hidden">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              data-testid="button-toggle-filters"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Filtros</span>
                <Badge variant="outline" className="text-xs">
                  {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {filtersExpanded && (
              <div className="p-4 pt-0 space-y-3 border-t">
                {/* View Mode Toggle */}
                {(user.role === 'admin' || user.role === 'supervisor') && (
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
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completadas</SelectItem>
                      <SelectItem value="blocked">Bloqueadas</SelectItem>
                      <SelectItem value="cancelled">Canceladas</SelectItem>
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

          {/* Desktop: Always Visible Filters */}
          <div className="hidden lg:block py-4 px-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* View Mode Toggle */}
                {(user.role === 'admin' || user.role === 'supervisor') && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Vista:</Label>
                    <Select value={viewMode} onValueChange={(value: "my-tasks" | "all-tasks") => setViewMode(value)}>
                      <SelectTrigger className="w-40" data-testid="select-view-mode">
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
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">Estado:</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completadas</SelectItem>
                      <SelectItem value="blocked">Bloqueadas</SelectItem>
                      <SelectItem value="cancelled">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority Filter */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">Prioridad:</Label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-32" data-testid="select-priority-filter">
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

              <Badge variant="outline" className="text-xs">
                {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasksQuery.isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando tareas...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay tareas</h3>
              <p className="text-gray-600 mb-4">
                {viewMode === "my-tasks" ? "No tienes tareas asignadas." : "No se encontraron tareas."}
              </p>
              {canCreateTasks && (
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  data-testid="button-create-first-task"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera tarea
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold truncate" data-testid={`text-task-title-${task.id}`}>
                        {task.title}
                      </h3>
                      {getPriorityBadge(task.priority ?? 'medium')}
                      {getStatusBadge(task.status ?? 'pending')}
                    </div>
                    
                    {task.description && (
                      <p className="text-gray-600 text-sm line-clamp-2" data-testid={`text-task-description-${task.id}`}>
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          <span data-testid={`text-task-due-date-${task.id}`}>
                            {format(new Date(task.dueDate), "dd MMM yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span data-testid={`text-task-assignment-count-${task.id}`}>
                          {task.assignments.length} asignación{task.assignments.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Action buttons for user's assignment - shown before toggle */}
                    {(() => {
                      const myAssignment = task.assignments.find(a => 
                        (a.assigneeType === "user" && a.assigneeId === user.id) ||
                        (a.assigneeType === "segment" && a.assigneeId === (user as any).assignedSegment)
                      );
                      
                      if (!myAssignment || myAssignment.status === "completed") return null;
                      
                      const canUpdate = 
                        (myAssignment.assigneeType === "user" && myAssignment.assigneeId === user.id) ||
                        (myAssignment.assigneeType === "segment" && myAssignment.assigneeId === (user as any).assignedSegment) ||
                        user.role === 'admin' || user.role === 'supervisor';
                      
                      if (!canUpdate) return null;

                      return (
                        <>
                          {/* Acusar Recibo button */}
                          {!myAssignment.readAt && myAssignment.status === "pending" && (
                            <Button
                              size="sm"
                              variant="default"
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
                          
                          {/* Complete button */}
                          {myAssignment.readAt && (myAssignment.status === "pending" || myAssignment.status === "in_progress") && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateAssignmentMutation.mutate({
                                taskId: task.id,
                                assignmentId: myAssignment.id,
                                status: "completed"
                              })}
                              disabled={updateAssignmentMutation.isPending}
                              data-testid={`button-complete-assignment-${myAssignment.id}`}
                            >
                              <CheckSquare className="h-3 w-3 mr-1" />
                              Completar
                            </Button>
                          )}
                        </>
                      );
                    })()}

                    <Collapsible>
                      <CollapsibleTrigger 
                        onClick={() => toggleTaskExpanded(task.id)}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        data-testid={`button-toggle-task-${task.id}`}
                      >
                        {expandedTasks.has(task.id) ? (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Ocultar detalles
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-4 w-4" />
                            Ver detalles
                          </>
                        )}
                      </CollapsibleTrigger>
                    </Collapsible>
                  </div>
                </div>
              </CardHeader>

              <Collapsible open={expandedTasks.has(task.id)}>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3 text-gray-900">Asignaciones:</h4>
                      <div className="space-y-3">
                        {task.assignments.map((assignment) => {
                          return (
                            <div key={assignment.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getAssigneeDisplay(assignment)}
                                  {getStatusBadge(assignment.status ?? 'pending')}
                                  {assignment.readAt && (
                                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      <Eye className="h-3 w-3" />
                                      Leída {format(new Date(assignment.readAt), "dd/MM HH:mm", { locale: es })}
                                    </Badge>
                                  )}
                                </div>
                                
                                {assignment.notes && (
                                  <div className="flex items-start gap-2 text-xs text-gray-600">
                                    <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span data-testid={`text-assignment-notes-${assignment.id}`}>
                                      {assignment.notes}
                                    </span>
                                  </div>
                                )}
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
          ))
        )}
      </div>
        </TabsContent>

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
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente de pestaña de Estimación Semanal (Promesas de Compra)
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

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Estimación Semanal</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-0.5 sm:mt-1">
            Registra compromisos de compra y compara con ventas reales
          </p>
        </div>
        <Button onClick={() => setCreatePromesaDialogOpen(true)} data-testid="button-nueva-promesa" size="sm" className="sm:h-10">
          <Plus className="mr-1 sm:mr-2 h-4 w-4" />
          Nueva Promesa
        </Button>
      </div>

      {/* Selector de semana */}
      <Card>
        <CardHeader className="py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">Selección de Semana</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Semana {(() => {
                  const monthStart = new Date(selectedWeek.getFullYear(), selectedWeek.getMonth(), 1);
                  const firstMonday = startOfWeek(monthStart, { weekStartsOn: 1 });
                  return Math.floor((selectedWeek.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
                })()} de {format(selectedWeek, 'MMMM', { locale: es })} ({format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'dd MMM', { locale: es })} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'dd MMM', { locale: es })})
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-semana-anterior" className="h-8 w-8 p-0 sm:h-9 sm:w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} data-testid="button-semana-actual" className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm">
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-semana-siguiente" className="h-8 w-8 p-0 sm:h-9 sm:w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen de cumplimiento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-6 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Prometido</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold">${resumen.totalPrometido.toLocaleString('es-CL')}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{resumen.totalPromesas} promesas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-6 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Vendido</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold">${resumen.totalVendido.toLocaleString('es-CL')}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">Facturas + NVV</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-6 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Cumplidas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold text-green-600">{resumen.cumplidas + resumen.superadas + resumen.cumplidasParcialmente}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
              {resumen.superadas} superadas, {resumen.cumplidasParcialmente} parcial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-6 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Incumplidas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-2xl font-bold text-orange-600">{resumen.insuficientes + resumen.noCumplidas}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
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
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b-2 border-border">
                      {(user?.role === 'admin' || user?.role === 'supervisor') && (
                        <th className="text-left py-4 px-4 font-bold text-base">Vendedor</th>
                      )}
                      <th className="text-left py-4 px-4 font-bold text-base">Cliente</th>
                      <th className="text-right py-4 px-4 font-bold text-base">Prometido</th>
                      <th className="text-right py-4 px-4 font-bold text-base">Vendido</th>
                      <th className="text-right py-4 px-4 font-bold text-base">Cumplimiento</th>
                      <th className="text-center py-4 px-4 font-bold text-base">Estado</th>
                      <th className="text-left py-4 px-4 font-bold text-base">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWeek: Date;
  clientes: Cliente[];
  searchClient: string;
  setSearchClient: (value: string) => void;
  user: any;
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
  const { data: salespeople = [] } = useQuery<Array<{ id: string; fullName: string; salespersonName: string }>>({
    queryKey: ['/api/users/salespeople'],
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
      queryClient.invalidateQueries({ 
        queryKey: ['/api/promesas-compra'],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/promesas-compra/cumplimiento/reporte'],
        refetchType: 'all'
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

    const weekStart = startOfWeek(dialogWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(dialogWeek, { weekStartsOn: 1 });
    const weekNumber = getISOWeek(dialogWeek);
    const year = getYear(dialogWeek);

    createMutation.mutate({
      vendedorId: selectedSalesperson,
      clienteId: clienteTipo === "potencial" ? (manualClienteId.trim() || 'PROSPECTO') : selectedClient!.koen,
      clienteNombre: clienteTipo === "potencial" ? manualClienteNombre.trim() : selectedClient!.nokoen,
      clienteTipo: clienteTipo,
      montoPrometido: parseFloat(montoPrometido),
      semana: `${year}-${String(weekNumber).padStart(2, '0')}`,
      anio: year,
      numeroSemana: weekNumber,
      fechaInicio: format(weekStart, 'yyyy-MM-dd'),
      fechaFin: format(weekEnd, 'yyyy-MM-dd'),
      observaciones: observaciones || null,
    });
  };

  const weekNumber = getISOWeek(dialogWeek);
  const year = getYear(dialogWeek);
  const weekStart = startOfWeek(dialogWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(dialogWeek, { weekStartsOn: 1 });

  // Calcular semana del mes (1-5)
  const monthStart = new Date(dialogWeek.getFullYear(), dialogWeek.getMonth(), 1);
  const firstMonday = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weekOfMonth = Math.floor((dialogWeek.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const monthName = format(dialogWeek, 'MMMM', { locale: es });

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
      <DialogContent className="max-w-lg overflow-x-auto" data-testid="dialog-crear-promesa">
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
              Periodo de la Promesa
            </Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogWeek(prev => subWeeks(prev, 1))}
                className="h-8"
                data-testid="button-prev-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center">
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  Semana {weekOfMonth} de {monthName}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  {format(weekStart, 'dd MMM', { locale: es })} - {format(weekEnd, 'dd MMM', { locale: es })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogWeek(prev => addWeeks(prev, 1))}
                className="h-8"
                data-testid="button-next-week"
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
              <div className={`flex items-center space-x-3 border-2 rounded-lg p-3 cursor-pointer transition-all ${
                clienteTipo === "activo" 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}>
                <RadioGroupItem value="activo" id="activo" data-testid="radio-cliente-activo" />
                <Label htmlFor="activo" className="font-medium cursor-pointer flex-1">
                  Cliente Activo
                </Label>
              </div>
              <div className={`flex items-center space-x-3 border-2 rounded-lg p-3 cursor-pointer transition-all ${
                clienteTipo === "potencial" 
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
        queryKey: ['/api/promesas-compra/cumplimiento/reporte'],
        refetchType: 'all'
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
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}