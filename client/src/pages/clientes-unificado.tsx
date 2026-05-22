import { useMemo, useState, type ComponentType } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Users, ShoppingCart, BookOpen, type LucideIcon } from "lucide-react";
import Clients from "@/pages/clients";
import EcommerceUsuarios from "@/pages/ecommerce-usuarios";
import AyudaMemoriaPage from "@/pages/ayuda-memoria";

interface ClienteTab {
  value: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
  // null = visible para cualquier rol que pueda entrar a /clientes
  roles: string[] | null;
}

const CLIENTE_TABS: ClienteTab[] = [
  {
    value: "listado",
    label: "Listado de Clientes",
    icon: Users,
    Component: Clients,
    roles: null,
  },
  {
    value: "market",
    label: "Panorámica Market",
    icon: ShoppingCart,
    Component: EcommerceUsuarios,
    roles: ["admin", "supervisor", "encargado_area", "reception"],
  },
  {
    value: "ayuda-memoria",
    label: "Ayuda Memoria",
    icon: BookOpen,
    Component: AyudaMemoriaPage,
    roles: ["admin", "supervisor"],
  },
];

export default function ClientesUnificado() {
  const { user } = useAuth();
  const role = user?.role;

  const availableTabs = useMemo(
    () =>
      CLIENTE_TABS.filter(
        (tab) => tab.roles === null || (role != null && tab.roles.includes(role)),
      ),
    [role],
  );

  const [activeTab, setActiveTab] = useState(CLIENTE_TABS[0].value);

  // Si el rol solo tiene una vista disponible, la mostramos sin pestañas.
  if (availableTabs.length <= 1) {
    const Only = (availableTabs[0] ?? CLIENTE_TABS[0]).Component;
    return <Only />;
  }

  return (
    <div className="pt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="px-2 md:px-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                  data-testid={`tab-clientes-${tab.value}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        {availableTabs.map((tab) => {
          const Component = tab.Component;
          return (
            <TabsContent key={tab.value} value={tab.value}>
              <Component />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
