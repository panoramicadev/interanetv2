import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Plus, Calendar, DollarSign, Edit, Trash2, Factory } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface MantencionPlanificada {
  id: string;
  equipoId: string | null;
  equipoNombre: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  costoEstimado: string;
  mes: number;
  anio: number;
  area: string | null;
  estado: string;
  prioridad: string | null;
  notas: string | null;
  otGeneradaId: string | null;
  creadoPorId: string;
  creadoPorName: string | null;
  createdAt: string;
  updatedAt: string;
}

const mantencionSchema = z.object({
  equipoNombre: z.string().min(1, "El nombre del equipo es requerido"),
  equipoId: z.string().optional(),
  titulo: z.string().min(1, "El título es requerido"),
  descripcion: z.string().optional(),
  categoria: z.enum(["gran_mantenimiento", "overhaul", "rectificacion", "reemplazo", "mejora"]),
  costoEstimado: z.string().min(1, "El costo estimado es requerido"),
  mes: z.coerce.number().min(1).max(12),
  anio: z.coerce.number().min(2020).max(2100),
  area: z.string().optional(),
  estado: z.enum(["planificado", "aprobado", "en_ejecucion", "completado", "cancelado"]).default("planificado"),
  prioridad: z.enum(["baja", "media", "alta"]).default("media"),
  notas: z.string().optional(),
});

type MantencionFormValues = z.infer<typeof mantencionSchema>;

const CATEGORIAS = [
  { value: "gran_mantenimiento", label: "Gran Mantenimiento" },
  { value: "overhaul", label: "Overhaul Completo" },
  { value: "rectificacion", label: "Rectificación" },
  { value: "reemplazo", label: "Reemplazo de Equipo" },
  { value: "mejora", label: "Mejora / Actualización" },
];

const ESTADOS = [
  { value: "planificado", label: "Planificado", color: "bg-blue-100 text-blue-800" },
  { value: "aprobado", label: "Aprobado", color: "bg-green-100 text-green-800" },
  { value: "en_ejecucion", label: "En Ejecución", color: "bg-yellow-100 text-yellow-800" },
  { value: "completado", label: "Completado", color: "bg-gray-100 text-gray-800" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800" },
];

const PRIORIDADES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const AREAS = [
  { value: "produccion", label: "Producción" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "bodega_materias_primas", label: "Bodega Materias Primas" },
  { value: "bodega_productos_terminados", label: "Bodega Productos Terminados" },
  { value: "administracion", label: "Administración" },
];

export default function CmmsMantencionesPlanificadas() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const [filterAnio, setFilterAnio] = useState<number>(currentYear);
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMantencion, setEditingMantencion] = useState<MantencionPlanificada | null>(null);

  const form = useForm<MantencionFormValues>({
    resolver: zodResolver(mantencionSchema),
    defaultValues: {
      equipoNombre: "",
      equipoId: "",
      titulo: "",
      descripcion: "",
      categoria: "gran_mantenimiento",
      costoEstimado: "",
      mes: new Date().getMonth() + 1,
      anio: currentYear,
      area: "",
      estado: "planificado",
      prioridad: "media",
      notas: "",
    },
  });

  // Fetch mantenciones planificadas
  const { data: mantenciones, isLoading } = useQuery<MantencionPlanificada[]>({
    queryKey: ["/api/cmms/mantenciones-planificadas", filterAnio, filterEstado, filterArea],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("anio", filterAnio.toString());
      if (filterEstado !== "all") params.append("estado", filterEstado);
      if (filterArea !== "all") params.append("area", filterArea);

      const response = await fetch(`/api/cmms/mantenciones-planificadas?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar mantenciones planificadas');
      return response.json();
    }
  });

  // Fetch equipos for dropdown
  const { data: equipos } = useQuery({
    queryKey: ["/api/cmms/equipos"],
    queryFn: async () => {
      const response = await fetch('/api/cmms/equipos', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar equipos');
      return response.json();
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: MantencionFormValues) => {
      return await apiRequest({
        url: '/api/cmms/mantenciones-planificadas',
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/mantenciones-planificadas"] });
      toast({
        title: "Éxito",
        description: "Mantención planificada creada exitosamente",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MantencionFormValues> }) => {
      return await apiRequest({
        url: `/api/cmms/mantenciones-planificadas/${id}`,
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/mantenciones-planificadas"] });
      toast({
        title: "Éxito",
        description: "Mantención planificada actualizada exitosamente",
      });
      setDialogOpen(false);
      setEditingMantencion(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest({
        url: `/api/cmms/mantenciones-planificadas/${id}`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/mantenciones-planificadas"] });
      toast({
        title: "Éxito",
        description: "Mantención planificada eliminada exitosamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MantencionFormValues) => {
    if (editingMantencion) {
      updateMutation.mutate({ id: editingMantencion.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (mantencion: MantencionPlanificada) => {
    setEditingMantencion(mantencion);
    form.reset({
      equipoNombre: mantencion.equipoNombre,
      equipoId: mantencion.equipoId || "",
      titulo: mantencion.titulo,
      descripcion: mantencion.descripcion || "",
      categoria: mantencion.categoria as any,
      costoEstimado: mantencion.costoEstimado,
      mes: mantencion.mes,
      anio: mantencion.anio,
      area: mantencion.area || "",
      estado: mantencion.estado as any,
      prioridad: (mantencion.prioridad || "media") as any,
      notas: mantencion.notas || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("¿Está seguro de eliminar esta mantención planificada?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMantencion(null);
    form.reset();
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getEstadoBadgeColor = (estado: string) => {
    return ESTADOS.find(e => e.value === estado)?.color || "bg-gray-100 text-gray-800";
  };

  const totalCostoEstimado = mantenciones?.reduce((sum, m) => sum + parseFloat(m.costoEstimado), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/cmms-dashboard')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mantenciones Planificadas</h1>
              <p className="text-gray-600 mt-1">Proyectos grandes y mantenciones futuras</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-create">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Mantención
          </Button>
        </div>

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Planificado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCostoEstimado)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Mantenciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mantenciones?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Aprobadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {mantenciones?.filter(m => m.estado === 'aprobado').length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">En Ejecución</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {mantenciones?.filter(m => m.estado === 'en_ejecucion').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Año</label>
                <Select
                  value={filterAnio.toString()}
                  onValueChange={(value) => setFilterAnio(parseInt(value))}
                >
                  <SelectTrigger data-testid="filter-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026, 2027, 2028].map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Estado</label>
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ESTADOS.map(estado => (
                      <SelectItem key={estado.value} value={estado.value}>
                        {estado.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Área</label>
                <Select value={filterArea} onValueChange={setFilterArea}>
                  <SelectTrigger data-testid="filter-area">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {AREAS.map(area => (
                      <SelectItem key={area.value} value={area.value}>
                        {area.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Mantenciones Planificadas {filterAnio}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando...</div>
            ) : mantenciones && mantenciones.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Equipo / Proyecto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Costo Estimado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mantenciones.map((mantencion) => (
                      <TableRow key={mantencion.id} data-testid={`row-mantencion-${mantencion.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">
                              {MESES.find(m => m.value === mantencion.mes)?.label} {mantencion.anio}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{mantencion.titulo}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Factory className="h-3 w-3" />
                              {mantencion.equipoNombre}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {CATEGORIAS.find(c => c.value === mantencion.categoria)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-semibold text-green-700">
                            <DollarSign className="h-4 w-4" />
                            {formatCurrency(mantencion.costoEstimado)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getEstadoBadgeColor(mantencion.estado)}>
                            {ESTADOS.find(e => e.value === mantencion.estado)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            mantencion.prioridad === 'alta' ? 'destructive' :
                            mantencion.prioridad === 'media' ? 'default' : 'secondary'
                          }>
                            {mantencion.prioridad?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(mantencion)}
                              data-testid={`button-edit-${mantencion.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(mantencion.id)}
                              className="text-red-600 hover:text-red-700"
                              data-testid={`button-delete-${mantencion.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay mantenciones planificadas para el año {filterAnio}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMantencion ? "Editar Mantención Planificada" : "Nueva Mantención Planificada"}
              </DialogTitle>
              <DialogDescription>
                Configure una mantención grande o proyecto futuro para planificación presupuestaria
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="titulo"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Título del Proyecto</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: Rectificación Eje Dispersora"
                            {...field}
                            data-testid="input-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipoNombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipo / Sistema</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nombre del equipo"
                            {...field}
                            data-testid="input-equipment"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Seleccione categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIAS.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
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
                    name="mes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mes Planificado</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-month">
                              <SelectValue placeholder="Seleccione mes" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MESES.map((mes) => (
                              <SelectItem key={mes.value} value={mes.value.toString()}>
                                {mes.label}
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
                    name="anio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="2020"
                            max="2100"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="costoEstimado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo Estimado (CLP)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: 5000000"
                            {...field}
                            data-testid="input-cost"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Área (Opcional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-area">
                              <SelectValue placeholder="Seleccione área" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AREAS.map((area) => (
                              <SelectItem key={area.value} value={area.value}>
                                {area.label}
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
                    name="estado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Seleccione estado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ESTADOS.map((estado) => (
                              <SelectItem key={estado.value} value={estado.value}>
                                {estado.label}
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
                    name="prioridad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridad</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue placeholder="Seleccione prioridad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIORIDADES.map((prioridad) => (
                              <SelectItem key={prioridad.value} value={prioridad.value}>
                                {prioridad.label}
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
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Descripción (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Detalles del proyecto o alcance de la mantención"
                            rows={3}
                            {...field}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notas"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Notas Adicionales (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Notas internas, consideraciones especiales"
                            rows={2}
                            {...field}
                            data-testid="textarea-notes"
                          />
                        </FormControl>
                        <FormMessage />
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
                    {editingMantencion ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
