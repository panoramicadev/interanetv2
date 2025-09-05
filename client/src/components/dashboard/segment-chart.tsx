import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface SegmentData {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface SegmentChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "range";
}

export default function SegmentChart({ selectedPeriod, filterType }: SegmentChartProps) {
  const { data: segmentData, isLoading } = useQuery<SegmentData[]>({
    queryKey: [`/api/sales/segments?period=${selectedPeriod}&filterType=${filterType}`],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Ventas por Segmento</h2>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200/60 p-6 shadow-sm">
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
        ) : (
          <div className="space-y-4">
            {segmentData?.map((segment, index) => (
              <Link 
                key={segment.segment} 
                href={`/segment/${encodeURIComponent(segment.segment)}`}
                className="block hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div 
                  className="flex items-center py-3"
                  data-testid={`segment-${index}`}
                >
                  {/* Nombre del segmento */}
                  <div className="w-48 flex-shrink-0">
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
                  <div className="flex-1 mx-4">
                    <div className="relative">
                      <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-lg transition-all duration-500 ease-out"
                          style={{ width: `${segment.percentage}%` }}
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}