import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  User, 
  Users, 
  Building2, 
  Calendar as CalendarIcon,
  ChevronDown, 
  ChevronRight,
  Plus,
  Filter,
  Edit,
  MessageSquare,
  Eye,
  EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task, type TaskAssignment, type InsertTaskAssignment } from "@shared/schema";
import { z } from "zod";

// Extended schema for task creation with assignments
const createTaskWithAssignmentsSchema = insertTaskSchema.extend({
  assignments: z.array(z.object({
    assigneeType: z.enum(["user", "segment"]),
    assigneeId: z.string().min(1, "Destinatario requerido"),
  })).min(1, "Debe asignar al menos un destinatario"),
});

type CreateTaskWithAssignmentsInput = z.infer<typeof createTaskWithAssignmentsSchema>;

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900" data-testid="page-title">
            Panel de Tareas
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Gestiona y da seguimiento a las tareas del equipo
          </p>
        </div>

        {canCreateTasks && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-task">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tarea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Crear Nueva Tarea</DialogTitle>
                <DialogDescription>
                  Completa los detalles para crear una nueva tarea y asignarla a miembros del equipo o segmentos.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

                  <div className="flex justify-end gap-2">
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
        )}
      </div>

      {/* Filters and View Toggle */}
      <Card>
        <CardContent className="py-4">
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
              </CardHeader>

              <Collapsible open={expandedTasks.has(task.id)}>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3 text-gray-900">Asignaciones:</h4>
                      <div className="space-y-3">
                        {task.assignments.map((assignment) => {
                          const canUpdateAssignment = 
                            (assignment.assigneeType === "user" && assignment.assigneeId === user.id) ||
                            (assignment.assigneeType === "segment" && assignment.assigneeId === (user as any).assignedSegment) ||
                            user.role === 'admin' || user.role === 'supervisor';

                          return (
                            <div key={assignment.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    {getAssigneeDisplay(assignment)}
                                    {getStatusBadge(assignment.status ?? 'pending')}
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

                                {canUpdateAssignment && assignment.status !== "completed" && (
                                  <div className="flex flex-wrap gap-2">
                                    {assignment.status === "pending" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateAssignmentMutation.mutate({
                                          taskId: task.id,
                                          assignmentId: assignment.id,
                                          status: "in_progress"
                                        })}
                                        disabled={updateAssignmentMutation.isPending}
                                        data-testid={`button-start-assignment-${assignment.id}`}
                                      >
                                        <Clock className="h-3 w-3 mr-1" />
                                        Iniciar
                                      </Button>
                                    )}
                                    
                                    {assignment.status === "in_progress" && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => updateAssignmentMutation.mutate({
                                            taskId: task.id,
                                            assignmentId: assignment.id,
                                            status: "completed"
                                          })}
                                          disabled={updateAssignmentMutation.isPending}
                                          data-testid={`button-complete-assignment-${assignment.id}`}
                                        >
                                          <CheckSquare className="h-3 w-3 mr-1" />
                                          Completar
                                        </Button>
                                        
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => updateAssignmentMutation.mutate({
                                            taskId: task.id,
                                            assignmentId: assignment.id,
                                            status: "blocked"
                                          })}
                                          disabled={updateAssignmentMutation.isPending}
                                          data-testid={`button-block-assignment-${assignment.id}`}
                                        >
                                          <AlertCircle className="h-3 w-3 mr-1" />
                                          Bloquear
                                        </Button>
                                      </>
                                    )}

                                    {assignment.status === "blocked" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateAssignmentMutation.mutate({
                                          taskId: task.id,
                                          assignmentId: assignment.id,
                                          status: "in_progress"
                                        })}
                                        disabled={updateAssignmentMutation.isPending}
                                        data-testid={`button-unblock-assignment-${assignment.id}`}
                                      >
                                        <Clock className="h-3 w-3 mr-1" />
                                        Desbloquear
                                      </Button>
                                    )}
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
    </div>
  );
}