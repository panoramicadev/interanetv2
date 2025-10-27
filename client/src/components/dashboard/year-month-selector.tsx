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
  const [step, setStep] = useState<"years" | "period-choice">("years");
  const [selectedYears, setSelectedYears] = useState<number[]>(value?.years || []);

  const handleYearToggle = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const handleContinueToMonths = () => {
    setStep("period-choice");
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
    setStep("years");
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
    setStep("years");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedYears(value?.years || []);
      setStep("years");
    }
    setOpen(newOpen);
  };

  const handleClear = () => {
    onChange(null);
    setSelectedYears([]);
    setStep("years");
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
      
      <PopoverContent className="w-[500px] p-0" align="start">
        {/* Paso 1: Seleccionar años */}
        {step === "years" && (
          <>
            <div className="p-3 bg-gray-50 border-b">
              <h4 className="font-semibold text-sm mb-1">Paso 1: Selecciona años</h4>
              <p className="text-xs text-gray-500">
                Luego podrás elegir meses específicos o usar todo el año
              </p>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-5 gap-2">
                {YEARS.map((year) => {
                  const isSelected = selectedYears.includes(year);
                  return (
                    <Button
                      key={year}
                      variant={isSelected ? "default" : "outline"}
                      className={`h-12 text-sm font-medium ${
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

            {selectedYears.length > 0 && (
              <>
                <Separator />
                <div className="p-3 space-y-2">
                  <Button
                    className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium"
                    onClick={handleContinueToMonths}
                    data-testid="button-continue-months"
                  >
                    Continuar a meses
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                  
                  <div className="text-center text-xs text-gray-400">O</div>
                  
                  <Button
                    variant="outline"
                    className="w-full h-9 text-sm"
                    onClick={handleApplyFullYear}
                    data-testid="button-apply-full-year"
                  >
                    Aplicar año completo
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* Paso 2: Seleccionar mes o rango */}
        {step === "period-choice" && (
          <>
            <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm mb-1">
                  Paso 2: Selecciona mes
                </h4>
                <p className="text-xs text-gray-500">
                  Años seleccionados: {selectedYears.join(", ")}
                </p>
              </div>
              <Button
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setStep("years")}
                data-testid="button-back-years"
              >
                ← Atrás
              </Button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((month, index) => (
                  <Button
                    key={month}
                    variant="outline"
                    className="h-10 text-xs hover:bg-primary hover:text-white"
                    onClick={() => handleMonthSelect(index)}
                    data-testid={`month-${index}`}
                  >
                    {month}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
