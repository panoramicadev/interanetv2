import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useFilter, type GastosVista, type YearMonthSelection } from "@/contexts/FilterContext";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Calendar as CalendarIcon,
  TrendingUp,
  Users,
  Building,
  Package,
  CheckCircle2,
  MapPin,
} from "lucide-react";

const CATEGORIAS = ["Combustibles", "Peaje", "Colación", "Gestión Ventas", "Otros"];
const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "aprobado", label: "Aprobado" },
  { value: "rechazado", label: "Rechazado" },
];
const CENTROS_COSTOS = ["Maipú", "Concepción", "Lautaro"];

interface Props {
  /** Optional slot for buttons rendered on the right side of the bar (export, etc.) */
  actions?: ReactNode;
}

/**
 * Filter bar for the Gastos module. Mirrors the layout of the main Dashboard
 * filter bar (Vista + Período + actions) and writes its state to the shared
 * `gastosFilter` slice in FilterContext. Selecting a period updates the legacy
 * mes/anio/diaDesde/diaHasta fields automatically so existing queries keep
 * working without any changes.
 */
export default function GastosFilterBarDashboard({ actions }: Props) {
  const { user } = useAuth();
  const { gastosFilter, updateGastosFilter } = useFilter();

  const selection: YearMonthSelection = gastosFilter.selection ?? {
    years: [new Date().getFullYear()],
    period: "month",
    months: [new Date().getMonth() + 1],
    display: "",
  };
  const vista: GastosVista = gastosFilter.vista ?? "all";
  const vistaValue = gastosFilter.vistaValue ?? "";

  // Vendedores (salesperson) — list comes from gastos analytics so it only
  // shows users that actually have gastos or fund allocations.
  const canSeeUserFilter =
    user?.role && !["salesperson", "Salesperson", "Vendedor", "vendedor"].includes(user.role);
  const { data: usuarios = [] } = useQuery<{ userId: string; userName: string }[]>({
    queryKey: ["/api/gastos-empresariales/analytics/usuarios"],
    enabled: !!canSeeUserFilter,
  });

  // Segmentos
  const { data: segmentosData = [] } = useQuery<Array<{ segment: string }>>({
    queryKey: ["/api/sales/segments"],
    enabled: vista === "segmento",
  });
  const segmentos = segmentosData.map((s) => s.segment).filter(Boolean);

  const handleVistaChange = (next: GastosVista) => {
    // Reset the secondary value whenever the vista type changes so we don't
    // carry over a value that doesn't apply to the new dimension.
    updateGastosFilter({
      vista: next,
      vistaValue: "",
      // For "usuario" vista we also reset the legacy usuarioFilter so existing
      // queries (which read usuarioFilter directly) reflect the change.
      ...(next === "usuario" ? {} : { usuarioFilter: "todos" }),
    });
  };

  const handleVistaValueChange = (value: string) => {
    updateGastosFilter({
      vistaValue: value,
      // Mirror "usuario" vista into the existing usuarioFilter field that the
      // gastos pages already consume.
      ...(vista === "usuario" ? { usuarioFilter: value || "todos" } : {}),
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white px-2.5 py-2.5 shadow-sm sm:px-4 sm:py-4 lg:px-6 lg:py-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Vista */}
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="hidden text-sm font-medium text-gray-700 sm:inline dark:text-gray-300">Vista:</span>
          <Select value={vista} onValueChange={(v) => handleVistaChange(v as GastosVista)}>
            <SelectTrigger
              className="h-9 w-[11rem] rounded-lg border-gray-200 text-sm sm:w-48 dark:border-gray-700 [&>span]:truncate"
              data-testid="select-gastos-vista"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg" sideOffset={4}>
              <SelectItem value="all">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                  <span>Todos los gastos</span>
                </div>
              </SelectItem>
              {canSeeUserFilter && (
                <SelectItem value="usuario">
                  <div className="flex items-center space-x-2">
                    <Users className="h-3.5 w-3.5 text-purple-500" />
                    <span>Por usuario</span>
                  </div>
                </SelectItem>
              )}
              <SelectItem value="segmento">
                <div className="flex items-center space-x-2">
                  <Building className="h-3.5 w-3.5 text-green-500" />
                  <span>Por segmento</span>
                </div>
              </SelectItem>
              <SelectItem value="centroCostos">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-500" />
                  <span>Por centro de costos</span>
                </div>
              </SelectItem>
              <SelectItem value="categoria">
                <div className="flex items-center space-x-2">
                  <Package className="h-3.5 w-3.5 text-teal-500" />
                  <span>Por categoría</span>
                </div>
              </SelectItem>
              <SelectItem value="estado">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
                  <span>Por estado</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conditional secondary selector */}
        {vista === "usuario" && canSeeUserFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Usuario:</span>
            <Select value={vistaValue || "todos"} onValueChange={(v) => handleVistaValueChange(v === "todos" ? "" : v)}>
              <SelectTrigger
                className="h-9 w-56 rounded-lg border-gray-200 text-sm"
                data-testid="select-gastos-usuario"
              >
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-lg max-h-60 overflow-y-auto">
                <SelectItem value="todos">Todos los usuarios</SelectItem>
                {[...usuarios]
                  .sort((a, b) => (a.userName || "").localeCompare(b.userName || ""))
                  .map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>
                      {u.userName || "Sin nombre"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {vista === "segmento" && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Segmento:</span>
            <Select value={vistaValue} onValueChange={handleVistaValueChange}>
              <SelectTrigger
                className="h-9 w-56 rounded-lg border-gray-200 text-sm"
                data-testid="select-gastos-segmento"
              >
                <SelectValue placeholder="Selecciona segmento" />
              </SelectTrigger>
              <SelectContent className="rounded-lg max-h-60 overflow-y-auto">
                {segmentos.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {vista === "centroCostos" && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Centro:</span>
            <Select value={vistaValue} onValueChange={handleVistaValueChange}>
              <SelectTrigger
                className="h-9 w-48 rounded-lg border-gray-200 text-sm"
                data-testid="select-gastos-centro"
              >
                <SelectValue placeholder="Selecciona centro" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {CENTROS_COSTOS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {vista === "categoria" && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Categoría:</span>
            <Select value={vistaValue} onValueChange={handleVistaValueChange}>
              <SelectTrigger
                className="h-9 w-48 rounded-lg border-gray-200 text-sm"
                data-testid="select-gastos-categoria"
              >
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {vista === "estado" && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Estado:</span>
            <Select value={vistaValue} onValueChange={handleVistaValueChange}>
              <SelectTrigger
                className="h-9 w-44 rounded-lg border-gray-200 text-sm"
                data-testid="select-gastos-estado"
              >
                <SelectValue placeholder="Selecciona estado" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {ESTADOS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Período */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="hidden text-sm font-medium text-gray-700 sm:inline">Período:</span>
          <YearMonthSelector
            value={selection}
            onChange={(next) => next && updateGastosFilter({ selection: next })}
          />
        </div>

        {actions && (
          /* En móvil las acciones van en una tira que scrollea en horizontal:
             apiladas (flex-wrap) ocupaban tres filas y empujaban la lista de
             gastos fuera de la primera pantalla. La scrollbar se oculta para
             que no corte los botones. */
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:ml-auto sm:flex-nowrap sm:overflow-visible">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
