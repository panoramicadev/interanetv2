import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  MoreVertical
} from "lucide-react";
import type { SolicitudMantencion, MantencionPhoto } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

  const canSubmitResolution = user?.role === 'produccion' || user?.role === 'admin' || user?.role === 'supervisor';

  const { data: mantenciones = [], isLoading } = useQuery<MantencionWithDetails[]>({
    queryKey: ['/api/mantenciones'],
  });

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

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // Photos are already included in FormData via the input name="photos"
    // No need to manually append them again

    createMutation.mutate(formData);
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

  const filterByEstado = (estado?: string) => {
    if (!estado) return mantenciones;
    return mantenciones.filter(m => m.estado === estado);
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
                    </div>
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
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (open) {
            setGravedad('media');
            setTipoMantencion('correctivo');
            setArea('produccion');
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-nueva-solicitud">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nueva Solicitud de Mantención</DialogTitle>
              <DialogDescription>
                Complete los detalles de la solicitud de mantención
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit}>
              <div className="space-y-4">
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-4 pr-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="equipoNombre">Nombre del Equipo *</Label>
                        <Input
                          id="equipoNombre"
                          name="equipoNombre"
                          required
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </ScrollArea>

                <div className="space-y-2 border-t pt-4">
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
              
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancelar-crear"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-crear"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Solicitud
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de Mantención</CardTitle>
          <CardDescription>
            Gestione las solicitudes de mantención de equipos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="todos" className="space-y-4">
            <TabsList>
              <TabsTrigger value="todos" data-testid="tab-todos">
                Todos ({mantenciones.length})
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
              {renderMantencionesCards(mantenciones)}
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

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Detalle de Solicitud de Mantención</DialogTitle>
          </DialogHeader>
          {selectedMantencion && (
            <div className="space-y-6 pt-4">
              {/* Header info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Equipo</Label>
                  <p className="font-semibold">{selectedMantencion.equipoNombre}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha Registro</Label>
                  <p>{selectedMantencion.createdAt && format(new Date(selectedMantencion.createdAt), "dd MMMM yyyy HH:mm", { locale: es })}</p>
                </div>
                {selectedMantencion.equipoCodigo && (
                  <div>
                    <Label className="text-muted-foreground">Código de Equipo</Label>
                    <p className="font-medium">{selectedMantencion.equipoCodigo}</p>
                  </div>
                )}
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
