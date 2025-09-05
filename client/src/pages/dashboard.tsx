import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/dashboard/sidebar";
import KPICards from "@/components/dashboard/kpi-cards";
import SalesChart from "@/components/dashboard/sales-chart";
import TopProductsChart from "@/components/dashboard/top-products-chart";
import SegmentChart from "@/components/dashboard/segment-chart";
import TopClientsPanel from "@/components/dashboard/top-clients-panel";
import TransactionsTable from "@/components/dashboard/transactions-table";
import ImportModal from "@/components/dashboard/import-modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("2025-09");
  const [filterType, setFilterType] = useState<"day" | "month" | "range">("month");

  // Update selected period when filter type changes
  useEffect(() => {
    switch (filterType) {
      case "day":
        setSelectedPeriod("today");
        break;
      case "month":
        setSelectedPeriod("2025-09");
        break;
      case "range":
        setSelectedPeriod("last-30-days");
        break;
    }
  }, [filterType]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

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

  if (!isAuthenticated) {
    return null;
  }

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onImportClick={() => setShowImportModal(true)} />
      
      <div className="ml-64">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Dashboard de Ventas
              </h1>
              <p className="text-muted-foreground">
                Resumen de rendimiento - {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : "Análisis por rango"}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Filter Type Selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-foreground">
                  Filtrar por:
                </label>
                <Select value={filterType} onValueChange={(value: "day" | "month" | "range") => setFilterType(value)}>
                  <SelectTrigger className="w-32" data-testid="select-filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Día</SelectItem>
                    <SelectItem value="month">Mes</SelectItem>
                    <SelectItem value="range">Rango</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Period Selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-foreground">
                  Período:
                </label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-48" data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filterType === "day" && (
                      <>
                        <SelectItem value="2025-09-01">1 Septiembre 2025</SelectItem>
                        <SelectItem value="2025-09-02">2 Septiembre 2025</SelectItem>
                        <SelectItem value="2025-09-03">3 Septiembre 2025</SelectItem>
                        <SelectItem value="2025-09-04">4 Septiembre 2025</SelectItem>
                        <SelectItem value="2025-09-05">5 Septiembre 2025</SelectItem>
                        <SelectItem value="today">Hoy</SelectItem>
                        <SelectItem value="yesterday">Ayer</SelectItem>
                      </>
                    )}
                    {filterType === "month" && (
                      <>
                        <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                        <SelectItem value="2025-08">Agosto 2025</SelectItem>
                        <SelectItem value="2025-07">Julio 2025</SelectItem>
                        <SelectItem value="2025-06">Junio 2025</SelectItem>
                        <SelectItem value="2025-05">Mayo 2025</SelectItem>
                        <SelectItem value="current-month">Mes actual</SelectItem>
                        <SelectItem value="last-month">Mes anterior</SelectItem>
                      </>
                    )}
                    {filterType === "range" && (
                      <>
                        <SelectItem value="last-7-days">Últimos 7 días</SelectItem>
                        <SelectItem value="last-30-days">Últimos 30 días</SelectItem>
                        <SelectItem value="last-90-days">Últimos 90 días</SelectItem>
                        <SelectItem value="this-week">Esta semana</SelectItem>
                        <SelectItem value="last-week">Semana anterior</SelectItem>
                        <SelectItem value="this-quarter">Este trimestre</SelectItem>
                        <SelectItem value="this-year">Este año</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                onClick={handleRefresh}
                variant="default"
                size="sm"
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6 space-y-6">
          <KPICards />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesChart />
            <TopProductsChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SegmentChart />
            <TopClientsPanel />
          </div>

          <TransactionsTable />
        </main>
      </div>

      <ImportModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal}
      />
    </div>
  );
}
