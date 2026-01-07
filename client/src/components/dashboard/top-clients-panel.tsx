import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
}

interface TopClientsResponse {
  items: TopClient[];
  periodTotalSales: number;
  totalCount: number;
}

interface SearchClient {
  name: string;
  totalSales: number;
  transactionCount: number;
}

interface TopClientsPanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
}

export default function TopClientsPanel({ selectedPeriod, filterType, segment, salesperson, client, product }: TopClientsPanelProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Query for paginated top clients (default view)
  const { data: topClientsResponse, isLoading } = useQuery<TopClientsResponse>({
    queryKey: [`/api/sales/top-clients?limit=${limit}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}${client ? `&client=${encodeURIComponent(client)}` : ''}${product ? `&product=${encodeURIComponent(product)}` : ''}`],
    enabled: !debouncedSearchTerm,
  });

  // Query for search results (when typing)
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchClient[]>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(debouncedSearchTerm)}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}${client ? `&client=${encodeURIComponent(client)}` : ''}${product ? `&product=${encodeURIComponent(product)}` : ''}`],
    enabled: debouncedSearchTerm.length >= 2,
  });

  // Use search results if searching, otherwise use paginated clients
  const displayClients = debouncedSearchTerm.length >= 2 && searchResults
    ? searchResults.map(c => ({ clientName: c.name, totalSales: c.totalSales, transactionCount: c.transactionCount }))
    : topClientsResponse?.items || [];
  
  const periodTotal = topClientsResponse?.periodTotalSales || 0;
  const currentLoading = debouncedSearchTerm.length >= 2 ? isSearchLoading : isLoading;

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return "CLP $0";
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  // Calculate percentages based on period total
  const clientsWithPercentage = displayClients.map(client => ({
    ...client,
    percentage: periodTotal > 0 ? (client.totalSales / periodTotal) * 100 : 0
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">Clientes</h2>
            
            {/* Botón de lupa para expandir búsqueda */}
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
              data-testid="button-expand-client-search"
              title="Buscar cliente"
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
            </button>
          </div>
          
          <Link href="/clientes">
            <Button
              variant="default"
              size="sm"
              className="text-[10px] sm:text-xs px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
              data-testid="button-view-all-clients"
            >
              <span className="hidden sm:inline">Ver todos</span>
              <span className="sm:hidden">Ver</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Búsqueda expandida a ancho completo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
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
              {clientsWithPercentage.map((client, index) => (
                <Link
                  key={client.clientName}
                  href={`/client/${encodeURIComponent(client.clientName)}`}
                  className="block hover:bg-gray-50/50 rounded-lg transition-colors py-3 px-1 sm:px-0"
                >
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full"
                    data-testid={`client-${index}`}
                  >
                    {/* Nombre del cliente - mobile: full width */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-gray-700 font-medium line-clamp-2 sm:truncate">
                        {client.clientName}
                      </p>
                    </div>
                    
                    {/* Barra, porcentaje y monto - mobile: row below name */}
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      {/* Porcentaje */}
                      <span className="text-xs text-gray-600 w-10 text-right flex-shrink-0">
                        {client.percentage.toFixed(1)}%
                      </span>
                      
                      {/* Barra de progreso */}
                      <div className="flex-1 sm:flex-none sm:w-32">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${client.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Monto */}
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 w-20 sm:w-28 text-right flex-shrink-0">
                        {formatCurrency(client.totalSales)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Botón Ver más - solo si no hay búsqueda activa y hay más clientes */}
            {!debouncedSearchTerm && topClientsResponse && displayClients.length < topClientsResponse.totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                  data-testid="button-load-more-clients"
                >
                  Ver más ({displayClients.length} de {topClientsResponse.totalCount})
                </Button>
              </div>
            )}
            
            {/* Total Row - solo si no hay búsqueda activa */}
            {!debouncedSearchTerm && clientsWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full bg-blue-50 rounded-lg py-3 px-2"
                  data-testid="clients-total"
                >
                  {/* Nombre TOTAL */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-blue-900 font-bold">
                      TOTAL ({clientsWithPercentage.length} clientes)
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {/* Porcentaje */}
                    <span className="text-xs text-blue-700 font-semibold w-10 text-right flex-shrink-0">
                      100.0%
                    </span>
                    
                    {/* Barra completa */}
                    <div className="flex-1 sm:flex-none sm:w-32">
                      <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full w-full"></div>
                      </div>
                    </div>
                    
                    {/* Monto total */}
                    <span className="text-xs sm:text-sm font-bold text-blue-900 w-20 sm:w-28 text-right flex-shrink-0">
                      {formatCurrency(periodTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}