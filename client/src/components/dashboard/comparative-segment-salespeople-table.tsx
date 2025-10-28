import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { TrendingUp, BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface SalespersonData {
  salespersonName: string;
  totalSales: number;
}

interface ComparativeSegmentSalespeopleTableProps {
  segmentName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
}

export default function ComparativeSegmentSalespeopleTable({ segmentName, periods }: ComparativeSegmentSalespeopleTableProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  
  // Fetch salesperson data for all periods using useQueries
  const salespersonQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/segment/${segmentName}/salespeople?period=${period}&filterType=${filterType}`],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        const res = await fetch(`/api/sales/segment/${segmentName}/salespeople?${params}`, { 
          credentials: "include" 
        });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SalespersonData[];
      }
    }))
  });

  const isLoading = salespersonQueries.some(q => q.isLoading);
  const allData = salespersonQueries.map(q => q.data || []);

  // Get all unique salespeople across all periods
  const allSalespeople = Array.from(
    new Set(allData.flatMap(data => data.map(item => item.salespersonName)))
  ).sort();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get sales for a salesperson in a specific period
  const getSales = (salesperson: string, periodIndex: number) => {
    const data = allData[periodIndex];
    const item = data.find(d => d.salespersonName === salesperson);
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

  // Detect if we have year-over-year comparison (multiple years in comparison)
  const isYearOverYear = periods.length > 1 && (() => {
    const yearSet = new Set(periods.map(p => p.period.split('-')[0]));
    return yearSet.size > 1; // Multiple years = year-over-year comparison
  })();

  // Extract unique years and months for year-over-year view
  const getYearsAndMonths = () => {
    if (!isYearOverYear) return { years: [], months: [] };
    
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();
    
    periods.forEach(p => {
      const [year, month] = p.period.split('-');
      yearsSet.add(year);
      if (month) monthsSet.add(month);
    });
    
    return {
      years: Array.from(yearsSet).sort(),
      months: Array.from(monthsSet).sort()
    };
  };

  const { years, months } = getYearsAndMonths();

  // Color palette for years - solid colors for bars
  const yearColors = [
    'rgb(16, 185, 129)',   // emerald-500
    'rgb(245, 158, 11)',   // amber-500
    'rgb(59, 130, 246)',   // blue-500
    'rgb(168, 85, 247)',   // purple-500
    'rgb(239, 68, 68)',    // red-500
  ];

  // Color palette for salespeople - diverse colors for easy distinction
  const salespersonColors = [
    'rgb(59, 130, 246)',    // blue-500
    'rgb(16, 185, 129)',    // emerald-500
    'rgb(245, 158, 11)',    // amber-500
    'rgb(168, 85, 247)',    // purple-500
    'rgb(236, 72, 153)',    // pink-500
    'rgb(239, 68, 68)',     // red-500
    'rgb(34, 197, 94)',     // green-500
    'rgb(251, 146, 60)',    // orange-500
    'rgb(139, 92, 246)',    // violet-500
    'rgb(6, 182, 212)',     // cyan-500
  ];

  // Prepare chart data with each salesperson as a dataset (stacked bars)
  const chartData = isYearOverYear ? {
    labels: months.map(m => {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return monthNames[parseInt(m) - 1];
    }),
    datasets: years.flatMap((year, yearIdx) => {
      // Create a dataset for each salesperson in this year
      return allSalespeople.map((salesperson, spIdx) => {
        const data = months.map(month => {
          const periodIndex = periods.findIndex(p => p.period === `${year}-${month}`);
          if (periodIndex === -1) return 0;
          
          const periodData = allData[periodIndex];
          const spData = periodData.find(sp => sp.salespersonName === salesperson);
          return spData?.totalSales || 0;
        });

        const color = salespersonColors[spIdx % salespersonColors.length];
        
        return {
          label: `${salesperson} (${year})`,
          data,
          backgroundColor: color,
          stack: year, // Stack by year for grouped comparison
          borderRadius: 4,
          borderSkipped: false,
        };
      });
    })
  } : {
    // Regular multi-period view - show each salesperson as a dataset
    labels: periods.map(p => p.label),
    datasets: allSalespeople.map((salesperson, idx) => {
      const data = allData.map(periodData => {
        const spData = periodData.find(sp => sp.salespersonName === salesperson);
        return spData?.totalSales || 0;
      });
      
      const color = salespersonColors[idx % salespersonColors.length];
      
      return {
        label: salesperson,
        data,
        backgroundColor: color,
        borderRadius: 4,
        borderSkipped: false,
      };
    })
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
          font: {
            size: 11,
            weight: 'bold',
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = formatCurrency(context.parsed.y);
            return `${label}: ${value}`;
          },
          footer: function(tooltipItems) {
            // Show total for stacked bars
            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
            return `Total: ${formatCurrency(total)}`;
          }
        }
      },
      datalabels: {
        display: false, // Disable individual labels on stacked bars
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true, // Enable stacking for Y axis
        ticks: {
          callback: function(value) {
            return formatCurrency(Number(value));
          },
          font: {
            size: 11,
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        stacked: true, // Enable stacking for X axis
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12,
            weight: 'bold',
          },
        },
      },
    },
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
          <h3 className="font-semibold text-gray-900">Evolución de Ventas por Vendedor - {segmentName}</h3>
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
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="h-96">
            <Bar data={chartData} options={chartOptions} />
          </div>
          {isYearOverYear && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Comparación de ventas por vendedor en <span className="font-semibold">{segmentName}</span> por mes a través de los años
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Vendedor</th>
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
              {allSalespeople.map((salesperson) => (
                <tr key={salesperson} className="border-b hover:bg-gray-50" data-testid={`salesperson-row-${salesperson}`}>
                  <td className="py-3 px-4 font-medium text-gray-900">{salesperson}</td>
                  {periods.map((period, index) => {
                    const sales = getSales(salesperson, index);
                    const year = getYearFromPeriod(period.period);
                    
                    return (
                      <td key={period.period} className={`py-3 px-4 text-right ${getYearColor(year)}`}>
                        <div className="text-gray-900 font-semibold">
                          {formatCurrency(sales)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
