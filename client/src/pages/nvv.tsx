import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Database, BarChart3 } from "lucide-react";
import { CsvImport } from "@/components/nvv/csv-import";
import { PendingSalesTable } from "@/components/nvv/pending-sales-table";
import { NvvDashboard } from "@/components/nvv/nvv-dashboard";


// NVV Page
export default function NVVPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Check if the user is authorized
  if (!user || (user.role !== "admin" && user.role !== "supervisor" && user.role !== "logistica_bodega")) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notas de Venta (NVV)</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gestiona las notas de venta importadas desde archivos CSV
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center space-x-2" data-testid="tab-import">
            <Upload className="h-4 w-4" />
            <span>Importar CSV</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center space-x-2" data-testid="tab-data">
            <Database className="h-4 w-4" />
            <span>Datos Importados</span>
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <NvvDashboard />
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-6">
          <CsvImport 
            title="Importar Notas de Venta"
            description="Sube archivos CSV con datos de notas de venta"
            uploadUrl="/api/nvv/upload"
            onSuccess={() => {
              setActiveTab("data");
            }}
          />
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <PendingSalesTable />
        </TabsContent>

      </Tabs>
    </div>
  );
}