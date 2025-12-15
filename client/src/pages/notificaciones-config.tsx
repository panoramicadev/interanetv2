import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Save, Plus, AlertCircle, CheckCircle2, History, ExternalLink, Clock, Send, XCircle, TestTube, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EmailNotificationSetting {
  id: string;
  notificationType: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  recipients: string | null;
  ccRecipients: string | null;
}

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  notificationType: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export default function NotificacionesConfigPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ recipients: string; ccRecipients: string }>({ recipients: '', ccRecipients: '' });
  const [testEmail, setTestEmail] = useState("");

  const { data: settings = [], isLoading } = useQuery<EmailNotificationSetting[]>({
    queryKey: ['/api/admin/email-notification-settings'],
  });

  const { data: smtpStatus } = useQuery<{ configured: boolean; host: string; user: string }>({
    queryKey: ['/api/admin/smtp-status'],
  });

  const { data: emailLogs = [], isLoading: isLoadingLogs } = useQuery<EmailLog[]>({
    queryKey: ['/api/admin/email-logs'],
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

  const testConnectionMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('/api/admin/smtp-test', {
        method: 'POST',
        data: { testEmail: email || undefined },
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-logs'] });
      toast({ title: "Éxito", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error de conexión", description: error.message, variant: "destructive" });
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Send className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="w-6 h-6" />
          Correos
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configura el envío de correos electrónicos del sistema
        </p>
      </div>

      {/* Section 1: Google App Password Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración de Gmail (App Password)
          </CardTitle>
          <CardDescription>
            Configura una contraseña de aplicación de Google para enviar correos desde el sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  Gmail configurado: <strong>{smtpStatus.user}</strong> via <strong>{smtpStatus.host}</strong>
                </span>
              ) : (
                <span className="text-yellow-800 dark:text-yellow-200">
                  Gmail no configurado. Sigue los pasos abajo para configurar.
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Instructions for Google App Password */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Paso 1: Obtener App Password de Google
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <li>Ve a tu cuenta de Google → Seguridad</li>
              <li>Activa la verificación en 2 pasos si no está activada</li>
              <li>Busca "Contraseñas de aplicación" (App passwords)</li>
              <li>Crea una nueva contraseña para "Correo" y "Otra (Panoramica)"</li>
              <li>Copia la contraseña de 16 caracteres generada</li>
            </ol>
            <div className="mt-3">
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Ir a Google App Passwords
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Instructions for setting secrets */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
            <h4 className="font-semibold mb-2">
              Paso 2: Configurar Secrets en Replit
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              En la pestaña "Secrets" del panel de herramientas de Replit, agrega las siguientes variables:
            </p>
            <div className="font-mono text-sm space-y-2 text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">SMTP_HOST</code>
                <span className="text-gray-400">=</span>
                <span>smtp.gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">SMTP_PORT</code>
                <span className="text-gray-400">=</span>
                <span>587</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">SMTP_USER</code>
                <span className="text-gray-400">=</span>
                <span>tu-email@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">SMTP_PASSWORD</code>
                <span className="text-gray-400">=</span>
                <span>tu-app-password-de-16-caracteres</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">SMTP_FROM</code>
                <span className="text-gray-400">=</span>
                <span>"Panoramica" &lt;tu-email@gmail.com&gt;</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Después de configurar los secrets, reinicia la aplicación para que tomen efecto.
            </p>
          </div>

          {/* Test Connection */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <TestTube className="w-4 h-4" />
              Paso 3: Probar Conexión
            </h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="test-email" className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                  Email para prueba (opcional)
                </Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full"
                  data-testid="input-test-email"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => testConnectionMutation.mutate(testEmail)}
                  disabled={testConnectionMutation.isPending || !smtpStatus?.configured}
                  data-testid="button-test-connection"
                >
                  {testConnectionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <TestTube className="w-4 h-4 mr-2" />
                  Probar Conexión
                </Button>
              </div>
            </div>
            {!smtpStatus?.configured && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Configura los secrets primero para poder probar la conexión.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Section 2: Notification Types with Toggles */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Send className="w-5 h-5" />
          Tipos de Notificación
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Activa o desactiva cada tipo de notificación por correo electrónico
        </p>

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

      <Separator />

      {/* Section 3: Email History */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5" />
          Historial de Correos
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Registro de los últimos correos enviados por el sistema
        </p>

        <Card>
          <CardContent className="p-0">
            {isLoadingLogs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : emailLogs.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Mail className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No hay correos enviados todavía</p>
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {emailLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50" data-testid={`email-log-${log.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {getStatusIcon(log.status)}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{log.subject}</p>
                          <p className="text-sm text-gray-500 truncate">
                            Para: {log.recipient}
                          </p>
                          {log.errorMessage && (
                            <p className="text-sm text-red-600 mt-1">
                              Error: {log.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(log.status)}
                        <span className="text-xs text-gray-400">
                          {log.sentAt 
                            ? format(new Date(log.sentAt), "dd MMM yyyy HH:mm", { locale: es })
                            : format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: es })
                          }
                        </span>
                        {log.notificationType && (
                          <span className="text-xs text-gray-400">
                            {log.notificationType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
