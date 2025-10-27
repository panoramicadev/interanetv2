import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Check, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "months" | "custom-range";
  month?: number; // 1-12
  months?: number[]; // multiple months 1-12
  startDate?: Date;
  endDate?: Date;
  display: string;
}

interface YearMonthSelectorProps {
  value: YearMonthSelection | null;
  onChange: (selection: YearMonthSelection | null) => void;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

export function YearMonthSelector({ value, onChange }: YearMonthSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>(value?.years || []);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(value?.months || []);
  
  // Sync internal state with external value when it changes
  useEffect(() => {
    if (value) {
      setSelectedYears(value.years || []);
      setSelectedMonths(value.months || []);
    }
  }, [value]);

  const handleYearToggle = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const handleMonthToggle = (monthIndex: number) => {
    setSelectedMonths(prev => 
      prev.includes(monthIndex) 
        ? prev.filter(m => m !== monthIndex)
        : [...prev, monthIndex].sort((a, b) => a - b)
    );
  };

  const handleApplyFullYear = () => {
    if (selectedYears.length === 0) return;
    
    const display = selectedYears.length === 1 
      ? `${selectedYears[0]}`
      : `${selectedYears.join(", ")}`;

    onChange({
      years: selectedYears,
      period: "full-year",
      display
    });
    
    setOpen(false);
  };

  const handleApplyMonths = () => {
    if (selectedYears.length === 0 || selectedMonths.length === 0) return;

    const monthNames = selectedMonths.map(idx => MONTHS[idx]);
    const monthsValue = selectedMonths.map(idx => idx + 1); // Convert to 1-12
    
    let display = "";
    if (selectedMonths.length === 1) {
      display = selectedYears.length === 1
        ? `${monthNames[0]} ${selectedYears[0]}`
        : `${monthNames[0]} (${selectedYears.join(", ")})`;
    } else {
      const monthsStr = monthNames.join(", ");
      display = selectedYears.length === 1
        ? `${monthsStr} ${selectedYears[0]}`
        : `${monthsStr} (${selectedYears.join(", ")})`;
    }

    onChange({
      years: selectedYears,
      period: selectedMonths.length === 1 ? "month" : "months",
      months: monthsValue,
      display
    });

    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedYears(value?.years || []);
      setSelectedMonths(value?.months ? value.months.map(m => m - 1) : []);
    }
    setOpen(newOpen);
  };

  const getDisplayText = () => {
    if (!value) return "Seleccionar período";
    return value.display;
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 min-w-[200px] justify-between text-left font-normal text-xs border-gray-200 shadow-sm"
          data-testid="year-month-selector"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Calendar className="h-3 w-3 shrink-0 text-gray-500" />
            <span className="truncate">{getDisplayText()}</span>
          </div>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[440px] p-0" align="start">
        <div className="px-2.5 py-1.5 bg-gray-50 border-b">
          <h4 className="font-semibold text-xs">Selecciona período</h4>
          <p className="text-[10px] text-gray-500">
            Elige años y luego un mes específico o año completo
          </p>
        </div>

        {/* Selección de años - línea horizontal con scroll */}
        <div className="px-2.5 py-2 border-b">
          <label className="text-[10px] font-medium text-gray-700 mb-1.5 block">Años:</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
            {YEARS.map((year) => {
              const isSelected = selectedYears.includes(year);
              return (
                <Button
                  key={year}
                  variant={isSelected ? "default" : "outline"}
                  className={`h-7 min-w-[60px] text-xs font-medium shrink-0 ${
                    isSelected ? 'bg-primary text-white' : ''
                  }`}
                  onClick={() => handleYearToggle(year)}
                  data-testid={`year-${year}`}
                >
                  {year}
                  {isSelected && <Check className="h-3 w-3 ml-1" />}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Selección de meses - grid */}
        {selectedYears.length > 0 && (
          <>
            <div className="px-2.5 py-2 border-b">
              <label className="text-[10px] font-medium text-gray-700 mb-1.5 block">Meses:</label>
              <div className="grid grid-cols-6 gap-1">
                {MONTHS.map((month, index) => {
                  const isSelected = selectedMonths.includes(index);
                  return (
                    <Button
                      key={month}
                      variant={isSelected ? "default" : "outline"}
                      className={`h-7 text-[10px] px-1 ${
                        isSelected ? 'bg-primary text-white' : 'hover:bg-primary hover:text-white'
                      }`}
                      onClick={() => handleMonthToggle(index)}
                      data-testid={`month-${index}`}
                    >
                      {month.substring(0, 3)}
                      {isSelected && <Check className="h-2.5 w-2.5 ml-0.5" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="p-2 bg-gray-50 space-y-1.5">
              {selectedMonths.length > 0 && (
                <Button
                  className="w-full h-7 text-xs font-medium"
                  onClick={handleApplyMonths}
                  data-testid="button-apply-months"
                >
                  Aplicar {selectedMonths.length} mes{selectedMonths.length > 1 ? 'es' : ''}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full h-7 text-xs font-medium"
                onClick={handleApplyFullYear}
                data-testid="button-apply-full-year"
              >
                Aplicar año completo
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
