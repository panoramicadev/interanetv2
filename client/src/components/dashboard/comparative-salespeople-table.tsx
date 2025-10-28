import { useQueries } from "@tanstack/react-query";
import { Users, BarChart3 } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

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

  // Filter to show only top salespeople (those with significant sales in at least one period)
  const topSalespeople = allSalespeople.filter(salesperson => {
    const maxSales = Math.max(...periods.map((_, index) => getSales(salesperson, index)));
    return maxSales > 0;
  }).slice(0, 10); // Show top 10 for better visualization

  // Colors for different years
  const yearColors = [
    'rgb(34, 197, 94)',    // green-500
    'rgb(59, 130, 246)',   // blue-500
    'rgb(168, 85, 247)',   // purple-500
    'rgb(251, 146, 60)',   // orange-400
    'rgb(236, 72, 153)',   // pink-500
    'rgb(14, 165, 233)',   // sky-500
    'rgb(139, 92, 246)',   // violet-500
    'rgb(6, 182, 212)',    // cyan-500
  ];

  // Prepare chart data - grouped bars by salesperson
  const chartData = {
    labels: topSalespeople,
    datasets: periods.map((period, periodIdx) => ({
      label: period.label,
      data: topSalespeople.map(salesperson => getSales(salesperson, periodIdx)),
      backgroundColor: yearColors[periodIdx % yearColors.length],
      borderRadius: 6,
      borderSkipped: false,
    }))
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12,
            weight: 'bold',
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: 16,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 12,
        },
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = formatCurrency(context.parsed.y);
            return `${label}: ${value}`;
          }
        }
      },
      datalabels: {
        display: false, // Don't show labels on bars for cleaner look
      }
    },
    scales: {
      y: {
        beginAtZero: true,
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
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Evolución de Ventas por Vendedor</h3>
        </div>
        <div className="text-sm text-gray-500">
          Comparación año a año - Top 10 vendedores
        </div>
      </div>

      <div className="h-96">
        <Bar data={chartData} options={chartOptions} />
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-600">
          Cada color representa un período diferente. Las barras muestran las ventas totales de cada vendedor.
        </p>
      </div>
    </div>
  );
}
