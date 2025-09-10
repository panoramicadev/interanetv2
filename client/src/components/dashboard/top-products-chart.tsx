import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";

interface TopProduct {
  productName: string;
  totalSales: number;
  totalUnits: number;
}

interface TopProductsChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  salespersonFilter?: string;
}

export default function TopProductsChart({ selectedPeriod, filterType, salespersonFilter }: TopProductsChartProps) {
  const { data: topProducts, isLoading } = useQuery<TopProduct[]>({
    queryKey: [`/api/sales/top-products?limit=5&period=${selectedPeriod}&filterType=${filterType}${salespersonFilter ? `&salesperson=${encodeURIComponent(salespersonFilter)}` : ''}`],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate percentages
  const maxSales = topProducts ? Math.max(...topProducts.map(p => p.totalSales)) : 0;
  const productsWithPercentage = topProducts?.map(product => ({
    ...product,
    percentage: maxSales > 0 ? (product.totalSales / maxSales) * 100 : 0
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Top Productos</h2>
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
        ) : (
          <div className="space-y-4">
            {productsWithPercentage?.map((product, index) => (
              <div 
                key={product.productName}
                className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 hover:bg-gray-50/50 rounded-lg transition-colors space-y-2 sm:space-y-0"
                data-testid={`product-${index}`}
              >
                {/* Nombre del producto y monto - Mobile */}
                <div className="flex justify-between items-center sm:hidden">
                  <p className="text-sm text-gray-700 font-medium truncate flex-1 min-w-0 pr-2">
                    {product.productName}
                  </p>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-xs text-gray-600">
                      {product.percentage.toFixed(1)}%
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(product.totalSales)}
                    </span>
                  </div>
                </div>
                
                {/* Desktop Layout */}
                <div className="hidden sm:flex sm:items-center w-full">
                  {/* Nombre del producto */}
                  <div className="w-32 lg:w-48 flex-shrink-0">
                    <p className="text-sm text-gray-700 font-medium truncate">
                      {product.productName}
                    </p>
                  </div>
                  
                  {/* Porcentaje */}
                  <div className="w-12 flex-shrink-0 text-center">
                    <span className="text-sm text-gray-600">
                      {product.percentage.toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="flex-1 mx-2 lg:mx-4">
                    <div className="relative">
                      <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-lg transition-all duration-500 ease-out"
                          style={{ width: `${product.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Monto */}
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(product.totalSales)}
                    </span>
                  </div>
                </div>
                
                {/* Barra de progreso - Mobile */}
                <div className="sm:hidden">
                  <div className="relative">
                    <div className="h-3 bg-gray-100 rounded-lg overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-lg transition-all duration-500 ease-out"
                        style={{ width: `${product.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}