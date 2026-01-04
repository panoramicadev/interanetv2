import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useFilter } from "@/contexts/FilterContext";
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
import AllSalespeopleNVV from "@/components/dashboard/all-salespeople-nvv";
import { Button } from "@/components/ui/button";
import { CardWrapper } from "@/components/dashboard/CardWrapper";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Filter, Target, Building, Users, TrendingUp, Settings2, X, RefreshCw, Eye, AlertCircle, DollarSign, ChevronDown, ShoppingCart, Truck, Search, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import panoramicaLogo from "@assets/Diseno-sin-titulo-12-1-e1733933035809_1759422274944.webp";

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
  
  const filterType: "day" | "month" | "year" | "range" = (() => {
    if (selection.period === "day" || selection.period === "days") return "day";
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
    return undefined;
  })();
  
  // Filter selector state
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  
  // Client search state
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  
  // Comparison period state
  const [comparePeriod, setComparePeriod] = useState<string>("none");
  
  // Detect comparative mode (multiple periods selected)
  const isComparativeMode = (() => {
    // Multiple months selected
    if (selection.period === "months" && selection.months && selection.months.length > 1) return true;
    // Multiple years with month(s) selected (mes-a-año comparison)
    if ((selection.period === "month" || selection.period === "months") && selection.years.length > 1) return true;
    // Multiple days selected
    if (selection.period === "days" && selection.days && selection.days.length > 1) return true;
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
    } else if (selection.period === "days" && selection.days && selection.months && selection.months.length > 0) {
      const month = selection.months[0]; // Use first month from months array (1-12)
      selection.days.forEach(day => {
        selection.years.forEach(year => {
          const date = new Date(year, month - 1, day); // month - 1 for Date object
          const dateLabel = format(date, "dd MMM yyyy");
          periods.push({
            period: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            label: dateLabel,
            filterType: "day"
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

  // Query to fetch pending expenses (estado = "pendiente")
  const { data: pendingExpenses = [] } = useQuery<any[]>({
    queryKey: ['/api/gastos-empresariales', 'pendiente'],
    queryFn: async () => {
      const res = await fetch('/api/gastos-empresariales?estado=pendiente', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
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
    }
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

  // Auto-configure salesperson view when a salesperson logs in
  useEffect(() => {
    if (user && user.role === 'salesperson' && globalFilter.type === 'all') {
      // Get salesperson name from fullName or salespersonName
      const salespersonName = user.fullName || user.salespersonName;
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

  // Si hay un segmento seleccionado, mostrar el dashboard del segmento embedido
  if (globalFilter.type === "segment" && globalFilter.value) {
    const handleBack = () => {
      setGlobalFilter({ type: "all" });
      setSelectedFilter("all");
    };
    
    const handleSegmentChange = (newSegment: string) => {
      setGlobalFilter({ type: "segment", value: newSegment });
    };
    
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
    
    return (
      <SegmentDetail 
        key={globalFilter.value} // Force remount when segment changes
        segmentName={globalFilter.value} 
        embedded={true}
        onBack={handleBack}
        onSegmentChange={handleSegmentChange}
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

  // Si hay una sucursal seleccionada, mostrar el dashboard de la sucursal embedido
  if (globalFilter.type === "branch" && globalFilter.value) {
    const handleBack = () => {
      setGlobalFilter({ type: "all" });
      setSelectedFilter("all");
    };
    
    const handleBranchChange = (newBranch: string) => {
      setGlobalFilter({ type: "branch", value: newBranch });
    };
    
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
    
    return (
      <SucursalDetail 
        key={globalFilter.value} // Force remount when branch changes
        branchName={globalFilter.value} 
        embedded={true}
        onBack={handleBack}
        onBranchChange={handleBranchChange}
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

  // Si hay un vendedor seleccionado, mostrar el dashboard del vendedor embedido
  if (globalFilter.type === "salesperson" && globalFilter.value) {
    // Only allow back if user is not a salesperson (admin/supervisor can navigate back)
    const canNavigateBack = user?.role !== 'salesperson';
    
    const handleBack = () => {
      if (canNavigateBack) {
        setGlobalFilter({ type: "all" });
        setSelectedFilter("all");
      }
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
      const newSelection = convertToSelection(newFilterType, newPeriod, newDate, newYear, newRange);
      setSelection(newSelection);
    };
    
    return (
      <SalespersonDetail 
        key={globalFilter.value} // Force remount when salesperson changes
        salespersonName={globalFilter.value} 
        embedded={true}
        onBack={canNavigateBack ? handleBack : undefined}
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

  // Si hay un cliente seleccionado, mostrar el dashboard filtrado por cliente
  // (no usa componente embedido, usa los mismos componentes del dashboard principal con filtro de cliente)
  const selectedClient = globalFilter.type === "client" && globalFilter.value ? globalFilter.value : undefined;

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
                    {selection.display}
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
                      {/* Vista Section - PRIMERO */}
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
                                // Clear the value when changing filter type to avoid showing wrong data
                                if (value === "all") {
                                  setLocalGlobalFilter({ type: "all" });
                                } else if (value === "segment") {
                                  setLocalGlobalFilter({ type: "segment", value: undefined });
                                } else if (value === "branch") {
                                  setLocalGlobalFilter({ type: "branch", value: undefined });
                                } else if (value === "salesperson") {
                                  setLocalGlobalFilter({ type: "salesperson", value: undefined });
                                } else if (value === "client") {
                                  setLocalGlobalFilter({ type: "client", value: undefined });
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
                                <SelectItem value="branch">
                                  <div className="flex items-center space-x-2">
                                    <Building className="h-4 w-4 text-blue-500" />
                                    <span>Por sucursal</span>
                                  </div>
                                </SelectItem>
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
                                  if (localSelectedFilter === "segment") {
                                    setLocalGlobalFilter({ type: "segment", value });
                                  } else if (localSelectedFilter === "branch") {
                                    setLocalGlobalFilter({ type: "branch", value });
                                  } else if (localSelectedFilter === "salesperson") {
                                    setLocalGlobalFilter({ type: "salesperson", value });
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
                                    ["CONCEPCION", "SANTIAGO"].map((branch) => (
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
                          
                          {localSelectedFilter === "client" && (
                            <div>
                              <label className="text-sm font-medium text-gray-700 block mb-2">
                                Buscar cliente
                              </label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  type="text"
                                  placeholder="Buscar por nombre..."
                                  value={clientSearchTerm}
                                  onChange={(e) => setClientSearchTerm(e.target.value)}
                                  className="h-11 pl-10 pr-10 w-full rounded-xl border-gray-200"
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
                                          className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                                            localGlobalFilter.value === client.nokoen ? 'bg-blue-50' : ''
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
                        </div>
                      </div>
                      
                      <Separator />
                      
                      {/* Período Section - SEGUNDO */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                          <CalendarIcon className="h-4 w-4" />
                          <span>Período de tiempo</span>
                        </div>
                        
                        <div className="space-y-3">
                          <YearMonthSelector
                            value={localSelection}
                            onChange={setLocalSelection}
                          />
                          
                          {/* Explicación de cómo funciona - Fuera del selector */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                            <div className="flex items-start space-x-2">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">?</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-blue-900 font-semibold mb-1">¿Cómo funciona?</p>
                                <p className="text-xs text-blue-800 leading-relaxed">
                                  Selecciona uno o más años, luego elige el período: mes específico, varios meses, un día, o año completo. 
                                  Puedes comparar el mismo período en diferentes años.
                                </p>
                              </div>
                            </div>
                          </div>
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
            /* Desktop Layout */
            <div className="space-y-4 w-full">
              {/* All filters in one line */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Vista */}
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">Vista:</span>
                  <Select 
                    value={selectedFilter} 
                    onValueChange={(value) => {
                      setSelectedFilter(value);
                      // Clear the value when changing filter type to avoid showing wrong data
                      if (value === "all") {
                        setGlobalFilter({ type: "all" });
                      } else if (value === "segment") {
                        setGlobalFilter({ type: "segment", value: undefined });
                      } else if (value === "branch") {
                        setGlobalFilter({ type: "branch", value: undefined });
                      } else if (value === "salesperson") {
                        setGlobalFilter({ type: "salesperson", value: undefined });
                      } else if (value === "client") {
                        setGlobalFilter({ type: "client", value: undefined });
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-48 rounded-lg border-gray-200 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-gray-200" sideOffset={4}>
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
                          ["CONCEPCION", "SANTIAGO"].map((branch) => (
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
                                      className={`mr-2 h-4 w-4 ${
                                        globalFilter.value === client.nokoen ? "opacity-100" : "opacity-0"
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
                                      className={`mr-2 h-4 w-4 ${
                                        globalFilter.value === client.clientName ? "opacity-100" : "opacity-0"
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
                      Vista: {selectedFilter === "all" ? "Todo el dashboard" : 
                             selectedFilter === "segment" ? "Por segmento" :
                             selectedFilter === "branch" ? "Por sucursal" : 
                             selectedFilter === "salesperson" ? "Por vendedor" : "Por cliente"}
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

                {globalFilter.value && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded border border-green-200">
                    <div className="h-3 w-3 text-green-600 flex-shrink-0 rounded-full bg-green-200" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-green-900">
                        {selectedFilter === "segment" && `Segmento: ${globalFilter.value}`}
                        {selectedFilter === "branch" && `Sucursal: ${globalFilter.value}`}
                        {selectedFilter === "salesperson" && `Vendedor: ${globalFilter.value}`}
                        {selectedFilter === "client" && `Cliente: ${globalFilter.value}`}
                      </div>
                    </div>
                  </div>
                )}
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
          
          {/* Comparative Mode Layout */}
          {isComparativeMode ? (
            <>
              {/* Comparative KPI Cards */}
              <div>
                <ComparativeKPICards 
                  periods={comparativePeriods}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                />
              </div>

              {/* Total Acumulado */}
              <ComparativeAccumulatedTotal 
                periods={comparativePeriods}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                client={selectedClient}
              />

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
                  comparePeriod={comparePeriod}
                />
              </div>
              
              {/* Goals Progress Dashboard - Solo mostrar para meses completos y cuando hay metas configuradas */}
              {filterType === "month" && goalsProgress && goalsProgress.length > 0 && (
                <CardWrapper>
                  <GoalsProgress 
                    globalFilter={globalFilter}
                    selectedPeriod={selectedPeriod}
                  />
                </CardWrapper>
              )}

              {/* NVV y GDV Pendientes - Solo mostrar cuando hay un vendedor seleccionado Y estamos en el mes actual */}
              {globalFilter.type === "salesperson" && globalFilter.value && isCurrentMonth() && (
                <div className="space-y-4">
                  {/* NVV Colapsable */}
                  <CollapsibleNVVSection salesperson={globalFilter.value} />
                  
                  {/* GDV Colapsable */}
                  <CollapsibleGDVSection salesperson={globalFilter.value} />
                </div>
              )}

              {/* NVV Pendientes - Todos los vendedores (solo en mes actual, cuando NO hay vendedor específico seleccionado, y NO hay cliente seleccionado) */}
              {globalFilter.type !== "salesperson" && isCurrentMonth() && !selectedClient && (
                <CardWrapper>
                  <AllSalespeopleNVV
                    selectedPeriod={selectedPeriod}
                    filterType={filterType}
                  />
                </CardWrapper>
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

              {/* Products Chart */}
              <CardWrapper>
                <TopProductsChart 
                  selectedPeriod={selectedPeriod} 
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                />
              </CardWrapper>

              {/* Sales Team & Client Analytics - Full Width Column */}
              <CardWrapper>
                <TopSalespeoplePanel 
                  selectedPeriod={selectedPeriod} 
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
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
                  />
                </CardWrapper>
              )}

              {/* Packaging Metrics - Full Width */}
              <CardWrapper>
                <PackagingSalesMetrics 
                  selectedPeriod={selectedPeriod} 
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                />
              </CardWrapper>

              {/* Transactions - Full Width - Only in non-comparative mode */}
              <CardWrapper>
                <TransactionsTable 
                  selectedPeriod={selectedPeriod} 
                  filterType={filterType}
                  segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                  salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
                  client={selectedClient}
                />
              </CardWrapper>
            </>
          )}
        </main>
    </div>
  );
}
