import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, 
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Upload,
  Image as ImageIcon,
  Eye,
  XCircle,
  Calendar,
  MoreVertical,
  ChevronsUpDown,
  Check,
  CalendarIcon,
  Settings,
  Trash2
} from "lucide-react";
import type { SolicitudMantencion, MantencionPhoto, EquipoCritico, ProveedorExterno } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MantencionWithDetails extends SolicitudMantencion {
  photos: MantencionPhoto[];
  resolucionPhotos: MantencionPhoto[];
  historial: Array<{
    id: string;
    estadoAnterior: string | null;
    estadoNuevo: string;
    userName: string;
    notas: string | null;
    createdAt: string;
  }>;
}

const TIPO_MANTENCION_OPTIONS = [
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'predictivo', label: 'Predictivo' },
];

const GRAVEDAD_OPTIONS = [
  { value: 'baja', label: 'Baja', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'media', label: 'Media', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
];

const AREA_OPTIONS = [
  { value: 'administracion', label: 'Administración' },
  { value: 'produccion', label: 'Producción' },
  { value: 'bodega_materias_primas', label: 'Bodega de Materias Primas' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'bodega_productos_terminados', label: 'Bodega de Productos Terminados' },
  { value: 'patio', label: 'Patio' },
  { value: 'servicios_generales', label: 'Servicios Generales' },
];

const ESTADO_OPTIONS = [
  { value: 'registrado', label: 'Registrado', icon: Clock, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  { value: 'en_reparacion', label: 'En Reparación', icon: Wrench, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'resuelto', label: 'Resuelto', icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'cerrado', label: 'Cerrado', icon: XCircle, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
];

// Componente para el tab de Seguimiento
function SeguimientoTab({ 
  mantencion, 
  canManageMantencion,
  onUpdate 
}: { 
  mantencion: MantencionWithDetails; 
  canManageMantencion: boolean;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [isPausarDialogOpen, setIsPausarDialogOpen] = useState(false);
  const [isReanudarDialogOpen, setIsReanudarDialogOpen] = useState(false);
  const [isAsignacionDialogOpen, setIsAsignacionDialogOpen] = useState(false);

  // Mutación para pausar OT
  const pausarMutation = useMutation({
    mutationFn: async (data: { motivo: string }) => {
      return await apiRequest(`/api/mantenciones/${mantencion.id}/pausar`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsPausarDialogOpen(false);
      onUpdate();
      toast({
        title: "OT pausada",
        description: "La orden de trabajo ha sido pausada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al pausar OT",
        description: error.message || "No se pudo pausar la orden de trabajo.",
        variant: "destructive",
      });
    },
  });

  // Mutación para reanudar OT
  const reanudarMutation = useMutation({
    mutationFn: async (data: { notas?: string }) => {
      return await apiRequest(`/api/mantenciones/${mantencion.id}/reanudar`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsReanudarDialogOpen(false);
      onUpdate();
      toast({
        title: "OT reanudada",
        description: "La orden de trabajo ha sido reanudada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al reanudar OT",
        description: error.message || "No se pudo reanudar la orden de trabajo.",
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar asignación
  const asignacionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/mantenciones/${mantencion.id}/asignacion`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsAsignacionDialogOpen(false);
      onUpdate();
      toast({
        title: "Asignación actualizada",
        description: "La asignación de la OT ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar asignación",
        description: error.message || "No se pudo actualizar la asignación.",
        variant: "destructive",
      });
    },
  });

  const handlePausarSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const motivo = formData.get('motivo') as string;
    
    // Validar longitud mínima
    if (!motivo || motivo.trim().length < 10) {
      toast({
        title: "Motivo inválido",
        description: "El motivo de pausa debe tener al menos 10 caracteres.",
        variant: "destructive",
      });
      return;
    }
    
    pausarMutation.mutate({ motivo });
  };

  const handleReanudarSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    reanudarMutation.mutate({ notas: (formData.get('notas') as string) || undefined });
  };

  const handleAsignacionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tipoAsignacion = formData.get('tipoAsignacion') as string;
    
    const data: any = { tipoAsignacion };
    
    if (tipoAsignacion === 'tecnico_interno') {
      data.tecnicoAsignadoId = formData.get('tecnicoAsignadoId') as string;
      data.proveedorAsignadoId = null;
      data.proveedorAsignadoName = null;
    } else if (tipoAsignacion === 'proveedor_externo') {
      data.proveedorAsignadoId = formData.get('proveedorAsignadoId') as string;
      data.tecnicoAsignadoId = null;
      data.tecnicoAsignadoName = null;
    }
    
    asignacionMutation.mutate(data);
  };

  const canPausar = canManageMantencion && (mantencion.estado === 'en_curso' || mantencion.estado === 'registrado');
  const canReanudar = canManageMantencion && mantencion.estado === 'pausada';

  return (
    <>
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-6">
          {/* Estado Actual */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Estado Actual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <Label className="text-muted-foreground">Estado</Label>
                  <div className="mt-2">
                    {ESTADO_OPTIONS.find(e => e.value === mantencion.estado)?.label || mantencion.estado}
                  </div>
                </CardContent>
              </Card>
              
              {mantencion.estado === 'pausada' && mantencion.motivoPausa && (
                <Card>
                  <CardContent className="p-4">
                    <Label className="text-muted-foreground">Motivo de Pausa</Label>
                    <p className="mt-2 text-sm">{mantencion.motivoPausa}</p>
                    {mantencion.fechaPausa && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Pausada el {format(new Date(mantencion.fechaPausa), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Acciones de Control */}
          {canManageMantencion && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Acciones de Control</h3>
              <div className="flex flex-wrap gap-3">
                {canPausar && (
                  <Button
                    variant="outline"
                    onClick={() => setIsPausarDialogOpen(true)}
                    data-testid="button-pausar-ot"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Pausar OT
                  </Button>
                )}
                
                {canReanudar && (
                  <Button
                    onClick={() => setIsReanudarDialogOpen(true)}
                    data-testid="button-reanudar-ot"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Reanudar OT
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => setIsAsignacionDialogOpen(true)}
                  data-testid="button-actualizar-asignacion"
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Actualizar Asignación
                </Button>
              </div>
            </div>
          )}

          {/* Asignación Actual */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Asignación Actual</h3>
            <Card>
              <CardContent className="p-4">
                {mantencion.tipoAsignacion === 'tecnico_interno' && mantencion.tecnicoAsignadoName ? (
                  <div>
                    <Label className="text-muted-foreground">Técnico Interno</Label>
                    <p className="mt-1 font-medium">{mantencion.tecnicoAsignadoName}</p>
                  </div>
                ) : mantencion.tipoAsignacion === 'proveedor_externo' && mantencion.proveedorAsignadoName ? (
                  <div>
                    <Label className="text-muted-foreground">Proveedor Externo</Label>
                    <p className="mt-1 font-medium">{mantencion.proveedorAsignadoName}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Sin asignación</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Información de Programación */}
          {mantencion.fechaProgramada && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Programación</h3>
              <Card>
                <CardContent className="p-4">
                  <Label className="text-muted-foreground">Fecha Programada</Label>
                  <p className="mt-1 font-medium">
                    {format(new Date(mantencion.fechaProgramada), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Dialog para pausar OT */}
      <Dialog open={isPausarDialogOpen} onOpenChange={setIsPausarDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pausar Orden de Trabajo</DialogTitle>
            <DialogDescription>
              Indique el motivo por el cual se pausará esta OT
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePausarSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo de Pausa *</Label>
                <Textarea
                  id="motivo"
                  name="motivo"
                  required
                  minLength={10}
                  rows={4}
                  placeholder="Ej: Esperando repuestos, falta de personal, etc."
                  data-testid="textarea-motivo-pausa"
                />
                <p className="text-sm text-muted-foreground">
                  Mínimo 10 caracteres
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPausarDialogOpen(false)}
                  data-testid="button-cancel-pausar"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={pausarMutation.isPending}
                  data-testid="button-submit-pausar"
                >
                  {pausarMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Pausar OT
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para reanudar OT */}
      <Dialog open={isReanudarDialogOpen} onOpenChange={setIsReanudarDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reanudar Orden de Trabajo</DialogTitle>
            <DialogDescription>
              Agregue notas opcionales sobre la reanudación
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReanudarSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Textarea
                  id="notas"
                  name="notas"
                  rows={3}
                  placeholder="Ej: Repuestos recibidos, personal disponible..."
                  data-testid="textarea-notas-reanudar"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReanudarDialogOpen(false)}
                  data-testid="button-cancel-reanudar"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={reanudarMutation.isPending}
                  data-testid="button-submit-reanudar"
                >
                  {reanudarMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Reanudar OT
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para actualizar asignación */}
      <Dialog open={isAsignacionDialogOpen} onOpenChange={setIsAsignacionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar Asignación</DialogTitle>
            <DialogDescription>
              Asigne un técnico interno o proveedor externo a esta OT
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAsignacionSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Asignación *</Label>
                <RadioGroup name="tipoAsignacion" defaultValue={mantencion.tipoAsignacion || "tecnico_interno"} required>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tecnico_interno" id="tecnico" data-testid="radio-tecnico-interno" />
                    <Label htmlFor="tecnico" className="font-normal cursor-pointer">Técnico Interno</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="proveedor_externo" id="proveedor" data-testid="radio-proveedor-externo" />
                    <Label htmlFor="proveedor" className="font-normal cursor-pointer">Proveedor Externo</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asignado">Asignado a *</Label>
                <Input
                  id="tecnicoAsignadoId"
                  name="tecnicoAsignadoId"
                  placeholder="ID del técnico/proveedor"
                  data-testid="input-asignado-id"
                />
                <p className="text-sm text-muted-foreground">
                  Ingrese el ID del técnico o proveedor
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAsignacionDialogOpen(false)}
                  data-testid="button-cancel-asignacion"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={asignacionMutation.isPending}
                  data-testid="button-submit-asignacion"
                >
                  {asignacionMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Actualizar
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Componente para el tab de Historial
function HistorialTab({ mantencion }: { mantencion: MantencionWithDetails }) {
  const [selectedImage, setSelectedImage] = useState<{ url: string; description?: string } | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Crear timeline combinando historial y fotos
  const timelineEvents: Array<{
    id: string;
    tipo: 'cambio_estado' | 'foto_problema' | 'foto_resolucion' | 'creacion';
    fecha: string;
    titulo: string;
    descripcion?: string;
    estadoAnterior?: string | null;
    estadoNuevo?: string;
    userName?: string;
    photoUrl?: string;
  }> = [];

  // Agregar evento de creación
  if (mantencion.createdAt) {
    timelineEvents.push({
      id: `creacion-${mantencion.id}`,
      tipo: 'creacion',
      fecha: mantencion.createdAt,
      titulo: 'OT Creada',
      descripcion: `Equipo: ${mantencion.equipoNombre}`,
    });
  }

  // Agregar historial de cambios
  if (mantencion.historial) {
    mantencion.historial.forEach((entry) => {
      timelineEvents.push({
        id: entry.id,
        tipo: 'cambio_estado',
        fecha: entry.createdAt,
        titulo: 'Cambio de Estado',
        descripcion: entry.notas || undefined,
        estadoAnterior: entry.estadoAnterior,
        estadoNuevo: entry.estadoNuevo,
        userName: entry.userName,
      });
    });
  }

  // Agregar fotos del problema
  if (mantencion.photos) {
    mantencion.photos.forEach((photo) => {
      timelineEvents.push({
        id: photo.id,
        tipo: 'foto_problema',
        fecha: photo.createdAt || mantencion.createdAt || new Date().toISOString(),
        titulo: 'Foto del Problema',
        descripcion: photo.description || undefined,
        photoUrl: photo.photoUrl,
      });
    });
  }

  // Agregar fotos de resolución
  if (mantencion.resolucionPhotos) {
    mantencion.resolucionPhotos.forEach((photo) => {
      timelineEvents.push({
        id: photo.id,
        tipo: 'foto_resolucion',
        fecha: photo.createdAt || mantencion.fechaResolucion || new Date().toISOString(),
        titulo: 'Foto de Resolución',
        descripcion: photo.description || undefined,
        photoUrl: photo.photoUrl,
      });
    });
  }

  // Ordenar por fecha (más reciente primero)
  timelineEvents.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <>
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3">Historial Completo</h3>
          
          {timelineEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay eventos registrados en el historial</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              
              {/* Timeline events */}
              <div className="space-y-4">
                {timelineEvents.map((event, index) => (
                  <div key={event.id} className="relative pl-10" data-testid={`timeline-${event.tipo}-${index}`}>
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute left-2.5 w-3 h-3 rounded-full border-2 border-background",
                      event.tipo === 'creacion' && "bg-blue-500",
                      event.tipo === 'cambio_estado' && "bg-purple-500",
                      event.tipo === 'foto_problema' && "bg-orange-500",
                      event.tipo === 'foto_resolucion' && "bg-green-500"
                    )} />
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold">{event.titulo}</h4>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(event.fecha), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                              {event.userName && ` • ${event.userName}`}
                            </p>
                            
                            {/* Cambio de estado */}
                            {event.tipo === 'cambio_estado' && (
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                {event.estadoAnterior && (
                                  <>
                                    <Badge variant="outline" className="text-xs">
                                      {ESTADO_OPTIONS.find(e => e.value === event.estadoAnterior)?.label || event.estadoAnterior}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">→</span>
                                  </>
                                )}
                                <Badge className={(ESTADO_OPTIONS.find(e => e.value === event.estadoNuevo)?.color || '') + " text-xs"}>
                                  {ESTADO_OPTIONS.find(e => e.value === event.estadoNuevo)?.label || event.estadoNuevo}
                                </Badge>
                              </div>
                            )}
                            
                            {/* Descripción */}
                            {event.descripcion && (
                              <p className="mt-2 text-sm">{event.descripcion}</p>
                            )}
                          </div>
                          
                          {/* Foto preview */}
                          {event.photoUrl && (
                            <div className="relative group cursor-pointer" onClick={() => {
                              setSelectedImage({ url: event.photoUrl!, description: event.descripcion });
                              setShowImageModal(true);
                            }}>
                              <img
                                src={event.photoUrl}
                                alt={event.descripcion || event.titulo}
                                className="w-24 h-24 object-cover rounded border hover:opacity-80 transition-opacity"
                                data-testid={`img-timeline-${event.id}`}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded flex items-center justify-center">
                                <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Imagen del Historial</DialogTitle>
            {selectedImage?.description && (
              <DialogDescription>{selectedImage.description}</DialogDescription>
            )}
          </DialogHeader>
          {selectedImage && (
            <div className="flex items-center justify-center">
              <img
                src={selectedImage.url}
                alt={selectedImage.description || 'Imagen'}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Componente para el tab de Gastos
function GastosTab({ mantencionId, canManageGastos }: { mantencionId: string; canManageGastos: boolean }) {
  const { toast } = useToast();
  const [isAddGastoDialogOpen, setIsAddGastoDialogOpen] = useState(false);

  // Query para obtener gastos de la OT
  const { data: gastos = [], isLoading } = useQuery<Array<{
    id: string;
    fecha: string;
    item: string;
    descripcion: string | null;
    cantidad: string;
    costoUnitario: string;
    costoTotal: string;
    proveedorId: string | null;
  }>>({
    queryKey: ['/api/mantenciones', mantencionId, 'gastos'],
  });

  // Mutación para agregar gasto
  const addGastoMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/mantenciones/${mantencionId}/gastos`, {
        method: 'POST',
        data: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones', mantencionId, 'gastos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsAddGastoDialogOpen(false);
      toast({
        title: "Gasto agregado",
        description: "El gasto se ha agregado correctamente a la orden de trabajo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al agregar gasto",
        description: error.message || "No se pudo agregar el gasto. Por favor, intente nuevamente.",
        variant: "destructive",
      });
    },
  });

  const handleAddGastoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const item = formData.get('item') as string;
    const descripcion = formData.get('descripcion') as string;
    const cantidad = formData.get('cantidad') as string;
    const costoUnitario = formData.get('costoUnitario') as string;
    
    const data = {
      item,
      descripcion: descripcion || undefined,
      cantidad: parseFloat(cantidad),
      costoUnitario: parseFloat(costoUnitario),
    };

    addGastoMutation.mutate(data);
  };

  // Calcular total de gastos
  const totalGastos = gastos.reduce((sum, gasto) => {
    const total = typeof gasto.costoTotal === 'string' ? parseFloat(gasto.costoTotal) : Number(gasto.costoTotal);
    return sum + (isNaN(total) ? 0 : total);
  }, 0);

  return (
    <>
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4">
          {/* Header con botón para agregar */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Gastos de Materiales</h3>
              <p className="text-sm text-muted-foreground">
                Total: ${totalGastos.toLocaleString('es-CL')}
              </p>
            </div>
            {canManageGastos && (
              <Button
                size="sm"
                onClick={() => setIsAddGastoDialogOpen(true)}
                data-testid="button-add-gasto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Gasto
              </Button>
            )}
          </div>

          {/* Tabla de gastos */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : gastos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay gastos registrados para esta orden de trabajo</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-right p-3 font-medium">Cantidad</th>
                    <th className="text-right p-3 font-medium">Costo Unit.</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((gasto) => (
                    <tr key={gasto.id} className="border-t" data-testid={`row-gasto-${gasto.id}`}>
                      <td className="p-3 text-sm">
                        {format(new Date(gasto.fecha), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{gasto.item}</p>
                          {gasto.descripcion && (
                            <p className="text-sm text-muted-foreground">{gasto.descripcion}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">{Number(gasto.cantidad).toLocaleString('es-CL')}</td>
                      <td className="p-3 text-right">${Number(gasto.costoUnitario).toLocaleString('es-CL')}</td>
                      <td className="p-3 text-right font-semibold">
                        ${Number(gasto.costoTotal).toLocaleString('es-CL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted font-semibold">
                  <tr>
                    <td colSpan={4} className="p-3 text-right">Total General:</td>
                    <td className="p-3 text-right">${totalGastos.toLocaleString('es-CL')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Dialog para agregar gasto */}
      <Dialog open={isAddGastoDialogOpen} onOpenChange={setIsAddGastoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Gasto de Material</DialogTitle>
            <DialogDescription>
              Registre los materiales utilizados en esta orden de trabajo
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddGastoSubmit}>
            <div className="space-y-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="item">Item / Material *</Label>
                <Input
                  id="item"
                  name="item"
                  required
                  placeholder="Ej: Filtro de aire"
                  data-testid="input-gasto-item"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  name="descripcion"
                  rows={2}
                  placeholder="Detalles adicionales..."
                  data-testid="textarea-gasto-descripcion"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cantidad">Cantidad *</Label>
                  <Input
                    id="cantidad"
                    name="cantidad"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="1"
                    data-testid="input-gasto-cantidad"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costoUnitario">Costo Unitario *</Label>
                  <Input
                    id="costoUnitario"
                    name="costoUnitario"
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="0"
                    data-testid="input-gasto-costo"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddGastoDialogOpen(false)}
                data-testid="button-cancel-gasto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={addGastoMutation.isPending}
                data-testid="button-submit-gasto"
              >
                {addGastoMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Agregar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MantencionesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedMantencion, setSelectedMantencion] = useState<MantencionWithDetails | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; description?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolutionFileInputRef = useRef<HTMLInputElement>(null);
  const [gravedad, setGravedad] = useState('media');
  const [tipoMantencion, setTipoMantencion] = useState('correctivo');
  const [area, setArea] = useState('produccion');

  // Nuevo formulario mejorado - Estados
  const [openEquiposCombo, setOpenEquiposCombo] = useState(false);
  const [selectedEquipoId, setSelectedEquipoId] = useState("");
  const [esManual, setEsManual] = useState(false);

  // Estados para asignación (solo admin/supervisor/produccion)
  const [isEditingAsignacion, setIsEditingAsignacion] = useState(false);
  const [tipoEjecucionEdit, setTipoEjecucionEdit] = useState<"inmediata" | "programada" | null>(null);
  const [fechaProgramadaEdit, setFechaProgramadaEdit] = useState<Date | undefined>();
  const [tipoAsignacionEdit, setTipoAsignacionEdit] = useState<"tecnico_interno" | "proveedor_externo" | null>(null);
  const [tecnicoAsignadoIdEdit, setTecnicoAsignadoIdEdit] = useState("");
  const [proveedorAsignadoIdEdit, setProveedorAsignadoIdEdit] = useState("");

  // Estados para filtros
  const [filtroTipoEjecucion, setFiltroTipoEjecucion] = useState("todos");
  const [filtroTecnico, setFiltroTecnico] = useState("todos");
  const [filtroProveedor, setFiltroProveedor] = useState("todos");

  const canSubmitResolution = user?.role === 'produccion' || user?.role === 'admin' || user?.role === 'supervisor';
  const canManageMantencion = user?.role === 'produccion' || user?.role === 'admin' || user?.role === 'supervisor';

  const { data: mantenciones = [], isLoading } = useQuery<MantencionWithDetails[]>({
    queryKey: ['/api/mantenciones'],
  });

  const { data: equiposCriticos = [] } = useQuery<EquipoCritico[]>({
    queryKey: ['/api/cmms/equipos'],
  });

  const { data: proveedores = [] } = useQuery<ProveedorExterno[]>({
    queryKey: ['/api/cmms/proveedores'],
  });

  const { data: usuarios = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const tecnicos = useMemo(() => {
    return usuarios.filter(u => u.role === 'produccion');
  }, [usuarios]);

  const selectedEquipo = useMemo(() => {
    return equiposCriticos.find(e => e.id === selectedEquipoId);
  }, [equiposCriticos, selectedEquipoId]);

  // Organize equipment hierarchically for display
  const equiposJerarquicos = useMemo(() => {
    const principales = equiposCriticos.filter(e => !e.equipoPadreId);
    const result: Array<{equipo: EquipoCritico; nivel: number}> = [];
    
    principales.forEach(principal => {
      result.push({ equipo: principal, nivel: 0 });
      const componentes = equiposCriticos.filter(e => e.equipoPadreId === principal.id);
      componentes.forEach(componente => {
        result.push({ equipo: componente, nivel: 1 });
      });
    });
    
    return result;
  }, [equiposCriticos]);

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest('/api/mantenciones', {
        method: 'POST',
        data: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Éxito",
        description: "Solicitud de mantención creada correctamente",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Error al crear solicitud";
      
      try {
        const errorData = JSON.parse(error.message.split(': ')[1]);
        if (errorData.errors && errorData.errors.length > 0) {
          errorMessage = errorData.errors.map((e: any) => e.message).join(', ');
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = error.message || "Error al crear solicitud";
      }
      
      toast({
        title: "Error al crear solicitud",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const submitResolutionMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      return await apiRequest(`/api/mantenciones/${id}/resolucion`, {
        method: 'POST',
        data: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsResolutionDialogOpen(false);
      setSelectedMantencion(null);
      toast({
        title: "Éxito",
        description: "Resolución enviada correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al enviar resolución",
        variant: "destructive",
      });
    },
  });

  const updateAsignacionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/mantenciones/${id}/asignacion`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsEditingAsignacion(false);
      toast({
        title: "Asignación actualizada",
        description: "Los datos de asignación y programación se han actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar asignación",
        description: error.message || "No se pudo actualizar la asignación. Por favor, intente nuevamente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/mantenciones/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
      setIsDetailsDialogOpen(false);
      setSelectedMantencion(null);
      toast({
        title: "Orden eliminada",
        description: "La orden de trabajo ha sido eliminada correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar la orden de trabajo.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // Add additional fields
    if (selectedEquipo && !esManual) {
      formData.set('equipoId', selectedEquipo.id);
      formData.set('equipoCodigo', selectedEquipo.codigo || '');
      formData.set('equipoNombre', selectedEquipo.nombre);
      formData.set('area', selectedEquipo.area);
    }

    createMutation.mutate(formData);
  };

  const resetFormulario = () => {
    setGravedad('media');
    setTipoMantencion('correctivo');
    setArea('produccion');
    setSelectedEquipoId("");
    setEsManual(false);
  };

  const handleResolutionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMantencion) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (resolutionFileInputRef.current?.files) {
      Array.from(resolutionFileInputRef.current.files).forEach((file) => {
        formData.append('photos', file);
      });
    }

    submitResolutionMutation.mutate({ id: selectedMantencion.id, formData });
  };

  const handleAsignacionSubmit = () => {
    if (!selectedMantencion) return;

    const data: any = {};

    // Tipo de ejecución y fecha programada
    if (tipoEjecucionEdit === 'inmediata') {
      data.tipoEjecucion = 'inmediata';
      data.fechaProgramada = null;
    } else if (tipoEjecucionEdit === 'programada' && fechaProgramadaEdit) {
      data.tipoEjecucion = 'programada';
      data.fechaProgramada = fechaProgramadaEdit.toISOString();
    }

    // Asignación
    if (tipoAsignacionEdit === 'tecnico_interno' && tecnicoAsignadoIdEdit) {
      const tecnico = tecnicos.find(t => t.id === tecnicoAsignadoIdEdit);
      data.tipoAsignacion = 'tecnico_interno';
      data.tecnicoAsignadoId = tecnicoAsignadoIdEdit;
      data.tecnicoAsignadoName = tecnico?.name || tecnico?.username || '';
      data.proveedorAsignadoId = null;
      data.proveedorAsignadoName = null;
    } else if (tipoAsignacionEdit === 'proveedor_externo' && proveedorAsignadoIdEdit) {
      const proveedor = proveedores.find(p => p.id === proveedorAsignadoIdEdit);
      data.tipoAsignacion = 'proveedor_externo';
      data.proveedorAsignadoId = proveedorAsignadoIdEdit;
      data.proveedorAsignadoName = proveedor?.nombre || '';
      data.tecnicoAsignadoId = null;
      data.tecnicoAsignadoName = null;
    } else if (tipoAsignacionEdit === null) {
      // Limpiar asignación
      data.tipoAsignacion = null;
      data.tecnicoAsignadoId = null;
      data.tecnicoAsignadoName = null;
      data.proveedorAsignadoId = null;
      data.proveedorAsignadoName = null;
    }

    updateAsignacionMutation.mutate({ id: selectedMantencion.id, data });
  };

  const startEditingAsignacion = () => {
    if (!selectedMantencion) return;
    
    // Cargar datos actuales
    if (selectedMantencion.fechaProgramada) {
      setTipoEjecucionEdit('programada');
      setFechaProgramadaEdit(new Date(selectedMantencion.fechaProgramada));
    } else {
      setTipoEjecucionEdit('inmediata');
      setFechaProgramadaEdit(undefined);
    }

    if (selectedMantencion.tipoAsignacion === 'tecnico_interno') {
      setTipoAsignacionEdit('tecnico_interno');
      setTecnicoAsignadoIdEdit(selectedMantencion.tecnicoAsignadoId || '');
      setProveedorAsignadoIdEdit('');
    } else if (selectedMantencion.tipoAsignacion === 'proveedor_externo') {
      setTipoAsignacionEdit('proveedor_externo');
      setProveedorAsignadoIdEdit(selectedMantencion.proveedorAsignadoId || '');
      setTecnicoAsignadoIdEdit('');
    } else {
      setTipoAsignacionEdit(null);
      setTecnicoAsignadoIdEdit('');
      setProveedorAsignadoIdEdit('');
    }

    setIsEditingAsignacion(true);
  };

  const cancelEditingAsignacion = () => {
    setIsEditingAsignacion(false);
    setTipoEjecucionEdit(null);
    setFechaProgramadaEdit(undefined);
    setTipoAsignacionEdit(null);
    setTecnicoAsignadoIdEdit('');
    setProveedorAsignadoIdEdit('');
  };

  const getEstadoBadge = (estado: string) => {
    const estadoConfig = ESTADO_OPTIONS.find(e => e.value === estado);
    if (!estadoConfig) return null;
    
    const Icon = estadoConfig.icon;
    return (
      <Badge className={estadoConfig.color}>
        <Icon className="h-3 w-3 mr-1" />
        {estadoConfig.label}
      </Badge>
    );
  };

  const getGravedadBadge = (gravedad: string) => {
    const gravedadConfig = GRAVEDAD_OPTIONS.find(p => p.value === gravedad);
    return (
      <Badge className={gravedadConfig?.color || ''}>
        {gravedadConfig?.label || gravedad}
      </Badge>
    );
  };

  // Obtener listas únicas de técnicos y proveedores
  const tecnicosUnicos = useMemo(() => {
    const tecnicos = mantenciones
      .filter(m => m.tecnicoAsignadoName)
      .map(m => ({ id: m.tecnicoAsignadoId, name: m.tecnicoAsignadoName }))
      .filter((t, index, self) => t.id && self.findIndex(x => x.id === t.id) === index);
    return tecnicos;
  }, [mantenciones]);

  const proveedoresUnicos = useMemo(() => {
    const proveedores = mantenciones
      .filter(m => m.proveedorAsignadoName)
      .map(m => ({ id: m.proveedorAsignadoId, name: m.proveedorAsignadoName }))
      .filter((p, index, self) => p.id && self.findIndex(x => x.id === p.id) === index);
    return proveedores;
  }, [mantenciones]);

  // Función de filtrado avanzado
  const aplicarFiltrosAvanzados = (mantenciones: MantencionWithDetails[]) => {
    let filtered = [...mantenciones];

    // Filtro por tipo de ejecución
    if (filtroTipoEjecucion === "programada") {
      filtered = filtered.filter(m => m.fechaProgramada);
    } else if (filtroTipoEjecucion === "inmediata") {
      filtered = filtered.filter(m => !m.fechaProgramada);
    }

    // Filtro por técnico
    if (filtroTecnico !== "todos") {
      filtered = filtered.filter(m => m.tecnicoAsignadoId === filtroTecnico);
    }

    // Filtro por proveedor
    if (filtroProveedor !== "todos") {
      filtered = filtered.filter(m => m.proveedorAsignadoId === filtroProveedor);
    }

    return filtered;
  };

  const filterByEstado = (estado?: string) => {
    const withFiltrosAvanzados = aplicarFiltrosAvanzados(mantenciones);
    if (!estado) return withFiltrosAvanzados;
    return withFiltrosAvanzados.filter(m => m.estado === estado);
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroTipoEjecucion("todos");
    setFiltroTecnico("todos");
    setFiltroProveedor("todos");
  };

  const renderMantencionesCards = (filteredMantenciones: MantencionWithDetails[]) => {
    if (filteredMantenciones.length === 0) {
      return (
        <div className="text-center py-12">
          <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay solicitudes de mantención</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredMantenciones.map((mantencion) => {
          const estadoInfo = ESTADO_OPTIONS.find(e => e.value === mantencion.estado);
          const gravedadInfo = GRAVEDAD_OPTIONS.find(g => g.value === mantencion.gravedad);
          const Icon = estadoInfo?.icon || Clock;
          
          return (
            <Card key={mantencion.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold" data-testid={`text-mantencion-equipo-${mantencion.id}`}>
                        {mantencion.equipoNombre}
                      </h3>
                      <Badge className={gravedadInfo?.color} data-testid={`badge-gravedad-${mantencion.id}`}>
                        {gravedadInfo?.label}
                      </Badge>
                      <Badge className={estadoInfo?.color} data-testid={`badge-estado-${mantencion.id}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {estadoInfo?.label}
                      </Badge>
                      
                      {/* Badge tipo de ejecución */}
                      {mantencion.fechaProgramada ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200" data-testid={`badge-tipo-ejecucion-${mantencion.id}`}>
                          <Calendar className="h-3 w-3 mr-1" />
                          Programada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200" data-testid={`badge-tipo-ejecucion-${mantencion.id}`}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Inmediata
                        </Badge>
                      )}
                      
                      {/* Badge OT autogenerada */}
                      {mantencion.numeroOT && mantencion.numeroOT.includes('AUTO') && (
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200" data-testid={`badge-auto-${mantencion.id}`}>
                          <Wrench className="h-3 w-3 mr-1" />
                          Automática
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {mantencion.descripcionProblema}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(mantencion.createdAt || ''), "dd MMM yyyy", { locale: es })}
                      </span>
                      <span>Área: {AREA_OPTIONS.find(a => a.value === mantencion.area)?.label || mantencion.area}</span>
                      {mantencion.ubicacion && (
                        <span>Ubicación: {mantencion.ubicacion}</span>
                      )}
                      {mantencion.equipoCodigo && (
                        <span>Código: {mantencion.equipoCodigo}</span>
                      )}
                      
                      {/* Mostrar asignación */}
                      {mantencion.tecnicoAsignadoName && (
                        <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                          <Wrench className="h-3 w-3" />
                          Técnico: {mantencion.tecnicoAsignadoName}
                        </span>
                      )}
                      {mantencion.proveedorAsignadoName && (
                        <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                          <Wrench className="h-3 w-3" />
                          Proveedor: {mantencion.proveedorAsignadoName}
                        </span>
                      )}
                    </div>
                    
                    {/* Mostrar motivo de pausa si está pausada */}
                    {mantencion.estado === 'pausada' && mantencion.motivoPausa && (
                      <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-800 dark:text-yellow-400">Pausada</p>
                          <p className="text-yellow-700 dark:text-yellow-300">{mantencion.motivoPausa}</p>
                          {mantencion.fechaPausa && (
                            <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                              Desde: {format(new Date(mantencion.fechaPausa), "dd MMM yyyy HH:mm", { locale: es })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedMantencion(mantencion);
                        setIsDetailsDialogOpen(true);
                      }}
                      data-testid={`button-view-mantencion-${mantencion.id}`}
                      className="w-full sm:w-auto"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver Detalle
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-actions-${mantencion.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {canSubmitResolution && mantencion.estado !== 'resuelto' && mantencion.estado !== 'cerrado' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedMantencion(mantencion);
                              setIsResolutionDialogOpen(true);
                            }}
                            data-testid={`menu-resolver-${mantencion.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Enviar Resolución
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Gestión de Mantención
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistema de solicitudes de mantención de equipos
          </p>
        </div>
        <Sheet open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (open) {
            resetFormulario();
          }
        }}>
          <SheetTrigger asChild>
            <Button data-testid="button-nueva-solicitud">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Nueva Orden de Trabajo (OT)</SheetTitle>
              <SheetDescription>
                Registre el equipo y problema. La asignación y programación se configuran después por el equipo de producción.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleCreateSubmit} className="mt-6">
                <div className="space-y-6">
                  {/* Selección de Equipo */}
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                    <h3 className="font-semibold text-sm">1. Selección de Equipo</h3>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="esManual"
                        checked={esManual}
                        onChange={(e) => {
                          setEsManual(e.target.checked);
                          if (e.target.checked) {
                            setSelectedEquipoId("");
                          }
                        }}
                        className="rounded"
                      />
                      <Label htmlFor="esManual" className="text-sm font-normal cursor-pointer">
                        Entrada manual (equipo no catalogado)
                      </Label>
                    </div>

                    {!esManual ? (
                      <div className="space-y-2">
                        <Label>Equipo del Catálogo *</Label>
                        <Popover open={openEquiposCombo} onOpenChange={setOpenEquiposCombo}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openEquiposCombo}
                              className="w-full justify-between"
                              data-testid="button-select-equipo"
                            >
                              {selectedEquipo ? selectedEquipo.nombre : "Seleccionar equipo..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar equipo..." />
                              <CommandEmpty>No se encontró el equipo.</CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-72">
                                  {equiposJerarquicos.map(({ equipo, nivel }) => (
                                    <CommandItem
                                      key={equipo.id}
                                      value={`${equipo.nombre} ${equipo.codigo || ''}`}
                                      onSelect={() => {
                                        setSelectedEquipoId(equipo.id);
                                        setArea(equipo.area);
                                        setOpenEquiposCombo(false);
                                      }}
                                      data-testid={`option-equipo-${equipo.id}`}
                                      className={cn(nivel > 0 && "pl-6")}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedEquipoId === equipo.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {nivel > 0 && (
                                        <span className="mr-2 text-muted-foreground text-sm">→</span>
                                      )}
                                      <div className="flex flex-col flex-1">
                                        <span className={cn(
                                          nivel === 0 ? "font-medium" : "font-normal text-sm"
                                        )}>{equipo.nombre}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {equipo.codigo} · {AREA_OPTIONS.find(a => a.value === equipo.area)?.label}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </ScrollArea>
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedEquipo && (
                          <div className="text-xs text-muted-foreground space-y-1 pl-2">
                            <p>📍 Área: {AREA_OPTIONS.find(a => a.value === selectedEquipo.area)?.label}</p>
                            <p>🏷️ Código: {selectedEquipo.codigo || 'N/A'}</p>
                            <p>⚠️ Criticidad: <Badge variant="outline" className="text-xs">{selectedEquipo.criticidad}</Badge></p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="equipoNombre">Nombre del Equipo *</Label>
                          <Input
                            id="equipoNombre"
                            name="equipoNombre"
                            required={esManual}
                            placeholder="Ej: Mezcladora #3"
                            data-testid="input-nombre-equipo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="equipoCodigo">Código del Equipo</Label>
                          <Input
                            id="equipoCodigo"
                            name="equipoCodigo"
                            placeholder="Ej: MEZ-003"
                            data-testid="input-codigo-equipo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="area">Área *</Label>
                          <Select value={area} onValueChange={setArea} required>
                            <SelectTrigger data-testid="select-area">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AREA_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <input type="hidden" name="area" value={area} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ubicacion">Ubicación</Label>
                          <Input
                            id="ubicacion"
                            name="ubicacion"
                            placeholder="Ej: Sector A"
                            data-testid="input-ubicacion"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detalles de la Solicitud */}
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                    <h3 className="font-semibold text-sm">2. Detalles de la Solicitud</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gravedad">Gravedad *</Label>
                        <Select value={gravedad} onValueChange={setGravedad} required>
                          <SelectTrigger data-testid="select-gravedad">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRAVEDAD_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <input type="hidden" name="gravedad" value={gravedad} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tipoMantencion">Tipo de Mantención *</Label>
                        <Select value={tipoMantencion} onValueChange={setTipoMantencion} required>
                          <SelectTrigger data-testid="select-tipo-mantencion">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPO_MANTENCION_OPTIONS.map(tipo => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                {tipo.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <input type="hidden" name="tipoMantencion" value={tipoMantencion} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descripcionProblema">Descripción del Problema *</Label>
                      <Textarea
                        id="descripcionProblema"
                        name="descripcionProblema"
                        required
                        rows={4}
                        placeholder="Describa detalladamente el problema o falla del equipo..."
                        data-testid="textarea-descripcion"
                      />
                    </div>
                  </div>

                  {/* Fotos */}
                  <div className="space-y-2">
                    <Label htmlFor="photos">Fotos del Problema</Label>
                    <Input
                      id="photos"
                      name="photos"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      data-testid="input-photos"
                    />
                    <p className="text-xs text-muted-foreground">
                      Puede adjuntar múltiples fotos del equipo o problema
                    </p>
                  </div>
                </div>
              
              <div className="flex gap-3 mt-6 pt-6 border-t sticky bottom-0 bg-background">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancelar-crear"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || (!esManual && !selectedEquipoId)}
                  data-testid="button-submit-crear"
                  className="flex-1"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Orden de Trabajo
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de Mantención</CardTitle>
          <CardDescription>
            Gestione las solicitudes de mantención de equipos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros Avanzados */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Filtros Avanzados
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                data-testid="button-limpiar-filtros"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Filtro por tipo de ejecución */}
              <div className="space-y-2">
                <Label htmlFor="filtro-tipo-ejecucion" className="text-xs">Tipo de Ejecución</Label>
                <Select value={filtroTipoEjecucion} onValueChange={setFiltroTipoEjecucion}>
                  <SelectTrigger id="filtro-tipo-ejecucion" data-testid="select-tipo-ejecucion">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="inmediata">Inmediata</SelectItem>
                    <SelectItem value="programada">Programada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por técnico */}
              <div className="space-y-2">
                <Label htmlFor="filtro-tecnico" className="text-xs">Técnico Asignado</Label>
                <Select value={filtroTecnico} onValueChange={setFiltroTecnico}>
                  <SelectTrigger id="filtro-tecnico" data-testid="select-tecnico">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {tecnicosUnicos.map((tecnico) => (
                      <SelectItem key={tecnico.id} value={tecnico.id!}>
                        {tecnico.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por proveedor */}
              <div className="space-y-2">
                <Label htmlFor="filtro-proveedor" className="text-xs">Proveedor Externo</Label>
                <Select value={filtroProveedor} onValueChange={setFiltroProveedor}>
                  <SelectTrigger id="filtro-proveedor" data-testid="select-proveedor">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {proveedoresUnicos.map((proveedor) => (
                      <SelectItem key={proveedor.id} value={proveedor.id!}>
                        {proveedor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Indicador de filtros activos */}
            {(filtroTipoEjecucion !== "todos" || filtroTecnico !== "todos" || filtroProveedor !== "todos") && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                Filtros activos: 
                {filtroTipoEjecucion !== "todos" && <Badge variant="outline" className="ml-1">Tipo: {filtroTipoEjecucion}</Badge>}
                {filtroTecnico !== "todos" && <Badge variant="outline" className="ml-1">Técnico</Badge>}
                {filtroProveedor !== "todos" && <Badge variant="outline" className="ml-1">Proveedor</Badge>}
              </div>
            )}
          </div>

          <Tabs defaultValue="todos" className="space-y-4">
            <TabsList>
              <TabsTrigger value="todos" data-testid="tab-todos">
                Todos ({filterByEstado().length})
              </TabsTrigger>
              <TabsTrigger value="registrado" data-testid="tab-registrado">
                <Clock className="h-4 w-4 mr-2" />
                Registrado ({filterByEstado('registrado').length})
              </TabsTrigger>
              <TabsTrigger value="en_reparacion" data-testid="tab-en-reparacion">
                <Wrench className="h-4 w-4 mr-2" />
                En Reparación ({filterByEstado('en_reparacion').length})
              </TabsTrigger>
              <TabsTrigger value="resuelto" data-testid="tab-resuelto">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Resuelto ({filterByEstado('resuelto').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="todos">
              {renderMantencionesCards(filterByEstado())}
            </TabsContent>
            <TabsContent value="registrado">
              {renderMantencionesCards(filterByEstado('registrado'))}
            </TabsContent>
            <TabsContent value="en_reparacion">
              {renderMantencionesCards(filterByEstado('en_reparacion'))}
            </TabsContent>
            <TabsContent value="resuelto">
              {renderMantencionesCards(filterByEstado('resuelto'))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Details Dialog with Tabs */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Detalle de Orden de Trabajo
            </DialogTitle>
            <DialogDescription>
              OT #{selectedMantencion?.id} - {selectedMantencion?.equipoNombre}
            </DialogDescription>
          </DialogHeader>
          {selectedMantencion && (
            <>
            <Tabs defaultValue="info" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="gastos">Gastos</TabsTrigger>
                <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>

              {/* Tab 1: Información General */}
              <TabsContent value="info">
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-6">
              {/* Header info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-muted-foreground">Equipo</Label>
                  {(() => {
                    // Find equipment by ID if available, fallback to name for legacy records
                    const equipoOT = selectedMantencion.equipoId
                      ? equiposCriticos.find(e => e.id === selectedMantencion.equipoId)
                      : equiposCriticos.find(e => e.nombre === selectedMantencion.equipoNombre);
                    
                    const equipoPadre = equipoOT?.equipoPadreId 
                      ? equiposCriticos.find(e => e.id === equipoOT.equipoPadreId)
                      : null;
                    
                    return (
                      <div className="space-y-1 mt-1">
                        {equipoPadre && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Equipo Principal:</span>
                            <span className="font-medium text-foreground">{equipoPadre.nombre}</span>
                            {equipoPadre.codigo && (
                              <span className="text-xs">({equipoPadre.codigo})</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {equipoPadre && (
                            <span className="text-muted-foreground">→</span>
                          )}
                          <p className="font-semibold">
                            {equipoOT?.nombre || selectedMantencion.equipoNombre}
                          </p>
                          {(equipoOT?.codigo || selectedMantencion.equipoCodigo) && (
                            <span className="text-sm text-muted-foreground">
                              ({equipoOT?.codigo || selectedMantencion.equipoCodigo})
                            </span>
                          )}
                          {!selectedMantencion.equipoId && (
                            <Badge variant="outline" className="text-xs">
                              Legacy
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha Registro</Label>
                  <p>{selectedMantencion.createdAt && format(new Date(selectedMantencion.createdAt), "dd MMMM yyyy HH:mm", { locale: es })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <div className="mt-1">{getEstadoBadge(selectedMantencion.estado)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Gravedad</Label>
                  <div className="mt-1">{getGravedadBadge(selectedMantencion.gravedad)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tipo de Mantención</Label>
                  <div className="mt-1">
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                      {selectedMantencion.tipoMantencion}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Área</Label>
                  <div className="mt-1">
                    <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                      {AREA_OPTIONS.find(a => a.value === selectedMantencion.area)?.label || selectedMantencion.area}
                    </Badge>
                  </div>
                </div>
                {selectedMantencion.ubicacion && (
                  <div>
                    <Label className="text-muted-foreground">Ubicación</Label>
                    <p className="font-medium">{selectedMantencion.ubicacion}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <Label className="text-muted-foreground">Descripción</Label>
                <p className="mt-1">{selectedMantencion.descripcionProblema}</p>
              </div>

              {/* Asignación y Programación (solo admin/supervisor/produccion) */}
              {canManageMantencion && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Asignación y Programación</h3>
                    {!isEditingAsignacion && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startEditingAsignacion}
                        data-testid="button-edit-asignacion"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                    )}
                  </div>

                  {!isEditingAsignacion ? (
                    // Vista de solo lectura
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm text-muted-foreground">Tipo de Ejecución</Label>
                        <p className="mt-1">
                          {selectedMantencion.fechaProgramada ? (
                            <>
                              📅 Programada para {format(new Date(selectedMantencion.fechaProgramada), "dd/MM/yyyy", { locale: es })}
                            </>
                          ) : (
                            '🔴 Inmediata (sin programar)'
                          )}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Asignado a</Label>
                        <p className="mt-1">
                          {selectedMantencion.tipoAsignacion === 'tecnico_interno' && selectedMantencion.tecnicoAsignadoName ? (
                            `👷 ${selectedMantencion.tecnicoAsignadoName} (Técnico Interno)`
                          ) : selectedMantencion.tipoAsignacion === 'proveedor_externo' && selectedMantencion.proveedorAsignadoName ? (
                            `🏢 ${selectedMantencion.proveedorAsignadoName} (Proveedor Externo)`
                          ) : (
                            'Sin asignar'
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Formulario de edición
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Tipo de Ejecución</Label>
                        <RadioGroup 
                          value={tipoEjecucionEdit || 'inmediata'} 
                          onValueChange={(v) => setTipoEjecucionEdit(v as "inmediata" | "programada")}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="inmediata" id="edit-tipo-inmediata" />
                            <Label htmlFor="edit-tipo-inmediata" className="font-normal cursor-pointer">
                              🔴 Inmediata
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="programada" id="edit-tipo-programada" />
                            <Label htmlFor="edit-tipo-programada" className="font-normal cursor-pointer">
                              📅 Programada
                            </Label>
                          </div>
                        </RadioGroup>

                        {tipoEjecucionEdit === 'programada' && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal mt-2",
                                  !fechaProgramadaEdit && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {fechaProgramadaEdit ? format(fechaProgramadaEdit, "PPP", { locale: es }) : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={fechaProgramadaEdit}
                                onSelect={setFechaProgramadaEdit}
                                initialFocus
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Asignación</Label>
                        <RadioGroup 
                          value={tipoAsignacionEdit || 'ninguno'} 
                          onValueChange={(v) => setTipoAsignacionEdit(v === 'ninguno' ? null : v as "tecnico_interno" | "proveedor_externo")}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="ninguno" id="edit-asign-ninguno" />
                            <Label htmlFor="edit-asign-ninguno" className="font-normal cursor-pointer">
                              Sin asignación
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="tecnico_interno" id="edit-asign-tecnico" />
                            <Label htmlFor="edit-asign-tecnico" className="font-normal cursor-pointer">
                              👷 Técnico Interno
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="proveedor_externo" id="edit-asign-proveedor" />
                            <Label htmlFor="edit-asign-proveedor" className="font-normal cursor-pointer">
                              🏢 Proveedor Externo
                            </Label>
                          </div>
                        </RadioGroup>

                        {tipoAsignacionEdit === 'tecnico_interno' && (
                          <Select value={tecnicoAsignadoIdEdit} onValueChange={setTecnicoAsignadoIdEdit}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Seleccionar técnico..." />
                            </SelectTrigger>
                            <SelectContent>
                              {tecnicos.map(tecnico => (
                                <SelectItem key={tecnico.id} value={tecnico.id}>
                                  {tecnico.name || tecnico.username}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {tipoAsignacionEdit === 'proveedor_externo' && (
                          <Select value={proveedorAsignadoIdEdit} onValueChange={setProveedorAsignadoIdEdit}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Seleccionar proveedor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {proveedores.map(proveedor => (
                                <SelectItem key={proveedor.id} value={proveedor.id}>
                                  {proveedor.nombre} - {proveedor.especialidad}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEditingAsignacion}
                          disabled={updateAsignacionMutation.isPending}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAsignacionSubmit}
                          disabled={updateAsignacionMutation.isPending}
                          data-testid="button-save-asignacion"
                        >
                          {updateAsignacionMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Photos */}
              {selectedMantencion.photos && selectedMantencion.photos.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Fotos</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {selectedMantencion.photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.photoUrl}
                          alt={photo.description || 'Foto del problema'}
                          className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setSelectedImage({ url: photo.photoUrl, description: photo.description || undefined });
                            setShowImageModal(true);
                          }}
                          data-testid={`img-mantencion-${photo.id}`}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-b">
                          <Eye className="h-3 w-3 inline mr-1" />
                          Ver imagen
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution section if resolved */}
              {selectedMantencion.resolucionDescripcion && (
                <div className="space-y-4">
                  <div className="border-t pt-4">
                    <Label className="text-muted-foreground">Descripción de la Resolución</Label>
                    <p className="mt-1 whitespace-pre-wrap">{selectedMantencion.resolucionDescripcion}</p>
                    {selectedMantencion.fechaResolucion && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Resuelto el {format(new Date(selectedMantencion.fechaResolucion), 'dd/MM/yyyy HH:mm', { locale: es })}
                        {selectedMantencion.resolucionUsuarioName && ` por ${selectedMantencion.resolucionUsuarioName}`}
                      </p>
                    )}
                  </div>

                  {selectedMantencion.resolucionPhotos && selectedMantencion.resolucionPhotos.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Fotos de la Resolución</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {selectedMantencion.resolucionPhotos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.photoUrl}
                              alt={photo.description || 'Foto de resolución'}
                              className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setSelectedImage({ url: photo.photoUrl, description: photo.description || undefined });
                                setShowImageModal(true);
                              }}
                              data-testid={`img-resolucion-${photo.id}`}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-b">
                              <Eye className="h-3 w-3 inline mr-1" />
                              Ver imagen
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Historial */}
              {selectedMantencion.historial && selectedMantencion.historial.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Historial de Cambios</Label>
                  <div className="mt-2 space-y-2">
                    {selectedMantencion.historial.map((entry) => (
                      <Card key={entry.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {entry.estadoAnterior && (
                                  <>
                                    <Badge variant="outline" className="text-xs">
                                      {ESTADO_OPTIONS.find(e => e.value === entry.estadoAnterior)?.label || entry.estadoAnterior}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">→</span>
                                  </>
                                )}
                                <Badge className={(ESTADO_OPTIONS.find(e => e.value === entry.estadoNuevo)?.color || '') + " text-xs"}>
                                  {ESTADO_OPTIONS.find(e => e.value === entry.estadoNuevo)?.label || entry.estadoNuevo}
                                </Badge>
                              </div>
                              {entry.notas && (
                                <p className="text-sm text-muted-foreground mt-1">{entry.notas}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {entry.userName} - {format(new Date(entry.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {canSubmitResolution && selectedMantencion.estado !== 'resuelto' && selectedMantencion.estado !== 'cerrado' && (
                <div className="border-t pt-4">
                  <Button
                    onClick={() => {
                      setIsResolutionDialogOpen(true);
                      setIsDetailsDialogOpen(false);
                    }}
                    data-testid="button-enviar-resolucion"
                    className="w-full"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Enviar Resolución
                  </Button>
                </div>
              )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 2: Gastos de Materiales */}
              <TabsContent value="gastos">
                <GastosTab
                  mantencionId={selectedMantencion.id}
                  canManageGastos={canManageMantencion}
                />
              </TabsContent>

              {/* Tab 3: Seguimiento */}
              <TabsContent value="seguimiento">
                <SeguimientoTab
                  mantencion={selectedMantencion}
                  canManageMantencion={canManageMantencion}
                  onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/mantenciones'] });
                  }}
                />
              </TabsContent>

              {/* Tab 4: Historial */}
              <TabsContent value="historial">
                <HistorialTab mantencion={selectedMantencion} />
              </TabsContent>
            </Tabs>

            {/* Botón de eliminar - solo para admin y produccion */}
            {(user?.role === 'admin' || user?.role === 'produccion') && (
              <DialogFooter className="mt-4 border-t pt-4">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm('¿Está seguro que desea eliminar esta orden de trabajo? Esta acción no se puede deshacer.')) {
                      deleteMutation.mutate(selectedMantencion.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-mantencion"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Eliminar Orden de Trabajo
                </Button>
              </DialogFooter>
            )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={isResolutionDialogOpen} onOpenChange={setIsResolutionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar Resolución de Mantención</DialogTitle>
            <DialogDescription>
              Complete el diagnóstico y las acciones realizadas
            </DialogDescription>
          </DialogHeader>
          {selectedMantencion && (
            <form onSubmit={handleResolutionSubmit}>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 pr-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-medium">{selectedMantencion.equipoNombre}</p>
                    <p className="text-sm text-muted-foreground">{selectedMantencion.descripcionProblema}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolucionDescripcion">Descripción de la Resolución *</Label>
                    <Textarea
                      id="resolucionDescripcion"
                      name="resolucionDescripcion"
                      required
                      rows={6}
                      placeholder="Describa el diagnóstico del problema y las acciones realizadas para resolverlo..."
                      data-testid="textarea-resolucion"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolutionPhotos">Fotos de la Resolución</Label>
                    <Input
                      id="resolutionPhotos"
                      ref={resolutionFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      data-testid="input-resolution-photos"
                    />
                    <p className="text-xs text-muted-foreground">
                      Adjunte fotos del equipo reparado o evidencia de las acciones realizadas
                    </p>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResolutionDialogOpen(false)}
                  data-testid="button-cancelar-resolucion"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitResolutionMutation.isPending}
                  data-testid="button-submit-resolucion"
                >
                  {submitResolutionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar Resolución
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{selectedImage?.description || 'Vista de imagen'}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4">
            {selectedImage && (
              <img
                src={selectedImage.url}
                alt={selectedImage.description || 'Imagen ampliada'}
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
