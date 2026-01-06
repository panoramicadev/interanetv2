import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Link2, Unlink, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { SiFacebook, SiGoogleads } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Integration } from "@shared/schema";

const PLATFORMS = [
  {
    id: "meta_ads",
    name: "Meta Ads",
    description: "Conecta con Facebook e Instagram Ads para visualizar métricas de campañas publicitarias",
    icon: SiFacebook,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    description: "Conecta con Google Ads para visualizar métricas de campañas de búsqueda y display",
    icon: SiGoogleads,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    comingSoon: true,
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" /> Conectado</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" /> Pendiente</Badge>;
    case "error":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3 mr-1" /> Error</Badge>;
    case "disconnected":
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"><Unlink className="h-3 w-3 mr-1" /> Desconectado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function IntegracionesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integración desconectada",
        description: "La integración ha sido desconectada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo desconectar la integración",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/integrations/${id}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Sincronización iniciada",
        description: "Los datos se están sincronizando",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo sincronizar la integración",
        variant: "destructive",
      });
    },
  });

  const handleConnect = async (platformId: string) => {
    setConnectingPlatform(platformId);
    try {
      const response = await apiRequest("POST", `/api/oauth/${platformId}/start`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("No auth URL received");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo iniciar la conexión. Verifica que las credenciales de la plataforma estén configuradas.",
        variant: "destructive",
      });
      setConnectingPlatform(null);
    }
  };

  const getIntegrationForPlatform = (platformId: string) => {
    return integrations?.find(i => i.platform === platformId && i.status === "active");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Integraciones</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Conecta plataformas externas para sincronizar datos automáticamente
          </p>
        </div>
      </div>

      {/* Available Integrations */}
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const existingIntegration = getIntegrationForPlatform(platform.id);
          const Icon = platform.icon;
          
          return (
            <Card key={platform.id} className={`relative overflow-hidden ${platform.comingSoon ? 'opacity-60' : ''}`}>
              {platform.comingSoon && (
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800">
                    <Clock className="h-3 w-3 mr-1" /> Próximamente
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${platform.bgColor}`}>
                    <Icon className={`h-6 w-6 ${platform.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{platform.name}</CardTitle>
                    {existingIntegration && (
                      <div className="mt-1">
                        {getStatusBadge(existingIntegration.status)}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {platform.description}
                </CardDescription>
                
                {existingIntegration ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Cuenta:</span>
                      <span className="font-medium">{existingIntegration.accountName || existingIntegration.accountId || "N/A"}</span>
                    </div>
                    {existingIntegration.lastSync && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Última sincronización:</span>
                        <span className="font-medium">
                          {new Date(existingIntegration.lastSync).toLocaleString("es-CL")}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncMutation.mutate(existingIntegration.id)}
                        disabled={syncMutation.isPending}
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-1.5">Sincronizar</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <Unlink className="h-4 w-4" />
                            <span className="ml-1.5">Desconectar</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desconectar {platform.name}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará la conexión con {platform.name}. Los datos históricos se mantendrán, pero no se sincronizarán nuevos datos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => disconnectMutation.mutate(existingIntegration.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Desconectar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleConnect(platform.id)}
                    disabled={platform.comingSoon || connectingPlatform === platform.id}
                  >
                    {connectingPlatform === platform.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Conectar {platform.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connected Integrations List */}
      {integrations && integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de Conexiones</CardTitle>
            <CardDescription>
              Todas las integraciones configuradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{integration.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {integration.accountId || "Sin cuenta configurada"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(integration.status)}
                    {integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) < new Date() && (
                      <Badge variant="outline" className="text-orange-600">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Token expirado
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Note */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Configuración requerida</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Para conectar Meta Ads, necesitas configurar las variables de entorno <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">META_APP_ID</code> y <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">META_APP_SECRET</code> en la configuración del servidor. Obtén estas credenciales desde el Portal de Desarrolladores de Meta.
              </p>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-yellow-800 dark:text-yellow-200 hover:underline mt-2"
              >
                Ir al Portal de Desarrolladores de Meta <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
