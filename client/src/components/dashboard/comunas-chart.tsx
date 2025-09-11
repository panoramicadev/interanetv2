import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

interface ComunaData {
  comuna: string;
  totalSales: number;
  transactionCount: number;
  percentage: number;
}

interface RegionData {
  region: string;
  totalSales: number;
  transactionCount: number;
  percentage: number;
}

interface ComunasChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function ComunasChart({ selectedPeriod, filterType, segment, salesperson }: ComunasChartProps) {
  const [viewType, setViewType] = useState<'regiones' | 'comunas'>('regiones');
  
  // Build query parameters
  const queryParams = new URLSearchParams({
    period: selectedPeriod,
    filterType: filterType,
    viewType: viewType,
  });
  
  if (segment) {
    queryParams.append('segment', segment);
  }
  if (salesperson) {
    queryParams.append('salesperson', salesperson);
  }

  const { data: locationData, isLoading } = useQuery<(ComunaData | RegionData)[]>({
    queryKey: [`/api/sales/comunas?${queryParams.toString()}`],
  });

  // Prepare chart data
  const chartData = {
    labels: locationData?.map(item => (item as any).comuna || (item as any).region) || [],
    datasets: [
      {
        label: 'Ventas (Millones CLP)',
        data: locationData?.map(item => Math.round(item.totalSales / 1000000)) || [],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)', 
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(236, 72, 153, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(156, 163, 175, 1)',
        ],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: function(context: any) {
            const location = locationData?.[context.dataIndex];
            return [
              `${context.parsed.y}M CLP`,
              `Transacciones: ${location?.transactionCount || 0}`,
              `Porcentaje: ${(location?.percentage || 0).toFixed(1)}%`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value: any) {
            return value + 'M';
          },
          color: 'rgba(0, 0, 0, 0.6)',
          font: {
            size: 12,
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(0, 0, 0, 0.6)',
          font: {
            size: 12,
          },
          maxRotation: 45,
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 8,
      }
    }
  };

  return (
    <div className="space-y-4" data-testid="comunas-chart">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Ventas por {viewType === 'regiones' ? 'Región' : 'Comuna'}
          </h2>
        </div>
        
        <div className="flex bg-gray-100 rounded-lg p-1" data-testid="location-view-selector">
          <button
            onClick={() => setViewType('regiones')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              viewType === 'regiones'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            data-testid="button-view-regiones"
          >
            Regiones
          </button>
          <button
            onClick={() => setViewType('comunas')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              viewType === 'comunas'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            data-testid="button-view-comunas"
          >
            Comunas
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="animate-pulse" data-testid="comunas-chart-loading">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        ) : locationData && locationData.length > 0 ? (
          <div className="h-64 sm:h-80" data-testid="comunas-chart-content">
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500" data-testid="comunas-chart-empty">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay datos de {viewType} disponibles</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}