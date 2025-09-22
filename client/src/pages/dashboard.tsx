import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import KPICards from "@/components/dashboard/kpi-cards";
import SalesChart from "@/components/dashboard/sales-chart";
import TopProductsChart from "@/components/dashboard/top-products-chart";
import SegmentChart from "@/components/dashboard/segment-chart";
import ComunasChart from "@/components/dashboard/comunas-chart";
import TopClientsPanel from "@/components/dashboard/top-clients-panel";
import TopSalespeoplePanel from "@/components/dashboard/top-salespeople-panel";
import TransactionsTable from "@/components/dashboard/transactions-table";
import GoalsProgress from "@/components/dashboard/goals-progress";
import PackagingSalesMetrics from "@/components/dashboard/packaging-sales-metrics";
import PackagingUnitsMetrics from "@/components/dashboard/packaging-units-metrics";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, Target, Building, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    // Inicializar con el mes actual por defecto
    return format(new Date(), "yyyy-MM");
  });
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Date range state for custom range selection
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  // Global filter state for goals/segments/salespeople
  const [globalFilter, setGlobalFilter] = useState<{
    type: "all" | "global" | "segment" | "salesperson";
    value?: string;
  }>({ type: "all" });
  
  // Filter selector state
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  
  // Comparison period state
  const [comparePeriod, setComparePeriod] = useState<string>("none");
  
  // Reset comparison period when filter type changes
  useEffect(() => {
    setComparePeriod("none");
  }, [filterType]);
  
  // Fetch segments and salespeople for the filter dropdown
  const { data: segments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
  });

  const { data: salespeople } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
  });

  // Sync local filter state with globalFilter changes
  useEffect(() => {
    setSelectedFilter(globalFilter.type);
  }, [globalFilter.type]);

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
        // No forzar período, mantener el seleccionado por el usuario
        // Solo inicializar si no hay período seleccionado
        if (!selectedPeriod || selectedPeriod.includes("_") || selectedPeriod === "current-month" || selectedPeriod === "last-month") {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (dateRange?.from && dateRange?.to) {
          setSelectedPeriod(`${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}`);
        } else {
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, dateRange]);

  // Generate dynamic comparison options based on current filter type
  const generateComparisonOptions = () => {
    const options = [{ value: "none", label: "Ninguno" }];
    
    switch (filterType) {
      case "day":
        options.push(
          { value: "previous-day", label: "Día anterior" },
          { value: "previous-week", label: "Semana anterior" },
          { value: "same-day-last-week", label: "Mismo día semana anterior" },
          { value: "same-day-last-month", label: "Mismo día mes anterior" }
        );
        break;
        
      case "month":
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        options.push(
          { value: "previous-month", label: "Mes anterior" },
          { value: "same-month-last-year", label: "Mismo mes año anterior" }
        );
        
        // Helper function to get month name in Spanish
        const getMonthName = (month: number, year: number) => {
          const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
          return `${monthNames[month]} ${year}`;
        };
        
        // Generate last 6 months
        for (let i = 1; i <= 6; i++) {
          const date = new Date(currentYear, currentMonth - i, 1);
          const yearMonth = format(date, "yyyy-MM");
          const monthName = getMonthName(date.getMonth(), date.getFullYear());
          options.push({ value: yearMonth, label: monthName });
        }
        
        // Add same month from previous years
        for (let i = 1; i <= 3; i++) {
          const date = new Date(currentYear - i, currentMonth, 1);
          const yearMonth = format(date, "yyyy-MM");
          const monthName = getMonthName(date.getMonth(), date.getFullYear());
          options.push({ value: yearMonth, label: monthName });
        }
        break;
        
      case "year":
        options.push({ value: "previous-year", label: "Año anterior" });
        
        // Generate last 5 years
        for (let i = 1; i <= 5; i++) {
          const year = selectedYear - i;
          options.push({ value: year.toString(), label: year.toString() });
        }
        break;
        
      case "range":
        options.push(
          { value: "previous-30-days", label: "30 días anteriores" },
          { value: "previous-90-days", label: "90 días anteriores" },
          { value: "same-period-last-year", label: "Mismo período año anterior" },
          { value: "custom-range", label: "Rango personalizado..." }
        );
        break;
    }
    
    return options;
  };

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
    <div>
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:space-x-4 w-full lg:w-auto">
              {/* Filter Type Selector */}
              <div className="flex items-center space-x-2 flex-none">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                  Filtrar:
                </label>
                <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => setFilterType(value)}>
                  <SelectTrigger className="w-20 sm:w-32 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm" data-testid="select-filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="day">Día</SelectItem>
                    <SelectItem value="month">Mes</SelectItem>
                    <SelectItem value="year">Año</SelectItem>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 lg:w-80 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm min-w-0"
                        data-testid="date-range-trigger"
                      >
                        <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">
                          {dateRange?.from && dateRange?.to
                            ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                            : dateRange?.from
                            ? `${format(dateRange.from, "dd/MM")} - Seleccionar fin`
                            : "Seleccionar rango"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        initialFocus
                        data-testid="date-range-calendar"
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                ) : filterType === "year" ? (
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="flex-1 lg:w-52 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm min-w-0" data-testid="select-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2023">2023</SelectItem>
                      <SelectItem value="2022">2022</SelectItem>
                      <SelectItem value="2021">2021</SelectItem>
                    </SelectContent>
                  </Select>
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

              {/* Dashboard Filter */}
              <div className="flex items-center space-x-2 flex-none">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                  Vista:
                </label>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Filter className="h-4 w-4 text-gray-500 hidden sm:block" />
                  <Select 
                    value={selectedFilter} 
                    onValueChange={(value) => {
                      setSelectedFilter(value);
                      if (value === "all") {
                        setGlobalFilter({ type: "all" });
                      } else if (value === "global") {
                        setGlobalFilter({ type: "global" });
                      } else if (value === "segment") {
                        setGlobalFilter({ type: "segment" });
                      } else if (value === "salesperson") {
                        setGlobalFilter({ type: "salesperson" });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-48 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm">
                      <SelectValue placeholder="Filtrar dashboard" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      <SelectItem value="all">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-gray-500" />
                          <span>Todo el dashboard</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="global">
                        <div className="flex items-center space-x-2">
                          <Target className="h-4 w-4 text-blue-500" />
                          <span>Solo metas globales</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="segment">
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-green-500" />
                          <span>Por segmento</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="salesperson">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span>Por vendedor</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Secondary selector for specific segment/salesperson */}
                  {(selectedFilter === "segment" || selectedFilter === "salesperson") && (
                    <Select 
                      value={globalFilter.value || ""} 
                      onValueChange={(value) => {
                        if (selectedFilter === "segment") {
                          setGlobalFilter({ type: "segment", value });
                        } else if (selectedFilter === "salesperson") {
                          setGlobalFilter({ type: "salesperson", value });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-56 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm">
                        <SelectValue placeholder={
                          selectedFilter === "segment" ? "Selecciona segmento" : "Selecciona vendedor"
                        } />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-200 max-h-60 overflow-y-auto">
                        {selectedFilter === "segment" ? (
                          segments?.map((segment) => (
                            <SelectItem key={segment} value={segment}>
                              {segment}
                            </SelectItem>
                          ))
                        ) : (
                          salespeople?.map((salesperson) => (
                            <SelectItem key={salesperson} value={salesperson}>
                              {salesperson}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              
              {/* Comparison Period Selector */}
              <div className="flex items-center space-x-2 flex-none">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                  Comparar con:
                </label>
                <Select value={comparePeriod} onValueChange={setComparePeriod}>
                  <SelectTrigger className="w-32 sm:w-40 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm" data-testid="select-compare-period">
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200 max-h-60 overflow-y-auto">
                    {generateComparisonOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-3 sm:space-y-4 lg:space-y-6">
          {/* KPI Cards with Modern Styling */}
          <div>
            <KPICards 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              comparePeriod={comparePeriod}
            />
          </div>
          
          {/* Goals Progress Dashboard - Solo mostrar para meses completos */}
          {filterType === "month" && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <GoalsProgress 
                globalFilter={globalFilter}
                selectedPeriod={selectedPeriod}
              />
            </div>
          )}
          
          {/* Primary Analytics - Sales Chart Full Width - Solo mostrar para meses y rangos */}
          {filterType !== "day" && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <SalesChart 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              />
            </div>
          )}

          {/* Ventas por Segmento - Full Width Chart - Ocultar cuando hay filtro activo */}
          {globalFilter.type === "all" && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <SegmentChart 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
              />
            </div>
          )}

          {/* Ventas por Comuna - Full Width Chart - Ocultar cuando hay filtro activo */}
          {globalFilter.type === "all" && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <ComunasChart 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
              />
            </div>
          )}

          {/* Products Chart */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopProductsChart 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Packaging Metrics - Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <PackagingSalesMetrics 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              />
            </div>
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <PackagingUnitsMetrics 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              />
            </div>
          </div>

          {/* Client Analytics & Sales Team - Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <TopClientsPanel 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              />
            </div>
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <TopSalespeoplePanel 
                selectedPeriod={selectedPeriod} 
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              />
            </div>
          </div>

          {/* Transactions - Full Width */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TransactionsTable 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>
        </main>
    </div>
  );
}
