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
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, DollarSign, FileText, Calendar, CheckCircle, XCircle, Clock, Loader2, Package, AlertTriangle, Edit, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SolicitudMarketing {
  id: string;
  titulo: string;
  descripcion: string;
  monto: string | null;
  urgencia: 'baja' | 'media' | 'alta';
  urlReferencia: string | null;
  pdfPresupuesto: string | null;
  pasos: { nombre: string; completado: boolean; orden: number }[] | null;
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
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudMarketing | null>(null);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-spinner" />
      </div>
    );
  }

  // Only admin and supervisor can access marketing module
  if (user.role !== 'admin' && user.role !== 'supervisor') {
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="solicitudes" data-testid="tab-solicitudes">
            <FileText className="mr-2 h-4 w-4" />
            Presupuesto y Solicitudes
          </TabsTrigger>
          <TabsTrigger value="inventario" data-testid="tab-inventario">
            <Package className="mr-2 h-4 w-4" />
            Inventario
          </TabsTrigger>
        </TabsList>

        {/* Tab: Presupuesto y Solicitudes */}
        <TabsContent value="solicitudes" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            {user.role === 'admin' && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => setPresupuestoDialogOpen(true)}
                  data-testid="button-config-presupuesto"
                  className="w-full sm:w-auto"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Presupuesto
                </Button>
                <Button 
                  onClick={() => setSolicitudDialogOpen(true)}
                  data-testid="button-nueva-solicitud"
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Solicitudes
                </Button>
              </>
            )}
            {user.role === 'supervisor' && (
              <Button 
                onClick={() => setSolicitudDialogOpen(true)}
                data-testid="button-nueva-solicitud"
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva Solicitud
              </Button>
            )}
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

          <MetricsDashboard mes={selectedMes} anio={selectedAnio} />

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
            userRole={user.role}
          />
        </TabsContent>

        {/* Tab: Inventario */}
        <TabsContent value="inventario" className="space-y-6">
          <InventarioMarketing userRole={user.role} />
        </TabsContent>
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
  userRole,
}: {
  mes: number;
  anio: number;
  selectedEstado: string;
  onEstadoChange: (estado: string) => void;
  onEditEstado: (solicitud: SolicitudMarketing) => void;
  onEdit: (solicitud: SolicitudMarketing) => void;
  onDelete: (solicitud: SolicitudMarketing) => void;
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
                    {userRole === 'admin' && <TableHead>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitudes.map((solicitud) => (
                    <TableRow key={solicitud.id} data-testid={`row-solicitud-${solicitud.id}`}>
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
                        <PasosChecklist solicitudId={solicitud.id} pasos={solicitud.pasos || []} userRole={userRole} />
                      </TableCell>
                      {userRole === 'admin' && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEdit(solicitud)}
                              data-testid={`button-editar-${solicitud.id}`}
                              title="Editar solicitud"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEditEstado(solicitud)}
                              data-testid={`button-cambiar-estado-${solicitud.id}`}
                              title="Cambiar estado"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDelete(solicitud)}
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
                <Card key={solicitud.id} data-testid={`card-solicitud-${solicitud.id}`}>
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
                        <div className="pt-3 border-t">
                          <span className="text-sm font-medium text-muted-foreground">Pasos:</span>
                          <div className="mt-2">
                            <PasosChecklist solicitudId={solicitud.id} pasos={solicitud.pasos} userRole={userRole} />
                          </div>
                        </div>
                      )}

                      {userRole === 'admin' && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            className="flex-1"
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(solicitud)}
                            data-testid={`button-editar-mobile-${solicitud.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            className="flex-1"
                            size="sm"
                            variant="outline"
                            onClick={() => onEditEstado(solicitud)}
                            data-testid={`button-cambiar-estado-mobile-${solicitud.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Estado
                          </Button>
                          <Button
                            className="flex-1"
                            size="sm"
                            variant="outline"
                            onClick={() => onDelete(solicitud)}
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
  const [urlReferencia, setUrlReferencia] = useState("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [pasos, setPasos] = useState<{ nombre: string; completado: boolean; orden: number }[]>([]);
  const [nuevoPaso, setNuevoPaso] = useState("");

  // Obtener lista de supervisores (solo para admin)
  const { data: supervisores = [] } = useQuery<any[]>({
    queryKey: ['/api/users/salespeople/supervisors'],
    enabled: user?.role === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/marketing/solicitudes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
      toast({
        title: "Solicitud creada",
        description: "La solicitud ha sido enviada correctamente",
      });
      onOpenChange(false);
      // Reset form
      setTitulo("");
      setDescripcion("");
      setUrgencia("baja");
      setFechaEntrega("");
      setUrlReferencia("");
      setSelectedSupervisorId("");
      setPasos([]);
      setNuevoPaso("");
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

    // Si es admin, debe seleccionar un supervisor
    if (user?.role === 'admin' && !selectedSupervisorId) {
      toast({
        title: "Error",
        description: "Debe seleccionar un supervisor",
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
      fechaEntrega: fechaEntrega || null,
      urlReferencia: urlReferencia || null,
      pasos,
    };

    // Si es admin, incluir supervisorId
    if (user?.role === 'admin') {
      data.supervisorId = selectedSupervisorId;
    }

    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full" data-testid="dialog-nueva-solicitud">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Marketing</DialogTitle>
          <DialogDescription>
            Complete el formulario para crear una nueva solicitud
          </DialogDescription>
        </DialogHeader>
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
          {user?.role === 'admin' && (
            <div>
              <Label htmlFor="supervisor">Supervisor*</Label>
              <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                <SelectTrigger data-testid="select-supervisor">
                  <SelectValue placeholder="Seleccione un supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisores.map((supervisor: any) => (
                    <SelectItem key={supervisor.id} value={supervisor.id} data-testid={`option-supervisor-${supervisor.id}`}>
                      {supervisor.salespersonName || `${supervisor.firstName} ${supervisor.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Seleccione el supervisor que realiza la solicitud
              </p>
            </div>
          )}
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
            <Label htmlFor="urlReferencia">URL de Referencia (Opcional)</Label>
            <Input
              id="urlReferencia"
              placeholder="https://ejemplo.com/documento.pdf"
              value={urlReferencia}
              onChange={(e) => setUrlReferencia(e.target.value)}
              data-testid="input-url-referencia"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Puede agregar un enlace de referencia con detalles de la solicitud
            </p>
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
            disabled={createMutation.isPending}
            data-testid="button-crear-solicitud"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
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
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState("baja");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [urlReferencia, setUrlReferencia] = useState("");
  const [pasos, setPasos] = useState<{ nombre: string; completado: boolean; orden: number }[]>([]);
  const [nuevoPaso, setNuevoPaso] = useState("");

  // Pre-cargar datos cuando se abre el diálogo
  useEffect(() => {
    if (solicitud && open) {
      setTitulo(solicitud.titulo || "");
      setDescripcion(solicitud.descripcion || "");
      setUrgencia(solicitud.urgencia || "baja");
      setFechaEntrega(solicitud.fechaEntrega || "");
      setUrlReferencia(solicitud.urlReferencia || "");
      setPasos(solicitud.pasos || []);
      setNuevoPaso("");
    }
  }, [solicitud, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/marketing/solicitudes/${solicitud?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
      toast({
        title: "Solicitud actualizada",
        description: "Los cambios han sido guardados correctamente",
      });
      onOpenChange(false);
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
      fechaEntrega: fechaEntrega || null,
      urlReferencia: urlReferencia || null,
      pasos,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full" data-testid="dialog-editar-solicitud">
        <DialogHeader>
          <DialogTitle>Editar Solicitud de Marketing</DialogTitle>
          <DialogDescription>
            Modifique los campos necesarios
          </DialogDescription>
        </DialogHeader>
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
            <Label htmlFor="edit-urlReferencia">URL de Referencia</Label>
            <Input
              id="edit-urlReferencia"
              type="url"
              placeholder="https://ejemplo.com/referencia"
              value={urlReferencia}
              onChange={(e) => setUrlReferencia(e.target.value)}
              data-testid="input-edit-url-referencia"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Adjunte un enlace con información de referencia
            </p>
          </div>
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
            disabled={updateMutation.isPending}
            data-testid="button-guardar-editar"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
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
