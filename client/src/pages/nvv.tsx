import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Upload, Database, Package, Target, Users } from "lucide-react";
import { CsvImport } from "@/components/nvv/csv-import";
import { PendingSalesTable } from "@/components/nvv/pending-sales-table";

interface NvvMetrics {
  totalAmount: number;
  totalQuantity: number;
  pendingCount: number;
  confirmedCount: number;
  deliveredCount: number;
  cancelledCount: number;
}

// Componente para mostrar métricas de los datos importados NVV
function NvvDataMetrics() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<NvvMetrics>({
    queryKey: ['/api/nvv/metrics'],
    retry: false,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  if (metricsLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">No hay datos disponibles para mostrar métricas.</p>
        <p className="text-sm text-gray-400 mt-1">Importa datos CSV para ver las métricas.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-4" data-testid="nvv-metric-total-amount">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <TrendingUp className="h-4 w-4 mr-1" />
            Monto Total
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(metrics.totalAmount || 0)}
          </div>
          <p className="text-xs text-gray-500">En notas de venta</p>
        </CardContent>
      </Card>

      <Card className="p-4" data-testid="nvv-metric-total-quantity">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <Package className="h-4 w-4 mr-1" />
            Cantidad Total
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-2xl font-bold text-blue-600">
            {formatNumber(metrics.totalQuantity || 0)}
          </div>
          <p className="text-xs text-gray-500">Unidades</p>
        </CardContent>
      </Card>

      <Card className="p-4" data-testid="nvv-metric-pending-count">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <Target className="h-4 w-4 mr-1" />
            Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-2xl font-bold text-yellow-600">
            {formatNumber(metrics.pendingCount || 0)}
          </div>
          <p className="text-xs text-gray-500">Por confirmar</p>
        </CardContent>
      </Card>

      <Card className="p-4" data-testid="nvv-metric-confirmed-count">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <Users className="h-4 w-4 mr-1" />
            Confirmados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-2xl font-bold text-green-600">
            {formatNumber(metrics.confirmedCount || 0)}
          </div>
          <p className="text-xs text-gray-500">Listos</p>
        </CardContent>
      </Card>
    </div>
  );
}

// NVV Page
export default function NVVPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("import");

  // Check if the user is authorized
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Notas de Venta (NVV)</h1>
        <p className="text-gray-600 mt-2">
          Gestiona las notas de venta importadas desde archivos CSV
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import" className="flex items-center space-x-2" data-testid="tab-import">
            <Upload className="h-4 w-4" />
            <span>Importar CSV</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center space-x-2" data-testid="tab-data">
            <Database className="h-4 w-4" />
            <span>Datos Importados</span>
          </TabsTrigger>
        </TabsList>

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
          {/* Métricas de Datos Importados */}
          <NvvDataMetrics />

          <PendingSalesTable />
        </TabsContent>

      </Tabs>
    </div>
  );
}