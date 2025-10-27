import { useQueries } from "@tanstack/react-query";
import { Users } from "lucide-react";

interface SalespersonData {
  salesperson: string;
  totalSales: number;
}

interface TopSalespeopleResponse {
  items: SalespersonData[];
}

interface ComparativeSalespeopleTableProps {
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSalespeopleTable({ periods }: ComparativeSalespeopleTableProps) {
  // Fetch salespeople data for all periods using useQueries to respect Rules of Hooks
  const salespeopleQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/top-salespeople?limit=5000&period=${period}&filterType=${filterType}`],
      queryFn: async () => {
        const res = await fetch(
          `/api/sales/top-salespeople?limit=5000&period=${period}&filterType=${filterType}`, 
          { credentials: "include" }
        );
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as TopSalespeopleResponse;
      }
    }))
  });

  const isLoading = salespeopleQueries.some(q => q.isLoading);
  const allData = salespeopleQueries.map(q => q.data?.items || []);

  // Get all unique salespeople across all periods
  const allSalespeople = Array.from(
    new Set(allData.flatMap(data => data.map(item => item.salesperson)))
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
    if (total === 0) return "%";
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Get sales for a salesperson in a specific period
  const getSales = (salesperson: string, periodIndex: number) => {
    const data = allData[periodIndex];
    const item = data.find(d => d.salesperson === salesperson);
    return item?.totalSales || 0;
  };

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  // Filter to show only top salespeople (those with significant sales in at least one period)
  const topSalespeople = allSalespeople.filter(salesperson => {
    const maxSales = Math.max(...periods.map((_, index) => getSales(salesperson, index)));
    return maxSales > 0;
  }).slice(0, 15); // Show top 15

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Evolución de Ventas por Vendedor</h3>
        </div>
        <div className="text-sm text-gray-500">
          Comparación entre períodos seleccionados
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Vendedor</th>
              {periods.map((period) => (
                <th key={period.period} className="text-right py-3 px-4 font-semibold text-gray-700">
                  {period.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topSalespeople.map((salesperson) => (
              <tr key={salesperson} className="border-b hover:bg-gray-50" data-testid={`salesperson-row-${salesperson}`}>
                <td className="py-3 px-4 font-medium text-gray-900">{salesperson}</td>
                {periods.map((period, index) => {
                  const sales = getSales(salesperson, index);
                  const percentage = formatPercentage(sales, totalSalesPerPeriod[index]);
                  
                  return (
                    <td key={period.period} className="py-3 px-4 text-right">
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
