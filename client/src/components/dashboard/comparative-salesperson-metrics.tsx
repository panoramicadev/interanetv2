import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { TrendingUp, Users, ShoppingCart, DollarSign, Target, BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComparativeSalespersonChart from "./comparative-salesperson-chart";

interface SalespersonDetails {
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  totalClients: number;
}

interface ComparativeSalespersonMetricsProps {
  salespersonName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSalespersonMetrics({ salespersonName, periods }: ComparativeSalespersonMetricsProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  
  // Fetch salesperson details data for all periods
  const detailsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: ['/api/sales/salesperson', salespersonName, 'details', period, filterType],
      queryFn: async () => {
        const res = await fetch(
          `/api/sales/salesperson/${encodeURIComponent(salespersonName)}/details?period=${period}&filterType=${filterType}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SalespersonDetails;
      }
    }))
  });

  const isLoading = detailsQueries.some(q => q.isLoading);
  const allData = detailsQueries.map(q => q.data);

  // Calculate metrics for each period
  const periodMetrics = allData.map(details => {
    if (!details) {
      return {
        totalSales: 0,
        totalClients: 0,
        totalTransactions: 0,
        averageTicket: 0
      };
    }
    
    return {
      totalSales: details.totalSales || 0,
      totalClients: details.totalClients || 0,
      totalTransactions: details.transactionCount || 0,
      averageTicket: details.averageTicket || 0
    };
  });

  // Get year from period for color coding
  const getYearFromPeriod = (period: string): number => {
    return parseInt(period.split('-')[0]);
  };

  // Subtle color palette for different years
  const getYearColor = (year: number): string => {
    const colors = [
      'bg-blue-50',
      'bg-green-50',
      'bg-purple-50',
      'bg-amber-50',
      'bg-rose-50',
      'bg-cyan-50',
      'bg-indigo-50',
      'bg-teal-50'
    ];
    return colors[year % colors.length];
  };

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

  // Detect if we have year-over-year comparison (same months across different years)
  const isYearOverYear = periods.length > 1 && (() => {
    const yearSet = new Set(periods.map(p => p.period.split('-')[0]));
    return yearSet.size > 1;
  })();

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Métricas del Vendedor</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Métricas del Vendedor: {salespersonName}</h3>
          {isYearOverYear && (
            <span className="text-xs text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
              Comparación año contra año
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'chart' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('chart')}
            className="gap-2"
            data-testid="button-metrics-chart-view"
          >
            <BarChart3 className="h-4 w-4" />
            Gráfico
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="gap-2"
            data-testid="button-metrics-table-view"
          >
            <Table2 className="h-4 w-4" />
            Tabla
          </Button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <ComparativeSalespersonChart
          salespersonName={salespersonName}
          periods={periods}
          periodMetrics={periodMetrics}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-semibold text-gray-700 sticky left-0 bg-white">Métrica</th>
                {periods.map(({ period, label }) => {
                  const year = getYearFromPeriod(period);
                  return (
                    <th key={period} className={`text-right py-3 px-2 font-semibold text-gray-700 ${getYearColor(year)}`}>
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-2 font-medium text-gray-900 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span>Ventas Totales</span>
                  </div>
                </td>
                {periodMetrics.map((metrics, idx) => {
                  const year = getYearFromPeriod(periods[idx].period);
                  return (
                    <td key={idx} className={`text-right py-3 px-2 font-semibold text-gray-900 ${getYearColor(year)}`}>
                      {formatCurrency(metrics.totalSales)}
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-2 font-medium text-gray-900 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span>Total Clientes</span>
                  </div>
                </td>
                {periodMetrics.map((metrics, idx) => {
                  const year = getYearFromPeriod(periods[idx].period);
                  return (
                    <td key={idx} className={`text-right py-3 px-2 font-semibold text-gray-900 ${getYearColor(year)}`}>
                      {formatNumber(metrics.totalClients)}
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-2 font-medium text-gray-900 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-purple-600" />
                    <span>Transacciones</span>
                  </div>
                </td>
                {periodMetrics.map((metrics, idx) => {
                  const year = getYearFromPeriod(periods[idx].period);
                  return (
                    <td key={idx} className={`text-right py-3 px-2 font-semibold text-gray-900 ${getYearColor(year)}`}>
                      {formatNumber(metrics.totalTransactions)}
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-2 font-medium text-gray-900 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                    <span>Ticket Promedio</span>
                  </div>
                </td>
                {periodMetrics.map((metrics, idx) => {
                  const year = getYearFromPeriod(periods[idx].period);
                  return (
                    <td key={idx} className={`text-right py-3 px-2 font-semibold text-gray-900 ${getYearColor(year)}`}>
                      {formatCurrency(metrics.averageTicket)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
