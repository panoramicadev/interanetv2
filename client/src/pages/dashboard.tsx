import { useEffect, useState } from "react";
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
import GoalsProgress from "@/components/dashboard/goals-progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("2025-09");
  const [filterType, setFilterType] = useState<"day" | "month" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Global filter state for goals/segments/salespeople
  const [globalFilter, setGlobalFilter] = useState<{
    type: "all" | "segment" | "salesperson";
    value?: string;
  }>({ type: "all" });

  // Update selected period when filter type changes
  useEffect(() => {
    switch (filterType) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        } else {
          setSelectedPeriod(format(new Date(), "yyyy-MM-dd"));
        }
        break;
      case "month":
        setSelectedPeriod("2025-09");
        break;
      case "range":
        setSelectedPeriod("last-30-days");
        break;
    }
  }, [filterType, selectedDate]);

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


  return (
    <div className="min-h-screen bg-background">
      <Sidebar onImportClick={() => setShowImportModal(true)} />
      
      <div className="ml-64">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between mb-4">
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
                
                {filterType === "day" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-48 justify-start text-left font-normal"
                        data-testid="calendar-trigger"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecciona una fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        data-testid="calendar"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-48" data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6 space-y-6">
          <KPICards 
            selectedPeriod={selectedPeriod} 
            filterType={filterType}
            globalFilter={globalFilter}
          />
          
          {/* Goals Progress Dashboard */}
          <GoalsProgress 
            globalFilter={globalFilter}
            onFilterChange={setGlobalFilter}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesChart 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              globalFilter={globalFilter}
            />
            <TopProductsChart 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              globalFilter={globalFilter}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SegmentChart 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              globalFilter={globalFilter}
            />
            <TopClientsPanel 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              globalFilter={globalFilter}
            />
          </div>

          <TransactionsTable 
            selectedPeriod={selectedPeriod} 
            filterType={filterType}
            globalFilter={globalFilter}
          />
        </main>
      </div>

      <ImportModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal}
      />
    </div>
  );
}
