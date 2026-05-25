import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CatalogProduct {
  genericName: string;
  groupName: string | null;
  categories: string[];
  colors: Record<string, unknown[]>;
}
interface GroupedCatalogResponse {
  catalog: CatalogProduct[];
  availableGroups: string[];
  totalProducts: number;
}
interface ParentSearchResult {
  parentName: string;
  totalSales: number;
  totalUnits: number;
  variantCount: number;
}

const UNCAT = "Sin categoría";

interface Props {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
}

/**
 * Product selector for the dashboard "Por producto" view. Lists commercial
 * products grouped by category (from the curated grouped-catalog) and falls back
 * to a free-text search over all sales products not yet in the catalog.
 */
export default function ProductGroupedSelector({ value, onChange, className, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: catalog } = useQuery<GroupedCatalogResponse>({
    queryKey: ["/api/products/grouped-catalog", "selector"],
    queryFn: async () => {
      const res = await fetch("/api/products/grouped-catalog", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build category → products map (deduped by generic name)
  const categories = useMemo(() => {
    const map = new Map<string, { name: string; colorCount: number }[]>();
    (catalog?.catalog || []).forEach((p) => {
      const name = (p.genericName || "").trim();
      if (!name) return;
      const cats = p.categories && p.categories.length ? p.categories : p.groupName ? [p.groupName] : [UNCAT];
      const colorCount = p.colors ? Object.keys(p.colors).length : 0;
      cats.forEach((rawCat) => {
        const cat = (rawCat || UNCAT).trim() || UNCAT;
        if (!map.has(cat)) map.set(cat, []);
        const list = map.get(cat)!;
        if (!list.some((x) => x.name.toUpperCase() === name.toUpperCase())) {
          list.push({ name, colorCount });
        }
      });
    });
    return Array.from(map.entries())
      .map(([category, items]) => ({ category, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [catalog]);

  const catalogNames = useMemo(() => {
    const s = new Set<string>();
    categories.forEach((c) => c.items.forEach((i) => s.add(i.name.toUpperCase())));
    return s;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return categories;
    return categories
      .map((c) => ({
        category: c.category,
        items: c.items.filter((i) => i.name.toLowerCase().includes(s) || c.category.toLowerCase().includes(s)),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, search]);

  // Fallback search over sales products not in the catalog
  const { data: searchResults, isFetching: searching } = useQuery<ParentSearchResult[]>({
    queryKey: ["/api/products/search-parent", search],
    queryFn: async () => {
      const res = await fetch(`/api/products/search-parent?q=${encodeURIComponent(search)}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: search.trim().length >= 2,
    staleTime: 30000,
  });

  const fallbackResults = useMemo(() => {
    if (search.trim().length < 2) return [];
    return (searchResults || []).filter((r) => r.parentName && !catalogNames.has(r.parentName.toUpperCase()));
  }, [searchResults, catalogNames, search]);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-9 w-64 justify-between rounded-lg border-gray-200 text-sm font-normal", triggerClassName)}
          data-testid="button-product-grouped-search"
        >
          <span className="truncate max-w-[180px]">{value || "Selecciona producto..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-96 p-0", className)} align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar producto o categoría..."
            value={search}
            onValueChange={setSearch}
            data-testid="input-product-grouped-search"
          />
          <CommandList className="max-h-[60vh]">
            {filteredCategories.length === 0 && fallbackResults.length === 0 && (
              <CommandEmpty>{searching ? "Buscando..." : "No se encontraron productos."}</CommandEmpty>
            )}
            {filteredCategories.map((cat) => (
              <CommandGroup key={cat.category} heading={cat.category}>
                {cat.items.map((item) => (
                  <CommandItem
                    key={item.name}
                    value={item.name}
                    onSelect={() => select(item.name)}
                    data-testid={`product-opt-${item.name}`}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === item.name ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="truncate">{item.name}</span>
                      {item.colorCount > 0 && (
                        <span className="text-xs text-gray-500">
                          {item.colorCount} color{item.colorCount !== 1 ? "es" : ""}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {fallbackResults.length > 0 && (
              <CommandGroup heading="Otros productos (ventas)">
                {fallbackResults.map((r, i) => (
                  <CommandItem
                    key={`${r.parentName}-${i}`}
                    value={r.parentName}
                    onSelect={() => select(r.parentName)}
                    data-testid={`product-fallback-${i}`}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === r.parentName ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="truncate">{r.parentName}</span>
                      {r.variantCount > 1 && <span className="text-xs text-gray-500">{r.variantCount} variantes</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
