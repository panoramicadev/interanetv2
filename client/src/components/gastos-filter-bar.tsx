import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Users } from "lucide-react";

const MONTHS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

interface GastosFilterBarProps {
  mes: string;
  setMes: (v: string) => void;
  anio: string;
  setAnio: (v: string) => void;
  usuarioFilter: string;
  setUsuarioFilter: (v: string) => void;
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
  actions,
}: GastosFilterBarProps) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const canSeeUserFilter = user?.role && !['salesperson', 'Salesperson', 'Vendedor', 'vendedor'].includes(user.role);

  const { data: todosUsuariosConGastos = [] } = useQuery<{userId: string; userName: string}[]>({
    queryKey: ['/api/gastos-empresariales/analytics/usuarios'],
    queryFn: async () => {
      const response = await fetch('/api/gastos-empresariales/analytics/usuarios', { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar usuarios');
      return response.json();
    },
    enabled: !!canSeeUserFilter,
  });

  return (
    <div className="w-full bg-gray-50 border rounded-lg px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[120px] bg-white">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger className="w-[85px] bg-white">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canSeeUserFilter && (
            <>
              <div className="hidden sm:block w-px h-6 bg-gray-300 mx-1" />
              <Users className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                <SelectTrigger className="w-[160px] bg-white">
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
