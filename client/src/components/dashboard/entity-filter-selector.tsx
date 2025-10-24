import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Filter, Users, Building2, User, X, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface EntityFilter {
  dimension: "all" | "segment" | "salesperson" | "client";
  value?: string;
  label?: string;
}

interface EntityFilterSelectorProps {
  value: EntityFilter;
  onChange: (filter: EntityFilter) => void;
}

const DIMENSIONS = [
  { id: "all", label: "Todos", icon: Filter, description: "Ver todos los datos" },
  { id: "segment", label: "Segmento", icon: Building2, description: "Filtrar por segmento" },
  { id: "salesperson", label: "Vendedor", icon: User, description: "Filtrar por vendedor" },
  { id: "client", label: "Cliente", icon: Users, description: "Filtrar por cliente" },
] as const;

export function EntityFilterSelector({ value, onChange }: EntityFilterSelectorProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"dimension" | "value">("dimension");
  const [selectedDimension, setSelectedDimension] = useState<typeof DIMENSIONS[number]["id"]>(value.dimension);
  const [selectedValue, setSelectedValue] = useState<string | undefined>(value.value);

  // Query for segments
  const { data: segments, isLoading: loadingSegments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
    enabled: selectedDimension === "segment" && step === "value",
  });

  // Query for salespeople
  const { data: salespeople, isLoading: loadingSalespeople } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
    enabled: selectedDimension === "salesperson" && step === "value",
  });

  // Query for clients
  const { data: clients, isLoading: loadingClients } = useQuery<string[]>({
    queryKey: ["/api/goals/data/clients"],
    enabled: selectedDimension === "client" && step === "value",
  });

  const handleDimensionClick = (dimension: typeof DIMENSIONS[number]["id"]) => {
    setSelectedDimension(dimension);
    
    if (dimension === "all") {
      // Apply immediately for "all"
      onChange({ dimension: "all" });
      setOpen(false);
      setStep("dimension");
    } else {
      // Go to value selection
      setSelectedValue(undefined);
      setStep("value");
    }
  };

  const handleValueClick = (val: string) => {
    setSelectedValue(val);
  };

  const handleApply = () => {
    if (selectedDimension === "all") {
      onChange({ dimension: "all" });
    } else if (selectedValue) {
      onChange({
        dimension: selectedDimension,
        value: selectedValue,
        label: selectedValue,
      });
    }
    setOpen(false);
    setStep("dimension");
  };

  const handleClear = () => {
    setSelectedDimension("all");
    setSelectedValue(undefined);
    onChange({ dimension: "all" });
    setStep("dimension");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to current value when closing
      setSelectedDimension(value.dimension);
      setSelectedValue(value.value);
      setStep("dimension");
    }
    setOpen(newOpen);
  };

  const handleBackToDimension = () => {
    setSelectedValue(undefined);
    setStep("dimension");
  };

  const getOptions = () => {
    switch (selectedDimension) {
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

  const isLoading = loadingSegments || loadingSalespeople || loadingClients;

  const getDisplayText = () => {
    if (value.dimension === "all") return "Todos";
    const dim = DIMENSIONS.find(d => d.id === value.dimension);
    if (value.label) return `${dim?.label}: ${value.label}`;
    return dim?.label || "Filtrar";
  };

  const selectedDimensionData = DIMENSIONS.find(d => d.id === selectedDimension);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 min-w-[180px] justify-between text-left font-normal text-xs border-gray-200 shadow-sm"
          data-testid="entity-filter-selector"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Filter className="h-3 w-3 shrink-0 text-gray-500" />
            <span className="truncate">
              {getDisplayText()}
            </span>
          </div>
          {value.dimension !== "all" && (
            <X
              className="h-3 w-3 ml-2 shrink-0 text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {/* Step 1: Select Dimension */}
        {step === "dimension" && (
          <>
            <div className="p-1.5 bg-gray-50 border-b">
              <h4 className="font-semibold text-[11px] leading-tight">Selecciona una vista</h4>
              <p className="text-[9px] text-gray-500 leading-tight">
                Elige cómo quieres filtrar los datos
              </p>
            </div>
            <div className="p-1.5 space-y-0.5">
              {DIMENSIONS.map((dimension) => {
                const Icon = dimension.icon;
                const isSelected = selectedDimension === dimension.id;
                
                return (
                  <Button
                    key={dimension.id}
                    variant={isSelected ? "default" : "ghost"}
                    className="w-full h-auto py-1.5 px-2 justify-start text-left"
                    onClick={() => handleDimensionClick(dimension.id)}
                    data-testid={`dimension-${dimension.id}`}
                  >
                    <Icon className={`h-3 w-3 mr-1.5 shrink-0 ${isSelected ? 'text-white' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-medium leading-tight ${isSelected ? 'text-white' : ''}`}>{dimension.label}</div>
                      <div className={`text-[10px] leading-tight ${isSelected ? 'text-white/90' : 'text-muted-foreground'}`}>{dimension.description}</div>
                    </div>
                    {isSelected && <Check className="h-3 w-3 ml-1 shrink-0 text-white" />}
                  </Button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 2: Select Value */}
        {step === "value" && (
          <>
            <div className="p-1.5 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[11px] leading-tight truncate">Selecciona {selectedDimensionData?.label}</h4>
                <p className="text-[9px] text-gray-500 leading-tight">
                  Elige un valor específico
                </p>
              </div>
              <Button
                variant="ghost"
                className="h-5 text-[10px] px-1.5 ml-1 shrink-0"
                onClick={handleBackToDimension}
                data-testid="button-back-dimension"
              >
                ← Atrás
              </Button>
            </div>
            <div className="p-1.5 space-y-0.5 max-h-[180px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : getOptions().length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">
                  No hay opciones disponibles
                </div>
              ) : (
                getOptions().map((option) => (
                  <Button
                    key={option}
                    variant={selectedValue === option ? "default" : "ghost"}
                    className="w-full h-6 text-[11px] justify-start px-2"
                    onClick={() => handleValueClick(option)}
                    data-testid={`option-${option}`}
                  >
                    <span className={selectedValue === option ? 'text-white' : ''}>{option}</span>
                    {selectedValue === option && <Check className="h-3 w-3 ml-auto text-white" />}
                  </Button>
                ))
              )}
            </div>
            <Separator />
            <div className="flex justify-end gap-1.5 p-1.5 bg-gray-50">
              <Button
                variant="outline"
                className="h-6 text-[11px] px-2.5"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                className="h-6 text-[11px] px-2.5"
                onClick={handleApply}
                disabled={!selectedValue}
                data-testid="button-apply"
              >
                Aplicar
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
