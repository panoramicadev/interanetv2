import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Search, X, ChevronDown, Package, Users, TrendingUp, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useEffect } from "react";

interface TopProduct {
  productName: string;
  totalSales: number;
  totalUnits: number;
}

interface TopProductsResponse {
  items: TopProduct[];
  periodTotalSales: number;
  totalCount: number;
}

interface SearchProduct {
  name: string;
  totalSales: number;
  totalUnits: number;
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);
  const [expandedProduct, setExpandedProduct] = useState<string>("");
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Query for paginated top products (default view)
  const { data: topProductsResponse, isLoading } = useQuery<TopProductsResponse>({
    queryKey: [`/api/sales/top-products?limit=${limit}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
    enabled: !debouncedSearchTerm, // Disable when searching
  });

  // Query for search results (when typing)
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchProduct[]>({
    queryKey: [`/api/products/search?q=${encodeURIComponent(debouncedSearchTerm)}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
    enabled: debouncedSearchTerm.length >= 2, // Only search if 2+ characters
  });

  // Use search results if searching, otherwise use paginated products
  const displayProducts = debouncedSearchTerm.length >= 2 && searchResults
    ? searchResults.map(p => ({ productName: p.name, totalSales: p.totalSales, totalUnits: p.totalUnits }))
    : topProductsResponse?.items || [];
  
  const periodTotal = topProductsResponse?.periodTotalSales || 0;
  const currentLoading = debouncedSearchTerm.length >= 2 ? isSearchLoading : isLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate percentages based on period total
  const productsWithPercentage = displayProducts.map(product => ({
    ...product,
    percentage: periodTotal > 0 ? (product.totalSales / periodTotal) * 100 : 0
  }));

  const handleLoadMore = () => {
    setLimit(prev => prev + 10);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
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
            
            {debouncedSearchTerm && (
              <span className="text-sm text-gray-500">
                {productsWithPercentage.length} resultado{productsWithPercentage.length !== 1 ? 's' : ''}
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
        {currentLoading ? (
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
              {debouncedSearchTerm ? 'No se encontraron productos con ese nombre' : 'No hay productos para mostrar'}
            </p>
          </div>
        ) : (
          <>
            <Accordion
              type="single"
              collapsible
              value={expandedProduct}
              onValueChange={setExpandedProduct}
              className="space-y-2"
            >
              {productsWithPercentage.map((product, index) => (
                <AccordionItem 
                  key={product.productName} 
                  value={product.productName}
                  className="border rounded-lg overflow-hidden bg-green-50/30 dark:bg-green-900/10"
                >
                  <AccordionTrigger 
                    className="px-4 py-3 hover:bg-green-50/50 dark:hover:bg-green-900/20 hover:no-underline"
                    data-testid={`accordion-trigger-product-${index}`}
                  >
                    <div className="flex items-center gap-3 w-full pr-4">
                      {/* Nombre del producto completo */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">
                          {product.productName}
                        </p>
                      </div>
                      
                      {/* Porcentaje */}
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right flex-shrink-0">
                        {product.percentage.toFixed(1)}%
                      </span>
                      
                      {/* Barra de progreso delgada y corta */}
                      <div className="w-20 sm:w-32 flex-shrink-0">
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 dark:bg-green-600 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${product.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Monto */}
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-28 text-right flex-shrink-0">
                        {formatCurrency(product.totalSales)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2 bg-white dark:bg-gray-800">
                    <ProductDetails 
                      productName={product.productName}
                      selectedPeriod={selectedPeriod}
                      filterType={filterType}
                      segment={segment}
                      salesperson={salesperson}
                      isExpanded={expandedProduct === product.productName}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            {/* Botón Ver más - solo si no hay búsqueda activa y hay más productos */}
            {!debouncedSearchTerm && topProductsResponse && displayProducts.length < topProductsResponse.totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                  data-testid="button-load-more"
                >
                  Ver más ({displayProducts.length} de {topProductsResponse.totalCount})
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Product Details Component (shown when accordion expands)
interface ProductDetailsProps {
  productName: string;
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  isExpanded: boolean;
}

function ProductDetails({ productName, selectedPeriod, filterType, segment, salesperson, isExpanded }: ProductDetailsProps) {
  const { data: details, isLoading } = useQuery({
    queryKey: [`/api/sales/top-products/${encodeURIComponent(productName)}/details?period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
    enabled: isExpanded, // Only fetch when accordion is expanded
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded mb-2 w-20"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!details) {
    return (
      <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
        No hay detalles disponibles
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Ventas */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Ventas</p>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(details.totalSales || 0)}
          </p>
        </div>

        {/* Unidades Vendidas */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Unidades</p>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {(details.totalUnits || 0).toLocaleString('es-CL')}
          </p>
        </div>

        {/* Clientes Únicos */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Clientes</p>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {details.uniqueClients || 0}
          </p>
        </div>

        {/* Ticket Promedio */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Ticket Prom.</p>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(details.averageTicket || 0)}
          </p>
        </div>
      </div>

      {/* Top Clientes del Producto */}
      {details.topClients && details.topClients.length > 0 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Top Clientes</p>
          <div className="space-y-1">
            {details.topClients.slice(0, 3).map((client: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{client.clientName}</span>
                <span className="text-gray-900 dark:text-gray-100 font-semibold ml-2">{formatCurrency(client.sales)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}