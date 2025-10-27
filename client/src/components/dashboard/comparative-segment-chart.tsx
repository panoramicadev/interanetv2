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

interface SegmentData {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface ComparativeSegmentChartProps {
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
  segmentsData: SegmentData[][];
}

export default function ComparativeSegmentChart({ periods, segmentsData }: ComparativeSegmentChartProps) {
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

  // Get all unique segments
  const allSegments = Array.from(
    new Set(segmentsData.flatMap(data => data.map(item => item.segment)))
  ).sort();

  // Color palette for years
  const yearColors = [
    { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },  // blue
    { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' },    // green
    { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' },  // purple
    { border: 'rgb(251, 146, 60)', bg: 'rgba(251, 146, 60, 0.1)' },  // orange
    { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.1)' },  // pink
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare chart data for year-over-year comparison
  const chartData = isYearOverYear ? {
    labels: months.map(m => {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return monthNames[parseInt(m) - 1];
    }),
    datasets: years.map((year, yearIdx) => {
      const data = months.map(month => {
        const periodIndex = periods.findIndex(p => p.period === `${year}-${month}`);
        if (periodIndex === -1) return 0;
        
        const periodData = segmentsData[periodIndex];
        return periodData.reduce((sum, segment) => sum + segment.totalSales, 0);
      });

      const color = yearColors[yearIdx % yearColors.length];
      
      return {
        label: year,
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
      };
    })
  } : {
    // Regular multi-period view (same year, different months/days)
    labels: periods.map(p => p.label),
    datasets: [{
      label: 'Ventas Totales',
      data: segmentsData.map(periodData => 
        periodData.reduce((sum, segment) => sum + segment.totalSales, 0)
      ),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
      borderWidth: 3,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: 'rgb(59, 130, 246)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: isYearOverYear,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
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
            weight: 'normal',
          },
        },
      },
    },
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
      {isYearOverYear && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Comparación de ventas totales por mes a través de los años
          </p>
        </div>
      )}
    </div>
  );
}
