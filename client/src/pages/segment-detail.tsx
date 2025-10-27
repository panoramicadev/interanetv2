import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, UserCheck, CalendarIcon, Target, Eye, Building, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { useFilter } from "@/contexts/FilterContext";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import ComparativeSegmentMetrics from "@/components/dashboard/comparative-segment-metrics";
import ComparativeSegmentClientsTable from "@/components/dashboard/comparative-segment-clients-table";

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
  const segmentName = propSegmentName || (paramSegmentName ? decodeURIComponent(paramSegmentName) : undefined);
  const [, setLocation] = useLocation();
  
  // Use global filter context
  const { selection, setSelection } = useFilter();
  
  // Derived values from selection for backward compatibility
  const selectedPeriod = (() => {
    if (selection.period === "month" && selection.month !== undefined) {
      const year = selection.years[0];
      const month = selection.month + 1;
      return `${year}-${String(month).padStart(2, '0')}`;
    } else if (selection.period === "full-year") {
      return `${selection.years[0]}-01`;
    } else if (selection.period === "day" && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      const month = selection.month !== undefined ? selection.month + 1 : 1;
      const day = selection.days[0];
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (selection.period === "custom-range") {
      return "custom-range";
    }
    return format(new Date(), "yyyy-MM");
  })();
  
  const filterType: "day" | "month" | "year" | "range" = (() => {
    if (selection.period === "day" || selection.period === "days") return "day";
    if (selection.period === "month" || selection.period === "months") return "month";
    if (selection.period === "full-year") return "year";
    if (selection.period === "custom-range") return "range";
    return "month";
  })();
  
  const selectedDate = (() => {
    if (selection.period === "day" && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      const month = selection.month !== undefined ? selection.month : 0;
      const day = selection.days[0];
      return new Date(year, month, day);
    }
    return new Date();
  })();
  
  const selectedYear = selection.years[0];
  
  const dateRange = (() => {
    if (selection.period === "custom-range" && selection.startDate && selection.endDate) {
      return { from: selection.startDate, to: selection.endDate };
    }
    return undefined;
  })();

  // Detect comparative mode (multiple periods selected)
  const isComparativeMode = (() => {
    if (selection.period === "months" && selection.months && selection.months.length > 1) return true;
    if (selection.period === "days" && selection.days && selection.days.length > 1) return true;
    if (selection.years.length > 1 && selection.period === "full-year") return true;
    return false;
  })();

  // Generate list of periods for comparative mode
  const comparativePeriods = (() => {
    if (!isComparativeMode) return [];
    
    const periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }> = [];
    
    // Comparativa mes-a-año: cuando hay múltiples años Y múltiples meses
    if (selection.period === "months" && selection.months && selection.months.length > 1 && selection.years.length > 1) {
      // Para cada mes, crear columnas para cada año
      selection.months.forEach(month => {
        selection.years.forEach(year => {
          const monthStr = String(month).padStart(2, '0');
          const period = `${year}-${monthStr}`;
          const label = format(new Date(year, month - 1), "MMM yyyy", { locale: es });
          periods.push({ period, label, filterType: "month" });
        });
      });
    }
    // Múltiples meses en un solo año
    else if (selection.period === "months" && selection.months && selection.months.length > 1) {
      const year = selection.years[0];
      selection.months.forEach(month => {
        const monthStr = String(month).padStart(2, '0');
        const period = `${year}-${monthStr}`;
        const label = format(new Date(year, month - 1), "MMMM yyyy", { locale: es });
        periods.push({ period, label, filterType: "month" });
      });
    }
    // Comparativa día-a-año: cuando hay múltiples años Y múltiples días
    else if (selection.period === "days" && selection.days && selection.days.length > 1 && selection.years.length > 1) {
      const month = selection.months && selection.months.length > 0 ? selection.months[0] : 1;
      selection.days.forEach(day => {
        selection.years.forEach(year => {
          const monthStr = String(month).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          const period = `${year}-${monthStr}-${dayStr}`;
          const label = format(new Date(year, month - 1, day), "d MMM yyyy", { locale: es });
          periods.push({ period, label, filterType: "day" });
        });
      });
    }
    // Múltiples días en un solo año
    else if (selection.period === "days" && selection.days && selection.days.length > 1) {
      const year = selection.years[0];
      const month = selection.months && selection.months.length > 0 ? selection.months[0] : 1;
      selection.days.forEach(day => {
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const period = `${year}-${monthStr}-${dayStr}`;
        const label = format(new Date(year, month - 1, day), "d 'de' MMMM yyyy", { locale: es });
        periods.push({ period, label, filterType: "day" });
      });
    }
    // Comparativa de años completos
    else if (selection.years.length > 1 && selection.period === "full-year") {
      selection.years.forEach(year => {
        const period = `${year}-01`;
        const label = `${year}`;
        periods.push({ period, label, filterType: "year" });
      });
    }
    
    return periods;
  })();

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

  // Fetch all segments for dropdown - always fetch to enable segment switching
  const { data: segmentData } = useQuery<SegmentData[]>({
    queryKey: [`/api/sales/segments?period=${selectedPeriod}&filterType=${filterType}`],
  });

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
    queryKey: ['/api/goals/progress', selectedPeriod, segmentName],
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
      
      // Backend already filters by type and target, so just return first element
      return data && data.length > 0 ? data[0] : null;
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
        if (dateRange?.from && dateRange?.to) {
          return `${format(dateRange.from, "d MMM", { locale: es })} - ${format(dateRange.to, "d MMM yyyy", { locale: es })}`;
        }
        return "Rango personalizado";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen">
      <div className="w-full">
        {/* Header - Same as Dashboard */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 pt-3 pb-2 sm:py-5 lg:py-6 m-2 sm:m-4 rounded-2xl shadow-sm">
          <div className="space-y-4 w-full">
            {/* All filters in one line */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Home button and Vista */}
              <div className="flex items-center gap-2">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="h-9 w-9 p-0 rounded-lg hover:bg-gray-100 transition-colors"
                    data-testid="button-back-dashboard"
                    title="Volver al Dashboard"
                  >
                    <Home className="h-4 w-4 text-gray-600" />
                  </Button>
                )}
                <Eye className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">Vista:</span>
                <Select 
                  value="segmento"
                  onValueChange={async (value) => {
                    if (value === "vendedor") {
                      // Fetch salespeople to navigate to first one
                      try {
                        const response = await fetch('/api/analytics/salespeople');
                        const data = await response.json();
                        if (data.items && data.items.length > 0) {
                          setLocation(`/salesperson/${encodeURIComponent(data.items[0].salesperson)}`);
                        } else {
                          setLocation('/');
                        }
                      } catch (error) {
                        console.error('Error fetching salespeople:', error);
                        setLocation('/');
                      }
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-48 rounded-lg border-gray-200 text-sm bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-gray-200">
                    <SelectItem value="vendedor">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-purple-500" />
                        <span>Por vendedor</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="segmento">
                      <div className="flex items-center gap-2">
                        <Building className="h-3.5 w-3.5 text-green-500" />
                        <span>Por segmento</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Segment selector */}
              {!embedded && segmentData && segmentData.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Segmento:</span>
                  <Select 
                    value={segmentName} 
                    onValueChange={(newSegment) => {
                      setLocation(`/segment/${encodeURIComponent(newSegment)}`);
                    }}
                  >
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm" data-testid="select-segment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto" sideOffset={4}>
                      {segmentData.map((segment) => (
                        <SelectItem key={segment.segment} value={segment.segment}>
                          {segment.segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Embedded segment selector */}
              {embedded && onSegmentChange && segmentData && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Segmento:</span>
                  <Select value={segmentName} onValueChange={onSegmentChange}>
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto">
                      {segmentData.map((segment) => (
                        <SelectItem key={segment.segment} value={segment.segment}>
                          {segment.segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Period */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">Período:</span>
                <YearMonthSelector 
                  value={selection}
                  onChange={setSelection}
                />
              </div>
            </div>

            {/* Display Selected Filters as chips */}
            <div className="pt-2 border-t space-y-2">
              <div className="text-xs font-medium text-gray-500 mb-2">Filtros activos:</div>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded border border-purple-200">
                <Eye className="h-3 w-3 text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-purple-900">
                    Vista: Por segmento
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded border border-blue-200">
                <CalendarIcon className="h-3 w-3 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-blue-900">
                    Período: {selection.display}
                  </div>
                  <div className="text-[10px] text-blue-700 mt-0.5">
                    {selection.period === "full-year" && `${selection.years.length} año(s) completo(s)`}
                    {selection.period === "month" && `Mes específico en ${selection.years.length} año(s)`}
                    {selection.period === "months" && `${selection.months?.length} meses en ${selection.years.length} año(s)`}
                    {selection.period === "day" && `Día específico en ${selection.years.length} año(s)`}
                    {selection.period === "days" && `${selection.days?.length} días en ${selection.years.length} año(s)`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded border border-green-200">
                <div className="h-3 w-3 text-green-600 flex-shrink-0 rounded-full bg-green-200" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-green-900">
                    Segmento: {segmentName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* Comparative Mode Layout */}
          {isComparativeMode ? (
            <>
              {/* Comparative Metrics Table */}
              <ComparativeSegmentMetrics 
                segmentName={segmentName}
                periods={comparativePeriods}
              />

              {/* Comparative Clients Table */}
              <ComparativeSegmentClientsTable 
                segmentName={segmentName}
                periods={comparativePeriods}
              />
            </>
          ) : (
            <>
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

          {/* Goal Progress Section - Only show for monthly view */}
          {filterType === 'month' && goalData && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Meta del Segmento</h2>
                  <p className="text-sm text-muted-foreground">
                    Objetivo para {selectedPeriod ? format(new Date(selectedPeriod + '-01'), 'MMMM yyyy', { locale: es }) : ''}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-xl">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Meta Mensual</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100" data-testid="text-goal-target">
                    {formatCurrency(Number(goalData.targetAmount))}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-xl">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Ventas Actuales</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-goal-current">
                    {formatCurrency(Number(goalData.currentSales))}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-xl">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Progreso</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="text-goal-percentage">
                      {goalData.percentage.toFixed(1)}%
                    </p>
                    <Badge 
                      variant={goalData.percentage >= 100 ? "default" : "secondary"}
                      className={goalData.percentage >= 100 ? "bg-green-600" : ""}
                    >
                      {goalData.percentage >= 100 ? "¡Cumplida!" : "En progreso"}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      goalData.percentage >= 100 
                        ? 'bg-gradient-to-r from-green-500 to-green-600' 
                        : 'bg-gradient-to-r from-purple-500 to-purple-600'
                    }`}
                    style={{ width: `${Math.min(100, goalData.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
            )}

            {/* Data Tables - Only show in normal mode */}
            {!isComparativeMode && (
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
            )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
