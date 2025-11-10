import { useAuth } from "@/hooks/useAuth";
import type { User, SalespersonUser } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import KPICards from "@/components/dashboard/kpi-cards";
import SalesChart from "@/components/dashboard/sales-chart";
import TransactionsTable from "@/components/dashboard/transactions-table";
import TopProductsChart from "@/components/dashboard/top-products-chart";
import NotificationsPanel from "@/components/dashboard/notifications-panel";
import GoalsProgress from "@/components/dashboard/goals-progress";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import { useFilter } from "@/contexts/FilterContext";
import { SalespersonClientsPanel, SalespersonProductsPanel } from "@/components/salesperson/engagement-panels";
import { useSalespersonAccordion } from "@/hooks/useSalespersonAccordion";
import type { DateRange } from "react-day-picker";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Package, 
  Calendar as CalendarIcon, 
  Target, 
  BarChart3, 
  FileText, 
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Info,
  Bell,
  Clock,
  TrendingDown,
  Star,
  Search,
  XCircle,
  ArrowLeft
} from "lucide-react";
import { format, startOfWeek, addWeeks, subWeeks, getWeek, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

// Helper function to get current month name
const getCurrentMonthLabel = () => {
  const monthName = format(new Date(), "MMMM yyyy", { locale: es });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
};

// Type definitions for API responses
interface GoalProgress {
  id: string;
  type: string;
  target: string | null;
  amount: string;
  period: string;
  description: string | null;
  currentSales: number;
  targetAmount: number;
  percentage: number;
  remaining: number;
  isCompleted: boolean;
}

interface SalespersonDashboardData {
  totalSales: number;
  transactions: number;
  avgTicket: number;
  topProducts: any[];
  recentSales: any[];
  clientCount?: number;
  daysSinceLastSale?: number;
  productivity?: number;
}

interface SalespersonSegment {
  segment: string;
  totalSales: number;
  percentage: number;
}

type ClientData = any; // Can be refined later if needed

export default function SalespersonDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth() as { user: (User & { salespersonName?: string }) | null; isAuthenticated: boolean; isLoading: boolean };
  const { toast } = useToast();
  
  // Use global filter context
  const { selection, setSelection } = useFilter();
  
  // Derived values from selection
  const selectedPeriod = (() => {
    if ((selection.period === "month" || selection.period === "months") && selection.months && selection.months.length > 0) {
      const year = selection.years[0];
      const month = selection.months[0]; // Already in 1-12 format from YearMonthSelector
      return `${year}-${String(month).padStart(2, '0')}`;
    } else if (selection.period === "full-year") {
      return `${selection.years[0]}-01`; // Placeholder for year view
    } else if ((selection.period === "day" || selection.period === "days") && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      const month = selection.months && selection.months.length > 0 ? selection.months[0] : 1;
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
    if ((selection.period === "day" || selection.period === "days") && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      const month = selection.months && selection.months.length > 0 ? selection.months[0] - 1 : 0;
      const day = selection.days[0];
      return new Date(year, month, day);
    }
    return new Date();
  })();
  
  const dateRange: DateRange | undefined = (() => {
    if (selection.period === "custom-range" && selection.startDate && selection.endDate) {
      return { from: selection.startDate, to: selection.endDate };
    }
    return undefined;
  })();
  
  // Client search state
  const [clientSearch, setClientSearch] = useState("");
  
  // Dialog state
  const [showClientsDialog, setShowClientsDialog] = useState(false);
  
  // Promesas week selector
  const [selectedPromesaWeek, setSelectedPromesaWeek] = useState<Date>(() => new Date());
  
  // Reset client search when dialog closes
  useEffect(() => {
    if (!showClientsDialog) {
      setClientSearch("");
    }
  }, [showClientsDialog]);

  // Shared accordion state for mutual exclusion between clients and products
  const accordionState = useSalespersonAccordion();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Try to get salesperson name from user, otherwise fetch from salespeople list
  const rawSalespersonName = useMemo(() => {
    return user?.salespersonName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  }, [user?.salespersonName, user?.firstName, user?.lastName]);
  
  // Fetch salespeople list to get name if not available on user object
  const { data: salespeopleList, isLoading: isLoadingSalespeopleFallback } = useQuery({
    queryKey: ["/api/users/salespeople"],
    queryFn: async () => {
      const res = await fetch('/api/users/salespeople', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !rawSalespersonName && !!user?.id,
  });
  
  // Determine final salesperson name using useMemo to prevent hook order issues
  const salespersonName = useMemo(() => {
    if (rawSalespersonName) return rawSalespersonName;
    if (!salespeopleList || !user) return '';
    const currentSalesperson = salespeopleList.find((sp: any) => sp.id === user.id);
    return currentSalesperson?.salespersonName || currentSalesperson?.fullName || `${currentSalesperson?.firstName || ''} ${currentSalesperson?.lastName || ''}`.trim();
  }, [rawSalespersonName, salespeopleList, user]);

  // Use the same endpoints as salesperson-detail to ensure consistency
  // Enable queries only after fallback loading is complete
  const { data: salespersonData, isLoading: loadingSalesperson } = useQuery({
    queryKey: ['/api/sales/salesperson', salespersonName, 'details', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/details?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
    staleTime: 300000, // 5 minutos
  });

  // Use the same salesperson clients endpoint as the main panel
  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ['/api/sales/salesperson', salespersonName, 'clients', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/clients?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
  });

  // Fetch products data (for topProducts) - matching salesperson-detail
  const { data: productsResponse } = useQuery({
    queryKey: ['/api/sales/salesperson', salespersonName, 'products', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/products?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
  });

  // Extract products array from response
  const productsData = Array.isArray(productsResponse) ? productsResponse : (productsResponse?.items || []);

  // Fetch recent transactions for the salesperson - extract items array
  const { data: transactionsResponse } = useQuery({
    queryKey: ['/api/sales/transactions', salespersonName, selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('salesperson', salespersonName);
      params.append('limit', '10');
      const res = await fetch(`/api/sales/transactions?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
  });
  
  const transactionsData = Array.isArray(transactionsResponse) ? transactionsResponse : (transactionsResponse?.items || []);

  // Fetch smart notifications for sales insights
  const { data: smartNotifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['/api/sales/salesperson', salespersonName, 'smart-notifications'],
    queryFn: async () => {
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/smart-notifications`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
  });

  const { data: goalsData, isLoading: loadingGoals } = useQuery<GoalProgress[]>({
    queryKey: ['/api/goals/progress', selectedPeriod, 'salesperson', salespersonName],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('selectedPeriod', selectedPeriod);
      params.append('type', 'salesperson');
      params.append('target', salespersonName || '');
      const res = await fetch(`/api/goals/progress?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
  });

  const { data: segments = [], isLoading: loadingSegments } = useQuery<SalespersonSegment[]>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'segments', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/segments?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
  });

  // Calculate week boundaries for promesas
  const weekStart = startOfWeek(selectedPromesaWeek, { weekStartsOn: 1 });
  const weekEnd = addWeeks(weekStart, 1);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  // Fetch promesas de compra for the vendedor and selected week
  const { data: promesasVendedor = [], isLoading: isLoadingPromesas } = useQuery<any[]>({
    queryKey: ['/api/promesas-compra/cumplimiento/reporte', user?.id, weekStartStr, weekEndStr],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/promesas-compra/cumplimiento/reporte?vendedorId=${user.id}&startDate=${weekStartStr}&endDate=${weekEndStr}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: !!user?.id,
  });

  // Fetch NVV pending sales for the salesperson
  const { data: nvvPendingData } = useQuery<{ total: number; documentCount: number; clients: any[] }>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'nvv-pending', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/nvv-pending?${params}`, { credentials: 'include' });
      if (!res.ok) return { total: 0, documentCount: 0, clients: [] };
      return await res.json();
    },
    enabled: !!salespersonName && !isLoadingSalespeopleFallback,
  });


  // Group clients by name and aggregate their data - MUST be before any conditional returns
  const groupedClients = useMemo(() => {
    const items = Array.isArray(clientsData) ? clientsData : [];
    const clientMap = new Map<string, any>();
    
    items.forEach((client: any) => {
      const clientName = client.clientName || client.name || 'Sin nombre';
      
      if (clientMap.has(clientName)) {
        const existing = clientMap.get(clientName);
        existing.totalSales += client.totalSales || 0;
        existing.transactionCount += client.transactionCount || 0;
        
        // Keep the most recent purchase date
        if (client.lastPurchaseDate) {
          if (!existing.lastPurchaseDate || new Date(client.lastPurchaseDate) > new Date(existing.lastPurchaseDate)) {
            existing.lastPurchaseDate = client.lastPurchaseDate;
          }
        }
      } else {
        clientMap.set(clientName, {
          clientName,
          name: clientName,
          totalSales: client.totalSales || 0,
          transactionCount: client.transactionCount || 0,
          lastPurchaseDate: client.lastPurchaseDate,
          segment: client.segment,
        });
      }
    });
    
    return Array.from(clientMap.values()).sort((a, b) => b.totalSales - a.totalSales);
  }, [clientsData]);

  // Safe data access with proper defaults - matching salesperson-detail structure
  const salesData = useMemo(() => ({
    totalSales: salespersonData?.totalSales || 0,
    transactions: salespersonData?.transactionCount || 0,
    avgTicket: salespersonData?.averageTicket || 0,
    topProducts: productsData?.slice(0, 5) || [],
    recentSales: transactionsData || [],
    clientCount: salespersonData?.totalClients || 0,
    daysSinceLastSale: salespersonData?.daysSinceLastSale || 0,
    productivity: salespersonData?.salesFrequency || 0
  }), [salespersonData, productsData, transactionsData]);

  const clients = groupedClients;

  const goals = Array.isArray(goalsData) ? goalsData : [];
  const primaryGoal = goals.length > 0 ? goals[0] : null;

  // ALL HOOKS MUST BE ABOVE THIS LINE - Now we can have conditional returns
  if (isLoading || loadingSalesperson || loadingClients || loadingGoals || isLoadingSalespeopleFallback) {
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

  // If salesperson name is not available after fallback attempt, show error message
  if (!salespersonName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Error de Configuración
            </CardTitle>
            <CardDescription>
              Tu cuenta de vendedor no está configurada correctamente. Por favor contacta al administrador para configurar tu nombre de vendedor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Usuario: {user?.email}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }



  // Helper functions for promesas week selector
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('CLP', '$');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('de-DE').format(num);
  };

  // Format selected period for display
  const getPeriodLabel = () => {
    if (filterType === "day") {
      return `Día: ${format(selectedDate, "dd 'de' MMMM yyyy", { locale: es })}`;
    } else if (filterType === "month") {
      const [year, month] = selectedPeriod.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return `Mes: ${format(date, "MMMM yyyy", { locale: es })}`;
    } else if (filterType === "year") {
      return `Año: ${selection.years[0]}`;
    } else if (filterType === "range" && dateRange?.from && dateRange?.to) {
      return `Rango: ${format(dateRange.from, "dd/MM/yy", { locale: es })} - ${format(dateRange.to, "dd/MM/yy", { locale: es })}`;
    }
    return "Período no seleccionado";
  };

  return (
    <>
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  Hola, {user?.salespersonName || `${user?.firstName} ${user?.lastName}`}
                </h1>
                <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
                  Panel de control personalizado para gestión de ventas
                </p>
              </div>

            </div>
            
            {/* Year/Month Selector */}
            <div className="w-full">
              <YearMonthSelector
                value={selection}
                onChange={(newSelection) => newSelection && setSelection(newSelection)}
              />
            </div>
            
            {/* Selected Period Display */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Período actual:
              </span>
              <Badge variant="secondary" className="text-sm font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200">
                {getPeriodLabel()}
              </Badge>
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="px-4 lg:px-6 pb-6 space-y-6">
        
        <section className="space-y-6" data-testid="section-goals-and-segments">
          <GoalsProgress
            globalFilter={{ type: 'salesperson', value: salespersonName }}
            selectedPeriod={selectedPeriod}
            goalsData={goalsData}
            isLoading={loadingGoals}
          />

          <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50" data-testid="card-segment-sales">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 rounded-full p-2 sm:p-3">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-gray-900">Ventas por Segmento</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-gray-600">
                    Distribución de ventas del período seleccionado
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {loadingSegments ? (
                <p className="text-sm text-gray-500" data-testid="text-segments-loading">Cargando segmentos...</p>
              ) : segments.length === 0 ? (
                <p className="text-sm text-gray-500" data-testid="text-segments-empty">Sin datos de segmentos para este período.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {segments.map((segment) => (
                    <div
                      key={segment.segment}
                      className="border border-blue-200 bg-blue-50/60 rounded-xl p-3 flex items-center gap-3 min-w-[280px] flex-1"
                      data-testid={`row-segment-${segment.segment}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{segment.segment}</p>
                        <p className="text-xs text-gray-600">{segment.percentage.toFixed(1)}% del total</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-xs text-gray-600">Ventas</p>
                        <p className="text-sm font-semibold text-blue-700">
                          {formatCurrency(segment.totalSales)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Promesas de Compra Semanales */}
        <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-purple-50/80 via-violet-50/60 to-purple-100/40" data-testid="card-promesas-compra">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-purple-500 rounded-full p-2 sm:p-3">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-gray-900">Promesas de Compra</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-gray-600 mt-0.5">
                    {getWeekLabel(selectedPromesaWeek)}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPromesaWeek(prev => subWeeks(prev, 1))}
                  className="rounded-lg h-7 sm:h-8 flex-1 sm:flex-none"
                  data-testid="button-promesas-prev-week"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPromesaWeek(new Date())}
                  disabled={isCurrentWeek(selectedPromesaWeek)}
                  className="rounded-lg text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8 flex-1 sm:flex-none"
                  data-testid="button-promesas-current-week"
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPromesaWeek(prev => addWeeks(prev, 1))}
                  disabled={isCurrentWeek(selectedPromesaWeek)}
                  className="rounded-lg h-7 sm:h-8 flex-1 sm:flex-none"
                  data-testid="button-promesas-next-week"
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {isLoadingPromesas ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                Cargando promesas...
              </div>
            ) : promesasVendedor.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No hay promesas registradas para esta semana
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {promesasVendedor.map((promesa: any) => {
                  const cumplimiento = promesa.ventasReales > 0 
                    ? (promesa.ventasReales / promesa.montoPromesa) * 100 
                    : 0;
                  
                  const estado = 
                    cumplimiento >= 100 ? 'cumplida' :
                    cumplimiento >= 80 ? 'cerca' :
                    cumplimiento >= 50 ? 'parcial' : 'baja';
                  
                  const colorClasses = {
                    cumplida: 'border-emerald-200 bg-emerald-50/50',
                    cerca: 'border-amber-200 bg-amber-50/50',
                    parcial: 'border-orange-200 bg-orange-50/50',
                    baja: 'border-rose-200 bg-rose-50/50'
                  };

                  const badgeClasses = {
                    cumplida: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    cerca: 'bg-amber-100 text-amber-800 border-amber-200',
                    parcial: 'bg-orange-100 text-orange-800 border-orange-200',
                    baja: 'bg-rose-100 text-rose-800 border-rose-200'
                  };

                  const symbol = {
                    cumplida: '✓',
                    cerca: '~',
                    parcial: '!',
                    baja: '✗'
                  };

                  return (
                    <div 
                      key={promesa.id} 
                      className={`border rounded-xl p-3 sm:p-4 ${colorClasses[estado]}`}
                      data-testid={`promesa-${promesa.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                              {promesa.clienteNombre}
                            </h4>
                            <Badge 
                              variant="outline" 
                              className={`hidden sm:inline-flex text-xs ${badgeClasses[estado]}`}
                              data-testid={`badge-estado-${promesa.id}`}
                            >
                              {estado === 'cumplida' ? 'Cumplida' : 
                               estado === 'cerca' ? 'Cerca' :
                               estado === 'parcial' ? 'Parcial' : 'Baja'}
                            </Badge>
                            <span className={`sm:hidden text-lg font-bold ${badgeClasses[estado].split(' ')[1]}`}>
                              {symbol[estado]}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                            <div>
                              <span className="text-gray-600">Promesa:</span>
                              <span className="ml-1 font-semibold text-gray-900">
                                {formatCurrency(promesa.montoPromesa)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Ventas:</span>
                              <span className="ml-1 font-semibold text-gray-900">
                                {formatCurrency(promesa.ventasReales)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-600">Cumplimiento</span>
                              <span className="font-semibold text-gray-900">{cumplimiento.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  estado === 'cumplida' ? 'bg-emerald-500' :
                                  estado === 'cerca' ? 'bg-amber-500' :
                                  estado === 'parcial' ? 'bg-orange-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(cumplimiento, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NVV Pendientes */}
        {nvvPendingData && nvvPendingData.total > 0 && (
          <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-cyan-50/80 via-sky-50/60 to-blue-100/40" data-testid="card-nvv-pending">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-500 rounded-full p-2 sm:p-3">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base sm:text-lg font-bold text-gray-900">NVV Pendientes</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-gray-600">
                    Ventas no facturadas - No suman a tus ventas actuales
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-cyan-900">
                    {formatCurrency(nvvPendingData.total || 0)}
                  </div>
                  <p className="text-xs text-gray-600">{nvvPendingData.documentCount} docs</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="space-y-2 sm:space-y-3">
                {nvvPendingData.clients.slice(0, 5).map((client: any, idx: number) => (
                  <div 
                    key={idx}
                    className="border border-cyan-200 bg-cyan-50/50 rounded-xl p-3 sm:p-4"
                    data-testid={`nvv-client-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                          {client.clientName}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {client.documentCount} documento{client.documentCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Pendiente</p>
                        <p className="font-semibold text-sm text-cyan-700">
                          {formatCurrency(client.totalPending)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {nvvPendingData.clients.length > 5 && (
                  <p className="text-xs text-center text-gray-600 pt-2">
                    +{nvvPendingData.clients.length - 5} clientes más
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notificaciones Inteligentes de Ventas */}
        {smartNotifications && (
          <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-100/40" data-testid="card-smart-notifications">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 rounded-full p-2 sm:p-3">
                  <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-gray-900">Oportunidades de Venta</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-gray-600">
                    Insights inteligentes para aumentar tus ventas
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <Accordion type="multiple" className="space-y-2">
                {/* Clientes Inactivos */}
                {smartNotifications.inactiveClients?.length > 0 && (
                  <AccordionItem value="inactive-clients" className="border rounded-lg bg-white/40">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-semibold text-gray-900">
                          Clientes Inactivos ({smartNotifications.inactiveClients.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2">
                        {smartNotifications.inactiveClients.slice(0, 3).map((client: any, idx: number) => (
                          <div 
                            key={idx}
                            className="bg-white/60 rounded-lg p-3 border border-orange-200"
                            data-testid={`inactive-client-${idx}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{client.clientName}</p>
                                <p className="text-xs text-gray-600">
                                  {client.daysSinceLastPurchase} días sin comprar
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-600">Última compra</p>
                                <p className="font-semibold text-sm text-orange-700">
                                  {formatCurrency(client.lastPurchaseAmount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Clientes Estacionales */}
                {smartNotifications.seasonalClients?.length > 0 && (
                  <AccordionItem value="seasonal-clients" className="border rounded-lg bg-white/40">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-semibold text-gray-900">
                          Clientes Estacionales ({smartNotifications.seasonalClients.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2">
                        {smartNotifications.seasonalClients.slice(0, 3).map((client: any, idx: number) => (
                          <div 
                            key={idx}
                            className="bg-white/60 rounded-lg p-3 border border-blue-200"
                            data-testid={`seasonal-client-${idx}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{client.clientName}</p>
                                <p className="text-xs text-gray-600">{client.purchasePattern}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-600">Promedio</p>
                                <p className="font-semibold text-sm text-blue-700">
                                  {formatCurrency(client.averagePurchaseAmount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Productos en Tendencia */}
                {smartNotifications.trendingProducts?.length > 0 && (
                  <AccordionItem value="trending-products" className="border rounded-lg bg-white/40">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-semibold text-gray-900">
                          Productos en Tendencia ({smartNotifications.trendingProducts.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-2">
                        {smartNotifications.trendingProducts.slice(0, 3).map((product: any, idx: number) => (
                          <div 
                            key={idx}
                            className="bg-white/60 rounded-lg p-3 border border-emerald-200"
                            data-testid={`trending-product-${idx}`}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{product.productName}</p>
                                <p className="text-xs text-gray-600">{product.recommendation}</p>
                              </div>
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                +{product.growthRate}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

              {!smartNotifications.inactiveClients?.length && 
               !smartNotifications.seasonalClients?.length && 
               !smartNotifications.trendingProducts?.length && (
                <div className="text-center py-6 text-gray-500">
                  <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No hay notificaciones inteligentes disponibles en este momento</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* KPIs del Vendedor */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-emerald-50/80 to-emerald-100/50" data-testid="card-ventas-totales">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-700 mb-2">
                    Ventas Totales
                  </p>
                  <div className="text-3xl font-bold text-emerald-900 mb-1" data-testid="text-ventas-totales">
                    {formatCurrency(salesData.totalSales)}
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

          <Card 
            className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-blue-50/80 to-blue-100/50 relative cursor-pointer hover:shadow-lg transition-shadow" 
            data-testid="card-clientes"
            onClick={() => setShowClientsDialog(true)}
          >
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    Clientes
                  </p>
                  <div className="text-3xl font-bold text-blue-900 mb-1" data-testid="text-clientes">
                    {salesData.clientCount}
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

          <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-violet-50/80 to-violet-100/50" data-testid="card-transacciones">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-violet-700 mb-2">
                    Transacciones
                  </p>
                  <div className="text-3xl font-bold text-violet-900 mb-1" data-testid="text-transacciones">
                    {salesData.transactions}
                  </div>
                  <p className="text-xs text-violet-600">
                    Realizadas
                  </p>
                </div>
                <div className="bg-violet-500 rounded-2xl p-3 shadow-sm">
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-amber-50/80 to-amber-100/50" data-testid="card-dias-ultima-venta">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 mb-2">
                    Días desde última venta
                  </p>
                  <div className="text-3xl font-bold text-amber-900 mb-1" data-testid="text-dias-ultima-venta">
                    {salesData.daysSinceLastSale} días
                  </div>
                  <p className="text-xs text-amber-600">
                    Promedio
                  </p>
                </div>
                <div className="bg-amber-500 rounded-2xl p-3 shadow-sm">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-indigo-50/80 to-indigo-100/50" data-testid="card-ticket-promedio">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-700 mb-2">
                    Ticket Promedio
                  </p>
                  <div className="text-3xl font-bold text-indigo-900 mb-1" data-testid="text-ticket-promedio">
                    {formatCurrency(salesData.avgTicket)}
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

          <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-teal-50/80 to-teal-100/50" data-testid="card-clientes-nuevos">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-teal-700 mb-2">
                    Clientes Nuevos
                  </p>
                  <div className="text-3xl font-bold text-teal-900 mb-1" data-testid="text-clientes-nuevos">
                    {salespersonData?.newClients || 0}
                  </div>
                  <p className="text-xs text-teal-600">
                    Este período
                  </p>
                </div>
                <div className="bg-teal-500 rounded-2xl p-3 shadow-sm">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Tendencia de Ventas - Ancho completo */}
        <div className="modern-card p-5 lg:p-6 hover-lift">
          <SalesChart 
            selectedPeriod={selectedPeriod} 
            filterType={filterType}
            salesperson={user?.salespersonName}
          />
        </div>

        {/* Clientes del Vendedor con Acordeones */}
        {salespersonName && (
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <SalespersonClientsPanel 
              salespersonName={salespersonName}
              selectedPeriod={selectedPeriod}
              filterType={filterType}
              showSearchToggle={true}
              showLoadMore={true}
              accordionState={accordionState}
            />
          </div>
        )}

        {/* Productos del Vendedor con Acordeones */}
        {salespersonName && (
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <SalespersonProductsPanel 
              salespersonName={salespersonName}
              selectedPeriod={selectedPeriod}
              filterType={filterType}
              showSearchToggle={true}
              showLoadMore={true}
              accordionState={accordionState}
            />
          </div>
        )}

        {/* Tabla de Transacciones */}
        <div className="modern-card p-5 lg:p-6 hover-lift">
          <TransactionsTable 
            selectedPeriod={selectedPeriod} 
            filterType={filterType}
            salesperson={user?.salespersonName}
          />
        </div>
      </main>

      {/* Diálogo de Clientes */}
      <Dialog open={showClientsDialog} onOpenChange={setShowClientsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Clientes del Vendedor
            </DialogTitle>
            
            {/* BUSCADOR - Ahora dentro del DialogHeader para máxima visibilidad */}
            <div className="w-full bg-blue-100 border-4 border-blue-500 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-6 w-6 text-blue-700" />
                <span className="text-base font-bold text-blue-900">BUSCAR CLIENTE</span>
              </div>
              <input
                type="text"
                placeholder="Escriba nombre o RUT del cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-blue-400 rounded-md focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
                style={{ fontSize: '16px' }}
              />
            </div>
            
            <div className="text-sm text-gray-600">
              Mostrando {clients.filter((client: any) => {
                const clientName = (client.clientName || client.name || '').toLowerCase();
                return clientName.includes(clientSearch.toLowerCase());
              }).length} clientes
            </div>
          </DialogHeader>
          
          <div className="mt-4">
            {loadingClients ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay clientes en este período
              </div>
            ) : clients.filter((client: any) => {
                const clientName = (client.clientName || client.name || '').toLowerCase();
                return clientName.includes(clientSearch.toLowerCase());
              }).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron clientes con "{clientSearch}"
              </div>
            ) : (
              <div className="grid gap-3">
                {clients
                  .filter((client: any) => {
                    const clientName = (client.clientName || client.name || '').toLowerCase();
                    return clientName.includes(clientSearch.toLowerCase());
                  })
                  .map((client: any, index: number) => (
                  <Card 
                    key={index} 
                    className="hover:shadow-md transition-shadow border-l-4 border-l-green-500"
                    data-testid={`client-card-${index}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900" data-testid={`client-name-${index}`}>
                            {client.clientName || client.name || 'Sin nombre'}
                          </h3>
                          {client.segment && (
                            <Badge variant="outline" className="mt-1">
                              {client.segment}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Ventas Totales</p>
                            <p className="font-bold text-blue-600" data-testid={`client-sales-${index}`}>
                              {formatCurrency(client.totalSales || 0)}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Transacciones</p>
                            <p className="font-bold text-green-600" data-testid={`client-transactions-${index}`}>
                              {client.transactionCount || 0}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Ticket Prom.</p>
                            <p className="font-bold text-purple-600">
                              {formatCurrency((client.totalSales || 0) / (client.transactionCount || 1))}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Última Compra</p>
                            <p className="font-bold text-orange-600 text-xs">
                              {client.lastPurchaseDate ? new Date(client.lastPurchaseDate).toLocaleDateString('es-CL') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}