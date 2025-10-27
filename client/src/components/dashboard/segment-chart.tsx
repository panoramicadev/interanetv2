import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";

interface SegmentData {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface SegmentChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  onSegmentClick?: (segmentName: string) => void;
}

export default function SegmentChart({ selectedPeriod, filterType, onSegmentClick }: SegmentChartProps) {
  const { data: segmentData, isLoading } = useQuery<SegmentData[]>({
    queryKey: ['/api/sales/segments', selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/segments?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
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
              <div
                key={segment.segment}
                onClick={() => onSegmentClick?.(segment.segment)}
                className="block hover:bg-gray-50/50 rounded-lg transition-colors cursor-pointer"
              >
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0"
                  data-testid={`segment-${index}`}
                >
                  {/* Mobile Layout */}
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
                    <div className="w-32 lg:w-48 flex-shrink-0">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {segment.segment}
                      </p>
                    </div>
                    
                    <div className="w-12 flex-shrink-0 text-center">
                      <span className="text-sm text-gray-600">
                        {segment.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
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
                    
                    <div className="w-20 flex-shrink-0 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(segment.totalSales)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Mobile Progress Bar */}
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
              </div>
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