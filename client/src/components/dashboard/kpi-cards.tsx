import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users 
} from "lucide-react";

interface SalesMetrics {
  totalSales: number;
  totalTransactions: number;
  totalUnits: number;
  activeCustomers: number;
  previousMonthSales?: number;
  previousMonthTransactions?: number;
  previousMonthUnits?: number;
  previousMonthCustomers?: number;
}

interface KPICardsProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
}

export default function KPICards({ selectedPeriod, filterType }: KPICardsProps) {
  const { data: metrics, isLoading } = useQuery<SalesMetrics>({
    queryKey: [`/api/sales/metrics?period=${selectedPeriod}&filterType=${filterType}`],
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

  const salesChange = calculateChange(metrics?.totalSales || 0, metrics?.previousMonthSales);
  const transactionsChange = calculateChange(metrics?.totalTransactions || 0, metrics?.previousMonthTransactions);
  const unitsChange = calculateChange(metrics?.totalUnits || 0, metrics?.previousMonthUnits);
  const customersChange = calculateChange(metrics?.activeCustomers || 0, metrics?.previousMonthCustomers);

  const kpis = [
    {
      title: "Ventas Totales",
      value: formatCurrency(metrics?.totalSales || 0),
      change: salesChange.text,
      changeColor: salesChange.color,
      icon: DollarSign,
      bgColor: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
      testId: "kpi-total-sales"
    },
    {
      title: "Transacciones",
      value: formatNumber(metrics?.totalTransactions || 0),
      change: transactionsChange.text,
      changeColor: transactionsChange.color,
      icon: ShoppingCart,
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
      testId: "kpi-transactions"
    },
    {
      title: "Unidades Vendidas",
      value: formatNumber(metrics?.totalUnits || 0),
      change: unitsChange.text,
      changeColor: unitsChange.color,
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
      icon: Users,
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
      testId: "kpi-customers"
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {kpis.map((kpi) => (
        <div key={kpi.title} className="modern-card p-3 sm:p-5 lg:p-6 hover-lift">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 mb-2 lg:mb-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                {kpi.title}
              </p>
              <p 
                className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 break-all lg:break-normal"
                data-testid={kpi.testId}
              >
                {kpi.value}
              </p>
              <p className={`text-xs sm:text-sm font-medium ${kpi.changeColor} hidden sm:block`}>
                {kpi.change}
              </p>
            </div>
            <div className={`w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 ${kpi.bgColor} rounded-xl lg:rounded-2xl flex items-center justify-center self-end lg:self-auto lg:ml-4 transition-transform hover:scale-105`}>
              <kpi.icon className={`w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 ${kpi.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
