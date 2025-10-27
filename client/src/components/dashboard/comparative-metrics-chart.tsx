import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SegmentMetrics {
  totalSales: number;
  totalClients: number;
  totalTransactions: number;
  averageTicket: number;
  newClients: number;
  clients: string[];
}

interface ComparativeMetricsChartProps {
  segmentName: string;
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
  periodMetrics: SegmentMetrics[];
}

export default function ComparativeMetricsChart({ segmentName, periods, periodMetrics }: ComparativeMetricsChartProps) {
  // Detect if we have year-over-year comparison
  const isYearOverYear = periods.length > 1 && (() => {
    const yearSet = new Set(periods.map(p => p.period.split('-')[0]));
    return yearSet.size > 1;
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

  // Color palette for metrics
  const metricColors = {
    sales: { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' },
    clients: { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },
    transactions: { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' },
  };

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

  // Prepare chart data
  const chartData = {
    labels: isYearOverYear 
      ? months.map(m => {
          const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          return monthNames[parseInt(m) - 1];
        })
      : periods.map(p => p.label),
    datasets: isYearOverYear ? 
      // Year-over-year: one line per year
      years.map((year) => {
        const data = months.map(month => {
          const periodIndex = periods.findIndex(p => p.period === `${year}-${month}`);
          if (periodIndex === -1) return 0;
          return periodMetrics[periodIndex].totalSales;
        });

        const colors = [
          { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' },
          { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },
          { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' },
          { border: 'rgb(251, 146, 60)', bg: 'rgba(251, 146, 60, 0.1)' },
          { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.1)' },
        ];
        const colorIdx = years.indexOf(year) % colors.length;
        const color = colors[colorIdx];
        
        return {
          label: `Ventas ${year}`,
          data,
          borderColor: color.border,
          backgroundColor: color.bg,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: color.border,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y',
        };
      })
      : [
        {
          label: 'Ventas Totales',
          data: periodMetrics.map(m => m.totalSales),
          borderColor: metricColors.sales.border,
          backgroundColor: metricColors.sales.bg,
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: metricColors.sales.border,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y',
        }
      ]
  };

  const options: ChartOptions<'line'> = {
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
          padding: 15,
          font: {
            size: 12,
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
      }
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
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
            weight: 'normal',
          },
        },
      },
    },
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
      {isYearOverYear && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Comparación de ventas de <span className="font-semibold">{segmentName}</span> por mes a través de los años
          </p>
        </div>
      )}
    </div>
  );
}
