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
  montoPrometido: string;
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
  estado: 'cumplido' | 'superado' | 'no_cumplido';
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
    enabled: searchClient.length >= 2,
  });

  const { data: promesasCumplimiento = [], isLoading: isLoadingPromesas } = useQuery<PromesaCumplimiento[]>({
    queryKey: ['/api/promesas-compra/cumplimiento/reporte', currentYear, currentWeek],
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
      <Tabs defaultValue="tareas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tareas" data-testid="tab-tareas">Tareas</TabsTrigger>
          <TabsTrigger value="estimacion" data-testid="tab-estimacion">Estimación Semanal</TabsTrigger>
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
}) {
  // Calcular resumen
  const resumen = {
    totalPromesas: promesasCumplimiento.length,
    totalPrometido: promesasCumplimiento.reduce((sum, p) => sum + parseFloat(p.promesa.montoPrometido), 0),
    totalVendido: promesasCumplimiento.reduce((sum, p) => sum + p.ventasReales, 0),
    cumplidas: promesasCumplimiento.filter(p => p.estado === 'cumplido').length,
    superadas: promesasCumplimiento.filter(p => p.estado === 'superado').length,
    noCumplidas: promesasCumplimiento.filter(p => p.estado === 'no_cumplido').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Estimación Semanal</h2>
          <p className="text-muted-foreground mt-1">
            Registra compromisos de compra y compara con ventas reales
          </p>
        </div>
        <Button onClick={() => setCreatePromesaDialogOpen(true)} data-testid="button-nueva-promesa">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Promesa
        </Button>
      </div>

      {/* Selector de semana */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Selección de Semana</CardTitle>
              <CardDescription>
                Semana {getISOWeek(selectedWeek)} del {getYear(selectedWeek)} ({format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), 'dd MMM', { locale: es })} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), 'dd MMM', { locale: es })})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-semana-anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} data-testid="button-semana-actual">
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-semana-siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen de cumplimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Prometido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${resumen.totalPrometido.toLocaleString('es-CL')}</div>
            <p className="text-xs text-muted-foreground mt-1">{resumen.totalPromesas} promesas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${resumen.totalVendido.toLocaleString('es-CL')}</div>
            <p className="text-xs text-muted-foreground mt-1">Facturas + NVV</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cumplidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resumen.cumplidas + resumen.superadas}</div>
            <p className="text-xs text-muted-foreground mt-1">{resumen.superadas} superadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">No Cumplidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{resumen.noCumplidas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {resumen.totalPromesas > 0 ? Math.round((resumen.noCumplidas / resumen.totalPromesas) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de promesas con cumplimiento */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Promesas</CardTitle>
          <CardDescription>Comparación de compromisos vs. ventas reales</CardDescription>
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
          ) : (
            <div className="space-y-4">
              {/* Desktop view */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Cliente</th>
                      <th className="text-right py-3 px-4 font-medium">Prometido</th>
                      <th className="text-right py-3 px-4 font-medium">Vendido</th>
                      <th className="text-right py-3 px-4 font-medium">Cumplimiento</th>
                      <th className="text-center py-3 px-4 font-medium">Estado</th>
                      <th className="text-left py-3 px-4 font-medium">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promesasCumplimiento.map((item) => (
                      <tr key={item.promesa.id} className="border-b hover:bg-muted/50" data-testid={`row-promesa-${item.promesa.id}`}>
                        <td className="py-3 px-4 font-medium">{item.promesa.clienteNombre}</td>
                        <td className="text-right py-3 px-4">${parseFloat(item.promesa.montoPrometido).toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4">${item.ventasReales.toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className={item.cumplimiento >= 100 ? 'text-green-600 font-semibold' : item.cumplimiento >= 70 ? 'text-yellow-600' : 'text-red-600'}>
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
              <div className="lg:hidden space-y-4">
                {promesasCumplimiento.map((item) => (
                  <Card key={item.promesa.id} data-testid={`card-promesa-${item.promesa.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{item.promesa.clienteNombre}</p>
                            {item.promesa.observaciones && (
                              <p className="text-sm text-muted-foreground mt-1">{item.promesa.observaciones}</p>
                            )}
                          </div>
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
                          {item.estado === 'no_cumplido' && (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              No Cumplido
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Prometido</p>
                            <p className="text-lg font-semibold">${parseFloat(item.promesa.montoPrometido).toLocaleString('es-CL')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Vendido</p>
                            <p className="text-lg font-semibold">${item.ventasReales.toLocaleString('es-CL')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Cumplimiento</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-semibold ${item.cumplimiento >= 100 ? 'text-green-600' : item.cumplimiento >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {item.cumplimiento.toFixed(1)}%
                            </span>
                            {item.cumplimiento >= 100 ? (
                              <TrendingUp className="h-5 w-5 text-green-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-red-600" />
                            )}
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
      />
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWeek: Date;
  clientes: Cliente[];
  searchClient: string;
  setSearchClient: (value: string) => void;
}) {
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [montoPrometido, setMontoPrometido] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualClienteNombre, setManualClienteNombre] = useState("");
  const [manualClienteId, setManualClienteId] = useState("");

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
    setSelectedClient(null);
    setMontoPrometido("");
    setObservaciones("");
    setSearchClient("");
    setIsManualEntry(false);
    setManualClienteNombre("");
    setManualClienteId("");
  };

  const handleSubmit = () => {
    if (isManualEntry) {
      if (!manualClienteNombre.trim() || !montoPrometido) {
        toast({
          title: "Error",
          description: "Por favor complete todos los campos requeridos (nombre del cliente y monto)",
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

    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
    const weekNumber = getISOWeek(selectedWeek);
    const year = getYear(selectedWeek);

    createMutation.mutate({
      clienteId: isManualEntry ? (manualClienteId.trim() || 'MANUAL') : selectedClient!.koen,
      clienteNombre: isManualEntry ? manualClienteNombre.trim() : selectedClient!.nokoen,
      montoPrometido: parseFloat(montoPrometido),
      semana: `${year}-${String(weekNumber).padStart(2, '0')}`,
      anio: year,
      numeroSemana: weekNumber,
      fechaInicio: format(weekStart, 'yyyy-MM-dd'),
      fechaFin: format(weekEnd, 'yyyy-MM-dd'),
      observaciones: observaciones || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-crear-promesa">
        <DialogHeader>
          <DialogTitle>Nueva Promesa de Compra</DialogTitle>
          <DialogDescription>
            Registra un compromiso de compra para la semana {getISOWeek(selectedWeek)} del {getYear(selectedWeek)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selector de cliente */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Cliente *</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsManualEntry(!isManualEntry);
                  setSelectedClient(null);
                  setSearchClient("");
                  setManualClienteNombre("");
                  setManualClienteId("");
                }}
                data-testid="button-toggle-manual"
              >
                {isManualEntry ? 'Buscar en lista' : 'Ingreso manual'}
              </Button>
            </div>
            
            {isManualEntry ? (
              <div className="space-y-3 mt-2">
                <div>
                  <Label htmlFor="manualNombre">Nombre del Cliente *</Label>
                  <Input
                    id="manualNombre"
                    placeholder="Ingrese el nombre del cliente"
                    value={manualClienteNombre}
                    onChange={(e) => setManualClienteNombre(e.target.value)}
                    className="mt-1"
                    data-testid="input-manual-nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="manualCodigo">Código del Cliente (Opcional)</Label>
                  <Input
                    id="manualCodigo"
                    placeholder="Ej: CLI001"
                    value={manualClienteId}
                    onChange={(e) => setManualClienteId(e.target.value)}
                    className="mt-1"
                    data-testid="input-manual-codigo"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Si no tiene código, se asignará automáticamente</p>
                </div>
              </div>
            ) : selectedClient ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 p-2 border rounded bg-muted">
                  <p className="font-medium">{selectedClient.nokoen}</p>
                  <p className="text-sm text-muted-foreground">Código: {selectedClient.koen}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchClient}
                    onChange={(e) => setSearchClient(e.target.value)}
                    className="pl-8"
                    data-testid="input-buscar-cliente"
                  />
                </div>
                {clientes.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded">
                    {clientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => setSelectedClient(cliente)}
                        className="w-full text-left p-2 hover:bg-muted transition-colors"
                        data-testid={`button-seleccionar-cliente-${cliente.koen}`}
                      >
                        <p className="font-medium">{cliente.nokoen}</p>
                        <p className="text-sm text-muted-foreground">Código: {cliente.koen}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Monto prometido */}
          <div>
            <Label htmlFor="monto">Monto Prometido *</Label>
            <Input
              id="monto"
              type="number"
              placeholder="Ej: 1500000"
              value={montoPrometido}
              onChange={(e) => setMontoPrometido(e.target.value)}
              className="mt-2"
              data-testid="input-monto-prometido"
            />
          </div>

          {/* Observaciones */}
          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              placeholder="Notas adicionales (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="mt-2"
              data-testid="textarea-observaciones"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Indicador de campos faltantes */}
          {!isManualEntry && !selectedClient && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Selecciona un cliente de la lista
            </p>
          )}
          {isManualEntry && !manualClienteNombre.trim() && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Ingresa el nombre del cliente
            </p>
          )}
          {!montoPrometido && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Ingresa el monto prometido
            </p>
          )}
          
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancelar">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={
                createMutation.isPending || 
                (!isManualEntry && !selectedClient) || 
                (isManualEntry && !manualClienteNombre.trim()) ||
                !montoPrometido
              }
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