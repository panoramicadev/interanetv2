import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, DollarSign, FileText, Calendar, CheckCircle, XCircle, Clock, Loader2, Package, AlertTriangle, Edit, Trash2, X, Circle, CheckSquare, ChevronLeft, ChevronRight, ClipboardList, Play, Check, Target, Search, ExternalLink } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateForAPI, parseDateFromAPI } from "@/lib/dateUtils";

interface SolicitudMarketing {
  id: string;
  titulo: string;
  descripcion: string;
  monto: string | null;
  urgencia: 'baja' | 'media' | 'alta';
  urlReferencia: string | null;
  pdfPresupuesto: string | null;
  pasos: { nombre: string; completado: boolean; orden: number }[] | null;
  notas: string | null;
  estado: string;
  supervisorId: string | null;
  supervisorName: string | null;
  fechaSolicitud: string;
  fechaEntrega: string | null;
  fechaCompletado: string | null;
  motivoRechazo: string | null;
  mes: number;
  anio: number;
}

interface MarketingMetrics {
  presupuestoTotal: number;
  presupuestoUtilizado: number;
  presupuestoDisponible: number;
  totalSolicitudes: number;
  solicitudesPorEstado: {
    solicitado: number;
    en_proceso: number;
    completado: number;
    rechazado: number;
  };
}

interface HitoMarketing {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  tipo: 'general' | 'campaña' | 'evento' | 'deadline';
  color: string;
  completado: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TareaMarketing {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  prioridad: 'baja' | 'media' | 'alta';
  fechaLimite: string | null;
  solicitudId: string | null;
  asignadoAId: string | null;
  asignadoANombre: string | null;
  creadoPorId: string;
  creadoPorNombre: string | null;
  completadoEn: string | null;
  mes: number;
  anio: number;
  createdAt: string;
  updatedAt: string;
}

export default function Marketing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState(currentDate.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(currentDate.getFullYear());
  const [selectedEstado, setSelectedEstado] = useState<string>("todos");
  const [presupuestoDialogOpen, setPresupuestoDialogOpen] = useState(false);
  const [solicitudDialogOpen, setSolicitudDialogOpen] = useState(false);
  const [estadoDialogOpen, setEstadoDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudMarketing | null>(null);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-spinner" />
      </div>
    );
  }

  // Only admin, supervisor and salesperson can access marketing module
  if (user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'salesperson') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>No tienes permisos para acceder a este módulo.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const mesesNombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const estadosConfig = {
    solicitado: { label: "Solicitado", color: "bg-blue-500", icon: Clock },
    en_proceso: { label: "En Proceso", color: "bg-yellow-500", icon: TrendingUp },
    completado: { label: "Completado", color: "bg-green-500", icon: CheckCircle },
    rechazado: { label: "Rechazado", color: "bg-red-500", icon: XCircle },
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Marketing</h1>
        <p className="text-muted-foreground">Gestión de presupuesto, solicitudes e inventario de marketing</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="solicitudes" className="w-full">
        <TabsList className={`grid w-full h-auto ${user.role === 'salesperson' ? 'grid-cols-2' : 'grid-cols-7'}`}>
          <TabsTrigger value="solicitudes" data-testid="tab-solicitudes" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            <span>Solicitudes</span>
          </TabsTrigger>
          <TabsTrigger value="inventario" data-testid="tab-inventario" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
            <Package className="h-4 w-4" />
            <span>Inventario</span>
          </TabsTrigger>
          {(user.role === 'admin' || user.role === 'supervisor') && (
            <TabsTrigger value="tareas" data-testid="tab-tareas" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <ClipboardList className="h-4 w-4" />
              <span>Tareas</span>
            </TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'supervisor') && (
            <TabsTrigger value="calendario" data-testid="tab-calendario" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span>Calendario</span>
            </TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'supervisor') && (
            <TabsTrigger value="competencia" data-testid="tab-competencia" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <Target className="h-4 w-4" />
              <span>Competencia</span>
            </TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'supervisor') && (
            <TabsTrigger value="presupuesto" data-testid="tab-presupuesto" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Presupuesto</span>
            </TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'supervisor') && (
            <TabsTrigger value="seo" data-testid="tab-seo" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Posicionamiento</span>
              <span className="sm:hidden">SEO</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab: Solicitudes */}
        <TabsContent value="solicitudes" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button 
              onClick={() => setSolicitudDialogOpen(true)}
              data-testid="button-nueva-solicitud"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva Solicitud
            </Button>
          </div>

          {/* Period Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Mes</Label>
                  <Select
                    value={selectedMes.toString()}
                    onValueChange={(value) => setSelectedMes(parseInt(value))}
                  >
                    <SelectTrigger data-testid="select-mes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mesesNombres.map((mes, index) => (
                        <SelectItem key={index + 1} value={(index + 1).toString()}>
                          {mes}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Año</Label>
                  <Select
                    value={selectedAnio.toString()}
                    onValueChange={(value) => setSelectedAnio(parseInt(value))}
                  >
                    <SelectTrigger data-testid="select-anio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((anio) => (
                        <SelectItem key={anio} value={anio.toString()}>
                          {anio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <SolicitudesList
            mes={selectedMes}
            anio={selectedAnio}
            selectedEstado={selectedEstado}
            onEstadoChange={setSelectedEstado}
            onEditEstado={(solicitud) => {
              setSelectedSolicitud(solicitud);
              setEstadoDialogOpen(true);
            }}
            onEdit={(solicitud) => {
              setSelectedSolicitud(solicitud);
              setEditDialogOpen(true);
            }}
            onDelete={(solicitud) => {
              setSelectedSolicitud(solicitud);
              setDeleteDialogOpen(true);
            }}
            onView={(solicitud) => {
              setSelectedSolicitud(solicitud);
              setViewDialogOpen(true);
            }}
            userRole={user.role}
          />
        </TabsContent>

        {/* Tab: Inventario */}
        <TabsContent value="inventario" className="space-y-6">
          <InventarioMarketing userRole={user.role} />
        </TabsContent>

        {/* Tab: Tareas */}
        <TabsContent value="tareas" className="space-y-6">
          <TareasMarketing 
            mes={selectedMes} 
            anio={selectedAnio} 
            userRole={user.role}
          />
        </TabsContent>

        {/* Tab: Calendario */}
        <TabsContent value="calendario" className="space-y-6">
          <CalendarioHitos 
            mes={selectedMes} 
            anio={selectedAnio} 
            userRole={user.role}
            onMesChange={setSelectedMes}
            onAnioChange={setSelectedAnio}
          />
        </TabsContent>

        {/* Tab: Precios de Competencia */}
        {(user.role === 'admin' || user.role === 'supervisor') && (
          <TabsContent value="competencia" className="space-y-6">
            <PreciosCompetencia userRole={user.role} />
          </TabsContent>
        )}

        {/* Tab: Presupuesto (solo admin y supervisor) */}
        {(user.role === 'admin' || user.role === 'supervisor') && (
          <TabsContent value="presupuesto" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">Presupuesto de Marketing</h2>
                <p className="text-muted-foreground">Gestión y seguimiento del presupuesto mensual</p>
              </div>
              {user.role === 'admin' && (
                <Button 
                  onClick={() => setPresupuestoDialogOpen(true)}
                  data-testid="button-config-presupuesto"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Configurar Presupuesto
                </Button>
              )}
            </div>

            {/* Period Selector for Budget */}
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label>Mes</Label>
                    <Select
                      value={selectedMes.toString()}
                      onValueChange={(value) => setSelectedMes(parseInt(value))}
                    >
                      <SelectTrigger data-testid="select-mes-presupuesto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mesesNombres.map((mes, index) => (
                          <SelectItem key={index + 1} value={(index + 1).toString()}>
                            {mes}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Año</Label>
                    <Select
                      value={selectedAnio.toString()}
                      onValueChange={(value) => setSelectedAnio(parseInt(value))}
                    >
                      <SelectTrigger data-testid="select-anio-presupuesto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map((anio) => (
                          <SelectItem key={anio} value={anio.toString()}>
                            {anio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <MetricsDashboard mes={selectedMes} anio={selectedAnio} />
          </TabsContent>
        )}

        {/* Tab: Posicionamiento Web (solo admin y supervisor) */}
        {(user.role === 'admin' || user.role === 'supervisor') && (
          <TabsContent value="seo" className="space-y-6">
            <SeoTracking />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <PresupuestoDialog
        open={presupuestoDialogOpen}
        onOpenChange={setPresupuestoDialogOpen}
        mes={selectedMes}
        anio={selectedAnio}
      />

      <SolicitudDialog
        open={solicitudDialogOpen}
        onOpenChange={setSolicitudDialogOpen}
        mes={selectedMes}
        anio={selectedAnio}
      />

      <EstadoDialog
        open={estadoDialogOpen}
        onOpenChange={setEstadoDialogOpen}
        solicitud={selectedSolicitud}
      />

      <EditSolicitudDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        solicitud={selectedSolicitud}
      />

      <DeleteSolicitudDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        solicitud={selectedSolicitud}
      />

      <ViewSolicitudDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        solicitud={selectedSolicitud}
        userRole={user.role}
      />
    </div>
  );
}

// Metrics Dashboard Component
function MetricsDashboard({ mes, anio }: { mes: number; anio: number }) {
  const { data: metrics, isLoading } = useQuery<MarketingMetrics>({
    queryKey: ['/api/marketing/metrics', mes, anio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/metrics/${mes}/${anio}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar métricas');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cargando...</CardTitle>
            </CardHeader>
            <CardContent>
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const presupuestoUtilizadoPct = metrics
    ? (metrics.presupuestoUtilizado / metrics.presupuestoTotal) * 100
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card data-testid="card-presupuesto-total">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${metrics && metrics.presupuestoTotal != null ? metrics.presupuestoTotal.toLocaleString('es-CL') : '0'}
          </div>
          <p className="text-xs text-muted-foreground">
            Presupuesto mensual asignado
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-presupuesto-utilizado">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Presupuesto Utilizado</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${metrics && metrics.presupuestoUtilizado != null ? metrics.presupuestoUtilizado.toLocaleString('es-CL') : '0'}
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  presupuestoUtilizadoPct > 90 ? 'bg-red-500' : 
                  presupuestoUtilizadoPct > 70 ? 'bg-yellow-500' : 
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(presupuestoUtilizadoPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {presupuestoUtilizadoPct.toFixed(1)}% utilizado
            </p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-presupuesto-disponible">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Presupuesto Disponible</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${metrics && metrics.presupuestoDisponible != null ? metrics.presupuestoDisponible.toLocaleString('es-CL') : '0'}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics?.totalSolicitudes || 0} solicitudes totales
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Pasos Checklist Component
function PasosChecklist({
  solicitudId,
  pasos,
  userRole,
}: {
  solicitudId: string;
  pasos: { nombre: string; completado: boolean; orden: number }[];
  userRole: string;
}) {
  const { toast } = useToast();

  const togglePasoMutation = useMutation({
    mutationFn: async ({ index }: { index: number }) => {
      return await apiRequest('PATCH', `/api/marketing/solicitudes/${solicitudId}/pasos/${index}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el paso",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (index: number) => {
    if (userRole === 'admin' || userRole === 'supervisor') {
      togglePasoMutation.mutate({ index });
    }
  };

  if (!pasos || pasos.length === 0) {
    return <span className="text-muted-foreground italic text-sm">Sin pasos</span>;
  }

  return (
    <div className="space-y-1">
      {pasos.map((paso, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={paso.completado}
            onChange={() => handleToggle(index)}
            disabled={userRole !== 'admin' && userRole !== 'supervisor'}
            className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
            data-testid={`checkbox-paso-${index}`}
          />
          <span className={`text-sm ${paso.completado ? 'line-through text-muted-foreground' : ''}`}>
            {paso.nombre}
          </span>
        </div>
      ))}
    </div>
  );
}

// Solicitudes List Component
function SolicitudesList({
  mes,
  anio,
  selectedEstado,
  onEstadoChange,
  onEditEstado,
  onEdit,
  onDelete,
  onView,
  userRole,
}: {
  mes: number;
  anio: number;
  selectedEstado: string;
  onEstadoChange: (estado: string) => void;
  onEditEstado: (solicitud: SolicitudMarketing) => void;
  onEdit: (solicitud: SolicitudMarketing) => void;
  onDelete: (solicitud: SolicitudMarketing) => void;
  onView: (solicitud: SolicitudMarketing) => void;
  userRole: string;
}) {
  const { data: solicitudes, isLoading } = useQuery<SolicitudMarketing[]>({
    queryKey: ['/api/marketing/solicitudes', mes, anio, selectedEstado],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('mes', mes.toString());
      params.append('anio', anio.toString());
      if (selectedEstado !== 'todos') {
        params.append('estado', selectedEstado);
      }
      
      const response = await fetch(`/api/marketing/solicitudes?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar solicitudes');
      }
      return response.json();
    },
  });

  const estadosConfig = {
    solicitado: { label: "Solicitado", variant: "secondary" as const },
    en_proceso: { label: "En Proceso", variant: "default" as const },
    completado: { label: "Completado", variant: "default" as const },
    rechazado: { label: "destructive" as const, variant: "destructive" as const },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <CardTitle>Solicitudes de Marketing</CardTitle>
          <Select value={selectedEstado} onValueChange={onEstadoChange}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-estado-filter">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="solicitado">Solicitado</SelectItem>
              <SelectItem value="en_proceso">En Proceso</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
              <SelectItem value="rechazado">Rechazado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : solicitudes && solicitudes.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Urgencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Solicitud</TableHead>
                    <TableHead>Fecha Entrega</TableHead>
                    <TableHead>Pasos</TableHead>
                    {(userRole === 'admin' || userRole === 'supervisor') && <TableHead>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitudes.map((solicitud) => (
                    <TableRow 
                      key={solicitud.id} 
                      data-testid={`row-solicitud-${solicitud.id}`}
                      className="cursor-pointer"
                      onClick={() => onView(solicitud)}
                    >
                      <TableCell className="font-medium">{solicitud.titulo}</TableCell>
                      <TableCell>{solicitud.supervisorName}</TableCell>
                      <TableCell>
                        {solicitud.monto 
                          ? `$${parseFloat(solicitud.monto).toLocaleString('es-CL')}`
                          : <span className="text-muted-foreground italic">Pendiente</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            solicitud.urgencia === 'alta' ? 'bg-red-500 text-white hover:bg-red-600' :
                            solicitud.urgencia === 'media' ? 'bg-yellow-500 text-white hover:bg-yellow-600' :
                            'bg-green-500 text-white hover:bg-green-600'
                          }
                          data-testid={`badge-urgencia-${solicitud.id}`}
                        >
                          {solicitud.urgencia === 'alta' && 'Alta'}
                          {solicitud.urgencia === 'media' && 'Media'}
                          {solicitud.urgencia === 'baja' && 'Normal'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            solicitud.estado === 'rechazado' ? 'bg-red-500 text-white hover:bg-red-600' :
                            solicitud.estado === 'completado' ? 'bg-green-500 text-white hover:bg-green-600' :
                            'bg-yellow-500 text-white hover:bg-yellow-600'
                          }
                        >
                          {solicitud.estado === 'solicitado' && 'Solicitado'}
                          {solicitud.estado === 'en_proceso' && 'En Proceso'}
                          {solicitud.estado === 'completado' && 'Completado'}
                          {solicitud.estado === 'rechazado' && 'Rechazado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(solicitud.fechaSolicitud), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        {solicitud.fechaEntrega
                          ? format(new Date(solicitud.fechaEntrega), 'dd/MM/yyyy', { locale: es })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {solicitud.pasos && solicitud.pasos.length > 0 ? (
                          <span className="text-sm">
                            {solicitud.pasos.filter(p => p.completado).length}/{solicitud.pasos.length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      {(userRole === 'admin' || userRole === 'supervisor') && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(solicitud);
                              }}
                              data-testid={`button-editar-${solicitud.id}`}
                              title="Editar solicitud"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEstado(solicitud);
                              }}
                              data-testid={`button-cambiar-estado-${solicitud.id}`}
                              title="Cambiar estado"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(solicitud);
                              }}
                              data-testid={`button-eliminar-${solicitud.id}`}
                              title="Eliminar solicitud"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {solicitudes.map((solicitud) => (
                <Card 
                  key={solicitud.id} 
                  data-testid={`card-solicitud-${solicitud.id}`}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => onView(solicitud)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-lg">{solicitud.titulo}</h3>
                        <Badge
                          className={
                            solicitud.estado === 'rechazado' ? 'bg-red-500 text-white hover:bg-red-600' :
                            solicitud.estado === 'completado' ? 'bg-green-500 text-white hover:bg-green-600' :
                            'bg-yellow-500 text-white hover:bg-yellow-600'
                          }
                        >
                          {solicitud.estado === 'solicitado' && 'Solicitado'}
                          {solicitud.estado === 'en_proceso' && 'En Proceso'}
                          {solicitud.estado === 'completado' && 'Completado'}
                          {solicitud.estado === 'rechazado' && 'Rechazado'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Supervisor:</span>
                          <span className="font-medium">{solicitud.supervisorName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monto:</span>
                          <span className="font-medium">
                            {solicitud.monto 
                              ? `$${parseFloat(solicitud.monto).toLocaleString('es-CL')}`
                              : <span className="text-muted-foreground italic">Pendiente</span>
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Urgencia:</span>
                          <Badge
                            className={
                              solicitud.urgencia === 'alta' ? 'bg-red-500 text-white hover:bg-red-600' :
                              solicitud.urgencia === 'media' ? 'bg-yellow-500 text-white hover:bg-yellow-600' :
                              'bg-green-500 text-white hover:bg-green-600'
                            }
                            data-testid={`badge-urgencia-mobile-${solicitud.id}`}
                          >
                            {solicitud.urgencia === 'alta' && 'Alta'}
                            {solicitud.urgencia === 'media' && 'Media'}
                            {solicitud.urgencia === 'baja' && 'Normal'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fecha Solicitud:</span>
                          <span>{format(new Date(solicitud.fechaSolicitud), 'dd/MM/yyyy', { locale: es })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fecha Entrega:</span>
                          <span>
                            {solicitud.fechaEntrega
                              ? format(new Date(solicitud.fechaEntrega), 'dd/MM/yyyy', { locale: es })
                              : '-'}
                          </span>
                        </div>
                      </div>

                      {(solicitud.pasos && solicitud.pasos.length > 0) && (
                        <div className="flex justify-between pt-3 border-t">
                          <span className="text-sm font-medium text-muted-foreground">Pasos:</span>
                          <span className="text-sm font-medium">
                            {solicitud.pasos.filter(p => p.completado).length}/{solicitud.pasos.length}
                          </span>
                        </div>
                      )}

                      {(userRole === 'admin' || userRole === 'supervisor') && (
                        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                          <Button
                            className="flex-1"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(solicitud);
                            }}
                            data-testid={`button-editar-mobile-${solicitud.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            className="flex-1"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEstado(solicitud);
                            }}
                            data-testid={`button-cambiar-estado-mobile-${solicitud.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Estado
                          </Button>
                          <Button
                            className="flex-1"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(solicitud);
                            }}
                            data-testid={`button-eliminar-mobile-${solicitud.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay solicitudes para mostrar
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Presupuesto Dialog Component
function PresupuestoDialog({
  open,
  onOpenChange,
  mes,
  anio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  anio: number;
}) {
  const { toast } = useToast();
  const currentDate = new Date();
  const [presupuestoTotal, setPresupuestoTotal] = useState("");
  const [selectedMes, setSelectedMes] = useState(currentDate.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(currentDate.getFullYear());

  const mesesNombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const { data: presupuestoActual } = useQuery({
    queryKey: ['/api/marketing/presupuesto', selectedMes, selectedAnio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/presupuesto/${selectedMes}/${selectedAnio}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Error al cargar presupuesto');
      }
      return response.json();
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { mes: number; anio: number; presupuestoTotal: number }) => {
      return await apiRequest('POST', '/api/marketing/presupuesto', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/presupuesto'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
      toast({
        title: "Presupuesto guardado",
        description: "El presupuesto ha sido configurado correctamente",
      });
      onOpenChange(false);
      setPresupuestoTotal("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el presupuesto",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const monto = parseFloat(presupuestoTotal);
    if (isNaN(monto) || monto <= 0) {
      toast({
        title: "Error",
        description: "Ingrese un monto válido",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      mes: selectedMes,
      anio: selectedAnio,
      presupuestoTotal: monto,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-presupuesto" className="w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Configurar Presupuesto Mensual</DialogTitle>
          <DialogDescription>
            Seleccione el período y configure el presupuesto total
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mes-presupuesto">Mes</Label>
              <Select
                value={selectedMes.toString()}
                onValueChange={(value) => setSelectedMes(parseInt(value))}
              >
                <SelectTrigger id="mes-presupuesto" data-testid="select-mes-presupuesto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mesesNombres.map((mes, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="anio-presupuesto">Año</Label>
              <Select
                value={selectedAnio.toString()}
                onValueChange={(value) => setSelectedAnio(parseInt(value))}
              >
                <SelectTrigger id="anio-presupuesto" data-testid="select-anio-presupuesto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((anio) => (
                    <SelectItem key={anio} value={anio.toString()}>
                      {anio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {presupuestoActual && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">Presupuesto actual para {mesesNombres[selectedMes - 1]} {selectedAnio}:</p>
              <p className="text-2xl font-bold">
                ${parseFloat(presupuestoActual.presupuestoTotal).toLocaleString('es-CL')}
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="presupuestoTotal">Presupuesto Total (CLP)</Label>
            <Input
              id="presupuestoTotal"
              type="number"
              placeholder="Ej: 5000000"
              value={presupuestoTotal}
              onChange={(e) => setPresupuestoTotal(e.target.value)}
              data-testid="input-presupuesto-total"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-presupuesto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-guardar-presupuesto"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Solicitud Dialog Component
function SolicitudDialog({
  open,
  onOpenChange,
  mes,
  anio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  anio: number;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState("baja");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [imagenReferencia, setImagenReferencia] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [selectedSolicitanteId, setSelectedSolicitanteId] = useState("");
  const [pasos, setPasos] = useState<{ nombre: string; completado: boolean; orden: number }[]>([]);
  const [nuevoPaso, setNuevoPaso] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Obtener lista de solicitantes (admin, supervisor, vendedor)
  const { data: solicitantes = [] } = useQuery<any[]>({
    queryKey: ['/api/marketing/solicitantes'],
  });

  // Para no-admin, autoseleccionar al usuario actual
  useEffect(() => {
    if (open && user) {
      if (user.role !== 'admin') {
        // Supervisores y vendedores solo pueden seleccionarse a sí mismos
        setSelectedSolicitanteId(user.id.toString());
      } else {
        setSelectedSolicitanteId("");
      }
    }
  }, [open, user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenReferencia(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (solicitudId: string, file: File) => {
    const formData = new FormData();
    formData.append('imagen', file);
    
    const response = await fetch(`/api/marketing/solicitudes/${solicitudId}/imagen`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Error al subir imagen');
    }
    
    return await response.json();
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/marketing/solicitudes', data);
      return response;
    },
    onSuccess: async (response: any) => {
      try {
        // Si hay imagen, subirla después de crear la solicitud
        if (imagenReferencia && response.id) {
          setIsUploading(true);
          await uploadImage(response.id, imagenReferencia);
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
        queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
        toast({
          title: "Solicitud creada",
          description: imagenReferencia 
            ? "La solicitud ha sido enviada con la imagen de referencia"
            : "La solicitud ha sido enviada correctamente",
        });
        onOpenChange(false);
        // Reset form
        setTitulo("");
        setDescripcion("");
        setUrgencia("baja");
        setFechaEntrega("");
        setImagenReferencia(null);
        setImagenPreview(null);
        setSelectedSolicitanteId("");
        setPasos([]);
        setNuevoPaso("");
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        toast({
          title: "Solicitud creada",
          description: "La solicitud fue creada pero hubo un error al subir la imagen",
          variant: "default",
        });
        onOpenChange(false);
      } finally {
        setIsUploading(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la solicitud",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!titulo || !descripcion) {
      toast({
        title: "Error",
        description: "Complete todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    // Debe haber un solicitante seleccionado
    if (!selectedSolicitanteId) {
      toast({
        title: "Error",
        description: "Debe seleccionar un solicitante",
        variant: "destructive",
      });
      return;
    }

    const data: any = {
      titulo,
      descripcion,
      urgencia,
      mes,
      anio,
      fechaEntrega: formatDateForAPI(fechaEntrega),
      pasos,
      solicitanteId: selectedSolicitanteId,
    };

    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[calc(100vh-4rem)] flex flex-col" data-testid="dialog-nueva-solicitud">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Marketing</DialogTitle>
          <DialogDescription>
            Complete el formulario para crear una nueva solicitud
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="titulo">Título*</Label>
            <Input
              id="titulo"
              placeholder="Ej: Campaña publicitaria digital"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              data-testid="input-titulo"
            />
          </div>
          <div>
            <Label htmlFor="descripcion">Descripción*</Label>
            <Textarea
              id="descripcion"
              placeholder="Describa la solicitud en detalle"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              data-testid="input-descripcion"
            />
          </div>
          <div>
            <Label htmlFor="urgencia">Nivel de Urgencia*</Label>
            <Select value={urgencia} onValueChange={setUrgencia}>
              <SelectTrigger data-testid="select-urgencia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baja" data-testid="option-urgencia-baja">
                  Normal
                </SelectItem>
                <SelectItem value="media" data-testid="option-urgencia-media">
                  Media
                </SelectItem>
                <SelectItem value="alta" data-testid="option-urgencia-alta">
                  Alta
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Máximo 3 solicitudes con urgencia alta activas por usuario
            </p>
          </div>
          <div>
            <Label htmlFor="solicitante">Solicitante*</Label>
            <Select 
              value={selectedSolicitanteId} 
              onValueChange={setSelectedSolicitanteId}
              disabled={user?.role !== 'admin'}
            >
              <SelectTrigger data-testid="select-solicitante">
                <SelectValue placeholder="Seleccione un solicitante" />
              </SelectTrigger>
              <SelectContent>
                {user?.role === 'admin' ? (
                  // Admin puede ver y seleccionar todos los solicitantes
                  solicitantes.map((solicitante: any) => (
                    <SelectItem key={solicitante.id} value={solicitante.id.toString()} data-testid={`option-solicitante-${solicitante.id}`}>
                      {solicitante.name} ({solicitante.role === 'admin' ? 'Administrador' : solicitante.role === 'supervisor' ? 'Supervisor' : 'Vendedor'})
                    </SelectItem>
                  ))
                ) : (
                  // Supervisor/Vendedor solo puede ver su propio nombre
                  <SelectItem value={user?.id?.toString() || ""} data-testid={`option-solicitante-${user?.id}`}>
                    {user?.firstName} {user?.lastName}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {user?.role === 'admin' 
                ? "Seleccione quién realiza la solicitud" 
                : "La solicitud será registrada a su nombre"}
            </p>
          </div>
          <div>
            <Label htmlFor="fechaEntrega">Fecha de Entrega Esperada</Label>
            <Input
              id="fechaEntrega"
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              data-testid="input-fecha-entrega"
            />
          </div>
          <div>
            <Label htmlFor="imagenReferencia">Imagen de Referencia (Opcional)</Label>
            <div className="space-y-2">
              <Input
                id="imagenReferencia"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                data-testid="input-imagen-referencia"
                className="cursor-pointer"
              />
              {imagenPreview && (
                <div className="relative w-full max-w-xs">
                  <img 
                    src={imagenPreview} 
                    alt="Vista previa" 
                    className="w-full h-auto rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1"
                    onClick={() => {
                      setImagenReferencia(null);
                      setImagenPreview(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Puede subir una imagen de referencia con detalles de la solicitud
              </p>
            </div>
          </div>
          <div>
            <Label>Pasos / Checklist (Opcional)</Label>
            <div className="space-y-2 mt-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: Diseño, Impresión, Cotización..."
                  value={nuevoPaso}
                  onChange={(e) => setNuevoPaso(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (nuevoPaso.trim()) {
                        setPasos([...pasos, { nombre: nuevoPaso.trim(), completado: false, orden: pasos.length }]);
                        setNuevoPaso("");
                      }
                    }
                  }}
                  data-testid="input-nuevo-paso"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (nuevoPaso.trim()) {
                      setPasos([...pasos, { nombre: nuevoPaso.trim(), completado: false, orden: pasos.length }]);
                      setNuevoPaso("");
                    }
                  }}
                  data-testid="button-agregar-paso"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {pasos.length > 0 && (
                <div className="border rounded-md p-2 space-y-1">
                  {pasos.map((paso, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{paso.nombre}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPasos(pasos.filter((_, i) => i !== index))}
                        data-testid={`button-eliminar-paso-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Agregue pasos o tareas que se deben completar para esta solicitud
              </p>
            </div>
          </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-solicitud"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || isUploading}
            data-testid="button-crear-solicitud"
          >
            {createMutation.isPending || isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploading ? 'Subiendo imagen...' : 'Creando...'}
              </>
            ) : (
              'Crear Solicitud'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Estado Dialog Component
function EstadoDialog({
  open,
  onOpenChange,
  solicitud,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudMarketing | null;
}) {
  const { toast } = useToast();
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [monto, setMonto] = useState("");
  const [pdfPresupuesto, setPdfPresupuesto] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (data: { estado: string; motivoRechazo?: string; monto?: number; pdfPresupuesto?: string }) => {
      return await apiRequest('POST', `/api/marketing/solicitudes/${solicitud?.id}/estado`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la solicitud ha sido actualizado",
      });
      onOpenChange(false);
      setNuevoEstado("");
      setMotivoRechazo("");
      setMonto("");
      setPdfPresupuesto("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!nuevoEstado) {
      toast({
        title: "Error",
        description: "Seleccione un estado",
        variant: "destructive",
      });
      return;
    }

    if (nuevoEstado === 'rechazado' && !motivoRechazo) {
      toast({
        title: "Error",
        description: "Debe ingresar un motivo de rechazo",
        variant: "destructive",
      });
      return;
    }

    // Validar monto solo si se ingresó algún valor
    if (monto && monto.trim() !== '') {
      const montoNum = parseFloat(monto);
      if (isNaN(montoNum) || montoNum <= 0) {
        toast({
          title: "Error",
          description: "Ingrese un monto válido",
          variant: "destructive",
        });
        return;
      }
    }

    updateMutation.mutate({
      estado: nuevoEstado,
      motivoRechazo: nuevoEstado === 'rechazado' ? motivoRechazo : undefined,
      monto: monto && monto.trim() !== '' ? parseFloat(monto) : undefined,
      pdfPresupuesto: pdfPresupuesto || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-cambiar-estado" className="w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Cambiar Estado de Solicitud</DialogTitle>
          <DialogDescription>
            {solicitud?.titulo}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Estado Actual</Label>
            <div className="mt-2">
              <Badge>
                {solicitud?.estado === 'solicitado' && 'Solicitado'}
                {solicitud?.estado === 'en_proceso' && 'En Proceso'}
                {solicitud?.estado === 'completado' && 'Completado'}
                {solicitud?.estado === 'rechazado' && 'Rechazado'}
              </Badge>
            </div>
          </div>
          <div>
            <Label htmlFor="nuevoEstado">Nuevo Estado*</Label>
            <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
              <SelectTrigger data-testid="select-nuevo-estado">
                <SelectValue placeholder="Seleccione un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solicitado">Solicitado</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!solicitud?.monto && (nuevoEstado === 'en_proceso' || nuevoEstado === 'completado') && (
            <div>
              <Label htmlFor="monto">Monto Presupuestado (CLP) - Opcional</Label>
              <Input
                id="monto"
                type="number"
                placeholder="Ej: 500000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                data-testid="input-monto-aprobacion"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Puede ingresar el monto ahora o más adelante
              </p>
            </div>
          )}
          {(nuevoEstado === 'en_proceso' || nuevoEstado === 'completado') && (
            <div>
              <Label htmlFor="pdfPresupuesto">URL del PDF Presupuestado (Opcional)</Label>
              <Input
                id="pdfPresupuesto"
                placeholder="https://ejemplo.com/presupuesto.pdf"
                value={pdfPresupuesto}
                onChange={(e) => setPdfPresupuesto(e.target.value)}
                data-testid="input-pdf-presupuesto"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Suba el PDF con el presupuesto detallado
              </p>
            </div>
          )}
          {nuevoEstado === 'rechazado' && (
            <div>
              <Label htmlFor="motivoRechazo">Motivo de Rechazo*</Label>
              <Textarea
                id="motivoRechazo"
                placeholder="Explique el motivo del rechazo"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                data-testid="input-motivo-rechazo"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-estado"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            data-testid="button-guardar-estado"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Solicitud Dialog Component
function EditSolicitudDialog({
  open,
  onOpenChange,
  solicitud,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudMarketing | null;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState("baja");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [imagenReferencia, setImagenReferencia] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [imagenExistente, setImagenExistente] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [pasos, setPasos] = useState<{ nombre: string; completado: boolean; orden: number }[]>([]);
  const [nuevoPaso, setNuevoPaso] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Pre-cargar datos cuando se abre el diálogo
  useEffect(() => {
    if (solicitud && open) {
      setTitulo(solicitud.titulo || "");
      setDescripcion(solicitud.descripcion || "");
      setUrgencia(solicitud.urgencia || "baja");
      setFechaEntrega(solicitud.fechaEntrega || "");
      setImagenExistente(solicitud.urlReferencia || null);
      setImagenReferencia(null);
      setImagenPreview(null);
      setMonto(solicitud.monto?.toString() || "");
      setPasos(solicitud.pasos || []);
      setNuevoPaso("");
    }
  }, [solicitud, open]);

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenReferencia(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadEditImage = async (solicitudId: string, file: File) => {
    const formData = new FormData();
    formData.append('imagen', file);
    
    const response = await fetch(`/api/marketing/solicitudes/${solicitudId}/imagen`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Error al subir imagen');
    }
    
    return await response.json();
  };

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/marketing/solicitudes/${solicitud?.id}`, data);
    },
    onSuccess: async () => {
      try {
        // Si hay nueva imagen, subirla después de actualizar
        if (imagenReferencia && solicitud?.id) {
          setIsUploading(true);
          await uploadEditImage(solicitud.id, imagenReferencia);
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
        queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
        toast({
          title: "Solicitud actualizada",
          description: imagenReferencia 
            ? "Los cambios y la nueva imagen han sido guardados"
            : "Los cambios han sido guardados correctamente",
        });
        onOpenChange(false);
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        toast({
          title: "Solicitud actualizada",
          description: "Los cambios fueron guardados pero hubo un error al subir la imagen",
          variant: "default",
        });
        onOpenChange(false);
      } finally {
        setIsUploading(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la solicitud",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!titulo || !descripcion) {
      toast({
        title: "Error",
        description: "Complete todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      titulo,
      descripcion,
      urgencia,
      fechaEntrega: formatDateForAPI(fechaEntrega),
      monto: monto ? parseFloat(monto) : null,
      pasos,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[calc(100vh-4rem)] flex flex-col" data-testid="dialog-editar-solicitud">
        <DialogHeader>
          <DialogTitle>Editar Solicitud de Marketing</DialogTitle>
          <DialogDescription>
            Modifique los campos necesarios
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit-titulo">Título*</Label>
            <Input
              id="edit-titulo"
              placeholder="Ej: Campaña publicitaria redes sociales"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              data-testid="input-edit-titulo"
            />
          </div>
          <div>
            <Label htmlFor="edit-descripcion">Descripción*</Label>
            <Textarea
              id="edit-descripcion"
              placeholder="Describa los detalles de la solicitud..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              data-testid="input-edit-descripcion"
            />
          </div>
          <div>
            <Label htmlFor="edit-urgencia">Nivel de Urgencia*</Label>
            <Select value={urgencia} onValueChange={setUrgencia}>
              <SelectTrigger data-testid="select-edit-urgencia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baja" data-testid="option-edit-urgencia-baja">
                  Normal
                </SelectItem>
                <SelectItem value="media" data-testid="option-edit-urgencia-media">
                  Media
                </SelectItem>
                <SelectItem value="alta" data-testid="option-edit-urgencia-alta">
                  Alta
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Máximo 3 solicitudes con urgencia alta activas por usuario
            </p>
          </div>
          <div>
            <Label htmlFor="edit-fechaEntrega">Fecha de Entrega Esperada</Label>
            <Input
              id="edit-fechaEntrega"
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              data-testid="input-edit-fecha-entrega"
            />
          </div>
          <div>
            <Label htmlFor="edit-imagenReferencia">Imagen de Referencia</Label>
            <div className="space-y-2">
              {imagenExistente && !imagenPreview && (
                <div className="relative w-full max-w-xs">
                  <img 
                    src={imagenExistente} 
                    alt="Imagen actual" 
                    className="w-full h-auto rounded-md border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Imagen actual</p>
                </div>
              )}
              <Input
                id="edit-imagenReferencia"
                type="file"
                accept="image/*"
                onChange={handleEditImageChange}
                data-testid="input-edit-imagen-referencia"
                className="cursor-pointer"
              />
              {imagenPreview && (
                <div className="relative w-full max-w-xs">
                  <img 
                    src={imagenPreview} 
                    alt="Vista previa nueva imagen" 
                    className="w-full h-auto rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1"
                    onClick={() => {
                      setImagenReferencia(null);
                      setImagenPreview(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <p className="text-xs text-green-600 mt-1">Nueva imagen a subir</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {imagenExistente ? 'Suba una nueva imagen para reemplazar la actual' : 'Puede subir una imagen de referencia'}
              </p>
            </div>
          </div>
          {user?.role === 'admin' && (
            <div>
              <Label htmlFor="edit-monto">Precio / Monto Estimado (CLP)</Label>
              <Input
                id="edit-monto"
                type="number"
                placeholder="Ej: 500000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                data-testid="input-edit-monto"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Solo el administrador puede modificar este campo
              </p>
            </div>
          )}
          <div>
            <Label>Pasos / Checklist</Label>
            <div className="space-y-2 mt-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: Diseño, Impresión, Cotización..."
                  value={nuevoPaso}
                  onChange={(e) => setNuevoPaso(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (nuevoPaso.trim()) {
                        setPasos([...pasos, { nombre: nuevoPaso.trim(), completado: false, orden: pasos.length }]);
                        setNuevoPaso("");
                      }
                    }
                  }}
                  data-testid="input-edit-nuevo-paso"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (nuevoPaso.trim()) {
                      setPasos([...pasos, { nombre: nuevoPaso.trim(), completado: false, orden: pasos.length }]);
                      setNuevoPaso("");
                    }
                  }}
                  data-testid="button-edit-agregar-paso"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {pasos.length > 0 && (
                <div className="border rounded-md p-2 space-y-1">
                  {pasos.map((paso, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{paso.nombre}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPasos(pasos.filter((_, i) => i !== index))}
                        data-testid={`button-edit-eliminar-paso-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Agregue o elimine pasos según sea necesario
              </p>
            </div>
          </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-editar"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending || isUploading}
            data-testid="button-guardar-editar"
          >
            {updateMutation.isPending || isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploading ? 'Subiendo imagen...' : 'Guardando...'}
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delete Solicitud Dialog Component
function DeleteSolicitudDialog({
  open,
  onOpenChange,
  solicitud,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudMarketing | null;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/marketing/solicitudes/${solicitud?.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
      toast({
        title: "Solicitud eliminada",
        description: "La solicitud ha sido eliminada correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la solicitud",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-eliminar-solicitud">
        <DialogHeader>
          <DialogTitle>Confirmar Eliminación</DialogTitle>
          <DialogDescription>
            ¿Está seguro que desea eliminar esta solicitud?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm">
            <strong>Título:</strong> {solicitud?.titulo}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Esta acción no se puede deshacer.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-eliminar"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-confirmar-eliminar"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// View Solicitud Dialog Component
function ViewSolicitudDialog({
  open,
  onOpenChange,
  solicitud,
  userRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudMarketing | null;
  userRole: string;
}) {
  const { toast } = useToast();
  const [notas, setNotas] = useState("");
  const [isEditingNotas, setIsEditingNotas] = useState(false);

  useEffect(() => {
    if (solicitud) {
      setNotas(solicitud.notas || "");
    }
  }, [solicitud]);

  const updateNotasMutation = useMutation({
    mutationFn: async (newNotas: string) => {
      return await apiRequest('PATCH', `/api/marketing/solicitudes/${solicitud!.id}/notas`, { notas: newNotas });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
      toast({
        title: "Notas actualizadas",
        description: "Las notas se han guardado correctamente",
      });
      setIsEditingNotas(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar las notas",
        variant: "destructive",
      });
    },
  });

  const handleSaveNotas = () => {
    updateNotasMutation.mutate(notas);
  };

  const handleCancelNotas = () => {
    setNotas(solicitud?.notas || "");
    setIsEditingNotas(false);
  };

  if (!solicitud) return null;

  const canEditNotas = userRole === 'admin' || userRole === 'supervisor';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] sm:w-full max-h-[calc(100vh-4rem)] flex flex-col" data-testid="dialog-ver-solicitud">
        <DialogHeader>
          <DialogTitle>Detalles de la Solicitud</DialogTitle>
          <DialogDescription>
            Información completa de la solicitud de marketing
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
            {/* Columna principal (2/3) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Título */}
              <div>
                <Label className="text-muted-foreground text-sm">Título</Label>
                <p className="text-lg font-semibold mt-1">{solicitud.titulo}</p>
              </div>

              {/* Descripción */}
              <div>
                <Label className="text-muted-foreground text-sm">Descripción</Label>
                <p className="text-base mt-1 whitespace-pre-wrap">{solicitud.descripcion}</p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Supervisor */}
                <div>
                  <Label className="text-muted-foreground text-sm">Supervisor</Label>
                  <p className="text-base mt-1">{solicitud.supervisorName}</p>
                </div>

                {/* Urgencia */}
                <div>
                  <Label className="text-muted-foreground text-sm">Nivel de Urgencia</Label>
                  <div className="mt-1">
                    <Badge
                      className={
                        solicitud.urgencia === 'alta' ? 'bg-red-500 text-white' :
                        solicitud.urgencia === 'media' ? 'bg-yellow-500 text-white' :
                        'bg-green-500 text-white'
                      }
                    >
                      {solicitud.urgencia === 'alta' && 'Alta'}
                      {solicitud.urgencia === 'media' && 'Media'}
                      {solicitud.urgencia === 'baja' && 'Normal'}
                    </Badge>
                  </div>
                </div>

                {/* Estado */}
                <div>
                  <Label className="text-muted-foreground text-sm">Estado</Label>
                  <div className="mt-1">
                    <Badge
                      className={
                        solicitud.estado === 'rechazado' ? 'bg-red-500 text-white' :
                        solicitud.estado === 'completado' ? 'bg-green-500 text-white' :
                        'bg-yellow-500 text-white'
                      }
                    >
                      {solicitud.estado === 'solicitado' && 'Solicitado'}
                      {solicitud.estado === 'en_proceso' && 'En Proceso'}
                      {solicitud.estado === 'completado' && 'Completado'}
                      {solicitud.estado === 'rechazado' && 'Rechazado'}
                    </Badge>
                  </div>
                </div>

                {/* Monto */}
                <div>
                  <Label className="text-muted-foreground text-sm">Monto</Label>
                  <p className="text-base mt-1">
                    {solicitud.monto 
                      ? `$${parseFloat(solicitud.monto).toLocaleString('es-CL')}`
                      : <span className="text-muted-foreground italic">Pendiente</span>
                    }
                  </p>
                </div>

                {/* Fecha Solicitud */}
                <div>
                  <Label className="text-muted-foreground text-sm">Fecha de Solicitud</Label>
                  <p className="text-base mt-1">
                    {format(new Date(solicitud.fechaSolicitud), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>

                {/* Fecha Entrega */}
                <div>
                  <Label className="text-muted-foreground text-sm">Fecha de Entrega Esperada</Label>
                  <p className="text-base mt-1">
                    {solicitud.fechaEntrega
                      ? format(new Date(solicitud.fechaEntrega), 'dd/MM/yyyy', { locale: es })
                      : <span className="text-muted-foreground">-</span>}
                  </p>
                </div>
              </div>

              {/* Imagen de Referencia */}
              {solicitud.urlReferencia && (
                <div>
                  <Label className="text-muted-foreground text-sm">Imagen de Referencia</Label>
                  <div className="mt-2">
                    <a 
                      href={solicitud.urlReferencia} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <img 
                        src={solicitud.urlReferencia} 
                        alt="Imagen de referencia" 
                        className="max-w-full max-h-64 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        data-testid="img-referencia"
                      />
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">Click en la imagen para ver en tamaño completo</p>
                  </div>
                </div>
              )}

              {/* Pasos / Checklist */}
              {solicitud.pasos && solicitud.pasos.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-sm font-semibold">Pasos / Checklist</Label>
                  <div className="mt-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="space-y-3">
                      {solicitud.pasos.map((paso, index) => (
                        <div key={index} className="flex items-start gap-3 group">
                          <div className="flex-shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={paso.completado}
                              onChange={() => {
                                if (userRole === 'admin' || userRole === 'supervisor') {
                                  const toggleMutation = async () => {
                                    await apiRequest('PATCH', `/api/marketing/solicitudes/${solicitud.id}/pasos/${index}/toggle`, {});
                                    queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
                                  };
                                  toggleMutation();
                                }
                              }}
                              disabled={userRole !== 'admin' && userRole !== 'supervisor'}
                              className="h-5 w-5 rounded border-2 border-blue-400 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              data-testid={`checkbox-paso-${index}`}
                            />
                          </div>
                          <span className={`flex-1 text-base transition-all ${paso.completado ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                            {paso.nombre}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Progreso:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {solicitud.pasos.filter(p => p.completado).length} / {solicitud.pasos.length} completados
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Motivo de Rechazo */}
              {solicitud.estado === 'rechazado' && solicitud.motivoRechazo && (
                <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-950 p-4 rounded">
                  <Label className="text-red-700 dark:text-red-400 font-semibold">Motivo de Rechazo</Label>
                  <p className="text-sm mt-1 text-red-600 dark:text-red-300">{solicitud.motivoRechazo}</p>
                </div>
              )}
            </div>

            {/* Columna de Notas (1/3) */}
            <div className="lg:col-span-1">
              <div className="sticky top-0 bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold">Notas de Actividad</Label>
                  {canEditNotas && !isEditingNotas && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingNotas(true)}
                      data-testid="button-editar-notas"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isEditingNotas ? (
                  <div className="space-y-3">
                    <Textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Escribe notas sobre la actividad de esta solicitud..."
                      className="min-h-[200px] resize-none"
                      data-testid="textarea-notas"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveNotas}
                        disabled={updateNotasMutation.isPending}
                        data-testid="button-guardar-notas"
                        className="flex-1"
                      >
                        {updateNotasMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          'Guardar'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelNotas}
                        disabled={updateNotasMutation.isPending}
                        data-testid="button-cancelar-notas"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[100px]">
                    {notas || <span className="italic">No hay notas registradas</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cerrar-ver-solicitud"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inventario Marketing Component
function InventarioMarketing({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [inventarioDialogOpen, setInventarioDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/marketing/inventario', search],
    enabled: true,
  });

  const { data: summary } = useQuery<{
    totalItems: number;
    stockBajo: number;
    valorTotal: number;
  }>({
    queryKey: ['/api/marketing/inventario/summary'],
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/marketing/inventario/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario/summary'] });
      toast({
        title: "Item eliminado",
        description: "El item ha sido eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el item",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: any) => {
    setSelectedItem(item);
    setInventarioDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Está seguro de eliminar este item?")) {
      deleteMutation.mutate(id);
    }
  };

  const estadoConfig = {
    disponible: { label: "Disponible", color: "bg-green-500" },
    agotado: { label: "Agotado", color: "bg-red-500" },
    por_llegar: { label: "Por Llegar", color: "bg-yellow-500" },
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Inventario de Marketing</h2>
          <p className="text-muted-foreground">Gestión de materiales y suministros de marketing</p>
        </div>
        {userRole === 'admin' && (
          <Button
            onClick={() => {
              setSelectedItem(null);
              setInventarioDialogOpen(true);
            }}
            data-testid="button-nuevo-item"
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Item
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.stockBajo}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${summary.valorTotal.toLocaleString('es-CL')}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Buscar por nombre, descripción o ubicación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-inventario"
          />
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items de Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay items en el inventario
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Costo Unitario</TableHead>
                      <TableHead>Estado</TableHead>
                      {userRole === 'admin' && <TableHead>Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any) => (
                      <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                        <TableCell className="font-medium">{item.nombre}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.descripcion || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.cantidad} {item.unidad}
                            {item.cantidad <= (item.stockMinimo || 0) && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.ubicacion || '-'}</TableCell>
                        <TableCell>
                          {item.costoUnitario 
                            ? `$${parseFloat(item.costoUnitario).toLocaleString('es-CL')}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={estadoConfig[item.estado as keyof typeof estadoConfig]?.color}>
                            {estadoConfig[item.estado as keyof typeof estadoConfig]?.label}
                          </Badge>
                        </TableCell>
                        {userRole === 'admin' && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                data-testid={`button-edit-${item.id}`}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${item.id}`}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {items.map((item: any) => (
                  <Card key={item.id} data-testid={`card-item-${item.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-lg">{item.nombre}</h3>
                          <Badge className={estadoConfig[item.estado as keyof typeof estadoConfig]?.color}>
                            {estadoConfig[item.estado as keyof typeof estadoConfig]?.label}
                          </Badge>
                        </div>
                        
                        {item.descripcion && (
                          <p className="text-sm text-muted-foreground">{item.descripcion}</p>
                        )}
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cantidad:</span>
                            <span className="font-medium flex items-center gap-2">
                              {item.cantidad} {item.unidad}
                              {item.cantidad <= (item.stockMinimo || 0) && (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ubicación:</span>
                            <span>{item.ubicacion || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Costo Unitario:</span>
                            <span className="font-medium">
                              {item.costoUnitario 
                                ? `$${parseFloat(item.costoUnitario).toLocaleString('es-CL')}`
                                : '-'}
                            </span>
                          </div>
                        </div>

                        {userRole === 'admin' && (
                          <div className="flex gap-2 mt-4">
                            <Button
                              className="flex-1"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-mobile-${item.id}`}
                            >
                              Editar
                            </Button>
                            <Button
                              className="flex-1"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-mobile-${item.id}`}
                            >
                              Eliminar
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Inventario Dialog */}
      <InventarioDialog
        open={inventarioDialogOpen}
        onOpenChange={setInventarioDialogOpen}
        item={selectedItem}
      />
    </>
  );
}

// Inventario Dialog Component
function InventarioDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any | null;
}) {
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("unidades");
  const [ubicacion, setUbicacion] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [estado, setEstado] = useState("disponible");
  const [stockMinimo, setStockMinimo] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (item) {
        return await apiRequest("PATCH", `/api/marketing/inventario/${item.id}`, data);
      } else {
        return await apiRequest("POST", "/api/marketing/inventario", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario/summary'] });
      toast({
        title: item ? "Item actualizado" : "Item creado",
        description: item 
          ? "El item ha sido actualizado correctamente"
          : "El item ha sido creado correctamente",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al guardar el item",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNombre("");
    setDescripcion("");
    setCantidad("");
    setUnidad("unidades");
    setUbicacion("");
    setCostoUnitario("");
    setProveedor("");
    setEstado("disponible");
    setStockMinimo("");
  };

  const handleSubmit = () => {
    if (!nombre || !cantidad) {
      toast({
        title: "Error",
        description: "Nombre y cantidad son requeridos",
        variant: "destructive",
      });
      return;
    }

    const data = {
      nombre,
      descripcion: descripcion || null,
      cantidad: parseInt(cantidad),
      unidad,
      ubicacion: ubicacion || null,
      costoUnitario: costoUnitario ? parseFloat(costoUnitario) : null,
      proveedor: proveedor || null,
      estado,
      stockMinimo: stockMinimo ? parseInt(stockMinimo) : 0,
    };

    saveMutation.mutate(data);
  };

  // Load item data when editing
  if (item && open && nombre === "") {
    setNombre(item.nombre || "");
    setDescripcion(item.descripcion || "");
    setCantidad(item.cantidad?.toString() || "");
    setUnidad(item.unidad || "unidades");
    setUbicacion(item.ubicacion || "");
    setCostoUnitario(item.costoUnitario || "");
    setProveedor(item.proveedor || "");
    setEstado(item.estado || "disponible");
    setStockMinimo(item.stockMinimo?.toString() || "");
  }

  // Reset form when dialog closes
  if (!open && nombre !== "") {
    resetForm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>{item ? "Editar Item" : "Nuevo Item"}</DialogTitle>
          <DialogDescription>
            {item 
              ? "Actualice la información del item de inventario"
              : "Complete la información del nuevo item de inventario"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nombre">Nombre*</Label>
              <Input
                id="nombre"
                placeholder="Ej: Volantes promocionales"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                data-testid="input-nombre"
              />
            </div>
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger id="estado" data-testid="select-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="agotado">Agotado</SelectItem>
                  <SelectItem value="por_llegar">Por Llegar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              placeholder="Descripción del item"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              data-testid="input-descripcion"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cantidad">Cantidad*</Label>
              <Input
                id="cantidad"
                type="number"
                placeholder="100"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                data-testid="input-cantidad"
              />
            </div>
            <div>
              <Label htmlFor="unidad">Unidad</Label>
              <Input
                id="unidad"
                placeholder="unidades"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                data-testid="input-unidad"
              />
            </div>
            <div>
              <Label htmlFor="stockMinimo">Stock Mínimo</Label>
              <Input
                id="stockMinimo"
                type="number"
                placeholder="10"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                data-testid="input-stock-minimo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                placeholder="Bodega A - Estante 3"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                data-testid="input-ubicacion"
              />
            </div>
            <div>
              <Label htmlFor="proveedor">Proveedor</Label>
              <Input
                id="proveedor"
                placeholder="Nombre del proveedor"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                data-testid="input-proveedor"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="costoUnitario">Costo Unitario</Label>
            <Input
              id="costoUnitario"
              type="number"
              placeholder="1500"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(e.target.value)}
              data-testid="input-costo-unitario"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-inventario"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            data-testid="button-guardar-inventario"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// Tareas Marketing Component
function TareasMarketing({ 
  mes, 
  anio, 
  userRole 
}: { 
  mes: number; 
  anio: number; 
  userRole: string; 
}) {
  const { toast } = useToast();
  const [tareaDialogOpen, setTareaDialogOpen] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<TareaMarketing | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const { data: tareas = [], isLoading } = useQuery<TareaMarketing[]>({
    queryKey: ['/api/marketing/tareas', mes, anio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/tareas?mes=${mes}&anio=${anio}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar tareas');
      return response.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (tareaId: string) => {
      return await apiRequest('POST', `/api/marketing/tareas/${tareaId}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el estado",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tareaId: string) => {
      return await apiRequest('DELETE', `/api/marketing/tareas/${tareaId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea ha sido eliminada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la tarea",
        variant: "destructive",
      });
    },
  });

  const tareasFiltradas = filtroEstado === "todos" 
    ? tareas 
    : tareas.filter(t => t.estado === filtroEstado);

  const estadoConfig = {
    pendiente: { label: "Pendiente", color: "bg-gray-500", icon: Circle },
    en_proceso: { label: "En Proceso", color: "bg-yellow-500", icon: Play },
    completado: { label: "Completado", color: "bg-green-500", icon: Check },
  };

  const prioridadConfig = {
    baja: { label: "Baja", color: "bg-blue-100 text-blue-800" },
    media: { label: "Media", color: "bg-yellow-100 text-yellow-800" },
    alta: { label: "Alta", color: "bg-red-100 text-red-800" },
  };

  const handleToggleEstado = (tareaId: string) => {
    toggleMutation.mutate(tareaId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Filtrar por estado:</Label>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[180px]" data-testid="select-filtro-estado-tareas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="en_proceso">En Proceso</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {(userRole === 'admin' || userRole === 'supervisor') && (
          <Button onClick={() => { setSelectedTarea(null); setTareaDialogOpen(true); }} data-testid="button-nueva-tarea">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        )}
      </div>

      {tareasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay tareas para este período
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tareasFiltradas.map((tarea) => {
            const config = estadoConfig[tarea.estado];
            const prioridadCfg = prioridadConfig[tarea.prioridad];
            const IconEstado = config.icon;
            
            return (
              <Card key={tarea.id} className="hover:shadow-md transition-shadow" data-testid={`card-tarea-${tarea.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => handleToggleEstado(tarea.id)}
                      disabled={toggleMutation.isPending}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-80 ${config.color}`}
                      data-testid={`button-toggle-tarea-${tarea.id}`}
                    >
                      <IconEstado className="h-4 w-4" />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`font-medium ${tarea.estado === 'completado' ? 'line-through text-muted-foreground' : ''}`}>
                            {tarea.titulo}
                          </h4>
                          {tarea.descripcion && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {tarea.descripcion}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={prioridadCfg.color}>
                            {prioridadCfg.label}
                          </Badge>
                          <Badge className={`${config.color} text-white`}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        {tarea.fechaLimite && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(tarea.fechaLimite), 'dd/MM/yyyy', { locale: es })}
                          </span>
                        )}
                        {tarea.asignadoANombre && (
                          <span>Asignado a: {tarea.asignadoANombre}</span>
                        )}
                        {tarea.creadoPorNombre && (
                          <span>Creado por: {tarea.creadoPorNombre}</span>
                        )}
                      </div>
                    </div>

                    {userRole === 'admin' && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedTarea(tarea); setTareaDialogOpen(true); }}
                          data-testid={`button-editar-tarea-${tarea.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(tarea.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-eliminar-tarea-${tarea.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TareaDialog
        open={tareaDialogOpen}
        onOpenChange={setTareaDialogOpen}
        tarea={selectedTarea}
        mes={mes}
        anio={anio}
      />
    </div>
  );
}

// Tarea Dialog Component
function TareaDialog({
  open,
  onOpenChange,
  tarea,
  mes,
  anio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarea: TareaMarketing | null;
  mes: number;
  anio: number;
}) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  const [fechaLimite, setFechaLimite] = useState("");

  useEffect(() => {
    if (open) {
      if (tarea) {
        setTitulo(tarea.titulo);
        setDescripcion(tarea.descripcion || "");
        setPrioridad(tarea.prioridad);
        setFechaLimite(tarea.fechaLimite || "");
      } else {
        setTitulo("");
        setDescripcion("");
        setPrioridad("media");
        setFechaLimite("");
      }
    }
  }, [open, tarea]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/marketing/tareas', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
      toast({
        title: "Tarea creada",
        description: "La tarea ha sido creada correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la tarea",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/marketing/tareas/${tarea?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
      toast({
        title: "Tarea actualizada",
        description: "Los cambios han sido guardados",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la tarea",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!titulo.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive",
      });
      return;
    }

    const data = {
      titulo,
      descripcion: descripcion || null,
      prioridad,
      fechaLimite: fechaLimite || null,
      mes,
      anio,
    };

    if (tarea) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-tarea">
        <DialogHeader>
          <DialogTitle>{tarea ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
          <DialogDescription>
            {tarea ? 'Modifique los detalles de la tarea' : 'Complete los campos para crear una nueva tarea'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="titulo-tarea">Título*</Label>
            <Input
              id="titulo-tarea"
              placeholder="Ej: Diseñar banner promocional"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              data-testid="input-titulo-tarea"
            />
          </div>

          <div>
            <Label htmlFor="descripcion-tarea">Descripción</Label>
            <Textarea
              id="descripcion-tarea"
              placeholder="Describa los detalles de la tarea..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              data-testid="input-descripcion-tarea"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prioridad-tarea">Prioridad</Label>
              <Select value={prioridad} onValueChange={setPrioridad}>
                <SelectTrigger data-testid="select-prioridad-tarea">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fecha-limite-tarea">Fecha Límite</Label>
              <Input
                id="fecha-limite-tarea"
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                data-testid="input-fecha-limite-tarea"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-tarea"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="button-guardar-tarea"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              tarea ? 'Guardar Cambios' : 'Crear Tarea'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Calendario Component
function CalendarioHitos({ 
  mes, 
  anio, 
  userRole,
  onMesChange,
  onAnioChange
}: { 
  mes: number; 
  anio: number; 
  userRole: string;
  onMesChange: (mes: number) => void;
  onAnioChange: (anio: number) => void;
}) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hitoDialogOpen, setHitoDialogOpen] = useState(false);
  const [selectedHito, setSelectedHito] = useState<HitoMarketing | null>(null);

  const handlePrevMonth = () => {
    if (mes === 1) {
      onMesChange(12);
      onAnioChange(anio - 1);
    } else {
      onMesChange(mes - 1);
    }
  };

  const handleNextMonth = () => {
    if (mes === 12) {
      onMesChange(1);
      onAnioChange(anio + 1);
    } else {
      onMesChange(mes + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    onMesChange(today.getMonth() + 1);
    onAnioChange(today.getFullYear());
  };

  const { data: hitos, isLoading: hitosLoading } = useQuery<HitoMarketing[]>({
    queryKey: ['/api/marketing/hitos', mes, anio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/hitos?mes=${mes}&anio=${anio}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar hitos');
      }
      return response.json();
    },
  });

  const { data: tareas, isLoading: tareasLoading } = useQuery<TareaMarketing[]>({
    queryKey: ['/api/marketing/tareas', mes, anio, 'calendario'],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/tareas?mes=${mes}&anio=${anio}&incluirPorFechaLimite=true`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar tareas');
      }
      return response.json();
    },
  });

  const isLoading = hitosLoading || tareasLoading;

  const currentMonth = new Date(anio, mes - 1, 1);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = monthStart.getDay();
  // Adjust to start week on Monday (0 = Monday, 6 = Sunday)
  const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedHito(null);
    setHitoDialogOpen(true);
  };

  const handleHitoClick = (hito: HitoMarketing, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHito(hito);
    const parsedDate = parseDateFromAPI(hito.fecha);
    setSelectedDate(parsedDate || new Date());
    setHitoDialogOpen(true);
  };

  const getHitosForDay = (day: Date) => {
    if (!hitos) return [];
    return hitos.filter(hito => {
      const hitoDate = parseDateFromAPI(hito.fecha);
      return hitoDate && isSameDay(hitoDate, day);
    });
  };

  const getTareasForDay = (day: Date) => {
    if (!tareas) return [];
    return tareas.filter(tarea => {
      if (!tarea.fechaLimite) return false;
      const tareaDate = parseDateFromAPI(tarea.fechaLimite);
      return tareaDate && isSameDay(tareaDate, day);
    });
  };

  const tipoColors = {
    general: 'bg-blue-500',
    campaña: 'bg-purple-500',
    evento: 'bg-green-500',
    deadline: 'bg-red-500',
  };

  const tareaEstadoColors = {
    pendiente: 'bg-orange-500',
    en_proceso: 'bg-yellow-500',
    completado: 'bg-emerald-600',
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-3">
            {/* Navegación de mes */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                data-testid="button-prev-month"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg sm:text-xl text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                data-testid="button-next-month"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Botones de acción */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                data-testid="button-hoy"
                className="h-8 text-xs"
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDate(new Date());
                  setSelectedHito(null);
                  setHitoDialogOpen(true);
                }}
                data-testid="button-nuevo-hito"
                className="h-8 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Nuevo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500" />
                  <span>General</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-purple-500" />
                  <span>Campaña</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                  <span>Evento</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                  <span>Deadline</span>
                </div>
                <div className="border-l border-border pl-2 sm:pl-4 flex items-center gap-1 sm:gap-2">
                  <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span>Tareas</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Day headers */}
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                  <div key={day} className="text-center font-semibold text-[10px] sm:text-sm py-1 sm:py-2">
                    {day}
                  </div>
                ))}

                {/* Empty cells for days before month starts */}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[100px] bg-muted/30 rounded-lg" />
                ))}

                {/* Days of the month */}
                {daysInMonth.map((day) => {
                  const dayHitos = getHitosForDay(day);
                  const dayTareas = getTareasForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const totalItems = dayHitos.length + dayTareas.length;
                  const maxVisible = 2;
                  let itemsShown = 0;

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[60px] sm:min-h-[100px] border rounded-lg p-1 sm:p-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                        isToday ? 'border-primary border-2' : 'border-border'
                      }`}
                      onClick={() => handleDayClick(day)}
                      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <div className={`text-[10px] sm:text-sm font-semibold mb-0.5 sm:mb-1 ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5 sm:space-y-1">
                        {/* Mostrar hitos */}
                        {dayHitos.slice(0, maxVisible).map((hito) => {
                          itemsShown++;
                          return (
                            <div
                              key={`hito-${hito.id}`}
                              className={`text-[8px] sm:text-xs p-0.5 sm:p-1 rounded truncate cursor-pointer ${tipoColors[hito.tipo]} text-white flex items-center gap-0.5 sm:gap-1`}
                              onClick={(e) => handleHitoClick(hito, e)}
                              title={hito.titulo}
                              data-testid={`hito-${hito.id}`}
                            >
                              {hito.completado && <CheckSquare className="h-2 w-2 sm:h-3 sm:w-3 flex-shrink-0" />}
                              <span className="truncate">{hito.titulo}</span>
                            </div>
                          );
                        })}
                        {/* Mostrar tareas (solo si hay espacio después de los hitos) */}
                        {dayTareas.slice(0, Math.max(0, maxVisible - dayHitos.length)).map((tarea) => {
                          itemsShown++;
                          return (
                            <div
                              key={`tarea-${tarea.id}`}
                              className={`text-[8px] sm:text-xs p-0.5 sm:p-1 rounded truncate cursor-pointer ${tareaEstadoColors[tarea.estado]} text-white flex items-center gap-0.5 sm:gap-1`}
                              onClick={(e) => e.stopPropagation()}
                              title={`Tarea: ${tarea.titulo}`}
                              data-testid={`tarea-cal-${tarea.id}`}
                            >
                              <ClipboardList className="h-2 w-2 sm:h-3 sm:w-3 flex-shrink-0" />
                              <span className="truncate">{tarea.titulo}</span>
                            </div>
                          );
                        })}
                        {totalItems > maxVisible && (
                          <div className="text-[8px] sm:text-xs text-muted-foreground">
                            +{totalItems - maxVisible}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <HitoDialog
        open={hitoDialogOpen}
        onOpenChange={setHitoDialogOpen}
        selectedDate={selectedDate}
        hito={selectedHito}
        userRole={userRole}
      />
    </>
  );
}

// Hito Dialog Component
function HitoDialog({
  open,
  onOpenChange,
  selectedDate,
  hito,
  userRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  hito: HitoMarketing | null;
  userRole: string;
}) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<'general' | 'campaña' | 'evento' | 'deadline'>('general');
  const [completado, setCompletado] = useState(false);

  useEffect(() => {
    if (hito) {
      setTitulo(hito.titulo);
      setDescripcion(hito.descripcion || '');
      setTipo(hito.tipo);
      setCompletado(hito.completado);
    } else {
      setTitulo('');
      setDescripcion('');
      setTipo('general');
      setCompletado(false);
    }
  }, [hito, open]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (hito) {
        return await apiRequest('PATCH', `/api/marketing/hitos/${hito.id}`, data);
      } else {
        return await apiRequest('POST', '/api/marketing/hitos', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/hitos'] });
      toast({
        title: "Éxito",
        description: hito ? "Hito actualizado correctamente" : "Hito creado correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el hito",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!hito) return;
      return await apiRequest('DELETE', `/api/marketing/hitos/${hito.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/hitos'] });
      toast({
        title: "Éxito",
        description: "Hito eliminado correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el hito",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!titulo.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate) {
      toast({
        title: "Error",
        description: "La fecha es requerida",
        variant: "destructive",
      });
      return;
    }

    const data = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      fecha: formatDateForAPI(selectedDate),
      tipo,
      completado,
    };

    saveMutation.mutate(data);
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este hito?')) {
      deleteMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-hito">
        <DialogHeader>
          <DialogTitle>{hito ? 'Editar Hito' : 'Nuevo Hito'}</DialogTitle>
          <DialogDescription>
            {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: es }) : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título del hito"
              data-testid="input-titulo-hito"
            />
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional"
              rows={3}
              data-testid="input-descripcion-hito"
            />
          </div>

          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(value: any) => setTipo(value)}
            >
              <SelectTrigger data-testid="select-tipo-hito">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="campaña">Campaña</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Marcar como completado - Card destacado */}
          <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
            completado 
              ? 'bg-green-50 border-green-500' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                completado ? 'bg-green-500' : 'bg-gray-400'
              }`}>
                <CheckSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <Label htmlFor="completado" className="text-sm font-semibold cursor-pointer">
                  Marcar como completado
                </Label>
                <p className="text-xs text-muted-foreground">
                  {completado ? 'Este hito está completado' : 'Hito pendiente'}
                </p>
              </div>
            </div>
            <Switch
              id="completado"
              checked={completado}
              onCheckedChange={setCompletado}
              data-testid="switch-completado-hito"
            />
          </div>
        </div>

        {/* Botón de eliminar arriba en móvil */}
        {hito && userRole === 'admin' && (
          <div className="pb-2 sm:hidden">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-eliminar-hito"
              className="w-full"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Botón de eliminar en desktop */}
          <div className="hidden sm:block sm:mr-auto">
            {hito && userRole === 'admin' && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-eliminar-hito-desktop"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Botones principales */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancelar-hito"
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              data-testid="button-guardar-hito"
              className="flex-1 sm:flex-none"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// SEO Tracking Component
interface SeoCampaign {
  id: string;
  nombre: string;
  dominio: string;
  descripcion: string | null;
  activo: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SeoKeywordData {
  id: string;
  campaignId: string;
  keyword: string;
  urlObjetivo: string | null;
  ubicacion: string;
  idioma: string;
  dispositivo: string;
  ultimaPosicion: number | null;
  ultimaConsulta: string | null;
  activo: boolean;
  createdAt: string;
  historial: SeoPositionHistoryData[];
}

interface SeoPositionHistoryData {
  id: string;
  keywordId: string;
  posicion: number | null;
  urlEncontrada: string | null;
  titulo: string | null;
  snippet: string | null;
  pagina: number | null;
  totalResultados: number | null;
  fechaConsulta: string;
  busquedasRestantes: number | null;
}

function SeoTracking() {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<SeoCampaign | null>(null);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [checkingPosition, setCheckingPosition] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  // Campaign form state
  const [campaignNombre, setCampaignNombre] = useState('');
  const [campaignDominio, setCampaignDominio] = useState('');
  const [campaignDescripcion, setCampaignDescripcion] = useState('');

  // Keyword form state
  const [keywordText, setKeywordText] = useState('');
  const [keywordUrl, setKeywordUrl] = useState('');
  const [keywordUbicacion, setKeywordUbicacion] = useState('Chile');
  const [keywordDispositivo, setKeywordDispositivo] = useState('desktop');

  // Fetch campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns, refetch: refetchCampaigns } = useQuery<SeoCampaign[]>({
    queryKey: ['/api/seo/campaigns'],
  });

  // Fetch keywords for selected campaign
  const { data: keywords = [], isLoading: loadingKeywords, refetch: refetchKeywords } = useQuery<SeoKeywordData[]>({
    queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'],
    enabled: !!selectedCampaign,
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: { nombre: string; dominio: string; descripcion: string }) => {
      return await apiRequest('/api/seo/campaigns', {
        method: 'POST',
        data: campaignData,
      });
    },
    onSuccess: () => {
      toast({ title: 'Campaña creada exitosamente' });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns'] });
      setCampaignDialogOpen(false);
      setCampaignNombre('');
      setCampaignDominio('');
      setCampaignDescripcion('');
    },
    onError: (error: any) => {
      toast({ title: 'Error al crear campaña', description: error.message, variant: 'destructive' });
    },
  });

  // Create keyword mutation
  const createKeywordMutation = useMutation({
    mutationFn: async (keywordData: any) => {
      return await apiRequest('/api/seo/keywords', {
        method: 'POST',
        data: keywordData,
      });
    },
    onSuccess: () => {
      toast({ title: 'Keyword agregada exitosamente' });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
      setKeywordDialogOpen(false);
      setKeywordText('');
      setKeywordUrl('');
    },
    onError: (error: any) => {
      toast({ title: 'Error al agregar keyword', description: error.message, variant: 'destructive' });
    },
  });

  // Delete keyword mutation
  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/seo/keywords/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: 'Keyword eliminada' });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/seo/campaigns/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: 'Campaña eliminada exitosamente' });
      setSelectedCampaign(null);
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error al eliminar campaña', description: error.message, variant: 'destructive' });
    },
  });

  // Check position mutation
  const checkPositionMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      setCheckingPosition(keywordId);
      return await apiRequest('/api/seo/check-position', {
        method: 'POST',
        data: { keywordId },
      });
    },
    onSuccess: (data: any) => {
      if (data.posicion) {
        toast({ title: `Posición encontrada: #${data.posicion}` });
      } else {
        toast({ title: 'No se encontró en los primeros 100 resultados', variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
      setCheckingPosition(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error al verificar posición', description: error.message, variant: 'destructive' });
      setCheckingPosition(null);
    },
  });

  // Check all positions mutation
  const checkAllMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      setCheckingAll(true);
      return await apiRequest(`/api/seo/campaigns/${campaignId}/check-all`, { method: 'POST' });
    },
    onSuccess: (data: any) => {
      toast({ title: `Verificación completada: ${data.total} keywords procesadas` });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
      setCheckingAll(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error al verificar posiciones', description: error.message, variant: 'destructive' });
      setCheckingAll(false);
    },
  });

  const handleCreateCampaign = () => {
    if (!campaignNombre || !campaignDominio) {
      toast({ title: 'Complete los campos requeridos', variant: 'destructive' });
      return;
    }
    createCampaignMutation.mutate({
      nombre: campaignNombre,
      dominio: campaignDominio,
      descripcion: campaignDescripcion,
    });
  };

  const handleCreateKeyword = () => {
    if (!keywordText || !selectedCampaign) {
      toast({ title: 'Complete los campos requeridos', variant: 'destructive' });
      return;
    }
    createKeywordMutation.mutate({
      campaignId: selectedCampaign.id,
      keyword: keywordText,
      urlObjetivo: keywordUrl || null,
      ubicacion: keywordUbicacion,
      idioma: 'es',
      activo: true,
    });
  };

  const getPositionColor = (pos: number | null) => {
    if (!pos) return 'text-gray-400';
    if (pos <= 3) return 'text-green-500';
    if (pos <= 10) return 'text-yellow-500';
    if (pos <= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getPositionBadge = (pos: number | null) => {
    if (!pos) return <Badge variant="secondary">No encontrado</Badge>;
    if (pos <= 3) return <Badge className="bg-green-500">#{pos}</Badge>;
    if (pos <= 10) return <Badge className="bg-yellow-500">#{pos}</Badge>;
    if (pos <= 20) return <Badge className="bg-orange-500">#{pos}</Badge>;
    return <Badge variant="destructive">#{pos}</Badge>;
  };

  if (loadingCampaigns) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Posicionamiento Web</h2>
          <p className="text-muted-foreground">Monitoreo de posiciones en Google con SerpAPI</p>
        </div>
        <Button onClick={() => setCampaignDialogOpen(true)} data-testid="button-nueva-campana">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Campaña
        </Button>
      </div>

      {/* Campaign Selection */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay campañas</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera campaña para comenzar a monitorear posiciones</p>
            <Button onClick={() => setCampaignDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Campaña
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Campaña</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Select
                  value={selectedCampaign?.id || ''}
                  onValueChange={(value) => {
                    const camp = campaigns.find(c => c.id === value);
                    setSelectedCampaign(camp || null);
                  }}
                >
                  <SelectTrigger data-testid="select-campana" className="flex-1">
                    <SelectValue placeholder="Selecciona una campaña" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.nombre} - {campaign.dominio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCampaign && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="icon"
                        data-testid="button-eliminar-campana"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminarán la campaña "{selectedCampaign.nombre}" y todas sus keywords asociadas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCampaignMutation.mutate(selectedCampaign.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirmar-eliminar-campana"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Keywords Table */}
          {selectedCampaign && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle>Keywords - {selectedCampaign.nombre}</CardTitle>
                    <CardDescription>Dominio: {selectedCampaign.dominio}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => checkAllMutation.mutate(selectedCampaign.id)}
                      disabled={checkingAll || keywords.length === 0}
                      data-testid="button-verificar-todas"
                    >
                      {checkingAll ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Verificar Todas
                        </>
                      )}
                    </Button>
                    <Button onClick={() => setKeywordDialogOpen(true)} data-testid="button-agregar-keyword">
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Keyword
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingKeywords ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : keywords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay keywords configuradas</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Keyword</TableHead>
                          <TableHead>Ubicación</TableHead>
                          <TableHead>Dispositivo</TableHead>
                          <TableHead>Posición</TableHead>
                          <TableHead>Última Consulta</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keywords.map((kw) => (
                          <TableRow key={kw.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{kw.keyword}</p>
                                {kw.urlObjetivo && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {kw.urlObjetivo}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{kw.ubicacion}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {kw.dispositivo === 'desktop' ? '🖥️ Desktop' : '📱 Mobile'}
                              </Badge>
                            </TableCell>
                            <TableCell>{getPositionBadge(kw.ultimaPosicion)}</TableCell>
                            <TableCell>
                              {kw.ultimaConsulta ? (
                                <span className="text-sm">
                                  {format(new Date(kw.ultimaConsulta), 'dd/MM/yy HH:mm', { locale: es })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkPositionMutation.mutate(kw.id)}
                                  disabled={checkingPosition === kw.id}
                                  data-testid={`button-verificar-${kw.id}`}
                                >
                                  {checkingPosition === kw.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <TrendingUp className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteKeywordMutation.mutate(kw.id)}
                                  data-testid={`button-eliminar-${kw.id}`}
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
                )}
              </CardContent>
            </Card>
          )}

          {/* Position History Chart */}
          {selectedCampaign && keywords.length > 0 && keywords.some(k => k.historial.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Historial de Posiciones</CardTitle>
                <CardDescription>Evolución de las posiciones en el tiempo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {keywords.filter(k => k.historial.length > 0).map((kw) => (
                    <div key={kw.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">{kw.keyword}</h4>
                      <div className="flex flex-wrap gap-2">
                        {kw.historial.slice(0, 10).reverse().map((h, idx) => (
                          <div key={h.id} className="text-center">
                            <div className={`text-lg font-bold ${getPositionColor(h.posicion)}`}>
                              {h.posicion || '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(h.fechaConsulta), 'dd/MM', { locale: es })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Campaña SEO</DialogTitle>
            <DialogDescription>
              Crea una campaña para monitorear las posiciones de tu sitio web
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaignNombre">Nombre de la Campaña *</Label>
              <Input
                id="campaignNombre"
                value={campaignNombre}
                onChange={(e) => setCampaignNombre(e.target.value)}
                placeholder="Ej: Pinturas Panorámica"
                data-testid="input-nombre-campana"
              />
            </div>
            <div>
              <Label htmlFor="campaignDominio">Dominio a Monitorear *</Label>
              <Input
                id="campaignDominio"
                value={campaignDominio}
                onChange={(e) => setCampaignDominio(e.target.value)}
                placeholder="Ej: pinturaspanoramica.cl"
                data-testid="input-dominio-campana"
              />
            </div>
            <div>
              <Label htmlFor="campaignDescripcion">Descripción</Label>
              <Textarea
                id="campaignDescripcion"
                value={campaignDescripcion}
                onChange={(e) => setCampaignDescripcion(e.target.value)}
                placeholder="Descripción opcional"
                data-testid="input-descripcion-campana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={createCampaignMutation.isPending}
              data-testid="button-crear-campana"
            >
              {createCampaignMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Campaña'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyword Dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Keyword</DialogTitle>
            <DialogDescription>
              Agrega una palabra clave para monitorear su posición en Google
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="keywordText">Palabra Clave *</Label>
              <Input
                id="keywordText"
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                placeholder="Ej: pinturas chile"
                data-testid="input-keyword"
              />
            </div>
            <div>
              <Label htmlFor="keywordUrl">URL Objetivo (opcional)</Label>
              <Input
                id="keywordUrl"
                value={keywordUrl}
                onChange={(e) => setKeywordUrl(e.target.value)}
                placeholder="Ej: /productos/pinturas"
                data-testid="input-url-keyword"
              />
            </div>
            <div>
              <Label htmlFor="keywordUbicacion">Ubicación</Label>
              <Select value={keywordUbicacion} onValueChange={setKeywordUbicacion}>
                <SelectTrigger data-testid="select-ubicacion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chile">Chile</SelectItem>
                  <SelectItem value="Santiago, Chile">Santiago</SelectItem>
                  <SelectItem value="Valparaiso, Chile">Valparaíso</SelectItem>
                  <SelectItem value="Concepcion, Chile">Concepción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Se analizará automáticamente la posición en Desktop y Mobile
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeywordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateKeyword}
              disabled={createKeywordMutation.isPending}
              data-testid="button-crear-keyword"
            >
              {createKeywordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agregando...
                </>
              ) : (
                'Agregar Keyword'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Competidor {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductoMonitoreo {
  id: string;
  nombreProducto: string;
  precioListaGL: string | null;
  precioLista14: string | null;
  precioListaBalde4: string | null;
  precioListaBalde5: string | null;
  activo: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PrecioCompetencia {
  id: string;
  productoMonitoreoId: string;
  competidorId: string;
  precioWeb: string | null;
  precioFerreteria: string | null;
  precioConstruccion: string | null;
  fechaRegistro: string;
  notas: string | null;
  urlReferencia: string | null;
  productoNombre: string;
  productoFormato: string | null;
  competidorNombre: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function PreciosCompetencia({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducto, setSelectedProducto] = useState<ProductoMonitoreo | null>(null);
  const [productoDialogOpen, setProductoDialogOpen] = useState(false);
  const [precioDialogOpen, setPrecioDialogOpen] = useState(false);
  const [competidorDialogOpen, setCompetidorDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<ProductoMonitoreo | null>(null);
  const [editingCompetidor, setEditingCompetidor] = useState<Competidor | null>(null);

  const [nuevoProducto, setNuevoProducto] = useState({
    nombreProducto: "",
    precioListaGL: "",
    precioLista14: "",
    precioListaBalde4: "",
    precioListaBalde5: "",
  });

  const [nuevoPrecio, setNuevoPrecio] = useState({
    productoMonitoreoId: "",
    competidorId: "",
    formato: "GL" as "GL" | "14" | "BALDE4" | "BALDE5",
    precioWeb: "",
    precioFerreteria: "",
    precioConstruccion: "",
    notas: "",
    urlReferencia: "",
  });

  const [nuevoCompetidor, setNuevoCompetidor] = useState({
    nombre: "",
    descripcion: "",
  });

  const { data: productos = [], isLoading: loadingProductos } = useQuery<ProductoMonitoreo[]>({
    queryKey: ["/api/marketing/productos-monitoreo"],
  });

  const { data: competidores = [], isLoading: loadingCompetidores } = useQuery<Competidor[]>({
    queryKey: ["/api/marketing/competidores"],
  });

  const { data: preciosProducto = [], isLoading: loadingPrecios, refetch: refetchPrecios } = useQuery<PrecioCompetencia[]>({
    queryKey: ["/api/marketing/productos-monitoreo", selectedProducto?.id, "precios"],
    enabled: !!selectedProducto,
  });

  const createProductoMutation = useMutation({
    mutationFn: async (data: typeof nuevoProducto) => {
      return await apiRequest("/api/marketing/productos-monitoreo", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo"] });
      toast({ title: "Producto creado", description: "El producto se agregó correctamente" });
      setProductoDialogOpen(false);
      setNuevoProducto({ nombreProducto: "", precioListaGL: "", precioLista14: "", precioListaBalde4: "", precioListaBalde5: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al crear producto", variant: "destructive" });
    },
  });

  const updateProductoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof nuevoProducto }) => {
      return await apiRequest(`/api/marketing/productos-monitoreo/${id}`, { method: "PATCH", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo"] });
      toast({ title: "Producto actualizado", description: "El producto se actualizó correctamente" });
      setProductoDialogOpen(false);
      setEditingProducto(null);
      setNuevoProducto({ nombreProducto: "", precioListaGL: "", precioLista14: "", precioListaBalde4: "", precioListaBalde5: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al actualizar producto", variant: "destructive" });
    },
  });

  const deleteProductoMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/marketing/productos-monitoreo/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo"] });
      toast({ title: "Producto eliminado", description: "El producto se eliminó correctamente" });
      if (selectedProducto) setSelectedProducto(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al eliminar producto", variant: "destructive" });
    },
  });

  const createCompetidorMutation = useMutation({
    mutationFn: async (data: { nombre: string; descripcion: string }) => {
      return await apiRequest("/api/marketing/competidores", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/competidores"] });
      toast({ title: "Competidor creado", description: "El competidor se creó correctamente" });
      setCompetidorDialogOpen(false);
      setNuevoCompetidor({ nombre: "", descripcion: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al crear competidor", variant: "destructive" });
    },
  });

  const updateCompetidorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nombre: string; descripcion: string } }) => {
      return await apiRequest(`/api/marketing/competidores/${id}`, { method: "PATCH", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/competidores"] });
      toast({ title: "Competidor actualizado", description: "El competidor se actualizó correctamente" });
      setCompetidorDialogOpen(false);
      setEditingCompetidor(null);
      setNuevoCompetidor({ nombre: "", descripcion: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al actualizar competidor", variant: "destructive" });
    },
  });

  const createPrecioMutation = useMutation({
    mutationFn: async (data: typeof nuevoPrecio) => {
      return await apiRequest("/api/marketing/precios-competencia", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo", selectedProducto?.id, "precios"] });
      toast({ title: "Precio registrado", description: "El precio de competencia se registró correctamente" });
      setPrecioDialogOpen(false);
      setNuevoPrecio({ productoMonitoreoId: "", competidorId: "", formato: "GL", precioWeb: "", precioFerreteria: "", precioConstruccion: "", notas: "", urlReferencia: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al registrar precio", variant: "destructive" });
    },
  });

  const deletePrecioMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/marketing/precios-competencia/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo", selectedProducto?.id, "precios"] });
      toast({ title: "Precio eliminado", description: "El registro se eliminó correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al eliminar precio", variant: "destructive" });
    },
  });

  const handleEditProducto = (producto: ProductoMonitoreo) => {
    setEditingProducto(producto);
    setNuevoProducto({
      nombreProducto: producto.nombreProducto,
      precioListaGL: producto.precioListaGL || "",
      precioLista14: producto.precioLista14 || "",
      precioListaBalde4: producto.precioListaBalde4 || "",
      precioListaBalde5: producto.precioListaBalde5 || "",
    });
    setProductoDialogOpen(true);
  };

  const handleEditCompetidor = (competidor: Competidor) => {
    setEditingCompetidor(competidor);
    setNuevoCompetidor({
      nombre: competidor.nombre,
      descripcion: competidor.descripcion || "",
    });
    setCompetidorDialogOpen(true);
  };

  const handleSaveProducto = () => {
    if (!nuevoProducto.nombreProducto) {
      toast({ title: "Error", description: "El nombre del producto es obligatorio", variant: "destructive" });
      return;
    }
    if (editingProducto) {
      updateProductoMutation.mutate({ id: editingProducto.id, data: nuevoProducto });
    } else {
      createProductoMutation.mutate(nuevoProducto);
    }
  };

  const handleSaveCompetidor = () => {
    if (!nuevoCompetidor.nombre) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (editingCompetidor) {
      updateCompetidorMutation.mutate({ id: editingCompetidor.id, data: nuevoCompetidor });
    } else {
      createCompetidorMutation.mutate(nuevoCompetidor);
    }
  };

  const handleAddPrecio = () => {
    if (!selectedProducto) return;
    setNuevoPrecio({
      productoMonitoreoId: selectedProducto.id,
      competidorId: "",
      formato: "GL",
      precioWeb: "",
      precioFerreteria: "",
      precioConstruccion: "",
      notas: "",
      urlReferencia: "",
    });
    setPrecioDialogOpen(true);
  };

  const handleSavePrecio = () => {
    if (!nuevoPrecio.competidorId) {
      toast({ title: "Error", description: "El competidor es obligatorio", variant: "destructive" });
      return;
    }
    createPrecioMutation.mutate(nuevoPrecio);
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "-";
    const num = parseFloat(price);
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(num);
  };

  const filteredProductos = productos.filter(p => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!p.nombreProducto.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Precios de Competencia</h2>
          <p className="text-muted-foreground">Monitorea precios de productos propios vs competencia</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              setEditingCompetidor(null);
              setNuevoCompetidor({ nombre: "", descripcion: "" });
              setCompetidorDialogOpen(true);
            }}
            data-testid="button-gestionar-competidores"
          >
            <Target className="mr-2 h-4 w-4" />
            Competidores
          </Button>
          <Button 
            onClick={() => {
              setEditingProducto(null);
              setNuevoProducto({ nombreProducto: "", precioListaGL: "", precioLista14: "", precioListaBalde4: "", precioListaBalde5: "" });
              setProductoDialogOpen(true);
            }}
            data-testid="button-nuevo-producto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos a Monitorear
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-producto"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingProductos ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredProductos.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No hay productos registrados</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredProductos.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProducto?.id === p.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedProducto(p)}
                      data-testid={`card-producto-${p.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{p.nombreProducto}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                            {p.precioListaGL && <span>GL: {formatPrice(p.precioListaGL)}</span>}
                            {p.precioLista14 && <span>1/4: {formatPrice(p.precioLista14)}</span>}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {p.precioListaBalde4 && <div>B4: {formatPrice(p.precioListaBalde4)}</div>}
                          {p.precioListaBalde5 && <div>B5: {formatPrice(p.precioListaBalde5)}</div>}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleEditProducto(p); }}
                          data-testid={`button-edit-producto-${p.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-delete-producto-${p.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar Producto</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Eliminar "{p.nombreProducto}"? Esto también eliminará todos sus precios de competencia.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProductoMutation.mutate(p.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Competidores ({competidores.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCompetidores ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : competidores.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-2">No hay competidores</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {competidores.map((c) => (
                    <Badge 
                      key={c.id} 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleEditCompetidor(c)}
                    >
                      {c.nombre}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedProducto ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedProducto.nombreProducto}</CardTitle>
                    <CardDescription>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {selectedProducto.precioListaGL && <span>GL: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioListaGL)}</span></span>}
                        {selectedProducto.precioLista14 && <span>1/4: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioLista14)}</span></span>}
                        {selectedProducto.precioListaBalde4 && <span>B4GL: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioListaBalde4)}</span></span>}
                        {selectedProducto.precioListaBalde5 && <span>B5GL: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioListaBalde5)}</span></span>}
                      </div>
                    </CardDescription>
                  </div>
                  <Button onClick={handleAddPrecio} data-testid="button-agregar-precio">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Precio Competidor
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPrecios ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : preciosProducto.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay precios de competencia registrados</p>
                    <p className="text-sm text-muted-foreground mt-1">Agrega precios de competidores para comparar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Competidor</TableHead>
                          <TableHead className="text-right">Precio Web</TableHead>
                          <TableHead className="text-right">Precio Ferretería</TableHead>
                          <TableHead className="text-right">Precio Construcción</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preciosProducto.map((p) => {
                          return (
                            <TableRow key={p.id} data-testid={`row-precio-${p.id}`}>
                              <TableCell>
                                <Badge variant="outline">{p.competidorNombre}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatPrice(p.precioWeb)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatPrice(p.precioFerreteria)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatPrice(p.precioConstruccion)}
                              </TableCell>
                              <TableCell>
                                {format(new Date(p.fechaRegistro), "dd/MM/yyyy", { locale: es })}
                                {p.urlReferencia && (
                                  <a 
                                    href={p.urlReferencia} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="ml-2 inline-flex items-center text-blue-500 hover:text-blue-700"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {(userRole === 'admin' || userRole === 'supervisor') && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-700"
                                        data-testid={`button-delete-precio-${p.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Eliminar Precio</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          ¿Eliminar este registro de precio?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deletePrecioMutation.mutate(p.id)}>
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-xl font-medium text-muted-foreground">Selecciona un producto</p>
                <p className="text-sm text-muted-foreground mt-1">Elige un producto de la lista para ver y agregar precios de competencia</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={productoDialogOpen} onOpenChange={setProductoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProducto ? "Editar Producto" : "Nuevo Producto a Monitorear"}</DialogTitle>
            <DialogDescription>
              {editingProducto ? "Modifica los datos del producto" : "Agrega un producto para comparar precios con la competencia"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre del Producto *</Label>
              <Input
                value={nuevoProducto.nombreProducto}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombreProducto: e.target.value })}
                placeholder="Ej: Esmalte al agua blanco"
                data-testid="input-producto-nombre"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio Galón (GL)</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioListaGL}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioListaGL: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-gl"
                />
              </div>
              <div>
                <Label>Precio 1/4 Galón</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioLista14}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioLista14: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-14"
                />
              </div>
              <div>
                <Label>Precio Balde (4 GL)</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioListaBalde4}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioListaBalde4: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-balde4"
                />
              </div>
              <div>
                <Label>Precio Balde (5 GL)</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioListaBalde5}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioListaBalde5: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-balde5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveProducto}
              disabled={createProductoMutation.isPending || updateProductoMutation.isPending}
              data-testid="button-guardar-producto"
            >
              {(createProductoMutation.isPending || updateProductoMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingProducto ? "Actualizar" : "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={precioDialogOpen} onOpenChange={setPrecioDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Precio de Competencia</DialogTitle>
            <DialogDescription>
              Agrega el precio de un competidor para "{selectedProducto?.nombreProducto}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Competidor *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={nuevoPrecio.competidorId} 
                    onValueChange={(v) => setNuevoPrecio({ ...nuevoPrecio, competidorId: v })}
                  >
                    <SelectTrigger data-testid="select-precio-competidor" className="flex-1">
                      <SelectValue placeholder="Seleccionar competidor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {competidores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setCompetidorDialogOpen(true)}
                    title="Agregar nuevo competidor"
                    data-testid="button-add-competidor-inline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Formato *</Label>
                <Select 
                  value={nuevoPrecio.formato} 
                  onValueChange={(v: "GL" | "14" | "BALDE4" | "BALDE5") => setNuevoPrecio({ ...nuevoPrecio, formato: v })}
                >
                  <SelectTrigger data-testid="select-precio-formato">
                    <SelectValue placeholder="Seleccionar formato..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GL">Galón (GL)</SelectItem>
                    <SelectItem value="14">1/4 Galón</SelectItem>
                    <SelectItem value="BALDE4">Balde 4 GL</SelectItem>
                    <SelectItem value="BALDE5">Balde 5 GL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Precio Web</Label>
                <Input
                  type="number"
                  value={nuevoPrecio.precioWeb}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, precioWeb: e.target.value })}
                  placeholder="0"
                  data-testid="input-precio-web"
                />
              </div>
              <div>
                <Label>Precio Ferretería</Label>
                <Input
                  type="number"
                  value={nuevoPrecio.precioFerreteria}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, precioFerreteria: e.target.value })}
                  placeholder="0"
                  data-testid="input-precio-ferreteria"
                />
              </div>
              <div>
                <Label>Precio Construcción</Label>
                <Input
                  type="number"
                  value={nuevoPrecio.precioConstruccion}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, precioConstruccion: e.target.value })}
                  placeholder="0"
                  data-testid="input-precio-construccion"
                />
              </div>
            </div>
            <div>
              <Label>URL de Referencia</Label>
              <Input
                value={nuevoPrecio.urlReferencia}
                onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, urlReferencia: e.target.value })}
                placeholder="https://..."
                data-testid="input-precio-url"
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={nuevoPrecio.notas}
                onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, notas: e.target.value })}
                placeholder="Observaciones adicionales..."
                rows={2}
                data-testid="input-precio-notas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrecioDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSavePrecio}
              disabled={createPrecioMutation.isPending}
              data-testid="button-guardar-precio"
            >
              {createPrecioMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={competidorDialogOpen} onOpenChange={setCompetidorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompetidor ? "Editar Competidor" : "Nuevo Competidor"}</DialogTitle>
            <DialogDescription>
              {editingCompetidor ? "Modifica los datos del competidor" : "Agrega un nuevo competidor para monitorear"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={nuevoCompetidor.nombre}
                onChange={(e) => setNuevoCompetidor({ ...nuevoCompetidor, nombre: e.target.value })}
                placeholder="Ej: Sherwin Williams"
                data-testid="input-competidor-nombre"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={nuevoCompetidor.descripcion}
                onChange={(e) => setNuevoCompetidor({ ...nuevoCompetidor, descripcion: e.target.value })}
                placeholder="Información adicional..."
                rows={2}
                data-testid="input-competidor-descripcion"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompetidorDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveCompetidor}
              disabled={createCompetidorMutation.isPending || updateCompetidorMutation.isPending}
              data-testid="button-guardar-competidor"
            >
              {(createCompetidorMutation.isPending || updateCompetidorMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingCompetidor ? "Actualizar" : "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
