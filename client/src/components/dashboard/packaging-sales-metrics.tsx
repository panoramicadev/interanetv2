import { useQuery } from "@tanstack/react-query";
import { Package2, DollarSign } from "lucide-react";

interface PackagingMetric {
  packagingType: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  salesPercentage: number;
  unitPercentage: number;
}

interface PackagingSalesMetricsProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  branch?: string;
}

// Mapping packaging codes to friendly names
const packagingNames: Record<string, string> = {
  '04': '1/4 Galón',
  'B5': 'Balde 5 Galones',
  'BD': 'Baldes',
  'GL': 'Galones',
  'Q4': 'Balde 4 Galones',
  'KT': 'Kits',
  'UN': 'Unidades',
  'KG': 'Kilogramos',
  'LT': 'Litros',
  'GB': 'Garrafas/Bidón',
  'OD': 'Onzas',
  'OT': 'Otros'
};

export default function PackagingSalesMetrics({ selectedPeriod, filterType, segment, salesperson, client, branch }: PackagingSalesMetricsProps) {
  const { data: packagingData, isLoading } = useQuery<PackagingMetric[]>({
    queryKey: [`/api/sales/packaging-metrics?period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}${client ? `&client=${encodeURIComponent(client)}` : ''}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CL').format(value);
  };

  // Custom sort order: smallest to largest, then alphabetically, then others at the end
  const sortOrder: Record<string, number> = {
    '04': 1,  // 1/4 Galón
    'GL': 2,  // Galones
    'Q4': 3,  // Balde 4 Galones
    'B5': 4,  // Balde 5 Galones
    'BD': 5,  // Baldes (alphabetical order starts here)
    'GB': 6,  // Garrafas/Bidón
    'KG': 7,  // Kilogramos
    'KT': 8,  // Kits
    'LT': 9,  // Litros
    'OD': 10, // Onzas
    'UN': 11, // Unidades
    'OT': 99  // Otros - always last
  };

  const sortedData = packagingData?.sort((a, b) => {
    const orderA = sortOrder[a.packagingType] ?? 50; // Unknown types go in the middle
    const orderB = sortOrder[b.packagingType] ?? 50;
    return orderA - orderB;
  }) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">$ Total Facturado x Unidades</h2>
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
                <div className="text-right">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : !sortedData.length ? (
          <div className="text-center py-8 text-gray-500" data-testid="text-no-packaging-sales-data">
            <Package2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay datos de packaging disponibles</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedData.map((item, index) => (
              <div 
                key={item.packagingType} 
                className="flex items-center justify-between py-2 hover:bg-gray-50/80 rounded-lg px-2 transition-colors"
                data-testid={`packaging-sales-${item.packagingType}`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                    {item.packagingType}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {packagingNames[item.packagingType] || item.packagingType}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(item.totalUnits)} unidades
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900" data-testid={`text-sales-${item.packagingType}`}>
                    {formatCurrency(item.totalSales)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(item.salesPercentage ?? 0).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
            
            {/* Total summary */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between py-2 bg-gray-50 rounded-lg px-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gray-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Total General</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900" data-testid="text-packaging-sales-total">
                    {formatCurrency(sortedData.reduce((sum, item) => sum + item.totalSales, 0))}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(sortedData.reduce((sum, item) => sum + item.totalUnits, 0))} unidades
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