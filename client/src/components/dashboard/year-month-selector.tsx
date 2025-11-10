import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Check, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "months" | "day" | "days" | "custom-range";
  month?: number; // 1-12
  months?: number[]; // multiple months 1-12
  days?: number[]; // days of month 1-31
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
  // Convert months from 1-12 to 0-11 for internal state
  const [selectedMonths, setSelectedMonths] = useState<number[]>(
    value?.months ? value.months.map(m => m - 1) : []
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(value?.days || []);
  const [firstDayClick, setFirstDayClick] = useState<number | null>(null);
  
  // Load current selection ONLY when opening the popover
  // Store the previous open state to detect transitions
  const prevOpenRef = useRef(open);
  const appliedRef = useRef(false); // Flag to know if we closed after applying
  
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Abriendo el popover - cargar selección actual del prop
      console.log("📂 [YearMonthSelector] Cargando selección al abrir:", {
        value,
        years: value?.years,
        months: value?.months,
        display: value?.display
      });
      setSelectedYears(value?.years || []);
      setSelectedMonths(value?.months ? value.months.map(m => m - 1) : []);
      setSelectedDays(value?.days || []);
      setFirstDayClick(null); // Reset first day click
      appliedRef.current = false; // Reset applied flag
    } else if (!open && prevOpenRef.current && !appliedRef.current) {
      // Cerrando el popover SIN aplicar - revertir a los valores del prop
      console.log("📂 [YearMonthSelector] Revirtiendo cambios al cerrar sin aplicar (applied flag:", appliedRef.current, ")");
      setSelectedYears(value?.years || []);
      setSelectedMonths(value?.months ? value.months.map(m => m - 1) : []);
      setSelectedDays(value?.days || []);
      setFirstDayClick(null); // Reset first day click
    } else if (!open && prevOpenRef.current && appliedRef.current) {
      console.log("✅ [YearMonthSelector] Cerrando después de aplicar - NO revertir cambios");
    }
    prevOpenRef.current = open;
  }, [open]); // Solo reaccionar a cambios de open, no de value

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
    // Reset days and first day click when months change
    setSelectedDays([]);
    setFirstDayClick(null);
  };

  const handleDayToggle = (day: number) => {
    if (firstDayClick === null) {
      // First click - mark as start of range
      setFirstDayClick(day);
      setSelectedDays([day]);
    } else {
      // Second click - complete the range
      const start = Math.min(firstDayClick, day);
      const end = Math.max(firstDayClick, day);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelectedDays(range);
      setFirstDayClick(null); // Reset for next selection
    }
  };

  const handleClearDays = () => {
    setSelectedDays([]);
    setFirstDayClick(null);
  };

  const handleApplyFullYear = () => {
    if (selectedYears.length === 0) return;
    
    const display = selectedYears.length === 1 
      ? `${selectedYears[0]}`
      : `${selectedYears.join(", ")}`;

    appliedRef.current = true; // Mark as applied
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

    const selection = {
      years: selectedYears,
      period: selectedMonths.length === 1 ? "month" as const : "months" as const,
      months: monthsValue,
      display
    };
    
    console.log("📤 [YearMonthSelector] Enviando selección:", {
      selectedMonthsLength: selectedMonths.length,
      monthsValue,
      period: selection.period,
      selection
    });

    appliedRef.current = true; // Mark as applied
    onChange(selection);
    setOpen(false);
  };

  const handleApplyDays = () => {
    if (selectedYears.length === 0 || selectedMonths.length === 0 || selectedDays.length === 0) return;

    const monthNames = selectedMonths.map(idx => MONTHS[idx]);
    const monthsValue = selectedMonths.map(idx => idx + 1); // Convert to 1-12
    
    let display = "";
    if (selectedDays.length === 1 && selectedMonths.length === 1) {
      display = selectedYears.length === 1
        ? `${selectedDays[0]} ${monthNames[0]} ${selectedYears[0]}`
        : `${selectedDays[0]} ${monthNames[0]} (${selectedYears.join(", ")})`;
    } else {
      const daysStr = selectedDays.join(", ");
      const monthsStr = selectedMonths.length === 1 ? monthNames[0] : monthNames.join(", ");
      display = selectedYears.length === 1
        ? `Días ${daysStr} de ${monthsStr} ${selectedYears[0]}`
        : `Días ${daysStr} de ${monthsStr} (${selectedYears.join(", ")})`;
    }

    appliedRef.current = true; // Mark as applied
    onChange({
      years: selectedYears,
      period: selectedDays.length === 1 ? "day" : "days",
      months: monthsValue,
      days: selectedDays,
      display
    });

    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // La sincronización se maneja en el useEffect cuando se detecta la transición
  };

  // Get number of days in selected month
  const getDaysInMonth = () => {
    if (selectedMonths.length !== 1 || selectedYears.length !== 1) return 31;
    const year = selectedYears[0];
    const month = selectedMonths[0] + 1; // Convert to 1-12
    return new Date(year, month, 0).getDate();
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
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Selección de días - solo cuando hay exactamente 1 mes seleccionado */}
            {selectedMonths.length === 1 && (
              <div className="px-2.5 py-2 border-b">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-medium text-gray-700">Días:</label>
                  {selectedDays.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-2 text-gray-600 hover:text-gray-900"
                      onClick={handleClearDays}
                      data-testid="button-clear-days"
                    >
                      Limpiar seleccionados
                    </Button>
                  )}
                </div>
                
                {/* Encabezados de días de la semana */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dayName) => (
                    <div
                      key={dayName}
                      className="h-6 flex items-center justify-center text-[9px] font-semibold text-gray-600"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>
                
                {/* Calendario de días */}
                <div className="grid grid-cols-7 gap-1 max-h-40 overflow-y-auto">
                  {(() => {
                    const year = selectedYears[0];
                    const month = selectedMonths[0]; // 0-11
                    const daysInMonth = getDaysInMonth();
                    
                    // Obtener el primer día de la semana del mes (0 = Domingo, 6 = Sábado)
                    const firstDayOfWeekJS = new Date(year, month, 1).getDay();
                    // Ajustar para que Lunes sea 0: (0=Dom -> 6, 1=Lun -> 0, 2=Mar -> 1, etc.)
                    const firstDayOfWeek = firstDayOfWeekJS === 0 ? 6 : firstDayOfWeekJS - 1;
                    
                    // Crear array con espacios vacíos + días del mes
                    const calendarDays = [];
                    
                    // Agregar espacios vacíos antes del primer día
                    for (let i = 0; i < firstDayOfWeek; i++) {
                      calendarDays.push(
                        <div key={`empty-${i}`} className="h-7" />
                      );
                    }
                    
                    // Agregar los días del mes
                    for (let day = 1; day <= daysInMonth; day++) {
                      const isSelected = selectedDays.includes(day);
                      calendarDays.push(
                        <Button
                          key={day}
                          variant={isSelected ? "default" : "outline"}
                          className={`h-7 text-[10px] px-1 ${
                            isSelected ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600' : 'hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300'
                          }`}
                          onClick={() => handleDayToggle(day)}
                          data-testid={`day-${day}`}
                        >
                          {day}
                        </Button>
                      );
                    }
                    
                    return calendarDays;
                  })()}
                </div>
              </div>
            )}

            {/* Botón de acción único */}
            <div className="p-2 bg-gray-50">
              <Button
                className="w-full h-7 text-xs font-medium"
                onClick={() => {
                  // Detectar qué tipo de selección se ha hecho
                  if (selectedMonths.length === 1 && selectedDays.length > 0) {
                    handleApplyDays();
                  } else if (selectedMonths.length > 0) {
                    handleApplyMonths();
                  } else {
                    handleApplyFullYear();
                  }
                }}
                disabled={selectedYears.length === 0}
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
