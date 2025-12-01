import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, Database, BarChart3, Filter } from "lucide-react";
import { CsvImport } from "@/components/nvv/csv-import";
import { PendingSalesTable } from "@/components/nvv/pending-sales-table";
import { NvvDashboard } from "@/components/nvv/nvv-dashboard";


// NVV Page
export default function NVVPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");

  // Fetch available segments
  const { data: segments } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  // Check if the user is authorized
  if (!user || (user.role !== "admin" && user.role !== "supervisor" && user.role !== "logistica_bodega" && user.role !== "salesperson")) {
    setLocation("/dashboard");
    return null;
  }

  // Get salesperson name for filtering (only for salesperson role)
  const salespersonFilter = user.role === 'salesperson' ? (user as any).salespersonName : undefined;
  
  // Determine if user can see segment filter (admin and supervisor only)
  const canFilterBySegment = user.role === 'admin' || user.role === 'supervisor';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notas de Venta (NVV)</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Gestiona las notas de venta importadas desde archivos CSV
            </p>
          </div>
          
          {/* Segment Filter - Only for admin/supervisor */}
          {canFilterBySegment && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="segment-filter" className="text-sm font-medium whitespace-nowrap">
                Filtrar por Segmento:
              </Label>
              <Select 
                value={selectedSegment} 
                onValueChange={setSelectedSegment}
              >
                <SelectTrigger className="w-[200px]" id="segment-filter" data-testid="select-segment-filter">
                  <SelectValue placeholder="Todos los segmentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los segmentos</SelectItem>
                  {segments?.map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      {segment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
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
          <NvvDashboard 
            salespersonFilter={salespersonFilter} 
            segmentFilter={selectedSegment !== 'all' ? selectedSegment : undefined}
          />
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-6">
          {user.role !== 'salesperson' ? (
            <CsvImport 
              onImportComplete={() => {
                setActiveTab("data");
              }}
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Los vendedores no pueden importar datos CSV.</p>
              <p className="text-sm text-gray-400 mt-2">Contacta con un administrador para importar datos.</p>
            </div>
          )}
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <PendingSalesTable salespersonFilter={salespersonFilter} />
        </TabsContent>

      </Tabs>
    </div>
  );
}