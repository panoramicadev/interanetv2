import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FleteClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
}

interface FletesResponse {
  items: FleteClient[];
  periodTotalSales: number;
  totalTransactions: number;
  totalCount: number;
}

interface FletesPanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
}

export default function FletesPanel({
  selectedPeriod,
  filterType,
  segment,
  salesperson,
  client,
}: FletesPanelProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data, isLoading } = useQuery<FletesResponse>({
    queryKey: [
      `/api/sales/fletes?limit=${limit}&period=${selectedPeriod}&filterType=${filterType}` +
        `${segment ? `&segment=${encodeURIComponent(segment)}` : ""}` +
        `${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ""}` +
        `${client ? `&client=${encodeURIComponent(client)}` : ""}`,
    ],
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(n || 0);

  const periodTotal = data?.periodTotalSales || 0;
  const allItems = data?.items || [];
  const totalCount = data?.totalCount || 0;

  // Client-side filter por nombre cuando hay búsqueda
  const filteredItems = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    if (term.length < 2) return allItems;
    return allItems.filter((i) => i.clientName.toLowerCase().includes(term));
  }, [allItems, debouncedSearchTerm]);

  const itemsWithPct = filteredItems.map((i) => ({
    ...i,
    percentage: periodTotal > 0 ? (i.totalSales / periodTotal) * 100 : 0,
  }));

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setIsSearchExpanded(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {!isSearchExpanded ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">Fletes</h2>

            <button
              onClick={() => setIsSearchExpanded(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
              data-testid="button-expand-fletes-search"
              title="Buscar cliente"
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
            </button>
          </div>

          <div className="text-right">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Total flete</p>
            <p className="text-sm sm:text-lg font-bold text-amber-700" data-testid="fletes-total">
              {formatCurrency(periodTotal)}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Fletes</h2>
            </div>
            {debouncedSearchTerm && (
              <span className="text-sm text-gray-500">
                {itemsWithPct.length} resultado{itemsWithPct.length !== 1 ? "s" : ""}
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
              className="pl-11 pr-10 h-12 text-sm font-medium border-2 border-gray-200 focus:border-amber-500 rounded-lg shadow-sm"
              data-testid="input-filter-fletes"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="button-clear-fletes-filter"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-4 bg-gray-200 rounded w-12" />
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200 rounded" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : itemsWithPct.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              {debouncedSearchTerm
                ? "No se encontraron clientes con ese nombre"
                : "No hay flete facturado en este período"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {itemsWithPct.map((row, index) => (
                <div
                  key={row.clientName + index}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full py-2 px-1"
                  data-testid={`flete-${index}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-700 font-medium line-clamp-2 sm:truncate">
                      {row.clientName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <span className="text-xs text-gray-600 w-10 text-right flex-shrink-0">
                      {row.percentage.toFixed(1)}%
                    </span>
                    <div className="flex-1 sm:flex-none sm:w-32">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(row.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 w-20 sm:w-28 text-right flex-shrink-0">
                      {formatCurrency(row.totalSales)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {!debouncedSearchTerm && allItems.length < totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLimit((p) => p + 10)}
                  className="text-xs px-6 hover:scale-105 transition-all"
                  data-testid="button-load-more-fletes"
                >
                  Ver más ({allItems.length} de {totalCount})
                </Button>
              </div>
            )}

            {!debouncedSearchTerm && itemsWithPct.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full bg-amber-50 rounded-lg py-3 px-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-amber-900 font-bold">
                      TOTAL ({totalCount} {totalCount === 1 ? "cliente" : "clientes"})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <span className="text-xs text-amber-700 w-10 text-right flex-shrink-0">100%</span>
                    <div className="flex-1 sm:flex-none sm:w-32">
                      <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-600 rounded-full w-full" />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-amber-900 w-20 sm:w-28 text-right flex-shrink-0">
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
