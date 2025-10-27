import { useQueries } from "@tanstack/react-query";
import { TrendingUp, Users, ShoppingCart, DollarSign, UserPlus } from "lucide-react";

interface SegmentClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
}

interface ComparativeSegmentMetricsProps {
  segmentName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSegmentMetrics({ segmentName, periods }: ComparativeSegmentMetricsProps) {
  // Fetch segment clients data for all periods
  const clientsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/segment/${segmentName}/clients?period=${period}&filterType=${filterType}`],
      queryFn: async () => {
        const res = await fetch(
          `/api/sales/segment/${segmentName}/clients?period=${period}&filterType=${filterType}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SegmentClient[];
      }
    }))
  });

  const isLoading = clientsQueries.some(q => q.isLoading);
  const allData = clientsQueries.map(q => q.data || []);

  // Calculate metrics for each period
  const periodMetrics = allData.map(clients => {
    const totalSales = clients.reduce((sum, c) => sum + c.totalSales, 0);
    const totalClients = clients.length;
    const totalTransactions = clients.reduce((sum, c) => sum + c.transactionCount, 0);
    const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    return {
      totalSales,
      totalClients,
      totalTransactions,
      averageTicket,
      clients: clients.map(c => c.clientName)
    };
  });

  // Calculate new clients for each period (clients not in previous periods)
  const newClientsByPeriod = periodMetrics.map((metrics, idx) => {
    if (idx === 0) return 0; // First period has no "previous" to compare
    
    const previousClients = new Set(
      periodMetrics.slice(0, idx).flatMap(m => m.clients)
    );
    
    const newClients = metrics.clients.filter(c => !previousClients.has(c));
    return newClients.length;
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

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Métricas del Segmento</h3>
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
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Métricas del Segmento: {segmentName}</h3>
      </div>

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

            <tr className="border-b hover:bg-gray-50">
              <td className="py-3 px-2 font-medium text-gray-900 sticky left-0 bg-white">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-green-600" />
                  <span>Clientes Nuevos</span>
                </div>
              </td>
              {newClientsByPeriod.map((newClients, idx) => {
                const year = getYearFromPeriod(periods[idx].period);
                return (
                  <td key={idx} className={`text-right py-3 px-2 font-semibold ${getYearColor(year)} ${idx === 0 ? 'text-gray-400' : 'text-green-600'}`}>
                    {idx === 0 ? '-' : formatNumber(newClients)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
