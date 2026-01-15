import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, Clock, CalendarIcon, BarChart3, Filter, Settings2, Target, Package, CheckCircle, XCircle, AlertCircle, TrendingDown, FileText, Home, Eye, Building, ChevronDown, ChevronUp, Download, Search, X, Truck, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import ComparativeSalespersonTable from "@/components/dashboard/comparative-salesperson-table";
import SalespersonPendingNVV from "@/components/dashboard/salesperson-pending-nvv";
import SalespersonPendingGDV from "@/components/dashboard/salesperson-pending-gdv";
import PackagingSalesMetrics from "@/components/dashboard/packaging-sales-metrics";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

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
  newClients: number; // clientes que compraron por primera vez al vendedor en el período
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

interface SalespersonClientsResponse {
  items: SalespersonClient[];
  periodTotalSales: number;
  totalCount: number;
}

interface SearchClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
}

interface ClientDetails {
  totalSales: number;
  lastSaleDate: string | null;
  transactionCount: number;
  products: Array<{
    productName: string;
    totalSales: number;
    units: number;
  }>;
}

interface ProductDetails {
  totalSales: number;
  totalUnits: number;
  topClient: { name: string; amount: number } | null;
  transactionCount: number;
}

interface RecentTransaction {
  date: string;
  client: string;
  product: string;
  quantity: number;
  amount: number;
  docType: string;
}

interface SalespersonSegment {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface SalespersonProduct {
  productName: string;
  totalSales: number;
  transactionCount: number;
  averagePrice: number;
  lastSale: string;
  totalUnits: number;
}

interface SalespersonProductsResponse {
  items: SalespersonProduct[];
  periodTotalSales: number;
  totalCount: number;
}

interface SearchProduct {
  productName: string;
  totalSales: number;
  transactionCount: number;
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
  const { user } = useAuth();
  const { salespersonName: paramSalespersonName } = useParams();
  const [, setLocation] = useLocation();
  
  // Security: Redirect salespeople to their dashboard (they can only see their own data)
  // Do this BEFORE any rendering
  useEffect(() => {
    if (!embedded && user?.role === 'salesperson') {
      setLocation('/salesperson-dashboard');
    }
  }, [user, embedded, setLocation]);
  
  // Early return to prevent rendering for unauthorized salespeople
  if (!embedded && user?.role === 'salesperson') {
    return null; // Don't render anything while redirecting
  }
  
  // For salespeople (in embedded mode), force salespersonName to be their own (security)
  const salespersonName = user?.role === 'salesperson' 
    ? (user.salespersonName || `${user.firstName || ''} ${user.lastName || ''}`.trim())
    : (propSalespersonName || (paramSalespersonName ? decodeURIComponent(paramSalespersonName) : undefined));
  
  // Use global filter context
  const { selection, setSelection } = useFilter();
  
  // Local state for view type
  const [selectedView, setSelectedView] = useState<"all" | "segmento" | "vendedor">("vendedor");
  
  // Handler for selection changes that notifies dashboard when embedded
  const handleSelectionChange = (newSelection: typeof selection) => {
    setSelection(newSelection);
    
    // If embedded and onDateFilterChange is provided, notify the dashboard
    if (embedded && onDateFilterChange) {
      // Convert selection to dashboard format
      let newFilterType: "day" | "month" | "year" | "range" = "month";
      if (newSelection.period === "day" || newSelection.period === "days") newFilterType = "day";
      if (newSelection.period === "month" || newSelection.period === "months") newFilterType = "month";
      if (newSelection.period === "full-year") newFilterType = "year";
      if (newSelection.period === "custom-range") newFilterType = "range";
      
      let newPeriod = "";
      if ((newSelection.period === "month" || newSelection.period === "months") && newSelection.months && newSelection.months.length > 0) {
        // For single or multiple months mode, use the first month
        const year = newSelection.years[0];
        const month = newSelection.months[0]; // Already in 1-12 format from YearMonthSelector
        newPeriod = `${year}-${String(month).padStart(2, '0')}`;
      } else if (newSelection.period === "full-year") {
        newPeriod = `${newSelection.years[0]}-01`;
      } else if ((newSelection.period === "day" || newSelection.period === "days") && newSelection.days && newSelection.days.length > 0) {
        const year = newSelection.years[0];
        const month = newSelection.months && newSelection.months.length > 0 ? newSelection.months[0] : 1;
        const day = newSelection.days[0];
        newPeriod = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else if (newSelection.period === "custom-range") {
        newPeriod = "custom-range";
      } else {
        // Fallback for any other cases
        newPeriod = format(new Date(), "yyyy-MM");
      }
      
      const newDate = (newSelection.period === "day" || newSelection.period === "days") && newSelection.days && newSelection.days.length > 0
        ? new Date(newSelection.years[0], (newSelection.months && newSelection.months.length > 0 ? newSelection.months[0] - 1 : 0), newSelection.days[0])
        : undefined;
      
      const newYear = newSelection.years[0];
      
      const newRange = newSelection.period === "custom-range" && newSelection.startDate && newSelection.endDate
        ? { from: newSelection.startDate, to: newSelection.endDate }
        : undefined;
      
      onDateFilterChange(newFilterType, newPeriod, newDate, newYear, newRange);
    }
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
  
  // Segment filter state
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  
  // Promesas week selector - initialize to current week
  const [selectedPromesaWeek, setSelectedPromesaWeek] = useState<Date>(() => new Date());
  
  // Promesas collapse state
  const [isPromesasExpanded, setIsPromesasExpanded] = useState(false);
  
  // Clients table collapse state
  const [isClientsExpanded, setIsClientsExpanded] = useState(false);
  
  // Products table collapse state
  const [isProductsExpanded, setIsProductsExpanded] = useState(false);
  
  // Client search and pagination state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);

  // Product search and pagination state
  const [isProductSearchExpanded, setIsProductSearchExpanded] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [debouncedProductSearchTerm, setDebouncedProductSearchTerm] = useState("");
  const [productLimit, setProductLimit] = useState(10);

  // Client accordion expansion state
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Product accordion expansion state
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Client products list expansion state
  const [expandedClientProducts, setExpandedClientProducts] = useState<string | null>(null);

  // ETL refresh state
  const [isRefreshingETL, setIsRefreshingETL] = useState(false);
  const { toast } = useToast();

  // Function to refresh all ETL processes (Sales, NVV, GDV)
  const handleRefreshAllETL = async () => {
    setIsRefreshingETL(true);
    try {
      // Calculate current month date range for sales ETL
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];
      
      const results = await Promise.allSettled([
        apiRequest('POST', '/api/etl/sync-sales', { startDate, endDate, mode: 'incremental' }),
        apiRequest('POST', '/api/etl/sync-nvv'),
        apiRequest('POST', '/api/etl/sync-gdv'),
      ]);
      
      const salesResult = results[0];
      const nvvResult = results[1];
      const gdvResult = results[2];
      
      const successes: string[] = [];
      const errors: string[] = [];
      
      if (salesResult.status === 'fulfilled') successes.push('Ventas');
      else errors.push('Ventas');
      
      if (nvvResult.status === 'fulfilled') successes.push('NVV');
      else errors.push('NVV');
      
      if (gdvResult.status === 'fulfilled') successes.push('GDV');
      else errors.push('GDV');
      
      if (errors.length === 0) {
        toast({
          title: "ETL Actualizado",
          description: `Se actualizaron: ${successes.join(', ')}`,
        });
      } else if (successes.length > 0) {
        toast({
          title: "ETL Parcialmente Actualizado",
          description: `Éxito: ${successes.join(', ')}. Errores: ${errors.join(', ')}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error al actualizar ETL",
          description: "No se pudo actualizar ningún proceso ETL",
          variant: "destructive",
        });
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nvv'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdv'] });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al actualizar los procesos ETL",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingETL(false);
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce product search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearchTerm(productSearchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [productSearchTerm]);

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

  const { data: details, isLoading: isLoadingDetails } = useQuery<SalespersonDetails>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'details', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${salespersonName}/details?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName,
  });

  // Query for paginated salesperson clients (default view)
  const { data: clientsResponse, isLoading: isLoadingClients } = useQuery<SalespersonClientsResponse>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'clients', selectedPeriod, filterType, selectedSegment, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', limit.toString());
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/sales/salesperson/${salespersonName}/clients?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !debouncedSearchTerm,
  });

  // Query for search results (when typing)
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchClient[]>({
    queryKey: [`/api/salespeople/${salespersonName}/clients/search`, debouncedSearchTerm, selectedPeriod, filterType, selectedSegment],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', debouncedSearchTerm);
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/salespeople/${salespersonName}/clients/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && debouncedSearchTerm.length >= 2,
  });

  // Query for paginated salesperson products (default view)
  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery<SalespersonProductsResponse>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'products', selectedPeriod, filterType, selectedSegment, productLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', productLimit.toString());
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/sales/salesperson/${salespersonName}/products?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !debouncedProductSearchTerm,
  });

  // Query for product search results (when typing)
  const { data: productSearchResults, isLoading: isProductSearchLoading } = useQuery<SearchProduct[]>({
    queryKey: [`/api/salespeople/${salespersonName}/products/search`, debouncedProductSearchTerm, selectedPeriod, filterType, selectedSegment],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', debouncedProductSearchTerm);
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/salespeople/${salespersonName}/products/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && debouncedProductSearchTerm.length >= 2,
  });

  const { data: segments = [], isLoading: isLoadingSegments } = useQuery<SalespersonSegment[]>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'segments', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${salespersonName}/segments?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName,
  });

  // Query for client details (when a client is expanded)
  const { data: clientDetails, isLoading: isLoadingClientDetails, error: clientDetailsError } = useQuery<ClientDetails>({
    queryKey: ['/api/salespeople', salespersonName, 'clients', expandedClient, 'details', selectedPeriod, filterType],
    queryFn: async () => {
      if (!expandedClient) throw new Error('No client selected');
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/salespeople/${encodeURIComponent(salespersonName!)}/clients/${encodeURIComponent(expandedClient)}/details?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !!expandedClient,
  });

  // Query for product details (when a product is expanded)
  const { data: productDetails, isLoading: isLoadingProductDetails, error: productDetailsError } = useQuery<ProductDetails>({
    queryKey: ['/api/salespeople', salespersonName, 'products', expandedProduct, 'details', selectedPeriod, filterType],
    queryFn: async () => {
      if (!expandedProduct) throw new Error('No product selected');
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/salespeople/${encodeURIComponent(salespersonName!)}/products/${encodeURIComponent(expandedProduct)}/details?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !!expandedProduct,
  });

  // Query for recent transactions
  const { data: recentTransactions = [], isLoading: isLoadingRecentTransactions } = useQuery<RecentTransaction[]>({
    queryKey: ['/api/salespeople', salespersonName, 'transactions', 'recent'],
    queryFn: async () => {
      const res = await fetch(`/api/salespeople/${encodeURIComponent(salespersonName!)}/transactions/recent?limit=10`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName,
  });

  // Close accordions when period or filter changes
  useEffect(() => {
    setExpandedClient(null);
    setExpandedProduct(null);
  }, [selectedPeriod, filterType, selectedSegment]);

  // Fetch goals for the salesperson
  const { data: goalsData, isLoading: isLoadingGoals } = useQuery<GoalProgress[]>({
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

  // Fetch all segments for dropdown when switching views
  const { data: allSegments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
  });

  // Fetch all salespeople for the selector - use period-independent query to prevent selector from disappearing
  const { data: allSalespeopleList } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
  });
  
  const allSalespeople = allSalespeopleList?.map(name => ({ salesperson: name })) || [];
  const goals = Array.isArray(goalsData) ? goalsData : [];
  const primaryGoal = goals.length > 0 ? goals[0] : null;

  // Query for NVV metrics for the salesperson - for combined progress bar (only for month filter)
  const { data: nvvMetrics } = useQuery<{
    totalAmount: number;
    totalQuantity: number;
    pendingCount: number;
  }>({
    queryKey: ['/api/nvv/metrics', 'salesperson', salespersonName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salespersonName) {
        params.append('salesperson', salespersonName);
      }
      const res = await fetch(`/api/nvv/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && filterType === 'month',
  });

  // Query for GDV metrics for the salesperson - for combined progress bar (only for month filter)
  const { data: gdvMetrics } = useQuery<{
    gdvSales: number;
    gdvCount: number;
  }>({
    queryKey: ['/api/sales/gdv-pending', 'salesperson', salespersonName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salespersonName) {
        params.append('salesperson', salespersonName);
      }
      const res = await fetch(`/api/sales/gdv-pending?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && filterType === 'month',
  });

  // Calculate NVV and GDV totals for combined progress bar
  const nvvTotal = Number(nvvMetrics?.totalAmount || 0);
  const gdvTotal = Number(gdvMetrics?.gdvSales || 0);

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

  // Export salesperson data to CSV
  const exportSalespersonDataToCSV = () => {
    const csvData = [];
    
    // Add header
    csvData.push(['REPORTE DE VENDEDOR - ' + salespersonName]);
    csvData.push(['Período: ' + selection.display]);
    csvData.push(['Generado: ' + format(new Date(), "dd/MM/yyyy HH:mm")]);
    csvData.push([]); // Empty row
    
    // KPIs Summary
    csvData.push(['RESUMEN GENERAL']);
    csvData.push(['Total Ventas', details?.totalSales || 0]);
    csvData.push(['Total Clientes', details?.totalClients || 0]);
    csvData.push(['Total Transacciones', details?.transactionCount || 0]);
    csvData.push(['Clientes Nuevos', details?.newClients || 0]);
    csvData.push(['Frecuencia de Ventas (días)', details?.salesFrequency || 0]);
    csvData.push(['Días desde última venta', details?.daysSinceLastSale || 0]);
    if (details?.lastSaleDate) {
      csvData.push(['Última venta', formatDate(details.lastSaleDate)]);
    }
    csvData.push([]); // Empty row
    
    // Segments data
    if (segments && segments.length > 0) {
      csvData.push(['SEGMENTOS DEL VENDEDOR']);
      csvData.push(['Segmento', 'Total Ventas', 'Porcentaje']);
      segments.forEach(segment => {
        csvData.push([
          segment.segment,
          segment.totalSales,
          segment.percentage.toFixed(2) + '%'
        ]);
      });
      csvData.push([]); // Empty row
    }
    
    // Clients data
    if (displayClients && displayClients.length > 0) {
      csvData.push(['CLIENTES DEL VENDEDOR']);
      csvData.push(['Cliente', 'Total Ventas', 'Transacciones', 'Ticket Promedio', 'Última Venta', 'Días desde última venta']);
      displayClients.forEach(client => {
        csvData.push([
          client.clientName,
          client.totalSales,
          client.transactionCount,
          client.averageTicket,
          formatDate(client.lastSale),
          client.daysSinceLastSale
        ]);
      });
      csvData.push([]); // Empty row
    }
    
    // Products data
    if (displayProducts && displayProducts.length > 0) {
      csvData.push(['PRODUCTOS VENDIDOS']);
      csvData.push(['Producto', 'Total Ventas', 'Unidades', 'Transacciones', 'Precio Promedio', 'Última Venta']);
      displayProducts.forEach(product => {
        csvData.push([
          product.productName,
          product.totalSales,
          product.totalUnits,
          product.transactionCount,
          product.averagePrice,
          formatDate(product.lastSale)
        ]);
      });
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
    const fileName = `vendedor_${salespersonName}_${selectedPeriod.replace(/[\/\\:]/g, '-')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Client search and pagination display logic
  const displayClients = debouncedSearchTerm.length >= 2 && searchResults
    ? searchResults.map(c => ({ 
        clientName: c.clientName, 
        totalSales: c.totalSales, 
        transactionCount: c.transactionCount,
        averageTicket: 0,
        lastSale: '',
        daysSinceLastSale: 0
      }))
    : clientsResponse?.items || [];
  
  const periodTotal = clientsResponse?.periodTotalSales || 0;
  const currentLoading = debouncedSearchTerm.length >= 2 ? isSearchLoading : isLoadingClients;
  
  // Calculate percentages based on period total
  const clientsWithPercentage = displayClients.map(client => ({
    ...client,
    percentage: periodTotal > 0 ? (client.totalSales / periodTotal) * 100 : 0
  }));

  const handleLoadMore = () => {
    setLimit(prev => prev + 10);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setIsSearchExpanded(false);
  };

  // Product search and pagination display logic
  const displayProducts = debouncedProductSearchTerm.length >= 2 && productSearchResults
    ? productSearchResults.map(p => ({ 
        productName: p.productName, 
        totalSales: p.totalSales, 
        transactionCount: p.transactionCount,
        averagePrice: 0,
        lastSale: '',
        totalUnits: 0
      }))
    : productsResponse?.items || [];
  
  const productPeriodTotal = productsResponse?.periodTotalSales || 0;
  const currentProductLoading = debouncedProductSearchTerm.length >= 2 ? isProductSearchLoading : isLoadingProducts;
  
  // Calculate percentages based on period total
  const productsWithPercentage = displayProducts.map(product => ({
    ...product,
    percentage: productPeriodTotal > 0 ? (product.totalSales / productPeriodTotal) * 100 : 0
  }));

  const handleLoadMoreProducts = () => {
    setProductLimit(prev => prev + 10);
  };

  const handleClearProductSearch = () => {
    setProductSearchTerm("");
    setDebouncedProductSearchTerm("");
    setIsProductSearchExpanded(false);
  };

  const handleClientClick = (clientName: string) => {
    if (expandedClient === clientName) {
      setExpandedClient(null);
    } else {
      setExpandedClient(clientName);
      setExpandedProduct(null); // Close product accordion when opening client
    }
  };

  return (
    <div className="min-h-screen">
      <div className="w-full">
        {/* Header - Same as Dashboard and Segment */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 pt-3 pb-2 sm:py-5 lg:py-6 m-2 sm:m-4 rounded-2xl shadow-sm">
          <div className="space-y-4 w-full">
            {/* All filters in one line */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Home button and Vista - Hide for salespeople */}
              {user?.role !== 'salesperson' && (
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
                    value={selectedView}
                    onValueChange={(value: "all" | "segmento" | "vendedor") => {
                      setSelectedView(value);
                      if (value === "all") {
                        setLocation('/');
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-48 rounded-lg border-gray-200 text-sm bg-gray-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200" sideOffset={4}>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                          <span>Todo el dashboard</span>
                        </div>
                      </SelectItem>
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
              )}

              {/* Segment selector - shown when view is segmento (hide for salespeople) */}
              {!embedded && user?.role !== 'salesperson' && selectedView === "segmento" && allSegments && allSegments.length > 0 && (
                <div className="flex items-center gap-2" key="segment-selector">
                  <span className="text-sm font-medium text-gray-700">Segmento:</span>
                  <Select 
                    value=""
                    onValueChange={(segment) => {
                      setLocation(`/segment/${encodeURIComponent(segment)}`);
                    }}
                  >
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm" data-testid="select-segment">
                      <SelectValue placeholder="Selecciona segmento" />
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

              {/* Salesperson selector - shown when view is vendedor (hide for salespeople) */}
              {!embedded && user?.role !== 'salesperson' && selectedView === "vendedor" && allSalespeople && allSalespeople.length > 0 && (
                <div className="flex items-center gap-2" key="salesperson-selector">
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

              {/* Embedded segment selector - shown when view is segmento */}
              {embedded && selectedView === "segmento" && allSegments && allSegments.length > 0 && (
                <div className="flex items-center gap-2" key="embedded-segment-selector">
                  <span className="text-sm font-medium text-gray-700">Segmento:</span>
                  <Select 
                    value=""
                    onValueChange={(segment) => {
                      setLocation(`/segment/${encodeURIComponent(segment)}`);
                    }}
                  >
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm" data-testid="select-segment">
                      <SelectValue placeholder="Selecciona segmento" />
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
              {embedded && selectedView === "vendedor" && onSalespersonChange && allSalespeople && (
                <div className="flex items-center gap-2" key="embedded-salesperson-selector">
                  <span className="text-sm font-medium text-gray-700">Vendedor:</span>
                  <Select value={salespersonName} onValueChange={onSalespersonChange}>
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm">
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

              {/* Period selector with YearMonthSelector */}
              {!embedded && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">Período:</span>
                  <div className="h-9 px-3 rounded-lg border border-gray-200 bg-white flex items-center">
                    <YearMonthSelector
                      value={selection}
                      onChange={(newSelection) => newSelection && handleSelectionChange(newSelection)}
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
                    onChange={(newSelection) => newSelection && handleSelectionChange(newSelection)}
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

            {/* Export CSV Button - Small and subtle in top right */}
            {!isComparativeMode && (
              <div className="absolute top-3 right-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportSalespersonDataToCSV}
                  disabled={isLoadingDetails || isLoadingClients}
                  className="h-8 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  data-testid="button-export-salesperson-csv"
                  title="Exportar datos del vendedor a CSV"
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
          {isComparativeMode ? (
            <>
              {/* Comparative Salesperson Chart and Table */}
              <ComparativeSalespersonTable 
                salespersonName={salespersonName || ''}
                periods={comparativePeriods}
              />
            </>
          ) : (
            <>
          {/* Meta de Ventas */}
          {primaryGoal && (
            <Card className="rounded-2xl shadow-sm border border-gray-200 bg-white dark:bg-slate-900 dark:border-gray-700">
              <CardContent className="pt-5 pb-5">
                <div className="space-y-4">
                  {/* Header con título y porcentaje */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 rounded-xl p-2.5">
                        <Target className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Meta de Ventas</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{primaryGoal.description || primaryGoal.period}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        (primaryGoal.percentage || 0) >= 100 ? 'text-emerald-600' : 
                        (primaryGoal.percentage || 0) >= 70 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {(primaryGoal.percentage || 0).toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Logrado</p>
                    </div>
                  </div>
                  
                  {/* Meta y Ventas Actuales en fila */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl p-3">
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Meta Mensual</p>
                      <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{formatCurrency(primaryGoal.targetAmount || 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Ventas Actuales</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatCurrency(primaryGoal.currentSales || 0)}</p>
                    </div>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          (primaryGoal.percentage || 0) >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 
                          (primaryGoal.percentage || 0) >= 70 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'
                        }`}
                        style={{ width: `${Math.min(primaryGoal.percentage || 0, 100)}%` }}
                      ></div>
                    </div>
                    
                    {/* Segunda barra de progreso - Total Combinado (Ventas + NVV + GDV) */}
                    {(() => {
                      const combinedTotal = (primaryGoal.currentSales || 0) + nvvTotal + gdvTotal;
                      const combinedPercentage = (primaryGoal.targetAmount || 0) > 0 
                        ? (combinedTotal / (primaryGoal.targetAmount || 1)) * 100 
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
                  
                  {/* Desglose por segmento - siempre visible */}
                  {segments && segments.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                        <BarChart3 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Ventas por Segmento</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {segments.map((segment, index) => (
                          <div key={segment.segment} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                                style={{
                                  backgroundColor: [
                                    'rgba(253, 99, 1, 0.9)',
                                    'rgba(59, 130, 246, 0.9)',
                                    'rgba(16, 185, 129, 0.9)',
                                    'rgba(245, 158, 11, 0.9)',
                                    'rgba(139, 92, 246, 0.9)',
                                    'rgba(236, 72, 153, 0.9)',
                                    'rgba(99, 102, 241, 0.9)',
                                    'rgba(244, 63, 94, 0.9)',
                                  ][index % 8]
                                }}
                              />
                              <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{segment.segment}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(segment.totalSales)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{segment.percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ETL Refresh Button - Only visible for admin/supervisor */}
          {(user?.role === 'admin' || user?.role === 'supervisor') && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAllETL}
                disabled={isRefreshingETL}
                className="gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {isRefreshingETL ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Actualizando datos...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Actualizar Ventas, NVV y GDV
                  </>
                )}
              </Button>
            </div>
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

            {/* Clientes Nuevos Card */}
            <Card className="rounded-3xl shadow-sm border-0 bg-gradient-to-br from-purple-50/80 to-purple-100/50" data-testid="card-clientes-nuevos">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-700 mb-2">
                      Clientes Nuevos
                    </p>
                    <div className="text-3xl font-bold text-purple-900 mb-1" data-testid="text-new-clients">
                      {isLoadingDetails ? 'Cargando...' : formatNumber(details?.newClients || 0)}
                    </div>
                    <p className="text-xs text-purple-600">
                      Primera compra en el período
                    </p>
                  </div>
                  <div className="bg-purple-500 rounded-2xl p-3 shadow-sm">
                    <Users className="h-6 w-6 text-white" />
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

          {/* NVV y GDV Pendientes - Secciones colapsables (solo en mes actual) */}
          {salespersonName && isCurrentMonth() && (
            <div className="space-y-4">
              {/* NVV Colapsable */}
              <Collapsible defaultOpen={false} className="rounded-2xl shadow-md border-0 bg-white overflow-hidden">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group" data-testid="trigger-nvv-collapsible">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500 rounded-full p-2">
                      <ShoppingCart className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Notas de Venta Pendientes</h3>
                      <p className="text-sm text-gray-500">Pedidos por entregar</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-gray-200">
                    <SalespersonPendingNVV salesperson={salespersonName} applyPeriodFilter={false} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* GDV Colapsable */}
              <Collapsible defaultOpen={false} className="rounded-2xl shadow-md border-0 bg-white overflow-hidden">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group" data-testid="trigger-gdv-collapsible">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-500 rounded-full p-2">
                      <Truck className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Guías de Despacho Pendientes</h3>
                      <p className="text-sm text-gray-500">Guías por facturar</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-gray-200">
                    <SalespersonPendingGDV salesperson={salespersonName} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

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

          {/* Clients Table */}
          <div className="space-y-4">
            {/* Header con búsqueda expandible */}
            {!isSearchExpanded ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Clientes del Vendedor</h2>
                  
                  {/* Botón de lupa para expandir búsqueda */}
                  <button
                    onClick={() => setIsSearchExpanded(true)}
                    className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    data-testid="button-expand-client-search"
                    title="Buscar cliente"
                  >
                    <Search className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Búsqueda expandida a ancho completo */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Clientes del Vendedor</h2>
                  </div>
                  
                  {debouncedSearchTerm && (
                    <span className="text-sm text-gray-500">
                      {clientsWithPercentage.length} resultado{clientsWithPercentage.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Filtrar clientes por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-blue-500 rounded-lg shadow-sm"
                    data-testid="input-filter-clients"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      data-testid="button-clear-client-filter"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
              {currentLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                      <div className="flex-1 mx-4">
                        <div className="h-6 bg-gray-200 rounded"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : clientsWithPercentage.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">
                    {debouncedSearchTerm ? 'No se encontraron clientes con ese nombre' : 'No hay clientes para mostrar'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 transition-all duration-300 ease-in-out">
                    {clientsWithPercentage.map((client, index) => {
                      const isExpanded = expandedClient === client.clientName;
                      return (
                        <div 
                          key={client.clientName}
                          className={`rounded-lg transition-all duration-300 ease-in-out ${
                            isExpanded ? 'bg-blue-50 shadow-md' : 'hover:bg-gray-50/50'
                          }`}
                        >
                          <div
                            onClick={() => handleClientClick(client.clientName)}
                            className="cursor-pointer py-3 px-2"
                            data-testid={`client-${index}`}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 w-full">
                              {/* Nombre del cliente completo */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 font-medium truncate">
                                  {client.clientName}
                                </p>
                              </div>
                              
                              {/* Porcentaje */}
                              <span className="text-xs text-gray-600 w-8 sm:w-10 text-right flex-shrink-0">
                                {client.percentage.toFixed(1)}%
                              </span>
                              
                              {/* Barra de progreso delgada y corta */}
                              <div className="hidden sm:block w-20 sm:w-32 flex-shrink-0">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${client.percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                              
                              {/* Monto */}
                              <span className="text-sm font-semibold text-gray-900 w-20 sm:w-28 text-right flex-shrink-0">
                                {formatCurrency(client.totalSales)}
                              </span>
                              
                              {/* Chevron icon */}
                              <div className="flex-shrink-0 ml-1 sm:ml-2">
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Expandable section with client details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-blue-100">
                              {isLoadingClientDetails ? (
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[...Array(4)].map((_, i) => (
                                      <div key={i} className="animate-pulse">
                                        <div className="h-16 bg-gray-200 rounded-lg"></div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
                                </div>
                              ) : clientDetailsError ? (
                                <div className="py-4 text-center text-red-600 text-sm">
                                  Error al cargar detalles del cliente
                                </div>
                              ) : clientDetails ? (
                                <div className="space-y-4 py-4">
                                  {/* KPIs Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                      <p className="text-xs text-gray-600 mb-1">Total Vendido</p>
                                      <p className="text-lg font-bold text-blue-900">
                                        {formatCurrency(clientDetails.totalSales)}
                                      </p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                      <p className="text-xs text-gray-600 mb-1">Última Venta</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900">
                                          {clientDetails.lastSaleDate 
                                            ? format(new Date(clientDetails.lastSaleDate), "d 'de' MMM yyyy", { locale: es })
                                            : 'N/A'
                                          }
                                        </p>
                                        {clientDetails.lastSaleDate && (() => {
                                          const daysSince = Math.floor(
                                            (new Date().getTime() - new Date(clientDetails.lastSaleDate).getTime()) / (1000 * 60 * 60 * 24)
                                          );
                                          const isRecent = daysSince <= 31;
                                          return (
                                            <span 
                                              className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                                isRecent ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
                                              }`}
                                            >
                                              {daysSince}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                      <p className="text-xs text-gray-600 mb-1">Transacciones</p>
                                      <p className="text-lg font-bold text-gray-900">
                                        {clientDetails.transactionCount}
                                      </p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                      <p className="text-xs text-gray-600 mb-1">Ticket Promedio</p>
                                      <p className="text-lg font-bold text-gray-900">
                                        {formatCurrency(clientDetails.transactionCount > 0 
                                          ? clientDetails.totalSales / clientDetails.transactionCount 
                                          : 0
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Products List */}
                                  {clientDetails.products && clientDetails.products.length > 0 && (
                                    <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4">
                                      <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                        Productos Vendidos ({clientDetails.products.length})
                                      </h3>
                                      <div className="space-y-3">
                                        {(expandedClientProducts === expandedClient 
                                          ? clientDetails.products 
                                          : clientDetails.products.slice(0, 5)
                                        ).map((product, idx) => {
                                          const productPercentage = clientDetails.totalSales > 0 
                                            ? (product.totalSales / clientDetails.totalSales) * 100 
                                            : 0;
                                          return (
                                            <div key={idx} className="flex items-center gap-2 sm:gap-3">
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-700 font-medium truncate">
                                                  {product.productName}
                                                </p>
                                              </div>
                                              <span className="text-xs text-gray-600 w-14 sm:w-16 text-right flex-shrink-0">
                                                {product.units} unid
                                              </span>
                                              <div className="hidden sm:block w-24 flex-shrink-0">
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                  <div 
                                                    className="h-full bg-blue-400 rounded-full"
                                                    style={{ width: `${productPercentage}%` }}
                                                  ></div>
                                                </div>
                                              </div>
                                              <span className="text-xs font-semibold text-gray-900 w-24 sm:w-20 text-right flex-shrink-0">
                                                {formatCurrency(product.totalSales)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                        {clientDetails.products.length > 5 && (
                                          <button
                                            onClick={() => setExpandedClientProducts(
                                              expandedClientProducts === expandedClient ? null : expandedClient
                                            )}
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-center pt-2 w-full transition-colors"
                                            data-testid="button-toggle-client-products"
                                          >
                                            {expandedClientProducts === expandedClient 
                                              ? 'Ver menos' 
                                              : `+${clientDetails.products.length - 5} productos más`
                                            }
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Botón Ver más - solo si no hay búsqueda activa y hay más clientes */}
                  {!debouncedSearchTerm && clientsResponse && displayClients.length < clientsResponse.totalCount && (
                    <div className="flex justify-center pt-4 border-t border-gray-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                        data-testid="button-load-more-clients"
                      >
                        Ver más ({displayClients.length} de {clientsResponse.totalCount})
                      </Button>
                    </div>
                  )}
                  
                  {/* Total Row - solo si no hay búsqueda activa */}
                  {!debouncedSearchTerm && clientsWithPercentage.length > 0 && (
                    <div className="border-t-2 border-gray-300 pt-3 mt-4">
                      <div 
                        className="flex items-center gap-3 w-full bg-blue-50 rounded-lg py-3 px-2"
                        data-testid="clients-total"
                      >
                        {/* Nombre TOTAL */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-blue-900 font-bold">
                            TOTAL ({clientsWithPercentage.length} clientes)
                          </p>
                        </div>
                        
                        {/* Porcentaje */}
                        <span className="text-xs text-blue-700 font-semibold w-10 text-right flex-shrink-0">
                          100.0%
                        </span>
                        
                        {/* Barra completa */}
                        <div className="w-20 sm:w-32 flex-shrink-0">
                          <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full w-full"></div>
                          </div>
                        </div>
                        
                        {/* Monto total */}
                        <span className="text-sm font-bold text-blue-900 w-28 text-right flex-shrink-0">
                          {formatCurrency(periodTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Products Table */}
          <div className="space-y-4">
            {/* Header con búsqueda expandible */}
            {!isProductSearchExpanded ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Productos del Vendedor</h2>
                  
                  {/* Botón de lupa para expandir búsqueda */}
                  <button
                    onClick={() => setIsProductSearchExpanded(true)}
                    className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    data-testid="button-expand-product-search"
                    title="Buscar producto"
                  >
                    <Search className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Búsqueda expandida a ancho completo */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Productos del Vendedor</h2>
                  </div>
                  
                  {debouncedProductSearchTerm && (
                    <span className="text-sm text-gray-500">
                      {productsWithPercentage.length} resultado{productsWithPercentage.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Filtrar productos por nombre..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-green-500 rounded-lg shadow-sm"
                    data-testid="input-filter-products"
                    autoFocus
                  />
                  {productSearchTerm && (
                    <button
                      onClick={handleClearProductSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      data-testid="button-clear-product-filter"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
              {currentProductLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                      <div className="flex-1 mx-4">
                        <div className="h-6 bg-gray-200 rounded"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : productsWithPercentage.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">
                    {debouncedProductSearchTerm ? 'No se encontraron productos con ese nombre' : 'No hay productos para mostrar'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 transition-all duration-300 ease-in-out">
                    {productsWithPercentage.map((product, index) => {
                      const isExpanded = expandedProduct === product.productName;
                      
                      return (
                        <div
                          key={product.productName}
                          className="rounded-lg transition-colors"
                        >
                          <div 
                            className="flex items-center gap-2 sm:gap-3 w-full cursor-pointer hover:bg-gray-50/50 py-3 px-2 rounded-lg"
                            data-testid={`product-${index}`}
                            onClick={() => {
                              if (expandedProduct === product.productName) {
                                setExpandedProduct(null);
                              } else {
                                setExpandedProduct(product.productName);
                                setExpandedClient(null); // Close client accordion when opening product
                              }
                            }}
                          >
                            {/* Chevron icon */}
                            <div className="flex-shrink-0 w-5 h-5 text-gray-400">
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </div>
                            
                            {/* Nombre del producto completo */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 font-medium truncate">
                                {product.productName}
                              </p>
                            </div>
                            
                            {/* Porcentaje */}
                            <span className="text-xs text-gray-600 w-8 sm:w-10 text-right flex-shrink-0">
                              {product.percentage.toFixed(1)}%
                            </span>
                            
                            {/* Barra de progreso delgada y corta */}
                            <div className="hidden sm:block w-20 sm:w-32 flex-shrink-0">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${product.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {/* Monto */}
                            <span className="text-sm font-semibold text-gray-900 w-20 sm:w-28 text-right flex-shrink-0">
                              {formatCurrency(product.totalSales)}
                            </span>
                          </div>
                          
                          {/* Expanded Product Details Section */}
                          {isExpanded && (
                            <div className="mt-2 bg-green-50 rounded-lg p-4 border border-green-200 animate-in slide-in-from-top-2 duration-300">
                              {isLoadingProductDetails ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {[...Array(4)].map((_, i) => (
                                    <div key={i} className="animate-pulse">
                                      <div className="h-4 bg-green-200 rounded w-20 mb-2"></div>
                                      <div className="h-6 bg-green-200 rounded w-full"></div>
                                    </div>
                                  ))}
                                </div>
                              ) : productDetailsError ? (
                                <div className="text-center py-4">
                                  <p className="text-sm text-red-600">Error al cargar detalles del producto</p>
                                </div>
                              ) : productDetails ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-xs text-green-700 font-medium mb-1">Total Vendido</p>
                                      <p className="text-lg font-bold text-green-900">{formatCurrency(productDetails.totalSales)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-green-700 font-medium mb-1">Unidades</p>
                                      <p className="text-lg font-bold text-green-900">{productDetails.totalUnits.toFixed(0)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-green-700 font-medium mb-1">Transacciones</p>
                                      <p className="text-lg font-bold text-green-900">{productDetails.transactionCount}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-green-700 font-medium mb-1">Cliente Principal</p>
                                      {productDetails.topClient ? (
                                        <div>
                                          <p className="text-sm font-semibold text-green-900 truncate">{productDetails.topClient.name}</p>
                                          <p className="text-xs text-green-700">{formatCurrency(productDetails.topClient.amount)}</p>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-green-700">Sin datos</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Botón Ver más - solo si no hay búsqueda activa y hay más productos */}
                  {!debouncedProductSearchTerm && productsResponse && displayProducts.length < productsResponse.totalCount && (
                    <div className="flex justify-center pt-4 border-t border-gray-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMoreProducts}
                        className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                        data-testid="button-load-more-products"
                      >
                        Ver más ({displayProducts.length} de {productsResponse.totalCount})
                      </Button>
                    </div>
                  )}
                  
                  {/* Total Row - solo si no hay búsqueda activa */}
                  {!debouncedProductSearchTerm && productsWithPercentage.length > 0 && (
                    <div className="border-t-2 border-gray-300 pt-3 mt-4">
                      <div 
                        className="flex items-center gap-3 w-full bg-green-50 rounded-lg py-3 px-2"
                        data-testid="products-total"
                      >
                        {/* Nombre TOTAL */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-green-900 font-bold">
                            TOTAL ({productsWithPercentage.length} productos)
                          </p>
                        </div>
                        
                        {/* Porcentaje */}
                        <span className="text-xs text-green-700 font-semibold w-10 text-right flex-shrink-0">
                          100.0%
                        </span>
                        
                        {/* Barra completa */}
                        <div className="w-20 sm:w-32 flex-shrink-0">
                          <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-600 rounded-full w-full"></div>
                          </div>
                        </div>
                        
                        {/* Monto total */}
                        <span className="text-sm font-bold text-green-900 w-28 text-right flex-shrink-0">
                          {formatCurrency(productPeriodTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Packaging Sales Metrics - Total Facturado x Unidades for this salesperson */}
          {salespersonName && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <PackagingSalesMetrics
                selectedPeriod={selectedPeriod}
                filterType={filterType}
                salesperson={salespersonName}
              />
            </div>
          )}

          {/* Recent Transactions - Últimas Órdenes */}
          {salespersonName && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Últimas Órdenes</h2>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200/60 shadow-sm overflow-hidden">
                {isLoadingRecentTransactions ? (
                  <div className="p-6">
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-4 bg-gray-200 rounded flex-1"></div>
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                          <div className="h-4 bg-gray-200 rounded w-20"></div>
                          <div className="h-4 bg-gray-200 rounded w-28"></div>
                          <div className="h-4 bg-gray-200 rounded w-16"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-gray-500 text-sm">No hay transacciones recientes para mostrar</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="font-semibold text-gray-700">Fecha</TableHead>
                          <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                          <TableHead className="font-semibold text-gray-700">Producto</TableHead>
                          <TableHead className="font-semibold text-gray-700 text-right">Cantidad</TableHead>
                          <TableHead className="font-semibold text-gray-700 text-right">Monto</TableHead>
                          <TableHead className="font-semibold text-gray-700 text-center">Tipo Doc</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentTransactions.map((transaction, index) => (
                          <TableRow 
                            key={index}
                            className="hover:bg-gray-50/50 transition-colors"
                            data-testid={`recent-transaction-${index}`}
                          >
                            <TableCell className="font-medium text-sm text-gray-900">
                              {transaction.date ? format(new Date(transaction.date), "dd/MM/yyyy", { locale: es }) : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-700 max-w-xs truncate">
                              {transaction.client || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-700 max-w-md truncate">
                              {transaction.product || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-900 text-right font-medium">
                              {transaction.quantity.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-gray-900 text-right font-semibold">
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={transaction.docType === 'FCV' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {transaction.docType}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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