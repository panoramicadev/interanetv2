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
      <PopoverContent className="w-auto p-0" align="start">
        {/* Step 1: Select Dimension */}
        {step === "dimension" && (
          <>
            <div className="p-2 bg-gray-50 border-b">
              <h4 className="font-semibold text-xs mb-0.5">Selecciona una vista</h4>
              <p className="text-[10px] text-gray-500">
                Elige cómo quieres filtrar los datos
              </p>
            </div>
            <div className="p-2 space-y-1">
              {DIMENSIONS.map((dimension) => {
                const Icon = dimension.icon;
                const isSelected = selectedDimension === dimension.id;
                
                return (
                  <Button
                    key={dimension.id}
                    variant={isSelected ? "default" : "ghost"}
                    className="w-full h-auto py-2 px-3 justify-start text-left"
                    onClick={() => handleDimensionClick(dimension.id)}
                    data-testid={`dimension-${dimension.id}`}
                  >
                    <Icon className={`h-3.5 w-3.5 mr-2 shrink-0 ${isSelected ? 'text-white' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${isSelected ? 'text-white' : ''}`}>{dimension.label}</div>
                      <div className={`text-xs ${isSelected ? 'text-white/90' : 'text-muted-foreground'}`}>{dimension.description}</div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 ml-2 shrink-0 text-white" />}
                  </Button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 2: Select Value */}
        {step === "value" && (
          <>
            <div className="p-2 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-xs mb-0.5">Selecciona {selectedDimensionData?.label}</h4>
                <p className="text-[10px] text-gray-500">
                  Elige un valor específico
                </p>
              </div>
              <Button
                variant="ghost"
                className="h-6 text-[10px] px-2"
                onClick={handleBackToDimension}
                data-testid="button-back-dimension"
              >
                ← Atrás
              </Button>
            </div>
            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-1">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full" />
                  ))}
                </div>
              ) : getOptions().length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">
                  No hay opciones disponibles
                </div>
              ) : (
                getOptions().map((option) => (
                  <Button
                    key={option}
                    variant={selectedValue === option ? "default" : "ghost"}
                    className="w-full h-7 text-xs justify-start"
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
            <div className="flex justify-end gap-2 p-2 bg-gray-50">
              <Button
                variant="outline"
                className="h-7 text-xs px-3"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                className="h-7 text-xs px-3"
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
