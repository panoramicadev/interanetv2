import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, Clock, CalendarIcon, BarChart3, Filter, Settings2, Target, Package, CheckCircle, XCircle, AlertCircle, TrendingDown, FileText, Home, Eye, Building, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfWeek, addWeeks, subWeeks, getWeek, startOfMonth, getISOWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFilter } from "@/contexts/FilterContext";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";

interface GoalProgress {
  id: string;
  type: string;
  target?: string;
  amount: number;
  period: string;
  description?: string;
  currentSales: number;
  targetAmount: number;
  percentage: number;
  remaining: number;
  isCompleted: boolean;
}

interface SalespersonDetails {
  totalSales: number;
  totalClients: number;
  transactionCount: number;
  averageTicket: number;
  salesFrequency: number; // average days between sales
  daysSinceLastSale: number; // actual days since last sale
  lastSaleDate: string | null; // date of last sale
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
  const salespersonName = propSalespersonName || (paramSalespersonName ? decodeURIComponent(paramSalespersonName) : undefined);
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
  
  // Segment filter state
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  
  // Promesas week selector - initialize to current week
  const [selectedPromesaWeek, setSelectedPromesaWeek] = useState<Date>(() => new Date());
  
  // Promesas collapse state
  const [isPromesasExpanded, setIsPromesasExpanded] = useState(false);

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

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

  // Fetch goals for the salesperson
  const { data: goalsData, isLoading: isLoadingGoals } = useQuery<GoalProgress[]>({
    queryKey: [`/api/goals/progress?selectedPeriod=${selectedPeriod}&type=salesperson&target=${encodeURIComponent(salespersonName || '')}`],
    enabled: !!salespersonName,
  });

  // Fetch user/salesperson ID from the name
  const { data: allUsersData } = useQuery<any[]>({
    queryKey: ['/api/users/salespeople'],
    enabled: !!salespersonName,
  });

  // Find the vendedor ID from the salesperson name
  const vendedorUser = allUsersData?.find((u: any) => 
    (u.fullName === salespersonName || u.salespersonName === salespersonName)
  );
  
  const vendedorId = vendedorUser?.id;

  // Calculate week boundaries for promesas
  const weekStart = startOfWeek(selectedPromesaWeek, { weekStartsOn: 1 });
  const weekEnd = addWeeks(weekStart, 1);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  // Fetch promesas de compra for the vendedor and selected week
  const { data: promesasVendedor = [], isLoading: isLoadingPromesas } = useQuery<any[]>({
    queryKey: ['/api/promesas-compra/cumplimiento/reporte', vendedorId, weekStartStr, weekEndStr],
    queryFn: async () => {
      if (!vendedorId) return [];
      const response = await fetch(`/api/promesas-compra/cumplimiento/reporte?vendedorId=${vendedorId}&startDate=${weekStartStr}&endDate=${weekEndStr}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: !!vendedorId,
  });

  // Fetch all salespeople for the selector - always fetch to enable salesperson switching
  const { data: allSalespeopleResponse } = useQuery<TopSalespeopleResponse>({
    queryKey: [`/api/sales/top-salespeople?limit=5000&period=${selectedPeriod}&filterType=${filterType}`],
  });
  
  const allSalespeople = allSalespeopleResponse?.items || [];
  const goals = Array.isArray(goalsData) ? goalsData : [];
  const primaryGoal = goals.length > 0 ? goals[0] : null;

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

  const getWeekLabel = (date: Date) => {
    const monthStart = startOfMonth(date);
    const weekOfMonth = Math.ceil(getWeek(date, { weekStartsOn: 1 }) - getWeek(monthStart, { weekStartsOn: 1 }) + 1);
    const monthName = format(date, 'MMMM', { locale: es });
    return `Semana ${weekOfMonth} de ${monthName}`;
  };

  const isCurrentWeek = (date: Date) => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const selectedWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    return currentWeekStart.getTime() === selectedWeekStart.getTime();
  };

  return (
    <div className="min-h-screen">
      <div className="w-full">
        {/* Header - Same as Dashboard and Segment */}
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
                  value="vendedor"
                  onValueChange={async (value) => {
                    if (value === "segmento") {
                      // Fetch segments to navigate to first one
                      try {
                        const response = await fetch('/api/analytics/segments');
                        const data = await response.json();
                        if (data.items && data.items.length > 0) {
                          setLocation(`/segment/${encodeURIComponent(data.items[0].segment)}`);
                        } else {
                          setLocation('/');
                        }
                      } catch (error) {
                        console.error('Error fetching segments:', error);
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

              {/* Salesperson selector */}
              {!embedded && allSalespeople && allSalespeople.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Vendedor:</span>
                  <Select 
                    value={salespersonName} 
                    onValueChange={(newSalesperson) => {
                      setLocation(`/salesperson/${encodeURIComponent(newSalesperson)}`);
                    }}
                  >
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm" data-testid="select-salesperson">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto" sideOffset={4}>
                      {allSalespeople.map((sp) => (
                        <SelectItem key={sp.salesperson} value={sp.salesperson}>
                          {sp.salesperson}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Embedded salesperson selector */}
              {embedded && onSalespersonChange && allSalespeople && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Vendedor:</span>
                  <Select value={salespersonName} onValueChange={onSalespersonChange}>
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto">
                      {allSalespeople.map((sp) => (
                        <SelectItem key={sp.salesperson} value={sp.salesperson}>
                          {sp.salesperson}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Period selector with YearMonthSelector */}
              {!embedded && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">Período:</span>
                  <div className="h-9 px-3 rounded-lg border border-gray-200 bg-white flex items-center">
                    <YearMonthSelector
                      value={selection}
                      onChange={setSelection}
                    />
                  </div>
                </div>
              )}

              {/* Embedded period selector */}
              {embedded && onDateFilterChange && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">Período:</span>
                  <YearMonthSelector
                    value={selection}
                    onChange={setSelection}
                  />
                </div>
              )}
            </div>

            {/* Display Selected Filters as chips */}
            <div className="pt-2 border-t space-y-2">
              <div className="text-xs font-medium text-gray-500 mb-2">Filtros activos:</div>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded border border-purple-200">
                <Eye className="h-3 w-3 text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-purple-900">
                    Vista: Por vendedor
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
                    Vendedor: {salespersonName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* Meta de Ventas */}
          {primaryGoal && (
            <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50">
              <CardContent className="pt-6 pb-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500 rounded-full p-3">
                        <Target className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Meta de Ventas</h3>
                        <p className="text-sm text-gray-600">{primaryGoal.description || primaryGoal.period}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${
                        (primaryGoal.percentage || 0) >= 100 ? 'text-emerald-600' : 
                        (primaryGoal.percentage || 0) >= 70 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {(primaryGoal.percentage || 0).toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Logrado</p>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 ${
                        (primaryGoal.percentage || 0) >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 
                        (primaryGoal.percentage || 0) >= 70 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'
                      }`}
                      style={{ width: `${Math.min(primaryGoal.percentage || 0, 100)}%` }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-white/60 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Ventas Actuales</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(primaryGoal.currentSales || 0)}</p>
                    </div>
                    <div className="bg-white/60 rounded-xl p-3">
                      <p className="text-xs text-gray-600 mb-1">Meta</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(primaryGoal.targetAmount || 0)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Sales Total Card */}
            <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-emerald-50/80 to-emerald-100/50" data-testid="card-ventas-totales">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-700 mb-2">
                      Ventas Totales
                    </p>
                    <div className="text-3xl font-bold text-emerald-900 mb-1" data-testid="text-total-sales">
                      {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalSales || 0)}
                    </div>
                    <p className="text-xs text-emerald-600">
                      Este período
                    </p>
                  </div>
                  <div className="bg-emerald-500 rounded-2xl p-3 shadow-sm">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clients Card */}
            <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-blue-50/80 to-blue-100/50" data-testid="card-clientes">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 mb-2">
                      Clientes
                    </p>
                    <div className="text-3xl font-bold text-blue-900 mb-1" data-testid="text-total-clients">
                      {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalClients || 0)}
                    </div>
                    <p className="text-xs text-blue-600">
                      Atendidos
                    </p>
                  </div>
                  <div className="bg-blue-500 rounded-2xl p-3 shadow-sm">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Promedio Card */}
            <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-indigo-50/80 to-indigo-100/50" data-testid="card-ticket-promedio">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-indigo-700 mb-2">
                      Ticket Promedio
                    </p>
                    <div className="text-3xl font-bold text-indigo-900 mb-1" data-testid="text-average-ticket">
                      {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageTicket || 0)}
                    </div>
                    <p className="text-xs text-indigo-600">
                      Por transacción
                    </p>
                  </div>
                  <div className="bg-indigo-500 rounded-2xl p-3 shadow-sm">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Frequency Card */}
            <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-amber-50/80 to-amber-100/50" data-testid="card-dias-ultima-venta">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-700 mb-2">
                      Días desde última venta
                    </p>
                    <div className="text-3xl font-bold text-amber-900 mb-1" data-testid="text-sales-frequency">
                      {isLoadingDetails ? 'Cargando...' : `${details?.daysSinceLastSale || 0} día${details?.daysSinceLastSale !== 1 ? 's' : ''}`}
                    </div>
                    <p className="text-xs text-amber-600">
                      {details?.lastSaleDate ? `Última venta: ${new Date(details.lastSaleDate).toLocaleDateString('es-CL')}` : 'Sin ventas'}
                    </p>
                  </div>
                  <div className="bg-amber-500 rounded-2xl p-3 shadow-sm">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Promesas de Compra - Always show for salespeople */}
          {vendedorId && (
            <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
              <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {/* Header - Responsive layout */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="bg-indigo-500 rounded-full p-2 sm:p-3">
                        <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">Promesas de Compra</h3>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          {isCurrentWeek(selectedPromesaWeek) ? 'Semana actual' : getWeekLabel(selectedPromesaWeek)} - {promesasVendedor.length} compromiso(s)
                        </p>
                      </div>
                    </div>
                    
                    {/* Week selector - Full width on mobile */}
                    <div className="flex items-center justify-center gap-2 bg-white/50 rounded-lg p-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPromesaWeek(subWeeks(selectedPromesaWeek, 1))}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 bg-white/70 hover:bg-white border-indigo-200"
                        data-testid="button-previous-week"
                      >
                        <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <div className="text-xs sm:text-sm font-medium text-gray-700 flex-1 text-center">
                        {getWeekLabel(selectedPromesaWeek)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPromesaWeek(addWeeks(selectedPromesaWeek, 1))}
                        disabled={isCurrentWeek(selectedPromesaWeek)}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 bg-white/70 hover:bg-white border-indigo-200 disabled:opacity-50"
                        data-testid="button-next-week"
                      >
                        <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 rotate-180" />
                      </Button>
                    </div>
                  </div>
                  
                  {isLoadingPromesas ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-pulse text-gray-500">Cargando promesas...</div>
                    </div>
                  ) : promesasVendedor.length === 0 ? (
                    <div className="bg-white/70 rounded-xl p-8 text-center">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">No hay promesas registradas</p>
                      <p className="text-sm text-gray-500 mt-1">
                        para {getWeekLabel(selectedPromesaWeek).toLowerCase()}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Summary Card - Always visible */}
                      <button
                        onClick={() => setIsPromesasExpanded(!isPromesasExpanded)}
                        className="w-full bg-white/90 rounded-xl p-4 border-2 border-indigo-200 hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="bg-indigo-100 rounded-full p-2">
                              <Target className="h-5 w-5 text-indigo-600" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900">
                              Resumen Semanal
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">
                              {promesasVendedor.length} promesa{promesasVendedor.length !== 1 ? 's' : ''}
                            </span>
                            {isPromesasExpanded ? (
                              <ChevronUp className="h-5 w-5 text-indigo-600" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-indigo-600" />
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-purple-50 rounded-lg p-3">
                            <p className="text-xs text-purple-700 mb-1">Total Prometido</p>
                            <p className="text-sm font-bold text-purple-900">
                              {formatCurrency(promesasVendedor.reduce((sum: number, item: any) => 
                                sum + parseFloat(item.promesa?.montoPrometido || '0'), 0
                              ))}
                            </p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-700 mb-1">Total Vendido</p>
                            <p className="text-sm font-bold text-blue-900">
                              {formatCurrency(promesasVendedor.reduce((sum: number, item: any) => 
                                sum + (item.ventasReales || 0), 0
                              ))}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-green-700 mb-1">Cumplimiento</p>
                            <p className={`text-sm font-bold ${
                              (() => {
                                const totalPrometido = promesasVendedor.reduce((sum: number, item: any) => 
                                  sum + parseFloat(item.promesa?.montoPrometido || '0'), 0
                                );
                                const totalVendido = promesasVendedor.reduce((sum: number, item: any) => 
                                  sum + (item.ventasReales || 0), 0
                                );
                                const cumplimientoGeneral = totalPrometido > 0 ? (totalVendido / totalPrometido * 100) : 0;
                                return cumplimientoGeneral >= 100 ? 'text-green-600' : 
                                       cumplimientoGeneral >= 80 ? 'text-yellow-600' : 'text-red-600';
                              })()
                            }`}>
                              {(() => {
                                const totalPrometido = promesasVendedor.reduce((sum: number, item: any) => 
                                  sum + parseFloat(item.promesa?.montoPrometido || '0'), 0
                                );
                                const totalVendido = promesasVendedor.reduce((sum: number, item: any) => 
                                  sum + (item.ventasReales || 0), 0
                                );
                                const cumplimientoGeneral = totalPrometido > 0 ? (totalVendido / totalPrometido * 100) : 0;
                                return cumplimientoGeneral.toFixed(0);
                              })()}%
                            </p>
                          </div>
                        </div>
                      </button>
                      
                      {/* Detailed List - Collapsible */}
                      {isPromesasExpanded && (
                        <div className="space-y-2 sm:space-y-3">
                          {promesasVendedor.map((item: any, index: number) => {
                      const cumplimiento = item.cumplimiento || 0;
                      const estado = item.estado || 'no_cumplido';
                      
                      return (
                        <div key={index} className="bg-white/70 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{item.promesa?.clienteNombre}</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {item.promesa?.clienteTipo === 'potencial' ? 'Cliente Potencial' : 'Cliente Activo'}
                              </p>
                            </div>
                            {estado === 'superado' && (
                              <Badge className="bg-green-500 text-white text-xs flex-shrink-0">
                                <CheckCircle className="mr-0.5 sm:mr-1 h-3 w-3" />
                                <span className="hidden sm:inline">Superado</span>
                                <span className="sm:hidden">✓</span>
                              </Badge>
                            )}
                            {estado === 'cumplido' && (
                              <Badge className="bg-blue-500 text-white text-xs flex-shrink-0">
                                <CheckCircle className="mr-0.5 sm:mr-1 h-3 w-3" />
                                <span className="hidden sm:inline">Cumplido</span>
                                <span className="sm:hidden">✓</span>
                              </Badge>
                            )}
                            {estado === 'cumplido_parcialmente' && (
                              <Badge className="bg-yellow-500 text-white text-xs flex-shrink-0">
                                <CheckCircle className="mr-0.5 sm:mr-1 h-3 w-3" />
                                <span className="hidden sm:inline">Parcial</span>
                                <span className="sm:hidden">~</span>
                              </Badge>
                            )}
                            {estado === 'insuficiente' && (
                              <Badge className="bg-orange-500 text-white text-xs flex-shrink-0">
                                <AlertCircle className="mr-0.5 sm:mr-1 h-3 w-3" />
                                <span className="hidden sm:inline">Insuficiente</span>
                                <span className="sm:hidden">!</span>
                              </Badge>
                            )}
                            {estado === 'no_cumplido' && (
                              <Badge variant="destructive" className="text-xs flex-shrink-0">
                                <XCircle className="mr-0.5 sm:mr-1 h-3 w-3" />
                                <span className="hidden sm:inline">No Cumplido</span>
                                <span className="sm:hidden">✗</span>
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div>
                              <p className="text-xs text-gray-600">Prometido</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                {formatCurrency(parseFloat(item.promesa?.montoPrometido || '0'))}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Vendido</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                {formatCurrency(item.ventasReales || 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Cumplimiento</p>
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                <span className={`text-xs sm:text-sm font-bold ${
                                  cumplimiento >= 100 ? 'text-green-600' : 
                                  cumplimiento >= 80 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {cumplimiento.toFixed(0)}%
                                </span>
                                {cumplimiento >= 100 ? (
                                  <TrendingUp className="h-3 w-3 text-green-600 flex-shrink-0" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 text-red-600 flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {item.promesa?.observaciones && (
                            <p className="text-xs text-gray-600 italic border-t pt-2">
                              {item.promesa.observaciones}
                            </p>
                          )}
                        </div>
                      );
                    })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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