import { useQuery } from "@tanstack/react-query";
import { CHART_COLORS_SOFT } from "@/lib/chart-palette";
import { BarChart3, Users } from "lucide-react";

interface SalespersonData {
  salesperson: string;
  totalSales: number;
  transactionCount?: number;
}

interface SalespersonChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  onSalespersonClick?: (name: string) => void;
}

export default function SalespersonChart({ selectedPeriod, filterType, segment, onSalespersonClick }: SalespersonChartProps) {
  const { data: salespeopleData, isLoading } = useQuery<{ items: SalespersonData[] }>({
    queryKey: ['/api/sales/top-salespeople', selectedPeriod, filterType, segment],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', '20');
      if (segment) params.append('segment', segment);
      const res = await fetch(`/api/sales/top-salespeople?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  const items = salespeopleData?.items || [];
  const totalSales = items.reduce((sum, sp) => sum + sp.totalSales, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Paleta categórica de la intranet (naranjo de marca primero)
  const barColors = CHART_COLORS_SOFT;

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#fd6301] rounded-lg flex items-center justify-center shadow-md shadow-[#fd6301]/25">
          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
          Ventas por Vendedor
          {segment && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              — {segment}
            </span>
          )}
        </h2>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200/60 dark:border-gray-700/60 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-3">
            {items.map((sp, index) => {
              const pct = totalSales > 0 ? (sp.totalSales / totalSales) * 100 : 0;
              return (
                <div
                  key={sp.salesperson}
                  onClick={() => onSalespersonClick?.(sp.salesperson)}
                  className="block hover:bg-gray-50/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-2.5 space-y-1.5 sm:space-y-0">
                    {/* Mobile Layout */}
                    <div className="flex justify-between items-center sm:hidden">
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate flex-1 min-w-0 pr-2">
                        {sp.salesperson}
                      </p>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {pct.toFixed(1)}%
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(sp.totalSales)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Desktop Layout */}
                    <div className="hidden sm:flex sm:items-center w-full">
                      <div className="w-44 lg:w-56 flex-shrink-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">
                          {sp.salesperson}
                        </p>
                      </div>
                      
                      <div className="w-12 flex-shrink-0 text-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex-1 mx-2 lg:mx-4">
                        <div className="relative">
                          <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                            <div 
                              className="h-full rounded-lg transition-all duration-500 ease-out"
                              style={{ 
                                width: `${pct}%`,
                                backgroundColor: barColors[index % barColors.length]
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-24 flex-shrink-0 text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(sp.totalSales)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Mobile Progress Bar */}
                    <div className="sm:hidden">
                      <div className="relative">
                        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                          <div 
                            className="h-full rounded-lg transition-all duration-500 ease-out"
                            style={{ 
                              width: `${pct}%`,
                              backgroundColor: barColors[index % barColors.length]
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay datos de vendedores disponibles</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
