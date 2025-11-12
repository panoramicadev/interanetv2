import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  ChevronRight,
  ChevronDown,
  Download,
  Eye,
} from "lucide-react";
import * as XLSX from 'xlsx';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const equipoCriticoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().optional(),
  area: z.enum([
    "administracion",
    "produccion",
    "laboratorio",
    "bodega_materias_primas",
    "bodega_productos_terminados",
  ]),
  ubicacion: z.string().optional(),
  criticidad: z.enum(["baja", "media", "alta", "critica"]),
  estadoActual: z.enum(["operativo", "en_mantencion", "detenido", "fuera_de_servicio"]),
  descripcion: z.string().optional(),
  fabricante: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerie: z.string().optional(),
  fechaInstalacion: z.string().optional(),
});

type EquipoCriticoFormData = z.infer<typeof equipoCriticoSchema>;

interface EquipoCritico {
  id: string;
  nombre: string;
  codigo: string | null;
  area: string;
  ubicacion: string | null;
  criticidad: string;
  estadoActual: string;
  descripcion: string | null;
  fabricante: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  fechaInstalacion: Date | null;
  equipoPadreId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export default function CMMSEquipos() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterCriticidad, setFilterCriticidad] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<EquipoCritico | null>(null);
  const [deletingEquipo, setDeletingEquipo] = useState<EquipoCritico | null>(null);
  const [viewingEquipo, setViewingEquipo] = useState<EquipoCritico | null>(null);
  const [expandedEquipos, setExpandedEquipos] = useState<Set<string>>(new Set());
  const [componentesMap, setComponentesMap] = useState<Record<string, EquipoCritico[]>>({});
  const [creatingComponentFor, setCreatingComponentFor] = useState<EquipoCritico | null>(null);

  // Fetch equipos
  const { data: equipos = [], isLoading } = useQuery<EquipoCritico[]>({
    queryKey: ['/api/cmms/equipos', filterArea, filterCriticidad, filterEstado],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterArea !== 'all') params.append('area', filterArea);
      if (filterCriticidad !== 'all') params.append('criticidad', filterCriticidad);
      if (filterEstado !== 'all') params.append('estadoActual', filterEstado);
      
      const url = `/api/cmms/equipos${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar equipos');
      return res.json();
    },
  });

  // Form
  const form = useForm<EquipoCriticoFormData>({
    resolver: zodResolver(equipoCriticoSchema),
    defaultValues: {
      nombre: "",
      codigo: "",
      area: "produccion",
      ubicacion: "",
      criticidad: "media",
      estadoActual: "operativo",
      descripcion: "",
      fabricante: "",
      modelo: "",
      numeroSerie: "",
      fechaInstalacion: "",
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: EquipoCriticoFormData) => {
      return apiRequest('/api/cmms/equipos', {
        method: 'POST',
        data,
      });
    },
    onSuccess: (newEquipo) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cmms/equipos'] });
      // If creating a component, invalidate the component cache for the parent
      if (creatingComponentFor) {
        setComponentesMap(prev => {
          const updated = { ...prev };
          delete updated[creatingComponentFor.id];
          return updated;
        });
        toast({ title: "Componente creado exitosamente" });
      } else {
        toast({ title: "Equipo creado exitosamente" });
      }
      setIsDialogOpen(false);
      setCreatingComponentFor(null);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Error creating equipo:", error);
      let description = error.message;
      
      // If there are validation errors, show them
      if (error.errors && Array.isArray(error.errors)) {
        description = error.errors.map((e: any) => `${e.path?.join('.')}: ${e.message}`).join(', ');
      }
      
      toast({ 
        title: creatingComponentFor ? "Error al crear componente" : "Error al crear equipo", 
        description,
        variant: "destructive" 
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EquipoCriticoFormData> }) => {
      return apiRequest(`/api/cmms/equipos/${id}`, {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cmms/equipos'] });
      toast({ title: "Equipo actualizado exitosamente" });
      setIsDialogOpen(false);
      setEditingEquipo(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al actualizar equipo", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/cmms/equipos/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cmms/equipos'] });
      toast({ title: "Equipo eliminado exitosamente" });
      setDeletingEquipo(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al eliminar equipo", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleOpenDialog = (equipo?: EquipoCritico) => {
    if (equipo) {
      setEditingEquipo(equipo);
      setCreatingComponentFor(null);
      form.reset({
        nombre: equipo.nombre,
        codigo: equipo.codigo || "",
        area: equipo.area as any,
        ubicacion: equipo.ubicacion || "",
        criticidad: equipo.criticidad as any,
        estadoActual: equipo.estadoActual as any,
        descripcion: equipo.descripcion || "",
        fabricante: equipo.fabricante || "",
        modelo: equipo.modelo || "",
        numeroSerie: equipo.numeroSerie || "",
        fechaInstalacion: equipo.fechaInstalacion ? new Date(equipo.fechaInstalacion).toISOString().split('T')[0] : "",
      });
    } else {
      setEditingEquipo(null);
      setCreatingComponentFor(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const handleOpenComponentDialog = (equipoPadre: EquipoCritico) => {
    setCreatingComponentFor(equipoPadre);
    setEditingEquipo(null);
    // Pre-fill with parent's area and criticidad
    form.reset({
      nombre: "",
      codigo: "",
      area: equipoPadre.area as any,
      ubicacion: "",
      criticidad: equipoPadre.criticidad as any,
      estadoActual: "operativo" as any,
      descripcion: "",
      fabricante: "",
      modelo: "",
      numeroSerie: "",
      fechaInstalacion: "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: EquipoCriticoFormData) => {
    if (editingEquipo) {
      updateMutation.mutate({ id: editingEquipo.id, data });
    } else {
      // If creating a component, include equipoPadreId
      const dataWithParent = creatingComponentFor 
        ? { ...data, equipoPadreId: creatingComponentFor.id }
        : data;
      createMutation.mutate(dataWithParent);
    }
  };

  const handleDelete = (equipo: EquipoCritico) => {
    setDeletingEquipo(equipo);
  };

  const confirmDelete = () => {
    if (deletingEquipo) {
      deleteMutation.mutate(deletingEquipo.id);
    }
  };

  // Toggle expand/collapse for equipment
  const toggleExpand = async (equipoId: string) => {
    const newExpanded = new Set(expandedEquipos);
    
    if (newExpanded.has(equipoId)) {
      newExpanded.delete(equipoId);
      setExpandedEquipos(newExpanded);
    } else {
      newExpanded.add(equipoId);
      setExpandedEquipos(newExpanded);
      
      // Load components if not already loaded
      if (!componentesMap[equipoId]) {
        try {
          const res = await fetch(`/api/cmms/equipos/${equipoId}/componentes`, { 
            credentials: 'include' 
          });
          if (res.ok) {
            const componentes = await res.json();
            setComponentesMap(prev => ({ ...prev, [equipoId]: componentes }));
          }
        } catch (error) {
          console.error('Error loading components:', error);
        }
      }
    }
  };

  // Filter to show only main equipment (without parent)
  const equiposPrincipales = equipos.filter(eq => !eq.equipoPadreId);
  
  // Filter equipos by search term
  const filteredEquipos = equiposPrincipales.filter(equipo => 
    equipo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipo.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipo.fabricante?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCriticidadBadge = (criticidad: string) => {
    const colors = {
      baja: "bg-green-100 text-green-800",
      media: "bg-yellow-100 text-yellow-800",
      alta: "bg-orange-100 text-orange-800",
      critica: "bg-red-100 text-red-800",
    };
    return colors[criticidad as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getEstadoBadge = (estado: string) => {
    const colors = {
      operativo: "bg-green-100 text-green-800",
      en_mantencion: "bg-yellow-100 text-yellow-800",
      detenido: "bg-red-100 text-red-800",
      fuera_de_servicio: "bg-gray-100 text-gray-800",
    };
    return colors[estado as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getAreaLabel = (area: string) => {
    const labels: Record<string, string> = {
      administracion: "Administración",
      produccion: "Producción",
      laboratorio: "Laboratorio",
      bodega_materias_primas: "Bodega Materias Primas",
      bodega_productos_terminados: "Bodega Productos Terminados",
    };
    return labels[area] || area;
  };

  const exportToExcel = () => {
    const dataToExport = equipos.map((equipo) => ({
      Código: equipo.codigo || '',
      Nombre: equipo.nombre,
      Área: getAreaLabel(equipo.area),
      Ubicación: equipo.ubicacion || '',
      Criticidad: equipo.criticidad,
      Estado: equipo.estadoActual,
      Fabricante: equipo.fabricante || '',
      Modelo: equipo.modelo || '',
      'Número Serie': equipo.numeroSerie || '',
      'Fecha Instalación': equipo.fechaInstalacion ? new Date(equipo.fechaInstalacion).toLocaleDateString('es-CL') : '',
      Descripción: equipo.descripcion || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos Críticos');
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `equipos-criticos-${today}.xlsx`);
    
    toast({ title: "Excel exportado exitosamente" });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="page-cmms-equipos">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/cmms')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-title">
                Equipos Críticos
              </h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                Gestión de equipos críticos de producción
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={exportToExcel} 
              data-testid="button-export-excel"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button onClick={() => handleOpenDialog()} data-testid="button-create">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Equipo
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar equipo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>

              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger data-testid="select-area">
                  <SelectValue placeholder="Todas las áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  <SelectItem value="administracion">Administración</SelectItem>
                  <SelectItem value="produccion">Producción</SelectItem>
                  <SelectItem value="laboratorio">Laboratorio</SelectItem>
                  <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                  <SelectItem value="bodega_productos_terminados">Bodega Productos Terminados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCriticidad} onValueChange={setFilterCriticidad}>
                <SelectTrigger data-testid="select-criticidad">
                  <SelectValue placeholder="Todas las criticidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las criticidades</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger data-testid="select-estado">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="operativo">Operativo</SelectItem>
                  <SelectItem value="en_mantencion">En Mantención</SelectItem>
                  <SelectItem value="detenido">Detenido</SelectItem>
                  <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Cargando equipos...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Criticidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron equipos
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEquipos.map((equipo) => {
                      const isExpanded = expandedEquipos.has(equipo.id);
                      const componentes = componentesMap[equipo.id] || [];
                      
                      return (
                        <>
                          {/* Equipo Principal */}
                          <TableRow key={equipo.id} data-testid={`row-equipo-${equipo.id}`} className="bg-background">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpand(equipo.id)}
                                  className="h-6 w-6 p-0"
                                  data-testid={`button-expand-${equipo.id}`}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                                <span>{equipo.nombre}</span>
                              </div>
                            </TableCell>
                            <TableCell>{equipo.codigo || "-"}</TableCell>
                            <TableCell>{getAreaLabel(equipo.area)}</TableCell>
                            <TableCell>
                              <Badge className={getCriticidadBadge(equipo.criticidad)}>
                                {equipo.criticidad.charAt(0).toUpperCase() + equipo.criticidad.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getEstadoBadge(equipo.estadoActual)}>
                                {equipo.estadoActual.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>{equipo.fabricante || "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingEquipo(equipo)}
                                  data-testid={`button-view-${equipo.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDialog(equipo)}
                                  data-testid={`button-edit-${equipo.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(equipo)}
                                  data-testid={`button-delete-${equipo.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Componentes (si está expandido) */}
                          {isExpanded && componentes.length > 0 && (
                            componentes.map((componente) => (
                              <TableRow 
                                key={componente.id} 
                                data-testid={`row-componente-${componente.id}`}
                                className="bg-muted/30"
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2 pl-10">
                                    <span className="text-muted-foreground text-sm">└─</span>
                                    <span className="text-sm">{componente.nombre}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{componente.codigo || "-"}</TableCell>
                                <TableCell className="text-sm">{getAreaLabel(componente.area)}</TableCell>
                                <TableCell>
                                  <Badge className={getCriticidadBadge(componente.criticidad)}>
                                    {componente.criticidad.charAt(0).toUpperCase() + componente.criticidad.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getEstadoBadge(componente.estadoActual)}>
                                    {componente.estadoActual.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{componente.fabricante || "-"}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setViewingEquipo(componente)}
                                      data-testid={`button-view-${componente.id}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenDialog(componente)}
                                      data-testid={`button-edit-${componente.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(componente)}
                                      data-testid={`button-delete-${componente.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          
                          {/* Botón para agregar componente */}
                          {isExpanded && (
                            <TableRow className="bg-muted/10">
                              <TableCell colSpan={7} className="text-center py-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenComponentDialog(equipo)}
                                  data-testid={`button-add-component-${equipo.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Agregar Componente a {equipo.nombre}
                                </Button>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEquipo 
                ? "Editar Equipo" 
                : creatingComponentFor 
                  ? `Agregar Componente a ${creatingComponentFor.nombre}` 
                  : "Nuevo Equipo Principal"
              }
            </DialogTitle>
            <DialogDescription>
              {creatingComponentFor 
                ? "Complete los detalles del componente. Los campos están pre-llenados con valores del equipo padre."
                : "Complete los detalles del equipo crítico"
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: Reactor Principal" data-testid="input-nombre" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="codigo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: EQ-001" data-testid="input-codigo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-form-area">
                            <SelectValue placeholder="Seleccionar área" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="administracion">Administración</SelectItem>
                          <SelectItem value="produccion">Producción</SelectItem>
                          <SelectItem value="laboratorio">Laboratorio</SelectItem>
                          <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                          <SelectItem value="bodega_productos_terminados">Bodega Productos Terminados</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ubicacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ubicación</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: Sala de Reactores" data-testid="input-ubicacion" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="criticidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Criticidad *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-form-criticidad">
                            <SelectValue placeholder="Seleccionar criticidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="baja">Baja</SelectItem>
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="critica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estadoActual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-form-estado">
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="operativo">Operativo</SelectItem>
                          <SelectItem value="en_mantencion">En Mantención</SelectItem>
                          <SelectItem value="detenido">Detenido</SelectItem>
                          <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Descripción del equipo" rows={3} data-testid="textarea-descripcion" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fabricante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabricante</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: Siemens" data-testid="input-fabricante" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: XR-500" data-testid="input-modelo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numeroSerie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Serie</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: SN12345" data-testid="input-numero-serie" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="fechaInstalacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Instalación</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-fecha-instalacion" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>Guardando...</>
                  ) : (
                    <>{editingEquipo ? "Actualizar" : "Crear"}</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Equipment Details Dialog */}
      <Dialog open={!!viewingEquipo} onOpenChange={(open) => { if (!open) setViewingEquipo(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="modal-view-equipo">
          <DialogHeader>
            <DialogTitle data-testid="text-view-title">Detalles del Equipo</DialogTitle>
            <DialogDescription data-testid="text-view-description">
              Información completa del equipo crítico
            </DialogDescription>
          </DialogHeader>

          {viewingEquipo && (
            <div className="space-y-6" data-testid="container-view-details">
              {/* Información General */}
              <div data-testid="section-general">
                <h3 className="text-lg font-semibold mb-3">Información General</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre</p>
                    <p className="font-medium" data-testid="text-view-nombre">{viewingEquipo.nombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Código</p>
                    <p className="font-medium" data-testid="text-view-codigo">{viewingEquipo.codigo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Área</p>
                    <p className="font-medium" data-testid="text-view-area">{getAreaLabel(viewingEquipo.area)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ubicación</p>
                    <p className="font-medium" data-testid="text-view-ubicacion">{viewingEquipo.ubicacion || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Criticidad</p>
                    <Badge className={getCriticidadBadge(viewingEquipo.criticidad)} data-testid="badge-view-criticidad">
                      {viewingEquipo.criticidad.charAt(0).toUpperCase() + viewingEquipo.criticidad.slice(1)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado Actual</p>
                    <Badge className={getEstadoBadge(viewingEquipo.estadoActual)} data-testid="badge-view-estado">
                      {viewingEquipo.estadoActual.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Descripción */}
              {viewingEquipo.descripcion && (
                <div data-testid="section-descripcion">
                  <h3 className="text-lg font-semibold mb-2">Descripción</h3>
                  <p className="text-sm" data-testid="text-view-descripcion">{viewingEquipo.descripcion}</p>
                </div>
              )}

              {/* Información Técnica */}
              <div data-testid="section-tecnica">
                <h3 className="text-lg font-semibold mb-3">Información Técnica</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Fabricante</p>
                    <p className="font-medium" data-testid="text-view-fabricante">{viewingEquipo.fabricante || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Modelo</p>
                    <p className="font-medium" data-testid="text-view-modelo">{viewingEquipo.modelo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Número de Serie</p>
                    <p className="font-medium" data-testid="text-view-numero-serie">{viewingEquipo.numeroSerie || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de Instalación</p>
                    <p className="font-medium" data-testid="text-view-fecha-instalacion">
                      {viewingEquipo.fechaInstalacion 
                        ? new Date(viewingEquipo.fechaInstalacion).toLocaleDateString('es-CL')
                        : "-"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Fechas de creación/actualización */}
              <div data-testid="section-registro">
                <h3 className="text-lg font-semibold mb-3">Registro</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                    <p className="font-medium" data-testid="text-view-created-at">
                      {viewingEquipo.createdAt 
                        ? new Date(viewingEquipo.createdAt).toLocaleString('es-CL')
                        : "-"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Última Actualización</p>
                    <p className="font-medium" data-testid="text-view-updated-at">
                      {viewingEquipo.updatedAt 
                        ? new Date(viewingEquipo.updatedAt).toLocaleString('es-CL')
                        : "-"
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewingEquipo(null)}
              data-testid="button-close-view"
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setViewingEquipo(null);
                handleOpenDialog(viewingEquipo);
              }}
              data-testid="button-edit-from-view"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingEquipo} onOpenChange={() => setDeletingEquipo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el equipo "{deletingEquipo?.nombre}"?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingEquipo(null)}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
