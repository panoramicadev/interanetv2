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
  // Detect comparison type
  const isFullYearComparison = periods.length > 1 && periods.every(p => p.filterType === 'year');
  
  // Detect if we have year-over-year comparison (multiple years, same months)
  const isYearOverYear = !isFullYearComparison && periods.length > 1 && (() => {
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

  // Get all unique segments
  const allSegments = Array.from(
    new Set(segmentsData.flatMap(data => data.map(item => item.segment)))
  ).sort();

  // Color palette for years - solid colors for bars
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

  // Prepare chart data based on comparison type
  const chartData = isFullYearComparison ? {
    // Full year comparison (e.g., 2024 vs 2025)
    // Sort periods by year ascending (2023, 2024, 2025)
    labels: (() => {
      const sortedPeriods = [...periods].sort((a, b) => a.period.localeCompare(b.period));
      return sortedPeriods.map(p => p.label);
    })(),
    datasets: [{
      label: 'Ventas Totales',
      data: (() => {
        const sortedPeriods = [...periods].sort((a, b) => a.period.localeCompare(b.period));
        return sortedPeriods.map(period => {
          const originalIndex = periods.findIndex(p => p.period === period.period);
          const periodData = segmentsData[originalIndex];
          return periodData.reduce((sum, segment) => sum + segment.totalSales, 0);
        });
      })(),
      backgroundColor: (() => {
        const sortedPeriods = [...periods].sort((a, b) => a.period.localeCompare(b.period));
        return sortedPeriods.map((_, idx) => yearColors[idx % yearColors.length]);
      })(),
      borderRadius: 6,
      borderSkipped: false,
    }]
  } : isYearOverYear ? {
    // Year-over-year comparison with months
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
        backgroundColor: color,
        borderRadius: 6,
        borderSkipped: false,
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
      backgroundColor: 'rgb(16, 185, 129)',
      borderRadius: 6,
      borderSkipped: false,
    }]
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
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
          // Format as Chilean pesos with thousand separators
          return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value);
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
            Comparación de ventas totales por mes a través de los años
          </p>
        </div>
      )}
    </div>
  );
}
