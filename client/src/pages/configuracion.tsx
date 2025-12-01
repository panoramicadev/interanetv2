import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Database, Key, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ImportModal from "@/components/dashboard/import-modal";

import UsersPage from "@/pages/users";
import ETLMonitor from "@/pages/etl-monitor";
import ApiKeysPage from "@/pages/api-keys";

export default function Configuracion() {
  const defaultTab = "usuarios";
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
      return;
    }
    if (!isLoading && user?.role !== 'admin') {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden acceder a la configuración.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/");
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900" data-testid="page-title">
              Configuración
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Administra usuarios, monitorea ETL y gestiona la configuración del sistema
            </p>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="usuarios" className="flex items-center gap-2 py-3" data-testid="tab-usuarios">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Gestión de Usuarios</span>
              <span className="sm:hidden">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="etl" className="flex items-center gap-2 py-3" data-testid="tab-etl">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Monitor ETL</span>
              <span className="sm:hidden">ETL</span>
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="flex items-center gap-2 py-3" data-testid="tab-apikeys">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">API Keys</span>
              <span className="sm:hidden">Keys</span>
            </TabsTrigger>
            <TabsTrigger value="importar" className="flex items-center gap-2 py-3" data-testid="tab-importar">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar Datos</span>
              <span className="sm:hidden">Importar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-6">
            <UsersPage />
          </TabsContent>

          <TabsContent value="etl" className="mt-6">
            <ETLMonitor />
          </TabsContent>

          <TabsContent value="apikeys" className="mt-6">
            <ApiKeysPage />
          </TabsContent>

          <TabsContent value="importar" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Importar Datos
                </CardTitle>
                <CardDescription>
                  Importa datos de ventas y otros registros desde archivos CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowImportModal(true)} data-testid="button-open-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Abrir Importador de Datos
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ImportModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal} 
      />
    </div>
  );
}
