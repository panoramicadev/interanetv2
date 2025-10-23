import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import SalespersonDetail from "@/pages/salesperson-detail";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Filter, Target, Building, Users, TrendingUp, Settings2, X, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import panoramicaLogo from "@assets/Diseno-sin-titulo-12-1-e1733933035809_1759422274944.webp";

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
  
  // Query to fetch available periods with data
  const { data: availablePeriods } = useQuery({
    queryKey: ["/api/sales/available-periods"],
    queryFn: async () => {
      const res = await fetch("/api/sales/available-periods", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query to check if goals exist (only for months) 
  const { data: goalsProgress } = useQuery({
    queryKey: ["/api/goals/progress", selectedPeriod, globalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPeriod) {
        params.append('selectedPeriod', selectedPeriod);
      }
      if (globalFilter.type !== "all") {
        params.append('type', globalFilter.type);
        if (globalFilter.value) {
          params.append('target', globalFilter.value);
        }
      }
      const url = `/api/goals/progress${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: filterType === "month", // Only fetch for month view
  });
  
  // Subtle refresh functionality state
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => 
    localStorage.getItem('dashboard-last-updated')
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Mobile detection and drawer state
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Local state for drawer filters (before applying)
  const [localFilterType, setLocalFilterType] = useState(filterType);
  const [localSelectedPeriod, setLocalSelectedPeriod] = useState(selectedPeriod);
  const [localSelectedDate, setLocalSelectedDate] = useState(selectedDate);
  const [localSelectedYear, setLocalSelectedYear] = useState(selectedYear);
  const [localDateRange, setLocalDateRange] = useState(dateRange);
  const [localSelectedFilter, setLocalSelectedFilter] = useState(selectedFilter);
  const [localGlobalFilter, setLocalGlobalFilter] = useState(globalFilter);
  const [localComparePeriod, setLocalComparePeriod] = useState(comparePeriod);
  
  // Set default comparison period based on filter type
  useEffect(() => {
    if (filterType === "month") {
      setComparePeriod("same-month-last-year");
    } else {
      setComparePeriod("none");
    }
  }, [filterType]);
  
  // Update local state when drawer opens
  const handleDrawerOpen = () => {
    setLocalFilterType(filterType);
    setLocalSelectedPeriod(selectedPeriod);
    setLocalSelectedDate(selectedDate);
    setLocalSelectedYear(selectedYear);
    setLocalDateRange(dateRange);
    setLocalSelectedFilter(selectedFilter);
    setLocalGlobalFilter(globalFilter);
    setLocalComparePeriod(comparePeriod);
    setIsDrawerOpen(true);
  };
  
  // Apply drawer filters to main state
  const handleApplyFilters = () => {
    setFilterType(localFilterType);
    setSelectedPeriod(localSelectedPeriod);
    setSelectedDate(localSelectedDate);
    setSelectedYear(localSelectedYear);
    setDateRange(localDateRange);
    setSelectedFilter(localSelectedFilter);
    setGlobalFilter(localGlobalFilter);
    setComparePeriod(localComparePeriod);
    setIsDrawerOpen(false);
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    const currentMonth = format(new Date(), "yyyy-MM");
    setLocalFilterType("month");
    setLocalSelectedPeriod(currentMonth);
    setLocalSelectedDate(new Date());
    setLocalSelectedYear(new Date().getFullYear());
    setLocalDateRange(undefined);
    setLocalSelectedFilter("all");
    setLocalGlobalFilter({ type: "all" });
    setLocalComparePeriod("none");
  };

  // Subtle refresh functionality
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all sales-related queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/files/last-upload', 'sales'] });
      
      // Don't update timestamp manually - let it be controlled by file upload data
      // The timestamp should reflect when the data file was uploaded, not when refreshed
      
      // Subtle success notification
      toast({
        description: "Datos actualizados",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format last updated time with date and time
  const formatLastUpdated = (timestamp: string): string => {
    const updated = new Date(timestamp);
    
    // Format: DD/MM/YYYY HH:MM AM/PM
    return updated.toLocaleString('es-CL', { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  };
  
  // Generate summary chips for mobile
  const generateSummaryChips = () => {
    const chips = [];
    
    // Filter type and period chip
    let periodText = "";
    switch (filterType) {
      case "day":
        periodText = selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Día";
        break;
      case "month":
        if (selectedPeriod === "current-month") {
          periodText = "Mes actual";
        } else if (selectedPeriod === "last-month") {
          periodText = "Mes anterior";
        } else {
          const [year, month] = selectedPeriod.split("-");
          const date = new Date(parseInt(year), parseInt(month) - 1);
          periodText = format(date, "MMM yyyy");
        }
        break;
      case "year":
        periodText = selectedYear.toString();
        break;
      case "range":
        if (dateRange?.from && dateRange?.to) {
          periodText = `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`;
        } else {
          periodText = "Rango";
        }
        break;
    }
    
    chips.push({
      key: "period",
      label: `${filterType === "day" ? "Día" : filterType === "month" ? "Mes" : filterType === "year" ? "Año" : "Rango"}: ${periodText}`
    });
    
    // Vista chip
    if (globalFilter.type !== "all") {
      let vistaText = "";
      switch (globalFilter.type) {
        case "global":
          vistaText = "Solo metas globales";
          break;
        case "segment":
          vistaText = globalFilter.value ? `Segmento: ${globalFilter.value}` : "Por segmento";
          break;
        case "salesperson":
          vistaText = globalFilter.value ? `Vendedor: ${globalFilter.value}` : "Por vendedor";
          break;
      }
      chips.push({
        key: "vista",
        label: vistaText
      });
    }
    
    // Compare chip
    if (comparePeriod !== "none") {
      const compareOptions = generateComparisonOptions();
      const compareOption = compareOptions.find(option => option.value === comparePeriod);
      if (compareOption) {
        chips.push({
          key: "compare",
          label: `Comparar: ${compareOption.label}`
        });
      }
    }
    
    return chips;
  };
  
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

  // Fetch last file upload timestamp for sales data
  const { data: lastFileUpload } = useQuery({
    queryKey: ["/api/files/last-upload", "sales"],
    queryFn: () => fetch('/api/files/last-upload?fileType=sales').then(res => {
      if (res.status === 404) return null; // No uploads yet
      if (!res.ok) throw new Error('Failed to fetch last upload');
      return res.json();
    }),
    retry: false,
  });

  // Set last updated timestamp from file upload data
  useEffect(() => {
    if (lastFileUpload?.uploadedAt) {
      const uploadTime = lastFileUpload.uploadedAt;
      setLastUpdated(uploadTime);
      localStorage.setItem('dashboard-last-updated', uploadTime);
    } else if (!lastUpdated) {
      // Fallback: use current time if no file uploads found
      const now = new Date().toISOString();
      setLastUpdated(now);
      localStorage.setItem('dashboard-last-updated', now);
    }
  }, [lastFileUpload, lastUpdated]);

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

  // Get month options from backend (only periods with data)
  const getMonthOptions = () => {
    if (!availablePeriods || !availablePeriods.months) {
      return [];
    }
    return availablePeriods.months;
  };

  // Get year options from backend (only years with data)
  const getYearOptions = () => {
    if (!availablePeriods || !availablePeriods.years) {
      return [];
    }
    return availablePeriods.years;
  };

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
          { value: "same-range-previous-period", label: "Mismo rango período anterior" },
          { value: "same-range-previous-month", label: "Mismo rango mes anterior" },
          { value: "same-range-previous-year", label: "Mismo rango año anterior" },
          { value: "custom-range", label: "Personalizado" }
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

  // Si hay un vendedor seleccionado, mostrar el dashboard del vendedor embedido
  if (globalFilter.type === "salesperson" && globalFilter.value) {
    const handleBack = () => {
      setGlobalFilter({ type: "all" });
      setSelectedFilter("all");
    };
    
    const handleSalespersonChange = (newSalesperson: string) => {
      setGlobalFilter({ type: "salesperson", value: newSalesperson });
    };
    
    const handleDateFilterChange = (
      newFilterType: "day" | "month" | "year" | "range",
      newPeriod: string,
      newDate?: Date,
      newYear?: number,
      newRange?: { from?: Date; to?: Date }
    ) => {
      setFilterType(newFilterType);
      setSelectedPeriod(newPeriod);
      if (newDate) setSelectedDate(newDate);
      if (newYear) setSelectedYear(newYear);
      if (newRange !== undefined) setDateRange(newRange as any);
    };
    
    return (
      <SalespersonDetail 
        key={globalFilter.value} // Force remount when salesperson changes
        salespersonName={globalFilter.value} 
        embedded={true}
        onBack={handleBack}
        onSalespersonChange={handleSalespersonChange}
        onDateFilterChange={handleDateFilterChange}
        dashboardGlobalFilter={globalFilter}
        dashboardFilterType={filterType}
        dashboardSelectedPeriod={selectedPeriod}
        dashboardSelectedDate={selectedDate}
        dashboardSelectedYear={selectedYear}
        dashboardDateRange={dateRange}
      />
    );
  }

  return (
    <div>
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 pt-3 pb-2 sm:py-5 lg:py-6 m-2 sm:m-4 rounded-2xl shadow-sm">
          {/* Mobile Layout: Filters Button + Summary Chips */}
          {isMobile ? (
            <div className="space-y-2">
              {/* Period and Filters in one line */}
              <div className="flex items-center justify-between gap-2">
                {/* Period Display */}
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary" className="w-full justify-center px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg truncate">
                    {filterType === "month" 
                      ? getMonthOptions().find((opt: { value: string; label: string }) => opt.value === selectedPeriod)?.label || selectedPeriod
                      : filterType === "year"
                      ? selectedYear.toString()
                      : filterType === "day"
                      ? selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar"
                      : dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                      : "Rango"}
                  </Badge>
                </div>
                
                <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDrawerOpen}
                      className="flex items-center gap-2 h-9 px-3 text-sm rounded-xl border-gray-200 shadow-sm"
                      data-testid="button-filters"
                    >
                      <Settings2 className="h-4 w-4" />
                      <span>Filtros</span>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[85vh]">
                    <DrawerHeader className="text-center border-b pb-4 mb-6">
                      <DrawerTitle className="text-lg font-semibold">Filtros del Dashboard</DrawerTitle>
                      <DrawerDescription className="text-sm text-gray-600">
                        Personaliza la vista de tus datos de ventas
                      </DrawerDescription>
                    </DrawerHeader>
                    
                    <div className="px-6 space-y-6 overflow-y-auto flex-1">
                      {/* Período Section */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                          <CalendarIcon className="h-4 w-4" />
                          <span>Período de tiempo</span>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">Tipo de filtro</label>
                            <Select value={localFilterType} onValueChange={(value: "day" | "month" | "year" | "range") => setLocalFilterType(value)}>
                              <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-gray-200">
                                <SelectItem value="day">Día específico</SelectItem>
                                <SelectItem value="month">Mensual</SelectItem>
                                <SelectItem value="year">Anual</SelectItem>
                                <SelectItem value="range">Rango personalizado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">
                              {localFilterType === "day" ? "Fecha" : 
                               localFilterType === "month" ? "Mes" : 
                               localFilterType === "year" ? "Año" : "Rango de fechas"}
                            </label>
                            
                            {localFilterType === "day" ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="h-11 w-full justify-start text-left font-normal rounded-xl border-gray-200"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span>
                                      {localSelectedDate ? format(localSelectedDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                                    </span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={localSelectedDate}
                                    onSelect={setLocalSelectedDate}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : localFilterType === "range" ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="h-11 w-full justify-start text-left font-normal rounded-xl border-gray-200"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span>
                                      {localDateRange?.from && localDateRange?.to
                                        ? `${format(localDateRange.from, "dd/MM")} - ${format(localDateRange.to, "dd/MM")}`
                                        : localDateRange?.from
                                        ? `${format(localDateRange.from, "dd/MM")} - Seleccionar fin`
                                        : "Seleccionar rango"}
                                    </span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                                  <Calendar
                                    mode="range"
                                    selected={localDateRange}
                                    onSelect={setLocalDateRange}
                                    initialFocus
                                    numberOfMonths={1}
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : localFilterType === "year" ? (
                              <Select value={localSelectedYear.toString()} onValueChange={(value) => setLocalSelectedYear(parseInt(value))}>
                                <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200">
                                  {getYearOptions().map((option: { value: string; label: string }) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select value={localSelectedPeriod} onValueChange={setLocalSelectedPeriod}>
                                <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200">
                                  {getMonthOptions().map((option: { value: string; label: string }) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      {/* Vista Section */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                          <Filter className="h-4 w-4" />
                          <span>Vista del dashboard</span>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">Tipo de vista</label>
                            <Select 
                              value={localSelectedFilter} 
                              onValueChange={(value) => {
                                setLocalSelectedFilter(value);
                                if (value === "all") {
                                  setLocalGlobalFilter({ type: "all" });
                                } else if (value === "global") {
                                  setLocalGlobalFilter({ type: "global" });
                                } else if (value === "segment") {
                                  setLocalGlobalFilter({ type: "segment" });
                                } else if (value === "salesperson") {
                                  setLocalGlobalFilter({ type: "salesperson" });
                                }
                              }}
                            >
                              <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                                <SelectValue />
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
                          </div>
                          
                          {(localSelectedFilter === "segment" || localSelectedFilter === "salesperson") && (
                            <div>
                              <label className="text-sm font-medium text-gray-700 block mb-2">
                                {localSelectedFilter === "segment" ? "Segmento específico" : "Vendedor específico"}
                              </label>
                              <Select 
                                value={localGlobalFilter.value || ""} 
                                onValueChange={(value) => {
                                  if (localSelectedFilter === "segment") {
                                    setLocalGlobalFilter({ type: "segment", value });
                                  } else if (localSelectedFilter === "salesperson") {
                                    setLocalGlobalFilter({ type: "salesperson", value });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                                  <SelectValue placeholder={
                                    localSelectedFilter === "segment" ? "Selecciona segmento" : "Selecciona vendedor"
                                  } />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-200 max-h-60 overflow-y-auto">
                                  {localSelectedFilter === "segment" ? (
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
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Separator />
                      
                      {/* Comparación Section */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                          <TrendingUp className="h-4 w-4" />
                          <span>Comparación de períodos</span>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-2">Comparar con</label>
                          <Select value={localComparePeriod} onValueChange={setLocalComparePeriod}>
                            <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                              <SelectValue />
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
                    </div>
                    
                    <DrawerFooter className="border-t pt-4 mt-6">
                      <div className="flex space-x-3">
                        <Button 
                          variant="outline" 
                          onClick={handleClearFilters}
                          className="flex-1"
                          data-testid="button-clear-filters"
                        >
                          Limpiar
                        </Button>
                        <Button 
                          onClick={handleApplyFilters}
                          className="flex-1"
                          data-testid="button-apply-filters"
                        >
                          Aplicar filtros
                        </Button>
                      </div>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </div>
              
              {/* Summary Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {generateSummaryChips()
                  .filter((chip) => chip.key !== 'period') // Ocultar el chip de período en móvil
                  .map((chip) => (
                    <Badge 
                      key={chip.key} 
                      variant="secondary" 
                      className="shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg"
                      data-testid={`chip-${chip.key}`}
                    >
                      {chip.label}
                    </Badge>
                  ))}
              </div>
            </div>
          ) : (
            /* Desktop Layout: Single line flex layout */
            <div className="flex flex-wrap items-start gap-4 lg:gap-6 w-full">
              {/* Filter Type Selector */}
              <div className="flex items-center justify-between sm:justify-start space-x-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-0">
                  Filtrar:
                </label>
                <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => setFilterType(value)}>
                  <SelectTrigger className="h-11 w-28 sm:w-32 lg:w-28 rounded-xl border-gray-200 shadow-sm text-sm" data-testid="select-filter-type">
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
              <div className="flex items-center justify-between sm:justify-start space-x-3 min-w-0">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-0">
                  Período:
                </label>
                
                {filterType === "day" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 w-40 sm:w-44 lg:w-52 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm min-w-0"
                        data-testid="calendar-trigger"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
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
                        className="h-11 w-40 sm:w-44 lg:w-80 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm min-w-0"
                        data-testid="date-range-trigger"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
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
                        numberOfMonths={1}
                      />
                    </PopoverContent>
                  </Popover>
                ) : filterType === "year" ? (
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="h-11 w-40 sm:w-44 lg:w-52 rounded-xl border-gray-200 shadow-sm text-sm min-w-0" data-testid="select-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {getYearOptions().map((option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="h-11 w-40 sm:w-44 lg:w-52 rounded-xl border-gray-200 shadow-sm text-sm min-w-0" data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {getMonthOptions().map((option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Dashboard Filter */}
              <div className="flex items-center justify-between sm:justify-start space-x-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-0">
                  Vista:
                </label>
                <div className="flex items-center space-x-3 flex-1 lg:flex-none">
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
                    <SelectTrigger className="h-11 w-44 sm:w-48 lg:w-48 rounded-xl border-gray-200 shadow-sm text-sm">
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
                </div>
              </div>
              
              {/* Secondary selector for specific segment/salesperson */}
              {(selectedFilter === "segment" || selectedFilter === "salesperson") && (
                <div className="flex items-center justify-between sm:justify-start space-x-3">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-0">
                    {selectedFilter === "segment" ? "Segmento:" : "Vendedor:"}
                  </label>
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
                    <SelectTrigger className="h-11 w-44 sm:w-56 lg:w-56 rounded-xl border-gray-200 shadow-sm text-sm">
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
                </div>
              )}
              
              {/* Comparison Period Selector */}
              <div className="flex items-center justify-between sm:justify-start space-x-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-0">
                  Comparar:
                </label>
                <Select value={comparePeriod} onValueChange={setComparePeriod}>
                  <SelectTrigger className="h-11 w-36 sm:w-40 lg:w-40 rounded-xl border-gray-200 shadow-sm text-sm" data-testid="select-compare-period">
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
          )}
        </header>

        {/* Subtle refresh button - always visible but discrete */}
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="absolute top-2 right-2 opacity-30 hover:opacity-60 transition-opacity text-gray-300 hover:text-gray-400 p-1 z-50"
          title="Actualizar datos"
          data-testid="button-subtle-refresh"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Main Content */}
        <main className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-3 sm:space-y-4 lg:space-y-6 relative">
          {/* Subtle last updated message */}
          {lastUpdated && (
            <div className="absolute top-1 right-3 text-[10px] text-gray-400/60 font-mono pointer-events-none select-none">
              Actualizado {formatLastUpdated(lastUpdated)}
            </div>
          )}
          
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
          
          {/* Goals Progress Dashboard - Solo mostrar para meses completos y cuando hay metas configuradas */}
          {filterType === "month" && goalsProgress && goalsProgress.length > 0 && (
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

          {/* Sales Team & Client Analytics - Full Width Column */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopSalespeoplePanel 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopClientsPanel 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Products Chart */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopProductsChart 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Packaging Metrics - Full Width */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <PackagingSalesMetrics 
              selectedPeriod={selectedPeriod} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
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
