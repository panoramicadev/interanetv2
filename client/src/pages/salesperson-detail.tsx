import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, Clock, CalendarIcon, BarChart3, Filter, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SalespersonDetails {
  totalSales: number;
  totalClients: number;
  transactionCount: number;
  averageTicket: number;
  salesFrequency: number; // days between sales
}

interface SalespersonClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  lastSale: string;
  daysSinceLastSale: number;
}

interface SalespersonSegment {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface SalespersonDetailProps {
  salespersonName?: string;
  embedded?: boolean;
  onBack?: () => void;
  onSalespersonChange?: (salespersonName: string) => void; // Callback to change salesperson when embedded
  onDateFilterChange?: (
    filterType: "day" | "month" | "year" | "range",
    period: string,
    date?: Date,
    year?: number,
    range?: { from?: Date; to?: Date }
  ) => void; // Callback to change date filters when embedded
  // Dashboard filter props (when embedded)
  dashboardGlobalFilter?: {
    type: "all" | "global" | "segment" | "salesperson";
    value?: string;
  };
  dashboardFilterType?: "day" | "month" | "year" | "range";
  dashboardSelectedPeriod?: string;
  dashboardSelectedDate?: Date;
  dashboardSelectedYear?: number;
  dashboardDateRange?: { from?: Date; to?: Date };
}

interface TopSalesperson {
  salesperson: string;
  totalSales: number;
  transactionCount: number;
}

interface TopSalespeopleResponse {
  items: TopSalesperson[];
  periodTotalSales: number;
}

export default function SalespersonDetail({ 
  salespersonName: propSalespersonName, 
  embedded = false, 
  onBack,
  onSalespersonChange,
  onDateFilterChange,
  dashboardGlobalFilter,
  dashboardFilterType,
  dashboardSelectedPeriod,
  dashboardSelectedDate,
  dashboardSelectedYear,
  dashboardDateRange
}: SalespersonDetailProps = {}) {
  const { salespersonName: paramSalespersonName } = useParams();
  const salespersonName = propSalespersonName || paramSalespersonName;
  
  // Date filter states - Initialize from dashboard props if embedded
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">(() => {
    return dashboardFilterType || "month";
  });
  
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    if (dashboardSelectedPeriod) {
      return dashboardSelectedPeriod;
    }
    return format(new Date(), "yyyy-MM");
  });
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (dashboardFilterType === "day" && dashboardSelectedPeriod) {
      return new Date(dashboardSelectedPeriod);
    }
    return new Date();
  });
  
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (dashboardFilterType === "year" && dashboardSelectedPeriod) {
      return parseInt(dashboardSelectedPeriod);
    }
    return new Date().getFullYear();
  });
  
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    if (dashboardFilterType === "range" && dashboardSelectedPeriod && dashboardSelectedPeriod.includes("_")) {
      const [start] = dashboardSelectedPeriod.split("_");
      // Parse as local date to avoid timezone issues
      const [year, month, day] = start.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return undefined;
  });
  
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    if (dashboardFilterType === "range" && dashboardSelectedPeriod && dashboardSelectedPeriod.includes("_")) {
      const [, end] = dashboardSelectedPeriod.split("_");
      // Parse as local date to avoid timezone issues
      const [year, month, day] = end.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return undefined;
  });
  
  // Segment filter state
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

  // Update selected period when filter type or dates change (but not on initial mount with dashboard values)
  useEffect(() => {
    // Skip if we just initialized from dashboard props
    if (dashboardSelectedPeriod && selectedPeriod === dashboardSelectedPeriod) {
      return;
    }
    
    switch (filterType) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        } else {
          setSelectedPeriod(format(new Date(), "yyyy-MM-dd"));
        }
        break;
      case "month":
        if (!selectedPeriod || selectedPeriod.includes("_") || selectedPeriod === "current-month" || selectedPeriod === "last-month") {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (startDate && endDate) {
          setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        } else if (!dashboardSelectedPeriod) {
          // Only set default if not coming from dashboard
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, startDate, endDate]);
  
  const { data: details, isLoading: isLoadingDetails } = useQuery<SalespersonDetails>({
    queryKey: [`/api/sales/salesperson/${salespersonName}/details?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!salespersonName,
  });

  const { data: clients = [], isLoading: isLoadingClients } = useQuery<SalespersonClient[]>({
    queryKey: [`/api/sales/salesperson/${salespersonName}/clients?period=${selectedPeriod}&filterType=${filterType}${selectedSegment ? `&segment=${encodeURIComponent(selectedSegment)}` : ''}`],
    enabled: !!salespersonName,
  });

  const { data: segments = [], isLoading: isLoadingSegments } = useQuery<SalespersonSegment[]>({
    queryKey: [`/api/sales/salesperson/${salespersonName}/segments?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!salespersonName,
  });

  // Fetch all salespeople for the selector (only when embedded)
  const { data: allSalespeopleResponse } = useQuery<TopSalespeopleResponse>({
    queryKey: [`/api/sales/top-salespeople?limit=5000&period=${selectedPeriod}&filterType=${filterType}`],
    enabled: embedded,
  });
  
  const allSalespeople = allSalespeopleResponse?.items || [];

  if (!salespersonName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Vendedor no encontrado</h1>
          {!embedded && (
            <Link href="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Dashboard
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  const getFrequencyDescription = (days: number) => {
    const roundedDays = Math.round(days);
    if (roundedDays <= 0) return '0 días';
    if (roundedDays === 1) return '1 día';
    return `${roundedDays} días`;
  };

  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-green-600';
    if (days <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen">
      <div className="w-full">
        {/* Header - Compact Layout */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-4 m-3 sm:m-4 rounded-2xl shadow-sm">
          {/* Title Section */}
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1">
              {!embedded && (
                <nav className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
                  <Link href="/" className="hover:text-blue-600 transition-colors">
                    Dashboard
                  </Link>
                  <span>›</span>
                  <span className="hidden sm:inline">Vendedor</span>
                  <span className="hidden sm:inline">›</span>
                  <span className="font-medium text-gray-900 truncate">{decodeURIComponent(salespersonName)}</span>
                </nav>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                {decodeURIComponent(salespersonName)}
              </h1>
              <p className="text-gray-600 text-sm">
                {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : filterType === "year" ? "Análisis anual" : "Análisis por rango"}
              </p>
            </div>
            
            {embedded && onBack ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onBack}
                className="rounded-xl border-gray-200 shadow-sm ml-4"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Volver al Dashboard</span>
                <span className="sm:hidden">Volver</span>
              </Button>
            ) : !embedded && (
              <Link href="/">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl border-gray-200 shadow-sm ml-4"
                  data-testid="button-back-dashboard"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Volver al Dashboard</span>
                  <span className="sm:hidden">Volver</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Dashboard Filters Info (when embedded) - Interactive Badges */}
          {embedded && dashboardGlobalFilter && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-700 font-medium">Filtros del Dashboard:</span>
              
              {/* Vendedor Badge - Interactive */}
              {onSalespersonChange && allSalespeople.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer">
                      <Filter className="h-3.5 w-3.5" />
                      <span>
                        {dashboardGlobalFilter.type === "all" && "Todos"}
                        {dashboardGlobalFilter.type === "global" && "Solo metas globales"}
                        {dashboardGlobalFilter.type === "segment" && `Segmento: ${dashboardGlobalFilter.value}`}
                        {dashboardGlobalFilter.type === "salesperson" && `Vendedor: ${dashboardGlobalFilter.value}`}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3 rounded-xl border-gray-200" align="start">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Cambiar vendedor:
                      </label>
                      <Select 
                        value={salespersonName || ""} 
                        onValueChange={(value) => {
                          if (onSalespersonChange) {
                            onSalespersonChange(value);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full rounded-lg border-gray-200">
                          <SelectValue placeholder="Seleccionar vendedor" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200 max-h-80">
                          {allSalespeople.map((sp) => (
                            <SelectItem key={sp.salesperson} value={sp.salesperson}>
                              {sp.salesperson}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Rango Badge - Interactive */}
              {dashboardFilterType && onDateFilterChange && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-lg border border-green-200 hover:bg-green-100 transition-colors cursor-pointer">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span>
                        {dashboardFilterType === "day" && (dashboardSelectedPeriod ? `Día: ${format(new Date(dashboardSelectedPeriod), "dd/MM/yyyy")}` : "Día")}
                        {dashboardFilterType === "month" && (dashboardSelectedPeriod ? `Mes: ${format(new Date(dashboardSelectedPeriod + "-01"), "MMM yyyy")}` : "Mes")}
                        {dashboardFilterType === "year" && (dashboardSelectedPeriod ? `Año: ${dashboardSelectedPeriod}` : "Año")}
                        {dashboardFilterType === "range" && (dashboardSelectedPeriod && dashboardSelectedPeriod.includes("_") ? 
                          `Rango: ${format(new Date(dashboardSelectedPeriod.split("_")[0]), "dd/MM")} - ${format(new Date(dashboardSelectedPeriod.split("_")[1]), "dd/MM")}` : "Rango")}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 rounded-xl border-gray-200" align="start">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700">
                        Cambiar período:
                      </label>
                      
                      {/* Filter Type Selector */}
                      <Select 
                        value={dashboardFilterType} 
                        onValueChange={(value: "day" | "month" | "year" | "range") => {
                          // Reset period when changing type
                          if (value === "month") {
                            const currentMonth = format(new Date(), "yyyy-MM");
                            onDateFilterChange(value, currentMonth);
                          } else if (value === "year") {
                            const currentYear = new Date().getFullYear();
                            onDateFilterChange(value, currentYear.toString(), undefined, currentYear);
                          } else if (value === "day") {
                            const today = new Date();
                            const todayStr = format(today, "yyyy-MM-dd");
                            onDateFilterChange(value, todayStr, today);
                          } else if (value === "range") {
                            onDateFilterChange(value, "", undefined, undefined, undefined);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full rounded-lg border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200">
                          <SelectItem value="day">Día</SelectItem>
                          <SelectItem value="month">Mes</SelectItem>
                          <SelectItem value="year">Año</SelectItem>
                          <SelectItem value="range">Rango</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Period Selector */}
                      {dashboardFilterType === "day" && (
                        <Calendar
                          mode="single"
                          selected={dashboardSelectedDate}
                          onSelect={(date) => {
                            if (date) {
                              const dateStr = format(date, "yyyy-MM-dd");
                              onDateFilterChange("day", dateStr, date);
                            }
                          }}
                          className="rounded-lg border"
                        />
                      )}
                      
                      {dashboardFilterType === "month" && availablePeriods && (
                        <Select 
                          value={dashboardSelectedPeriod} 
                          onValueChange={(value) => {
                            onDateFilterChange("month", value);
                          }}
                        >
                          <SelectTrigger className="w-full rounded-lg border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-200 max-h-60">
                            {availablePeriods.months.map((month: any) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {dashboardFilterType === "year" && availablePeriods && (
                        <Select 
                          value={dashboardSelectedYear?.toString() || ""} 
                          onValueChange={(value) => {
                            const year = parseInt(value);
                            onDateFilterChange("year", value, undefined, year);
                          }}
                        >
                          <SelectTrigger className="w-full rounded-lg border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-200">
                            {availablePeriods.years.map((year: any) => (
                              <SelectItem key={year.value} value={year.value}>
                                {year.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {dashboardFilterType === "range" && (
                        <div className="space-y-2">
                          <Calendar
                            mode="range"
                            selected={dashboardDateRange as any}
                            onSelect={(range) => {
                              if (range?.from && range?.to) {
                                const rangeStr = `${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}`;
                                onDateFilterChange("range", rangeStr, undefined, undefined, range);
                              } else if (range?.from) {
                                // Handle partial selection
                                onDateFilterChange("range", "", undefined, undefined, range);
                              }
                            }}
                            className="rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {/* Sales Total Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-green-700 mb-1 sm:mb-2">Ventas Totales</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-800" data-testid="text-total-sales">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalSales || 0)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-green-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Clients Card */}
            <div className="bg-gradient-to-br from-blue-50 to-sky-100 border border-blue-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-blue-700 mb-1 sm:mb-2">Clientes</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-800" data-testid="text-total-clients">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalClients || 0)}
                  </p>
                  <div className="text-xs text-blue-600 font-medium mt-1">
                    Atendidos
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-blue-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Transactions Card */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-purple-700 mb-1 sm:mb-2">Transacciones</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-800" data-testid="text-transaction-count">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.transactionCount || 0)}
                  </p>
                  <div className="text-xs text-purple-600 font-medium mt-1">
                    Realizadas
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-purple-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Frequency Card */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-100 border border-orange-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-orange-700 mb-1 sm:mb-2">Días desde última venta</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-800" data-testid="text-sales-frequency">
                    {isLoadingDetails ? 'Cargando...' : getFrequencyDescription(details?.salesFrequency || 0)}
                  </p>
                  <div className="text-xs text-orange-600 font-medium mt-1">
                    Promedio
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-orange-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {/* Average Ticket */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-700 mb-2">Ticket Promedio</p>
                  <p className="text-3xl font-bold text-indigo-800" data-testid="text-average-ticket">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageTicket || 0)}
                  </p>
                  <div className="text-xs text-indigo-600 font-medium mt-2">
                    Por transacción
                  </div>
                </div>
                <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center ml-4 shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Productivity */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-100 border border-teal-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-teal-700 mb-2">Productividad</p>
                  <p className="text-3xl font-bold text-teal-800">
                    {isLoadingDetails ? 'Cargando...' : details?.totalClients && details?.transactionCount 
                      ? (details.transactionCount / details.totalClients).toFixed(1) 
                      : '0.0'} 
                    <span className="text-sm text-muted-foreground ml-1">trans/cliente</span>
                  </p>
                  <div className="text-xs text-teal-600 font-medium mt-2">
                    Transacciones por cliente
                  </div>
                </div>
                <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center ml-4 shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Segments Chart */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Ventas por Segmento</h2>
            </div>
            
            {isLoadingSegments ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-pulse">
                  <div className="w-64 h-64 bg-gray-200 rounded-full mx-auto"></div>
                </div>
              </div>
            ) : segments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay datos de segmentos disponibles</p>
            ) : (
              <div className={segments.length === 1 ? 'w-full' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}>
                {segments.map((segment, index) => {
                  const isSelected = selectedSegment === segment.segment;
                  return (
                    <button
                      key={segment.segment}
                      onClick={() => setSelectedSegment(isSelected ? null : segment.segment)}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all text-left w-full ${
                        isSelected 
                          ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' 
                          : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      data-testid={`segment-card-${index}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0" 
                          style={{
                            backgroundColor: [
                              'rgba(253, 99, 1, 0.8)',
                              'rgba(59, 130, 246, 0.8)',
                              'rgba(16, 185, 129, 0.8)',
                              'rgba(245, 158, 11, 0.8)',
                              'rgba(139, 92, 246, 0.8)',
                              'rgba(236, 72, 153, 0.8)',
                              'rgba(99, 102, 241, 0.8)',
                              'rgba(244, 63, 94, 0.8)',
                            ][index % 8]
                          }}
                        />
                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-orange-900' : 'text-gray-900'}`}>
                          {segment.segment}
                        </span>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className={`text-sm font-semibold ${isSelected ? 'text-orange-900' : 'text-gray-900'}`}>
                          {formatCurrency(segment.totalSales)}
                        </p>
                        <p className={`text-xs ${isSelected ? 'text-orange-700' : 'text-gray-500'}`}>
                          {segment.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clients Table */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Clientes del Vendedor</h2>
            </div>
            
            <div className="space-y-3">
              {isLoadingClients ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
                  ))}
                </div>
              ) : clients.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay clientes registrados para este vendedor</p>
              ) : (
                clients.map((client, index) => (
                  <Link key={client.clientName} href={`/client/${encodeURIComponent(client.clientName)}`}>
                    <div 
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      data-testid={`client-${index}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {client.clientName}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <p className="text-xs text-gray-500">
                                {formatNumber(client.transactionCount)} transacciones
                              </p>
                              <p className="text-xs text-gray-500">
                                Ticket: {formatCurrency(client.averageTicket)}
                              </p>
                              <p className={`text-xs ${getDaysColor(client.daysSinceLastSale)}`}>
                                Última venta: {client.daysSinceLastSale} días
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(client.totalSales)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(client.lastSale)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}