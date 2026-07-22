import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useFilter } from "@/contexts/FilterContext";
import KPICards from "@/components/dashboard/kpi-cards";
import SalesProjectionCard from "@/components/dashboard/sales-projection-card";
import SalesChart from "@/components/dashboard/sales-chart";
import TopProductsChart from "@/components/dashboard/top-products-chart";
import SegmentChart from "@/components/dashboard/segment-chart";
import SalespersonChart from "@/components/dashboard/salesperson-chart";
import ComunasChart from "@/components/dashboard/comunas-chart";
import TopClientsPanel from "@/components/dashboard/top-clients-panel";
import FletesPanel from "@/components/dashboard/fletes-panel";
import TopSalespeoplePanel from "@/components/dashboard/top-salespeople-panel";
import TransactionsTable from "@/components/dashboard/transactions-table";
import GoalsProgress from "@/components/dashboard/goals-progress";
import PackagingSalesMetrics from "@/components/dashboard/packaging-sales-metrics";
import PackagingUnitsMetrics from "@/components/dashboard/packaging-units-metrics";
import SalespersonDetail from "@/pages/salesperson-detail";
import SegmentDetail from "@/pages/segment-detail";
import SucursalDetail from "@/pages/sucursal-detail";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import ComparativeKPICards from "@/components/dashboard/comparative-kpi-cards";
import ComparativeAccumulatedTotal from "@/components/dashboard/comparative-accumulated-total";
import ComparativeSegmentTable from "@/components/dashboard/comparative-segment-table";
import ComparativeSalespeopleTable from "@/components/dashboard/comparative-salespeople-table";
import ComparativeProductsTable from "@/components/dashboard/comparative-products-table";
import ComparativePackagingTable from "@/components/dashboard/comparative-packaging-table";
import SalespersonPendingNVV from "@/components/dashboard/salesperson-pending-nvv";
import SalespersonPendingGDV from "@/components/dashboard/salesperson-pending-gdv";
import PendingDocumentsUnified from "@/components/dashboard/pending-documents-unified";
import ProductGroupedSelector from "@/components/dashboard/product-grouped-selector";
import ProductInsightsPanel from "@/components/dashboard/product-insights-panel";
import { Button } from "@/components/ui/button";
import { CardWrapper } from "@/components/dashboard/CardWrapper";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Filter, Target, Building, Users, TrendingUp, Settings2, X, Eye, AlertCircle, DollarSign, ChevronDown, ShoppingCart, Truck, Search, Check, ChevronsUpDown, Menu, Database, Package, Zap, Loader2, RefreshCw, CheckCircle, XCircle, Clock, Download, AlertTriangle } from "lucide-react";

// Banner del Dashboard que le muestra al Encargado de Área a qué sucursales está
// acotado lo que ve. Hace explícita la "traducción" de las asignaciones de scope.
// Solo aparece para encargado_area CON sucursales asignadas; el resto no ve nada.
function ScopeBanner() {
  const { data } = useQuery<{
    role: string | null;
    scoped: boolean;
    branches: Array<{ koen: string | null; nokoen: string; branchLabel: string | null }>;
  }>({
    queryKey: ["/api/me/scope"],
    staleTime: 60_000,
  });
  if (!data || data.role !== "encargado_area" || !data.scoped) return null;
  const names = data.branches.map((b) => b.branchLabel || b.nokoen);
  const shown = names.slice(0, 8);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <Building className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Estás viendo datos de <span className="font-semibold">{data.branches.length}</span> sucursal(es):{" "}
        <span className="font-medium">{shown.join(", ")}</span>
        {extra > 0 && <span> +{extra} más</span>}.
      </p>
    </div>
  );
}
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import panoramicaLogo from "@assets/Diseno-sin-titulo-12-1-e1733933035809_1759422274944.webp";
import { Progress } from "@/components/ui/progress";

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "months" | "day" | "days" | "custom-range";
  month?: number;
  months?: number[];
  days?: number[];
  startDate?: Date;
  endDate?: Date;
  display: string;
}

export function CollapsibleNVVSection({ salesperson }: { salesperson: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="modern-card hover-lift overflow-hidden">
      <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" data-testid="trigger-nvv-collapsible">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 rounded-full p-2">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notas de Venta Pendientes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pedidos por entregar</p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <SalespersonPendingNVV salesperson={salesperson} applyPeriodFilter={false} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CollapsibleGDVSection({ salesperson }: { salesperson: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="modern-card hover-lift overflow-hidden">
      <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" data-testid="trigger-gdv-collapsible">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500 rounded-full p-2">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Guías de Despacho Pendientes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Guías por facturar</p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <SalespersonPendingGDV salesperson={salesperson} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Use global filter context
  const { selection, setSelection, globalFilter, setGlobalFilter } = useFilter();

  // Derived values from selection for backward compatibility
  const selectedPeriod = (() => {
    if ((selection.period === "month" || selection.period === "months") && selection.months && selection.months.length > 0) {
      const year = selection.years[0];
      const month = selection.months[0]; // Already in 1-12 format from YearMonthSelector
      return `${year}-${String(month).padStart(2, '0')}`;
    } else if (selection.period === "full-year") {
      return `${selection.years[0]}-01`; // Placeholder for year view
    } else if (selection.period === "day" && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      // For day selection, use months array (not month singular)
      const month = selection.months && selection.months.length > 0 ? selection.months[0] : 1;
      const day = selection.days[0];
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (selection.period === "days" && selection.days && selection.days.length > 0) {
      // Rango de días → se comporta como un período agregado (rango de fechas),
      // no como comparativa día-a-día. Formato que espera el backend para "range".
      const year = selection.years[0];
      const month = selection.months && selection.months.length > 0 ? selection.months[0] : 1;
      const mm = String(month).padStart(2, '0');
      const sortedDays = [...selection.days].sort((a, b) => a - b);
      const firstDay = String(sortedDays[0]).padStart(2, '0');
      const lastDay = String(sortedDays[sortedDays.length - 1]).padStart(2, '0');
      return `${year}-${mm}-${firstDay}_${year}-${mm}-${lastDay}`;
    } else if (selection.period === "custom-range") {
      return "custom-range";
    }
    return format(new Date(), "yyyy-MM");
  })();

  const filterType: "day" | "month" | "year" | "range" = (() => {
    if (selection.period === "day") return "day";
    // Un rango de días se trata como período agregado (range), no como comparativa.
    if (selection.period === "days") return "range";
    if (selection.period === "month" || selection.period === "months") return "month";
    if (selection.period === "full-year") return "year";
    if (selection.period === "custom-range") return "range";
    return "month";
  })();

  // Helper function to check if we're viewing the current month
  const isCurrentMonth = (): boolean => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    if (filterType === "month" && selectedPeriod.match(/^\d{4}-\d{2}$/)) {
      return selectedPeriod === currentMonthStr;
    }

    // For day filter, check if the day is in the current month
    if (filterType === "day" && selectedPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return selectedPeriod.startsWith(currentMonthStr);
    }

    // For year filter or range, don't show NVV (only current month matters)
    return false;
  };

  const selectedDate = (() => {
    if ((selection.period === "day" || selection.period === "days") && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      // For day selection, use months array (not month singular), subtract 1 for Date object
      const month = selection.months && selection.months.length > 0 ? selection.months[0] - 1 : 0;
      const day = selection.days[0];
      return new Date(year, month, day);
    }
    return new Date();
  })();

  const selectedYear = selection.years[0];

  const dateRange: DateRange | undefined = (() => {
    if (selection.period === "custom-range" && selection.startDate && selection.endDate) {
      return { from: selection.startDate, to: selection.endDate };
    }
    // Rango de días → rango de fechas real para las vistas embebidas (detalle vendedor/sucursal/segmento).
    if (selection.period === "days" && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      const month = (selection.months && selection.months.length > 0 ? selection.months[0] : 1) - 1;
      const sortedDays = [...selection.days].sort((a, b) => a - b);
      return {
        from: new Date(year, month, sortedDays[0]),
        to: new Date(year, month, sortedDays[sortedDays.length - 1]),
      };
    }
    return undefined;
  })();

  // Filter selector state
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  // Client search state
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");

  // Comparison period state
  const [comparePeriod, setComparePeriod] = useState<string>("none");

  // Clients panel view (top vs nuevos)
  const [clientsPanelView, setClientsPanelView] = useState<"top" | "new">("top");
  const handleShowNewClientsInPanel = () => {
    setClientsPanelView("new");
    // Scroll to the clients panel after state update + render
    requestAnimationFrame(() => {
      const el = document.getElementById("top-clients-panel");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  // Detect comparative mode (multiple periods selected)
  const isComparativeMode = (() => {
    // Multiple months selected
    if (selection.period === "months" && selection.months && selection.months.length > 1) return true;
    // Multiple years with month(s) selected (mes-a-año comparison)
    if ((selection.period === "month" || selection.period === "months") && selection.years.length > 1) return true;
    // Nota: un rango de días NO entra en comparativa; se trata como período agregado (range).
    // Multiple years with full-year view
    if (selection.years.length > 1 && selection.period === "full-year") return true;
    return false;
  })();

  // Generate list of periods for comparative mode
  const comparativePeriods = (() => {
    if (!isComparativeMode) return [];

    const periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }> = [];

    // Multiple months (can be with single or multiple years)
    if ((selection.period === "month" || selection.period === "months") && selection.months) {
      selection.months.forEach(month => {
        selection.years.forEach(year => {
          // month is already 1-12, use it directly for the period string
          // but subtract 1 for Date object (which expects 0-11)
          const monthName = format(new Date(year, month - 1), "MMM yyyy");
          periods.push({
            period: `${year}-${String(month).padStart(2, '0')}`,
            label: monthName,
            filterType: "month"
          });
        });
      });
    } else if (selection.years.length > 1 && selection.period === "full-year") {
      selection.years.forEach(year => {
        periods.push({
          period: `${year}`,
          label: `${year}`,
          filterType: "year"
        });
      });
    }

    return periods;
  })();

  // ═══════════════════════════════════════════════
  // CONSOLIDATED INIT — pre-fetches critical data in 1 HTTP call
  // Pre-seeds query caches so child components (KPICards) don't make separate requests
  // ═══════════════════════════════════════════════
  const segment = globalFilter.type === "segment" ? globalFilter.value : undefined;
  const salespersonFilter = globalFilter.type === "salesperson" ? globalFilter.value : undefined;
  const clientFilter = globalFilter.type === "client" && globalFilter.value ? globalFilter.value : undefined;
  const productFilter = globalFilter.type === "product" ? globalFilter.value : undefined;
  const branchFilter = globalFilter.type === "branch" ? globalFilter.value : undefined;

  // El vendedor entra al mismo Dashboard del admin pero se auto-bloquea a su propio
  // filtro (ver useEffect "Auto-configure salesperson view"). Hasta que ese bloqueo se
  // aplique, el filtro global está en "all" → evitamos renderizar contenido o disparar
  // fetches a nivel empresa que mostrarían/filtrarían datos de toda la compañía.
  const salespersonLockPending = user?.role === 'salesperson' && globalFilter.type !== 'salesperson';

  const { data: dashboardInit } = useQuery({
    queryKey: ["/api/dashboard/init", selectedPeriod, filterType, segment, salespersonFilter, clientFilter, productFilter, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salespersonFilter) params.append('salesperson', salespersonFilter);
      if (clientFilter) params.append('client', clientFilter);
      if (productFilter) params.append('product', productFilter);
      if (branchFilter) params.append('branch', branchFilter);
      const res = await fetch(`/api/dashboard/init?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data = await res.json();

      // Pre-seed individual query caches so KPICards doesn't re-fetch
      if (data.bestYear) {
        queryClient.setQueryData(
          ['/api/sales/best-year', segment, salespersonFilter, clientFilter],
          data.bestYear
        );
      }
      if (data.availablePeriods) {
        queryClient.setQueryData(["/api/sales/available-periods"], data.availablePeriods);
      }
      if (data.yearlyTotals) {
        // Calculate endDateStr the same way KPICards does
        const today = new Date();
        const ytdEndDateStr = today.toISOString().split('T')[0];
        queryClient.setQueryData(
          ['/api/sales/yearly-totals', segment, salespersonFilter, clientFilter, productFilter, ytdEndDateStr],
          data.yearlyTotals
        );
      }

      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: !salespersonLockPending,
  });

  // Use pre-fetched availablePeriods from consolidated init
  const availablePeriods = dashboardInit?.availablePeriods;

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
    enabled: filterType === "month" && !salespersonLockPending, // Only fetch for month view
  });

  // Query to fetch pending expenses (estado = "pendiente")
  const { data: pendingExpenses = [] } = useQuery<any[]>({
    queryKey: ['/api/gastos-empresariales', 'pendiente'],
    queryFn: async () => {
      const res = await fetch('/api/gastos-empresariales?estado=pendiente', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Subtle refresh functionality state (Old implementation, kept for backward compatibility if needed)
  const [lastUpdated, setLastUpdated] = useState<string | null>(() =>
    localStorage.getItem('dashboard-last-updated')
  );

  // ETL sync state using mutation pointing to sync-all
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isSyncAllRunning, setIsSyncAllRunning] = useState(false);
  const [isCancellingSync, setIsCancellingSync] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Stock breaks modal state
  const [showStockBreaksModal, setShowStockBreaksModal] = useState(false);

  // Poll sync-all status while modal is open
  useEffect(() => {
    if (!showSyncModal) return;
    let emptyPolls = 0;
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest('/api/etl/sync-all/status');
        const data = await res.json();
        // Sin estado y sin ejecución en curso = el servidor se reinició a mitad
        // de la sincronización (antes el modal quedaba en 0% para siempre).
        // Se toleran 3 polls (~6s) porque el POST inicial puede demorar en
        // inicializar el estado en el servidor.
        if (!data.etls) {
          emptyPolls++;
          if (!data.isRunning && emptyPolls >= 3) {
            setIsSyncAllRunning(false);
            clearInterval(interval);
            toast({
              title: '❌ Sincronización interrumpida',
              description: 'El servidor se reinició durante la sincronización. Intenta nuevamente.',
              variant: 'destructive',
            });
            setShowSyncModal(false);
          }
          return;
        }
        emptyPolls = 0;
        setSyncStatus(data.etls);
        if (!data.isRunning) {
          setIsSyncAllRunning(false);
          // Refresh all dashboard queries to fetch the fresh data immediately
          queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
          queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
          queryClient.invalidateQueries({ queryKey: ['/api/nvv'] });
          queryClient.invalidateQueries({ queryKey: ['/api/gdv'] });
          clearInterval(interval);
        }
      } catch (err) {
        // Ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [showSyncModal]);

  // Fetch last sync timestamp
  const { data: lastSyncInfo } = useQuery<{ createdAt?: string; completedAt?: string }>({
    queryKey: ['/api/etl/sync-sales/status'],
    refetchInterval: 60000,
  });

  // Poll del estado del servidor para reflejar una sync en curso aunque la
  // haya iniciado otra pestaña u otro admin. Antes el botón quedaba habilitado
  // (estado solo local) y al hacer click devolvía 409 "ya hay una sincronización
  // en ejecución". Mientras el modal está abierto, ese efecto ya hace el polling.
  const { data: syncAllServerStatus } = useQuery<{ isRunning?: boolean }>({
    queryKey: ['/api/etl/sync-all/status'],
    refetchInterval: 20000,
    enabled: !showSyncModal,
  });
  const serverSyncRunning = !!syncAllServerStatus?.isRunning;
  const syncBusy = isSyncAllRunning || serverSyncRunning;

  // Stock breaks query - lightweight, fetches on demand
  const { data: stockBreaks, isLoading: isLoadingStockBreaks, error: stockBreaksError } = useQuery<{
    summary: { totalLinea: number; conQuiebre: number; warehouses: string[]; relevantWarehouses?: string[] };
    items: {
      sku: string;
      producto: string;
      formato: string;
      bodegas: { nombre: string; stock: number; isRelevant?: boolean }[];
      hasQuiebre: boolean;
      stockTotal: number;
    }[];
  }>({
    queryKey: ['/api/dashboard/stock-breaks'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stock-breaks', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: showStockBreaksModal,
    staleTime: 5 * 60 * 1000,
  });

  const lastSyncDate = lastSyncInfo?.completedAt || lastSyncInfo?.createdAt;
  const lastSyncLabel = lastSyncDate ? (() => {
    const syncDate = new Date(lastSyncDate);
    const diff = Date.now() - syncDate.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    // More than 24h: show the actual date/time
    return syncDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  })() : null;

  const handleSyncAll = async () => {
    try {
      setIsSyncAllRunning(true);
      setSyncStatus(null);
      setShowSyncModal(true); // Open modal immediately
      await apiRequest('/api/etl/sync-all', { method: 'POST' });
      // Start polling right away
      try {
        const res = await apiRequest('/api/etl/sync-all/status');
        const data = await res.json();
        setSyncStatus(data.etls);
      } catch { }
    } catch (error: any) {
      setIsSyncAllRunning(false);
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo iniciar la sincronización",
        variant: "destructive",
      });
      setShowSyncModal(false);
    }
  };

  // Cancelar la sync en curso (libera el candado del server para poder
  // relanzarla manualmente cuando demora demasiado).
  const handleCancelSync = async () => {
    if (isCancellingSync) return;
    try {
      setIsCancellingSync(true);
      await apiRequest('/api/etl/sync-all/cancel', { method: 'POST' });
      setIsSyncAllRunning(false);
      setShowSyncModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/etl/sync-all/status'] });
      toast({
        title: "🛑 Sincronización cancelada",
        description: "Podés volver a ejecutarla cuando quieras.",
      });
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo cancelar la sincronización",
        variant: "destructive",
      });
    } finally {
      setIsCancellingSync(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (selectedPeriod) params.set('period', selectedPeriod);
      if (filterType) params.set('filterType', filterType);
      if (globalFilter.type === 'segment' && globalFilter.value) params.set('segment', globalFilter.value);
      if (globalFilter.type === 'salesperson' && globalFilter.value) params.set('salesperson', globalFilter.value);
      if (globalFilter.type === 'client' && globalFilter.value) params.set('client', globalFilter.value);
      if (globalFilter.type === 'branch' && globalFilter.value) params.set('branch', globalFilter.value);

      const res = await fetch(`/api/sales/export-csv?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Error al exportar');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `ventas_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: '✅ Exportación completa',
        description: 'El archivo Excel se ha descargado correctamente',
      });
    } catch (error: any) {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo exportar el archivo Excel',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to render ETL status row in the modal
  const renderETLRow = (label: string, etlStatus: any) => {
    const status = etlStatus?.status || 'pending';
    const progress = etlStatus?.progress || 0;
    const progressMessage = etlStatus?.progressMessage || '';
    return (
      <div className="p-4 rounded-lg border bg-card space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === 'done' && <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />}
            {status === 'running' && <Loader2 className="h-6 w-6 animate-spin text-orange-500 flex-shrink-0" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />}
            {status === 'pending' && <Clock className="h-6 w-6 text-gray-400 flex-shrink-0" />}
            <div>
              <p className="font-semibold">{label}</p>
              <p className={`text-sm ${status === 'done' ? 'text-green-600' : status === 'error' ? 'text-red-600' : status === 'running' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                {status === 'done' && `✅ ${(etlStatus.recordsProcessed || 0).toLocaleString()} registros en ${((etlStatus.executionTimeMs || 0) / 1000).toFixed(1)}s`}
                {status === 'running' && (progressMessage || 'Procesando datos desde SQL Server...')}
                {status === 'error' && (etlStatus.error || 'Error en la ejecución')}
                {status === 'pending' && 'Esperando turno...'}
              </p>
            </div>
          </div>
          <Badge className={`
            ${status === 'done' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
            ${status === 'running' ? 'bg-orange-100 text-orange-700 border-orange-300' : ''}
            ${status === 'error' ? 'bg-red-100 text-red-700 border-red-300' : ''}
            ${status === 'pending' ? 'bg-gray-100 text-gray-500 border-gray-300' : ''}
          `}>
            {status === 'done' && 'Listo'}
            {status === 'running' && `${progress}%`}
            {status === 'error' && 'Error'}
            {status === 'pending' && 'Pendiente'}
          </Badge>
        </div>
        {status === 'running' && (
          <Progress value={progress} className="h-2" />
        )}
      </div>
    );
  };

  // Mobile detection and drawer state
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Local state for drawer filters (before applying)
  const [localSelection, setLocalSelection] = useState(selection);
  const [localSelectedFilter, setLocalSelectedFilter] = useState(selectedFilter);
  const [localGlobalFilter, setLocalGlobalFilter] = useState(globalFilter);
  const [localComparePeriod, setLocalComparePeriod] = useState(comparePeriod);

  // Get current location from wouter
  const [currentLocation] = useLocation();

  // Read URL parameters and update filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam === 'segment') {
      setSelectedFilter('segment');
      setGlobalFilter({ type: 'segment', value: undefined });
    } else if (filterParam === 'salesperson') {
      setSelectedFilter('salesperson');
      setGlobalFilter({ type: 'salesperson', value: undefined });
    } else if (filterParam === 'branch') {
      setSelectedFilter('branch');
      setGlobalFilter({ type: 'branch', value: undefined });
    }
  }, [currentLocation, setGlobalFilter]);

  // Update local state when drawer opens
  const handleDrawerOpen = () => {
    setLocalSelection(selection);
    setLocalSelectedFilter(selectedFilter);
    setLocalGlobalFilter(globalFilter);
    setLocalComparePeriod(comparePeriod);
    setIsDrawerOpen(true);
  };

  // Apply drawer filters to main state
  const handleApplyFilters = () => {
    setSelection(localSelection);
    setSelectedFilter(localSelectedFilter);
    setGlobalFilter(localGlobalFilter);
    setComparePeriod(localComparePeriod);
    setIsDrawerOpen(false);
  };

  // Clear all filters
  const handleClearFilters = () => {
    const now = new Date();
    setLocalSelection({
      years: [now.getFullYear()],
      period: "month",
      months: [now.getMonth() + 1], // Convert to 1-12 format array
      display: format(now, "MMMM yyyy")
    });
    setLocalSelectedFilter("all");
    setLocalGlobalFilter({ type: "all", value: "" });
    setLocalComparePeriod("none");
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
        case "segment":
          vistaText = globalFilter.value ? `Segmento: ${globalFilter.value}` : "Por segmento";
          break;
        case "branch":
          vistaText = globalFilter.value ? `Sucursal: ${globalFilter.value}` : "Por sucursal";
          break;
        case "salesperson":
          vistaText = globalFilter.value ? `Vendedor: ${globalFilter.value}` : "Por vendedor";
          break;
        case "client":
          vistaText = globalFilter.value ? `Cliente: ${globalFilter.value}` : "Por cliente";
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
    staleTime: 5 * 60 * 1000, // 5 min — segments rarely change
  });

  const { data: salespeople } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople", selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: selectedPeriod,
        filterType
      });
      const response = await fetch(`/api/goals/data/salespeople?${params}`);
      if (!response.ok) throw new Error('Failed to fetch salespeople');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Fetch clients for the filter dropdown (top 100 clients by sales)
  const { data: clients } = useQuery<{ items: Array<{ clientName: string; totalSales: number }> }>({
    queryKey: ["/api/sales/top-clients", selectedPeriod, filterType, 100],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: selectedPeriod,
        filterType,
        limit: "100"
      });
      const response = await fetch(`/api/sales/top-clients?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    }
  });

  // Search clients in the entire database
  const { data: searchedClients, isLoading: isSearchingClients } = useQuery<Array<{ koen: string; nokoen: string }>>({
    queryKey: ["/api/clients/search", clientSearchTerm],
    queryFn: async () => {
      if (!clientSearchTerm || clientSearchTerm.length < 2) return [];
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(clientSearchTerm)}`);
      if (!response.ok) throw new Error('Failed to search clients');
      return response.json();
    },
    enabled: clientSearchTerm.length >= 2,
    staleTime: 30000,
  });

  // Sync local filter state with globalFilter changes
  useEffect(() => {
    setSelectedFilter(globalFilter.type);
  }, [globalFilter.type]);

  // Helper function to convert old filter format to new YearMonthSelection format
  const convertToSelection = (
    filterType: "day" | "month" | "year" | "range",
    period: string,
    date?: Date,
    year?: number,
    range?: { from?: Date; to?: Date }
  ): YearMonthSelection => {
    if (filterType === "day" && date) {
      return {
        years: [date.getFullYear()],
        period: "day",
        months: [date.getMonth() + 1], // Convert to 1-12 format for months array
        days: [date.getDate()],
        display: format(date, "dd/MM/yyyy")
      };
    } else if (filterType === "year" && year) {
      return {
        years: [year],
        period: "full-year",
        display: year.toString()
      };
    } else if (filterType === "range" && range?.from && range?.to) {
      return {
        years: [range.from.getFullYear()],
        period: "custom-range",
        startDate: range.from,
        endDate: range.to,
        display: `${format(range.from, "dd/MM/yyyy")} - ${format(range.to, "dd/MM/yyyy")}`
      };
    } else if (filterType === "month" && period) {
      // Parse period format "YYYY-MM"
      const [yearStr, monthStr] = period.split("-");
      const parsedYear = parseInt(yearStr);
      const parsedMonth = parseInt(monthStr); // Keep as 1-12 format
      return {
        years: [parsedYear],
        period: "month",
        months: [parsedMonth], // Use months array in 1-12 format
        display: format(new Date(parsedYear, parsedMonth - 1), "MMMM yyyy")
      };
    }

    // Fallback to current month
    const now = new Date();
    return {
      years: [now.getFullYear()],
      period: "month",
      months: [now.getMonth() + 1], // Convert to 1-12 format for months array
      display: format(now, "MMMM yyyy")
    };
  };

  // Fetch last file upload timestamp for sales data
  const { data: lastFileUpload } = useQuery({
    queryKey: ["/api/files/last-upload", "sales"],
    queryFn: () => fetch('/api/files/last-upload?fileType=sales').then(res => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch last upload');
      return res.json();
    }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
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

  // selectedPeriod and filterType are now derived from selection state automatically
  // No need for manual sync effect

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

  // Convert singular comparePeriod to array format for SalesChart
  const convertToComparisonPeriods = (comparePeriod: string, selectedPeriod: string, filterType: string) => {
    if (!comparePeriod || comparePeriod === "none") return undefined;

    const comparisonOptions = generateComparisonOptions();
    const option = comparisonOptions.find(opt => opt.value === comparePeriod);

    if (!option) return undefined;

    // Calculate the actual period based on comparison type
    let calculatedPeriod = selectedPeriod;
    let calculatedFilterType = filterType;

    // For special comparison values, calculate the actual period
    if (filterType === "month" && comparePeriod === "same-month-last-year") {
      // e.g., "2025-09" -> "2024-09"
      if (selectedPeriod.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = selectedPeriod.split('-');
        calculatedPeriod = `${parseInt(year) - 1}-${month}`;
      }
    } else if (filterType === "month" && comparePeriod === "previous-month") {
      // e.g., "2025-09" -> "2025-08"
      if (selectedPeriod.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = selectedPeriod.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() - 1);
        calculatedPeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    } else if (filterType === "year" && comparePeriod === "previous-year") {
      // e.g., "2025" -> "2024"
      if (selectedPeriod.match(/^\d{4}$/)) {
        calculatedPeriod = `${parseInt(selectedPeriod) - 1}`;
      }
    }

    return [{
      period: calculatedPeriod,
      label: option.label,
      filterType: calculatedFilterType
    }];
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

  // Auto-configure salesperson view when a salesperson logs in.
  // Un vendedor SIEMPRE queda bloqueado a su propia vista: mientras globalFilter.type
  // no sea 'salesperson', el dashboard muestra "Cargando tu panel..." (salespersonLockPending).
  // globalFilter se persiste en localStorage, así que el tipo inicial puede venir en
  // cualquier valor previo ('client', etc.). Por eso hay que re-bloquear ante CUALQUIER
  // tipo distinto de 'salesperson', no solo 'all'; antes, un filtro persistido como
  // 'client' dejaba el gate colgado para siempre.
  useEffect(() => {
    if (user && user.role === 'salesperson' && globalFilter.type !== 'salesperson') {
      // Nombre del vendedor: preferir salespersonName; si falta, armarlo con lo que
      // haya de nombre/apellido (uno solo basta) para no dejar el gate colgado.
      const salespersonName = user.salespersonName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined;
      if (salespersonName) {
        setGlobalFilter({ type: 'salesperson', value: salespersonName });
        setSelectedFilter('salesperson');
      }
    }
  }, [user, globalFilter.type]);

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

  // Event listener to reset dashboard (triggered from mobile header logo or sidebar logo)
  useEffect(() => {
    const handleResetDashboard = () => {
      setGlobalFilter({ type: "all" });
      setSelectedFilter("all");
    };

    window.addEventListener('reset-dashboard', handleResetDashboard);
    return () => {
      window.removeEventListener('reset-dashboard', handleResetDashboard);
    };
  }, [setGlobalFilter, setSelectedFilter]);

  const handleDateFilterChange = (
    newFilterType: "day" | "month" | "year" | "range",
    newPeriod: string,
    newDate?: Date,
    newYear?: number,
    newRange?: { from?: Date; to?: Date }
  ) => {
    const newSelection = convertToSelection(newFilterType, newPeriod, newDate, newYear, newRange);
    setSelection(newSelection);
  };

  // Determine back navigation handler generic
  const handleGenericBack = () => {
    if (globalFilter.type === "salesperson" && user?.role === 'salesperson') {
      // Salesperson cannot navigate back
      return;
    }
    setGlobalFilter({ type: "all" });
    setSelectedFilter("all");
  };

  // Si hay un cliente seleccionado, mostrar el dashboard filtrado por cliente
  // (no usa componente embedido, usa los mismos componentes del dashboard principal con filtro de cliente)
  const selectedClient = globalFilter.type === "client" && globalFilter.value ? globalFilter.value : undefined;

  // Vendedor: no renderizar el contenido (que por defecto es la vista "all" a nivel
  // empresa) hasta que el filtro se bloquee a su propio vendedor.
  if (salespersonLockPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando tu panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Banner de scope para el Encargado de Área (sucursales asignadas) */}
      <ScopeBanner />
      {/* Mobile Header with Logo, Menu and ETL Button */}
      {isMobile && (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <button
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('reset-dashboard'));
                setLocation('/');
              }}
            >
              <img
                src={panoramicaLogo}
                alt="Panoramica"
                className="h-10 w-auto object-contain cursor-pointer"
              />
            </button>

            {/* Actions: Filters Menu */}
            <div className="flex items-center gap-2">

              {/* Filters Menu Button */}
              <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDrawerOpen}
                    className="h-9 px-2.5 rounded-lg border-gray-200 dark:border-gray-700"
                    data-testid="button-mobile-menu"
                  >
                    <Menu className="h-4 w-4 text-gray-600 dark:text-gray-400" />
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
                    {/* Vista Section - PRIMERO — oculto para vendedores (ver nota en header desktop) */}
                    {user?.role !== 'salesperson' && (
                    <>
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
                                setLocalGlobalFilter({ type: "all", value: "" });
                              } else if (value === "segment") {
                                setLocalGlobalFilter({ type: "segment", value: "" });
                              } else if (value === "branch") {
                                setLocalGlobalFilter({ type: "branch", value: "" });
                              } else if (value === "salesperson") {
                                setLocalGlobalFilter({ type: "salesperson", value: "" });
                              } else if (value === "client") {
                                setLocalGlobalFilter({ type: "client", value: "" });
                              } else if (value === "product") {
                                setLocalGlobalFilter({ type: "product", value: "" });
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
                              <SelectItem value="segment">
                                <div className="flex items-center space-x-2">
                                  <Building className="h-4 w-4 text-green-500" />
                                  <span>Por segmento</span>
                                </div>
                              </SelectItem>
                              {/* Temporalmente oculto
                              <SelectItem value="branch">
                                <div className="flex items-center space-x-2">
                                  <Building className="h-4 w-4 text-blue-500" />
                                  <span>Por sucursal</span>
                                </div>
                              </SelectItem>
                              */}
                              <SelectItem value="salesperson">
                                <div className="flex items-center space-x-2">
                                  <Users className="h-4 w-4 text-purple-500" />
                                  <span>Por vendedor</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="client">
                                <div className="flex items-center space-x-2">
                                  <Users className="h-4 w-4 text-orange-500" />
                                  <span>Por cliente</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="product">
                                <div className="flex items-center space-x-2">
                                  <Package className="h-4 w-4 text-teal-500" />
                                  <span>Por producto</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(localSelectedFilter === "segment" || localSelectedFilter === "branch" || localSelectedFilter === "salesperson") && (
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">
                              {localSelectedFilter === "segment" ? "Segmento específico" : localSelectedFilter === "branch" ? "Sucursal específica" : "Vendedor específico"}
                            </label>
                            <Select
                              key={localSelectedFilter}
                              value={(localGlobalFilter.type === localSelectedFilter && localGlobalFilter.value) ? localGlobalFilter.value : ""}
                              onValueChange={(value) => {
                                const trimmedValue = value.trim();
                                if (localSelectedFilter === "segment") {
                                  setLocalGlobalFilter({ type: "segment", value: trimmedValue });
                                } else if (localSelectedFilter === "branch") {
                                  setLocalGlobalFilter({ type: "branch", value: trimmedValue });
                                } else if (localSelectedFilter === "salesperson") {
                                  setLocalGlobalFilter({ type: "salesperson", value: trimmedValue });
                                }
                              }}
                            >
                              <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                                <SelectValue placeholder={
                                  localSelectedFilter === "segment" ? "Selecciona segmento" : localSelectedFilter === "branch" ? "Selecciona sucursal" : "Selecciona vendedor"
                                } />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-gray-200 max-h-60 overflow-y-auto">
                                {localSelectedFilter === "segment" ? (
                                  segments?.map((segment) => (
                                    <SelectItem key={segment} value={segment}>
                                      {segment}
                                    </SelectItem>
                                  ))
                                ) : localSelectedFilter === "branch" ? (
                                  ["CONCEPCION", "TEMUCO"].map((branch) => (
                                    <SelectItem key={branch} value={branch}>
                                      {branch}
                                    </SelectItem>
                                  ))
                                ) : (
                                  salespeople?.map((salesperson) => (
                                    <SelectItem key={salesperson.trim()} value={salesperson.trim()}>
                                      {salesperson.trim()}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {localSelectedFilter === "client" && (
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">
                              Buscar cliente
                            </label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                              <Input
                                type="text"
                                inputMode="search"
                                autoComplete="off"
                                autoCorrect="off"
                                placeholder="Buscar por nombre..."
                                value={clientSearchTerm}
                                onChange={(e) => setClientSearchTerm(e.target.value)}
                                onFocus={(e) => {
                                  setTimeout(() => {
                                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 300);
                                }}
                                className="h-11 pl-10 pr-10 w-full rounded-xl border-gray-200 text-base"
                                style={{ fontSize: '16px' }}
                                data-testid="input-mobile-client-search"
                              />
                              {clientSearchTerm && (
                                <button
                                  onClick={() => setClientSearchTerm("")}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  data-testid="button-clear-mobile-search"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            {clientSearchTerm.length >= 2 && (
                              <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white">
                                {isSearchingClients ? (
                                  <div className="p-3 text-center text-sm text-gray-500">
                                    Buscando...
                                  </div>
                                ) : searchedClients && searchedClients.length > 0 ? (
                                  <div className="py-1">
                                    {searchedClients.map((client) => (
                                      <button
                                        key={client.koen}
                                        onClick={() => {
                                          setLocalGlobalFilter({ type: "client", value: client.nokoen });
                                          setClientSearchTerm("");
                                        }}
                                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${localGlobalFilter.value === client.nokoen ? 'bg-blue-50' : ''
                                          }`}
                                        data-testid={`mobile-client-result-${client.koen}`}
                                      >
                                        <span className="text-sm text-gray-900 truncate">{client.nokoen}</span>
                                        {localGlobalFilter.value === client.nokoen && (
                                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-3 text-center text-sm text-gray-500">
                                    No se encontraron clientes
                                  </div>
                                )}
                              </div>
                            )}

                            {clientSearchTerm.length > 0 && clientSearchTerm.length < 2 && (
                              <p className="mt-2 text-xs text-gray-500">Escribe al menos 2 caracteres</p>
                            )}

                            {localGlobalFilter.type === "client" && localGlobalFilter.value && (
                              <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                <span className="text-sm text-blue-900 truncate flex-1">{localGlobalFilter.value}</span>
                                <button
                                  onClick={() => setLocalGlobalFilter({ type: "client", value: undefined })}
                                  className="ml-2 text-blue-600 hover:text-blue-800"
                                  data-testid="button-clear-selected-client"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}

                            {!localGlobalFilter.value && clients?.items && clients.items.length > 0 && clientSearchTerm.length < 2 && (
                              <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">Clientes con más ventas:</p>
                                <div className="flex flex-wrap gap-2">
                                  {clients.items.slice(0, 6).map((client: any) => (
                                    <button
                                      key={client.clientName}
                                      onClick={() => setLocalGlobalFilter({ type: "client", value: client.clientName })}
                                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 truncate max-w-[150px]"
                                      data-testid={`mobile-top-client-${client.clientName}`}
                                    >
                                      {client.clientName}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {localSelectedFilter === "product" && (
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">
                              Producto
                            </label>
                            <ProductGroupedSelector
                              value={localGlobalFilter.type === "product" ? localGlobalFilter.value : undefined}
                              onChange={(v) => setLocalGlobalFilter({ type: "product", value: v })}
                              triggerClassName="w-full h-11 rounded-xl"
                            />
                            {localGlobalFilter.type === "product" && localGlobalFilter.value && (
                              <div className="mt-3 flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                                <span className="text-sm text-teal-900 truncate flex-1">{localGlobalFilter.value}</span>
                                <button
                                  onClick={() => setLocalGlobalFilter({ type: "product", value: undefined })}
                                  className="ml-2 text-teal-600 hover:text-teal-800"
                                  data-testid="button-clear-selected-product"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />
                    </>
                    )}

                    {/* Período Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Período de tiempo</span>
                      </div>

                      <YearMonthSelector
                        value={localSelection}
                        onChange={setLocalSelection}
                      />
                    </div>
                  </div>

                  <DrawerFooter className="border-t pt-4 mt-4">
                    <Button
                      onClick={handleApplyFilters}
                      className="w-full h-12 text-base font-medium rounded-xl"
                      data-testid="button-apply-filters"
                    >
                      Aplicar filtros
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsDrawerOpen(false)}
                      className="w-full h-11 text-base rounded-xl"
                      data-testid="button-cancel-filters"
                    >
                      Cancelar
                    </Button>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
          </div>

          {/* Active filters badges below header */}
          <div className="mt-2 flex flex-col gap-1.5">
            {/* Filter type badge - only show if not "all" */}
            {globalFilter.value && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs font-medium text-green-800 truncate">
                  {selectedFilter === "segment" && `Segmento: ${globalFilter.value}`}
                  {selectedFilter === "branch" && `Sucursal: ${globalFilter.value}`}
                  {selectedFilter === "salesperson" && `Vendedor: ${globalFilter.value}`}
                  {selectedFilter === "client" && `Cliente: ${globalFilter.value}`}
                  {selectedFilter === "product" && `Producto: ${globalFilter.value}`}
                </span>
              </div>
            )}

            {/* Period badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <CalendarIcon className="h-3 w-3 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-medium text-blue-800">
                {selection.display}
              </span>
            </div>
          </div>
        </header>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200/60 dark:border-gray-800 px-3 sm:px-4 lg:px-6 py-5 lg:py-6 m-2 sm:m-4 rounded-2xl shadow-sm">
          {/* Desktop Layout */}
          <div className="space-y-4 w-full">
            {/* All filters in one line */}
            <div className="flex items-center gap-3">
              {/* Vista — oculto para vendedores: las vistas del top-bar
                  (producto/cliente/segmento/vendedor) son a nivel empresa y NO están
                  limitadas a sus datos. El vendedor filtra por producto/cliente dentro
                  de su propia vista (SalespersonDetail), ya scopeada a su nombre. */}
              {user?.role !== 'salesperson' && (
              <>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vista:</span>
                <Select
                  value={selectedFilter}
                  onValueChange={(value) => {
                    setSelectedFilter(value);
                    if (value === "all") {
                      setGlobalFilter({ type: "all", value: "" });
                    } else if (value === "segment") {
                      setGlobalFilter({ type: "segment", value: "" });
                    } else if (value === "branch") {
                      setGlobalFilter({ type: "branch", value: "" });
                    } else if (value === "salesperson") {
                      setGlobalFilter({ type: "salesperson", value: "" });
                    } else if (value === "client") {
                      setGlobalFilter({ type: "client", value: "" });
                    } else if (value === "product") {
                      setGlobalFilter({ type: "product", value: "" });
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-48 rounded-lg border-gray-200 dark:border-gray-700 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-gray-200 dark:border-gray-700" sideOffset={4}>
                    <SelectItem value="all">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                        <span>Todo el dashboard</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="segment">
                      <div className="flex items-center space-x-2">
                        <Building className="h-3.5 w-3.5 text-green-500" />
                        <span>Por segmento</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="branch">
                      <div className="flex items-center space-x-2">
                        <Building className="h-3.5 w-3.5 text-blue-500" />
                        <span>Por sucursal</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="salesperson">
                      <div className="flex items-center space-x-2">
                        <Users className="h-3.5 w-3.5 text-purple-500" />
                        <span>Por vendedor</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="client">
                      <div className="flex items-center space-x-2">
                        <Users className="h-3.5 w-3.5 text-orange-500" />
                        <span>Por cliente</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="product">
                      <div className="flex items-center space-x-2">
                        <Package className="h-3.5 w-3.5 text-teal-500" />
                        <span>Por producto</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Segment/Branch/Salesperson selector - shown conditionally */}
              {(selectedFilter === "segment" || selectedFilter === "branch" || selectedFilter === "salesperson") && (
                <div className="flex items-center gap-2" key={`specific-selector-${selectedFilter}`}>
                  <span className="text-sm font-medium text-gray-700">
                    {selectedFilter === "segment" ? "Segmento:" : selectedFilter === "branch" ? "Sucursal:" : "Vendedor:"}
                  </span>
                  <Select
                    key={selectedFilter}
                    value={(globalFilter.type === selectedFilter && globalFilter.value) ? globalFilter.value : ""}
                    onValueChange={(value) => {
                      if (selectedFilter === "segment") {
                        setGlobalFilter({ type: "segment", value });
                      } else if (selectedFilter === "branch") {
                        setGlobalFilter({ type: "branch", value });
                      } else if (selectedFilter === "salesperson") {
                        setGlobalFilter({ type: "salesperson", value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm">
                      <SelectValue placeholder={selectedFilter === "segment" ? "Selecciona segmento" : selectedFilter === "branch" ? "Selecciona sucursal" : "Selecciona vendedor"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto" sideOffset={4}>
                      {selectedFilter === "segment" ? (
                        segments?.map((segment) => (
                          <SelectItem key={segment} value={segment}>
                            {segment}
                          </SelectItem>
                        ))
                      ) : selectedFilter === "branch" ? (
                        ["CONCEPCION", "TEMUCO"].map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
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

              {/* Client selector with search - separate component */}
              {selectedFilter === "client" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Cliente:</span>
                  <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientSearchOpen}
                        className="h-9 w-64 justify-between rounded-lg border-gray-200 text-sm font-normal"
                        data-testid="button-client-search"
                      >
                        {globalFilter.type === "client" && globalFilter.value
                          ? globalFilter.value
                          : "Buscar cliente..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar cliente por nombre..."
                          value={clientSearchTerm}
                          onValueChange={setClientSearchTerm}
                          data-testid="input-client-search"
                        />
                        <CommandList>
                          {clientSearchTerm.length < 2 ? (
                            <CommandEmpty>Escribe al menos 2 caracteres para buscar...</CommandEmpty>
                          ) : isSearchingClients ? (
                            <CommandEmpty>Buscando clientes...</CommandEmpty>
                          ) : searchedClients && searchedClients.length > 0 ? (
                            <CommandGroup heading="Resultados de búsqueda">
                              {searchedClients.map((client) => (
                                <CommandItem
                                  key={client.koen}
                                  value={client.nokoen}
                                  onSelect={(value) => {
                                    setGlobalFilter({ type: "client", value: client.nokoen });
                                    setClientSearchOpen(false);
                                    setClientSearchTerm("");
                                  }}
                                  data-testid={`client-option-${client.koen}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${globalFilter.value === client.nokoen ? "opacity-100" : "opacity-0"
                                      }`}
                                  />
                                  {client.nokoen}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ) : (
                            <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                          )}
                          {clients?.items && clients.items.length > 0 && clientSearchTerm.length < 2 && (
                            <CommandGroup heading="Clientes con más ventas">
                              {clients.items.slice(0, 10).map((client) => (
                                <CommandItem
                                  key={client.clientName}
                                  value={client.clientName}
                                  onSelect={(value) => {
                                    setGlobalFilter({ type: "client", value: client.clientName });
                                    setClientSearchOpen(false);
                                  }}
                                  data-testid={`top-client-option-${client.clientName}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${globalFilter.value === client.clientName ? "opacity-100" : "opacity-0"
                                      }`}
                                  />
                                  {client.clientName}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Product selector grouped by commercial category */}
              {selectedFilter === "product" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Producto:</span>
                  <ProductGroupedSelector
                    value={globalFilter.type === "product" ? globalFilter.value : undefined}
                    onChange={(v) => setGlobalFilter({ type: "product", value: v })}
                  />
                </div>
              )}
              </>
              )}

              {/* Período */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">Período:</span>
                <YearMonthSelector
                  value={selection}
                  onChange={(val) => val && setSelection(val)}
                />
              </div>
              {/* Stock breaks button */}
              <div className="flex-shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowStockBreaksModal(true)}
                  className="h-9 w-9 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors rounded-lg border-gray-200 dark:border-gray-700 relative"
                  data-testid="button-stock-breaks"
                  title="Información importante — Quiebres de stock"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </Button>
              </div>
              {/* Sync button + last sync badge */}
              <div className="flex-shrink-0 relative">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={syncBusy ? handleCancelSync : handleSyncAll}
                  disabled={isCancellingSync}
                  className={`group h-9 w-9 transition-colors rounded-lg border-gray-200 dark:border-gray-700 ${syncBusy ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'}`}
                  data-testid="button-desktop-sync-all"
                  title={syncBusy ? 'Sincronización en curso — clic para cancelar' : (lastSyncDate ? `Última sync: ${new Date(lastSyncDate).toLocaleString('es-CL')}` : 'Sincronizar todo')}
                >
                  {isCancellingSync ? (
                    <Loader2 className="h-4 w-4 text-red-500 animate-spin" />
                  ) : syncBusy ? (
                    <>
                      {/* En reposo gira el spinner; al pasar el mouse aparece la X para cancelar */}
                      <Loader2 className="h-4 w-4 text-orange-500 animate-spin group-hover:hidden" />
                      <X className="hidden h-4 w-4 text-red-500 group-hover:block" />
                    </>
                  ) : (
                    <Zap className="h-4 w-4 text-orange-500" />
                  )}
                </Button>
                {lastSyncLabel && (
                  <span className="absolute -top-2 -right-2 bg-gray-100 text-gray-500 text-[8px] font-medium px-1.5 py-0.5 rounded-full border border-gray-200 whitespace-nowrap pointer-events-none" title={lastSyncDate ? new Date(lastSyncDate).toLocaleString('es-CL') : ''}>
                    {lastSyncLabel}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleExportCsv}
                  disabled={isExporting}
                  className="h-9 w-9 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors rounded-lg border-gray-200 dark:border-gray-700"
                  data-testid="button-desktop-export-csv"
                  title="Exportar Excel"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 text-green-500 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 text-green-500" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-3 sm:space-y-4 lg:space-y-6 relative">

        {/* Specific Custom Views */}
        {globalFilter.type === "segment" && globalFilter.value ? (
          <SegmentDetail
            key={globalFilter.value}
            segmentName={globalFilter.value}
            embedded={true}
            onBack={handleGenericBack}
            onSegmentChange={(val) => setGlobalFilter({ type: "segment", value: val })}
            onDateFilterChange={handleDateFilterChange}
            dashboardGlobalFilter={globalFilter}
            dashboardFilterType={filterType}
            dashboardSelectedPeriod={selectedPeriod}
            dashboardSelectedDate={selectedDate}
            dashboardSelectedYear={selectedYear}
            dashboardDateRange={dateRange}
          />
        ) : globalFilter.type === "branch" && globalFilter.value ? (
          <SucursalDetail
            key={globalFilter.value}
            branchName={globalFilter.value}
            embedded={true}
            onBack={handleGenericBack}
            onBranchChange={(val) => setGlobalFilter({ type: "branch", value: val })}
            onDateFilterChange={handleDateFilterChange}
            dashboardGlobalFilter={globalFilter}
            dashboardFilterType={filterType}
            dashboardSelectedPeriod={selectedPeriod}
            dashboardSelectedDate={selectedDate}
            dashboardSelectedYear={selectedYear}
            dashboardDateRange={dateRange}
          />
        ) : globalFilter.type === "salesperson" && globalFilter.value ? (
          <SalespersonDetail
            key={globalFilter.value}
            salespersonName={globalFilter.value}
            embedded={true}
            onBack={user?.role !== 'salesperson' ? handleGenericBack : undefined}
            onSalespersonChange={(val) => setGlobalFilter({ type: "salesperson", value: val })}
            onDateFilterChange={handleDateFilterChange}
            dashboardGlobalFilter={globalFilter}
            dashboardFilterType={filterType}
            dashboardSelectedPeriod={selectedPeriod}
            dashboardSelectedDate={selectedDate}
            dashboardSelectedYear={selectedYear}
            dashboardDateRange={dateRange}
          />
        ) : globalFilter.type === "product" && globalFilter.value ? (
          <ProductInsightsPanel
            key={globalFilter.value}
            productName={globalFilter.value}
            selectedPeriod={selectedPeriod}
            filterType={filterType}
          />
        ) : isComparativeMode ? (
          <>
            {/* Total Acumulado - arriba de los gráficos */}
            <ComparativeAccumulatedTotal
              periods={comparativePeriods}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              client={selectedClient ?? undefined}
            />

            {/* Comparative KPI Cards con gráficos */}
            <div>
              <ComparativeKPICards
                periods={comparativePeriods}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                client={selectedClient ?? undefined}
              />
            </div>

            {/* Evolución de Ventas por Segmento */}
            {globalFilter.type === "all" && (
              <ComparativeSegmentTable periods={comparativePeriods} />
            )}

            {/* Evolución de Ventas por Vendedor */}
            {globalFilter.type === "all" && (
              <ComparativeSalespeopleTable periods={comparativePeriods} />
            )}

            {/* Comparative Products Table */}
            {globalFilter.type === "all" && (
              <ComparativeProductsTable periods={comparativePeriods} />
            )}

            {/* Comparative Packaging Table */}
            {globalFilter.type === "all" && (
              <ComparativePackagingTable periods={comparativePeriods} />
            )}
          </>
        ) : (
          <>
            {/* Standard Dashboard Layout */}
            {/* KPI Cards with Modern Styling */}
            <div>
              <KPICards
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                client={selectedClient}
                product={globalFilter.type === "product" ? globalFilter.value : undefined}
                comparePeriod={comparePeriod}
                onShowNewClients={handleShowNewClientsInPanel}
              />
            </div>

            {/* Goals Progress Dashboard - Solo mostrar si hay metas asignadas */}
            {filterType === "month" && goalsProgress && Array.isArray(goalsProgress) && goalsProgress.length > 0 && (
              <CardWrapper>
                <GoalsProgress
                  globalFilter={globalFilter}
                  selectedPeriod={selectedPeriod}
                />
              </CardWrapper>
            )}

            {/* Documentos Pendientes (NVV + GDV) - Siempre mostrar en dashboard principal */}
            {!selectedClient && globalFilter.type !== "product" && (
              <PendingDocumentsUnified
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              />
            )}

            {/* Primary Analytics - Sales Chart Full Width - Solo mostrar para meses y rangos */}
            {filterType !== "day" && (
              <CardWrapper>
                <SalesChart
                  selectedPeriod={selectedPeriod}
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                  product={globalFilter.type === "product" ? globalFilter.value : undefined}
                  comparisonPeriods={convertToComparisonPeriods(comparePeriod, selectedPeriod, filterType)}
                />
              </CardWrapper>
            )}

            {/* Ventas por Segmento - Full Width Chart - Mostrar arriba, solo en dashboard principal */}
            {globalFilter.type === "all" && (
              <CardWrapper>
                <SegmentChart
                  selectedPeriod={selectedPeriod}
                  filterType={filterType}
                  onSegmentClick={(segmentName) => {
                    setGlobalFilter({ type: "segment", value: segmentName });
                    setSelectedFilter("segment");
                  }}
                />
              </CardWrapper>
            )}

            {/* Ventas por Vendedor - Cuando hay un segmento seleccionado */}
            {globalFilter.type === "segment" && globalFilter.value && (
              <CardWrapper>
                <SalespersonChart
                  selectedPeriod={selectedPeriod}
                  filterType={filterType}
                  segment={globalFilter.value}
                  onSalespersonClick={(name) => {
                    setGlobalFilter({ type: "salesperson", value: name });
                    setSelectedFilter("salesperson");
                  }}
                />
              </CardWrapper>
            )}

            {/* Products Chart - Ocultar cuando hay filtro de producto */}
            {globalFilter.type !== "product" && (
              <CardWrapper>
                <TopProductsChart
                  selectedPeriod={selectedPeriod}
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                />
              </CardWrapper>
            )}

            {/* Sales Team & Client Analytics - Full Width Column */}
            <CardWrapper>
              <TopSalespeoplePanel
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                client={selectedClient}
                product={globalFilter.type === "product" ? globalFilter.value : undefined}
              />
            </CardWrapper>

            {!selectedClient && (
              <CardWrapper>
                <TopClientsPanel
                  selectedPeriod={selectedPeriod}
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                  product={globalFilter.type === "product" ? globalFilter.value : undefined}
                  view={clientsPanelView}
                  onViewChange={setClientsPanelView}
                />
              </CardWrapper>
            )}

            {/* Fletes - respeta filtros */}
            {globalFilter.type !== "product" && (
              <CardWrapper>
                <FletesPanel
                  selectedPeriod={selectedPeriod}
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                />
              </CardWrapper>
            )}

            {/* Packaging Metrics - Full Width - Ocultar cuando hay filtro de producto */}
            {globalFilter.type !== "product" && (
              <CardWrapper>
                <PackagingSalesMetrics
                  selectedPeriod={selectedPeriod}
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                />
              </CardWrapper>
            )}

            {/* Transactions - Full Width - Only in non-comparative mode */}
            <CardWrapper>
              <TransactionsTable
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                client={selectedClient}
                product={globalFilter.type === "product" ? globalFilter.value : undefined}
              />
            </CardWrapper>
          </>
        )}
      </main>

      {/* ═══ Sync All Modal — Real-time per-ETL status ═══ */}
      <Dialog open={showSyncModal} onOpenChange={(open) => { if (!isSyncAllRunning) setShowSyncModal(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className={`h-5 w-5 ${isSyncAllRunning ? 'animate-spin text-orange-500' : 'text-green-600'}`} />
              Sincronización Manual
            </DialogTitle>
            <DialogDescription>
              {isSyncAllRunning ? 'Importando datos desde SQL Server...' : 'Resultado de la importación'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {renderETLRow('Ventas Incremental', syncStatus?.ventas)}
            {renderETLRow('Guías de Despacho (GDV)', syncStatus?.gdv)}
            {renderETLRow('Notas de Venta (NVV)', syncStatus?.nvv)}
          </div>

          {!isSyncAllRunning && syncStatus?.completedAt && (
            <div className="flex justify-between items-center pt-2 border-t text-sm">
              <span className="text-muted-foreground">Total registros</span>
              <span className="font-bold text-lg">{(syncStatus.totalRecords || 0).toLocaleString()}</span>
            </div>
          )}

          <DialogFooter>
            {isSyncAllRunning ? (
              <Button
                onClick={handleCancelSync}
                disabled={isCancellingSync}
                variant="destructive"
                data-testid="button-cancel-sync"
              >
                {isCancellingSync ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelando…</>
                ) : (
                  <><X className="h-4 w-4 mr-2" /> Cancelar sincronización</>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setShowSyncModal(false)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Breaks Modal */}
      <Dialog open={showStockBreaksModal} onOpenChange={setShowStockBreaksModal}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Información importante
            </DialogTitle>
            <DialogDescription>
              Quiebres de stock de productos de línea — productos con stock 0 en bodegas clave: <strong>Concepción, Del Sur, Productos Terminados y Santiago</strong>.
            </DialogDescription>
          </DialogHeader>

          {isLoadingStockBreaks ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <span className="ml-3 text-muted-foreground">Consultando stock…</span>
            </div>
          ) : stockBreaksError ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <XCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">Error al consultar quiebres de stock. Intenta nuevamente.</p>
            </div>
          ) : stockBreaks ? (
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Productos de línea</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stockBreaks.summary.totalLinea.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-center">
                  <p className="text-[11px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Con quiebre</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{stockBreaks.summary.conQuiebre.toLocaleString()}</p>
                </div>
              </div>

              {/* Items grouped by warehouse */}
              {stockBreaks.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
                  <p className="font-semibold text-green-700 dark:text-green-400">Sin quiebres de stock</p>
                  <p className="text-sm text-muted-foreground">Todos los productos de línea tienen stock en las bodegas evaluadas.</p>
                </div>
              ) : (() => {
                // Group products by relevant warehouse with zero stock
                const relevantWarehouses = stockBreaks.summary.relevantWarehouses || [];
                const warehouseGroups: { warehouse: string; products: typeof stockBreaks.items }[] = [];

                for (const rw of relevantWarehouses) {
                  const productsInQuiebre = stockBreaks.items.filter(item => {
                    const bodega = item.bodegas.find(b => b.nombre.toUpperCase().trim() === rw.toUpperCase());
                    return bodega !== undefined && bodega.stock <= 0;
                  });
                  if (productsInQuiebre.length > 0) {
                    warehouseGroups.push({ warehouse: rw, products: productsInQuiebre });
                  }
                }

                return (
                  <div className="overflow-auto max-h-[50vh] space-y-4">
                    {warehouseGroups.map(group => (
                      <div key={group.warehouse} className="rounded-lg border overflow-hidden">
                        {/* Warehouse header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-900/20 dark:to-amber-900/20 border-b">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                              {group.warehouse}
                            </h4>
                          </div>
                          <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700 text-xs px-2">
                            {group.products.length} {group.products.length === 1 ? 'producto sin stock' : 'productos sin stock'}
                          </Badge>
                        </div>
                        {/* Products table for this warehouse */}
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50/80 dark:bg-gray-800/40">
                            <tr>
                              <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                              <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Producto</th>
                              <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Formato</th>
                              <th className="text-center px-3 py-1.5 text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Stock</th>
                              <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stock Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {group.products.map((item, idx) => {
                              const bodega = item.bodegas.find(b => b.nombre.toUpperCase().trim() === group.warehouse.toUpperCase());
                              const stockInWarehouse = bodega ? Math.round(bodega.stock) : 0;
                              return (
                                <tr key={`${group.warehouse}-${item.sku}-${idx}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                  <td className="px-3 py-1.5 font-mono text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.sku}</td>
                                  <td className="px-3 py-1.5 text-xs max-w-[250px] truncate" title={item.producto}>{item.producto}</td>
                                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{item.formato}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                      {stockInWarehouse}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">{Math.round(item.stockTotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : null}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowStockBreaksModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
