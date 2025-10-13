import { useState } from "react";
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
import { Plus, TrendingUp, DollarSign, FileText, Calendar, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SolicitudMarketing {
  id: string;
  titulo: string;
  descripcion: string;
  monto: string | null;
  pdfUrl: string | null;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Marketing</h1>
          <p className="text-muted-foreground">Gestión de presupuesto y solicitudes de marketing</p>
        </div>
        <div className="flex gap-2">
          {user.role === 'admin' && (
            <>
              <Button 
                variant="outline"
                onClick={() => setPresupuestoDialogOpen(true)}
                data-testid="button-config-presupuesto"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Presupuesto
              </Button>
              <Button 
                onClick={() => setSolicitudDialogOpen(true)}
                data-testid="button-nueva-solicitud"
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
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva Solicitud
            </Button>
          )}
        </div>
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

      {/* Metrics Dashboard */}
      <MetricsDashboard mes={selectedMes} anio={selectedAnio} />

      {/* Solicitudes List */}
      <SolicitudesList
        mes={selectedMes}
        anio={selectedAnio}
        selectedEstado={selectedEstado}
        onEstadoChange={setSelectedEstado}
        onEditEstado={(solicitud) => {
          setSelectedSolicitud(solicitud);
          setEstadoDialogOpen(true);
        }}
        userRole={user.role}
      />

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
            ${metrics?.presupuestoTotal.toLocaleString('es-CL') || '0'}
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
            ${metrics?.presupuestoUtilizado.toLocaleString('es-CL') || '0'}
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
            ${metrics?.presupuestoDisponible.toLocaleString('es-CL') || '0'}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics?.totalSolicitudes || 0} solicitudes totales
          </p>
        </CardContent>
      </Card>
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
  userRole,
}: {
  mes: number;
  anio: number;
  selectedEstado: string;
  onEstadoChange: (estado: string) => void;
  onEditEstado: (solicitud: SolicitudMarketing) => void;
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
        <div className="flex justify-between items-center">
          <CardTitle>Solicitudes de Marketing</CardTitle>
          <Select value={selectedEstado} onValueChange={onEstadoChange}>
            <SelectTrigger className="w-[200px]" data-testid="select-estado-filter">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Solicitud</TableHead>
                <TableHead>Fecha Entrega</TableHead>
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
                      variant={
                        solicitud.estado === 'rechazado' ? 'destructive' :
                        solicitud.estado === 'completado' ? 'default' :
                        'secondary'
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
                  {userRole === 'admin' && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditEstado(solicitud)}
                        data-testid={`button-cambiar-estado-${solicitud.id}`}
                      >
                        Cambiar Estado
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
  const [presupuestoTotal, setPresupuestoTotal] = useState("");

  const { data: presupuestoActual } = useQuery({
    queryKey: ['/api/marketing/presupuesto', mes, anio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/presupuesto/${mes}/${anio}`, {
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
      const response = await apiRequest('/api/marketing/presupuesto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
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
      mes,
      anio,
      presupuestoTotal: monto,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-presupuesto">
        <DialogHeader>
          <DialogTitle>Configurar Presupuesto Mensual</DialogTitle>
          <DialogDescription>
            Configure el presupuesto total para el período seleccionado
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {presupuestoActual && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">Presupuesto actual:</p>
              <p className="text-2xl font-bold">
                ${parseFloat(presupuestoActual.presupuestoTotal).toLocaleString('es-CL')}
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="presupuestoTotal">Presupuesto Total</Label>
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
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/marketing/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
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
      setFechaEntrega("");
      setPdfUrl("");
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

    createMutation.mutate({
      titulo,
      descripcion,
      mes,
      anio,
      fechaEntrega: fechaEntrega || null,
      pdfUrl: pdfUrl || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-nueva-solicitud">
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
            <Label htmlFor="pdfUrl">URL del PDF (Opcional)</Label>
            <Input
              id="pdfUrl"
              placeholder="https://ejemplo.com/documento.pdf"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              data-testid="input-pdf-url"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Puede subir un PDF con el detalle de la solicitud
            </p>
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

  const updateMutation = useMutation({
    mutationFn: async (data: { estado: string; motivoRechazo?: string; monto?: number }) => {
      const response = await apiRequest(`/api/marketing/solicitudes/${solicitud?.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
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

    // Si la solicitud no tiene monto y se está aprobando (en_proceso o completado), requerir monto
    if (!solicitud?.monto && (nuevoEstado === 'en_proceso' || nuevoEstado === 'completado')) {
      if (!monto) {
        toast({
          title: "Error",
          description: "Debe ingresar el monto presupuestado",
          variant: "destructive",
        });
        return;
      }
      
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
      monto: monto && !solicitud?.monto ? parseFloat(monto) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-cambiar-estado">
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
              <Label htmlFor="monto">Monto Presupuestado (CLP)*</Label>
              <Input
                id="monto"
                type="number"
                placeholder="Ej: 500000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                data-testid="input-monto-aprobacion"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ingrese el monto luego de presupuestar la solicitud
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
