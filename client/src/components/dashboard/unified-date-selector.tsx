import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, X } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"year" | "month" | "range">("month");
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

  const handleApply = () => {
    let selection: DateSelection | null = null;

    if (activeTab === "year") {
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
    } else if (activeTab === "month") {
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
    } else if (activeTab === "range" && dateRange?.from) {
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
    onChange(null);
    setTempSelection(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to current value when closing without applying
      setSelectedYears([]);
      setSelectedMonths([]);
      setDateRange(undefined);
      
      // Restore previous selection
      if (value) {
        if (value.type === "year") {
          setSelectedYears([parseInt(value.value)]);
          setActiveTab("year");
        } else if (value.type === "years") {
          const [start, end] = value.value.split('-').map(Number);
          const years = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          setSelectedYears(years);
          setActiveTab("year");
        } else if (value.type === "month") {
          setSelectedMonths([value.value]);
          setActiveTab("month");
        } else if (value.type === "months") {
          const [start, end] = value.value.split('_');
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
          setActiveTab("month");
        } else if (value.type === "range" && value.startDate && value.endDate) {
          setDateRange({ from: value.startDate, to: value.endDate });
          setActiveTab("range");
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-b-none">
            <TabsTrigger value="year" data-testid="tab-year">Año</TabsTrigger>
            <TabsTrigger value="month" data-testid="tab-month">Mes</TabsTrigger>
            <TabsTrigger value="range" data-testid="tab-range">Rango</TabsTrigger>
          </TabsList>
          
          <TabsContent value="year" className="p-4 space-y-4">
            <div className="text-sm text-gray-600 mb-2">
              Selecciona uno o más años
            </div>
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
                <div className="text-xs text-gray-500 mb-2">Seleccionado:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedYears.sort((a, b) => a - b).map(year => (
                    <Badge key={year} variant="secondary">
                      {year}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="month" className="p-4 space-y-4">
            <div className="text-sm text-gray-600 mb-2">
              Selecciona uno o más meses
            </div>
            {availableYears.slice(0, 3).map(year => (
              <div key={year} className="space-y-2">
                <div className="text-sm font-medium text-gray-700">{year}</div>
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
                <div className="text-xs text-gray-500 mb-2">Seleccionado:</div>
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
          </TabsContent>

          <TabsContent value="range" className="p-0">
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
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={
              (activeTab === "year" && selectedYears.length === 0) ||
              (activeTab === "month" && selectedMonths.length === 0) ||
              (activeTab === "range" && !dateRange?.from)
            }
            data-testid="button-apply"
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
