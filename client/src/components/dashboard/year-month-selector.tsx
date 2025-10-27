import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Check, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "custom-range";
  month?: number; // 1-12
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

  const handleYearToggle = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year].sort((a, b) => b - a)
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

  const handleMonthSelect = (monthIndex: number) => {
    if (selectedYears.length === 0) return;

    const monthName = MONTHS[monthIndex];
    const display = selectedYears.length === 1
      ? `${monthName} ${selectedYears[0]}`
      : `${monthName} (${selectedYears.join(", ")})`;

    onChange({
      years: selectedYears,
      period: "month",
      month: monthIndex + 1,
      display
    });

    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedYears(value?.years || []);
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
      
      <PopoverContent className="w-[600px] p-0" align="start">
        <div className="p-3 bg-gray-50 border-b">
          <h4 className="font-semibold text-sm mb-1">Selecciona período</h4>
          <p className="text-xs text-gray-500">
            Elige años y luego un mes específico o año completo
          </p>
        </div>

        {/* Selección de años - línea horizontal con scroll */}
        <div className="p-3 border-b">
          <label className="text-xs font-medium text-gray-700 mb-2 block">Años:</label>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {YEARS.map((year) => {
              const isSelected = selectedYears.includes(year);
              return (
                <Button
                  key={year}
                  variant={isSelected ? "default" : "outline"}
                  className={`h-9 min-w-[70px] text-sm font-medium shrink-0 ${
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
            <div className="p-3 border-b">
              <label className="text-xs font-medium text-gray-700 mb-2 block">Meses:</label>
              <div className="grid grid-cols-6 gap-1.5">
                {MONTHS.map((month, index) => (
                  <Button
                    key={month}
                    variant="outline"
                    className="h-8 text-[11px] hover:bg-primary hover:text-white px-1"
                    onClick={() => handleMonthSelect(index)}
                    data-testid={`month-${index}`}
                  >
                    {month.substring(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Botón año completo */}
            <div className="p-3 bg-gray-50">
              <Button
                variant="outline"
                className="w-full h-9 text-sm font-medium"
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
