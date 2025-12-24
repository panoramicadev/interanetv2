import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Package, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useSalespersonAccordion, type AccordionControls } from "@/hooks/useSalespersonAccordion";

// ============================
// Interfaces
// ============================

interface SalespersonClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  lastSale: string;
  daysSinceLastSale: number;
}

interface SalespersonClientsResponse {
  items: SalespersonClient[];
  periodTotalSales: number;
  totalCount: number;
}

interface SearchClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
}

interface ClientDetails {
  totalSales: number;
  lastSaleDate: string | null;
  transactionCount: number;
  products: Array<{
    productName: string;
    totalSales: number;
    units: number;
  }>;
}

interface SalespersonProduct {
  productName: string;
  totalSales: number;
  transactionCount: number;
  averagePrice: number;
  lastSale: string;
  totalUnits: number;
}

interface SalespersonProductsResponse {
  items: SalespersonProduct[];
  periodTotalSales: number;
  totalCount: number;
}

interface SearchProduct {
  productName: string;
  totalSales: number;
  transactionCount: number;
}

interface ProductDetails {
  totalSales: number;
  totalUnits: number;
  topClient: { name: string; amount: number } | null;
  clients: Array<{ name: string; amount: number }>;
  transactionCount: number;
}

// ============================
// Helper Functions
// ============================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ============================
// SalespersonClientsPanel Component
// ============================

interface SalespersonClientsPanelProps {
  salespersonName: string;
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  embedded?: boolean;
  showSearchToggle?: boolean;
  showLoadMore?: boolean;
  selectedSegment?: string | null;
  accordionState?: AccordionControls;
}

export function SalespersonClientsPanel({
  salespersonName,
  selectedPeriod,
  filterType,
  embedded = false,
  showSearchToggle = true,
  showLoadMore = true,
  selectedSegment = null,
  accordionState: providedAccordionState,
}: SalespersonClientsPanelProps) {
  // Use provided accordion state or create local instance as fallback
  const localAccordionState = useSalespersonAccordion();
  const accordionState = providedAccordionState || localAccordionState;
  
  const {
    expandedClient,
    searchTerm,
    debouncedSearchTerm,
    isSearchExpanded,
    limit,
    setSearchTerm,
    setIsSearchExpanded,
    handleClientClick,
    handleLoadMore,
    handleClearSearch,
  } = accordionState;

  // Estado local para controlar expansión de productos
  const [expandedProducts, setExpandedProducts] = useState<string | null>(null);

  // Query for paginated salesperson clients (default view)
  const { data: clientsResponse, isLoading: isLoadingClients } = useQuery<SalespersonClientsResponse>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'clients', selectedPeriod, filterType, selectedSegment, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', limit.toString());
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/clients?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !debouncedSearchTerm,
  });

  // Query for search results (when typing)
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchClient[]>({
    queryKey: [`/api/salespeople/${salespersonName}/clients/search`, debouncedSearchTerm, selectedPeriod, filterType, selectedSegment],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', debouncedSearchTerm);
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/salespeople/${encodeURIComponent(salespersonName)}/clients/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && debouncedSearchTerm.length >= 2,
  });

  // Query for client details (when a client is expanded)
  const { data: clientDetails, isLoading: isLoadingClientDetails, error: clientDetailsError } = useQuery<ClientDetails>({
    queryKey: ['/api/salespeople', salespersonName, 'clients', expandedClient, 'details', selectedPeriod, filterType],
    queryFn: async () => {
      if (!expandedClient) throw new Error('No client selected');
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/salespeople/${encodeURIComponent(salespersonName)}/clients/${encodeURIComponent(expandedClient)}/details?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !!expandedClient,
  });

  // Compute display data
  const clients = clientsResponse?.items || [];
  const displayClients = debouncedSearchTerm && searchResults ? searchResults : clients;
  const periodTotal = clientsResponse?.periodTotalSales || 0;
  const currentLoading = debouncedSearchTerm ? isSearchLoading : isLoadingClients;

  // Add percentage to clients
  const clientsWithPercentage = displayClients.map(client => ({
    ...client,
    percentage: periodTotal > 0 ? (client.totalSales / periodTotal) * 100 : 0,
  }));

  return (
    <div className="space-y-4">
      {/* Header con búsqueda expandible */}
      {showSearchToggle && !isSearchExpanded ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Clientes del Vendedor</h2>
            
            {/* Botón de lupa para expandir búsqueda */}
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              data-testid="button-expand-client-search"
              title="Buscar cliente"
            >
              <Search className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      ) : showSearchToggle ? (
        <div className="space-y-3">
          {/* Búsqueda expandida a ancho completo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Clientes del Vendedor</h2>
            </div>
            
            {debouncedSearchTerm && (
              <span className="text-sm text-gray-500">
                {clientsWithPercentage.length} resultado{clientsWithPercentage.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Filtrar clientes por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-blue-500 rounded-lg shadow-sm"
              data-testid="input-filter-clients"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="button-clear-client-filter"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Clientes del Vendedor</h2>
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
        ) : clientsWithPercentage.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              {debouncedSearchTerm ? 'No se encontraron clientes con ese nombre' : 'No hay clientes para mostrar'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 transition-all duration-300 ease-in-out">
              {clientsWithPercentage.map((client, index) => {
                const isExpanded = expandedClient === client.clientName;
                return (
                  <div 
                    key={client.clientName}
                    className={`rounded-lg transition-all duration-300 ease-in-out ${
                      isExpanded ? 'bg-blue-50 shadow-md' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <div
                      onClick={() => handleClientClick(client.clientName)}
                      className="cursor-pointer py-3 px-2"
                      data-testid={`client-${index}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 w-full">
                        {/* Nombre del cliente completo */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 font-medium truncate">
                            {client.clientName}
                          </p>
                        </div>
                        
                        {/* Porcentaje */}
                        <span className="text-xs text-gray-600 w-8 sm:w-10 text-right flex-shrink-0">
                          {client.percentage.toFixed(1)}%
                        </span>
                        
                        {/* Barra de progreso delgada y corta */}
                        <div className="hidden sm:block w-20 sm:w-32 flex-shrink-0">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${client.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Monto */}
                        <span className="text-sm font-semibold text-gray-900 w-20 sm:w-28 text-right flex-shrink-0">
                          {formatCurrency(client.totalSales)}
                        </span>
                        
                        {/* Chevron icon */}
                        <div className="flex-shrink-0 ml-1 sm:ml-2">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-blue-600" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expandable section with client details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-blue-100">
                        {isLoadingClientDetails ? (
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[...Array(4)].map((_, i) => (
                                <div key={i} className="animate-pulse">
                                  <div className="h-16 bg-gray-200 rounded-lg"></div>
                                </div>
                              ))}
                            </div>
                            <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
                          </div>
                        ) : clientDetailsError ? (
                          <div className="py-4 text-center text-red-600 text-sm">
                            Error al cargar detalles del cliente
                          </div>
                        ) : clientDetails ? (
                          <div className="space-y-4 py-4">
                            {/* KPIs Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                <p className="text-xs text-gray-600 mb-1">Total Vendido</p>
                                <p className="text-lg font-bold text-blue-900">
                                  {formatCurrency(clientDetails.totalSales)}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                <p className="text-xs text-gray-600 mb-1">Última Venta</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {clientDetails.lastSaleDate 
                                      ? format(new Date(clientDetails.lastSaleDate), "d 'de' MMM yyyy", { locale: es })
                                      : 'N/A'
                                    }
                                  </p>
                                  {clientDetails.lastSaleDate && (() => {
                                    const daysSince = Math.floor(
                                      (new Date().getTime() - new Date(clientDetails.lastSaleDate).getTime()) / (1000 * 60 * 60 * 24)
                                    );
                                    const isRecent = daysSince <= 31;
                                    return (
                                      <span 
                                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                          isRecent ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
                                        }`}
                                      >
                                        {daysSince}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                <p className="text-xs text-gray-600 mb-1">Transacciones</p>
                                <p className="text-lg font-bold text-gray-900">
                                  {clientDetails.transactionCount}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                <p className="text-xs text-gray-600 mb-1">Ticket Promedio</p>
                                <p className="text-lg font-bold text-gray-900">
                                  {formatCurrency(clientDetails.transactionCount > 0 
                                    ? clientDetails.totalSales / clientDetails.transactionCount 
                                    : 0
                                  )}
                                </p>
                              </div>
                            </div>
                            
                            {/* Products List */}
                            {clientDetails.products && clientDetails.products.length > 0 && (
                              <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                  Productos Vendidos ({clientDetails.products.length})
                                </h3>
                                <div className="space-y-3">
                                  {(expandedProducts === expandedClient 
                                    ? clientDetails.products 
                                    : clientDetails.products.slice(0, 5)
                                  ).map((product, idx) => {
                                    const productPercentage = clientDetails.totalSales > 0 
                                      ? (product.totalSales / clientDetails.totalSales) * 100 
                                      : 0;
                                    return (
                                      <div key={idx} className="flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-gray-700 font-medium truncate">
                                            {product.productName}
                                          </p>
                                        </div>
                                        <span className="text-xs text-gray-600 w-16 text-right flex-shrink-0">
                                          {product.units} unid
                                        </span>
                                        <div className="w-24 flex-shrink-0">
                                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-blue-400 rounded-full"
                                              style={{ width: `${productPercentage}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                        <span className="text-xs font-semibold text-gray-900 w-20 text-right flex-shrink-0">
                                          {formatCurrency(product.totalSales)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {clientDetails.products.length > 5 && (
                                    <button
                                      onClick={() => setExpandedProducts(
                                        expandedProducts === expandedClient ? null : expandedClient
                                      )}
                                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-center pt-2 w-full transition-colors"
                                      data-testid="button-toggle-products"
                                    >
                                      {expandedProducts === expandedClient 
                                        ? 'Ver menos' 
                                        : `+${clientDetails.products.length - 5} productos más`
                                      }
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Botón Ver más - solo si no hay búsqueda activa y hay más clientes */}
            {showLoadMore && !debouncedSearchTerm && clientsResponse && displayClients.length < clientsResponse.totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                  data-testid="button-load-more-clients"
                >
                  Ver más ({displayClients.length} de {clientsResponse.totalCount})
                </Button>
              </div>
            )}
            
            {/* Total Row - solo si no hay búsqueda activa */}
            {!debouncedSearchTerm && clientsWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div 
                  className="flex items-center gap-3 w-full bg-blue-50 rounded-lg py-3 px-2"
                  data-testid="clients-total"
                >
                  {/* Nombre TOTAL */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-blue-900 font-bold">
                      TOTAL ({clientsWithPercentage.length} clientes)
                    </p>
                  </div>
                  
                  {/* Porcentaje */}
                  <span className="text-xs text-blue-700 font-semibold w-10 text-right flex-shrink-0">
                    100.0%
                  </span>
                  
                  {/* Barra completa */}
                  <div className="w-20 sm:w-32 flex-shrink-0">
                    <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full w-full"></div>
                    </div>
                  </div>
                  
                  {/* Monto total */}
                  <span className="text-sm font-bold text-blue-900 w-28 text-right flex-shrink-0">
                    {formatCurrency(periodTotal)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================
// SalespersonProductsPanel Component
// ============================

interface SalespersonProductsPanelProps {
  salespersonName: string;
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  embedded?: boolean;
  showSearchToggle?: boolean;
  showLoadMore?: boolean;
  selectedSegment?: string | null;
  accordionState?: AccordionControls;
}

export function SalespersonProductsPanel({
  salespersonName,
  selectedPeriod,
  filterType,
  embedded = false,
  showSearchToggle = true,
  showLoadMore = true,
  selectedSegment = null,
  accordionState: providedAccordionState,
}: SalespersonProductsPanelProps) {
  // Use provided accordion state or create local instance as fallback
  const localAccordionState = useSalespersonAccordion();
  const accordionState = providedAccordionState || localAccordionState;
  
  const {
    expandedProduct,
    productSearchTerm,
    debouncedProductSearchTerm,
    isProductSearchExpanded,
    productLimit,
    setProductSearchTerm,
    setIsProductSearchExpanded,
    setExpandedClient,
    handleProductClick,
    handleLoadMoreProducts,
    handleClearProductSearch,
  } = accordionState;

  // Query for paginated salesperson products (default view)
  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery<SalespersonProductsResponse>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'products', selectedPeriod, filterType, selectedSegment, productLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('limit', productLimit.toString());
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/sales/salesperson/${encodeURIComponent(salespersonName)}/products?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !debouncedProductSearchTerm,
  });

  // Query for product search results (when typing)
  const { data: productSearchResults, isLoading: isProductSearchLoading } = useQuery<SearchProduct[]>({
    queryKey: [`/api/salespeople/${salespersonName}/products/search`, debouncedProductSearchTerm, selectedPeriod, filterType, selectedSegment],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', debouncedProductSearchTerm);
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (selectedSegment) params.append('segment', selectedSegment);
      const res = await fetch(`/api/salespeople/${encodeURIComponent(salespersonName)}/products/search?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && debouncedProductSearchTerm.length >= 2,
  });

  // Query for product details (when a product is expanded)
  const { data: productDetails, isLoading: isLoadingProductDetails, error: productDetailsError } = useQuery<ProductDetails>({
    queryKey: ['/api/salespeople', salespersonName, 'products', expandedProduct, 'details', selectedPeriod, filterType],
    queryFn: async () => {
      if (!expandedProduct) throw new Error('No product selected');
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/salespeople/${encodeURIComponent(salespersonName)}/products/${encodeURIComponent(expandedProduct)}/details?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!salespersonName && !!expandedProduct,
  });

  // Compute display data
  const products = productsResponse?.items || [];
  const displayProducts = debouncedProductSearchTerm && productSearchResults ? productSearchResults : products;
  const productPeriodTotal = productsResponse?.periodTotalSales || 0;
  const currentProductLoading = debouncedProductSearchTerm ? isProductSearchLoading : isLoadingProducts;

  // Add percentage to products
  const productsWithPercentage = displayProducts.map(product => ({
    ...product,
    percentage: productPeriodTotal > 0 ? (product.totalSales / productPeriodTotal) * 100 : 0,
  }));

  return (
    <div className="space-y-4">
      {/* Header con búsqueda expandible */}
      {showSearchToggle && !isProductSearchExpanded ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Productos del Vendedor</h2>
            
            {/* Botón de lupa para expandir búsqueda */}
            <button
              onClick={() => setIsProductSearchExpanded(true)}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              data-testid="button-expand-product-search"
              title="Buscar producto"
            >
              <Search className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      ) : showSearchToggle ? (
        <div className="space-y-3">
          {/* Búsqueda expandida a ancho completo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Productos del Vendedor</h2>
            </div>
            
            {debouncedProductSearchTerm && (
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
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-green-500 rounded-lg shadow-sm"
              data-testid="input-filter-products"
              autoFocus
            />
            {productSearchTerm && (
              <button
                onClick={handleClearProductSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="button-clear-product-filter"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Productos del Vendedor</h2>
        </div>
      )}
      
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
        {currentProductLoading ? (
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
              {debouncedProductSearchTerm ? 'No se encontraron productos con ese nombre' : 'No hay productos para mostrar'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 transition-all duration-300 ease-in-out">
              {productsWithPercentage.map((product, index) => {
                const isExpanded = expandedProduct === product.productName;
                
                return (
                  <div
                    key={product.productName}
                    className="rounded-lg transition-colors"
                  >
                    <div 
                      className="flex items-center gap-2 sm:gap-3 w-full cursor-pointer hover:bg-gray-50/50 py-3 px-2 rounded-lg"
                      data-testid={`product-${index}`}
                      onClick={() => {
                        if (expandedProduct === product.productName) {
                          handleProductClick(product.productName);
                        } else {
                          handleProductClick(product.productName);
                          setExpandedClient(null); // Close client accordion when opening product
                        }
                      }}
                    >
                      {/* Nombre del producto completo */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 font-medium truncate">
                          {product.productName}
                        </p>
                      </div>
                      
                      {/* Porcentaje */}
                      <span className="text-xs text-gray-600 w-8 sm:w-10 text-right flex-shrink-0">
                        {product.percentage.toFixed(1)}%
                      </span>
                      
                      {/* Barra de progreso delgada y corta */}
                      <div className="hidden sm:block w-20 sm:w-32 flex-shrink-0">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${product.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Monto */}
                      <span className="text-sm font-semibold text-gray-900 w-20 sm:w-28 text-right flex-shrink-0">
                        {formatCurrency(product.totalSales)}
                      </span>

                      {/* Chevron icon */}
                      <div className="flex-shrink-0 ml-1 sm:ml-2">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Product Details Section */}
                    {isExpanded && (
                      <div className="mt-2 bg-green-50 rounded-lg p-4 border border-green-200 animate-in slide-in-from-top-2 duration-300">
                        {isLoadingProductDetails ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="animate-pulse">
                                <div className="h-4 bg-green-200 rounded w-20 mb-2"></div>
                                <div className="h-6 bg-green-200 rounded w-full"></div>
                              </div>
                            ))}
                          </div>
                        ) : productDetailsError ? (
                          <div className="text-center py-4">
                            <p className="text-sm text-red-600">Error al cargar detalles del producto</p>
                          </div>
                        ) : productDetails ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-green-700 font-medium mb-1">Total Vendido</p>
                                <p className="text-lg font-bold text-green-900">{formatCurrency(productDetails.totalSales)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-green-700 font-medium mb-1">Unidades</p>
                                <p className="text-lg font-bold text-green-900">{productDetails.totalUnits.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-green-700 font-medium mb-1">Transacciones</p>
                                <p className="text-lg font-bold text-green-900">{productDetails.transactionCount}</p>
                              </div>
                            </div>

                            {/* Lista de clientes */}
                            <div className="mt-4">
                              <p className="text-xs text-green-700 font-semibold mb-3">Clientes que han comprado este producto:</p>
                              {productDetails.clients && productDetails.clients.length > 0 ? (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {productDetails.clients.map((client, idx) => (
                                    <div 
                                      key={idx} 
                                      className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-200 hover:border-green-300 transition-colors"
                                    >
                                      <div className="flex-1 min-w-0 mr-3">
                                        <p className="text-sm font-semibold text-green-900 truncate">{client.name}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-bold text-green-900">{formatCurrency(client.amount)}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-green-700 text-center py-3">No hay clientes registrados</p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Botón Ver más - solo si no hay búsqueda activa y hay más productos */}
            {showLoadMore && !debouncedProductSearchTerm && productsResponse && displayProducts.length < productsResponse.totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMoreProducts}
                  className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                  data-testid="button-load-more-products"
                >
                  Ver más ({displayProducts.length} de {productsResponse.totalCount})
                </Button>
              </div>
            )}
            
            {/* Total Row - solo si no hay búsqueda activa */}
            {!debouncedProductSearchTerm && productsWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div 
                  className="flex items-center gap-3 w-full bg-green-50 rounded-lg py-3 px-2"
                  data-testid="products-total"
                >
                  {/* Nombre TOTAL */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-green-900 font-bold">
                      TOTAL ({productsWithPercentage.length} productos)
                    </p>
                  </div>
                  
                  {/* Porcentaje */}
                  <span className="text-xs text-green-700 font-semibold w-10 text-right flex-shrink-0">
                    100.0%
                  </span>
                  
                  {/* Barra completa */}
                  <div className="w-20 sm:w-32 flex-shrink-0">
                    <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-600 rounded-full w-full"></div>
                    </div>
                  </div>
                  
                  {/* Monto total */}
                  <span className="text-sm font-bold text-green-900 w-28 text-right flex-shrink-0">
                    {formatCurrency(productPeriodTotal)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
