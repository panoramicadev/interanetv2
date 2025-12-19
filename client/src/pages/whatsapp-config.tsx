import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  MessageCircle, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Save,
  AlertTriangle,
  Info
} from "lucide-react";

interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  isConfigured: boolean;
  lastConnectionTest: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown';
}

export default function WhatsAppConfigPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    webhookVerifyToken: "",
  });
  const [showToken, setShowToken] = useState(false);

  const { data: config, isLoading } = useQuery<WhatsAppConfig>({
    queryKey: ['/api/whatsapp/config'],
    retry: false,
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('/api/whatsapp/config', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Configuración guardada",
        description: "La configuración de WhatsApp se ha guardado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/config'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/whatsapp/test-connection', {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Conexión exitosa" : "Error de conexión",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/config'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error de conexión",
        description: error.message || "No se pudo conectar con la API de WhatsApp.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'disconnected':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"><XCircle className="h-3 w-3 mr-1" />Desconectado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertTriangle className="h-3 w-3 mr-1" />Sin verificar</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-green-600" />
        <div>
          <h2 className="text-2xl font-bold">Integración WhatsApp Business API</h2>
          <p className="text-muted-foreground">
            Configura la conexión con WhatsApp Business API para enviar notificaciones
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Estado de Conexión
            </CardTitle>
            <CardDescription>
              Verifica el estado actual de la integración
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">Estado actual</p>
                <p className="text-sm text-muted-foreground">
                  {config?.lastConnectionTest 
                    ? `Última verificación: ${new Date(config.lastConnectionTest).toLocaleString('es-CL')}`
                    : 'Nunca verificado'}
                </p>
              </div>
              {getStatusBadge(config?.connectionStatus || 'unknown')}
            </div>

            <Button
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending || !config?.isConfigured}
              className="w-full"
              variant={config?.connectionStatus === 'connected' ? 'outline' : 'default'}
              data-testid="button-test-whatsapp-connection"
            >
              {testConnectionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando conexión...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar Conexión
                </>
              )}
            </Button>

            {!config?.isConfigured && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Configuración requerida</AlertTitle>
                <AlertDescription>
                  Debes guardar la configuración antes de poder verificar la conexión.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credenciales de la API</CardTitle>
            <CardDescription>
              Ingresa las credenciales de tu cuenta de WhatsApp Business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                <Input
                  id="phoneNumberId"
                  placeholder="Ej: 123456789012345"
                  value={formData.phoneNumberId}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                  data-testid="input-phone-number-id"
                />
                <p className="text-xs text-muted-foreground">
                  ID del número de teléfono de WhatsApp Business
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAccountId">Business Account ID</Label>
                <Input
                  id="businessAccountId"
                  placeholder="Ej: 123456789012345"
                  value={formData.businessAccountId}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessAccountId: e.target.value }))}
                  data-testid="input-business-account-id"
                />
                <p className="text-xs text-muted-foreground">
                  ID de la cuenta de WhatsApp Business
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="accessToken"
                    type={showToken ? "text" : "password"}
                    placeholder="Token de acceso permanente"
                    value={formData.accessToken}
                    onChange={(e) => setFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                    data-testid="input-access-token"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Token de acceso permanente de la API de WhatsApp
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookVerifyToken">Webhook Verify Token (Opcional)</Label>
                <Input
                  id="webhookVerifyToken"
                  placeholder="Token personalizado para verificar webhook"
                  value={formData.webhookVerifyToken}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhookVerifyToken: e.target.value }))}
                  data-testid="input-webhook-token"
                />
                <p className="text-xs text-muted-foreground">
                  Token para verificar la configuración del webhook
                </p>
              </div>

              <Separator />

              <Button
                type="submit"
                className="w-full"
                disabled={saveConfigMutation.isPending}
                data-testid="button-save-whatsapp-config"
              >
                {saveConfigMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Configuración
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Instrucciones de Configuración
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">1. Crear una App de Meta</h4>
              <p className="text-sm text-muted-foreground">
                Accede a developers.facebook.com y crea una nueva aplicación de tipo "Business".
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">2. Agregar WhatsApp</h4>
              <p className="text-sm text-muted-foreground">
                En la configuración de tu app, agrega el producto "WhatsApp" y sigue los pasos de configuración.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">3. Obtener credenciales</h4>
              <p className="text-sm text-muted-foreground">
                Copia el Phone Number ID, Business Account ID y genera un Access Token permanente.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">4. Verificar conexión</h4>
              <p className="text-sm text-muted-foreground">
                Una vez guardadas las credenciales, usa el botón "Verificar Conexión" para confirmar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
