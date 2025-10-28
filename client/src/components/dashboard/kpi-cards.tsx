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
  previousMonthSales?: number;
  previousMonthTransactions?: number;
  previousMonthOrders?: number;
  previousMonthUnits?: number;
  previousMonthCustomers?: number;
  previousMonthGdvSales?: number;
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
  comparePeriod?: string;
}

export default function KPICards({ selectedPeriod, filterType, segment, salesperson, comparePeriod }: KPICardsProps) {
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
    queryKey: ['/api/sales/metrics', selectedPeriod, filterType, segment, salesperson],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      const res = await fetch(`/api/sales/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query for comparison data if comparePeriod is set
  const { data: comparisonMetrics } = useQuery<SalesMetrics>({
    queryKey: ['/api/sales/metrics', resolvedComparePeriod, filterType, segment, salesperson, 'comparison'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', resolvedComparePeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      const res = await fetch(`/api/sales/metrics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!resolvedComparePeriod, // Only run if resolved period is set
  });

  // Query for NVV total (NO filters - always show ALL pending sales)
  const { data: nvvMetrics } = useQuery<{
    totalAmount: number;
    totalRecords: number;
  }>({
    queryKey: ['/api/nvv/total'],
  });

  // Query for yearly totals
  const { data: yearlyTotals } = useQuery<{
    currentYearTotal: number;
    previousYearTotal: number;
    comparisonYear: number;
    comparisonDate: string;
    isYTD: boolean;
  }>({
    queryKey: ['/api/sales/yearly-totals'],
  });

  // Query for best year historical
  const { data: bestYear } = useQuery<{
    bestYear: number;
    bestYearTotal: number;
  }>({
    queryKey: ['/api/sales/best-year'],
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
    
    // Generate year-over-year comparison text based on filter type
    let comparisonText = "";
    
    if (filterType === "month" && selectedPeriod.match(/^\d{4}-\d{2}$/)) {
      // Month comparison: "vs Oct 2024"
      const [year, month] = selectedPeriod.split('-').map(Number);
      const previousYear = year - 1;
      const monthName = format(new Date(year, month - 1, 1), 'MMM');
      comparisonText = `vs ${monthName} ${previousYear}`;
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

  // Calculate comparison changes
  const salesComparison = calculateComparisonChange(metrics?.totalSales || 0, comparisonMetrics?.totalSales, true);
  const unitsComparison = calculateComparisonChange(metrics?.totalUnits || 0, comparisonMetrics?.totalUnits, false);

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
      title: "Unidades Vendidas",
      value: formatNumber(metrics?.totalUnits || 0),
      change: unitsChange,
      changeColor: unitsChange.color,
      comparison: unitsComparison,
      icon: Package,
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600",
      testId: "kpi-units"
    },
  ];

  // Renderizar tarjeta personalizada para Ventas Totales
  const renderSalesCard = (kpi: any) => {
    const salesTotal = Number(metrics?.totalSales || 0);
    
    // Verificar si el mes seleccionado ya terminó
    const isMonthClosed = () => {
      if (filterType !== "month") return false;
      
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      // Parsear el período seleccionado
      if (selectedPeriod.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = selectedPeriod.split('-').map(Number);
        
        // Si el año es anterior al actual, el mes está cerrado
        if (year < currentYear) return true;
        
        // Si es el mismo año pero el mes es anterior al actual, está cerrado
        if (year === currentYear && month < currentMonth) return true;
      }
      
      return false;
    };
    
    const monthClosed = isMonthClosed();
    const nvvTotal = monthClosed ? 0 : Number(nvvMetrics?.totalAmount || 0);
    const gdvSales = monthClosed ? 0 : Number(metrics?.gdvSales || 0);
    const combinedTotal = salesTotal + nvvTotal + gdvSales;

    return (
      <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
              {kpi.title}
            </p>
            <p 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              data-testid={kpi.testId}
              title={kpi.value}
            >
              {kpi.value}
            </p>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                {/* Mostrar el monto del cambio si existe */}
                {kpi.comparison && (
                  <span className={`text-xs sm:text-sm font-semibold ${kpi.comparison.color}`}>
                    {kpi.comparison.text}
                  </span>
                )}
                {/* Siempre mostrar el porcentaje si hay datos */}
                {kpi.change.percentage !== "Sin datos previos" && (
                  <span className={`text-xs sm:text-sm font-semibold ${kpi.changeColor}`}>
                    {kpi.comparison ? `(${kpi.change.percentage})` : kpi.change.percentage}
                  </span>
                )}
                {/* Mostrar "Sin datos previos" si no hay comparación */}
                {kpi.change.percentage === "Sin datos previos" && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-500">
                    Sin datos previos
                  </span>
                )}
              </div>
              {/* Texto de comparación debajo */}
              {kpi.change.comparisonText && (
                <span className="text-[9px] sm:text-[10px] text-gray-500">
                  {kpi.change.comparisonText}
                </span>
              )}
            </div>
            {/* Información adicional: NVV + GDV y Total Combinado */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0" title={`NVV: ${formatCurrency(nvvTotal)} + GDV: ${formatCurrency(gdvSales)}`}>
                NVV: {formatCurrency(nvvTotal)} + GDV: {formatCurrency(gdvSales)}
              </p>
              <p className="text-xs font-semibold text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap min-w-0" title={`Total Combinado: ${formatCurrency(combinedTotal)}`}>
                Total Combinado: {formatCurrency(combinedTotal)}
              </p>
            </div>
          </div>
          <div className={`w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center self-end lg:self-auto lg:ml-4 transition-transform hover:scale-105`}>
            <kpi.icon className={`w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 ${kpi.iconColor}`} />
          </div>
        </div>
      </div>
    );
  };

  // Renderizar tarjeta personalizada para Unidades Vendidas
  const renderUnitsCard = (kpi: any) => {
    const totalOrders = metrics?.totalOrders || 0;
    const totalCustomers = metrics?.activeCustomers || 0;

    return (
      <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
              {kpi.title}
            </p>
            <p 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              data-testid={kpi.testId}
              title={kpi.value}
            >
              {kpi.value}
            </p>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                {/* Mostrar el monto del cambio si existe */}
                {kpi.comparison && (
                  <span className={`text-xs sm:text-sm font-semibold ${kpi.comparison.color}`}>
                    {kpi.comparison.text}
                  </span>
                )}
                {/* Siempre mostrar el porcentaje si hay datos */}
                {kpi.change.percentage !== "Sin datos previos" && (
                  <span className={`text-xs sm:text-sm font-semibold ${kpi.changeColor}`}>
                    {kpi.comparison ? `(${kpi.change.percentage})` : kpi.change.percentage}
                  </span>
                )}
                {/* Mostrar "Sin datos previos" si no hay comparación */}
                {kpi.change.percentage === "Sin datos previos" && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-500">
                    Sin datos previos
                  </span>
                )}
              </div>
              {/* Texto de comparación debajo */}
              {kpi.change.comparisonText && (
                <span className="text-[9px] sm:text-[10px] text-gray-500">
                  {kpi.change.comparisonText}
                </span>
              )}
            </div>
            {/* Subtítulo: Cantidad de órdenes y clientes */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">
                {formatNumber(totalOrders)} {totalOrders === 1 ? 'orden' : 'órdenes'}
              </p>
              <p className="text-xs font-semibold text-gray-700">
                {formatNumber(totalCustomers)} {totalCustomers === 1 ? 'cliente' : 'clientes'}
              </p>
            </div>
          </div>
          <div className={`w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center self-end lg:self-auto lg:ml-4 transition-transform hover:scale-105`}>
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
    
    // Calcular el monto de la diferencia
    const currentTotal = currentYearTotal || 0;
    const previousTotal = previousYearTotal || 0;
    const difference = currentTotal - previousTotal;
    const differenceFormatted = formatCurrency(Math.abs(difference));
    const differenceSign = difference >= 0 ? '+' : '-';

    return (
      <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
              {kpi.title}
            </p>
            <p 
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              data-testid={kpi.testId}
              title={kpi.value}
            >
              {kpi.value}
            </p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`text-xs sm:text-sm font-semibold ${kpi.changeColor}`}>
                {kpi.change.percentage}
              </span>
              {previousTotal > 0 && (
                <span className={`text-xs sm:text-sm font-semibold ${kpi.changeColor}`}>
                  {differenceSign}{differenceFormatted}
                </span>
              )}
              {kpi.change.comparisonText && (
                <span className="text-[10px] text-gray-500">
                  {kpi.change.comparisonText}
                </span>
              )}
            </div>
            {/* Información adicional: Mejor año histórico */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">
                Mejor año: {bestYearValue}
              </p>
              <p className="text-xs font-semibold text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap min-w-0" title={formatCurrency(bestYearTotalValue)}>
                {formatCurrency(bestYearTotalValue)}
              </p>
            </div>
          </div>
          <div className={`w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center self-end lg:self-auto lg:ml-4 transition-transform hover:scale-105`}>
            <kpi.icon className={`w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 ${kpi.iconColor}`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
      {kpis.map((kpi) => {
        // Renderizar tarjetas especiales
        if (kpi.title === "Ventas Totales") {
          return renderSalesCard(kpi);
        } else if (kpi.title === "Total Acumulado del Año") {
          return renderYearlyCard(kpi);
        } else if (kpi.title === "Unidades Vendidas") {
          return renderUnitsCard(kpi);
        }
        
        // Fallback para otras tarjetas (no debería llegar aquí)
        return null;
      })}
    </div>
  );
}
