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

interface SalespersonMetrics {
  totalSales: number;
  totalClients: number;
  totalTransactions: number;
  averageTicket: number;
}

interface ComparativeSalespersonChartProps {
  salespersonName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
  periodMetrics: SalespersonMetrics[];
}

export default function ComparativeSalespersonChart({ salespersonName, periods, periodMetrics }: ComparativeSalespersonChartProps) {
  // Detect if we have TRUE year-over-year comparison (same month/period across different years)
  const isYearOverYear = periods.length > 1 && (() => {
    const yearSet = new Set(periods.map(p => p.period.split('-')[0]));
    if (yearSet.size <= 1) return false; // Same year, not year-over-year
    
    // Check if all periods have the same month/day (true year-over-year)
    const monthDayParts = periods.map(p => p.period.substring(5)); // Get everything after year (MM or MM-DD)
    const monthDaySet = new Set(monthDayParts);
    
    // Only true year-over-year if same month/day across different years
    return monthDaySet.size === 1;
  })();

  // Extract unique years and months for year-over-year view
  const getYearsAndMonths = () => {
    if (!isYearOverYear) return { years: [], months: [] };
    
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();
    
    periods.forEach(p => {
      const [year, month] = p.period.split('-');
      yearsSet.add(year);
      monthsSet.add(month);
    });
    
    return {
      years: Array.from(yearsSet).sort(),
      months: Array.from(monthsSet).sort()
    };
  };

  const { years, months } = getYearsAndMonths();

  // Color palette for years - same as segment chart
  const yearColors = [
    'rgb(16, 185, 129)',   // emerald-500
    'rgb(245, 158, 11)',   // amber-500
    'rgb(59, 130, 246)',   // blue-500
    'rgb(168, 85, 247)',   // purple-500
    'rgb(239, 68, 68)',    // red-500
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare chart data
  const chartData = {
    labels: isYearOverYear 
      ? months.map(m => {
          const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          return monthNames[parseInt(m) - 1];
        })
      : periods.map(p => p.label),
    datasets: isYearOverYear ? 
      // Year-over-year: one bar per year
      years.map((year, yearIdx) => {
        const data = months.map(month => {
          const periodIndex = periods.findIndex(p => p.period === `${year}-${month}`);
          if (periodIndex === -1) return 0;
          return periodMetrics[periodIndex].totalSales;
        });

        const color = yearColors[yearIdx % yearColors.length];
        
        return {
          label: year,
          data,
          backgroundColor: color,
          borderRadius: 6,
          borderSkipped: false,
        };
      })
      : [
        {
          label: 'Ventas Totales',
          data: periodMetrics.map(m => m.totalSales),
          backgroundColor: 'rgb(16, 185, 129)',
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 13,
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
          }
        }
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        formatter: (value: number) => {
          if (value === 0) return '';
          // Format in millions with 'M' suffix
          return `$${(value / 1000000).toFixed(1)}M`;
        },
        font: {
          size: 10,
          weight: 'bold',
        },
        color: '#374151',
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
            size: 12,
            weight: 'bold',
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="h-96">
        <Bar data={chartData} options={options} />
      </div>
      {isYearOverYear && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Comparación de ventas de <span className="font-semibold">{salespersonName}</span> por mes a través de los años
          </p>
        </div>
      )}
    </div>
  );
}
