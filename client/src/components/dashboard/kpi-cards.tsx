import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users 
} from "lucide-react";

interface SalesMetrics {
  totalSales: number;
  totalTransactions: number;
  totalOrders: number;
  totalUnits: number;
  activeCustomers: number;
  previousMonthSales?: number;
  previousMonthTransactions?: number;
  previousMonthOrders?: number;
  previousMonthUnits?: number;
  previousMonthCustomers?: number;
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
    
    // Debug logging
    console.log('[DEBUG] Resolving comparison period:', { comparePeriod, currentPeriod, filterType });
    
    // If it's already a specific period like "2025-08", return as is
    if (comparePeriod.match(/^\d{4}-\d{2}$/) || comparePeriod.match(/^\d{4}$/)) {
      console.log('[DEBUG] Already specific period, returning as-is:', comparePeriod);
      return comparePeriod;
    }
    
    // Parse current period to determine comparison period
    switch (comparePeriod) {
      case "previous-month": {
        if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = currentPeriod.split('-').map(Number);
          const date = new Date(year, month - 1, 1);
          date.setMonth(date.getMonth() - 1);
          const result = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          console.log('[DEBUG] Previous month resolved to:', result);
          return result;
        }
        break;
      }
      case "previous-year": {
        if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = currentPeriod.split('-');
          const result = `${parseInt(year) - 1}-${month}`;
          console.log('[DEBUG] Previous year resolved to:', result);
          return result;
        }
        if (filterType === "year" && currentPeriod.match(/^\d{4}$/)) {
          const result = `${parseInt(currentPeriod) - 1}`;
          console.log('[DEBUG] Previous year (year filter) resolved to:', result);
          return result;
        }
        break;
      }
      case "same-month-last-year": {
        if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = currentPeriod.split('-');
          const result = `${parseInt(year) - 1}-${month}`;
          console.log('[DEBUG] Same month last year resolved to:', result);
          return result;
        } else {
          console.warn('[DEBUG] Could not resolve same-month-last-year - invalid format:', { currentPeriod, filterType });
        }
        break;
      }
    }
    
    console.warn('[DEBUG] No pattern matched, returning original:', comparePeriod);
    return ""; // Return empty string instead of original if no pattern matches to prevent errors
  };

  const resolvedComparePeriod = resolveComparisonPeriod(comparePeriod || "", selectedPeriod, filterType);

  const { data: metrics, isLoading } = useQuery<SalesMetrics>({
    queryKey: [`/api/sales/metrics?period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
  });

  // Query for comparison data if comparePeriod is set
  const { data: comparisonMetrics } = useQuery<SalesMetrics>({
    queryKey: [`/api/sales/metrics?period=${resolvedComparePeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
    enabled: !!resolvedComparePeriod, // Only run if resolved period is set
  });

  // Query for NVV metrics with the same filters as sales metrics
  const { data: nvvMetrics } = useQuery<NvvMetrics>({
    queryKey: [`/api/nvv/metrics?period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
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

  // Calculate percentage changes vs previous period
  const calculateChange = (current: number, previous: number | undefined) => {
    if (previous === undefined || previous === null || previous === 0) {
      return { text: "Sin datos previos", color: "text-gray-500" };
    }
    
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    const color = change >= 0 ? "text-green-600" : "text-red-600";
    
    return {
      text: `${sign}${change.toFixed(1)}% vs mes anterior`,
      color
    };
  };

  // Calculate percentage changes vs comparison period
  const calculateComparisonChange = (current: number, comparison: number | undefined) => {
    if (!comparePeriod || comparePeriod === "none" || comparison === undefined || comparison === null || comparison === 0) {
      return null;
    }
    
    const change = ((current - comparison) / comparison) * 100;
    const sign = change >= 0 ? "+" : "";
    const bgColor = change >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
    
    return {
      text: `${sign}${change.toFixed(1)}%`,
      bgColor,
      value: change
    };
  };

  const salesChange = calculateChange(metrics?.totalSales || 0, metrics?.previousMonthSales);
  const ordersChange = calculateChange(metrics?.totalOrders || 0, metrics?.previousMonthOrders);
  const unitsChange = calculateChange(metrics?.totalUnits || 0, metrics?.previousMonthUnits);
  const customersChange = calculateChange(metrics?.activeCustomers || 0, metrics?.previousMonthCustomers);

  // Calculate comparison changes
  const salesComparison = calculateComparisonChange(metrics?.totalSales || 0, comparisonMetrics?.totalSales);
  const ordersComparison = calculateComparisonChange(metrics?.totalOrders || 0, comparisonMetrics?.totalOrders);
  const unitsComparison = calculateComparisonChange(metrics?.totalUnits || 0, comparisonMetrics?.totalUnits);
  const customersComparison = calculateComparisonChange(metrics?.activeCustomers || 0, comparisonMetrics?.activeCustomers);

  const kpis = [
    {
      title: "Ventas Totales",
      value: formatCurrency(metrics?.totalSales || 0),
      change: salesChange.text,
      changeColor: salesChange.color,
      comparison: salesComparison,
      icon: DollarSign,
      bgColor: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
      testId: "kpi-total-sales"
    },
    {
      title: "Órdenes",
      value: formatNumber(metrics?.totalOrders || 0),
      change: ordersChange.text,
      changeColor: ordersChange.color,
      comparison: ordersComparison,
      icon: ShoppingCart,
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
      testId: "kpi-orders"
    },
    {
      title: "Unidades Vendidas",
      value: formatNumber(metrics?.totalUnits || 0),
      change: unitsChange.text,
      changeColor: unitsChange.color,
      comparison: unitsComparison,
      icon: Package,
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600",
      testId: "kpi-units"
    },
    {
      title: "Clientes Activos",
      value: formatNumber(metrics?.activeCustomers || 0),
      change: customersChange.text,
      changeColor: customersChange.color,
      comparison: customersComparison,
      icon: Users,
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
      testId: "kpi-customers"
    },
  ];

  // Renderizar tarjeta personalizada para Ventas Totales
  const renderSalesCard = (kpi: any) => {
    const nvvTotal = Number(nvvMetrics?.totalAmount || 0);
    const combinedTotal = Number(metrics?.totalSales || 0) + nvvTotal;

    return (
      <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 mb-2 lg:mb-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
              {kpi.title}
            </p>
            <div className="relative">
              <p 
                className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 break-all lg:break-normal"
                data-testid={kpi.testId}
              >
                {kpi.value}
              </p>
              {kpi.comparison && (
                <Badge 
                  className={`absolute -top-1 -right-1 text-xs px-1 py-0.5 ${kpi.comparison.bgColor}`}
                  data-testid={`${kpi.testId}-comparison-badge`}
                >
                  {kpi.comparison.text}
                </Badge>
              )}
            </div>
            <p className={`text-xs sm:text-sm font-medium ${kpi.changeColor} hidden sm:block`}>
              {kpi.change}
            </p>
            {/* Información adicional de NVV */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">
                NVV: {formatCurrency(nvvTotal)}
              </p>
              <p className="text-xs font-semibold text-gray-700">
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

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {kpis.map((kpi) => (
        kpi.title === "Ventas Totales" ? renderSalesCard(kpi) : (
          <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 mb-2 lg:mb-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                  {kpi.title}
                </p>
                <div className="relative">
                  <p 
                    className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 break-all lg:break-normal"
                    data-testid={kpi.testId}
                  >
                    {kpi.value}
                  </p>
                  {kpi.comparison && (
                    <Badge 
                      className={`absolute -top-1 -right-1 text-xs px-1 py-0.5 ${kpi.comparison.bgColor}`}
                      data-testid={`${kpi.testId}-comparison-badge`}
                    >
                      {kpi.comparison.text}
                    </Badge>
                  )}
                </div>
                <p className={`text-xs sm:text-sm font-medium ${kpi.changeColor} hidden sm:block`}>
                  {kpi.change}
                </p>
              </div>
              <div className={`w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center self-end lg:self-auto lg:ml-4 transition-transform hover:scale-105`}>
                <kpi.icon className={`w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 ${kpi.iconColor}`} />
              </div>
            </div>
          </div>
        )
      ))}
    </div>
  );
}
