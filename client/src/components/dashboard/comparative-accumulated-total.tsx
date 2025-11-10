import { useQueries } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

interface SalesMetrics {
  totalSales: number;
  totalTransactions: number;
  totalUnits: number;
  activeCustomers: number;
}

interface ComparativeAccumulatedTotalProps {
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
  segment?: string;
  salesperson?: string;
}

export default function ComparativeAccumulatedTotal({ 
  periods, 
  segment, 
  salesperson 
}: ComparativeAccumulatedTotalProps) {
  const metricsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/metrics?period=${period}&filterType=${filterType}${
        segment ? `&segment=${encodeURIComponent(segment)}` : ''
      }${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        if (segment) params.append('segment', segment);
        if (salesperson) params.append('salesperson', salesperson);
        
        const res = await fetch(`/api/sales/metrics?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SalesMetrics;
      }
    }))
  });

  const isLoading = metricsQueries.some(q => q.isLoading);
  const allData = metricsQueries.map(q => q.data);

  if (isLoading) {
    return (
      <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
    );
  }

  const totalSalesAllPeriods = allData.reduce((sum, data) => {
    return sum + (data?.totalSales || 0);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPeriodLabel = () => {
    const filterType = periods[0].filterType;
    const count = periods.length;
    
    switch (filterType) {
      case 'day':
        return `${count} ${count === 1 ? 'día' : 'días'}`;
      case 'month':
        return `${count} ${count === 1 ? 'mes' : 'meses'}`;
      case 'year':
        return `${count} ${count === 1 ? 'año' : 'años'}`;
      default:
        return `${count} ${count === 1 ? 'período' : 'períodos'}`;
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700 mb-1">Total Acumulado de Períodos Comparativos</p>
          <p className="text-3xl font-bold text-emerald-900" data-testid="text-total-accumulated">
            {formatCurrency(totalSalesAllPeriods)}
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            {getPeriodLabel()} comparados
          </p>
        </div>
        <div className="bg-emerald-100 rounded-full p-4">
          <TrendingUp className="h-8 w-8 text-emerald-600" />
        </div>
      </div>
    </div>
  );
}
