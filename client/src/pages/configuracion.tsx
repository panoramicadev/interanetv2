import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, Database, Key, Upload, Settings, Mail, MessageCircle, Link2 } from "lucide-react";
import UsersPage from "./users";
import Metas from "./metas";
import ETLMonitor from "./etl-monitor";
import ApiKeysPage from "./api-keys";
import ImportarDatos from "@/components/importar-datos";
import NotificacionesConfigPage from "./notificaciones-config";
import WhatsAppConfigPage from "./whatsapp-config";
import IntegracionesPage from "./integraciones";

export default function ConfiguracionPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("usuarios");

  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configuración</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gestión de usuarios, metas, monitoreo ETL y configuraciones del sistema
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex min-w-max gap-1 p-1">
            <TabsTrigger value="usuarios" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-usuarios">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Gestión de Usuarios</span>
              <span className="sm:hidden">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="metas" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-metas">
              <Target className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Gestión de Metas</span>
              <span className="sm:hidden">Metas</span>
            </TabsTrigger>
            <TabsTrigger value="etl" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-etl">
              <Database className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Monitor ETL</span>
              <span className="sm:hidden">ETL</span>
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-api-keys">
              <Key className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">API Keys</span>
              <span className="sm:hidden">APIs</span>
            </TabsTrigger>
            <TabsTrigger value="importar" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-importar">
              <Upload className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Importar Datos</span>
              <span className="sm:hidden">Importar</span>
            </TabsTrigger>
            <TabsTrigger value="correos" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-correos">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Correos</span>
              <span className="sm:hidden">Correos</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-whatsapp">
              <MessageCircle className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="integraciones" className="flex items-center gap-1.5 whitespace-nowrap px-3" data-testid="tab-config-integraciones">
              <Link2 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Integraciones</span>
              <span className="sm:hidden">Integr.</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="usuarios" className="mt-6">
          <UsersPage />
        </TabsContent>

        <TabsContent value="metas" className="mt-6">
          <Metas />
        </TabsContent>

        <TabsContent value="etl" className="mt-6">
          <ETLMonitor />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysPage />
        </TabsContent>

        <TabsContent value="importar" className="mt-6">
          <ImportarDatos />
        </TabsContent>

        <TabsContent value="correos" className="mt-6">
          <NotificacionesConfigPage />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <WhatsAppConfigPage />
        </TabsContent>

        <TabsContent value="integraciones" className="mt-6">
          <IntegracionesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
