import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, UserCheck, CalendarIcon, Target, Eye, Building, Home, Download, Search, X, UserPlus, RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, parse, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useFilter } from "@/contexts/FilterContext";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import ComparativeSegmentSalespeopleTable from "@/components/dashboard/comparative-segment-salespeople-table";
import ComparativeSegmentTable from "@/components/dashboard/comparative-segment-table";
import SegmentPendingNVV from "@/components/dashboard/segment-pending-nvv";
import PackagingSalesMetrics from "@/components/dashboard/packaging-sales-metrics";
import TopClientsPanel from "@/components/dashboard/top-clients-panel";

interface SegmentClient {
  clientName: string;
  salespersonName: string;
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

interface SegmentProduct {
  productName: string;
  totalSales: number;
  totalQuantity: number;
  transactionCount: number;
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
  
  // Local state for view type
  const [selectedView, setSelectedView] = useState<"all" | "segmento" | "vendedor">("segmento");
  
  // State for showing more clients
  const [showAllClients, setShowAllClients] = useState(false);
  
  // Search state for clients
  const [isClientSearchExpanded, setIsClientSearchExpanded] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [clientLimit, setClientLimit] = useState(10);
  const [expandedClient, setExpandedClient] = useState<string>("");
  
  // Search state for salespeople
  const [isSalespersonSearchExpanded, setIsSalespersonSearchExpanded] = useState(false);
  const [salespersonSearchTerm, setSalespersonSearchTerm] = useState("");
  const [debouncedSalespersonSearch, setDebouncedSalespersonSearch] = useState("");
  const [salespersonLimit, setSalespersonLimit] = useState(10);
  const [expandedSalesperson, setExpandedSalesperson] = useState<string>("");
  
  // State for products
  const [productLimit, setProductLimit] = useState(10);
  const [expandedProduct, setExpandedProduct] = useState<string>("");
  
  // Debounce client search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearch(clientSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchTerm]);
  
  // Debounce salesperson search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSalespersonSearch(salespersonSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [salespersonSearchTerm]);
  
  // Ref to store scroll position
  const scrollPositionRef = useRef<number>(0);
  const shouldRestoreScrollRef = useRef<boolean>(false);
  
  // Debug: Log cuando cambia la selección
  useEffect(() => {
    console.log("🔄 [segment-detail] useEffect - selection changed:", {
      period: selection.period,
      months: selection.months,
      years: selection.years,
      display: selection.display
    });
    
    // Save scroll position before re-render
    scrollPositionRef.current = window.scrollY;
    shouldRestoreScrollRef.current = true;
  }, [selection]);
  
  // Restore scroll position after render
  useEffect(() => {
    if (shouldRestoreScrollRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollPositionRef.current,
          behavior: 'auto' // instant scroll, no smooth animation
        });
        shouldRestoreScrollRef.current = false;
      });
    }
  });
  
  // Handler for selection changes that notifies dashboard when embedded
  const handleSelectionChange = (newSelection: typeof selection | null) => {
    if (!newSelection) return;
    console.log("🔍 [segment-detail] handleSelectionChange called:", newSelection);
    console.trace("📍 Stack trace de handleSelectionChange");
    setSelection(newSelection);
    
    // NOTE: We no longer notify dashboard via onDateFilterChange when embedded
    // because segment-detail now uses FilterContext directly, which is shared with dashboard.
    // Calling onDateFilterChange would cause a second setSelection call that loses multi-period data.
  };
  
  // Use dashboard props when embedded, otherwise derive from selection
  const selectedPeriod = embedded && dashboardSelectedPeriod ? dashboardSelectedPeriod : (() => {
    if ((selection.period === "month" || selection.period === "months") && selection.months && selection.months.length > 0) {
      const year = selection.years[0];
      const month = selection.months[0]; // Already in 1-12 format
      return `${year}-${String(month).padStart(2, '0')}`;
    } else if (selection.period === "full-year") {
      return `${selection.years[0]}-01`;
    } else if ((selection.period === "day" || selection.period === "days") && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      // For day selection, use months array (not month singular)
      const month = selection.months && selection.months.length > 0 ? selection.months[0] : 1;
      const day = selection.days[0];
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (selection.period === "custom-range") {
      return "custom-range";
    }
    return format(new Date(), "yyyy-MM");
  })();
  
  const filterType: "day" | "month" | "year" | "range" = embedded && dashboardFilterType ? dashboardFilterType : (() => {
    if (selection.period === "day" || selection.period === "days") return "day";
    if (selection.period === "month" || selection.period === "months") return "month";
    if (selection.period === "full-year") return "year";
    if (selection.period === "custom-range") return "range";
    return "month";
  })();
  
  const selectedDate = embedded && dashboardSelectedDate ? dashboardSelectedDate : (() => {
    if ((selection.period === "day" || selection.period === "days") && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      // For day selection, use months array (not month singular), subtract 1 for Date object
      const month = selection.months && selection.months.length > 0 ? selection.months[0] - 1 : 0;
      const day = selection.days[0];
      return new Date(year, month, day);
    }
    return new Date();
  })();
  
  const selectedYear = embedded && dashboardSelectedYear ? dashboardSelectedYear : selection.years[0];
  
  const dateRange = embedded && dashboardDateRange ? dashboardDateRange : (() => {
    if (selection.period === "custom-range" && selection.startDate && selection.endDate) {
      return { from: selection.startDate, to: selection.endDate };
    }
    return undefined;
  })();

  // Detect comparative mode (multiple periods selected) - use useMemo to recalculate when selection changes
  const isComparativeMode = useMemo(() => {
    console.log("🔍 [segment-detail] Detectando modo comparativo:", {
      period: selection.period,
      monthsLength: selection.months?.length,
      daysLength: selection.days?.length,
      yearsLength: selection.years.length,
      selection
    });
    if (selection.period === "months" && selection.months && selection.months.length > 1) {
      console.log("✅ Modo comparativo: múltiples meses");
      return true;
    }
    if (selection.period === "days" && selection.days && selection.days.length > 1) {
      console.log("✅ Modo comparativo: múltiples días");
      return true;
    }
    if (selection.years.length > 1 && selection.period === "full-year") {
      console.log("✅ Modo comparativo: múltiples años");
      return true;
    }
    console.log("❌ NO modo comparativo");
    return false;
  }, [selection]);

  // Generate list of periods for comparative mode - use useMemo to recalculate when dependencies change
  const comparativePeriods = useMemo(() => {
    if (!isComparativeMode) {
      console.log("⏭️ [segment-detail] NO comparative mode, retornando array vacío");
      return [];
    }
    
    console.log("📊 [segment-detail] Generando períodos comparativos...", { 
      period: selection.period,
      months: selection.months,
      years: selection.years,
      isComparativeMode 
    });
    const periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }> = [];
    
    // Comparativa mes-a-año: cuando hay múltiples años Y múltiples meses
    if (selection.period === "months" && selection.months && selection.months.length > 1 && selection.years.length > 1) {
      console.log("🔄 Caso: múltiples meses Y múltiples años");
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
      console.log("📅 Caso: múltiples meses en un solo año:", { year, months: selection.months });
      selection.months.forEach(month => {
        const monthStr = String(month).padStart(2, '0');
        const period = `${year}-${monthStr}`;
        const label = format(new Date(year, month - 1), "MMMM yyyy", { locale: es });
        periods.push({ period, label, filterType: "month" });
        console.log("  ➕ Agregado:", { period, label });
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
    
    console.log("✅ [segment-detail] Períodos comparativos generados:", periods);
    return periods;
  }, [selection, isComparativeMode]);

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

  // Fetch all segments for dropdown - use general list to ensure stability
  const { data: allSegments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
  });
  
  // Fetch segments with data for current period (for reference, not for dropdown)
  const { data: segmentData } = useQuery<SegmentData[]>({
    queryKey: ['/api/sales/segments', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/segments?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Fetch all salespeople for dropdown when switching views
  const { data: allSalespeople } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
  });

  // Paginated top clients (default view - no search)
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<SegmentClient[]>({
    queryKey: ['/api/sales/segment', segmentName, 'clients', selectedPeriod, filterType, clientLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', clientLimit.toString());
      const res = await fetch(`/api/sales/segment/${segmentName}/clients?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!segmentName && debouncedClientSearch.length < 2,
  });

  // Client search results
  const { data: clientSearchResults = [], isLoading: isClientSearchLoading } = useQuery<SegmentClient[]>({
    queryKey: ['/api/clients/search', debouncedClientSearch, selectedPeriod, filterType, segmentName],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', debouncedClientSearch);
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('segment', segmentName || '');
      const res = await fetch(`/api/clients/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const results = await res.json();
      // Transform search results to match SegmentClient format
      return results.map((c: any) => ({
        clientName: c.name,
        salespersonName: c.salespersonName || '',
        totalSales: c.totalSales,
        transactionCount: c.transactionCount,
        averageTicket: c.transactionCount > 0 ? c.totalSales / c.transactionCount : 0,
        percentage: 0 // Will be calculated below
      }));
    },
    enabled: !!segmentName && debouncedClientSearch.length >= 2,
  });

  // Paginated top salespeople (default view - no search)
  const { data: salespeople = [], isLoading: isLoadingSalespeople } = useQuery<SegmentSalesperson[]>({
    queryKey: ['/api/sales/segment', segmentName, 'salespeople', selectedPeriod, filterType, salespersonLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', salespersonLimit.toString());
      const res = await fetch(`/api/sales/segment/${segmentName}/salespeople?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!segmentName && debouncedSalespersonSearch.length < 2,
  });

  // Salesperson search results
  const { data: salespersonSearchResults = [], isLoading: isSalespersonSearchLoading } = useQuery<SegmentSalesperson[]>({
    queryKey: ['/api/salespeople/search', debouncedSalespersonSearch, selectedPeriod, filterType, segmentName],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', debouncedSalespersonSearch);
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('segment', segmentName || '');
      const res = await fetch(`/api/salespeople/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const results = await res.json();
      // Transform search results to match SegmentSalesperson format
      return results.map((sp: any) => ({
        salespersonName: sp.name,
        totalSales: sp.totalSales,
        transactionCount: sp.transactionCount,
        averageTicket: sp.transactionCount > 0 ? sp.totalSales / sp.transactionCount : 0,
        percentage: 0 // Will be calculated below
      }));
    },
    enabled: !!segmentName && debouncedSalespersonSearch.length >= 2,
  });

  // Top products for segment
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<SegmentProduct[]>({
    queryKey: ['/api/sales/top-products', segmentName, selectedPeriod, filterType, productLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('segment', segmentName || '');
      params.append('limit', productLimit.toString());
      const res = await fetch(`/api/sales/top-products?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const response = await res.json();
      // The endpoint returns { items: [...], periodTotalSales, totalCount }
      const data = response.items || [];
      // Calculate percentages based on max sales
      const maxSales = data.length > 0 ? Math.max(...data.map((p: any) => p.totalSales)) : 1;
      return data.map((p: any) => ({
        productName: p.productName,
        totalSales: p.totalSales,
        totalQuantity: p.totalUnits || p.totalQuantity || 0,
        transactionCount: p.transactionCount || 0,
        percentage: (p.totalSales / maxSales) * 100
      }));
    },
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

  // Fetch client recurrence data (new vs recurring clients)
  const { data: clientRecurrence, isLoading: isLoadingRecurrence, isError: isRecurrenceError } = useQuery<{ recurringCount: number; newCount: number }>({
    queryKey: ['/api/sales/segment', segmentName, 'client-recurrence', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/segment/${encodeURIComponent(segmentName || '')}/client-recurrence?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!segmentName,
    retry: 2,
  });

  // Fetch NVV metrics for segment (for combined total in goals)
  const { data: nvvMetrics } = useQuery<{
    totalAmount: number;
    pendingCount: number;
  }>({
    queryKey: ['/api/nvv/metrics', 'segment', segmentName],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('segment', segmentName || '');
      const res = await fetch(`/api/nvv/metrics?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!segmentName && filterType === 'month',
  });

  // Fetch GDV metrics for segment (for combined total in goals)
  const { data: gdvMetrics } = useQuery<{
    gdvSales: number;
    gdvCount: number;
  }>({
    queryKey: ['/api/sales/gdv-pending', 'segment', segmentName],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('segment', segmentName || '');
      const res = await fetch(`/api/sales/gdv-pending?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!segmentName && filterType === 'month',
  });

  // NVV and GDV totals for combined progress
  const nvvTotal = nvvMetrics?.totalAmount || 0;
  const gdvTotal = gdvMetrics?.gdvSales || 0;

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

  // Format currency for CSV (CLP with thousands separator as point, no decimals)
  const formatCurrencyCSV = (amount: number) => {
    return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

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

  // Determine which client data to display (search results or paginated list)
  const displayClients = debouncedClientSearch.length >= 2 ? clientSearchResults : clients;
  const currentClientLoading = debouncedClientSearch.length >= 2 ? isClientSearchLoading : isLoadingClients;
  
  // Determine which salesperson data to display (search results or paginated list)
  const displaySalespeople = debouncedSalespersonSearch.length >= 2 ? salespersonSearchResults : salespeople;
  const currentSalespersonLoading = debouncedSalespersonSearch.length >= 2 ? isSalespersonSearchLoading : isLoadingSalespeople;

  // Handlers for search
  const handleClearClientSearch = () => {
    setClientSearchTerm("");
    setDebouncedClientSearch("");
    setIsClientSearchExpanded(false);
  };

  const handleClearSalespersonSearch = () => {
    setSalespersonSearchTerm("");
    setDebouncedSalespersonSearch("");
    setIsSalespersonSearchExpanded(false);
  };

  const handleLoadMoreClients = () => {
    setClientLimit(prev => prev + 10);
  };

  const handleLoadMoreSalespeople = () => {
    setSalespersonLimit(prev => prev + 10);
  };

  // Export data to CSV
  const exportSegmentDataToCSV = async () => {
    const csvData = [];
    
    // Add header
    csvData.push(['REPORTE DE SEGMENTO - ' + segmentName]);
    csvData.push(['Período: ' + selection.display]);
    csvData.push(['Generado: ' + format(new Date(), "dd/MM/yyyy HH:mm")]);
    csvData.push([]); // Empty row
    
    // KPIs Summary
    csvData.push(['RESUMEN GENERAL']);
    csvData.push(['Total Ventas', formatCurrencyCSV(totalSales)]);
    csvData.push(['Total Clientes', totalClients]);
    csvData.push(['Total Vendedores', totalSalespeople]);
    csvData.push(['Total Transacciones', totalTransactions]);
    csvData.push(['Ticket Promedio', Math.round(averageTicket)]);
    csvData.push([]); // Empty row
    
    // Clients data
    csvData.push(['CLIENTES DEL SEGMENTO']);
    csvData.push(['Cliente', 'Vendedor', 'Total Ventas', 'Transacciones', 'Ticket Promedio', 'Porcentaje']);
    clients.forEach(client => {
      csvData.push([
        client.clientName,
        client.salespersonName || '',
        formatCurrencyCSV(client.totalSales),
        client.transactionCount,
        Math.round(client.averageTicket),
        client.percentage.toFixed(2) + '%'
      ]);
    });
    csvData.push([]); // Empty row
    
    // Salespeople data
    csvData.push(['VENDEDORES DEL SEGMENTO']);
    csvData.push(['Vendedor', 'Total Ventas', 'Transacciones', 'Ticket Promedio', 'Porcentaje']);
    salespeople.forEach(salesperson => {
      csvData.push([
        salesperson.salespersonName,
        formatCurrencyCSV(salesperson.totalSales),
        salesperson.transactionCount,
        Math.round(salesperson.averageTicket),
        salesperson.percentage.toFixed(2) + '%'
      ]);
    });
    csvData.push([]); // Empty row
    
    // Monthly breakdown if year is selected
    if (filterType === 'year' && selectedPeriod) {
      try {
        const year = selectedPeriod.split('-')[0]; // Extract year from period
        const response = await fetch(`/api/sales/segment/${segmentName}/monthly-breakdown?year=${year}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const monthlyData = await response.json();
          
          if (monthlyData && monthlyData.length > 0) {
            csvData.push(['DESGLOSE MENSUAL - ' + year]);
            csvData.push(['Mes', 'Total Ventas', 'Transacciones', 'Ticket Promedio']);
            monthlyData.forEach((month: any) => {
              csvData.push([
                month.monthName,
                formatCurrencyCSV(month.totalSales),
                month.transactionCount,
                Math.round(month.averageTicket)
              ]);
            });
          }
        }
      } catch (error) {
        console.error('Error fetching monthly breakdown:', error);
      }
    }
    
    // Create CSV content
    const csvContent = csvData.map(row => 
      row.map(cell => {
        // Escape commas and quotes in cell values
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return '"' + stringCell.replace(/"/g, '""') + '"';
        }
        return stringCell;
      }).join(',')
    ).join('\n');
    
    // Download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `segmento_${segmentName}_${selectedPeriod.replace(/[\/\\:]/g, '-')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap">
              {/* Home button and Vista */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
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
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Vista:</span>
                <Select 
                  value={selectedView}
                  onValueChange={(value: "all" | "segmento" | "vendedor") => {
                    setSelectedView(value);
                    if (value === "all") {
                      setLocation('/');
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-full sm:w-48 rounded-lg border-gray-200 text-sm bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-gray-200" sideOffset={4}>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                        <span>Todo el dashboard</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="segmento">
                      <div className="flex items-center gap-2">
                        <Building className="h-3.5 w-3.5 text-green-500" />
                        <span>Por segmento</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="vendedor">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-purple-500" />
                        <span>Por vendedor</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Segment selector - shown when view is segmento */}
              {!embedded && selectedView === "segmento" && allSegments && allSegments.length > 0 && segmentName && (
                <div className="flex items-center gap-2 w-full sm:w-auto" key="segment-selector">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Segmento:</span>
                  <Select 
                    value={segmentName} 
                    onValueChange={(newSegment) => {
                      setLocation(`/segment/${encodeURIComponent(newSegment)}`);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-56 rounded-lg border-gray-200 text-sm" data-testid="select-segment">
                      <SelectValue placeholder={segmentName} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto" sideOffset={4}>
                      {allSegments.map((segment) => (
                        <SelectItem key={segment} value={segment}>
                          {segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Salesperson selector - shown when view is vendedor */}
              {!embedded && selectedView === "vendedor" && allSalespeople && allSalespeople.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto" key="salesperson-selector">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Vendedor:</span>
                  <Select 
                    value=""
                    onValueChange={(salesperson) => {
                      setLocation(`/salesperson/${encodeURIComponent(salesperson)}`);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-56 rounded-lg border-gray-200 text-sm" data-testid="select-salesperson">
                      <SelectValue placeholder="Selecciona vendedor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto" sideOffset={4}>
                      {allSalespeople.map((salesperson) => (
                        <SelectItem key={salesperson} value={salesperson}>
                          {salesperson}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Embedded segment selector - shown when view is segmento */}
              {embedded && selectedView === "segmento" && onSegmentChange && allSegments && allSegments.length > 0 && segmentName && (
                <div className="flex items-center gap-2 w-full sm:w-auto" key="embedded-segment-selector">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Segmento:</span>
                  <Select value={segmentName} onValueChange={onSegmentChange}>
                    <SelectTrigger className="h-9 w-full sm:w-56 rounded-lg border-gray-200 text-sm">
                      <SelectValue placeholder={segmentName} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto" sideOffset={4}>
                      {allSegments.map((segment) => (
                        <SelectItem key={segment} value={segment}>
                          {segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Embedded salesperson selector - shown when view is vendedor */}
              {embedded && selectedView === "vendedor" && allSalespeople && allSalespeople.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto" key="embedded-salesperson-selector">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Vendedor:</span>
                  <Select 
                    value=""
                    onValueChange={(salesperson) => {
                      setLocation(`/salesperson/${encodeURIComponent(salesperson)}`);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-56 rounded-lg border-gray-200 text-sm" data-testid="select-salesperson">
                      <SelectValue placeholder="Selecciona vendedor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto" sideOffset={4}>
                      {allSalespeople.map((salesperson) => (
                        <SelectItem key={salesperson} value={salesperson}>
                          {salesperson}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Period */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Período:</span>
                <YearMonthSelector 
                  value={selection}
                  onChange={handleSelectionChange}
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

            {/* Export CSV Button - Small and subtle in top right */}
            {!isComparativeMode && (
              <div className="absolute top-3 right-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportSegmentDataToCSV}
                  disabled={isLoadingClients || isLoadingSalespeople}
                  className="h-8 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  data-testid="button-export-segment-csv"
                  title="Exportar datos del segmento a CSV"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Exportar CSV
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* Comparative Mode Layout */}
          {(() => {
            console.log("🎬 [segment-detail] RENDER:", {
              isComparativeMode,
              comparativePeriodsLength: comparativePeriods.length,
              comparativePeriods,
              selection
            });
            return isComparativeMode;
          })() ? (
            <>
              {console.log("✅ Renderizando componentes comparativos")}
              {/* Comparative Segment Chart */}
              <ComparativeSegmentTable 
                periods={comparativePeriods}
                segment={segmentName}
              />

              {/* Comparative Salespeople Chart */}
              <ComparativeSegmentSalespeopleTable 
                segmentName={segmentName}
                periods={comparativePeriods}
              />
            </>
          ) : (
            <>
              {/* KPI Cards Summary */}
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
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
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Recurrentes / Nuevos</p>
                      {isLoadingRecurrence ? (
                        <div className="h-6 lg:h-8 bg-gray-200 rounded animate-pulse w-20"></div>
                      ) : isRecurrenceError ? (
                        <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-400" data-testid="text-client-recurrence">
                          No disponible
                        </p>
                      ) : (
                        <p className="text-base sm:text-lg lg:text-2xl font-bold text-teal-600" data-testid="text-client-recurrence">
                          {formatNumber(clientRecurrence?.recurringCount || 0)} / {formatNumber(clientRecurrence?.newCount || 0)}
                        </p>
                      )}
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-teal-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-teal-600" />
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
              </section>

              {/* Goal Progress Section - Only show for monthly view */}
              {filterType === 'month' && goalData && (
                <div className="rounded-2xl shadow-sm border border-gray-200 bg-white dark:bg-slate-900 dark:border-gray-700 p-5" data-testid="card-segment-goal">
                  <div className="space-y-4">
                    {/* Header con título y porcentaje */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 rounded-xl p-2.5">
                          <Target className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-gray-900 dark:text-white">Meta del Segmento</h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {selectedPeriod ? format(parseISO(selectedPeriod + '-01'), 'MMMM yyyy', { locale: es }) : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          goalData.percentage >= 100 ? 'text-emerald-600' : 
                          goalData.percentage >= 70 ? 'text-amber-600' : 'text-rose-600'
                        }`} data-testid="text-goal-percentage">
                          {goalData.percentage.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Logrado</p>
                      </div>
                    </div>
                    
                    {/* Meta y Ventas Actuales en fila */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl p-3">
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Meta Mensual</p>
                        <p className="text-lg font-bold text-purple-900 dark:text-purple-100" data-testid="text-goal-target">
                          {formatCurrency(Number(goalData.targetAmount))}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl p-3">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Ventas Actuales</p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100" data-testid="text-goal-current">
                          {formatCurrency(Number(goalData.currentSales))}
                        </p>
                      </div>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="space-y-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${
                            goalData.percentage >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 
                            goalData.percentage >= 70 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'
                          }`}
                          style={{ width: `${Math.min(goalData.percentage, 100)}%` }}
                        />
                      </div>
                      
                      {/* Segunda barra de progreso - Total Combinado (Ventas + NVV + GDV) */}
                      {(nvvTotal > 0 || gdvTotal > 0) && (() => {
                        const combinedTotal = Number(goalData.currentSales) + nvvTotal + gdvTotal;
                        const combinedPercentage = Number(goalData.targetAmount) > 0 
                          ? (combinedTotal / Number(goalData.targetAmount)) * 100 
                          : 0;
                        return (
                          <div className="space-y-0.5">
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                  combinedPercentage >= 100 ? 'bg-gradient-to-r from-cyan-300 to-cyan-500' : 
                                  combinedPercentage >= 70 ? 'bg-gradient-to-r from-sky-300 to-sky-500' : 'bg-gradient-to-r from-indigo-300 to-indigo-500'
                                }`}
                                style={{ width: `${Math.min(combinedPercentage, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                Total Combinado: {formatCurrency(combinedTotal)}
                              </p>
                              <p className={`text-[10px] font-medium ${
                                combinedPercentage >= 100 ? 'text-cyan-600' : 
                                combinedPercentage >= 70 ? 'text-sky-600' : 'text-indigo-600'
                              }`}>
                                {combinedPercentage.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

          {/* NVV Pendientes - Notas de Venta Pendientes by Segment (solo en mes actual) */}
          {segmentName && isCurrentMonth() && (
            <SegmentPendingNVV
              segment={segmentName}
            />
          )}

          {/* Data Tables */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
            {/* Top Clients - Using dashboard component for consistent styling */}
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <TopClientsPanel
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                segment={segmentName}
              />
            </div>

            {/* Top Salespeople Table */}
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            {!isSalespersonSearchExpanded ? (
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Top Vendedores del Segmento</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSalespersonSearchExpanded(true)}
                  className="h-8 w-8 p-0"
                  data-testid="button-expand-salesperson-search"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Buscar vendedor..."
                      value={salespersonSearchTerm}
                      onChange={(e) => setSalespersonSearchTerm(e.target.value)}
                      className="pl-9"
                      autoFocus
                      data-testid="input-search-salesperson"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSalespersonSearch}
                    className="h-9 w-9 p-0"
                    data-testid="button-clear-salesperson-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {currentSalespersonLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : debouncedSalespersonSearch.length > 0 && debouncedSalespersonSearch.length < 2 ? (
                <p className="text-gray-500 text-center py-8 text-sm">Escribe al menos 2 caracteres para buscar</p>
              ) : displaySalespeople.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {debouncedSalespersonSearch ? 'No se encontraron vendedores' : 'No hay vendedores en este segmento'}
                </p>
              ) : (
                <>
                  <Accordion
                    type="single"
                    collapsible
                    value={expandedSalesperson}
                    onValueChange={setExpandedSalesperson}
                    className="space-y-2"
                  >
                    {displaySalespeople.map((salesperson, index) => (
                      <AccordionItem
                        key={salesperson.salespersonName}
                        value={salesperson.salespersonName}
                        className="border rounded-lg overflow-hidden bg-purple-50/30"
                      >
                        <AccordionTrigger
                          className="px-4 py-3 hover:bg-purple-50/50 hover:no-underline"
                          data-testid={`accordion-trigger-salesperson-${index}`}
                        >
                          <div className="flex items-center gap-3 w-full pr-4">
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {salesperson.salespersonName}
                              </p>
                            </div>
                            <div className="w-12 flex-shrink-0 text-right">
                              <span className="text-xs text-gray-600">
                                {salesperson.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-24 sm:w-32 flex-shrink-0">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(salesperson.percentage, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="w-28 flex-shrink-0 text-right">
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(salesperson.totalSales)}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-2 bg-white">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Transacciones:</span>
                              <span className="font-medium">{formatNumber(salesperson.transactionCount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Ticket Promedio:</span>
                              <span className="font-medium">{formatCurrency(salesperson.averageTicket)}</span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  {!debouncedSalespersonSearch && displaySalespeople.length >= salespersonLimit && (
                    <div className="text-center pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLoadMoreSalespeople}
                        data-testid="button-load-more-salespeople"
                      >
                        Ver más
                      </Button>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>

            {/* Top Products Section */}
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Top Productos del Segmento</h2>
                </div>
              </div>
              
              <div className="space-y-2">
                {isLoadingProducts ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay productos en este segmento</p>
                ) : (
                  <>
                    <Accordion
                      type="single"
                      collapsible
                      value={expandedProduct}
                      onValueChange={setExpandedProduct}
                      className="space-y-2"
                    >
                      {products.map((product, index) => (
                        <AccordionItem
                          key={product.productName}
                          value={product.productName}
                          className="border rounded-lg overflow-hidden bg-green-50/30"
                        >
                          <AccordionTrigger
                            className="px-4 py-3 hover:bg-green-50/50 hover:no-underline"
                            data-testid={`accordion-trigger-product-${index}`}
                          >
                            <div className="flex items-center gap-3 w-full pr-4">
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {product.productName}
                                </p>
                              </div>
                              <div className="w-12 flex-shrink-0 text-right">
                                <span className="text-xs text-gray-600">
                                  {product.percentage.toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-24 sm:w-32 flex-shrink-0">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(product.percentage, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="w-28 flex-shrink-0 text-right">
                                <span className="text-sm font-semibold text-gray-900">
                                  {formatCurrency(product.totalSales)}
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pt-2 bg-white">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Cantidad Vendida:</span>
                                <span className="font-medium">{formatNumber(product.totalQuantity)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Transacciones:</span>
                                <span className="font-medium">{formatNumber(product.transactionCount)}</span>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    {products.length >= productLimit && (
                      <div className="text-center pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setProductLimit(prev => prev + 10)}
                          data-testid="button-load-more-products"
                        >
                          Ver más
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Packaging Sales Metrics - Total Facturado x Unidades for this segment */}
          {segmentName && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <PackagingSalesMetrics
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                segment={segmentName}
              />
            </div>
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
