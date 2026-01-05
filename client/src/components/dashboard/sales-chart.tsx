import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { useState, useEffect } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface ChartDataPoint {
  period: string;
  sales: number;
}

interface SalesChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
  comparisonPeriods?: Array<{period: string, label: string, filterType: string}>;
}

const CHART_COLORS = [
  { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.3)' },    // Verde
  { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.3)' },   // Azul
  { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.3)' },   // Naranja
  { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.3)' },   // Morado
  { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.3)' },   // Rosa
  { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.3)' },   // Teal
  { border: '#f97316', bg: 'rgba(249, 115, 22, 0.3)' },   // Naranja oscuro
  { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.3)' },    // Cyan
];

export default function SalesChart({ selectedPeriod, filterType, segment, salesperson, client, product, comparisonPeriods }: SalesChartProps) {
  // Auto-set chart period based on main filter type
  const getDefaultPeriod = (): 'weekly' | 'monthly' | 'daily' => {
    if (filterType === 'year') return 'monthly'; // Year view → show 12 months
    if (filterType === 'month') return 'daily';  // Month view → show days
    return 'weekly'; // Default fallback
  };
  
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'daily'>(getDefaultPeriod());
  const isComparison = comparisonPeriods && comparisonPeriods.length > 0;
  
  // Sync chart period when main filter changes
  useEffect(() => {
    setPeriod(getDefaultPeriod());
  }, [filterType]);
  
  const chartPeriod = filterType === 'day' ? 'daily' : period;
  
  // Single period query
  const { data: chartData, isLoading: singleLoading} = useQuery<ChartDataPoint[]>({
    queryKey: ['/api/sales/chart-data', chartPeriod, selectedPeriod, filterType, segment, salesperson, client, product],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', chartPeriod);
      params.append('selectedPeriod', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (product) params.append('product', product);
      const res = await fetch(`/api/sales/chart-data?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !isComparison,
  });

  // Multi-period comparison query
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ['/api/sales/chart-data-comparison', comparisonPeriods, chartPeriod, segment, salesperson, client, product],
    queryFn: async () => {
      const results = await Promise.all(
        (comparisonPeriods || []).map(async ({ period: p, label, filterType: ft }) => {
          const params = new URLSearchParams();
          params.append('period', chartPeriod);
          params.append('selectedPeriod', p);
          params.append('filterType', ft);
          if (segment) params.append('segment', segment);
          if (salesperson) params.append('salesperson', salesperson);
          if (client) params.append('client', client);
          if (product) params.append('product', product);
          
          const res = await fetch(`/api/sales/chart-data?${params}`, { credentials: "include" });
          if (!res.ok) throw new Error('Failed to fetch');
          const data = await res.json();
          return { label, data };
        })
      );
      return results;
    },
    enabled: isComparison,
  });

  const isLoading = isComparison ? comparisonLoading : singleLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const createGradient = (ctx: any, color: string) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color.replace(/[\d.]+\)/, '0.0)'));
    return gradient;
  };

  // Build chart configuration
  const chartConfig = isComparison && comparisonData ? {
    labels: comparisonData[0]?.data?.map((d: ChartDataPoint) => d.period) || [],
    datasets: comparisonData.map((item: any, index: number) => {
      const colorSet = CHART_COLORS[index % CHART_COLORS.length];
      return {
        label: item.label,
        data: item.data?.map((d: ChartDataPoint) => d.sales) || [],
        fill: true,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          return createGradient(ctx, colorSet.bg);
        },
        borderColor: colorSet.border,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: colorSet.border,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: colorSet.border,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 3,
        tension: 0.4,
      };
    })
  } : {
    labels: chartData?.map(d => d.period) || [],
    datasets: [{
      label: 'Ventas',
      data: chartData?.map(d => d.sales) || [],
      fill: true,
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) return null;
        return createGradient(ctx, 'rgba(34, 197, 94, 0.3)');
      },
      borderColor: '#22c55e',
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: '#22c55e',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointHoverBackgroundColor: '#22c55e',
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 3,
      tension: 0.4,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: isComparison,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: 500,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#22c55e',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = formatCurrency(context.parsed.y);
            return `${label}: ${value}`;
          },
        },
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) {
              return `$${(value / 1000000).toFixed(1)}M`;
            } else if (value >= 1000) {
              return `$${(value / 1000).toFixed(0)}K`;
            }
            return `$${value}`;
          },
          font: {
            size: 11,
            weight: 500,
          },
          color: '#6b7280',
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
          drawBorder: false,
        },
      },
      x: {
        ticks: {
          font: {
            size: 11,
            weight: 500,
          },
          color: '#6b7280',
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">
            {isComparison ? 'Comparación de Ventas' : 'Tendencia de Ventas'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {isComparison 
              ? `Comparando ${comparisonPeriods?.length} períodos` 
              : 'Evolución temporal de las ventas'
            }
          </p>
        </div>
        {filterType !== 'day' && (
          <div className="flex gap-2">
            <Button
              variant={period === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('daily')}
              className="text-xs"
              data-testid="button-chart-daily"
            >
              Diario
            </Button>
            <Button
              variant={period === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('weekly')}
              className="text-xs"
              data-testid="button-chart-weekly"
            >
              Semanal
            </Button>
            <Button
              variant={period === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('monthly')}
              className="text-xs"
              data-testid="button-chart-monthly"
            >
              Mensual
            </Button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm w-full">
        <div className="h-60 sm:h-80 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <Line data={chartConfig} options={options} />
          )}
        </div>
      </div>
    </div>
  );
}
