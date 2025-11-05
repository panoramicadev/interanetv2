import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { TrendingUp, BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComparativeSalespersonChart from "./comparative-salesperson-chart";

interface SalespersonMetrics {
  totalSales: number;
  totalClients: number;
  totalTransactions: number;
  averageTicket: number;
}

interface ComparativeSalespersonTableProps {
  salespersonName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSalespersonTable({ salespersonName, periods }: ComparativeSalespersonTableProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  
  // Fetch salesperson metrics for all periods using useQueries
  const metricsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/salesperson/${salespersonName}/metrics?period=${period}&filterType=${filterType}`],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        const res = await fetch(`/api/sales/salesperson/${salespersonName}/metrics?${params}`, { 
          credentials: "include" 
        });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SalespersonMetrics;
      }
    }))
  });

  const isLoading = metricsQueries.some(q => q.isLoading);
  const allMetrics = metricsQueries.map(q => q.data || {
    totalSales: 0,
    totalClients: 0,
    totalTransactions: 0,
    averageTicket: 0
  });

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

  // Detect if we have year-over-year comparison (multiple years in comparison)
  const isYearOverYear = periods.length > 1 && (() => {
    const yearSet = new Set(periods.map(p => p.period.split('-')[0]));
    return yearSet.size > 1; // Multiple years = year-over-year comparison
  })();

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  // Calculate totals across all periods
  const totalSalesAllPeriods = allMetrics.reduce((sum, m) => sum + m.totalSales, 0);
  const isMultiplePeriods = periods.length > 1;
  
  // Get period type label
  const getPeriodLabel = () => {
    if (!isMultiplePeriods) return '';
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
    <>
      {/* Summary Card for Multiple Periods Comparison */}
      {isMultiplePeriods && (
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700 mb-1">Total Acumulado de Períodos Comparados</p>
              <p className="text-3xl font-bold text-emerald-900" data-testid="text-total-period-sales">
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
      )}
      
      <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Evolución de Ventas del Vendedor</h3>
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
            data-testid="button-chart-view"
          >
            <BarChart3 className="h-4 w-4" />
            Gráfico
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="gap-2"
            data-testid="button-table-view"
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
          periodMetrics={allMetrics} 
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Métrica</th>
                {periods.map((period) => {
                  const year = getYearFromPeriod(period.period);
                  return (
                    <th key={period.period} className={`text-right py-3 px-4 font-semibold text-gray-700 ${getYearColor(year)}`}>
                      {period.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-gray-50" data-testid="row-total-sales">
                <td className="py-3 px-4 font-medium text-gray-900">Ventas Totales</td>
                {allMetrics.map((metrics, index) => {
                  const year = getYearFromPeriod(periods[index].period);
                  return (
                    <td key={index} className={`py-3 px-4 text-right ${getYearColor(year)}`}>
                      <div className="text-gray-900 font-semibold">
                        {formatCurrency(metrics.totalSales)}
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b hover:bg-gray-50" data-testid="row-total-clients">
                <td className="py-3 px-4 font-medium text-gray-900">Total Clientes</td>
                {allMetrics.map((metrics, index) => {
                  const year = getYearFromPeriod(periods[index].period);
                  return (
                    <td key={index} className={`py-3 px-4 text-right ${getYearColor(year)}`}>
                      <div className="text-gray-900 font-semibold">
                        {formatNumber(metrics.totalClients)}
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b hover:bg-gray-50" data-testid="row-total-transactions">
                <td className="py-3 px-4 font-medium text-gray-900">Transacciones</td>
                {allMetrics.map((metrics, index) => {
                  const year = getYearFromPeriod(periods[index].period);
                  return (
                    <td key={index} className={`py-3 px-4 text-right ${getYearColor(year)}`}>
                      <div className="text-gray-900 font-semibold">
                        {formatNumber(metrics.totalTransactions)}
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b hover:bg-gray-50" data-testid="row-average-ticket">
                <td className="py-3 px-4 font-medium text-gray-900">Ticket Promedio</td>
                {allMetrics.map((metrics, index) => {
                  const year = getYearFromPeriod(periods[index].period);
                  return (
                    <td key={index} className={`py-3 px-4 text-right ${getYearColor(year)}`}>
                      <div className="text-gray-900 font-semibold">
                        {formatCurrency(metrics.averageTicket)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}
