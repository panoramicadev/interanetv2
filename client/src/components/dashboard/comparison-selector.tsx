import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Plus, X } from "lucide-react";
import { UnifiedDateSelector } from "./unified-date-selector";

interface DateSelection {
  type: "year" | "years" | "month" | "months" | "range";
  value: string;
  display: string;
  startDate?: Date;
  endDate?: Date;
}

interface ComparisonSelectorProps {
  value: DateSelection[];
  onChange: (selections: DateSelection[]) => void;
}

export function ComparisonSelector({ value, onChange }: ComparisonSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tempSelections, setTempSelections] = useState<DateSelection[]>(value);

  const handleAddComparison = () => {
    if (tempSelections.length < 3) {
      // Add an empty slot that will be filled by the user
      setTempSelections([...tempSelections, { 
        type: "year", 
        value: "", 
        display: "Sin seleccionar",
        startDate: undefined,
        endDate: undefined
      } as any]);
    }
  };

  const handleRemoveComparison = (index: number) => {
    const newSelections = tempSelections.filter((_, i) => i !== index);
    setTempSelections(newSelections);
  };

  const handleComparisonChange = (index: number, selection: DateSelection | null) => {
    const newSelections = [...tempSelections];
    if (selection) {
      newSelections[index] = selection;
    } else {
      newSelections.splice(index, 1);
    }
    setTempSelections(newSelections);
  };

  const handleApply = () => {
    const validSelections = tempSelections.filter(s => s !== null && s !== undefined);
    onChange(validSelections);
    setOpen(false);
  };

  const handleClear = () => {
    setTempSelections([]);
    onChange([]);
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTempSelections(value);
    }
    setOpen(newOpen);
  };

  const validCount = value.filter(s => s !== null && s !== undefined).length;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-11 min-w-[180px] justify-between text-left font-normal rounded-xl border-gray-200 shadow-sm"
          data-testid="comparison-selector"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GitCompare className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">
              {validCount > 0 ? `Comparar ${validCount} período${validCount > 1 ? 's' : ''}` : "Comparar períodos"}
            </span>
          </div>
          {validCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] rounded-full px-1.5">
              {validCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm">Comparar períodos</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Selecciona hasta 3 períodos para comparar
              </p>
            </div>
            {tempSelections.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={handleClear}
                data-testid="button-clear-all"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {tempSelections.map((selection, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                {index + 1}
              </div>
              <div className="flex-1">
                <UnifiedDateSelector
                  value={selection}
                  onChange={(newSelection) => handleComparisonChange(index, newSelection)}
                  label={`Seleccionar período ${index + 1}`}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-gray-400 hover:text-red-600"
                onClick={() => handleRemoveComparison(index)}
                data-testid={`button-remove-${index}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {tempSelections.length < 3 && (
            <Button
              variant="outline"
              className="w-full h-8 text-xs border-dashed"
              onClick={handleAddComparison}
              data-testid="button-add-comparison"
            >
              <Plus className="h-3 w-3 mr-1.5" />
              Agregar período
            </Button>
          )}

          {tempSelections.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              <GitCompare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay períodos seleccionados</p>
              <p className="text-xs mt-1">Haz clic en "Agregar período" para comenzar</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-3 border-t bg-gray-50">
          <Button
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setOpen(false)}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button
            className="h-8 text-xs"
            onClick={handleApply}
            disabled={tempSelections.length === 0 || tempSelections.some(s => !s)}
            data-testid="button-apply"
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
