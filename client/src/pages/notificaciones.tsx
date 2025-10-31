import { useState } from 'react';
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
import { Bell, Archive, Plus, Check, Eye } from 'lucide-react';
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

  // Authorized roles - must match server-side constants
  const NOTIFICATION_CREATOR_ROLES = ['admin', 'supervisor', 'logistica_bodega', 'logistica', 'laboratorio', 'area_produccion', 'area_logistica', 'area_aplicacion', 'produccion', 'planificacion'];
  const NOTIFICATION_ARCHIVER_ROLES = ['admin', 'supervisor'];
  
  // Check if user can create notifications
  const canCreateNotifications = user && NOTIFICATION_CREATOR_ROLES.includes(user.role);
  
  // Check if user can archive notifications
  const canArchiveNotifications = user && NOTIFICATION_ARCHIVER_ROLES.includes(user.role);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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

    if (form.targetType === 'personal' && !form.department) {
      toast({ 
        title: 'Error', 
        description: 'Debe especificar un departamento para notificaciones personales',
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
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">Gestiona las comunicaciones internas del equipo</p>
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
        <TabsContent value="activas" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger data-testid="filter-type">
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
                <Label>Prioridad</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger data-testid="filter-priority">
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
                <Label>Departamento</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger data-testid="filter-department">
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
          </Card>

          {/* Lista de notificaciones */}
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay notificaciones activas</p>
            ) : (
              notifications.map((notification) => (
                <Card key={notification.id} className={!notification.hasRead ? 'border-l-4 border-l-blue-500' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{notification.title}</h3>
                          <div className={`h-2 w-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                          {!notification.hasRead && (
                            <Badge variant="secondary" className="text-xs">Nuevo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Por: {notification.createdByName || 'Sistema'}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{getPriorityLabel(notification.priority)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {!notification.hasRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            data-testid={`mark-read-${notification.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Marcar leída
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedNotification(notification);
                            setShowReadsDialog(true);
                          }}
                          data-testid={`view-reads-${notification.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver lecturas
                        </Button>
                        {canArchiveNotifications && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archiveMutation.mutate(notification.id)}
                            data-testid={`archive-${notification.id}`}
                          >
                            <Archive className="w-4 h-4 mr-1" />
                            Archivar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Archivadas Tab */}
        <TabsContent value="archivadas" className="space-y-4">
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay notificaciones archivadas</p>
            ) : (
              notifications.map((notification) => (
                <Card key={notification.id}>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{notification.title}</h3>
                        <div className={`h-2 w-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Por: {notification.createdByName || 'Sistema'}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
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
