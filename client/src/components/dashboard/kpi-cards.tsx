import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users 
} from "lucide-react";
import { format } from "date-fns";

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

interface KPICardsProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
  comparePeriod?: string;
}

export default function KPICards({ selectedPeriod, filterType, segment, salesperson, client, product, comparePeriod }: KPICardsProps) {
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

  // Query for yearly totals (with filters for segment, salesperson, client)
  const { data: yearlyTotals } = useQuery<{
    currentYearTotal: number;
    previousYearTotal: number;
    comparisonYear: number;
    comparisonDate: string;
    isYTD: boolean;
  }>({
    queryKey: ['/api/sales/yearly-totals', segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/sales/yearly-totals?${params.toString()}`, { credentials: 'include' });
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

  if (isLoading) {
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

      // If it's the current month, show "Oct 1-9" format
      if (year === currentYear && month === currentMonth) {
        const monthName = format(new Date(year, month - 1, 1), 'MMM');
        const currentDay = now.getDate();
        return `${monthName} 1-${currentDay}`;
      } else {
        // Past month, show full month
        return format(new Date(year, month - 1, 1), 'MMM yyyy');
      }
    }

    return period;
  };

  // Calculate percentage changes vs same period in previous year (year-over-year)
  const calculateChange = (current: number, previous: number | undefined) => {
    // Generate year-over-year comparison text based on filter type (always show this)
    let comparisonText = "";

    if (filterType === "month" && selectedPeriod.match(/^\d{4}-\d{2}$/)) {
      // Month comparison: "vs Oct 2024" or "vs Oct 2024 al 15/12" for current month
      const [year, month] = selectedPeriod.split('-').map(Number);
      const previousYear = year - 1;
      const monthName = format(new Date(year, month - 1, 1), 'MMM');
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
      // Day comparison: "vs 28 Oct 2024"
      const [year, month, day] = selectedPeriod.split('-').map(Number);
      const previousYear = year - 1;
      const dayFormatted = format(new Date(year, month - 1, day), 'd MMM');
      comparisonText = `vs ${dayFormatted} ${previousYear}`;
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
    const color = change >= 0 ? "text-green-600" : "text-red-600";

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
    const color = difference >= 0 ? "text-green-600" : "text-red-600";
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
    const color = change >= 0 ? "text-green-600" : "text-red-600";

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
      bgColor: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
      testId: "kpi-total-sales"
    },
    {
      title: "Total Acumulado del Año",
      value: formatCurrency(currentYearTotal),
      change: yearlyChange,
      changeColor: yearlyChange.color,
      comparison: null, // No comparison period for yearly totals
      icon: DollarSign,
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
      testId: "kpi-yearly-total"
    },
    {
      title: "Clientes Nuevos",
      value: formatNumber(metrics?.newClients || 0),
      change: newClientsChange,
      changeColor: newClientsChange.color,
      comparison: null,
      icon: Users,
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
      testId: "kpi-new-clients"
    },
  ];

  // Renderizar tarjeta personalizada para Ventas Totales
  const renderSalesCard = (kpi: any) => {
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

    return (
      <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0 pr-12 sm:pr-16 lg:pr-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
              {kpi.title}
            </p>
            <p 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              data-testid={kpi.testId}
              title={kpi.value}
            >
              {kpi.value}
            </p>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                {kpi.change.percentage !== "Sin datos previos" && (
                  <span className={`text-xs sm:text-sm font-semibold ${kpi.changeColor}`}>
                    {kpi.change.percentage}
                  </span>
                )}
                {previousSales > 0 && (
                  <span className={`text-xs sm:text-sm font-semibold ${kpi.changeColor}`}>
                    {salesDifferenceSign}{salesDifferenceFormatted}
                  </span>
                )}
                {kpi.change.comparisonText && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {kpi.change.comparisonText}
                  </span>
                )}
                {kpi.change.percentage === "Sin datos previos" && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-500">
                    Sin datos previos
                  </span>
                )}
              </div>
            </div>
            {isCurrentMonth() && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span className="truncate" title={`NVV: ${formatCurrency(nvvTotal)}`}>NVV: {formatCurrency(nvvTotal)}</span>
                  <span className="truncate" title={`GDV: ${formatCurrency(gdvSales)}`}>GDV: {formatCurrency(gdvSales)}</span>
                </div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate" title={`Combinado: ${formatCurrency(combinedTotal)}`}>
                  Combinado: {formatCurrency(combinedTotal)}
                </p>
              </div>
            )}
          </div>
          <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 lg:static lg:ml-4 w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center transition-transform hover:scale-105`}>
            <kpi.icon className={`w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 ${kpi.iconColor}`} />
          </div>
        </div>
      </div>
    );
  };

  const renderNewClientsCard = (kpi: any) => {
    const totalCustomers = metrics?.activeCustomers || 0;
    const totalUnits = metrics?.totalUnits || 0;
    const totalOrders = metrics?.totalOrders || 0;
    const prevNewClients = metrics?.previousNewClients;
    const currentNew = metrics?.newClients || 0;

    const newClientsDiff = prevNewClients !== undefined ? currentNew - prevNewClients : null;
    const diffSign = newClientsDiff !== null && newClientsDiff >= 0 ? '+' : '';

    return (
      <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0 pr-12 sm:pr-16 lg:pr-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
              {kpi.title}
            </p>
            <p 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              data-testid={kpi.testId}
              title={kpi.value}
            >
              {kpi.value}
            </p>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                {kpi.change.percentage !== "Sin datos previos" && (
                  <span className={`text-xs sm:text-sm font-semibold ${kpi.changeColor}`}>
                    {kpi.change.percentage}
                  </span>
                )}
                {newClientsDiff !== null && (
                  <span className={`text-xs sm:text-sm font-semibold ${newClientsDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {diffSign}{formatNumber(newClientsDiff)}
                  </span>
                )}
                {kpi.change.percentage === "Sin datos previos" && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-500">
                    Sin datos previos
                  </span>
                )}
              </div>
              {kpi.change.comparisonText && (
                <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400">
                  {kpi.change.comparisonText}
                </span>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span className="truncate" title={`${formatNumber(totalCustomers)} clientes totales`}>
                  {formatNumber(totalCustomers)} clientes totales
                </span>
                <span className="truncate" title={`${formatNumber(totalOrders)} órdenes`}>
                  {formatNumber(totalOrders)} órdenes
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate" title={`${formatNumber(totalUnits)} unidades vendidas`}>
                {formatNumber(totalUnits)} unidades vendidas
              </p>
            </div>
          </div>
          <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 lg:static lg:ml-4 w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center transition-transform hover:scale-105`}>
            <kpi.icon className={`w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 ${kpi.iconColor}`} />
          </div>
        </div>
      </div>
    );
  };

  // Renderizar tarjeta personalizada para Total Acumulado del Año
  const renderYearlyCard = (kpi: any) => {
    const bestYearValue = bestYear?.bestYear || 0;
    const bestYearTotalValue = bestYear?.bestYearTotal || 0;

    const currentTotal = currentYearTotal || 0;
    const previousTotal = previousYearTotal || 0;
    const difference = currentTotal - previousTotal;
    const differenceFormatted = formatCurrency(Math.abs(difference));
    const differenceSign = difference >= 0 ? '+' : '-';

    return (
      <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0 pr-12 sm:pr-16 lg:pr-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
              {kpi.title}
            </p>
            <p 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              data-testid={kpi.testId}
              title={kpi.value}
            >
              {kpi.value}
            </p>
            {previousTotal > 0 && (
              <div className="mt-2 space-y-1 text-xs border-t border-gray-100 dark:border-gray-700 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">
                    {yearlyTotals?.comparisonYear || 'Año anterior'} (a la fecha):
                  </span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(previousTotal)}</span>
                </div>
                <div className={`flex justify-between items-center font-semibold ${kpi.changeColor}`}>
                  <span>Diferencia:</span>
                  <span>{differenceSign}{differenceFormatted} ({kpi.change.percentage})</span>
                </div>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 overflow-hidden">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">
                Mejor año: {bestYearValue}
              </p>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate" title={formatCurrency(bestYearTotalValue)}>
                {formatCurrency(bestYearTotalValue)}
              </p>
            </div>
          </div>
          <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 lg:static lg:ml-4 w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center transition-transform hover:scale-105`}>
            <kpi.icon className={`w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 ${kpi.iconColor}`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
      {kpis.map((kpi) => {
        if (kpi.title === "Ventas Totales") {
          return renderSalesCard(kpi);
        } else if (kpi.title === "Total Acumulado del Año") {
          return renderYearlyCard(kpi);
        } else if (kpi.title === "Clientes Nuevos") {
          return renderNewClientsCard(kpi);
        }

        // Fallback para otras tarjetas (no debería llegar aquí)
        return null;
      })}
    </div>
  );
}
