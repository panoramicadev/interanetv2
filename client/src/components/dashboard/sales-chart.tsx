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
  branch?: string;
  comparisonPeriods?: Array<{period: string, label: string, filterType: string}>;
}

// Paleta categórica de la intranet (ver skill panoramica-design): la serie
// principal va en el naranjo de marca y las de comparación siguen el orden fijo.
const CHART_COLORS = [
  { border: '#fd6301', bg: 'rgba(253, 99, 1, 0.3)' },     // Naranjo de marca
  { border: '#2563eb', bg: 'rgba(37, 99, 235, 0.3)' },    // Azul
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.3)' },   // Verde
  { border: '#db2777', bg: 'rgba(219, 39, 119, 0.3)' },   // Rosa
  { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.3)' },   // Ámbar
  { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.3)' },   // Morado
  { border: '#0d9488', bg: 'rgba(13, 148, 136, 0.3)' },   // Teal
  { border: '#64748b', bg: 'rgba(100, 116, 139, 0.3)' },  // Otras
];

// NVV: color de estado "pendiente"
const NVV_COLOR = { border: '#d97706', bg: 'rgba(217, 119, 6, 0.3)' };

export default function SalesChart({ selectedPeriod, filterType, segment, salesperson, client, product, branch, comparisonPeriods }: SalesChartProps) {
  // Auto-set chart period based on main filter type
  const getDefaultPeriod = (): 'weekly' | 'monthly' | 'daily' => {
    if (filterType === 'year') return 'monthly'; // Year view → show 12 months
    if (filterType === 'month') return 'daily';  // Month view → show days
    return 'weekly'; // Default fallback
  };
  
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'daily'>(getDefaultPeriod());
  const [dataSource, setDataSource] = useState<'facturado' | 'nvv'>('facturado');
  const isComparison = comparisonPeriods && comparisonPeriods.length > 0;
  
  // Sync chart period when main filter changes
  useEffect(() => {
    setPeriod(getDefaultPeriod());
  }, [filterType]);
  
  const chartPeriod = filterType === 'day' ? 'daily' : period;
  const isNvv = dataSource === 'nvv';
  
  // Single period query - FACTURADO
  const { data: chartData, isLoading: singleLoading} = useQuery<ChartDataPoint[]>({
    queryKey: ['/api/sales/chart-data', chartPeriod, selectedPeriod, filterType, segment, salesperson, client, product, branch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', chartPeriod);
      params.append('selectedPeriod', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (product) params.append('product', product);
      if (branch) params.append('branch', branch);
      const res = await fetch(`/api/sales/chart-data?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !isComparison && !isNvv,
  });

  // Single period query - NVV
  const { data: nvvChartData, isLoading: nvvLoading } = useQuery<ChartDataPoint[]>({
    queryKey: ['/api/nvv/chart-data', chartPeriod, selectedPeriod, filterType, segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', chartPeriod);
      params.append('selectedPeriod', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/nvv/chart-data?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !isComparison && isNvv,
  });

  // Multi-period comparison query (only for facturado)
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

  const isLoading = isComparison ? comparisonLoading : (isNvv ? nvvLoading : singleLoading);
  const activeData = isNvv ? nvvChartData : chartData;

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

  // Active color based on data source
  const activeColor = isNvv ? NVV_COLOR : CHART_COLORS[0];

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
    labels: activeData?.map(d => d.period) || [],
    datasets: [{
      label: isNvv ? 'NVV' : 'Ventas',
      data: activeData?.map(d => d.sales) || [],
      fill: true,
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) return null;
        return createGradient(ctx, activeColor.bg);
      },
      borderColor: activeColor.border,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: activeColor.border,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointHoverBackgroundColor: activeColor.border,
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
        borderColor: activeColor.border,
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
            {isComparison ? 'Comparación de Ventas' : isNvv ? 'Tendencia de NVV' : 'Tendencia de Ventas'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {isComparison 
              ? `Comparando ${comparisonPeriods?.length} períodos` 
              : isNvv ? 'Notas de venta ingresadas por día' : 'Evolución temporal de las ventas'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Facturado / NVV toggle */}
          {!isComparison && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setDataSource('facturado')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  dataSource === 'facturado'
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Facturado
              </button>
              <button
                onClick={() => setDataSource('nvv')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  dataSource === 'nvv'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                NVV
              </button>
            </div>
          )}
          {/* Period buttons */}
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
      </div>
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm w-full">
        <div className="h-60 sm:h-80 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className={`animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 ${isNvv ? 'border-amber-500' : 'border-green-500'}`}></div>
            </div>
          ) : (
            <Line data={chartConfig} options={options} />
          )}
        </div>
      </div>
    </div>
  );
}
