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
  
  // Date range state for custom range selection
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  
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
        if (startDate && endDate) {
          setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        } else {
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  }, [filterType, selectedDate, startDate, endDate]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/login");
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
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 mt-16 lg:mt-4 mx-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                Dashboard de Ventas
              </h1>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
                Resumen de rendimiento - {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : "Análisis por rango"}
              </p>
            </div>
            
            <div className="flex flex-col space-y-2 sm:space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:space-x-4 w-full lg:w-auto">
              {/* Filter Type Selector */}
              <div className="flex items-center space-x-2 sm:space-x-3 flex-none">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                  Filtrar:
                </label>
                <Select value={filterType} onValueChange={(value: "day" | "month" | "range") => setFilterType(value)}>
                  <SelectTrigger className="w-24 sm:w-32 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm" data-testid="select-filter-type">
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
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 lg:flex-none min-w-0">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                  Período:
                </label>
                
                {filterType === "day" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 lg:w-52 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm min-w-0"
                        data-testid="calendar-trigger"
                      >
                        <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">
                          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                        </span>
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
                ) : filterType === "range" ? (
                  <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
                    {/* Fecha Inicio */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 min-w-0 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm"
                          data-testid="start-date-trigger"
                        >
                          <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                          <span className="truncate">
                            {startDate ? format(startDate, "dd/MM") : "Inicio"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          data-testid="start-date-calendar"
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <span className="text-gray-500 text-xs sm:text-sm shrink-0">-</span>
                    
                    {/* Fecha Final */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 min-w-0 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm"
                          data-testid="end-date-trigger"
                        >
                          <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                          <span className="truncate">
                            {endDate ? format(endDate, "dd/MM") : "Final"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          data-testid="end-date-calendar"
                          disabled={(date) => startDate ? date < startDate : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : (
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="flex-1 lg:w-52 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm min-w-0" data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                      <SelectItem value="2025-08">Agosto 2025</SelectItem>
                      <SelectItem value="2025-07">Julio 2025</SelectItem>
                      <SelectItem value="2025-06">Junio 2025</SelectItem>
                      <SelectItem value="2025-05">Mayo 2025</SelectItem>
                      <SelectItem value="current-month">Mes actual</SelectItem>
                      <SelectItem value="last-month">Mes anterior</SelectItem>
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

          {/* Client Analytics & Sales Team - Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <TopClientsPanel 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
              />
            </div>
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <TopSalespeoplePanel 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
              />
            </div>
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
