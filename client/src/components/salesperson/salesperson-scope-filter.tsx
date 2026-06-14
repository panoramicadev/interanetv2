import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScopeItem {
  name: string;
  totalSales: number;
}

interface Props {
  salespersonName: string;
  selectedPeriod: string;
  filterType: string;
  kind: "client" | "product";
  value: string;
  onChange: (value: string) => void;
}

const COPY = {
  client: {
    label: "Cliente",
    placeholder: "Todos mis clientes",
    search: "Buscar cliente...",
    empty: "Sin clientes",
  },
  product: {
    label: "Producto",
    placeholder: "Todos mis productos",
    search: "Buscar producto...",
    empty: "Sin productos",
  },
} as const;

/**
 * Filtro de Cliente/Producto para el dashboard del vendedor, limitado a SUS
 * propios datos. Los nombres provienen de los endpoints scopeados al vendedor
 * (clientName=nokoen, productName=nokoprct) por lo que coinciden con los filtros
 * `client`/`product` de /api/sales/metrics y /api/sales/yearly-totals.
 */
export default function SalespersonScopeFilter({ salespersonName, selectedPeriod, filterType, kind, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const copy = COPY[kind];

  const listPath = kind === "client"
    ? `/api/sales/salesperson/${encodeURIComponent(salespersonName)}/clients`
    : `/api/sales/salesperson/${encodeURIComponent(salespersonName)}/products`;
  const searchPath = kind === "client"
    ? `/api/salespeople/${encodeURIComponent(salespersonName)}/clients/search`
    : `/api/salespeople/${encodeURIComponent(salespersonName)}/products/search`;
  const field = kind === "client" ? "clientName" : "productName";

  const toItems = (data: any): ScopeItem[] => {
    const items = Array.isArray(data) ? data : (data?.items || []);
    return items
      .map((i: any) => ({ name: i[field] as string, totalSales: i.totalSales || 0 }))
      .filter((i: ScopeItem) => !!i.name);
  };

  // Top list (sin búsqueda) — los productos/clientes más vendidos del vendedor
  const { data: topList } = useQuery<ScopeItem[]>({
    queryKey: [listPath, "scope-filter", selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams({ period: selectedPeriod, filterType, limit: "50" });
      const res = await fetch(`${listPath}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return toItems(await res.json());
    },
    enabled: !!salespersonName,
    staleTime: 60_000,
  });

  const trimmed = search.trim();
  const { data: searchList, isFetching } = useQuery<ScopeItem[]>({
    queryKey: [searchPath, "scope-filter", trimmed, selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams({ q: trimmed, period: selectedPeriod, filterType });
      const res = await fetch(`${searchPath}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return toItems(await res.json());
    },
    enabled: !!salespersonName && trimmed.length >= 2,
    staleTime: 30_000,
  });

  const options = trimmed.length >= 2 ? (searchList || []) : (topList || []);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{copy.label}:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-52 justify-between rounded-lg border-gray-200 text-sm font-normal"
            data-testid={`button-salesperson-${kind}-filter`}
          >
            <span className={cn("truncate max-w-[150px]", !value && "text-gray-400")}>{value || copy.placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={copy.search}
              value={search}
              onValueChange={setSearch}
              data-testid={`input-salesperson-${kind}-filter`}
            />
            <CommandList className="max-h-[50vh]">
              {options.length === 0 && (
                <CommandEmpty>{isFetching ? "Buscando..." : copy.empty}</CommandEmpty>
              )}
              {value && (
                <CommandGroup>
                  <CommandItem value="__clear__" onSelect={() => select("")} data-testid={`${kind}-filter-clear`}>
                    <X className="mr-2 h-4 w-4 text-gray-400" />
                    {copy.placeholder}
                  </CommandItem>
                </CommandGroup>
              )}
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((opt, i) => (
                    <CommandItem
                      key={`${opt.name}-${i}`}
                      value={opt.name}
                      onSelect={() => select(opt.name)}
                      data-testid={`${kind}-opt-${i}`}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === opt.name ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{opt.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => onChange("")}
          data-testid={`button-clear-${kind}-filter`}
          title="Quitar filtro"
        >
          <X className="h-3.5 w-3.5 text-gray-400" />
        </Button>
      )}
    </div>
  );
}
