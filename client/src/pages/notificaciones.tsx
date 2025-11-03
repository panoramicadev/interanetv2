import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, Archive, Plus, Check, Eye, AlertTriangle, Package, TrendingUp, MessageSquare, Wrench, Target, ShoppingCart, Users, MoreVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Notification {
  id: string;
  targetType: string;
  department?: string;
  title: string;
  message: string;
  priority: string;
  type: string;
  createdAt: string;
  createdByName?: string;
  hasRead?: boolean;
  actionUrl?: string;
}

interface NotificationRead {
  userId: string;
  userName: string;
  readAt: Date;
}

export default function NotificacionesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('activas');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showReadsDialog, setShowReadsDialog] = useState(false);
  // Inicializar filtros contraídos en móvil, abiertos en desktop
  const [filtersOpen, setFiltersOpen] = useState(() => {
    return window.matchMedia('(min-width: 640px)').matches;
  });

  // Asegurar que los filtros estén siempre abiertos en desktop
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)'); // sm breakpoint
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        // Desktop: siempre abierto
        setFiltersOpen(true);
      }
    };
    
    // Verificar al montar
    handleChange(mediaQuery);
    
    // Escuchar cambios
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Authorized roles - must match server-side constants
  const NOTIFICATION_CREATOR_ROLES = ['admin', 'supervisor', 'logistica_bodega', 'logistica', 'laboratorio', 'area_produccion', 'area_logistica', 'area_aplicacion', 'produccion', 'planificacion'];
  const NOTIFICATION_ARCHIVER_ROLES = ['admin', 'supervisor'];
  
  // Check if user can create notifications
  const canCreateNotifications = user && user.role && NOTIFICATION_CREATOR_ROLES.includes(user.role);
  
  // Check if user can archive notifications
  const canArchiveNotifications = user && user.role && NOTIFICATION_ARCHIVER_ROLES.includes(user.role);

  // Form state for creating new notification
  const [form, setForm] = useState({
    targetType: 'general',
    department: '',
    title: '',
    message: '',
    priority: 'media',
    type: 'manual',
  });

  const isArchived = activeTab === 'archivadas';

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', { 
      isArchived: isArchived ? 'true' : 'false',
      type: typeFilter !== 'all' ? typeFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      department: departmentFilter !== 'all' ? departmentFilter : undefined,
    }],
  });

  // Fetch reads for selected notification
  const { data: reads = [] } = useQuery<NotificationRead[]>({
    queryKey: ['/api/notifications', selectedNotification?.id, 'reads'],
    enabled: !!selectedNotification && showReadsDialog,
  });

  // Create notification mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/notifications', {
        method: 'POST',
        data: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: 'Notificación creada exitosamente' });
      setForm({
        targetType: 'general',
        department: '',
        title: '',
        message: '',
        priority: 'media',
        type: 'manual',
      });
      setActiveTab('activas');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudo crear la notificación',
        variant: 'destructive'
      });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest(`/api/notifications/${notificationId}/archive`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: 'Notificación archivada' });
    },
  });

  const handleCreateNotification = () => {
    if (!form.title || !form.message) {
      toast({ 
        title: 'Error', 
        description: 'Título y mensaje son requeridos',
        variant: 'destructive'
      });
      return;
    }

    if (form.targetType === 'departamento' && !form.department) {
      toast({ 
        title: 'Error', 
        description: 'Debe especificar un departamento',
        variant: 'destructive'
      });
      return;
    }

    createMutation.mutate(form);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critica': return 'bg-red-500';
      case 'alta': return 'bg-orange-500';
      case 'media': return 'bg-yellow-500';
      case 'baja': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critica': return 'Crítica';
      case 'alta': return 'Alta';
      case 'media': return 'Media';
      case 'baja': return 'Baja';
      default: return priority;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reclamo':
      case 'reclamo_status':
      case 'reclamo_resuelto':
        return <AlertTriangle className="w-5 h-5" />;
      case 'stock_alert':
      case 'stock_bajo':
      case 'stock_critico':
      case 'producto_agotado':
        return <Package className="w-5 h-5" />;
      case 'venta':
        return <TrendingUp className="w-5 h-5" />;
      case 'crm_lead':
      case 'crm_stage_change':
        return <Users className="w-5 h-5" />;
      case 'maintenance':
      case 'mantencion_resuelta':
        return <Wrench className="w-5 h-5" />;
      case 'sales_goal':
        return <Target className="w-5 h-5" />;
      case 'ecommerce':
        return <ShoppingCart className="w-5 h-5" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  const getPriorityBorderColor = (priority: string) => {
    switch (priority) {
      case 'critica': return 'border-l-red-500';
      case 'alta': return 'border-l-orange-500';
      case 'media': return 'border-l-yellow-500';
      case 'baja': return 'border-l-blue-500';
      default: return 'border-l-gray-500';
    }
  };

  const departamentos = [
    { value: 'laboratorio', label: 'Laboratorio' },
    { value: 'logistica', label: 'Logística' },
    { value: 'finanzas', label: 'Finanzas' },
    { value: 'ventas', label: 'Ventas' },
    { value: 'produccion', label: 'Producción' },
    { value: 'planificacion', label: 'Planificación' },
    { value: 'bodega_materias_primas', label: 'Bodega Materias Primas' },
    { value: 'area_produccion', label: 'Área Producción' },
    { value: 'area_logistica', label: 'Área Logística' },
    { value: 'area_aplicacion', label: 'Área Aplicación' },
    { value: 'reception', label: 'Recepción' },
  ];

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Notificaciones</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gestiona las comunicaciones internas del equipo</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${canCreateNotifications ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="activas" className="flex items-center gap-2" data-testid="tab-activas">
            <Bell className="w-4 h-4" />
            Activas
          </TabsTrigger>
          <TabsTrigger value="archivadas" className="flex items-center gap-2" data-testid="tab-archivadas">
            <Archive className="w-4 h-4" />
            Archivadas
          </TabsTrigger>
          {canCreateNotifications && (
            <TabsTrigger value="crear" className="flex items-center gap-2" data-testid="tab-crear">
              <Plus className="w-4 h-4" />
              Crear Nueva
            </TabsTrigger>
          )}
        </TabsList>

        {/* Activas Tab */}
        <TabsContent value="activas" className="space-y-3 sm:space-y-4">
          {/* Filtros - Colapsables solo en móvil */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
                  {/* Trigger solo visible en móvil */}
                  <CollapsibleTrigger asChild className="sm:hidden">
                    <button 
                      className="flex items-center justify-center p-1"
                      aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                      data-testid="toggle-filters"
                    >
                      {filtersOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-0">
                  <div>
                    <Label className="text-sm">Tipo</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger data-testid="filter-type" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="stock_bajo">Stock Bajo</SelectItem>
                        <SelectItem value="stock_critico">Stock Crítico</SelectItem>
                        <SelectItem value="producto_agotado">Producto Agotado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Prioridad</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger data-testid="filter-priority" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="baja">Baja</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Departamento</Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger data-testid="filter-department" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {departamentos.map(dept => (
                          <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Lista de notificaciones */}
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay notificaciones activas</p>
            ) : (
              notifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={`border-l-4 ${getPriorityBorderColor(notification.priority)} transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
                >
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-start gap-2 sm:gap-4">
                      {/* Icono del tipo de notificación */}
                      <div className={`flex-shrink-0 p-2 sm:p-2.5 rounded-lg ${getPriorityColor(notification.priority)} bg-opacity-10`}>
                        <div className={`${notification.priority === 'critica' ? 'text-red-600' : notification.priority === 'alta' ? 'text-orange-600' : notification.priority === 'media' ? 'text-yellow-600' : 'text-blue-600'}`}>
                          <div className="w-4 h-4 sm:w-5 sm:h-5">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                      </div>

                      {/* Contenido principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm sm:text-base">{notification.title}</h3>
                            {!notification.hasRead && (
                              <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5">
                                ● Nuevo
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">{notification.message}</p>
                        
                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            Por: <span className="font-medium">{notification.createdByName || 'Sistema'}</span>
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">
                            hace {formatDistanceToNow(new Date(notification.createdAt), {
                              locale: es,
                            })}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 sm:px-2">
                            {getPriorityLabel(notification.priority)}
                          </Badge>
                        </div>
                      </div>

                      {/* Acciones - Desktop: columna de botones, Móvil: dropdown */}
                      <div className="flex-shrink-0">
                        {/* Desktop: Botones visibles */}
                        <div className="hidden sm:flex flex-col gap-1.5">
                          {!notification.hasRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                              data-testid={`mark-read-${notification.id}`}
                              title="Marcar leída"
                              aria-label="Marcar notificación como leída"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => {
                              setSelectedNotification(notification);
                              setShowReadsDialog(true);
                            }}
                            data-testid={`view-reads-${notification.id}`}
                            title="Ver lecturas"
                            aria-label="Ver quién ha leído esta notificación"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canArchiveNotifications && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => archiveMutation.mutate(notification.id)}
                              data-testid={`archive-${notification.id}`}
                              title="Archivar"
                              aria-label="Archivar notificación"
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {/* Móvil: Dropdown menu */}
                        <div className="sm:hidden">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                data-testid={`actions-menu-${notification.id}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!notification.hasRead && (
                                <DropdownMenuItem 
                                  onClick={() => markAsReadMutation.mutate(notification.id)}
                                  data-testid={`mark-read-${notification.id}`}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Marcar leída
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedNotification(notification);
                                  setShowReadsDialog(true);
                                }}
                                data-testid={`view-reads-${notification.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Ver lecturas
                              </DropdownMenuItem>
                              {canArchiveNotifications && (
                                <DropdownMenuItem 
                                  onClick={() => archiveMutation.mutate(notification.id)}
                                  data-testid={`archive-${notification.id}`}
                                >
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Archivadas Tab */}
        <TabsContent value="archivadas" className="space-y-3 sm:space-y-4">
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay notificaciones archivadas</p>
            ) : (
              notifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={`border-l-4 ${getPriorityBorderColor(notification.priority)} opacity-75 transition-all duration-200 hover:opacity-100 hover:shadow-md`}
                >
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-start gap-2 sm:gap-4">
                      {/* Icono del tipo de notificación */}
                      <div className={`flex-shrink-0 p-2 sm:p-2.5 rounded-lg ${getPriorityColor(notification.priority)} bg-opacity-10`}>
                        <div className={`${notification.priority === 'critica' ? 'text-red-600' : notification.priority === 'alta' ? 'text-orange-600' : notification.priority === 'media' ? 'text-yellow-600' : 'text-blue-600'}`}>
                          <div className="w-4 h-4 sm:w-5 sm:h-5">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                      </div>

                      {/* Contenido principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5 sm:mb-2">
                          <h3 className="font-semibold text-sm sm:text-base">{notification.title}</h3>
                          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0 sm:px-2">
                            Archivada
                          </Badge>
                        </div>
                        
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">{notification.message}</p>
                        
                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            Por: <span className="font-medium">{notification.createdByName || 'Sistema'}</span>
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">
                            hace {formatDistanceToNow(new Date(notification.createdAt), {
                              locale: es,
                            })}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 sm:px-2">
                            {getPriorityLabel(notification.priority)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Crear Nueva Tab - Only for authorized roles */}
        {canCreateNotifications && (
          <TabsContent value="crear">
            <Card>
              <CardHeader>
                <CardTitle>Crear Nueva Notificación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              <div>
                <Label htmlFor="targetType">Destinatario</Label>
                <Select value={form.targetType} onValueChange={(value) => setForm({ ...form, targetType: value })}>
                  <SelectTrigger id="targetType" data-testid="input-targetType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General (Todos)</SelectItem>
                    <SelectItem value="departamento">Departamento Específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.targetType === 'departamento' && (
                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Select value={form.department} onValueChange={(value) => setForm({ ...form, department: value })}>
                    <SelectTrigger id="department" data-testid="input-department">
                      <SelectValue placeholder="Selecciona un departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departamentos.map(dept => (
                        <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título de la notificación"
                  data-testid="input-title"
                />
              </div>

              <div>
                <Label htmlFor="message">Mensaje</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Mensaje detallado"
                  rows={5}
                  data-testid="input-message"
                />
              </div>

              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                  <SelectTrigger id="priority" data-testid="input-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                <Button
                  onClick={handleCreateNotification}
                  disabled={createMutation.isPending}
                  className="w-full"
                  data-testid="button-create-notification"
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Notificación'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog for viewing reads */}
      <Dialog open={showReadsDialog} onOpenChange={setShowReadsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de Lecturas</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {reads.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nadie ha leído esta notificación aún</p>
            ) : (
              reads.map((read, index) => (
                <div key={index} className="flex items-center justify-between p-2 border-b">
                  <span className="font-medium">{read.userName}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(read.readAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
