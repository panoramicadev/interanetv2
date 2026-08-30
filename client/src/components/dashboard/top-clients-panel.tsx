import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, X, Sparkles } from "lucide-react";
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

interface NewClientItem {
  clientName: string;
  totalSales: number;
  totalUnits: number;
  orderCount: number;
  firstPurchaseDate: string;
  salesperson: string;
}

export type ClientsPanelView = "top" | "new";

interface TopClientsPanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
  view?: ClientsPanelView;
  onViewChange?: (view: ClientsPanelView) => void;
}

export const TOP_CLIENTS_PANEL_ID = "top-clients-panel";

export default function TopClientsPanel({
  selectedPeriod,
  filterType,
  segment,
  salesperson,
  client,
  product,
  view: viewProp,
  onViewChange,
}: TopClientsPanelProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);
  const [internalView, setInternalView] = useState<ClientsPanelView>("top");
  const view = viewProp ?? internalView;
  const setView = (v: ClientsPanelView) => {
    setInternalView(v);
    onViewChange?.(v);
  };

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
    enabled: view === "top" && !debouncedSearchTerm,
  });

  // Query for search results (when typing) — only in top view
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchClient[]>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(debouncedSearchTerm)}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}${client ? `&client=${encodeURIComponent(client)}` : ''}${product ? `&product=${encodeURIComponent(product)}` : ''}`],
    enabled: view === "top" && debouncedSearchTerm.length >= 2,
  });

  // Query for new clients
  const { data: newClientsList, isLoading: isLoadingNewClients } = useQuery<NewClientItem[]>({
    queryKey: ['/api/sales/new-clients', selectedPeriod, filterType, segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/sales/new-clients?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: view === "new",
  });

  // Filter new clients by search term (client-side, since /api/sales/new-clients returns the full list)
  const filteredNewClients = (newClientsList || []).filter((c) =>
    debouncedSearchTerm.length < 2 ? true : c.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  // Items + period total depending on view
  let displayClients: { clientName: string; totalSales: number; transactionCount: number }[] = [];
  let periodTotal = 0;
  let currentLoading = false;
  let totalCount = 0;

  if (view === "new") {
    const visible = filteredNewClients.slice(0, limit);
    displayClients = visible.map((c) => ({
      clientName: c.clientName,
      totalSales: c.totalSales,
      transactionCount: c.orderCount,
    }));
    periodTotal = (newClientsList || []).reduce((sum, c) => sum + c.totalSales, 0);
    currentLoading = isLoadingNewClients;
    totalCount = filteredNewClients.length;
  } else {
    displayClients = debouncedSearchTerm.length >= 2 && searchResults
      ? searchResults.map((c) => ({ clientName: c.name, totalSales: c.totalSales, transactionCount: c.transactionCount }))
      : topClientsResponse?.items || [];
    periodTotal = topClientsResponse?.periodTotalSales || 0;
    currentLoading = debouncedSearchTerm.length >= 2 ? isSearchLoading : isLoading;
    totalCount = topClientsResponse?.totalCount || 0;
  }

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

  // Reset pagination when switching views
  useEffect(() => {
    setLimit(10);
  }, [view]);

  const isNewView = view === "new";
  // Chip de ícono: naranjo sólido con el ícono en blanco, igual que el resto de los módulos.
  const accentBg = "bg-[#fd6301] shadow-md shadow-[#fd6301]/25";
  const accentText = "text-white";
  const barColor = isNewView ? "bg-[#fd6301]" : "bg-[#fd6301]";
  const totalRowBg = isNewView ? "bg-orange-50" : "bg-orange-50";
  const totalRowText = isNewView ? "text-[#fd6301]" : "text-[#fd6301]";
  const totalRowTextMuted = isNewView ? "text-[#fd6301]" : "text-[#fd6301]";
  const totalRowBarBg = isNewView ? "bg-purple-200" : "bg-blue-200";
  const totalRowBarFill = isNewView ? "bg-[#fd6301]" : "bg-[#fd6301]";

  return (
    <div className="space-y-4" id={TOP_CLIENTS_PANEL_ID} data-testid="top-clients-panel">
      {/* Header con búsqueda expandible */}
      {!isSearchExpanded ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 ${accentBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              {isNewView ? (
                <Sparkles className={`h-4 w-4 sm:h-5 sm:w-5 ${accentText}`} />
              ) : (
                <Users className={`h-4 w-4 sm:h-5 sm:w-5 ${accentText}`} />
              )}
            </div>
            <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">
              {isNewView ? "Clientes Nuevos" : "Clientes"}
            </h2>

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

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Switch Top / Nuevos */}
            <div className="inline-flex items-center rounded-lg bg-gray-100 p-0.5" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!isNewView}
                onClick={() => setView("top")}
                className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-all ${
                  !isNewView ? "bg-white text-[#fd6301] shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
                data-testid="button-clients-view-top"
              >
                Top
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isNewView}
                onClick={() => setView("new")}
                className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-all ${
                  isNewView ? "bg-white text-[#fd6301] shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
                data-testid="button-clients-view-new"
              >
                Nuevos
              </button>
            </div>

            <Link href="/clientes">
              <Button
                variant="default"
                size="sm"
                className="text-[10px] sm:text-xs px-2 sm:px-4 py-1.5 sm:py-2 bg-[#fd6301] hover:bg-[#fd6301]"
                data-testid="button-view-all-clients"
              >
                <span className="hidden sm:inline">Ver todos</span>
                <span className="sm:hidden">Ver</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Búsqueda expandida a ancho completo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${accentBg} rounded-lg flex items-center justify-center`}>
                {isNewView ? (
                  <Sparkles className={`h-5 w-5 ${accentText}`} />
                ) : (
                  <Users className={`h-5 w-5 ${accentText}`} />
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {isNewView ? "Clientes Nuevos" : "Clientes"}
              </h2>
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
              className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-orange-200 rounded-lg shadow-sm"
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
              {debouncedSearchTerm
                ? 'No se encontraron clientes con ese nombre'
                : isNewView
                  ? 'No hay clientes nuevos en este período'
                  : 'No hay clientes para mostrar'}
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
                            className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
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
            {!debouncedSearchTerm && displayClients.length < totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                  data-testid="button-load-more-clients"
                >
                  Ver más ({displayClients.length} de {totalCount})
                </Button>
              </div>
            )}

            {/* Total Row - solo si no hay búsqueda activa */}
            {!debouncedSearchTerm && clientsWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full ${totalRowBg} rounded-lg py-3 px-2`}
                  data-testid="clients-total"
                >
                  {/* Nombre TOTAL */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs sm:text-sm ${totalRowText} font-bold`}>
                      TOTAL ({clientsWithPercentage.length} {isNewView ? "clientes nuevos" : "clientes"})
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {/* Porcentaje */}
                    <span className={`text-xs ${totalRowTextMuted} font-semibold w-10 text-right flex-shrink-0`}>
                      100.0%
                    </span>

                    {/* Barra completa */}
                    <div className="flex-1 sm:flex-none sm:w-32">
                      <div className={`h-2 ${totalRowBarBg} rounded-full overflow-hidden`}>
                        <div className={`h-full ${totalRowBarFill} rounded-full w-full`}></div>
                      </div>
                    </div>

                    {/* Monto total */}
                    <span className={`text-xs sm:text-sm font-bold ${totalRowText} w-20 sm:w-28 text-right flex-shrink-0`}>
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
