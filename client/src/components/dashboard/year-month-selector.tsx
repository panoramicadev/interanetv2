import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Check, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { buildPeriodDisplay } from "@/contexts/FilterContext";

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
  /** Renderiza el panel abierto y en el flujo, sin popover. Ver el comentario del render. */
  inline?: boolean;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

export function YearMonthSelector({ value, onChange, inline = false }: YearMonthSelectorProps) {
  // En modo inline el panel está siempre "abierto": no hay popover que abrir ni cerrar,
  // así que el estado queda fijo en true y los cierres se ignoran.
  const [openState, setOpenState] = useState(inline);
  const open = inline ? true : openState;
  const setOpen = (next: boolean) => {
    if (!inline) setOpenState(next);
  };
  
  // Default to current year and month if no value provided
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  
  const [selectedYears, setSelectedYears] = useState<number[]>(
    value?.years || [currentYear]
  );
  // Convert months from 1-12 to 0-11 for internal state
  // Si es modo año completo (period === 'full-year'), inicializar con array vacío
  const [selectedMonths, setSelectedMonths] = useState<number[]>(
    value?.period === 'full-year' ? [] : (value?.months ? value.months.map(m => m - 1) : [currentMonth])
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(value?.days || []);
  const [firstDayClick, setFirstDayClick] = useState<number | null>(null);
  const [firstMonthClick, setFirstMonthClick] = useState<number | null>(null);
  const [firstYearClick, setFirstYearClick] = useState<number | null>(null);
  
  // Load current selection ONLY when opening the popover
  // Store the previous open state to detect transitions
  const prevOpenRef = useRef(open);
  const appliedRef = useRef(false); // Flag to know if we closed after applying
  
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Abriendo el popover - cargar selección actual del prop (o valores por defecto)
      console.log("📂 [YearMonthSelector] Cargando selección al abrir:", {
        value,
        years: value?.years,
        months: value?.months,
        period: value?.period,
        display: value?.display
      });
      setSelectedYears(value?.years || [currentYear]);
      // Si es modo año completo, mantener meses vacíos
      setSelectedMonths(
        value?.period === 'full-year' ? [] : (value?.months ? value.months.map(m => m - 1) : [currentMonth])
      );
      setSelectedDays(value?.days || []);
      setFirstDayClick(null); // Reset first day click
      setFirstMonthClick(null); // Reset first month click
      setFirstYearClick(null); // Reset first year click
      appliedRef.current = false; // Reset applied flag
    } else if (!open && prevOpenRef.current && !appliedRef.current) {
      // Cerrando el popover SIN aplicar - revertir a los valores del prop (o por defecto)
      console.log("📂 [YearMonthSelector] Revirtiendo cambios al cerrar sin aplicar (applied flag:", appliedRef.current, ")");
      setSelectedYears(value?.years || [currentYear]);
      // Si es modo año completo, mantener meses vacíos
      setSelectedMonths(
        value?.period === 'full-year' ? [] : (value?.months ? value.months.map(m => m - 1) : [currentMonth])
      );
      setSelectedDays(value?.days || []);
      setFirstDayClick(null); // Reset first day click
      setFirstMonthClick(null); // Reset first month click
      setFirstYearClick(null); // Reset first year click
    } else if (!open && prevOpenRef.current && appliedRef.current) {
      console.log("✅ [YearMonthSelector] Cerrando después de aplicar - NO revertir cambios");
    }
    prevOpenRef.current = open;
  }, [open, currentYear, currentMonth]); // Reaccionar a cambios de open y valores por defecto

  const handleYearToggle = (year: number) => {
    if (firstYearClick === null) {
      // First click - mark as start of range
      setFirstYearClick(year);
      setSelectedYears([year]);
    } else {
      // Second click - complete the range
      const start = Math.min(firstYearClick, year);
      const end = Math.max(firstYearClick, year);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelectedYears(range.sort((a, b) => b - a)); // Sort descending
      setFirstYearClick(null); // Reset for next selection
    }
    // Reset months and days when years change
    setSelectedMonths([]);
    setSelectedDays([]);
    setFirstDayClick(null);
    setFirstMonthClick(null);
  };

  const handleClearYears = () => {
    setSelectedYears([]);
    setFirstYearClick(null);
    setSelectedMonths([]);
    setSelectedDays([]);
    setFirstDayClick(null);
    setFirstMonthClick(null);
  };

  const handleMonthToggle = (monthIndex: number) => {
    if (firstMonthClick === null) {
      // First click - mark as start of range
      setFirstMonthClick(monthIndex);
      setSelectedMonths([monthIndex]);
    } else {
      // Second click - complete the range
      const start = Math.min(firstMonthClick, monthIndex);
      const end = Math.max(firstMonthClick, monthIndex);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelectedMonths(range);
      setFirstMonthClick(null); // Reset for next selection
    }
    // Reset days and first day click when months change
    setSelectedDays([]);
    setFirstDayClick(null);
  };

  const handleClearMonths = () => {
    setSelectedMonths([]);
    setFirstMonthClick(null);
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
      ? `${selectedYears[0]} (año completo)`
      : `${selectedYears.join(", ")} (año completo)`;

    appliedRef.current = true; // Mark as applied
    onChange({
      years: selectedYears,
      period: "full-year",
      display
    });
    
    setOpen(false);
  };

  const handleApplyMonths = () => {
    if (selectedYears.length === 0) return;

    // Si no hay meses seleccionados, cambiar a modo año completo
    if (selectedMonths.length === 0) {
      handleApplyFullYear();
      return;
    }

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

  // Aplica lo que esté elegido en pantalla, eligiendo el modo según la selección.
  const aplicarSeleccionActual = () => {
    if (selectedMonths.length === 1 && selectedDays.length > 0) {
      handleApplyDays();
    } else if (selectedMonths.length > 0) {
      handleApplyMonths();
    } else {
      handleApplyFullYear();
    }
  };

  // En modo inline no hay botón "Aplicar" propio: el panel vive dentro del cajón de
  // filtros, que ya tiene el suyo ("Aplicar filtros"), y dos botones seguidos se leían
  // como dos pasos distintos (corrección del usuario, ago-2026). Entonces cada toque en
  // un año, mes o día se publica al toque hacia el formulario que lo contiene.
  useEffect(() => {
    if (!inline || selectedYears.length === 0) return;
    aplicarSeleccionActual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, selectedYears, selectedMonths, selectedDays]);

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
    // El texto siempre se arma en español desde la selección (ver FilterContext)
    return buildPeriodDisplay(value as any) || value.display;
  };

  // El cuerpo del panel es el mismo en las dos formas de mostrarlo (popover en escritorio,
  // inline dentro del panel de filtros en celular), así que se arma una sola vez.
  const panel = (
    <>
        {/* Cabecera con el título y el modo: solo en el popover de escritorio. Dentro del
            cajón de filtros el panel ya viene rotulado por la sección que lo contiene, y
            repetirlo ahí llenaba la primera pantalla del celular con puro texto
            (corrección del usuario, ago-2026). */}
        <div className={`px-3 sm:px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 ${inline ? "hidden" : ""}`}>
          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Selecciona período</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
            {selectedMonths.length === 0 
              ? "📅 Modo: Año completo"
              : selectedMonths.length === 1 && selectedDays.length > 0
              ? "📆 Modo: Días específicos"
              : selectedMonths.length === 1
              ? "📅 Modo: Mes específico (click en días para detallar)"
              : "📅 Modo: Múltiples meses"}
          </p>
        </div>

        {/* Selección de años - línea horizontal con scroll */}
        <div className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Años</label>
            {selectedYears.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-slate-500 hover:text-slate-900"
                onClick={handleClearYears}
                data-testid="button-clear-years"
              >
                Limpiar seleccionados
              </Button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {YEARS.map((year) => {
              const isSelected = selectedYears.includes(year);
              return (
                <Button
                  key={year}
                  variant={isSelected ? "default" : "outline"}
                  className={`h-9 min-w-[64px] rounded-xl text-sm font-medium shrink-0 px-3 ${
                    isSelected
                      ? 'bg-[#fd6301] hover:bg-[#e35400] text-white border-[#fd6301]'
                      : 'hover:border-orange-300 hover:text-[#fd6301]'
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
            <div className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Meses</label>
                {selectedMonths.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-slate-500 hover:text-slate-900"
                    onClick={handleClearMonths}
                    data-testid="button-clear-months"
                  >
                    Limpiar seleccionados
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {MONTHS.map((month, index) => {
                  const isSelected = selectedMonths.includes(index);
                  return (
                    <Button
                      key={month}
                      variant={isSelected ? "default" : "outline"}
                      className={`h-9 rounded-xl text-xs font-medium px-1 ${
                        isSelected
                          ? 'bg-[#fd6301] hover:bg-[#e35400] text-white border-[#fd6301]'
                          : 'hover:border-orange-300 hover:text-[#fd6301]'
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
              <div className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Días</label>
                  {selectedDays.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-2 text-slate-500 hover:text-slate-900"
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
                      className="h-6 flex items-center justify-center text-[10px] font-semibold text-slate-400"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>
                
                {/* Calendario de días */}
                <div className="grid grid-cols-7 gap-1">
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
                        <div key={`empty-${i}`} className="h-9" />
                      );
                    }
                    
                    // Agregar los días del mes
                    for (let day = 1; day <= daysInMonth; day++) {
                      const isSelected = selectedDays.includes(day);
                      calendarDays.push(
                        <Button
                          key={day}
                          variant={isSelected ? "default" : "outline"}
                          className={`h-9 rounded-lg text-xs font-medium px-0 ${
                            isSelected
                              ? 'bg-[#fd6301] text-white border-[#fd6301] hover:bg-[#e35400]'
                              : 'hover:bg-orange-50 hover:text-[#fd6301] hover:border-orange-300'
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
            {!inline && (
              <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/60">
                <Button
                  className="w-full h-10 rounded-xl text-sm font-medium bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-[#fd6301]/25"
                  onClick={aplicarSeleccionActual}
                  disabled={selectedYears.length === 0}
                  data-testid="button-apply"
                >
                  Aplicar
                </Button>
              </div>
            )}
          </>
        )}
    </>
  );

  /* En celular este selector se abre desde el panel de filtros, que es un Drawer.
     Como popover se portalaba fuera del Drawer: quedaba corrido sobre el fondo oscuro y,
     peor, no se podía tocar nada — mientras el Drawer está abierto el `body` va con
     `pointer-events: none` y el popover, al ser hermano y no hijo, hereda ese bloqueo
     (reporte del usuario, ago-2026). Por eso ahí se usa `inline`: el mismo panel se
     dibuja dentro del Drawer, sin portal, y los años/meses/días vuelven a responder. */
  if (inline) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {panel}
      </div>
    );
  }

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
      
      {/* En escritorio el popover se centra sobre el botón, con un margen mínimo contra
          los bordes (`collisionPadding`) y alto máximo con desplazamiento, para que el
          calendario completo se pueda recorrer sin que se corte. */}
      <PopoverContent
        className="w-[92vw] sm:w-[440px] max-w-[440px] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0"
        align="center"
        collisionPadding={12}
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
}
