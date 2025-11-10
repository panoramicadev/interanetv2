import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, BarChart3 } from "lucide-react";
import { FacturasTable } from "@/components/facturas/facturas-table";
import NVVPage from "./nvv";
import ProyeccionPage from "./proyeccion";

export default function FacturasMainPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("facturas");

  // Check if the user is authorized
  if (!user || (user.role !== "admin" && user.role !== "supervisor" && user.role !== "logistica_bodega" && user.role !== "salesperson" && user.role !== "client")) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Facturas</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Administra facturas, notas de venta y proyecciones de ventas
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="facturas" className="flex items-center space-x-2" data-testid="tab-facturas">
            <FileText className="h-4 w-4" />
            <span>Facturas</span>
          </TabsTrigger>
          <TabsTrigger value="nvv" className="flex items-center space-x-2" data-testid="tab-nvv">
            <TrendingUp className="h-4 w-4" />
            <span>Notas de Venta (NVV)</span>
          </TabsTrigger>
          <TabsTrigger value="proyeccion" className="flex items-center space-x-2" data-testid="tab-proyeccion">
            <BarChart3 className="h-4 w-4" />
            <span>Proyección</span>
          </TabsTrigger>
        </TabsList>

        {/* Facturas Tab */}
        <TabsContent value="facturas" className="mt-6">
          <FacturasTable />
        </TabsContent>

        {/* NVV Tab */}
        <TabsContent value="nvv" className="mt-6">
          <NVVPage />
        </TabsContent>

        {/* Proyección Tab */}
        <TabsContent value="proyeccion" className="mt-6">
          <ProyeccionPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
