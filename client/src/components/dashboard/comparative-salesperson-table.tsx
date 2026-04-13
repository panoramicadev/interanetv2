import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, BarChart3, Table2, Users, DollarSign, ShoppingCart, UserPlus, Clock, Package, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComparativeSalespersonChart from "./comparative-salesperson-chart";

interface SalespersonDetails {
  totalSales: number;
  totalClients: number;
  transactionCount: number;
  averageTicket: number;
  newClients: number;
  salesFrequency: number;
  daysSinceLastSale: number;
  lastSaleDate: string | null;
}

interface SalespersonClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket?: number;
}

interface SalespersonProduct {
  productName: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
}

interface SalespersonSegment {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface ComparativeSalespersonTableProps {
  salespersonName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSalespersonTable({ salespersonName, periods }: ComparativeSalespersonTableProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  // Fetch full salesperson details for all periods (includes newClients, salesFrequency, etc.)
  const detailsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/salesperson/${salespersonName}/details`, period, filterType, 'comparative'],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/details?${params}`, {
          credentials: "include"
        });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SalespersonDetails;
      }
    }))
  });

  // Fetch top clients for each period (limit 5)
  const clientsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/salesperson/${salespersonName}/clients`, period, filterType, 'comparative-top5'],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        params.append('limit', '5');
        const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/clients?${params}`, {
          credentials: "include"
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        return (data.items || data || []) as SalespersonClient[];
      }
    }))
  });

  // Fetch top products for each period (limit 5)
  const productsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/salesperson/${salespersonName}/products`, period, filterType, 'comparative-top5'],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        params.append('limit', '5');
        const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/products?${params}`, {
          credentials: "include"
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        return (data.items || data || []) as SalespersonProduct[];
      }
    }))
  });

  // Fetch segments for each period
  const segmentsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/salesperson/${salespersonName}/segments`, period, filterType, 'comparative'],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/segments?${params}`, {
          credentials: "include"
        });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SalespersonSegment[];
      }
    }))
  });

  const isLoadingDetails = detailsQueries.some(q => q.isLoading);
  const isLoadingClients = clientsQueries.some(q => q.isLoading);
  const isLoadingProducts = productsQueries.some(q => q.isLoading);
  const isLoadingSegments = segmentsQueries.some(q => q.isLoading);

  const allDetails = detailsQueries.map(q => q.data || {
    totalSales: 0, totalClients: 0, transactionCount: 0,
    averageTicket: 0, newClients: 0, salesFrequency: 0,
    daysSinceLastSale: 0, lastSaleDate: null
  });

  const allClients = clientsQueries.map(q => q.data || []);
  const allProducts = productsQueries.map(q => q.data || []);
  const allSegments = segmentsQueries.map(q => q.data || []);

  // Convert to the format expected by the chart
  const periodMetrics = allDetails.map(d => ({
    totalSales: d.totalSales,
    totalClients: d.totalClients,
    totalTransactions: d.transactionCount,
    averageTicket: d.averageTicket
  }));

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

  // Calculate variation between two values
  const getVariation = (current: number, previous: number): { value: number; type: 'up' | 'down' | 'neutral' } => {
    if (previous === 0 && current === 0) return { value: 0, type: 'neutral' };
    if (previous === 0) return { value: 100, type: 'up' };
    const variation = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(variation),
      type: variation > 0.5 ? 'up' : variation < -0.5 ? 'down' : 'neutral'
    };
  };

  // Variation badge component
  const VariationBadge = ({ current, previous, inverted = false }: { current: number; previous: number; inverted?: boolean }) => {
    const variation = getVariation(current, previous);
    if (variation.type === 'neutral') {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
          <Minus className="h-3 w-3" />
          0%
        </span>
      );
    }
    const isPositive = inverted ? variation.type === 'down' : variation.type === 'up';
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
      }`}>
        {variation.type === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {variation.value.toFixed(1)}%
      </span>
    );
  };

  // Get year from period for color coding
  const getYearFromPeriod = (period: string): number => {
    return parseInt(period.split('-')[0]);
  };

  const getYearColor = (year: number): string => {
    const colors = [
      'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-amber-50',
      'bg-rose-50', 'bg-cyan-50', 'bg-indigo-50', 'bg-teal-50'
    ];
    return colors[year % colors.length];
  };

  const getYearTextColor = (year: number): string => {
    const colors = [
      'text-blue-700', 'text-green-700', 'text-purple-700', 'text-amber-700',
      'text-rose-700', 'text-cyan-700', 'text-indigo-700', 'text-teal-700'
    ];
    return colors[year % colors.length];
  };

  const getYearBorderColor = (year: number): string => {
    const colors = [
      'border-blue-200', 'border-green-200', 'border-purple-200', 'border-amber-200',
      'border-rose-200', 'border-cyan-200', 'border-indigo-200', 'border-teal-200'
    ];
    return colors[year % colors.length];
  };

  // Detect if we have year-over-year comparison
  const isYearOverYear = periods.length > 1 && (() => {
    const yearSet = new Set(periods.map(p => p.period.split('-')[0]));
    return yearSet.size > 1;
  })();

  const isMultiplePeriods = periods.length > 1;

  // Calculate totals across all periods
  const totalSalesAllPeriods = allDetails.reduce((sum, d) => sum + d.totalSales, 0);

  // Get period type label
  const getPeriodLabel = () => {
    if (!isMultiplePeriods) return '';
    const filterType = periods[0].filterType;
    const count = periods.length;
    switch (filterType) {
      case 'day': return `${count} ${count === 1 ? 'día' : 'días'}`;
      case 'month': return `${count} ${count === 1 ? 'mes' : 'meses'}`;
      case 'year': return `${count} ${count === 1 ? 'año' : 'años'}`;
      default: return `${count} ${count === 1 ? 'período' : 'períodos'}`;
    }
  };

  // Collect all unique client names across all periods
  const allUniqueClients = (() => {
    const clientMap = new Map<string, number>();
    allClients.forEach((clients) => {
      clients.forEach(c => {
        clientMap.set(c.clientName, (clientMap.get(c.clientName) || 0) + c.totalSales);
      });
    });
    return Array.from(clientMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name]) => name);
  })();

  // Collect all unique product names across all periods
  const allUniqueProducts = (() => {
    const productMap = new Map<string, number>();
    allProducts.forEach((products) => {
      products.forEach(p => {
        productMap.set(p.productName, (productMap.get(p.productName) || 0) + p.totalSales);
      });
    });
    return Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name]) => name);
  })();

  // Collect all unique segments across all periods
  const allUniqueSegments = (() => {
    const segmentSet = new Set<string>();
    allSegments.forEach(segments => {
      segments.forEach(s => segmentSet.add(s.segment));
    });
    return Array.from(segmentSet);
  })();

  if (isLoadingDetails) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">

      {/* ═══════════════════════════════════════════════ */}
      {/* SECTION 1: KPI Cards Comparativas              */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Accumulated Total Card */}
        <div className="sm:col-span-2 lg:col-span-3 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700 mb-1">Total Acumulado — {getPeriodLabel()} comparados</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-900" data-testid="text-total-period-sales">
                {formatCurrency(totalSalesAllPeriods)}
              </p>
            </div>
            <div className="bg-emerald-100 rounded-2xl p-3 sm:p-4 shadow-sm">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Period KPI Cards */}
        {periods.map((period, idx) => {
          const details = allDetails[idx];
          const year = getYearFromPeriod(period.period);
          const prevDetails = idx > 0 ? allDetails[idx - 1] : null;

          return (
            <div
              key={period.period}
              className={`border rounded-2xl p-4 ${getYearColor(year)} ${getYearBorderColor(year)} space-y-3`}
            >
              <div className="flex items-center justify-between">
                <h4 className={`text-sm font-bold ${getYearTextColor(year)} truncate`}>{period.label}</h4>
                {isYearOverYear && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getYearColor(year)} ${getYearTextColor(year)} border ${getYearBorderColor(year)}`}>
                    {period.period.split('-')[0]}
                  </span>
                )}
              </div>

              {/* Main metric */}
              <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(details.totalSales)}</p>
                {prevDetails && (
                  <VariationBadge current={details.totalSales} previous={prevDetails.totalSales} />
                )}
              </div>

              {/* Sub-metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/60 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Users className="h-3 w-3 text-blue-500" />
                    <span className="text-[10px] text-gray-500">Clientes</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{formatNumber(details.totalClients)}</p>
                  {prevDetails && <VariationBadge current={details.totalClients} previous={prevDetails.totalClients} />}
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <ShoppingCart className="h-3 w-3 text-violet-500" />
                    <span className="text-[10px] text-gray-500">Transacciones</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{formatNumber(details.transactionCount)}</p>
                  {prevDetails && <VariationBadge current={details.transactionCount} previous={prevDetails.transactionCount} />}
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <DollarSign className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-gray-500">Ticket Prom.</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(details.averageTicket)}</p>
                  {prevDetails && <VariationBadge current={details.averageTicket} previous={prevDetails.averageTicket} />}
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <UserPlus className="h-3 w-3 text-teal-500" />
                    <span className="text-[10px] text-gray-500">Nuevos</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{formatNumber(details.newClients)}</p>
                  {prevDetails && <VariationBadge current={details.newClients} previous={prevDetails.newClients} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* SECTION 2: Chart + Extended Metrics Table       */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">Evolución de Ventas</h3>
            {isYearOverYear && (
              <span className="text-xs text-gray-500 bg-blue-50 px-3 py-1 rounded-full hidden sm:inline">
                Año contra año
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'chart' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('chart')}
              className="gap-1.5"
              data-testid="button-chart-view"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Gráfico</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="gap-1.5"
              data-testid="button-table-view"
            >
              <Table2 className="h-4 w-4" />
              <span className="hidden sm:inline">Tabla</span>
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
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-0 bg-white z-10">Métrica</th>
                  {periods.map((period) => {
                    const year = getYearFromPeriod(period.period);
                    return (
                      <th key={period.period} className={`text-right py-3 px-3 font-semibold text-gray-700 ${getYearColor(year)}`}>
                        {period.label}
                      </th>
                    );
                  })}
                  {periods.length > 1 && (
                    <th className="text-right py-3 px-3 font-semibold text-gray-500 bg-gray-50">Δ%</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* Ventas Totales */}
                <tr className="border-b hover:bg-gray-50/50">
                  <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Ventas Totales</span>
                    </div>
                  </td>
                  {allDetails.map((d, idx) => {
                    const year = getYearFromPeriod(periods[idx].period);
                    return (
                      <td key={idx} className={`py-3 px-3 text-right font-semibold text-gray-900 ${getYearColor(year)}`}>
                        {formatCurrency(d.totalSales)}
                      </td>
                    );
                  })}
                  {periods.length > 1 && (
                    <td className="py-3 px-3 text-right bg-gray-50">
                      <VariationBadge
                        current={allDetails[allDetails.length - 1].totalSales}
                        previous={allDetails[0].totalSales}
                      />
                    </td>
                  )}
                </tr>
                {/* Clientes */}
                <tr className="border-b hover:bg-gray-50/50">
                  <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span>Clientes</span>
                    </div>
                  </td>
                  {allDetails.map((d, idx) => {
                    const year = getYearFromPeriod(periods[idx].period);
                    return (
                      <td key={idx} className={`py-3 px-3 text-right font-semibold text-gray-900 ${getYearColor(year)}`}>
                        {formatNumber(d.totalClients)}
                      </td>
                    );
                  })}
                  {periods.length > 1 && (
                    <td className="py-3 px-3 text-right bg-gray-50">
                      <VariationBadge
                        current={allDetails[allDetails.length - 1].totalClients}
                        previous={allDetails[0].totalClients}
                      />
                    </td>
                  )}
                </tr>
                {/* Transacciones */}
                <tr className="border-b hover:bg-gray-50/50">
                  <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-violet-600 flex-shrink-0" />
                      <span>Transacciones</span>
                    </div>
                  </td>
                  {allDetails.map((d, idx) => {
                    const year = getYearFromPeriod(periods[idx].period);
                    return (
                      <td key={idx} className={`py-3 px-3 text-right font-semibold text-gray-900 ${getYearColor(year)}`}>
                        {formatNumber(d.transactionCount)}
                      </td>
                    );
                  })}
                  {periods.length > 1 && (
                    <td className="py-3 px-3 text-right bg-gray-50">
                      <VariationBadge
                        current={allDetails[allDetails.length - 1].transactionCount}
                        previous={allDetails[0].transactionCount}
                      />
                    </td>
                  )}
                </tr>
                {/* Ticket Promedio */}
                <tr className="border-b hover:bg-gray-50/50">
                  <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span>Ticket Promedio</span>
                    </div>
                  </td>
                  {allDetails.map((d, idx) => {
                    const year = getYearFromPeriod(periods[idx].period);
                    return (
                      <td key={idx} className={`py-3 px-3 text-right font-semibold text-gray-900 ${getYearColor(year)}`}>
                        {formatCurrency(d.averageTicket)}
                      </td>
                    );
                  })}
                  {periods.length > 1 && (
                    <td className="py-3 px-3 text-right bg-gray-50">
                      <VariationBadge
                        current={allDetails[allDetails.length - 1].averageTicket}
                        previous={allDetails[0].averageTicket}
                      />
                    </td>
                  )}
                </tr>
                {/* Clientes Nuevos */}
                <tr className="border-b hover:bg-gray-50/50">
                  <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-teal-600 flex-shrink-0" />
                      <span>Clientes Nuevos</span>
                    </div>
                  </td>
                  {allDetails.map((d, idx) => {
                    const year = getYearFromPeriod(periods[idx].period);
                    return (
                      <td key={idx} className={`py-3 px-3 text-right font-semibold text-gray-900 ${getYearColor(year)}`}>
                        {formatNumber(d.newClients)}
                      </td>
                    );
                  })}
                  {periods.length > 1 && (
                    <td className="py-3 px-3 text-right bg-gray-50">
                      <VariationBadge
                        current={allDetails[allDetails.length - 1].newClients}
                        previous={allDetails[0].newClients}
                      />
                    </td>
                  )}
                </tr>
                {/* Ventas por Día (calculado) */}
                <tr className="border-b hover:bg-gray-50/50">
                  <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                      <span>Venta Promedio / Transacción</span>
                    </div>
                  </td>
                  {allDetails.map((d, idx) => {
                    const year = getYearFromPeriod(periods[idx].period);
                    const avgPerTx = d.transactionCount > 0 ? d.totalSales / d.transactionCount : 0;
                    return (
                      <td key={idx} className={`py-3 px-3 text-right font-semibold text-gray-900 ${getYearColor(year)}`}>
                        {formatCurrency(avgPerTx)}
                      </td>
                    );
                  })}
                  {periods.length > 1 && (
                    <td className="py-3 px-3 text-right bg-gray-50">
                      {(() => {
                        const first = allDetails[0];
                        const last = allDetails[allDetails.length - 1];
                        const prevAvg = first.transactionCount > 0 ? first.totalSales / first.transactionCount : 0;
                        const currAvg = last.transactionCount > 0 ? last.totalSales / last.transactionCount : 0;
                        return <VariationBadge current={currAvg} previous={prevAvg} />;
                      })()}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* SECTION 3: Ventas por Segmento                 */}
      {/* ═══════════════════════════════════════════════ */}
      {!isLoadingSegments && allUniqueSegments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Ventas por Segmento</h3>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-0 bg-white z-10">Segmento</th>
                  {periods.map((period) => {
                    const year = getYearFromPeriod(period.period);
                    return (
                      <th key={period.period} className={`text-right py-3 px-3 font-semibold text-gray-700 ${getYearColor(year)}`}>
                        {period.label}
                      </th>
                    );
                  })}
                  {periods.length > 1 && (
                    <th className="text-right py-3 px-3 font-semibold text-gray-500 bg-gray-50">Δ%</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allUniqueSegments.map((segmentName) => (
                  <tr key={segmentName} className="border-b hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10 max-w-[150px] truncate">
                      {segmentName}
                    </td>
                    {allSegments.map((segments, idx) => {
                      const year = getYearFromPeriod(periods[idx].period);
                      const segment = segments.find(s => s.segment === segmentName);
                      return (
                        <td key={idx} className={`py-3 px-3 text-right ${getYearColor(year)}`}>
                          <div className="font-semibold text-gray-900">{formatCurrency(segment?.totalSales || 0)}</div>
                          <div className="text-[10px] text-gray-500">{(segment?.percentage || 0).toFixed(1)}%</div>
                        </td>
                      );
                    })}
                    {periods.length > 1 && (
                      <td className="py-3 px-3 text-right bg-gray-50">
                        {(() => {
                          const firstSegment = allSegments[0]?.find(s => s.segment === segmentName);
                          const lastSegment = allSegments[allSegments.length - 1]?.find(s => s.segment === segmentName);
                          return (
                            <VariationBadge
                              current={lastSegment?.totalSales || 0}
                              previous={firstSegment?.totalSales || 0}
                            />
                          );
                        })()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* SECTION 4: Top Clientes por Período             */}
      {/* ═══════════════════════════════════════════════ */}
      {!isLoadingClients && allUniqueClients.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Top Clientes Comparados</h3>
            <span className="text-xs text-gray-500 bg-orange-50 px-2 py-0.5 rounded-full hidden sm:inline">
              {allUniqueClients.length} clientes
            </span>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-0 bg-white z-10">Cliente</th>
                  {periods.map((period) => {
                    const year = getYearFromPeriod(period.period);
                    return (
                      <th key={period.period} className={`text-right py-3 px-3 font-semibold text-gray-700 ${getYearColor(year)}`}>
                        {period.label}
                      </th>
                    );
                  })}
                  {periods.length > 1 && (
                    <th className="text-right py-3 px-3 font-semibold text-gray-500 bg-gray-50">Δ%</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allUniqueClients.map((clientName, clientIdx) => (
                  <tr key={clientName} className={`border-b hover:bg-gray-50/50 ${clientIdx === 0 ? 'bg-orange-50/30' : ''}`}>
                    <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          clientIdx === 0 ? 'bg-amber-100 text-amber-700' :
                          clientIdx === 1 ? 'bg-gray-100 text-gray-600' :
                          clientIdx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {clientIdx + 1}
                        </span>
                        <span className="truncate max-w-[120px] sm:max-w-[180px]">{clientName}</span>
                      </div>
                    </td>
                    {allClients.map((clients, idx) => {
                      const year = getYearFromPeriod(periods[idx].period);
                      const client = clients.find(c => c.clientName === clientName);
                      return (
                        <td key={idx} className={`py-3 px-3 text-right ${getYearColor(year)}`}>
                          {client ? (
                            <div>
                              <div className="font-semibold text-gray-900">{formatCurrency(client.totalSales)}</div>
                              <div className="text-[10px] text-gray-500">{client.transactionCount} tx</div>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    {periods.length > 1 && (
                      <td className="py-3 px-3 text-right bg-gray-50">
                        {(() => {
                          const firstClient = allClients[0]?.find(c => c.clientName === clientName);
                          const lastClient = allClients[allClients.length - 1]?.find(c => c.clientName === clientName);
                          return (
                            <VariationBadge
                              current={lastClient?.totalSales || 0}
                              previous={firstClient?.totalSales || 0}
                            />
                          );
                        })()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* SECTION 5: Top Productos por Período            */}
      {/* ═══════════════════════════════════════════════ */}
      {!isLoadingProducts && allUniqueProducts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Top Productos Comparados</h3>
            <span className="text-xs text-gray-500 bg-purple-50 px-2 py-0.5 rounded-full hidden sm:inline">
              {allUniqueProducts.length} productos
            </span>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-0 bg-white z-10">Producto</th>
                  {periods.map((period) => {
                    const year = getYearFromPeriod(period.period);
                    return (
                      <th key={period.period} className={`text-right py-3 px-3 font-semibold text-gray-700 ${getYearColor(year)}`}>
                        {period.label}
                      </th>
                    );
                  })}
                  {periods.length > 1 && (
                    <th className="text-right py-3 px-3 font-semibold text-gray-500 bg-gray-50">Δ%</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allUniqueProducts.map((productName, productIdx) => (
                  <tr key={productName} className={`border-b hover:bg-gray-50/50 ${productIdx === 0 ? 'bg-purple-50/30' : ''}`}>
                    <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          productIdx === 0 ? 'bg-purple-100 text-purple-700' :
                          productIdx === 1 ? 'bg-gray-100 text-gray-600' :
                          productIdx === 2 ? 'bg-violet-100 text-violet-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {productIdx + 1}
                        </span>
                        <span className="truncate max-w-[120px] sm:max-w-[180px]">{productName}</span>
                      </div>
                    </td>
                    {allProducts.map((products, idx) => {
                      const year = getYearFromPeriod(periods[idx].period);
                      const product = products.find(p => p.productName === productName);
                      return (
                        <td key={idx} className={`py-3 px-3 text-right ${getYearColor(year)}`}>
                          {product ? (
                            <div>
                              <div className="font-semibold text-gray-900">{formatCurrency(product.totalSales)}</div>
                              <div className="text-[10px] text-gray-500">{formatNumber(product.totalUnits || 0)} uds</div>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    {periods.length > 1 && (
                      <td className="py-3 px-3 text-right bg-gray-50">
                        {(() => {
                          const firstProduct = allProducts[0]?.find(p => p.productName === productName);
                          const lastProduct = allProducts[allProducts.length - 1]?.find(p => p.productName === productName);
                          return (
                            <VariationBadge
                              current={lastProduct?.totalSales || 0}
                              previous={firstProduct?.totalSales || 0}
                            />
                          );
                        })()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
