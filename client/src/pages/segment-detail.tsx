import { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, UserCheck, CalendarIcon, Target, Eye, Building, Home, Download, Search, X, UserPlus, RefreshCw, Package, Menu, Database, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger, DrawerFooter } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parse, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useFilter } from "@/contexts/FilterContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import panoramicaLogo from "@assets/Diseno-sin-titulo-12-1-e1733933035809_1759422274944.webp";
import ComparativeSegmentSalespeopleTable from "@/components/dashboard/comparative-segment-salespeople-table";
import ComparativeSegmentTable from "@/components/dashboard/comparative-segment-table";
import PendingDocumentsUnified from "@/components/dashboard/pending-documents-unified";
import PackagingSalesMetrics from "@/components/dashboard/packaging-sales-metrics";
import TopClientsPanel from "@/components/dashboard/top-clients-panel";
import FletesPanel from "@/components/dashboard/fletes-panel";
import SalesChart from "@/components/dashboard/sales-chart";
import KPICards from "@/components/dashboard/kpi-cards";
import MetaGoalCard from "@/components/dashboard/meta-goal-card";

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

interface SalespersonClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
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

  // Mobile detection
  const isMobile = useIsMobile();

  // Mobile drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localSelection, setLocalSelection] = useState(selection);

  // Sync local selection when drawer opens
  const handleDrawerOpen = () => {
    setLocalSelection(selection);
  };

  // Apply filters from drawer
  const handleApplyFilters = () => {
    setSelection(localSelection);
    setIsDrawerOpen(false);
  };

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
  const [showNewClientsModal, setShowNewClientsModal] = useState(false);
  const [clientsPanelView, setClientsPanelView] = useState<"top" | "new">("top");
  const handleShowNewClientsInPanel = () => {
    setClientsPanelView("new");
    requestAnimationFrame(() => {
      const el = document.getElementById("top-clients-panel");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // State for products
  const [productLimit, setProductLimit] = useState(10);
  const [expandedProduct, setExpandedProduct] = useState<string>("");
  const [isProductSearchExpanded, setIsProductSearchExpanded] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearchTerm), 300);
    return () => clearTimeout(t);
  }, [productSearchTerm]);

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
    } else if (selection.period === "day" && selection.days && selection.days.length > 0) {
      const year = selection.years[0];
      // For day selection, use months array (not month singular)
      const month = selection.months && selection.months.length > 0 ? selection.months[0] : 1;
      const day = selection.days[0];
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (selection.period === "days" && selection.days && selection.days.length > 0) {
      // Rango de días → período agregado (rango de fechas), no comparativa.
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

  const filterType: "day" | "month" | "year" | "range" = embedded && dashboardFilterType ? dashboardFilterType : (() => {
    if (selection.period === "day") return "day";
    if (selection.period === "days") return "range";
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
    // Un rango de días NO entra en comparativa; se trata como período agregado (range).
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

  // Clients of expanded salesperson
  const { data: salespersonClients = [], isLoading: isLoadingSalespersonClients } = useQuery<SalespersonClient[]>({
    queryKey: ['/api/segments', segmentName, 'top-salespeople', expandedSalesperson, 'clients', selectedPeriod, filterType],
    queryFn: async () => {
      if (!expandedSalesperson || !segmentName) return [];
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', '10');
      const res = await fetch(`/api/segments/${encodeURIComponent(segmentName)}/top-salespeople/${encodeURIComponent(expandedSalesperson)}/clients?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data = await res.json();
      return data.items || data;
    },
    enabled: !!segmentName && !!expandedSalesperson,
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

  // Product search (cuando la lupa está activa)
  const { data: productSearchResults = [], isLoading: isLoadingProductSearch } = useQuery<SegmentProduct[]>({
    queryKey: ['/api/products/search', debouncedProductSearch, segmentName, selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', debouncedProductSearch);
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('segment', segmentName || '');
      const res = await fetch(`/api/products/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.items || []);
      const maxSales = arr.length > 0 ? Math.max(...arr.map((p: any) => p.totalSales || 0)) : 1;
      return arr.map((p: any) => ({
        productName: p.name || p.productName,
        totalSales: p.totalSales || 0,
        totalQuantity: p.totalUnits || p.totalQuantity || 0,
        transactionCount: p.transactionCount || 0,
        percentage: maxSales > 0 ? ((p.totalSales || 0) / maxSales) * 100 : 0,
      }));
    },
    enabled: !!segmentName && debouncedProductSearch.length >= 2,
  });

  const displayProducts = debouncedProductSearch.length >= 2 ? productSearchResults : products;
  const isLoadingDisplayProducts = debouncedProductSearch.length >= 2 ? isLoadingProductSearch : isLoadingProducts;

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

  interface NewClientItem {
    clientName: string;
    totalSales: number;
    totalUnits: number;
    orderCount: number;
    firstPurchaseDate: string;
    salesperson: string;
  }

  const { data: newClientsList, isLoading: isLoadingNewClients } = useQuery<NewClientItem[]>({
    queryKey: ['/api/sales/new-clients', selectedPeriod, filterType, segmentName, 'segment-detail'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segmentName) params.append('segment', segmentName);
      const res = await fetch(`/api/sales/new-clients?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: showNewClientsModal && !!segmentName,
  });

  // Query NVV totals for combined progress bar - uses same API as Documentos Pendientes
  const { data: nvvForProgress } = useQuery<Array<{ totalAmount: number }>>({
    queryKey: ['/api/nvv/all-by-salespeople', 'segment-progress', segmentName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segmentName) params.append('segment', segmentName);
      const res = await fetch(`/api/nvv/all-by-salespeople?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!segmentName,
  });

  // Query GDV totals for combined progress bar - uses same API as Documentos Pendientes
  const { data: gdvForProgress } = useQuery<Array<{ totalAmount: number }>>({
    queryKey: ['/api/gdv/all-by-salespeople', 'segment-progress', segmentName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segmentName) params.append('segment', segmentName);
      const res = await fetch(`/api/gdv/all-by-salespeople?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!segmentName,
  });

  // NVV and GDV totals for combined progress
  const nvvTotal = nvvForProgress?.reduce((s: number, sp: { totalAmount: number }) => s + sp.totalAmount, 0) || 0;
  const gdvTotal = gdvForProgress?.reduce((s: number, sp: { totalAmount: number }) => s + sp.totalAmount, 0) || 0;

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

  // Export data to Excel
  const exportSegmentDataToExcel = async () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      { 'Indicador': 'Segmento', 'Valor': segmentName },
      { 'Indicador': 'Período', 'Valor': selection.display },
      { 'Indicador': 'Total Ventas', 'Valor': totalSales },
      { 'Indicador': 'Total Clientes', 'Valor': totalClients },
      { 'Indicador': 'Total Vendedores', 'Valor': totalSalespeople },
      { 'Indicador': 'Total Transacciones', 'Valor': totalTransactions },
      { 'Indicador': 'Ticket Promedio', 'Valor': Math.round(averageTicket) },
      { 'Indicador': 'Generado', 'Valor': format(new Date(), "dd/MM/yyyy HH:mm") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    // Clients sheet
    if (clients && clients.length > 0) {
      const clientData = clients.map(client => ({
        'Cliente': client.clientName,
        'Vendedor': client.salespersonName || '',
        'Total Ventas': client.totalSales,
        'Transacciones': client.transactionCount,
        'Ticket Promedio': Math.round(client.averageTicket),
        'Porcentaje': client.percentage / 100,
      }));
      const wsClients = XLSX.utils.json_to_sheet(clientData);
      wsClients['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
      // Format percentage column (index 5)
      const rangeC = XLSX.utils.decode_range(wsClients['!ref'] || 'A1');
      for (let r = rangeC.s.r + 1; r <= rangeC.e.r; r++) {
        const cell = wsClients[XLSX.utils.encode_cell({ r, c: 5 })];
        if (cell) cell.z = '0.00%';
      }
      XLSX.utils.book_append_sheet(wb, wsClients, 'Clientes');
    }

    // Salespeople sheet
    if (salespeople && salespeople.length > 0) {
      const spData = salespeople.map(sp => ({
        'Vendedor': sp.salespersonName,
        'Total Ventas': sp.totalSales,
        'Transacciones': sp.transactionCount,
        'Ticket Promedio': Math.round(sp.averageTicket),
        'Porcentaje': sp.percentage / 100,
      }));
      const wsSalespeople = XLSX.utils.json_to_sheet(spData);
      wsSalespeople['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
      // Format percentage column (index 4)
      const rangeSP = XLSX.utils.decode_range(wsSalespeople['!ref'] || 'A1');
      for (let r = rangeSP.s.r + 1; r <= rangeSP.e.r; r++) {
        const cell = wsSalespeople[XLSX.utils.encode_cell({ r, c: 4 })];
        if (cell) cell.z = '0.00%';
      }
      XLSX.utils.book_append_sheet(wb, wsSalespeople, 'Vendedores');
    }

    // Monthly breakdown if year is selected
    if (filterType === 'year' && selectedPeriod) {
      try {
        const year = selectedPeriod.split('-')[0];
        const response = await fetch(`/api/sales/segment/${segmentName}/monthly-breakdown?year=${year}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const monthlyData = await response.json();

          if (monthlyData && monthlyData.length > 0) {
            const monthlySheetData = monthlyData.map((month: any) => ({
              'Mes': month.monthName,
              'Total Ventas': month.totalSales,
              'Transacciones': month.transactionCount,
              'Ticket Promedio': Math.round(month.averageTicket),
            }));
            const wsMonthly = XLSX.utils.json_to_sheet(monthlySheetData);
            wsMonthly['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
            XLSX.utils.book_append_sheet(wb, wsMonthly, `Mensual ${year}`);
          }
        }
      } catch (error) {
        console.error('Error fetching monthly breakdown:', error);
      }
    }

    const fileName = `segmento_${segmentName}_${selectedPeriod.replace(/[\/\\:]/g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
        {/* Mobile Header with Logo */}
        {isMobile && !embedded && (
          <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 py-2.5 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <img
                  src={panoramicaLogo}
                  alt="Panoramica"
                  className="h-10 w-auto object-contain"
                />
              </div>

              {/* Actions: Back + Filters Menu */}
              <div className="flex items-center gap-2">
                {/* Back Button */}
                {onBack && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBack}
                    className="h-9 px-2.5 rounded-lg border-gray-200 dark:border-gray-700"
                    data-testid="button-mobile-back"
                  >
                    <Home className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </Button>
                )}

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
                      <DrawerTitle className="text-lg font-semibold">Filtros</DrawerTitle>
                      <DrawerDescription className="text-sm text-gray-600">
                        Personaliza la vista del dashboard
                      </DrawerDescription>
                    </DrawerHeader>

                    <div className="px-6 space-y-6 overflow-y-auto flex-1">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                          <Eye className="h-4 w-4" />
                          <span>Vista</span>
                        </div>
                        <Select
                          value={selectedView}
                          onValueChange={(value: "all" | "segmento" | "vendedor") => {
                            setSelectedView(value);
                            if (value === "all") {
                              setIsDrawerOpen(false);
                              setLocation('/');
                            }
                          }}
                        >
                          <SelectTrigger className="h-10 w-full rounded-lg border-gray-200 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg border-gray-200">
                            <SelectItem value="all">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                                <span>Todo el dashboard</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="segmento">
                              <div className="flex items-center gap-2">
                                <Building className="h-3.5 w-3.5 text-[#fd6301]" />
                                <span>Por segmento</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="vendedor">
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-[#fd6301]" />
                                <span>Por vendedor</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedView === "segmento" && allSegments && allSegments.length > 0 && segmentName && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                            <Building className="h-4 w-4" />
                            <span>Segmento</span>
                          </div>
                          <Select
                            value={segmentName}
                            onValueChange={(newSegment) => {
                              setIsDrawerOpen(false);
                              if (embedded && onSegmentChange) {
                                onSegmentChange(newSegment);
                              } else {
                                setLocation(`/segment/${encodeURIComponent(newSegment)}`);
                              }
                            }}
                          >
                            <SelectTrigger className="h-10 w-full rounded-lg border-gray-200 text-sm">
                              <SelectValue placeholder={segmentName} />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto">
                              {allSegments.map((segment) => (
                                <SelectItem key={segment} value={segment}>
                                  {segment}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedView === "vendedor" && allSalespeople && allSalespeople.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                            <Users className="h-4 w-4" />
                            <span>Vendedor</span>
                          </div>
                          <Select
                            value=""
                            onValueChange={(salesperson) => {
                              setIsDrawerOpen(false);
                              setLocation(`/salesperson/${encodeURIComponent(salesperson)}`);
                            }}
                          >
                            <SelectTrigger className="h-10 w-full rounded-lg border-gray-200 text-sm">
                              <SelectValue placeholder="Selecciona vendedor" />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg border-gray-200 max-h-60 overflow-y-auto">
                              {allSalespeople.map((salesperson) => (
                                <SelectItem key={salesperson} value={salesperson}>
                                  {salesperson}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-3">
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
              {/* Segment badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="h-2 w-2 rounded-full bg-[#fd6301] flex-shrink-0" />
                <span className="text-xs font-medium text-[#fd6301] truncate">
                  Segmento: {segmentName}
                </span>
              </div>

              {/* Period badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                <CalendarIcon className="h-3 w-3 text-[#fd6301] flex-shrink-0" />
                <span className="text-xs font-medium text-[#fd6301]">
                  {selection.display}
                </span>
              </div>
            </div>
          </header>
        )}

        {/* Desktop Header */}
        {!isMobile && !embedded && (
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
                          <Building className="h-3.5 w-3.5 text-[#fd6301]" />
                          <span>Por segmento</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="vendedor">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-[#fd6301]" />
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

                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded border border-orange-200">
                  <Eye className="h-3 w-3 text-[#fd6301] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#fd6301]">
                      Vista: Por segmento
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded border border-orange-200">
                  <CalendarIcon className="h-3 w-3 text-[#fd6301] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#fd6301]">
                      Período: {selection.display}
                    </div>
                    <div className="text-[10px] text-[#fd6301] mt-0.5">
                      {selection.period === "full-year" && `${selection.years.length} año(s) completo(s)`}
                      {selection.period === "month" && `Mes específico en ${selection.years.length} año(s)`}
                      {selection.period === "months" && `${selection.months?.length} meses en ${selection.years.length} año(s)`}
                      {selection.period === "day" && `Día específico en ${selection.years.length} año(s)`}
                      {selection.period === "days" && `${selection.days?.length} días en ${selection.years.length} año(s)`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded border border-orange-200">
                  <div className="h-3 w-3 text-[#fd6301] flex-shrink-0 rounded-full bg-green-200" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#fd6301]">
                      Segmento: {segmentName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Export CSV Button - Small and subtle in top right, hidden on mobile */}
              {!isComparativeMode && (
                <div className="absolute top-3 right-3 hidden sm:block">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exportSegmentDataToExcel}
                    disabled={isLoadingClients || isLoadingSalespeople}
                    className="h-8 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    data-testid="button-export-segment-csv"
                    title="Exportar datos del segmento a Excel"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Exportar Excel
                  </Button>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="px-3 sm:px-4 lg:px-6 py-4 lg:py-6 flex flex-col gap-4 lg:gap-6">
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
              {/* KPI Cards — usa las mismas tarjetas del dashboard principal.
                  Sin div envolvente: en celular las tarjetas se reparten entre las demás
                  secciones y una caja intermedia las volvería a encerrar. */}
              <KPICards
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                segment={segmentName}
                onShowNewClients={handleShowNewClientsInPanel}
              />

              {/* Goal Progress Section - Only show for monthly view.
                  Primera en celular (ver el orden explicado en dashboard.tsx). */}
              {filterType === 'month' && goalData && (
                <div className="order-[-4] md:order-none">
                <MetaGoalCard
                  title="Meta del Segmento"
                  targetAmount={Number(goalData.targetAmount)}
                  currentSales={Number(goalData.currentSales)}
                  percentage={goalData.percentage}
                  nvvTotal={nvvTotal}
                  gdvTotal={gdvTotal}
                  selectedPeriod={selectedPeriod}
                  icon={<Building className="h-5 w-5" />}
                  testId="card-segment-goal"
                  percentageTestId="text-goal-percentage"
                  targetTestId="text-goal-target"
                  currentTestId="text-goal-current"
                />
                </div>
              )}

              {/* Documentos Pendientes (NVV + GDV) — cuarto en celular */}
              {segmentName && (
                <div className="order-[-3] md:order-none">
                  <PendingDocumentsUnified
                    selectedPeriod={selectedPeriod}
                    filterType={filterType}
                    segment={segmentName}
                  />
                </div>
              )}

              {/* Tendencia de Ventas */}
              {segmentName && (
                <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
                  <SalesChart
                    selectedPeriod={selectedPeriod}
                    filterType={filterType}
                    segment={segmentName}
                  />
                </div>
              )}

              {/* Data Tables */}
              <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
                {/* Top Clients - Using dashboard component for consistent styling */}
                <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
                  <TopClientsPanel
                    selectedPeriod={selectedPeriod}
                    filterType={filterType}
                    segment={segmentName}
                    view={clientsPanelView}
                    onViewChange={setClientsPanelView}
                  />
                </div>

                {/* Top Salespeople Table */}
                <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
                  {!isSalespersonSearchExpanded ? (
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#fd6301] rounded-lg flex items-center justify-center flex-shrink-0 shadow-md shadow-[#fd6301]/25">
                          <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
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
                              className="border rounded-lg overflow-hidden bg-orange-50/30"
                            >
                              <AccordionTrigger
                                className="px-4 py-3 hover:bg-orange-50/50 hover:no-underline"
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
                                        className="h-full bg-[#fd6301] rounded-full transition-all duration-500"
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
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Transacciones:</span>
                                    <span className="font-medium">{formatNumber(salesperson.transactionCount)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Ticket Promedio:</span>
                                    <span className="font-medium">{formatCurrency(salesperson.averageTicket)}</span>
                                  </div>

                                  {expandedSalesperson === salesperson.salespersonName && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Clientes</p>
                                      {isLoadingSalespersonClients ? (
                                        <div className="space-y-2">
                                          {[...Array(3)].map((_, i) => (
                                            <div key={i} className="animate-pulse h-6 bg-gray-100 rounded"></div>
                                          ))}
                                        </div>
                                      ) : salespersonClients.length === 0 ? (
                                        <p className="text-gray-400 text-xs">Sin clientes en este período</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {salespersonClients.map((client, idx) => (
                                            <div
                                              key={`${client.clientName}-${idx}`}
                                              className="flex justify-between items-center py-1.5 px-2 bg-gray-50 rounded"
                                              data-testid={`salesperson-client-${idx}`}
                                            >
                                              <span className="text-gray-700 truncate flex-1">{client.clientName}</span>
                                              <span className="font-medium text-gray-900 ml-2">{formatCurrency(client.totalSales)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
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
                  <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                    {!isProductSearchExpanded ? (
                      <>
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#fd6301] rounded-lg flex items-center justify-center flex-shrink-0 shadow-md shadow-[#fd6301]/25">
                            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate">Top Productos del Segmento</h2>
                          <button
                            onClick={() => setIsProductSearchExpanded(true)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
                            data-testid="button-expand-segment-product-search"
                            title="Buscar producto"
                          >
                            <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#fd6301] rounded-lg flex items-center justify-center shadow-md shadow-[#fd6301]/25">
                              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Top Productos del Segmento</h2>
                          </div>
                          {debouncedProductSearch && (
                            <span className="text-xs sm:text-sm text-gray-500">
                              {displayProducts.length} resultado{displayProducts.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="relative w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Filtrar productos por nombre..."
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            className="pl-11 pr-10 h-11 text-sm font-medium border-2 border-gray-200 focus:border-orange-200 rounded-lg shadow-sm"
                            data-testid="input-filter-segment-products"
                            autoFocus
                          />
                          <button
                            onClick={() => { setProductSearchTerm(""); setDebouncedProductSearch(""); setIsProductSearchExpanded(false); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            data-testid="button-clear-segment-product-filter"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {isLoadingDisplayProducts ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                        ))}
                      </div>
                    ) : displayProducts.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        {debouncedProductSearch ? 'No se encontraron productos con ese nombre' : 'No hay productos en este segmento'}
                      </p>
                    ) : (
                      <>
                        <Accordion
                          type="single"
                          collapsible
                          value={expandedProduct}
                          onValueChange={setExpandedProduct}
                          className="space-y-2"
                        >
                          {displayProducts.map((product, index) => (
                            <AccordionItem
                              key={product.productName}
                              value={product.productName}
                              className="border rounded-lg overflow-hidden bg-orange-50/30"
                            >
                              <AccordionTrigger
                                className="px-4 py-3 hover:bg-orange-50/50 hover:no-underline"
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
                                        className="h-full bg-[#fd6301] rounded-full transition-all duration-500"
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
                        {!debouncedProductSearch && products.length >= productLimit && (
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

              {/* Fletes del segmento */}
              {segmentName && (
                <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
                  <FletesPanel
                    selectedPeriod={selectedPeriod}
                    filterType={filterType}
                    segment={segmentName}
                  />
                </div>
              )}

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

        <Dialog open={showNewClientsModal} onOpenChange={setShowNewClientsModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#fd6301]" />
                Clientes Nuevos — {segmentName}
              </DialogTitle>
              <p className="text-sm text-gray-500">
                {formatNumber(newClientsList?.length || 0)} clientes nuevos — Total comprado: {formatCurrency(newClientsList?.reduce((sum, c) => sum + c.totalSales, 0) || 0)}
              </p>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 -mx-6 px-6">
              {isLoadingNewClients ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#fd6301]" />
                </div>
              ) : !newClientsList?.length ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay clientes nuevos en este período para {segmentName}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-950">
                    <div className="col-span-5">Cliente</div>
                    <div className="col-span-3 text-right">Monto</div>
                    <div className="col-span-2 text-right">Uds.</div>
                    <div className="col-span-2 text-right">Órdenes</div>
                  </div>
                  {newClientsList.map((item) => (
                    <div
                      key={item.clientName}
                      className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors items-center"
                    >
                      <div className="col-span-5 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.clientName}>
                          {item.clientName}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate" title={item.salesperson}>
                          {item.salesperson}
                        </p>
                      </div>
                      <div className="col-span-3 text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(item.totalSales)}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {formatNumber(item.totalUnits)}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {formatNumber(item.orderCount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
