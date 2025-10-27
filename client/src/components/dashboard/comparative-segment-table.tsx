import { useQueries } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

interface SegmentData {
  segment: string;
  totalSales: number;
}

interface ComparativeSegmentTableProps {
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSegmentTable({ periods }: ComparativeSegmentTableProps) {
  // Fetch segment data for all periods using useQueries to respect Rules of Hooks
  const segmentQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/segments?period=${period}&filterType=${filterType}`],
      queryFn: async () => {
        const res = await fetch(`/api/sales/segments?period=${period}&filterType=${filterType}`, { 
          credentials: "include" 
        });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SegmentData[];
      }
    }))
  });

  const isLoading = segmentQueries.some(q => q.isLoading);
  const allData = segmentQueries.map(q => q.data || []);

  // Get all unique segments across all periods
  const allSegments = Array.from(
    new Set(allData.flatMap(data => data.map(item => item.segment)))
  ).sort();

  // Calculate total sales per period for percentage calculations
  const totalSalesPerPeriod = allData.map(data =>
    data.reduce((sum, item) => sum + item.totalSales, 0)
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Get sales for a segment in a specific period
  const getSales = (segment: string, periodIndex: number) => {
    const data = allData[periodIndex];
    const item = data.find(d => d.segment === segment);
    return item?.totalSales || 0;
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

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Evolución de Ventas por Segmento</h3>
        </div>
        <div className="text-sm text-gray-500">
          Comparación entre períodos seleccionados
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Segmento</th>
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
            {allSegments.map((segment) => (
              <tr key={segment} className="border-b hover:bg-gray-50" data-testid={`segment-row-${segment}`}>
                <td className="py-3 px-4 font-medium text-gray-900">{segment}</td>
                {periods.map((period, index) => {
                  const sales = getSales(segment, index);
                  const percentage = formatPercentage(sales, totalSalesPerPeriod[index]);
                  const year = getYearFromPeriod(period.period);
                  
                  return (
                    <td key={period.period} className={`py-3 px-4 text-right ${getYearColor(year)}`}>
                      <div className="text-gray-900 font-semibold">
                        {formatCurrency(sales)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {percentage}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
