import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Loader2,
  X
} from "lucide-react";
import { format } from "date-fns";
import SalesProjectionCard from "@/components/dashboard/sales-projection-card";
import MargenResumenCard from "@/components/dashboard/margen-resumen-card";
import { useFilter } from "@/contexts/FilterContext";
import { mesEs, mesEsCapitalizado, mesAnioEs } from "@/lib/fecha-es";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";

interface SalesMetrics {
  totalSales: number;
  totalTransactions: number;
  totalOrders: number;
  totalUnits: number;
  activeCustomers: number;
  gdvSales: number;
  newClients?: number;
  previousMonthSales?: number;
  previousMonthTransactions?: number;
  previousMonthOrders?: number;
  previousMonthUnits?: number;
  previousMonthCustomers?: number;
  previousMonthGdvSales?: number;
  previousNewClients?: number;
}

interface NvvMetrics {
  totalAmount: number;
  totalQuantity: number;
  pendingCount: number;
  confirmedCount: number;
  deliveredCount: number;
  cancelledCount: number;
}

/**
 * Segmentos que en la planilla de presupuesto están guardados con otro nombre.
 *
 * Los segmentos de las ventas y las categorías del presupuesto se escriben distinto en
 * dos casos: INDUSTRIAL quedó en la planilla como "FABRICACION MODULAR" (su nombre
 * antiguo) y DIGITAL como "CANALES DIGITALES". Como la tarjeta buscaba la meta exigiendo
 * el mismo nombre exacto, con esos dos filtros no encontraba ningún presupuesto, la meta
 * quedaba en cero y "Meta a la Fecha" y "Diferencia" desaparecían de la tarjeta
 * (reporte del usuario, ago-2026). Los otros cuatro segmentos con presupuesto cargado
 * —CONSTRUCCION, FERRETERIAS, MCT y PANORAMICA STORE— sí calzan por nombre.
 *
 * Si mañana se renombra un segmento en la planilla, la equivalencia se agrega acá.
 */
const CATEGORIAS_PRESUPUESTO_POR_SEGMENTO: Record<string, string[]> = {
  "INDUSTRIAL": ["INDUSTRIAL", "FABRICACION MODULAR", "FABRICACIÓN MODULAR"],
  "DIGITAL": ["DIGITAL", "CANALES DIGITALES"],
};

/** ¿Esta categoría del presupuesto corresponde al segmento que se está mirando? */
const categoriaPresupuestoCoincide = (categoria: string, segmento: string): boolean => {
  const equivalentes = CATEGORIAS_PRESUPUESTO_POR_SEGMENTO[segmento.toUpperCase()] ?? [segmento];
  return equivalentes.some((nombre) => nombre.toLowerCase() === categoria.toLowerCase());
};

interface KPICardsProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
  comparePeriod?: string;
  onShowNewClients?: () => void;
}

interface NewClientItem {
  clientName: string;
  totalSales: number;
  totalUnits: number;
  orderCount: number;
  firstPurchaseDate: string;
  salesperson: string;
}

export default function KPICards({ selectedPeriod, filterType, segment, salesperson, client, product, comparePeriod, onShowNewClients }: KPICardsProps) {
  const [showNewClientsModal, setShowNewClientsModal] = useState(false);
  const [isProjectionModalOpen, setIsProjectionModalOpen] = useState(false);
  // Modo Facturado / Combinado compartido con la tarjeta de meta (arranca en Combinado)
  const { showCombined, setShowCombined } = useFilter();

  // Helper function to resolve comparison periods to actual period strings
  const resolveComparisonPeriod = (comparePeriod: string, currentPeriod: string, filterType: string): string => {
    if (!comparePeriod || comparePeriod === "none") return "";

    // If it's already a specific period like "2025-08", "2025", "2025-08-15", or a range, return as is
    if (comparePeriod.match(/^\d{4}-\d{2}$/) || comparePeriod.match(/^\d{4}$/) || comparePeriod.match(/^\d{4}-\d{2}-\d{2}$/) || comparePeriod.includes('_')) {
      return comparePeriod;
    }

    // Parse current period to determine comparison period
    switch (comparePeriod) {
      // DAY comparisons
      case "previous-day": {
        if (filterType === "day" && currentPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const currentDate = new Date(currentPeriod);
          currentDate.setDate(currentDate.getDate() - 1);
          const result = currentDate.toISOString().split('T')[0];
          return result;
        }
        break;
      }
      case "previous-week": {
        if (filterType === "day" && currentPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const currentDate = new Date(currentPeriod);
          currentDate.setDate(currentDate.getDate() - 7);
          const result = currentDate.toISOString().split('T')[0];
          return result;
        }
        break;
      }
      case "same-day-last-week": {
        if (filterType === "day" && currentPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const currentDate = new Date(currentPeriod);
          currentDate.setDate(currentDate.getDate() - 7);
          const result = currentDate.toISOString().split('T')[0];
          return result;
        }
        break;
      }
      case "same-day-last-month": {
        if (filterType === "day" && currentPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const currentDate = new Date(currentPeriod);
          currentDate.setMonth(currentDate.getMonth() - 1);
          const result = currentDate.toISOString().split('T')[0];
          return result;
        }
        break;
      }

      // MONTH comparisons
      case "previous-month": {
        if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = currentPeriod.split('-').map(Number);
          const currentDate = new Date();

          // Siempre comparar hasta el día actual (del mes actual)
          const dayOfMonth = currentDate.getDate();
          const previousMonthDate = new Date(year, month - 2, 1); // mes anterior
          const fromDate = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1);
          const toDate = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), dayOfMonth);
          const result = `${format(fromDate, 'yyyy-MM-dd')}_${format(toDate, 'yyyy-MM-dd')}`;
          return result;
        }
        break;
      }
      case "same-month-last-year": {
        if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = currentPeriod.split('-').map(Number);
          const currentDate = new Date();

          // Siempre comparar hasta el día actual (del mes actual) en el año anterior
          const dayOfMonth = currentDate.getDate();
          const fromDate = new Date(year - 1, month - 1, 1);
          const toDate = new Date(year - 1, month - 1, dayOfMonth);
          const result = `${format(fromDate, 'yyyy-MM-dd')}_${format(toDate, 'yyyy-MM-dd')}`;
          return result;
        }
        break;
      }

      // YEAR comparisons
      case "previous-year": {
        if (filterType === "year" && currentPeriod.match(/^\d{4}$/)) {
          const result = `${parseInt(currentPeriod) - 1}`;
          return result;
        }
        break;
      }

      // RANGE comparisons
      case "previous-30-days": {
        if (filterType === "range" && currentPeriod.includes('_')) {
          const [fromStr] = currentPeriod.split('_');
          const fromDate = new Date(fromStr);
          const toDate = new Date(fromDate);
          toDate.setDate(toDate.getDate() - 1); // End is one day before the current range start
          const newFromDate = new Date(toDate);
          newFromDate.setDate(newFromDate.getDate() - 29); // 30 days total
          const result = `${newFromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}`;
          return result;
        }
        break;
      }
      case "previous-90-days": {
        if (filterType === "range" && currentPeriod.includes('_')) {
          const [fromStr] = currentPeriod.split('_');
          const fromDate = new Date(fromStr);
          const toDate = new Date(fromDate);
          toDate.setDate(toDate.getDate() - 1); // End is one day before the current range start
          const newFromDate = new Date(toDate);
          newFromDate.setDate(newFromDate.getDate() - 89); // 90 days total
          const result = `${newFromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}`;
          return result;
        }
        break;
      }
      case "same-period-last-year": {
        if (filterType === "range" && currentPeriod.includes('_')) {
          const [fromStr, toStr] = currentPeriod.split('_');
          const fromDate = new Date(fromStr);
          const toDate = new Date(toStr);
          fromDate.setFullYear(fromDate.getFullYear() - 1);
          toDate.setFullYear(toDate.getFullYear() - 1);
          const result = `${fromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}`;
          return result;
        }
        break;
      }
      case "same-range-previous-period": {
        if (filterType === "range" && currentPeriod.includes('_')) {
          const [fromStr, toStr] = currentPeriod.split('_');
          const fromDate = new Date(fromStr);
          const toDate = new Date(toStr);
          const durationDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
          const newToDate = new Date(fromDate);
          newToDate.setDate(newToDate.getDate() - 1);
          const newFromDate = new Date(newToDate);
          newFromDate.setDate(newFromDate.getDate() - durationDays);
          const result = `${newFromDate.toISOString().split('T')[0]}_${newToDate.toISOString().split('T')[0]}`;
          return result;
        }
        break;
      }
      case "same-range-previous-month": {
        if (filterType === "range" && currentPeriod.includes('_')) {
          const [fromStr, toStr] = currentPeriod.split('_');
          const fromDate = new Date(fromStr);
          const toDate = new Date(toStr);
          const newFromDate = new Date(fromDate);
          newFromDate.setMonth(newFromDate.getMonth() - 1);
          const newToDate = new Date(toDate);
          newToDate.setMonth(newToDate.getMonth() - 1);
          const result = `${newFromDate.toISOString().split('T')[0]}_${newToDate.toISOString().split('T')[0]}`;
          return result;
        }
        break;
      }
      case "same-range-previous-year": {
        if (filterType === "range" && currentPeriod.includes('_')) {
          const [fromStr, toStr] = currentPeriod.split('_');
          const fromDate = new Date(fromStr);
          const toDate = new Date(toStr);
          const newFromDate = new Date(fromDate);
          newFromDate.setFullYear(newFromDate.getFullYear() - 1);
          const newToDate = new Date(toDate);
          newToDate.setFullYear(newToDate.getFullYear() - 1);
          const result = `${newFromDate.toISOString().split('T')[0]}_${newToDate.toISOString().split('T')[0]}`;
          return result;
        }
        break;
      }
    }

    return ""; // Return empty string if no pattern matches to prevent errors
  };

  const resolvedComparePeriod = resolveComparisonPeriod(comparePeriod || "", selectedPeriod, filterType);

  const { data: metrics, isLoading } = useQuery<SalesMetrics>({
    queryKey: ['/api/sales/metrics', selectedPeriod, filterType, segment, salesperson, client, product],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (product) params.append('product', product);
      const res = await fetch(`/api/sales/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  // Query for comparison data if comparePeriod is set
  const { data: comparisonMetrics } = useQuery<SalesMetrics>({
    queryKey: ['/api/sales/metrics', resolvedComparePeriod, filterType, segment, salesperson, client, product, 'comparison'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', resolvedComparePeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (product) params.append('product', product);
      const res = await fetch(`/api/sales/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!resolvedComparePeriod, // Only run if resolved period is set
  });

  // Query for NVV metrics with filters
  const { data: nvvMetrics } = useQuery<{
    totalAmount: number;
    totalQuantity: number;
    pendingCount: number;
    confirmedCount: number;
    deliveredCount: number;
    cancelledCount: number;
  }>({
    queryKey: ['/api/nvv/metrics', selectedPeriod, filterType, segment, salesperson, client, product],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (product) params.append('product', product);
      const res = await fetch(`/api/nvv/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query for NVV global total (no date filters) - always shows total pending
  const { data: nvvGlobalMetrics } = useQuery<{
    totalAmount: number;
    totalQuantity: number;
    pendingCount: number;
    confirmedCount: number;
    deliveredCount: number;
    cancelledCount: number;
  }>({
    queryKey: ['/api/nvv/metrics', 'global', segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      // No period/filterType params - returns all historical data
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/nvv/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query for GDV global total (no date filters) - always shows total pending
  const { data: gdvGlobalMetrics } = useQuery<{
    gdvSales: number;
    gdvCount: number;
  }>({
    queryKey: ['/api/sales/gdv-pending', 'global', segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      // No period/filterType params - returns all pending GDV
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/sales/gdv-pending?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Determine YTD range parameters based on selectedPeriod and filterType
  const getYtdParams = () => {
    const today = new Date();
    let year = today.getFullYear();
    let endDateStr = today.toISOString().split('T')[0];

    if (filterType === 'month' && selectedPeriod.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = selectedPeriod.split('-').map(Number);
      year = y;
      if (y === today.getFullYear() && m === today.getMonth() + 1) {
        endDateStr = today.toISOString().split('T')[0];
      } else {
        const lastDay = new Date(y, m, 0).getDate();
        endDateStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (filterType === 'day' && selectedPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
      year = Number(selectedPeriod.split('-')[0]);
      endDateStr = selectedPeriod;
    } else if (filterType === 'year' && selectedPeriod.match(/^\d{4}$/)) {
      year = Number(selectedPeriod);
      if (year === today.getFullYear()) {
        endDateStr = today.toISOString().split('T')[0];
      } else {
        endDateStr = `${year}-12-31`;
      }
    } else if (filterType === 'range' && selectedPeriod.includes('_')) {
      const parts = selectedPeriod.split('_');
      endDateStr = parts[1] || parts[0];
      year = Number(endDateStr.split('-')[0]);
    }

    return {
      year: String(year),
      endDateStr,
      rangeStr: `${year}-01-01_${endDateStr}`
    };
  };

  const { year: currentYearStr, endDateStr: ytdEndDateStr, rangeStr: ytdRangeStr } = getYtdParams();


  const { data: yearlyTotals } = useQuery<{
    currentYearTotal: number;
    previousYearTotal: number;
    comparisonYear: number;
    comparisonDate: string;
    isYTD: boolean;
  }>({
    queryKey: ['/api/sales/yearly-totals', segment, salesperson, client, product, ytdEndDateStr],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (product) params.append('product', product);
      if (ytdEndDateStr) params.append('endDateStr', ytdEndDateStr);
      const res = await fetch(`/api/sales/yearly-totals?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query for NVV yearly total (current year up to selected period)
  const { data: nvvYearlyMetrics } = useQuery<{
    totalAmount: number;
    totalQuantity: number;
    pendingCount: number;
    confirmedCount: number;
    deliveredCount: number;
    cancelledCount: number;
  }>({
    queryKey: ['/api/nvv/metrics', 'yearly-range', ytdRangeStr, segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', ytdRangeStr);
      params.append('filterType', 'range');
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/nvv/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query for GDV yearly total (current year up to selected period) - uses sales metrics filtered to GDV only
  const { data: gdvYearlyMetrics } = useQuery<SalesMetrics>({
    queryKey: ['/api/sales/metrics', ytdRangeStr, 'range', segment, salesperson, client, 'gdv-yearly'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', ytdRangeStr);
      params.append('filterType', 'range');
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/sales/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query for best year historical (with filters for segment, salesperson, client)
  const { data: bestYear } = useQuery<{
    bestYear: number;
    bestYearTotal: number;
  }>({
    queryKey: ['/api/sales/best-year', segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/sales/best-year?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  const { data: newClientsList, isLoading: isLoadingNewClients } = useQuery<NewClientItem[]>({
    queryKey: ['/api/sales/new-clients', selectedPeriod, filterType, segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/sales/new-clients?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: showNewClientsModal,
  });

  // Query for current year budget
  const { data: budgetData } = useQuery<any[]>({
    queryKey: ['/api/presupuesto-ventas', currentYearStr],
    queryFn: async () => {
      const res = await fetch(`/api/presupuesto-ventas?anio=${currentYearStr}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

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

  if (isLoading && !metrics) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="modern-card p-3 sm:p-6">
            <div className="skeleton h-3 sm:h-4 mb-2"></div>
            <div className="skeleton h-6 sm:h-8 mb-1"></div>
            <div className="skeleton h-2 sm:h-3 w-16 sm:w-24"></div>
          </div>
        ))}
      </div>
    );
  }

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

    // For year filter or range, don't show NVV/GDV (only current month matters)
    return false;
  };

  // Helper function to get period label for comparison
  const getPeriodLabel = (period: string, filterType: string): string => {
    const now = new Date();

    if (filterType === "month" && period.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = period.split('-').map(Number);
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // If it's the current month, show "1-9 de octubre" format
      if (year === currentYear && month === currentMonth) {
        const currentDay = now.getDate();
        return `1-${currentDay} de ${mesEs(month - 1)}`;
      } else {
        // Past month, show full month
        return mesAnioEs(month - 1, year);
      }
    }

    return period;
  };

  // Calculate percentage changes vs same period in previous year (year-over-year)
  const calculateChange = (current: number, previous: number | undefined) => {
    // Generate year-over-year comparison text based on filter type (always show this)
    let comparisonText = "";

    if (filterType === "month" && selectedPeriod.match(/^\d{4}-\d{2}$/)) {
      // Month comparison: "vs Octubre 2024" or "vs Octubre 2024 al 15/12" for current month
      const [year, month] = selectedPeriod.split('-').map(Number);
      const previousYear = year - 1;
      const monthName = mesEsCapitalizado(month - 1);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // If it's the current month, add "al DD/MM" to indicate partial comparison
      if (year === currentYear && month === currentMonth) {
        const dayOfMonth = now.getDate();
        comparisonText = `vs ${monthName} ${previousYear} al ${dayOfMonth}/${String(month).padStart(2, '0')}`;
      } else {
        comparisonText = `vs ${monthName} ${previousYear}`;
      }
    } else if (filterType === "day" && selectedPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Day comparison: "vs 28 de octubre 2024"
      const [year, month, day] = selectedPeriod.split('-').map(Number);
      const previousYear = year - 1;
      comparisonText = `vs ${day} de ${mesEs(month - 1)} ${previousYear}`;
    } else if (filterType === "year") {
      // Year comparison: "vs 2024"
      const year = parseInt(selectedPeriod.split('-')[0]);
      const previousYear = year - 1;
      comparisonText = `vs ${previousYear}`;
    } else {
      // Default fallback
      comparisonText = "vs año anterior";
    }

    // Check if we have previous data
    if (previous === undefined || previous === null || previous === 0) {
      return {
        percentage: "Sin datos previos",
        comparisonText: comparisonText, // Always return comparison text
        color: "text-gray-500"
      };
    }

    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    const color = change >= 0 ? "text-[#fd6301]" : "text-red-600";

    return {
      percentage: `${sign}${change.toFixed(1)}%`,
      comparisonText: comparisonText,
      color
    };
  };

  // Calculate amount changes vs comparison period
  const calculateComparisonChange = (current: number, comparison: number | undefined, isCurrency: boolean = true) => {
    if (!comparePeriod || comparePeriod === "none" || comparison === undefined || comparison === null) {
      return null;
    }

    const difference = current - comparison;
    const sign = difference >= 0 ? "+" : "";
    const color = difference >= 0 ? "text-[#fd6301]" : "text-red-600";
    const formattedDiff = isCurrency ? formatCurrency(Math.abs(difference)) : formatNumber(Math.abs(difference));

    return {
      text: `${sign}${formattedDiff}`,
      color,
      value: difference
    };
  };

  const salesChange = calculateChange(metrics?.totalSales || 0, metrics?.previousMonthSales);
  const unitsChange = calculateChange(metrics?.totalUnits || 0, metrics?.previousMonthUnits);
  const newClientsChange = calculateChange(metrics?.newClients || 0, metrics?.previousNewClients !== undefined && metrics?.previousNewClients !== null ? metrics.previousNewClients : undefined);

  // Calculate year-over-year change for yearly totals (YTD comparison)
  const currentYearTotal = yearlyTotals?.currentYearTotal || 0;
  const previousYearTotal = yearlyTotals?.previousYearTotal || 0;

  // Custom calculation for YTD comparison with proper text using API data
  const calculateYearlyChange = (
    current: number,
    previous: number,
    comparisonYear?: number,
    comparisonDate?: string,
    isYTD?: boolean
  ) => {
    if (previous === undefined || previous === null || previous === 0) {
      return {
        percentage: "Sin datos previos",
        comparisonText: "",
        color: "text-gray-500"
      };
    }

    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    const color = change >= 0 ? "text-[#fd6301]" : "text-red-600";

    // Build comparison text from API data
    let comparisonText = "";
    if (isYTD && comparisonDate && comparisonYear) {
      const monthDay = format(new Date(comparisonDate), 'dd/MM');
      comparisonText = `vs ${comparisonYear} al ${monthDay}`;
    } else if (comparisonYear) {
      comparisonText = `vs ${comparisonYear}`;
    }

    return {
      percentage: `${sign}${change.toFixed(1)}%`,
      comparisonText,
      color
    };
  };

  const yearlyChange = calculateYearlyChange(
    currentYearTotal,
    previousYearTotal,
    yearlyTotals?.comparisonYear,
    yearlyTotals?.comparisonDate,
    yearlyTotals?.isYTD
  );

  const salesComparison = calculateComparisonChange(metrics?.totalSales || 0, comparisonMetrics?.totalSales, true);

  const kpis = [
    {
      title: "Ventas Totales",
      value: formatCurrency(metrics?.totalSales || 0),
      change: salesChange,
      changeColor: salesChange.color,
      comparison: salesComparison,
      icon: DollarSign,
      bgColor: ICONO_CHIP,
      iconColor: ICONO_CHIP_ICONO,
      testId: "kpi-total-sales"
    },
    {
      title: "Total Acumulado del Año",
      value: formatCurrency(currentYearTotal),
      change: yearlyChange,
      changeColor: yearlyChange.color,
      comparison: null, // No comparison period for yearly totals
      icon: DollarSign,
      bgColor: ICONO_CHIP,
      iconColor: ICONO_CHIP_ICONO,
      testId: "kpi-yearly-total"
    },
    {
      title: "Clientes Nuevos",
      value: formatNumber(metrics?.newClients || 0),
      change: newClientsChange,
      changeColor: newClientsChange.color,
      comparison: null,
      icon: Users,
      bgColor: ICONO_CHIP,
      iconColor: ICONO_CHIP_ICONO,
      testId: "kpi-new-clients"
    },
  ];

  // Renderizar tarjeta personalizada para Ventas Totales
  /**
   * Interruptor Facturado / Combinado. Solo aparece en el mes en curso: en un mes ya
   * cerrado lo pendiente (NVV/GDV) ya se transformó en facturado y el combinado no existe.
   * El estado vive en FilterContext, así que da lo mismo cuántas veces se dibuje: todas
   * las tarjetas del dashboard siguen el mismo modo.
   */
  const renderToggleFacturadoCombinado = () => {
    if (!isCurrentMonth()) return null;
    return (
      <div
        className="flex items-center space-x-1 sm:space-x-1.5"
        onClick={(e) => e.stopPropagation()} // que no abra la ventana de proyección
      >
        <button
          onClick={() => setShowCombined(false)}
          className={`text-[10px] sm:text-xs lg:text-sm transition-colors focus:outline-none ${!showCombined ? 'font-bold text-slate-700 dark:text-slate-200 underline underline-offset-2' : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 font-medium'}`}
        >
          Facturado
        </button>
        <span className="text-[10px] sm:text-xs lg:text-sm text-slate-300 dark:text-gray-700">/</span>
        <button
          onClick={() => setShowCombined(true)}
          className={`text-[10px] sm:text-xs lg:text-sm transition-colors focus:outline-none ${showCombined ? 'font-bold text-slate-700 dark:text-slate-200 underline underline-offset-2' : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 font-medium'}`}
        >
          Combinado
        </button>
      </div>
    );
  };

  const renderSalesBody = (kpi: any, conToggle: boolean, conIcono = true) => {
    const salesTotal = Number(metrics?.totalSales || 0);
    const previousSales = Number(metrics?.previousMonthSales || 0);

    // Calcular diferencia en monto
    const salesDifference = salesTotal - previousSales;
    const salesDifferenceFormatted = formatCurrency(Math.abs(salesDifference));
    const salesDifferenceSign = salesDifference >= 0 ? '+' : '-';

    // Usar valores globales de NVV y GDV (sin filtros de fecha)
    const nvvTotal = Number(nvvGlobalMetrics?.totalAmount || 0);
    const gdvSales = Number(gdvGlobalMetrics?.gdvSales || 0);
    const combinedTotal = salesTotal + nvvTotal + gdvSales;

    // El modo "Combinado" (Facturado + NVV + GDV) solo aplica al mes en curso.
    // En meses cerrados se muestra siempre "Facturado" y se oculta el toggle.
    const isCurrent = isCurrentMonth();
    const effectiveCombined = showCombined && isCurrent;

    // % de variación del combinado vs el mismo período del año anterior.
    // El combinado (Facturado + NVV + GDV) proyecta dónde cerrará el mes en curso.
    // Se compara contra el FACTURADO del año anterior, porque en un mes ya cerrado
    // lo pendiente (NVV/GDV) ya se transformó en facturado: no existe un "combinado"
    // del pasado. Usar una base combinada anterior infla el denominador y diluye el %
    // (haría que el combinado, siendo un monto mayor, creciera menos que el facturado).
    const combinedDifference = combinedTotal - previousSales;
    const combinedHasPrev = previousSales > 0;
    const combinedPctValue = combinedHasPrev ? (combinedDifference / previousSales) * 100 : 0;
    const combinedPctFormatted = `${combinedPctValue >= 0 ? '+' : ''}${combinedPctValue.toFixed(1)}%`;
    const combinedPctColor = combinedPctValue >= 0 ? 'text-[#fd6301]' : 'text-red-600';
    const combinedDiffFormatted = formatCurrency(Math.abs(combinedDifference));
    const combinedDiffSign = combinedDifference >= 0 ? '+' : '-';

    // Devuelve SOLO el contenido de "Ventas Totales". La tarjeta que lo envuelve y el
    // interruptor Facturado/Combinado los pone renderVentasCard, que junta esta sección
    // con la de "Total Acumulado" en un mismo cuadro (pedido del usuario, ago-2026).
    return (
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            {/* El hueco que se le deja al ícono de la esquina va SOLO en la fila del
                título. Antes lo tenía el bloque entero y en celular le comía casi 50px
                de ancho a las cifras, que terminaban cortadas con puntos suspensivos. */}
            <div className="flex-1 mb-2 lg:mb-0 min-w-0">
              <div className={`flex items-center justify-between mb-1 sm:mb-2 ${conIcono ? 'pr-12 sm:pr-16 lg:pr-0' : ''}`}>
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                  {kpi.title}
                </p>
                {conToggle && renderToggleFacturadoCombinado()}
              </div>

              <p
                className="text-xl min-[400px]:text-2xl lg:text-3xl 2xl:text-4xl font-bold text-gray-900 dark:text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 transition-all"
                data-testid={kpi.testId}
                title={effectiveCombined ? formatCurrency(combinedTotal) : kpi.value}
              >
                {effectiveCombined ? formatCurrency(combinedTotal) : kpi.value}
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {!effectiveCombined ? (
                    <>
                      {kpi.change.percentage !== "Sin datos previos" && (
                        <span className={`text-sm sm:text-base lg:text-lg font-semibold ${kpi.changeColor}`}>
                          {kpi.change.percentage}
                        </span>
                      )}
                      {previousSales > 0 && (
                        <span className={`text-sm sm:text-base lg:text-lg font-semibold ${kpi.changeColor}`}>
                          {salesDifferenceSign}{salesDifferenceFormatted}
                        </span>
                      )}
                      {kpi.change.comparisonText && (
                        <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                          {kpi.change.comparisonText}
                        </span>
                      )}
                      {kpi.change.percentage === "Sin datos previos" && (
                        <span className="text-sm sm:text-base lg:text-lg font-semibold text-gray-500">
                          Sin datos previos
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {combinedHasPrev ? (
                        <>
                          <span className={`text-sm sm:text-base lg:text-lg font-semibold ${combinedPctColor}`}>
                            {combinedPctFormatted}
                          </span>
                          <span className={`text-sm sm:text-base lg:text-lg font-semibold ${combinedPctColor}`}>
                            {combinedDiffSign}{combinedDiffFormatted}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm sm:text-base lg:text-lg font-semibold text-gray-500">
                          Sin datos previos
                        </span>
                      )}
                      {kpi.change.comparisonText && (
                        <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                          {kpi.change.comparisonText}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isCurrent && (nvvTotal > 0 || gdvSales > 0) && (
                <div className="mt-2 pt-2 overflow-hidden">
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-2 gap-y-1 text-sm lg:text-base text-gray-700 dark:text-gray-300 mb-1">
                    <span className="truncate" title={`Facturas: ${kpi.value}`}>Fact: {kpi.value}</span>
                    <span className="truncate" title={`GDV: ${formatCurrency(gdvSales)}`}>GDV: {formatCurrency(gdvSales)}</span>
                  </div>
                  <p className="text-sm lg:text-base text-gray-700 dark:text-gray-300 truncate" title={`NVV: ${formatCurrency(nvvTotal)}`}>
                    NVV: {formatCurrency(nvvTotal)}
                  </p>
                </div>
              )}
            </div>
            {conIcono && (
              <div className={`absolute top-3 right-3 sm:top-14 sm:right-4 lg:top-1/2 lg:-translate-y-1/2 lg:static lg:ml-4 ${kpi.bgColor} transition-transform hover:scale-105 pointer-events-none`}>
                <kpi.icon className={`${kpi.iconColor}`} />
              </div>
            )}
          </div>
    );
  };

  /** Ventana de proyección de ventas. Se abre tocando la tarjeta de Ventas Totales. */
  const renderProyeccionModal = () => (
    <Dialog open={isProjectionModalOpen} onOpenChange={setIsProjectionModalOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col items-center justify-center p-6 border-none shadow-none bg-transparent sm:bg-transparent [&>button]:hidden">
        <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-slate-200">
              <DollarSign className="h-6 w-6 text-emerald-500" />
              Ventas Totales - Proyección
            </DialogTitle>
            <DialogClose asChild>
              <button className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Cerrar">
                <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </button>
            </DialogClose>
          </div>
          <div className="p-6">
            <SalesProjectionCard
              selectedPeriod={selectedPeriod}
              filterType={filterType}
              segment={segment}
              salesperson={salesperson}
              client={client}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderNewClientsCard = (kpi: any) => {
    const totalCustomers = metrics?.activeCustomers || 0;
    const totalUnits = metrics?.totalUnits || 0;
    const totalOrders = metrics?.totalOrders || 0;
    const currentNew = metrics?.newClients || 0;
    const yearlyNewClients = gdvYearlyMetrics?.newClients || 0;

    const totalNewClientsSales = newClientsList?.reduce((sum, c) => sum + c.totalSales, 0) || 0;

    return (
      <>
        <div
          key={kpi.title}
          className="order-[-2] md:order-none modern-card p-3 sm:p-5 lg:p-6 hover-lift relative overflow-hidden cursor-pointer ring-purple-300 hover:ring-2 transition-all"
          onClick={() => {
            if (onShowNewClients) {
              onShowNewClients();
            } else {
              setShowNewClientsModal(true);
            }
          }}
        >
          {/* El ícono va arriba a la izquierda, en su propia fila, igual que en la
              tarjeta de Ventas Totales (pedido del usuario, sep-2026). Antes flotaba
              suelto a media altura sobre el borde derecho y se salía de la tarjeta. */}
          <div className="flex items-center gap-3 pb-2">
            <div className={kpi.bgColor}>
              <kpi.icon className={kpi.iconColor} />
            </div>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 mb-2 lg:mb-0 min-w-0">
              {/* Mismo encabezado con línea divisoria que las otras tres tarjetas del
                  bloque (corrección del usuario, ago-2026): esta era la única sin línea
                  y el título quedaba pegado a la cifra. */}
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                  {kpi.title}
                </p>
              </div>
              <p
                className="text-xl min-[400px]:text-2xl lg:text-3xl 2xl:text-4xl font-bold text-gray-900 dark:text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                data-testid={kpi.testId}
                title={kpi.value}
              >
                {kpi.value}
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm sm:text-base lg:text-lg font-semibold text-[#fd6301]">
                    {formatNumber(yearlyNewClients)}
                  </span>
                  <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                    acumulado año {currentYearStr}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2">
                {/* Los tres datos van uno debajo del otro, en una sola columna (pedido
                    del usuario, sep-2026). Antes "órdenes" se iba a una segunda columna
                    a media tarjeta de distancia y se leía como si fuera otro bloque. */}
                <div className="flex flex-col gap-y-1 text-sm lg:text-base text-gray-700 dark:text-gray-300">
                  <span className="truncate" title={`${formatNumber(totalCustomers)} clientes totales`}>
                    {formatNumber(totalCustomers)} clientes totales
                  </span>
                  <span className="truncate" title={`${formatNumber(totalUnits)} unidades vendidas`}>
                    {formatNumber(totalUnits)} unidades vendidas
                  </span>
                  <span className="truncate" title={`${formatNumber(totalOrders)} órdenes`}>
                    {formatNumber(totalOrders)} órdenes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={showNewClientsModal} onOpenChange={setShowNewClientsModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#fd6301]" />
                Clientes Nuevos del Período
              </DialogTitle>
              <p className="text-sm text-gray-500">
                {formatNumber(currentNew)} clientes nuevos — Total comprado: {formatCurrency(totalNewClientsSales)}
              </p>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 -mx-6 px-6">
              {isLoadingNewClients ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : !newClientsList?.length ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay clientes nuevos en este período</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-950">
                    <div className="col-span-5">Cliente</div>
                    <div className="col-span-3 text-right">Monto</div>
                    <div className="col-span-2 text-right">Uds.</div>
                    <div className="col-span-2 text-right">Órdenes</div>
                  </div>
                  {newClientsList.map((item, index) => (
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatNumber(item.totalUnits)}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.orderCount}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  // Renderizar tarjeta personalizada para Total Acumulado del Año
  const renderYearlyBody = (kpi: any, conToggle: boolean, conIcono = true) => {
    const bestYearValue = bestYear?.bestYear || 0;
    const bestYearTotalValue = bestYear?.bestYearTotal || 0;

    const currentTotal = currentYearTotal || 0;

    // NVV/GDV: todo el pendiente vivo (sin filtro de fecha), igual que en
    // "Ventas Totales". Las NVV/GDV se transforman en factura más adelante, así
    // que solo tienen sentido en el mes en curso; por eso el Combinado se gatilla
    // con effectiveCombined (isCurrent) y en meses cerrados no se muestran.
    const nvvYearTotal = Number(nvvGlobalMetrics?.totalAmount || 0);
    const gdvYearTotal = Number(gdvGlobalMetrics?.gdvSales || 0);

    // Per user request, the "Total Acumulado del Año" should strictly match 
    // the "Ventas Totales" (Facturado) without adding NVV/GDV to the main figure
    const combinedYearTotal = currentTotal;

    // Calculate YTD Budget
    let budgetYTD = 0;
    if (budgetData && budgetData.length > 0) {
      const today = new Date();

      // Include the full current month budget (not proportional)
      let maxMonth = today.getMonth() + 1;
      let proportionalRatio = 1;

      // Adapt maxMonth and proportionalRatio based on selected period and filter type
      if (filterType === "month" && selectedPeriod.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = selectedPeriod.split('-').map(Number);
        if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)) {
          // Past month: full budget up to that month
          maxMonth = month;
          proportionalRatio = 1;
        } else if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1)) {
          // Future month: limit to end of that month fully (or maybe 0, depending on rules)
          maxMonth = month;
          proportionalRatio = 1;
        }
      } else if (filterType === "day" && selectedPeriod.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = selectedPeriod.split('-').map(Number);
        // If it's not today precisely
        if (!(year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate())) {
          maxMonth = month;
          const daysInTargetMonth = new Date(year, month, 0).getDate();
          proportionalRatio = day / daysInTargetMonth;
        }
      } else if (filterType === "year" && selectedPeriod.match(/^\d{4}$/)) {
        const year = Number(selectedPeriod);
        if (year < today.getFullYear()) {
          maxMonth = 12;
          proportionalRatio = 1;
        }
      }

      budgetData.forEach(record => {
        // Filter by segment if selected (equivalencias de nombre incluidas)
        if (segment && !categoriaPresupuestoCoincide(record.categoria, segment)) {
          return;
        }
        // Filter by salesperson if selected (case insensitive match of entity)
        // Note: we can't perfectly filter by client because budgets are usually per salesperson/category, but we'll try entity check
        if (salesperson && record.entidad.toLowerCase() !== salesperson.toLowerCase()) {
          return;
        }

        const monto = Number(record.monto) || 0;

        // Add full month if it's a past month within the allowed bound
        if (record.mes < maxMonth) {
          budgetYTD += monto;
        }
        // Add proportional amount if it's exactly the boundary month
        else if (record.mes === maxMonth) {
          budgetYTD += (monto * proportionalRatio);
        }
      });
    }

    // Calculate final combined value
    const finalCombinedValue = currentTotal + nvvYearTotal + gdvYearTotal;
    // Calculate final facturado value
    const facturadoValue = currentTotal;

    // El modo "Combinado" solo aplica al mes en curso; en meses cerrados se
    // muestra siempre "Facturado" y se oculta el toggle.
    const isCurrent = isCurrentMonth();
    const effectiveCombined = showCombined && isCurrent;

    // Choose what to display
    const displayValue = effectiveCombined ? finalCombinedValue : facturadoValue;

    // La Diferencia y el % siguen al modo seleccionado: en Facturado miden la
    // plata firme vs meta; en Combinado suman el pendiente vivo (NVV+GDV) para
    // ver si el pipeline alcanza a cerrar la brecha con la meta.
    const difference = displayValue - budgetYTD;
    const differenceFormatted = formatCurrency(Math.abs(difference));
    const differenceSign = difference >= 0 ? '+' : '-';

    // Calculate percentage against budget
    let budgetPct = "0%";
    let budgetColor = "text-gray-500";
    if (budgetYTD > 0) {
      const pct = ((displayValue - budgetYTD) / budgetYTD) * 100;
      budgetPct = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      budgetColor = pct >= 0 ? "text-[#fd6301]" : "text-red-600";
    }

    // Igual que renderSalesBody: devuelve solo el contenido, sin la tarjeta que lo envuelve.
    return (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0 min-w-0">
            <div className={`flex items-center justify-between mb-1 sm:mb-2 gap-2 ${conIcono ? 'pr-12 sm:pr-16 lg:pr-0' : ''}`}>
              {/* "Presupuesto" en pantalla (pedido del usuario, ago-2026). Adentro el
                  bloque se sigue llamando "Total Acumulado del Año", que es lo que
                  muestra: lo vendido en el año contra la meta a la fecha. */}
              <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                Presupuesto
              </p>
              {conToggle && renderToggleFacturadoCombinado()}
            </div>

            <p
              className="text-xl min-[400px]:text-2xl lg:text-3xl 2xl:text-4xl font-bold text-gray-900 dark:text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 transition-all"
              data-testid={kpi.testId}
              title={formatCurrency(displayValue)}
            >
              {formatCurrency(displayValue)}
            </p>
            {/* Meta y Diferencia se muestran SIEMPRE, con filtro o sin él (pedido del
                usuario, ago-2026). Antes el bloque entero se escondía cuando la meta daba
                cero, así que en las vistas por segmento la tarjeta aparecía sin ninguna
                referencia y parecía que faltaban datos. Cuando ese recorte de verdad no
                tiene presupuesto cargado se dice con todas sus letras, en vez de mostrar
                un "$0" que se leería como una meta de cero y una diferencia enorme a
                favor. */}
            {/* Igual que en la tarjeta de Margen: en pantalla grande el bloque se acota
                en ancho (pedido del usuario, sep-2026), porque con el ancho completo la
                etiqueta quedaba en un borde y la cifra en el otro. */}
            <div className="mt-3 space-y-1.5 text-sm lg:text-base pt-2 lg:max-w-[18rem]">
              {/* En celular la etiqueta y su cifra van juntas: con el número pegado al
                  borde derecho quedaban tan separados que costaba leer cuál iba con
                  cuál. En pantalla grande sí se separan a los extremos, porque ahí la
                  columna es angosta y se lee como tabla. */}
              <div className="flex items-baseline gap-2 lg:justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Meta a la Fecha:
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {budgetYTD > 0 ? formatCurrency(budgetYTD) : "Sin presupuesto cargado"}
                </span>
              </div>
              {/* Sin negrita (pedido del usuario, ago-2026): el naranjo ya destaca
                  bastante la Diferencia, y en negrita competía con la cifra grande. */}
              <div className={`flex items-baseline gap-2 lg:justify-between ${budgetYTD > 0 ? budgetColor : "text-gray-400 dark:text-gray-500"}`}>
                <span>Diferencia:</span>
                <span>
                  {budgetYTD > 0 ? `${differenceSign}${differenceFormatted} (${budgetPct})` : "—"}
                </span>
              </div>
            </div>

          </div>
          {conIcono && (
            <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 lg:static lg:ml-4 ${kpi.bgColor} transition-transform hover:scale-105`}>
              <kpi.icon className={`${kpi.iconColor}`} />
            </div>
          )}
        </div>
    );
  };

  // En PANTALLA GRANDE: cuatro tarjetas del mismo tamaño en dos columnas — arriba las dos
  // de plata (Ventas Totales y Total Acumulado) y abajo las otras dos (Clientes Nuevos y
  // Margen).
  //
  // En CELULAR el bloque usa `contents`, o sea que desaparece como caja y sus cuatro
  // tarjetas pasan a ser hijas directas de la página. Eso hace falta porque el orden que
  // se pidió (meta, Ventas Totales, Margen, Documentos Pendientes...) intercala tarjetas
  // de acá con secciones de afuera, y eso no se puede lograr mientras el bloque siga
  // siendo una caja cerrada. La separación entre tarjetas la pone el `gap` de la página.
  // ⚠️ Por eso el contenedor de la página que use estas tarjetas tiene que ser
  // `flex flex-col` con `gap`, NO `space-y`: con `space-y` las tarjetas quedarían pegadas.
  const kpiVentas = kpis.find((k) => k.title === "Ventas Totales");
  const kpiAcumulado = kpis.find((k) => k.title === "Total Acumulado del Año");
  const kpiClientes = kpis.find((k) => k.title === "Clientes Nuevos");

  const abreProyeccion = !salesperson && !segment && !client && !product;
  const alTocarVentas = () => { if (abreProyeccion) setIsProjectionModalOpen(true); };

  return (
    <div className="contents md:grid md:grid-cols-1 lg:grid-cols-2 md:gap-4 lg:gap-6">
      {/* Ventas Totales y Total Acumulado van JUNTAS en una sola tarjeta, con un único
          interruptor Facturado/Combinado arriba que manda sobre las dos (pedido del
          usuario, ago-2026). Antes eran dos tarjetas, cada una con su propio interruptor
          —los dos hacían lo mismo, porque el modo siempre fue uno solo para todo el
          dashboard—, y tener dos controles idénticos hacía dudar de si cambiaban cosas
          distintas.
          En pantalla grande la tarjeta ocupa las dos columnas y las secciones se ponen
          lado a lado; en celular quedan una debajo de la otra. */}
      <div
        className={`order-[-6] md:order-none lg:col-span-2 modern-card p-3 sm:p-5 lg:p-6 hover-lift relative overflow-hidden ${abreProyeccion ? 'cursor-pointer ring-green-300 hover:ring-2' : ''} transition-all`}
        onClick={alTocarVentas}
      >
        {/* Un solo ícono para toda la tarjeta, en la misma fila del interruptor. Los
            íconos que traía cada sección estaban posicionados sobre la esquina de la
            tarjeta y, al quedar las dos en el mismo cuadro, se pisaban entre ellos y
            tapaban el interruptor. */}
        {/* El ícono va a la izquierda y el interruptor a la derecha (pedido del usuario,
            ago-2026): pegados los dos en la esquina derecha se veían como un solo bloque
            y el ícono quedaba encima del texto. */}
        <div className="flex items-center justify-between gap-3 pb-2">
          {kpiVentas && (
            <div className={kpiVentas.bgColor}>
              <kpiVentas.icon className={kpiVentas.iconColor} />
            </div>
          )}
          {renderToggleFacturadoCombinado()}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6">
          <div>{kpiVentas && renderSalesBody(kpiVentas, false, false)}</div>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-6">
            {kpiAcumulado && renderYearlyBody(kpiAcumulado, false, false)}
          </div>
        </div>
      </div>

      {renderProyeccionModal()}

      {kpiClientes && renderNewClientsCard(kpiClientes)}

      {/* Margen del mismo recorte que muestran las otras tres.
          Al vivir acá aparece solo en el dashboard principal, en la vista de
          segmento y en la de vendedor, que son las tres que comparten KPICards. */}
      <MargenResumenCard
        selectedPeriod={selectedPeriod}
        filterType={filterType}
        segment={segment}
        salesperson={salesperson}
        client={client}
        product={product}
        className="order-[-1] md:order-none"
      />
    </div>
  );
}
