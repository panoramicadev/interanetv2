import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Clock, FolderOpen, Filter } from "lucide-react";

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

const CATEGORIAS = [
  "Combustibles",
  "Colación",
  "Gestión Ventas",
  "Transporte",
  "Materiales",
  "Servicios",
  "Otros"
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
}

export default function GastosFilterBar({
  mes,
  setMes,
  anio,
  setAnio,
  usuarioFilter,
  setUsuarioFilter,
  showEstadoFilter = false,
  estadoFilter,
  setEstadoFilter,
  showCategoriaFilter = false,
  categoriaFilter,
  setCategoriaFilter,
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-[120px]">
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
              <SelectTrigger className="w-[85px]">
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
          </div>

          {canSeeUserFilter && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Users className="h-4 w-4 text-gray-500" />
              <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                <SelectTrigger className="w-[150px]">
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
            </div>
          )}

          {showEstadoFilter && estadoFilter !== undefined && setEstadoFilter && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Clock className="h-4 w-4 text-gray-500" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showCategoriaFilter && categoriaFilter !== undefined && setCategoriaFilter && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <FolderOpen className="h-4 w-4 text-gray-500" />
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
