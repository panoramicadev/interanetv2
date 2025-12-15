import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Save, Plus, CheckCircle2, History, Clock, Send, XCircle, TestTube, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SiGoogle } from "react-icons/si";

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

interface OAuthStatus {
  connected: boolean;
  oauthAvailable: boolean;
  email: string | null;
  tokenValid?: boolean;
  expiresAt?: string | null;
}

export default function NotificacionesConfigPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ recipients: string; ccRecipients: string }>({ recipients: '', ccRecipients: '' });
  const [testEmail, setTestEmail] = useState("");

  const { data: settings = [], isLoading } = useQuery<EmailNotificationSetting[]>({
    queryKey: ['/api/admin/email-notification-settings'],
  });

  const { data: oauthStatus, refetch: refetchOAuthStatus } = useQuery<OAuthStatus>({
    queryKey: ['/api/oauth/google/status'],
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

  const connectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/oauth/google/authorize', { method: 'GET' });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/oauth/google/disconnect', { method: 'POST' });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/oauth/google/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/smtp-status'] });
      toast({ title: "Gmail desvinculado", description: "Se ha desconectado tu cuenta de Gmail" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Check for OAuth callback results in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauth = urlParams.get('oauth');
    const email = urlParams.get('email');
    const message = urlParams.get('message');
    
    if (oauth === 'success' && email) {
      toast({ 
        title: "Gmail vinculado exitosamente", 
        description: `Conectado con: ${email}` 
      });
      refetchOAuthStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauth === 'error') {
      toast({ 
        title: "Error al vincular Gmail", 
        description: message || "Ocurrió un error durante la autenticación",
        variant: "destructive"
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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

      {/* Section 0: Google OAuth Connection */}
      {oauthStatus?.oauthAvailable && (
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SiGoogle className="w-5 h-5 text-[#4285F4]" />
              Vincular con Google
            </CardTitle>
            <CardDescription>
              Conecta tu cuenta de Gmail para enviar correos de forma segura usando OAuth
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthStatus?.connected ? (
              <div className="space-y-4">
                <Alert className={oauthStatus.tokenValid !== false 
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200" 
                  : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"
                }>
                  {oauthStatus.tokenValid !== false ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  )}
                  <AlertDescription className="ml-2">
                    <span className={oauthStatus.tokenValid !== false 
                      ? "text-green-800 dark:text-green-200" 
                      : "text-yellow-800 dark:text-yellow-200"
                    }>
                      Gmail vinculado: <strong>{oauthStatus.email}</strong>
                      {oauthStatus.tokenValid === false && (
                        <span className="block text-sm mt-1">Token expirado - haz clic en Probar para renovar</span>
                      )}
                    </span>
                  </AlertDescription>
                </Alert>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TestTube className="w-4 h-4" />
                    Probar Conexión
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <Input
                        type="email"
                        placeholder="Email para recibir prueba (opcional)"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        data-testid="input-test-email"
                      />
                    </div>
                    <Button
                      onClick={() => testConnectionMutation.mutate(testEmail)}
                      disabled={testConnectionMutation.isPending}
                      variant="outline"
                      data-testid="button-test-oauth"
                    >
                      {testConnectionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <TestTube className="w-4 h-4 mr-2" />
                      Probar
                    </Button>
                  </div>
                </div>

                <Separator />

                <Button
                  variant="outline"
                  onClick={() => disconnectGmailMutation.mutate()}
                  disabled={disconnectGmailMutation.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid="button-disconnect-gmail"
                >
                  {disconnectGmailMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Unlink className="w-4 h-4 mr-2" />
                  Desvincular Gmail
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    ¿Por qué usar Google OAuth?
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
                    <li>Más seguro: no necesitas guardar contraseñas</li>
                    <li>Fácil: solo un clic para conectar</li>
                    <li>Automático: los tokens se renuevan automáticamente</li>
                  </ul>
                </div>
                <Button
                  onClick={() => connectGmailMutation.mutate()}
                  disabled={connectGmailMutation.isPending}
                  className="bg-[#4285F4] hover:bg-[#3367D6] text-white"
                  data-testid="button-connect-gmail"
                >
                  {connectGmailMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <SiGoogle className="w-4 h-4 mr-2" />
                  Vincular con Gmail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section: Notification Types */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Send className="w-5 h-5" />
          Tipos de Notificación
        </h3>

        {settings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Mail className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Sin configuraciones</h3>
              <p className="text-gray-500 mb-4">Inicializa las configuraciones de notificación</p>
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Copia (CC)</Label>
                      <Input
                        value={editValues.ccRecipients}
                        onChange={(e) => setEditValues({ ...editValues, ccRecipients: e.target.value })}
                        placeholder="copia@ejemplo.cl"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(setting.id)} disabled={updateSettingMutation.isPending}>
                        {updateSettingMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        <Save className="w-3 h-3 mr-1" />
                        Guardar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
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
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => handleEdit(setting)}>
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

        <Card>
          <CardContent className="p-0">
            {isLoadingLogs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : emailLogs.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Mail className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No hay correos enviados</p>
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {emailLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {getStatusIcon(log.status)}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{log.subject}</p>
                          <p className="text-sm text-gray-500 truncate">Para: {log.recipient}</p>
                          {log.errorMessage && (
                            <p className="text-sm text-red-600 mt-1">Error: {log.errorMessage}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(log.status)}
                        <span className="text-xs text-gray-400">
                          {log.sentAt 
                            ? format(new Date(log.sentAt), "dd MMM HH:mm", { locale: es })
                            : format(new Date(log.createdAt), "dd MMM HH:mm", { locale: es })
                          }
                        </span>
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
