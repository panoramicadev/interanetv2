import { useQuery } from "@tanstack/react-query";
import { Package, BarChart3 } from "lucide-react";

interface PackagingMetric {
  packagingType: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  salesPercentage: number;
  unitPercentage: number;
}

interface PackagingUnitsMetricsProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
}

// Mapping packaging codes to friendly names
const packagingNames: Record<string, string> = {
  'BD': 'Baldes',
  'GL': 'Galones',
  'Q4': '4 Galones',
  'KT': 'Kits',
  'UN': 'Unidades',
  'KG': 'Kilogramos',
  'LT': 'Litros',
  'GB': 'Garrafas/Bidón',
  'OD': 'Onzas',
  'OT': 'Otros'
};

export default function PackagingUnitsMetrics({ selectedPeriod, filterType, segment, salesperson }: PackagingUnitsMetricsProps) {
  const { data: packagingData, isLoading } = useQuery<PackagingMetric[]>({
    queryKey: [`/api/sales/packaging-metrics?period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
  });

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CL').format(value);
  };

  // Sort by total units descending
  const sortedData = packagingData?.sort((a, b) => b.totalUnits - a.totalUnits) || [];

  // Calculate total units for display
  const totalUnits = sortedData.reduce((sum, item) => sum + item.totalUnits, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Cantidad Contable x Unidades</h2>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        ) : !sortedData.length ? (
          <div className="text-center py-8 text-gray-500" data-testid="text-no-packaging-units-data">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay datos de unidades por packaging disponibles</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedData.map((item, index) => (
              <div 
                key={item.packagingType} 
                className="flex items-center space-x-4 py-2 hover:bg-gray-50/80 rounded-lg px-2 transition-colors"
                data-testid={`packaging-units-${item.packagingType}`}
              >
                <div className="flex items-center space-x-3 w-32 flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                    {item.packagingType}
                  </div>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {packagingNames[item.packagingType] || item.packagingType}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {item.transactionCount} transacciones
                    </span>
                    <span className="text-xs text-gray-500">
                      {(item.unitPercentage ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(item.unitPercentage ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="text-right w-20 flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900" data-testid={`text-units-${item.packagingType}`}>
                    {formatNumber(item.totalUnits)}
                  </p>
                  <p className="text-xs text-gray-500">
                    unidades
                  </p>
                </div>
              </div>
            ))}
            
            {/* Total summary */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between py-2 bg-blue-50 rounded-lg px-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Total General</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900" data-testid="text-packaging-units-total">
                    {formatNumber(totalUnits)} unidades
                  </p>
                  <p className="text-xs text-gray-500">
                    {sortedData.reduce((sum, item) => sum + item.transactionCount, 0)} transacciones
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}