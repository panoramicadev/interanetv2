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
}

interface KPICardsProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "range";
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="modern-card p-6">
            <div className="skeleton h-4 mb-2"></div>
            <div className="skeleton h-8 mb-1"></div>
            <div className="skeleton h-3 w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: "Ventas Totales",
      value: formatCurrency(metrics?.totalSales || 0),
      change: "+12.5% vs mes anterior",
      changeColor: "text-green-600",
      icon: DollarSign,
      bgColor: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
      testId: "kpi-total-sales"
    },
    {
      title: "Transacciones",
      value: formatNumber(metrics?.totalTransactions || 0),
      change: "+8.2% vs mes anterior",
      changeColor: "text-blue-600",
      icon: ShoppingCart,
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
      testId: "kpi-transactions"
    },
    {
      title: "Unidades Vendidas",
      value: formatNumber(metrics?.totalUnits || 0),
      change: "+15.8% vs mes anterior",
      changeColor: "text-orange-600",
      icon: Package,
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600",
      testId: "kpi-units"
    },
    {
      title: "Clientes Activos",
      value: formatNumber(metrics?.activeCustomers || 0),
      change: "+5.9% vs mes anterior",
      changeColor: "text-purple-600",
      icon: Users,
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
      testId: "kpi-customers"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => (
        <div key={kpi.title} className="modern-card p-6 hover-scale">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {kpi.title}
              </p>
              <p 
                className="text-3xl font-bold text-foreground mb-1"
                data-testid={kpi.testId}
              >
                {kpi.value}
              </p>
              <p className={`text-sm font-medium ${kpi.changeColor}`}>
                {kpi.change}
              </p>
            </div>
            <div className={`w-14 h-14 ${kpi.bgColor} rounded-xl flex items-center justify-center ml-4 hover-scale`}>
              <kpi.icon className={`w-7 h-7 ${kpi.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
