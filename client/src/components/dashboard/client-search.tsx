import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

interface ClientSearchResult {
  name: string;
  totalSales: number;
  transactionCount: number;
}

export function ClientSearch() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useQuery<ClientSearchResult[]>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(search)}`],
    enabled: search.length >= 2,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClientClick = (clientName: string) => {
    setLocation(`/client/${encodeURIComponent(clientName)}`);
    setSearch("");
    setIsOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-64">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-8 pr-8 h-8 text-xs"
          data-testid="input-search-client"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            data-testid="button-clear-search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && search.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-xs text-gray-500">
              Buscando...
            </div>
          ) : results && results.length > 0 ? (
            <div className="py-1">
              {results.map((client) => (
                <button
                  key={client.name}
                  onClick={() => handleClientClick(client.name)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  data-testid={`search-result-${client.name}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {client.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {client.transactionCount} transacciones
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-blue-600">
                      {formatCurrency(client.totalSales)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-gray-500">
              No se encontraron clientes
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      {isOpen && search.length > 0 && search.length < 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
          <p className="text-xs text-gray-500 text-center">
            Ingresa al menos 2 caracteres
          </p>
        </div>
      )}
    </div>
  );
}
