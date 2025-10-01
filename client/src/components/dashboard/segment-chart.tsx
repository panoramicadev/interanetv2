import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';

interface SegmentData {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface SegmentChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

export default function SegmentChart({ selectedPeriod, filterType }: SegmentChartProps) {
  const [, setLocation] = useLocation();
  const { data: segmentData, isLoading } = useQuery<SegmentData[]>({
    queryKey: [`/api/sales/segments?period=${selectedPeriod}&filterType=${filterType}`],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Prepare chart data
  const chartData = {
    labels: segmentData?.map(segment => segment.segment) || [],
    datasets: [
      {
        label: 'Ventas CLP',
        data: segmentData?.map(segment => segment.totalSales) || [],
        datalabels: {
          display: true,
          color: 'rgba(0, 0, 0, 0.8)',
          font: {
            weight: 'bold' as const,
            size: 12
          },
          formatter: function(value: number) {
            return formatCurrency(value);
          },
          anchor: 'end' as const,
          align: 'right' as const
        },
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)', 
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(236, 72, 153, 1)',
        ],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    indexAxis: 'y' as const,
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
            return formatCurrency(context.parsed.x);
          }
        }
      }
    },
    scales: {
      x: {
        display: false,
        beginAtZero: true
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(0, 0, 0, 0.6)',
          font: {
            size: 12,
          }
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 8,
      }
    },
    onClick: (event: any, activeElements: any[]) => {
      if (activeElements.length > 0) {
        const index = activeElements[0].index;
        const segmentName = segmentData?.[index]?.segment;
        if (segmentName) {
          setLocation(`/segment/${encodeURIComponent(segmentName)}`);
        }
      }
    }
  };


  // Color mapping for segments
  const segmentColors = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(16, 185, 129, 0.8)',   // green
    'rgba(245, 158, 11, 0.8)',   // amber
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(139, 92, 246, 0.8)',   // purple
    'rgba(236, 72, 153, 0.8)',   // pink
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Ventas por Segmento</h2>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : segmentData && segmentData.length > 0 ? (
          <div className="space-y-4">
            {segmentData.map((segment, index) => (
              <Link 
                key={segment.segment} 
                href={`/segment/${encodeURIComponent(segment.segment)}`}
                className="block hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0"
                  data-testid={`segment-${index}`}
                >
                  {/* Nombre del segmento y monto - Mobile */}
                  <div className="flex justify-between items-center sm:hidden">
                    <p className="text-sm text-gray-700 font-medium truncate flex-1 min-w-0 pr-2">
                      {segment.segment}
                    </p>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs text-gray-600">
                        {segment.percentage.toFixed(1)}%
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(segment.totalSales)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex sm:items-center w-full">
                    {/* Nombre del segmento */}
                    <div className="w-32 lg:w-48 flex-shrink-0">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {segment.segment}
                      </p>
                    </div>
                    
                    {/* Porcentaje */}
                    <div className="w-12 flex-shrink-0 text-center">
                      <span className="text-sm text-gray-600">
                        {segment.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="flex-1 mx-2 lg:mx-4">
                      <div className="relative">
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                          <div 
                            className="h-full rounded-lg transition-all duration-500 ease-out"
                            style={{ 
                              width: `${segment.percentage}%`,
                              backgroundColor: segmentColors[index % segmentColors.length]
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Monto */}
                    <div className="w-20 flex-shrink-0 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(segment.totalSales)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Barra de progreso - Mobile */}
                  <div className="sm:hidden">
                    <div className="relative">
                      <div className="h-3 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className="h-full rounded-lg transition-all duration-500 ease-out"
                          style={{ 
                            width: `${segment.percentage}%`,
                            backgroundColor: segmentColors[index % segmentColors.length]
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay datos de segmentos disponibles</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}