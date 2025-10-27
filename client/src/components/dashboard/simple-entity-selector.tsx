import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SimpleEntitySelectorProps {
  dimension: "segment" | "salesperson" | "client";
  value: string | null;
  onChange: (value: string | null) => void;
}

export function SimpleEntitySelector({ dimension, value, onChange }: SimpleEntitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Query for segments
  const { data: segments, isLoading: loadingSegments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
    enabled: dimension === "segment",
  });

  // Query for salespeople
  const { data: salespeople, isLoading: loadingSalespeople } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
    enabled: dimension === "salesperson",
  });

  // Query for clients
  const { data: clients, isLoading: loadingClients } = useQuery<string[]>({
    queryKey: ["/api/goals/data/clients"],
    enabled: dimension === "client",
  });

  const getOptions = () => {
    switch (dimension) {
      case "segment":
        return segments || [];
      case "salesperson":
        return salespeople || [];
      case "client":
        return clients || [];
      default:
        return [];
    }
  };

  const options = getOptions();
  const filteredOptions = searchQuery
    ? options.filter(opt => opt.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const isLoading = loadingSegments || loadingSalespeople || loadingClients;

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue === value ? null : selectedValue);
    setOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const getDisplayText = () => {
    if (value) return value;
    return "Todos";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 px-3 justify-between gap-2 text-xs font-medium hover:bg-gray-50 min-w-[180px]"
          data-testid="button-simple-entity-selector"
        >
          <span className="truncate">{getDisplayText()}</span>
          <div className="flex items-center gap-1">
            {value && (
              <X
                className="h-3 w-3 text-gray-400 hover:text-gray-600"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-entity"
          />
        </div>

        <ScrollArea className="max-h-[180px]">
          <div className="p-1.5">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">
                No se encontraron resultados
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredOptions.map((option) => {
                  const isSelected = option === value;
                  return (
                    <button
                      key={option}
                      onClick={() => handleSelect(option)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors ${
                        isSelected ? 'bg-gray-50' : ''
                      }`}
                      data-testid={`entity-option-${option}`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                      {!isSelected && <div className="h-3 w-3 shrink-0" />}
                      <span className="text-left truncate flex-1">{option}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
