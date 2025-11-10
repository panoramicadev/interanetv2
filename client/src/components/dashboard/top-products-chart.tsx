import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Search, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface TopProduct {
  productName: string;
  totalSales: number;
  totalUnits: number;
}

interface TopProductsResponse {
  items: TopProduct[];
  periodTotalSales: number;
}

interface TopProductsChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
}

export default function TopProductsChart({ selectedPeriod, filterType, segment, salesperson }: TopProductsChartProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);
  
  const { data: topProductsResponse, isLoading } = useQuery<TopProductsResponse>({
    queryKey: [`/api/sales/top-products?limit=${limit}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
  });

  const topProducts = topProductsResponse?.items || [];
  const periodTotal = topProductsResponse?.periodTotalSales || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Filter products based on search term
  const filteredProducts = topProducts.filter(product =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate percentages based on period total
  const productsWithPercentage = filteredProducts.map(product => ({
    ...product,
    percentage: periodTotal > 0 ? (product.totalSales / periodTotal) * 100 : 0
  }));

  const handleLoadMore = () => {
    setLimit(prev => prev + 10);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setIsSearchExpanded(false);
  };

  return (
    <div className="space-y-4">
      {/* Header con búsqueda expandible */}
      {!isSearchExpanded ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Top Productos</h2>
            
            {/* Botón de lupa para expandir búsqueda */}
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              data-testid="button-expand-search"
              title="Buscar producto"
            >
              <Search className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          
          <Link href="/metricas-productos">
            <Button
              variant="default"
              size="sm"
              className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700"
              data-testid="button-view-all-products"
            >
              Análisis completo
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Búsqueda expandida a ancho completo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Top Productos</h2>
            </div>
            
            {searchTerm && (
              <span className="text-sm text-gray-500">
                {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Filtrar productos por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-blue-500 rounded-lg shadow-sm"
              data-testid="input-filter-products"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="button-clear-filter"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
      
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
        ) : productsWithPercentage.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              {searchTerm ? 'No se encontraron productos con ese nombre' : 'No hay productos para mostrar'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {productsWithPercentage.map((product, index) => (
              <Link 
                key={product.productName} 
                href={`/product/${encodeURIComponent(product.productName)}`}
                className="block hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0"
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
            </Link>
              ))}
            </div>
            
            {/* Botón Ver más - solo si no hay búsqueda activa y hay más productos */}
            {!searchTerm && topProducts.length >= limit && (
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-xs px-6"
                  data-testid="button-load-more"
                >
                  Ver más productos
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}