import { useQuery } from "@tanstack/react-query";
import { CHART_COLORS_SOFT } from "@/lib/chart-palette";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

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

  const exportToExcel = () => {
    if (!segmentData || segmentData.length === 0) return;

    const totalVentas = segmentData.reduce((sum, seg) => sum + seg.totalSales, 0);

    // Summary sheet data
    const summaryData = [
      { 'Información': 'Período', 'Valor': selectedPeriod },
      { 'Información': 'Total de segmentos', 'Valor': segmentData.length },
      { 'Información': 'Total del periodo', 'Valor': totalVentas },
      { 'Información': 'Generado', 'Valor': new Date().toLocaleString('es-CL') },
    ];

    // Segment detail data
    const detailData = segmentData.map((seg, index) => ({
      '#': index + 1,
      'Segmento': seg.segment,
      'Total Ventas': seg.totalSales,
      'Porcentaje del Total': seg.percentage / 100, // Store as decimal for Excel percentage format
    }));

    const wb = XLSX.utils.book_new();

    // Main data sheet
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    wsDetail['!cols'] = [
      { wch: 5 },  // #
      { wch: 30 }, // Segmento
      { wch: 18 }, // Total Ventas
      { wch: 20 }, // Porcentaje
    ];
    // Format percentage column
    const range = XLSX.utils.decode_range(wsDetail['!ref'] || 'A1');
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const cell = wsDetail[XLSX.utils.encode_cell({ r, c: 3 })];
      if (cell) cell.z = '0.00%';
    }
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Ventas por Segmento');

    // Summary sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    XLSX.writeFile(wb, `ventas_por_segmento_${selectedPeriod.replace(/[\/\\:]/g, '-')}.xlsx`);
  };

  // Paleta categórica de la intranet (naranjo de marca primero)
  const segmentColors = CHART_COLORS_SOFT;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#fd6301] rounded-lg flex items-center justify-center shadow-md shadow-[#fd6301]/25">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Ventas por Segmento</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportToExcel}
          disabled={isLoading || !segmentData || segmentData.length === 0}
          data-testid="button-export-segments-csv"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
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