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
  salespersonFilter?: string;
}

export default function SalesChart({ selectedPeriod, filterType, salespersonFilter }: SalesChartProps) {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'daily'>('daily');
  
  // Ajustar período por defecto cuando cambia filterType
  useEffect(() => {
    if (filterType === 'year') {
      setPeriod('monthly'); // Default a mensual para año
    }
  }, [filterType]);
  
  // Auto-ajustar el período del gráfico basado en el tipo de filtro
  const chartPeriod = filterType === 'day' ? 'daily' : period;
  
  const { data: chartData, isLoading } = useQuery<ChartDataPoint[]>({
    queryKey: [`/api/sales/chart-data?period=${chartPeriod}&selectedPeriod=${selectedPeriod}&filterType=${filterType}${salespersonFilter ? `&salesperson=${encodeURIComponent(salespersonFilter)}` : ''}`],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const createGradient = (ctx: any) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)'); // Verde claro transparente
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.0)'); // Transparente
    return gradient;
  };

  const chartConfig = {
    labels: chartData?.map(d => d.period) || [],
    datasets: [{
      label: 'Ventas',
      data: chartData?.map(d => d.sales) || [],
      fill: true,
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) return null;
        return createGradient(ctx);
      },
      borderColor: '#22c55e', // Verde más brillante
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: '#22c55e',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointHoverBackgroundColor: '#22c55e',
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 3,
      tension: 0.4, // Línea suavizada
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
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#22c55e',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        caretPadding: 10,
        callbacks: {
          title: () => '',
          label: (context: any) => formatCurrency(context.parsed.y)
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12,
            weight: 500
          },
          padding: 10
        }
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
          drawBorder: false
        },
        border: {
          display: false
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12
          },
          padding: 10,
          callback: (value: any) => {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(0) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(0) + 'k';
            }
            return value.toString();
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Tendencia de Ventas</h2>
          <p className="text-xs sm:text-sm text-gray-600">Puedes ver el volumen de ventas desde aquí</p>
        </div>
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto">
          <Button
            variant={chartPeriod === 'monthly' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap"
            onClick={() => setPeriod('monthly')}
            disabled={filterType === 'day'}
            data-testid="button-monthly"
          >
            Mensual
          </Button>
          <Button
            variant={chartPeriod === 'daily' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap"
            onClick={() => setPeriod('daily')}
            data-testid="button-daily"
          >
            Diario
          </Button>
          <Button
            variant={chartPeriod === 'weekly' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap"
            onClick={() => setPeriod('weekly')}
            disabled={filterType === 'day'}
            data-testid="button-weekly"
          >
            Semanal
          </Button>
        </div>
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
