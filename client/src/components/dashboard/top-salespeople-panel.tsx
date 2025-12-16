import { useQuery } from "@tanstack/react-query";
import { UserCheck, Download, Search, X, DollarSign, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useEffect } from "react";

interface TopSalesperson {
  salesperson: string;
  totalSales: number;
  transactionCount: number;
}

interface TopSalespeopleResponse {
  items: TopSalesperson[];
  periodTotalSales: number;
  totalCount: number;
}

interface SearchSalesperson {
  name: string;
  totalSales: number;
  transactionCount: number;
}

interface TopSalespeoplePanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
}

export default function TopSalespeoplePanel({ selectedPeriod, filterType, segment, salesperson, client }: TopSalespeoplePanelProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);
  const [expandedSalesperson, setExpandedSalesperson] = useState<string>("");
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Query for paginated top salespeople (default view)
  const { data: topSalespeopleResponse, isLoading } = useQuery<TopSalespeopleResponse>({
    queryKey: [`/api/sales/top-salespeople?limit=${limit}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${client ? `&client=${encodeURIComponent(client)}` : ''}`],
    enabled: !debouncedSearchTerm, // Disable when searching
  });

  // Query for search results (when typing)
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchSalesperson[]>({
    queryKey: [`/api/salespeople/search?q=${encodeURIComponent(debouncedSearchTerm)}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${client ? `&client=${encodeURIComponent(client)}` : ''}`],
    enabled: debouncedSearchTerm.length >= 2, // Only search if 2+ characters
  });

  // Use search results if searching, otherwise use paginated salespeople
  const displaySalespeople = debouncedSearchTerm.length >= 2 && searchResults
    ? searchResults.map(sp => ({ salesperson: sp.name, totalSales: sp.totalSales, transactionCount: sp.transactionCount }))
    : topSalespeopleResponse?.items || [];
  
  const periodTotal = topSalespeopleResponse?.periodTotalSales || 0;
  const currentLoading = debouncedSearchTerm.length >= 2 ? isSearchLoading : isLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate percentages based on period total
  const salespeopleWithPercentage = displaySalespeople.map(sp => ({
    ...sp,
    percentage: periodTotal > 0 ? (sp.totalSales / periodTotal) * 100 : 0
  }));

  const handleLoadMore = () => {
    setLimit(prev => prev + 10);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setIsSearchExpanded(false);
  };

  const exportToCSV = () => {
    if (!salespeopleWithPercentage || salespeopleWithPercentage.length === 0) return;

    const csvData = [];
    
    // Add header
    csvData.push(['REPORTE DE VENTAS POR VENDEDOR']);
    csvData.push(['Período: ' + selectedPeriod]);
    if (segment) csvData.push(['Segmento: ' + segment]);
    csvData.push(['Total de vendedores: ' + salespeopleWithPercentage.length]);
    csvData.push(['Total del periodo: ' + periodTotal.toLocaleString('es-CL')]);
    csvData.push(['Generado: ' + new Date().toLocaleString('es-CL')]);
    csvData.push([]); // Empty row

    // Preparar datos CSV con más detalles
    const headers = ['#', 'Vendedor', 'Total Ventas', 'Transacciones', 'Ticket Promedio', 'Porcentaje del Total'];
    csvData.push(headers);
    
    salespeopleWithPercentage.forEach((sp, index) => {
      const ticketPromedio = sp.transactionCount > 0 ? sp.totalSales / sp.transactionCount : 0;
      csvData.push([
        (index + 1).toString(),
        sp.salesperson,
        sp.totalSales.toString(),
        sp.transactionCount.toString(),
        ticketPromedio.toFixed(2),
        sp.percentage.toFixed(2) + '%'
      ]);
    });

    // Create CSV content
    const csvContent = csvData.map(row => 
      row.map(cell => {
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return '"' + stringCell.replace(/"/g, '""') + '"';
        }
        return stringCell;
      }).join(',')
    ).join('\n');

    // Descargar archivo
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_por_vendedor_${selectedPeriod.replace(/[\/\\:]/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header con búsqueda expandible */}
      {!isSearchExpanded ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Vendedores</h2>
            
            {/* Botón de lupa para expandir búsqueda */}
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              data-testid="button-expand-search-salespeople"
              title="Buscar vendedor"
            >
              <Search className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={isLoading || !salespeopleWithPercentage || salespeopleWithPercentage.length === 0}
              data-testid="button-export-salespeople-csv"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Link href="/mis-vendedores">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs px-3 py-1"
                data-testid="button-view-all-salespeople"
              >
                Ver todos
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Búsqueda expandida a ancho completo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Vendedores</h2>
            </div>
            
            {debouncedSearchTerm && (
              <span className="text-sm text-gray-500">
                {salespeopleWithPercentage.length} resultado{salespeopleWithPercentage.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Filtrar vendedores por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-blue-500 rounded-lg shadow-sm"
              data-testid="input-filter-salespeople"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="button-clear-filter-salespeople"
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
              <div key={i} className="flex items-center justify-between animate-pulse py-3">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
                <div className="flex-1 mx-4">
                  <div className="h-2 bg-gray-200 rounded-full"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : salespeopleWithPercentage && salespeopleWithPercentage.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              {debouncedSearchTerm ? 'No se encontraron vendedores' : 'No hay datos disponibles'}
            </p>
          </div>
        ) : (
          <>
            <Accordion
              type="single"
              collapsible
              value={expandedSalesperson}
              onValueChange={setExpandedSalesperson}
              className="space-y-2"
            >
              {salespeopleWithPercentage?.map((sp, index) => (
                <AccordionItem 
                  key={sp.salesperson} 
                  value={sp.salesperson}
                  className="border rounded-lg overflow-hidden bg-blue-50/30 dark:bg-blue-900/10"
                >
                  <AccordionTrigger 
                    className="px-3 sm:px-4 py-3 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:no-underline"
                    data-testid={`accordion-trigger-salesperson-${index}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full pr-4">
                      {/* Nombre del vendedor - mobile: full width */}
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium line-clamp-2 sm:truncate">
                          {sp.salesperson}
                        </p>
                      </div>
                      
                      {/* Barra, porcentaje y monto - mobile: row below name */}
                      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        {/* Porcentaje */}
                        <div className="w-10 sm:w-12 flex-shrink-0 text-right">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {sp.percentage.toFixed(1)}%
                          </span>
                        </div>
                        
                        {/* Barra de progreso */}
                        <div className="flex-1 sm:flex-none sm:w-32">
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${Math.min(sp.percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Monto */}
                        <div className="w-20 sm:w-24 flex-shrink-0 text-right">
                          <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(sp.totalSales)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2 bg-white dark:bg-gray-800">
                    <SalespersonDetails 
                      salesperson={sp.salesperson}
                      selectedPeriod={selectedPeriod}
                      filterType={filterType}
                      segment={segment}
                      isExpanded={expandedSalesperson === sp.salesperson}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            {/* Botón Ver más - solo si no hay búsqueda activa y hay más vendedores */}
            {!debouncedSearchTerm && topSalespeopleResponse && displaySalespeople && displaySalespeople.length < topSalespeopleResponse.totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-xs px-6 transition-all duration-200 ease-in-out hover:scale-105"
                  data-testid="button-load-more-salespeople"
                >
                  Ver más ({displaySalespeople.length} de {topSalespeopleResponse.totalCount})
                </Button>
              </div>
            )}
            
            {/* Total Row - solo si no hay búsqueda activa */}
            {!debouncedSearchTerm && salespeopleWithPercentage && salespeopleWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 bg-green-50 rounded-lg px-3"
                  data-testid="salespeople-total"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-green-900 font-bold">
                      TOTAL ({salespeopleWithPercentage.length} vendedores)
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <div className="w-10 sm:w-12 flex-shrink-0 text-right">
                      <span className="text-xs text-green-700 font-semibold">
                        100.0%
                      </span>
                    </div>
                    
                    <div className="flex-1 sm:flex-none sm:w-32">
                      <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-600 rounded-full w-full"></div>
                      </div>
                    </div>
                    
                    <div className="w-20 sm:w-24 flex-shrink-0 text-right">
                      <span className="text-xs sm:text-sm font-bold text-green-900">
                        {formatCurrency(periodTotal)}
                      </span>
                    </div>
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

// Salesperson Details Component (shown when accordion expands)
interface SalespersonDetailsProps {
  salesperson: string;
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  isExpanded: boolean;
}

function SalespersonDetails({ salesperson, selectedPeriod, filterType, segment, isExpanded }: SalespersonDetailsProps) {
  const { data: details, isLoading } = useQuery({
    queryKey: [`/api/sales/top-salespeople/${encodeURIComponent(salesperson)}/details?period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}`],
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
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Ventas</p>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(details.totalSales || 0)}
          </p>
        </div>

        {/* Transacciones */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Transacciones</p>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {(details.transactionCount || 0).toLocaleString('es-CL')}
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

      {/* Top Productos del Vendedor */}
      {details.topProducts && details.topProducts.length > 0 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Top Productos</p>
          <div className="space-y-1">
            {details.topProducts.slice(0, 3).map((product: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{product.productName}</span>
                <span className="text-gray-900 dark:text-gray-100 font-semibold ml-2">{formatCurrency(product.sales)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
