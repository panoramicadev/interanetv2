import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, UserCheck, CalendarIcon, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";

interface SegmentClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  percentage: number;
}

interface SegmentSalesperson {
  salespersonName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  percentage: number;
}

interface SegmentDetailProps {
  segmentName?: string;
  embedded?: boolean;
  onBack?: () => void;
  onSegmentChange?: (segmentName: string) => void;
  onDateFilterChange?: (
    filterType: "day" | "month" | "year" | "range",
    period: string,
    date?: Date,
    year?: number,
    range?: { from?: Date; to?: Date }
  ) => void;
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

interface SegmentData {
  segment: string;
  totalSales: number;
  percentage: number;
}

export default function SegmentDetail({
  segmentName: propSegmentName,
  embedded = false,
  onBack,
  onSegmentChange,
  onDateFilterChange,
  dashboardGlobalFilter,
  dashboardFilterType,
  dashboardSelectedPeriod,
  dashboardSelectedDate,
  dashboardSelectedYear,
  dashboardDateRange
}: SegmentDetailProps = {}) {
  const { segmentName: paramSegmentName } = useParams();
  const segmentName = propSegmentName || paramSegmentName;
  
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
      const [year, month, day] = start.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return undefined;
  });
  
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    if (dashboardFilterType === "range" && dashboardSelectedPeriod && dashboardSelectedPeriod.includes("_")) {
      const [, end] = dashboardSelectedPeriod.split("_");
      const [year, month, day] = end.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    return undefined;
  });

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

  // Fetch all segments for dropdown
  const { data: segmentData } = useQuery<SegmentData[]>({
    queryKey: [`/api/sales/segments?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: embedded, // Only fetch when embedded
  });

  // Sync local state with dashboard props when they change
  useEffect(() => {
    if (embedded && dashboardFilterType) {
      setFilterType(dashboardFilterType);
    }
  }, [embedded, dashboardFilterType]);

  useEffect(() => {
    if (embedded && dashboardSelectedPeriod) {
      setSelectedPeriod(dashboardSelectedPeriod);
    }
  }, [embedded, dashboardSelectedPeriod]);

  useEffect(() => {
    if (embedded && dashboardSelectedDate) {
      setSelectedDate(dashboardSelectedDate);
    }
  }, [embedded, dashboardSelectedDate]);

  useEffect(() => {
    if (embedded && dashboardSelectedYear) {
      setSelectedYear(dashboardSelectedYear);
    }
  }, [embedded, dashboardSelectedYear]);

  useEffect(() => {
    if (embedded && dashboardDateRange) {
      if (dashboardDateRange.from) {
        setStartDate(dashboardDateRange.from);
      }
      if (dashboardDateRange.to) {
        setEndDate(dashboardDateRange.to);
      }
    }
  }, [embedded, dashboardDateRange]);

  // Update selected period when filter type or dates change
  useEffect(() => {
    // Skip if we're embedded and using dashboard values
    if (embedded && dashboardSelectedPeriod) {
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
        } else {
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, startDate, endDate, embedded, dashboardSelectedPeriod]);
  
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<SegmentClient[]>({
    queryKey: [`/api/sales/segment/${segmentName}/clients?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!segmentName,
  });

  const { data: salespeople = [], isLoading: isLoadingSalespeople } = useQuery<SegmentSalesperson[]>({
    queryKey: [`/api/sales/segment/${segmentName}/salespeople?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!segmentName,
  });

  // Fetch segment goal (only for monthly periods)
  const { data: goalData } = useQuery({
    queryKey: ['/api/goals/progress', selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPeriod) {
        params.append('selectedPeriod', selectedPeriod);
      }
      params.append('type', 'segment');
      params.append('target', segmentName || '');
      
      const url = `/api/goals/progress${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data = await res.json();
      
      // Find the goal for this specific segment
      return data.find((goal: any) => 
        goal.type === 'segment' && 
        goal.target?.toLowerCase() === segmentName?.toLowerCase()
      ) || null;
    },
    enabled: !!segmentName && filterType === 'month', // Only fetch for monthly view
  });

  if (!segmentName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Segmento no encontrado</h1>
          {onBack && (
            <Button variant="outline" className="mt-4" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Calculate KPIs from both clients and salespeople
  const totalSalesFromClients = clients.reduce((sum: number, client: SegmentClient) => sum + client.totalSales, 0);
  const totalClients = clients.length;
  const totalTransactionsFromClients = clients.reduce((sum: number, client: SegmentClient) => sum + client.transactionCount, 0);
  const averageTicketFromClients = totalTransactionsFromClients > 0 ? totalSalesFromClients / totalTransactionsFromClients : 0;
  
  // Salespeople KPIs
  const totalSalespeople = salespeople.length;

  // Use clients data for main KPIs (more accurate for customer perspective)
  const totalSales = totalSalesFromClients;
  const totalTransactions = totalTransactionsFromClients;
  const averageTicket = averageTicketFromClients;

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

  // Format period display
  const getPeriodDisplay = () => {
    switch (filterType) {
      case "day":
        if (selectedDate) {
          return format(selectedDate, "d 'de' MMMM yyyy", { locale: es });
        }
        return "";
      case "month":
        try {
          const date = parse(selectedPeriod, "yyyy-MM", new Date());
          return format(date, "MMMM yyyy", { locale: es });
        } catch {
          return selectedPeriod;
        }
      case "year":
        return selectedPeriod;
      case "range":
        if (startDate && endDate) {
          return `${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM yyyy", { locale: es })}`;
        }
        return "Rango personalizado";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen">
      <div className="w-full">
        {/* Header - Compact Layout */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-4 m-3 sm:m-4 rounded-2xl shadow-sm">
          {/* Title Section */}
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {segmentName}
                </h1>
                {embedded && onSegmentChange && segmentData && (
                  <Select value={segmentName} onValueChange={onSegmentChange}>
                    <SelectTrigger className="w-56 rounded-xl border-gray-200 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {segmentData.map((segment) => (
                        <SelectItem key={segment.segment} value={segment.segment}>
                          {segment.segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <p className="text-gray-600 text-sm">
                {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : filterType === "year" ? "Análisis anual" : "Análisis por rango"}
                {getPeriodDisplay() && (
                  <span className="ml-2 font-medium text-gray-900">
                    • {getPeriodDisplay()}
                  </span>
                )}
              </p>
            </div>
            
            {onBack && (
              <Button 
                variant="outline" 
                size="sm"
                className="rounded-xl border-gray-200 shadow-sm ml-4"
                onClick={onBack}
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Volver al Dashboard</span>
                <span className="sm:hidden">Volver</span>
              </Button>
            )}
          </div>

          {/* Filter Controls - Only show if not embedded (dashboard controls it) */}
          {!embedded && (
            <div className="flex flex-wrap items-center gap-4">
              {/* Filter Type */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Filtrar:
                </label>
                <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => setFilterType(value)}>
                  <SelectTrigger className="w-24 rounded-xl border-gray-200 shadow-sm text-sm">
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
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Período:
                </label>
                {filterType === "day" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-40 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        <span>
                          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : filterType === "range" ? (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                        >
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          <span>
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
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <span className="text-gray-500">-</span>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                        >
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          <span>
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
                          disabled={(date) => startDate ? date < startDate : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : filterType === "year" ? (
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="w-40 rounded-xl border-gray-200 shadow-sm text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {availablePeriods?.years.map((year) => (
                        <SelectItem key={year.value} value={year.value}>
                          {year.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {availablePeriods?.months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Total Ventas</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-green-600" data-testid="text-total-sales">
                    {formatCurrency(totalSales)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-green-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Goal Card - Only show for monthly view */}
            {filterType === 'month' && goalData && (
              <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">
                      Meta del Mes
                    </p>
                    <p className="text-base sm:text-lg lg:text-2xl font-bold text-purple-600" data-testid="text-goal-amount">
                      {formatCurrency(Number(goalData.targetAmount))}
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={goalData.percentage >= 100 ? "default" : "secondary"}
                          className={goalData.percentage >= 100 ? "bg-green-600" : ""}
                        >
                          {goalData.percentage.toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(Number(goalData.currentSales))} / {formatCurrency(Number(goalData.targetAmount))}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            )}

            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Clientes / Vendedores</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-blue-600" data-testid="text-total-clients">
                    {formatNumber(totalClients)} / {formatNumber(totalSalespeople)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Transacciones</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-purple-600" data-testid="text-total-transactions">
                    {formatNumber(totalTransactions)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Ticket Promedio</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-orange-600" data-testid="text-average-ticket">
                    {formatCurrency(averageTicket)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-orange-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {/* Top Clients Table */}
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Top Clientes del Segmento</h2>
              </div>
              
              <div className="space-y-3">
                {isLoadingClients ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : clients.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay clientes en este segmento</p>
                ) : (
                  clients.slice(0, 10).map((client) => (
                    <div key={client.clientName} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {client.clientName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(client.transactionCount)} transacciones
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(client.totalSales)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {client.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Salespeople Table */}
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Top Vendedores del Segmento</h2>
              </div>
              
              <div className="space-y-3">
                {isLoadingSalespeople ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : salespeople.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay vendedores en este segmento</p>
                ) : (
                  salespeople.slice(0, 10).map((salesperson) => (
                    <div key={salesperson.salespersonName} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {salesperson.salespersonName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(salesperson.transactionCount)} transacciones
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(salesperson.totalSales)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {salesperson.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
