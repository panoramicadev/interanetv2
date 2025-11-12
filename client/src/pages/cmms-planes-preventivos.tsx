import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Calendar, Clock, AlertCircle, CheckCircle2, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, differenceInDays } from "date-fns";

interface PlanPreventivo {
  id: string;
  equipoId: string;
  nombrePlan: string;
  descripcion: string | null;
  frecuencia: string;
  ultimaEjecucion: string | null;
  proximaEjecucion: string;
  tareasPreventivas: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  equipo?: {
    id: string;
    nombre: string;
    area: string | null;
  };
}

const planSchema = z.object({
  equipoId: z.string().min(1, "Debe seleccionar un equipo"),
  nombrePlan: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional(),
  frecuencia: z.enum(["semanal", "mensual", "trimestral", "semestral", "anual"]),
  proximaEjecucion: z.string().min(1, "La próxima ejecución es requerida"),
  tareasPreventivas: z.string().optional(),
  activo: z.boolean().default(true),
});

type PlanFormValues = z.infer<typeof planSchema>;

const FRECUENCIAS = [
  { value: "semanal", label: "Semanal (7 días)" },
  { value: "mensual", label: "Mensual (30 días)" },
  { value: "trimestral", label: "Trimestral (90 días)" },
  { value: "semestral", label: "Semestral (180 días)" },
  { value: "anual", label: "Anual (365 días)" },
];

export default function CMmsPlanesPreventivos() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [filterEquipo, setFilterEquipo] = useState<string>("all");
  const [filterFrecuencia, setFilterFrecuencia] = useState<string>("all");
  const [filterActivo, setFilterActivo] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanPreventivo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanPreventivo | null>(null);

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      equipoId: "",
      nombrePlan: "",
      descripcion: "",
      frecuencia: "mensual",
      proximaEjecucion: new Date().toISOString().split('T')[0],
      tareasPreventivas: "",
      activo: true,
    },
  });

  // Fetch planes
  const { data: planes, isLoading } = useQuery<PlanPreventivo[]>({
    queryKey: ["/api/cmms/planes-preventivos", filterEquipo, filterFrecuencia, filterActivo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEquipo !== "all") params.append("equipoId", filterEquipo);
      if (filterFrecuencia !== "all") params.append("frecuencia", filterFrecuencia);
      if (filterActivo !== "all") params.append("activo", filterActivo);

      const response = await fetch(`/api/cmms/planes-preventivos?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar planes');
      return response.json();
    }
  });

  // Fetch equipos for dropdown
  const { data: equipos } = useQuery<Array<{ id: string; nombre: string; area: string | null }>>({
    queryKey: ["/api/cmms/equipos"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: PlanFormValues) => {
      return apiRequest("/api/cmms/planes-preventivos", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/planes-preventivos"] });
      toast({
        title: "Plan creado",
        description: "El plan preventivo ha sido creado exitosamente.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el plan preventivo.",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PlanFormValues }) => {
      return apiRequest(`/api/cmms/planes-preventivos/${id}`, {
        method: "PATCH",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/planes-preventivos"] });
      toast({
        title: "Plan actualizado",
        description: "El plan preventivo ha sido actualizado exitosamente.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el plan preventivo.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/cmms/planes-preventivos/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/planes-preventivos"] });
      toast({
        title: "Plan eliminado",
        description: "El plan preventivo ha sido eliminado exitosamente.",
      });
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el plan preventivo.",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingPlan(null);
    form.reset({
      equipoId: "",
      nombrePlan: "",
      descripcion: "",
      frecuencia: "mensual" as const,
      proximaEjecucion: new Date().toISOString().split('T')[0],
      tareasPreventivas: "",
      activo: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (plan: PlanPreventivo) => {
    setEditingPlan(plan);
    form.reset({
      equipoId: plan.equipoId,
      nombrePlan: plan.nombrePlan,
      descripcion: plan.descripcion || "",
      frecuencia: plan.frecuencia as any,
      proximaEjecucion: plan.proximaEjecucion.split('T')[0],
      tareasPreventivas: plan.tareasPreventivas || "",
      activo: plan.activo,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
    form.reset();
  };

  const handleSubmit = (data: PlanFormValues) => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenDeleteDialog = (plan: PlanPreventivo) => {
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (planToDelete) {
      deleteMutation.mutate(planToDelete.id);
    }
  };

  const getDaysUntilNext = (proximaEjecucion: string) => {
    return differenceInDays(new Date(proximaEjecucion), new Date());
  };

  const getStatusBadge = (dias: number, activo: boolean) => {
    if (!activo) {
      return <Badge variant="secondary">Inactivo</Badge>;
    }
    if (dias < 0) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Vencido ({Math.abs(dias)}d)
      </Badge>;
    }
    if (dias <= 7) {
      return <Badge variant="default" className="bg-yellow-500 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Próximo ({dias}d)
      </Badge>;
    }
    return <Badge variant="outline" className="flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" />
      Vigente ({dias}d)
    </Badge>;
  };

  // Calculate KPIs
  const totalPlanes = planes?.length || 0;
  const planesActivos = planes?.filter(p => p.activo).length || 0;
  const planesVencidos = planes?.filter(p => p.activo && getDaysUntilNext(p.proximaEjecucion) < 0).length || 0;
  const planesProximos = planes?.filter(p => p.activo && getDaysUntilNext(p.proximaEjecucion) >= 0 && getDaysUntilNext(p.proximaEjecucion) <= 7).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando planes preventivos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="page-cmms-planes-preventivos">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/cmms")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="text-title">
                <Calendar className="h-8 w-8" />
                Planes Preventivos
              </h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                Programación y seguimiento de mantenciones preventivas
              </p>
            </div>
          </div>
          <Button onClick={handleOpenCreateDialog} data-testid="button-create">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Plan
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Planes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-planes">{totalPlanes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-planes-activos">{planesActivos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500" data-testid="text-planes-vencidos">{planesVencidos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos (7d)</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-planes-proximos">{planesProximos}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Equipo</label>
                <Select value={filterEquipo} onValueChange={setFilterEquipo}>
                  <SelectTrigger data-testid="select-equipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {equipos?.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Frecuencia</label>
                <Select value={filterFrecuencia} onValueChange={setFilterFrecuencia}>
                  <SelectTrigger data-testid="select-frecuencia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {FRECUENCIAS.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <Select value={filterActivo} onValueChange={setFilterActivo}>
                  <SelectTrigger data-testid="select-activo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Activos</SelectItem>
                    <SelectItem value="false">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Planes Preventivos ({planes?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead>Última Ejecución</TableHead>
                    <TableHead>Próxima Ejecución</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planes?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No hay planes preventivos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    planes?.map((plan) => {
                      const diasRestantes = getDaysUntilNext(plan.proximaEjecucion);
                      return (
                        <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                          <TableCell className="font-medium">
                            {plan.equipo?.nombre || "N/A"}
                            {plan.equipo?.area && (
                              <span className="text-xs text-muted-foreground block">
                                {plan.equipo.area}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{plan.nombrePlan}</div>
                            {plan.descripcion && (
                              <div className="text-xs text-muted-foreground max-w-xs truncate">
                                {plan.descripcion}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {FRECUENCIAS.find(f => f.value === plan.frecuencia)?.label || plan.frecuencia}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {plan.ultimaEjecucion ? format(new Date(plan.ultimaEjecucion), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell>{format(new Date(plan.proximaEjecucion), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{getStatusBadge(diasRestantes, plan.activo)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditDialog(plan)}
                                data-testid={`button-edit-${plan.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDeleteDialog(plan)}
                                data-testid={`button-delete-${plan.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Editar Plan Preventivo" : "Crear Plan Preventivo"}
              </DialogTitle>
              <DialogDescription>
                {editingPlan 
                  ? "Modifica los datos del plan preventivo" 
                  : "Completa los datos para el nuevo plan preventivo"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Equipo */}
                  <FormField
                    control={form.control}
                    name="equipoId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipo *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="select-form-equipo">
                            <SelectValue placeholder="Seleccionar equipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {equipos?.map((eq) => (
                              <SelectItem key={eq.id} value={eq.id}>
                                {eq.nombre} {eq.area && `(${eq.area})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Nombre del Plan */}
                  <FormField
                    control={form.control}
                    name="nombrePlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Plan *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Lubricación mensual" data-testid="input-nombre-plan" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Frecuencia */}
                  <FormField
                    control={form.control}
                    name="frecuencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frecuencia *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="select-form-frecuencia">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FRECUENCIAS.map((freq) => (
                              <SelectItem key={freq.value} value={freq.value}>
                                {freq.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Próxima Ejecución */}
                  <FormField
                    control={form.control}
                    name="proximaEjecucion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Próxima Ejecución *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-proxima-ejecucion" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Descripción */}
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Detalles del plan" rows={2} data-testid="textarea-descripcion" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tareas Preventivas */}
                  <FormField
                    control={form.control}
                    name="tareasPreventivas"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Checklist de Tareas</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="1. Revisar lubricación&#10;2. Inspeccionar rodamientos&#10;3. Verificar tensión correas" rows={4} data-testid="textarea-tareas-preventivas" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Activo */}
                  <FormField
                    control={form.control}
                    name="activo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 md:col-span-2">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Plan Activo</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Activar/desactivar la generación automática de OTs
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-activo"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {editingPlan ? "Actualizar Plan" : "Crear Plan"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar este plan preventivo?
              </DialogDescription>
            </DialogHeader>
            {planToDelete && (
              <div className="space-y-2">
                <p className="text-sm"><strong>Plan:</strong> {planToDelete.nombrePlan}</p>
                <p className="text-sm"><strong>Equipo:</strong> {planToDelete.equipo?.nombre || "N/A"}</p>
                <p className="text-sm"><strong>Frecuencia:</strong> {FRECUENCIAS.find(f => f.value === planToDelete.frecuencia)?.label || planToDelete.frecuencia}</p>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setPlanToDelete(null);
                }}
                data-testid="button-cancel-delete"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
