import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/dashboard/sidebar";
import KPICards from "@/components/dashboard/kpi-cards";
import SalesChart from "@/components/dashboard/sales-chart";
import TopProductsChart from "@/components/dashboard/top-products-chart";
import SegmentChart from "@/components/dashboard/segment-chart";
import TopClientsPanel from "@/components/dashboard/top-clients-panel";
import TopSalespeoplePanel from "@/components/dashboard/top-salespeople-panel";
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
      
      <div className="lg:ml-64 transition-all duration-300">
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Dashboard de Ventas
              </h1>
              <p className="text-gray-600 text-base lg:text-lg">
                Resumen de rendimiento - {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : "Análisis por rango"}
              </p>
            </div>
            
            <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:space-x-4">
              {/* Filter Type Selector */}
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Filtrar por:
                </label>
                <Select value={filterType} onValueChange={(value: "day" | "month" | "range") => setFilterType(value)}>
                  <SelectTrigger className="w-36 rounded-xl border-gray-200 shadow-sm" data-testid="select-filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="day">Día</SelectItem>
                    <SelectItem value="month">Mes</SelectItem>
                    <SelectItem value="range">Rango</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Period Selector */}
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700">
                  Período:
                </label>
                
                {filterType === "day" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-48 lg:w-52 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm"
                        data-testid="calendar-trigger"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecciona una fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
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
                    <SelectTrigger className="w-48 lg:w-52 rounded-xl border-gray-200 shadow-sm" data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
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
        <main className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* KPI Cards with Modern Styling */}
          <div>
            <KPICards 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
            />
          </div>
          
          {/* Goals Progress Dashboard */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <GoalsProgress 
              globalFilter={globalFilter}
              onFilterChange={setGlobalFilter}
            />
          </div>
          
          {/* Primary Analytics - Sales Chart Full Width */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <SalesChart 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
            />
          </div>

          {/* Secondary Analytics - Segment and Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <SegmentChart 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
              />
            </div>
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <TopProductsChart 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
              />
            </div>
          </div>

          {/* Client Analytics - Full Width */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <TopClientsPanel 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
            />
          </div>

          {/* Sales Team */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <TopSalespeoplePanel 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
            />
          </div>

          {/* Transactions - Full Width */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <TransactionsTable 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
            />
          </div>
        </main>
      </div>

      <ImportModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal}
      />
    </div>
  );
}
