import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, X, ArrowRight, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface DateSelection {
  type: "year" | "years" | "month" | "months" | "range";
  value: string; // formatted value
  display: string; // user-friendly display
  startDate?: Date;
  endDate?: Date;
}

interface UnifiedDateSelectorProps {
  value: DateSelection | null;
  onChange: (selection: DateSelection | null) => void;
  label?: string;
}

export function UnifiedDateSelector({ value, onChange, label = "Seleccionar período" }: UnifiedDateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"years" | "months" | "range">("years");
  const [tempSelection, setTempSelection] = useState<DateSelection | null>(value);
  
  // Year selection state
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  
  // Month selection state
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // Format: YYYY-MM
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const handleYearClick = (year: number) => {
    if (selectedYears.includes(year)) {
      setSelectedYears(selectedYears.filter(y => y !== year));
    } else {
      setSelectedYears([...selectedYears, year]);
    }
  };

  const handleMonthClick = (monthIndex: number, year: number) => {
    const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (selectedMonths.includes(monthStr)) {
      setSelectedMonths(selectedMonths.filter(m => m !== monthStr));
    } else {
      setSelectedMonths([...selectedMonths, monthStr]);
    }
  };

  const handleContinueToMonths = () => {
    if (selectedYears.length > 0) {
      setStep("months");
    }
  };

  const handleApplyYearsOnly = () => {
    let selection: DateSelection | null = null;

    if (selectedYears.length === 1) {
      selection = {
        type: "year",
        value: selectedYears[0].toString(),
        display: selectedYears[0].toString(),
        startDate: new Date(selectedYears[0], 0, 1),
        endDate: new Date(selectedYears[0], 11, 31)
      };
    } else if (selectedYears.length > 1) {
      const sorted = selectedYears.sort((a, b) => a - b);
      selection = {
        type: "years",
        value: `${sorted[0]}-${sorted[sorted.length - 1]}`,
        display: `${sorted[0]} - ${sorted[sorted.length - 1]}`,
        startDate: new Date(sorted[0], 0, 1),
        endDate: new Date(sorted[sorted.length - 1], 11, 31)
      };
    }

    onChange(selection);
    setTempSelection(selection);
    setOpen(false);
  };

  const handleApply = () => {
    let selection: DateSelection | null = null;

    if (step === "months") {
      if (selectedMonths.length === 1) {
        const [year, month] = selectedMonths[0].split('-');
        selection = {
          type: "month",
          value: selectedMonths[0],
          display: `${months[parseInt(month) - 1]} ${year}`,
          startDate: new Date(parseInt(year), parseInt(month) - 1, 1),
          endDate: new Date(parseInt(year), parseInt(month), 0)
        };
      } else if (selectedMonths.length > 1) {
        const sorted = selectedMonths.sort();
        const [firstYear, firstMonth] = sorted[0].split('-');
        const [lastYear, lastMonth] = sorted[sorted.length - 1].split('-');
        selection = {
          type: "months",
          value: `${sorted[0]}_${sorted[sorted.length - 1]}`,
          display: `${months[parseInt(firstMonth) - 1]} ${firstYear} - ${months[parseInt(lastMonth) - 1]} ${lastYear}`,
          startDate: new Date(parseInt(firstYear), parseInt(firstMonth) - 1, 1),
          endDate: new Date(parseInt(lastYear), parseInt(lastMonth), 0)
        };
      }
    } else if (step === "range" && dateRange?.from) {
      const displayEnd = dateRange.to || dateRange.from;
      selection = {
        type: "range",
        value: `${format(dateRange.from, "yyyy-MM-dd")}_${format(displayEnd, "yyyy-MM-dd")}`,
        display: `${format(dateRange.from, "d MMM yyyy", { locale: es })} - ${format(displayEnd, "d MMM yyyy", { locale: es })}`,
        startDate: dateRange.from,
        endDate: displayEnd
      };
    }

    onChange(selection);
    setTempSelection(selection);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedYears([]);
    setSelectedMonths([]);
    setDateRange(undefined);
    setStep("years");
    onChange(null);
    setTempSelection(null);
  };

  const handleBackToYears = () => {
    setSelectedMonths([]);
    setStep("years");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to current value when closing without applying
      setSelectedYears([]);
      setSelectedMonths([]);
      setDateRange(undefined);
      setStep("years");
      
      // Restore previous selection
      if (value) {
        if (value.type === "year") {
          setSelectedYears([parseInt(value.value)]);
        } else if (value.type === "years") {
          const [start, end] = value.value.split('-').map(Number);
          const years = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          setSelectedYears(years);
        } else if (value.type === "month") {
          const [year] = value.value.split('-');
          setSelectedYears([parseInt(year)]);
          setSelectedMonths([value.value]);
          setStep("months");
        } else if (value.type === "months") {
          const [start, end] = value.value.split('_');
          const [startYear] = start.split('-');
          const [endYear] = end.split('-');
          const startYearNum = parseInt(startYear);
          const endYearNum = parseInt(endYear);
          const years = Array.from({ length: endYearNum - startYearNum + 1 }, (_, i) => startYearNum + i);
          setSelectedYears(years);
          // Generate all months between start and end
          const startDate = new Date(start);
          const endDate = new Date(end);
          const months: string[] = [];
          let current = new Date(startDate);
          while (current <= endDate) {
            months.push(format(current, "yyyy-MM"));
            current.setMonth(current.getMonth() + 1);
          }
          setSelectedMonths(months);
          setStep("months");
        } else if (value.type === "range" && value.startDate && value.endDate) {
          setDateRange({ from: value.startDate, to: value.endDate });
          setStep("range");
        }
      }
    }
    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-11 min-w-[200px] justify-between text-left font-normal rounded-xl border-gray-200 shadow-sm"
          data-testid="unified-date-selector"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CalendarIcon className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">
              {value?.display || label}
            </span>
          </div>
          {value && (
            <X
              className="h-4 w-4 ml-2 shrink-0 text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* Step 1: Select Years */}
        {step === "years" && (
          <>
            <div className="p-4 bg-gray-50 border-b">
              <h4 className="font-semibold text-sm mb-1">Paso 1: Selecciona años</h4>
              <p className="text-xs text-gray-500">
                Luego podrás elegir meses específicos o usar todo el año
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={selectedYears.includes(year) ? "default" : "outline"}
                    size="sm"
                    className="h-10"
                    onClick={() => handleYearClick(year)}
                    data-testid={`year-${year}`}
                  >
                    {year}
                  </Button>
                ))}
              </div>
              {selectedYears.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-gray-500 mb-2">Años seleccionados:</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedYears.sort((a, b) => a - b).map(year => (
                      <Badge key={year} variant="secondary">
                        {year}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Separator />
            <div className="p-3 bg-gray-50 space-y-1.5">
              <Button
                className="w-full h-8 text-xs"
                onClick={handleContinueToMonths}
                disabled={selectedYears.length === 0}
                data-testid="button-continue-months"
              >
                Continuar a meses
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Button>
              <div className="text-center text-[10px] text-gray-400 uppercase tracking-wide py-0.5">o</div>
              <Button
                variant="outline"
                className="w-full h-8 text-xs"
                onClick={handleApplyYearsOnly}
                disabled={selectedYears.length === 0}
                data-testid="button-apply-years"
              >
                Aplicar {selectedYears.length > 1 ? 'años completos' : 'año completo'}
              </Button>
              <Separator className="my-1" />
              <Button
                variant="outline"
                className="w-full h-8 text-xs"
                onClick={() => setStep("range")}
                data-testid="button-goto-range"
              >
                Seleccionar rango de fechas
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Select Months */}
        {step === "months" && (
          <>
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm mb-1">Paso 2: Selecciona meses</h4>
                <p className="text-xs text-gray-500">
                  Elige los meses de {selectedYears.length > 1 ? 'los años seleccionados' : 'el año seleccionado'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToYears}
                data-testid="button-back-years"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Atrás
              </Button>
            </div>
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              {selectedYears.sort((a, b) => a - b).map(year => (
                <div key={year} className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 flex items-center justify-between">
                    <span>{year}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedMonths.filter(m => m.startsWith(`${year}-`)).length} meses
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {months.map((month, index) => {
                      const monthStr = `${year}-${String(index + 1).padStart(2, '0')}`;
                      const isSelected = selectedMonths.includes(monthStr);
                      const isFuture = new Date(year, index) > new Date();
                      
                      return (
                        <Button
                          key={monthStr}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-9 text-xs"
                          onClick={() => handleMonthClick(index, year)}
                          disabled={isFuture}
                          data-testid={`month-${monthStr}`}
                        >
                          {month.substring(0, 3)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedMonths.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-gray-500 mb-2">
                    {selectedMonths.length} {selectedMonths.length === 1 ? 'mes seleccionado' : 'meses seleccionados'}:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedMonths.sort().map(monthStr => {
                      const [year, month] = monthStr.split('-');
                      return (
                        <Badge key={monthStr} variant="secondary">
                          {months[parseInt(month) - 1].substring(0, 3)} {year}
                        </Badge>
                      );
                    })}
                  </div>
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
                disabled={selectedMonths.length === 0}
                data-testid="button-apply"
              >
                Aplicar selección
              </Button>
            </div>
          </>
        )}

        {/* Range Selection */}
        {step === "range" && (
          <>
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm mb-1">Rango de fechas personalizado</h4>
                <p className="text-xs text-gray-500">
                  Selecciona fecha inicial y final
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("years")}
                data-testid="button-back-years-from-range"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Atrás
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={es}
              className="rounded-md"
              data-testid="range-calendar"
            />
            {dateRange?.from && (
              <div className="p-4 border-t bg-gray-50">
                <div className="text-xs text-gray-500 mb-1">Rango seleccionado:</div>
                <div className="text-sm font-medium">
                  {format(dateRange.from, "d MMM yyyy", { locale: es })} - {dateRange.to ? format(dateRange.to, "d MMM yyyy", { locale: es }) : "..."}
                </div>
              </div>
            )}
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
                disabled={!dateRange?.from}
                data-testid="button-apply"
              >
                Aplicar rango
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
