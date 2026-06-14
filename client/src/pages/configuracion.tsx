import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, Database, Key, Upload, Settings, Mail, MessageCircle, Link2, ShieldCheck } from "lucide-react";
import UsersPage from "./users";
import Metas from "./metas";
import ETLMonitor from "./etl-monitor";
import ApiKeysPage from "./api-keys";
import ImportarDatos from "@/components/importar-datos";
import NotificacionesConfigPage from "./notificaciones-config";
import WhatsAppConfigPage from "./whatsapp-config";
import IntegracionesPage from "./integraciones";
import RolesPermisosPage from "./roles-permisos";

interface ConfigTab {
  value: string;
  label: string;
  shortLabel: string;
  icon: any;
  /** Permiso requerido; null = solo admin (no configurable) */
  permission: string | null;
  content: React.ReactNode;
}

const CONFIG_TABS: ConfigTab[] = [
  { value: "usuarios", label: "Gestión de Usuarios", shortLabel: "Usuarios", icon: Users, permission: "config.usuarios", content: <UsersPage /> },
  // Edición de permisos = solo admin (evita escalamiento de privilegios)
  { value: "roles", label: "Roles y Permisos", shortLabel: "Roles", icon: ShieldCheck, permission: null, content: <RolesPermisosPage /> },
  { value: "metas", label: "Gestión de Metas", shortLabel: "Metas", icon: Target, permission: "config.metas", content: <Metas /> },
  { value: "etl", label: "Monitor ETL", shortLabel: "ETL", icon: Database, permission: "etl_monitor", content: <ETLMonitor /> },
  { value: "api-keys", label: "API Keys", shortLabel: "APIs", icon: Key, permission: "config.apikeys", content: <ApiKeysPage /> },
  { value: "importar", label: "Importar Datos", shortLabel: "Importar", icon: Upload, permission: "config.importar", content: <ImportarDatos /> },
  { value: "correos", label: "Correos", shortLabel: "Correos", icon: Mail, permission: "config.correos", content: <NotificacionesConfigPage /> },
  { value: "whatsapp", label: "WhatsApp", shortLabel: "WhatsApp", icon: MessageCircle, permission: "config.whatsapp", content: <WhatsAppConfigPage /> },
  { value: "integraciones", label: "Integraciones", shortLabel: "Integr.", icon: Link2, permission: "config.integraciones", content: <IntegracionesPage /> },
];

export default function ConfiguracionPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { can, isReady } = usePermissions();

  const isAdmin = user?.role === "admin";
  const visibleTabs = useMemo(
    () =>
      CONFIG_TABS.filter((tab) =>
        tab.permission === null ? isAdmin : can(tab.permission),
      ),
    [isAdmin, can],
  );

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const currentTab = activeTab && visibleTabs.some((t) => t.value === activeTab)
    ? activeTab
    : visibleTabs[0]?.value;

  if (!user || (isReady && !can("configuracion"))) {
    setLocation("/");
    return null;
  }

  if (!isReady || visibleTabs.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configuración</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gestión de usuarios, roles, metas, monitoreo ETL y configuraciones del sistema
            </p>
          </div>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex min-w-max gap-1 p-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5 whitespace-nowrap px-3"
                  data-testid={`tab-config-${tab.value}`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
