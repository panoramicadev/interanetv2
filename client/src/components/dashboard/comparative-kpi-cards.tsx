import { useQueries } from "@tanstack/react-query";
import { DollarSign, Package, Users } from "lucide-react";

interface SalesMetrics {
  totalSales: number;
  totalTransactions: number;
  totalUnits: number;
  activeCustomers: number;
}

interface ComparativeKPICardsProps {
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
  segment?: string;
  salesperson?: string;
}

export default function ComparativeKPICards({ periods, segment, salesperson }: ComparativeKPICardsProps) {
  // Fetch metrics for all periods using useQueries to respect Rules of Hooks
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
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 gap-4">
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CL').format(value);
  };

  return (
    <div className="space-y-4">
      {/* Modo Comparativo Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-900">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div>
            <div className="font-semibold">Modo Comparativo</div>
            <div className="text-sm text-blue-700">Comparando {periods.length} períodos</div>
          </div>
        </div>
      </div>

      {/* Ventas Totales por Período */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <DollarSign className="h-5 w-5" />
          <h3 className="font-semibold">Ventas Totales por Período</h3>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
          {periods.map((period, index) => {
            const metrics = allData[index];
            if (!metrics) return null;
            
            return (
              <div 
                key={period.period} 
                className="bg-blue-50 border border-blue-100 rounded-lg p-4"
                data-testid={`kpi-sales-${period.period}`}
              >
                <div className="text-sm font-medium text-blue-900 mb-1">{period.label}</div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(metrics.totalSales)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unidades Vendidas por Período */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <Package className="h-5 w-5" />
          <h3 className="font-semibold">Unidades Vendidas por Período</h3>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
          {periods.map((period, index) => {
            const metrics = allData[index];
            if (!metrics) return null;
            
            return (
              <div 
                key={period.period} 
                className="bg-orange-50 border border-orange-100 rounded-lg p-4"
                data-testid={`kpi-units-${period.period}`}
              >
                <div className="text-sm font-medium text-orange-900 mb-1">{period.label}</div>
                <div className="text-2xl font-bold text-orange-700">
                  {formatNumber(metrics.totalUnits)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clientes Activos por Período */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <Users className="h-5 w-5" />
          <h3 className="font-semibold">Clientes Activos por Período</h3>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}>
          {periods.map((period, index) => {
            const metrics = allData[index];
            if (!metrics) return null;
            
            return (
              <div 
                key={period.period} 
                className="bg-green-50 border border-green-100 rounded-lg p-4"
                data-testid={`kpi-customers-${period.period}`}
              >
                <div className="text-sm font-medium text-green-900 mb-1">{period.label}</div>
                <div className="text-2xl font-bold text-green-700">
                  {formatNumber(metrics.activeCustomers)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {formatNumber(metrics.totalTransactions)} transacciones
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
