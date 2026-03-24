import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface GastosFilterBarProps {
  mes: string;
  setMes: (v: string) => void;
  anio: string;
  setAnio: (v: string) => void;
  usuarioFilter: string;
  setUsuarioFilter: (v: string) => void;
  diaDesde?: string;
  setDiaDesde?: (v: string) => void;
  diaHasta?: string;
  setDiaHasta?: (v: string) => void;
  showEstadoFilter?: boolean;
  estadoFilter?: string;
  setEstadoFilter?: (v: string) => void;
  showCategoriaFilter?: boolean;
  categoriaFilter?: string;
  setCategoriaFilter?: (v: string) => void;
  actions?: ReactNode;
}

export default function GastosFilterBar({
  mes,
  setMes,
  anio,
  setAnio,
  usuarioFilter,
  setUsuarioFilter,
  diaDesde,
  setDiaDesde,
  diaHasta,
  setDiaHasta,
  actions,
}: GastosFilterBarProps) {
  const { user } = useAuth();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const canSeeUserFilter = user?.role && !['salesperson', 'Salesperson', 'Vendedor', 'vendedor'].includes(user.role);

  const { data: todosUsuariosConGastos = [] } = useQuery<{ userId: string; userName: string }[]>({
    queryKey: ['/api/gastos-empresariales/analytics/usuarios'],
    queryFn: async () => {
      const response = await fetch('/api/gastos-empresariales/analytics/usuarios', { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar usuarios');
      return response.json();
    },
    enabled: !!canSeeUserFilter,
  });

  // Build Date objects from current filter state
  const buildDateRange = (): DateRange => {
    const m = parseInt(mes);
    const y = parseInt(anio);
    if (diaDesde && diaHasta) {
      return {
        from: new Date(diaDesde + 'T12:00:00'),
        to: new Date(diaHasta + 'T12:00:00'),
      };
    }
    // Default to current month range
    return {
      from: new Date(y, m - 1, 1),
      to: new Date(y, m, 0), // last day of month
    };
  };

  const dateRange = buildDateRange();

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;

    const from = range.from;
    const to = range.to || range.from;

    const fromStr = format(from, 'yyyy-MM-dd');
    const toStr = format(to, 'yyyy-MM-dd');

    // Update mes/anio from the "from" date for backward compatibility
    setMes((from.getMonth() + 1).toString());
    setAnio(from.getFullYear().toString());

    if (setDiaDesde) setDiaDesde(fromStr);
    if (setDiaHasta) setDiaHasta(toStr);
  };

  const formatDateRangeLabel = (): string => {
    if (dateRange.from && dateRange.to) {
      const from = dateRange.from;
      const to = dateRange.to;
      if (from.getTime() === to.getTime()) {
        return format(from, "d 'de' MMMM yyyy", { locale: es });
      }
      if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
        return `${format(from, 'd', { locale: es })} - ${format(to, "d 'de' MMMM yyyy", { locale: es })}`;
      }
      return `${format(from, "d MMM yyyy", { locale: es })} - ${format(to, "d MMM yyyy", { locale: es })}`;
    }
    return "Seleccionar fechas";
  };

  return (
    <div className="w-full bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-gray-100 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Single date range picker */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 px-3 gap-2 bg-gray-50/80 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 rounded-lg text-sm font-normal hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-200">{formatDateRangeLabel()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                defaultMonth={dateRange.from}
                locale={es}
              />
            </PopoverContent>
          </Popover>

          {canSeeUserFilter && (
            <>
              <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-slate-700 mx-1" />
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                <SelectTrigger className="w-[160px] bg-gray-50/80 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 rounded-lg">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {todosUsuariosConGastos
                    .sort((a: any, b: any) => (a.userName || '').localeCompare(b.userName || ''))
                    .map((u: any) => (
                      <SelectItem key={u.userId} value={u.userId}>
                        {u.userName || 'Sin nombre'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
