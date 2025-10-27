import { useQueries } from "@tanstack/react-query";
import { Users } from "lucide-react";

interface SegmentClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  percentage: number;
}

interface ComparativeSegmentClientsTableProps {
  segmentName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSegmentClientsTable({ segmentName, periods }: ComparativeSegmentClientsTableProps) {
  // Fetch segment clients data for all periods
  const clientsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: ['/api/sales/segment', segmentName, 'clients', period, filterType],
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

  // Debug: Log the data for each period
  console.log('🔍 [ComparativeSegmentClientsTable] Data by period:', periods.map((p, idx) => ({
    period: p.period,
    label: p.label,
    dataLength: allData[idx]?.length || 0,
    totalSales: allData[idx]?.reduce((sum, c) => sum + c.totalSales, 0) || 0
  })));

  // Get all unique clients across all periods
  const allClients = Array.from(
    new Set(allData.flatMap(data => data.map(item => item.clientName)))
  ).sort();

  // Calculate totals for percentage
  const totalsByPeriod = allData.map(data =>
    data.reduce((sum, item) => sum + item.totalSales, 0)
  );

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

  // Detect if we have year-over-year comparison
  const isYearOverYear = periods.length > 1 && (() => {
    const yearSet = new Set(periods.map(p => p.period.split('-')[0]));
    return yearSet.size > 1;
  })();

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Ventas por Cliente</h3>
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
        <Users className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Ventas por Cliente - {segmentName}</h3>
        {isYearOverYear && (
          <span className="ml-auto text-xs text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
            Comparación año contra año
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-2 font-semibold text-gray-700 sticky left-0 bg-white">Cliente</th>
              {periods.map(({ period, label }) => {
                const year = getYearFromPeriod(period);
                return (
                  <th key={period} className={`text-right py-3 px-2 font-semibold text-gray-700 ${getYearColor(year)}`}>
                    <div>{label}</div>
                    <div className="text-xs font-normal text-gray-500">Ventas / Trans / Ticket / %</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allClients.slice(0, 30).map((clientName) => {
              return (
                <tr key={clientName} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-900 sticky left-0 bg-white">{clientName}</td>
                  {allData.map((data, idx) => {
                    const item = data.find(d => d.clientName === clientName);
                    const sales = item?.totalSales || 0;
                    const transactions = item?.transactionCount || 0;
                    const averageTicket = item?.averageTicket || 0;
                    const percentage = totalsByPeriod[idx] > 0
                      ? (sales / totalsByPeriod[idx] * 100).toFixed(1)
                      : '0.0';
                    const year = getYearFromPeriod(periods[idx].period);

                    return (
                      <td key={idx} className={`text-right py-2 px-2 ${getYearColor(year)}`}>
                        <div className="font-semibold text-gray-900">
                          ${sales.toLocaleString('es-CL')}
                        </div>
                        <div className="text-xs text-gray-600">
                          {transactions.toLocaleString('es-CL')} trans
                        </div>
                        <div className="text-xs text-gray-600">
                          ${averageTicket.toLocaleString('es-CL')} avg
                        </div>
                        <div className="text-xs text-gray-500">{percentage}%</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-bold">
              <td className="py-3 px-2 sticky left-0 bg-white">Total</td>
              {totalsByPeriod.map((total, idx) => {
                const year = getYearFromPeriod(periods[idx].period);
                return (
                  <td key={idx} className={`text-right py-3 px-2 ${getYearColor(year)}`}>
                    ${total.toLocaleString('es-CL')}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
