import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Bell, Save, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmailNotificationSetting {
  id: string;
  notificationType: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  recipients: string | null;
  ccRecipients: string | null;
}

const DEFAULT_NOTIFICATION_TYPES = [
  { type: 'pedido_nuevo', displayName: 'Pedido Nuevo', description: 'Notificar cuando se crea un nuevo pedido de cliente' },
  { type: 'reclamo_nuevo', displayName: 'Reclamo Nuevo', description: 'Notificar cuando se registra un nuevo reclamo' },
  { type: 'cotizacion_convertida', displayName: 'Cotización Convertida', description: 'Notificar cuando una cotización se convierte en pedido' },
  { type: 'stock_bajo', displayName: 'Stock Bajo', description: 'Alertar cuando el inventario está bajo el mínimo' },
  { type: 'tarea_asignada', displayName: 'Tarea Asignada', description: 'Notificar cuando se asigna una tarea a un usuario' },
  { type: 'alerta_inactividad', displayName: 'Alerta de Inactividad', description: 'Notificar sobre clientes sin compras recientes' },
  { type: 'visita_tecnica', displayName: 'Visita Técnica Programada', description: 'Notificar sobre nuevas visitas técnicas' },
  { type: 'mantencion_preventiva', displayName: 'Mantención Preventiva', description: 'Alertar sobre mantenciones programadas' },
];

export default function NotificacionesConfigPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ recipients: string; ccRecipients: string }>({ recipients: '', ccRecipients: '' });

  const { data: settings = [], isLoading } = useQuery<EmailNotificationSetting[]>({
    queryKey: ['/api/admin/email-notification-settings'],
  });

  const { data: smtpStatus } = useQuery<{ configured: boolean; host: string }>({
    queryKey: ['/api/admin/smtp-status'],
  });

  const initializeSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/email-notification-settings/initialize', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-notification-settings'] });
      toast({ title: "Configuraciones inicializadas", description: "Se crearon las configuraciones por defecto" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmailNotificationSetting> }) => {
      return apiRequest(`/api/admin/email-notification-settings/${id}`, {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-notification-settings'] });
      toast({ title: "Configuración actualizada" });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest(`/api/admin/email-notification-settings/${id}`, {
        method: 'PATCH',
        data: { enabled },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-notification-settings'] });
    },
  });

  const handleEdit = (setting: EmailNotificationSetting) => {
    setEditingId(setting.id);
    setEditValues({
      recipients: setting.recipients || '',
      ccRecipients: setting.ccRecipients || '',
    });
  };

  const handleSave = (id: string) => {
    updateSettingMutation.mutate({
      id,
      data: {
        recipients: editValues.recipients,
        ccRecipients: editValues.ccRecipients,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Configuración de Notificaciones por Email
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configura los destinatarios para cada tipo de notificación por correo electrónico
        </p>
      </div>

      {/* SMTP Status */}
      <Alert className={smtpStatus?.configured ? "bg-green-50 dark:bg-green-900/20 border-green-200" : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"}>
        {smtpStatus?.configured ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-600" />
        )}
        <AlertDescription className="ml-2">
          {smtpStatus?.configured ? (
            <span className="text-green-800 dark:text-green-200">
              Servidor SMTP configurado: <strong>{smtpStatus.host}</strong>
            </span>
          ) : (
            <span className="text-yellow-800 dark:text-yellow-200">
              Servidor SMTP no configurado. Configure las variables de entorno SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASSWORD.
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Initialize button if no settings */}
      {settings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Mail className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Sin configuraciones</h3>
            <p className="text-gray-500 mb-4">Inicializa las configuraciones de notificación por defecto</p>
            <Button 
              onClick={() => initializeSettingsMutation.mutate()}
              disabled={initializeSettingsMutation.isPending}
              data-testid="button-initialize-settings"
            >
              {initializeSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-2" />
              Inicializar Configuraciones
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Settings list */}
      <div className="grid gap-4">
        {settings.map((setting) => (
          <Card key={setting.id} data-testid={`card-setting-${setting.notificationType}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={setting.enabled}
                    onCheckedChange={(checked) => toggleEnabledMutation.mutate({ id: setting.id, enabled: checked })}
                    data-testid={`switch-${setting.notificationType}`}
                  />
                  <div>
                    <CardTitle className="text-base">{setting.displayName}</CardTitle>
                    <CardDescription className="text-sm">{setting.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={setting.enabled ? "default" : "secondary"}>
                  {setting.enabled ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === setting.id ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Destinatarios (separados por coma)</Label>
                    <Input
                      value={editValues.recipients}
                      onChange={(e) => setEditValues({ ...editValues, recipients: e.target.value })}
                      placeholder="email1@ejemplo.cl, email2@ejemplo.cl"
                      data-testid={`input-recipients-${setting.notificationType}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Copia (CC)</Label>
                    <Input
                      value={editValues.ccRecipients}
                      onChange={(e) => setEditValues({ ...editValues, ccRecipients: e.target.value })}
                      placeholder="copia@ejemplo.cl"
                      data-testid={`input-cc-${setting.notificationType}`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleSave(setting.id)}
                      disabled={updateSettingMutation.isPending}
                    >
                      {updateSettingMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      <Save className="w-3 h-3 mr-1" />
                      Guardar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">Destinatarios:</span>
                    <span className="font-medium">
                      {setting.recipients || <span className="text-gray-400 italic">Sin configurar</span>}
                    </span>
                  </div>
                  {setting.ccRecipients && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400 ml-6">CC:</span>
                      <span className="font-medium">{setting.ccRecipients}</span>
                    </div>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => handleEdit(setting)}
                    data-testid={`button-edit-${setting.notificationType}`}
                  >
                    Editar Destinatarios
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
