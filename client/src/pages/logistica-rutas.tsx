import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Truck,
  User,
  Clock,
  Package,
  CheckCircle2,
  List,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

// Espejo EXACTO del panel externo "Gestión de Rutas" del TMS.
// Datos: GET /api/logistica/rutas (lista) + /api/logistica/rutas/:id (detalle).

interface Entrega {
  id?: number | string | null;
  secuencia?: number | null;
  estadoEntrega?: string | null;
  numeroDocumento?: string | null;
  tipoDocumento?: string | null;
  clienteIdErp?: string | null;
  clienteNombre?: string | null;
  direccionEntrega?: string | null;
  comunaEntrega?: string | null;
  regionEntrega?: string | null;
  horaEntrega?: string | null;
  motivoRechazo?: string | null;
  pesoTotalKg?: number | null;
}

interface Ruta {
  id: number | string;
  estado?: string | null;
  operarioNombre?: string | null;
  vehiculoPatente?: string | null;
  vehiculoTipo?: string | null;
  fechaInicioRuta?: string | null;
  fechaFinRuta?: string | null;
  pesoTotalKg?: number | null;
  numeroEntregas?: number | null;
  creadoEn?: string | null;
  entregas?: Entrega[];
}

interface RutasResponse {
  tmsEnabled: boolean;
  estados: string[];
  data: Ruta[];
  total: number;
  limit: number;
  offset: number;
}

const LIMIT = 10;

const TABS: { value: string; label: string; Icon: any }[] = [
  { value: "Pendiente", label: "Pendiente", Icon: Clock },
  { value: "Cargando", label: "Cargando", Icon: Package },
  { value: "En Ruta", label: "En Ruta", Icon: Truck },
  { value: "Completada", label: "Completada", Icon: CheckCircle2 },
  { value: "all", label: "Todas", Icon: List },
];

const fmtFechaHora = (v?: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const fmtPeso = (n?: number | null): string =>
  n == null || Number.isNaN(Number(n)) ? "—" : `${Number(n).toFixed(1)} kg`;

// Colores del badge de estado de la RUTA (según spec del espejo).
function rutaEstadoBadge(estado?: string | null): string {
  switch (estado) {
    case "En Ruta":
      return "bg-[#FF6E23] text-white"; // sólido destacado (naranja)
    case "Cargando":
      return "bg-slate-100 text-slate-700"; // secundario (gris)
    case "Completada":
      return "border border-green-300 text-green-700 bg-white"; // outline verde
    default:
      return "border border-slate-300 text-slate-600 bg-white"; // Pendiente y otros: outline neutro
  }
}

// Colores del badge de estado de la ENTREGA (sub-tabla).
function entregaEstadoBadge(estado?: string | null): string {
  switch (estado) {
    case "Entregado":
      return "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200";
    case "No Entregado":
      return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";
    default:
      return "border border-slate-300 text-slate-600 bg-white";
  }
}

function pageList(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < totalPages - 2) pages.push("…");
  pages.push(totalPages);
  return pages;
}

function RutaRow({ ruta }: { ruta: Ruta }) {
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading, isError } = useQuery<Ruta>({
    queryKey: ["/api/logistica/rutas", String(ruta.id)],
    enabled: open,
  });

  const entregas = detail?.entregas ?? [];
  const numEntregas =
    ruta.numeroEntregas ?? (Array.isArray(ruta.entregas) ? ruta.entregas.length : null);

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/60">
        <td className="px-2 py-3 w-8 align-middle">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Cerrar" : "Ver entregas"}
            className="text-slate-400 hover:text-slate-700"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
            <Truck className="h-4 w-4 text-slate-400" /> #{ruta.id}
          </span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-2 text-slate-700">
            <User className="h-4 w-4 text-slate-400" /> {ruta.operarioNombre || "—"}
          </span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap font-mono text-slate-700">
          {ruta.vehiculoPatente || "—"}
        </td>
        <td className="px-3 py-3">
          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
            {numEntregas ?? "—"}
          </span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap text-slate-700">{fmtPeso(ruta.pesoTotalKg)}</td>
        <td className="px-3 py-3 whitespace-nowrap text-slate-500">{fmtFechaHora(ruta.creadoEn)}</td>
        <td className="px-3 py-3">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${rutaEstadoBadge(
              ruta.estado,
            )}`}
          >
            {ruta.estado || "—"}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} className="bg-slate-50/70 px-4 py-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">
              Entregas de la ruta #{ruta.id}
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando entregas...
              </div>
            ) : isError ? (
              <div className="text-sm text-red-600 py-2">No se pudo cargar el detalle de la ruta.</div>
            ) : entregas.length === 0 ? (
              <div className="text-sm text-slate-500 py-2">Sin entregas registradas.</div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium w-10">#</th>
                      <th className="px-3 py-2 text-left font-medium">Documento</th>
                      <th className="px-3 py-2 text-left font-medium">Cliente</th>
                      <th className="px-3 py-2 text-left font-medium">Dirección</th>
                      <th className="px-3 py-2 text-left font-medium">Estado Entrega</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas
                      .slice()
                      .sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0))
                      .map((e, i) => {
                        const doc = e.tipoDocumento
                          ? `${e.tipoDocumento} ${e.numeroDocumento ?? ""}`.trim()
                          : e.numeroDocumento || "—";
                        const cliente = e.clienteNombre || e.clienteIdErp || "—";
                        const dir =
                          [e.direccionEntrega, e.comunaEntrega].filter(Boolean).join(", ") || "—";
                        return (
                          <tr key={e.id ?? i} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-500">{e.secuencia ?? i + 1}</td>
                            <td className="px-3 py-2 text-slate-700">{doc}</td>
                            <td className="px-3 py-2 text-slate-700">{cliente}</td>
                            <td className="px-3 py-2 text-slate-600">{dir}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${entregaEstadoBadge(
                                  e.estadoEntrega,
                                )}`}
                              >
                                {e.estadoEntrega || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogisticaRutas() {
  const [tab, setTab] = useState<string>("Pendiente");
  const [page, setPage] = useState<number>(1);
  const [bust, setBust] = useState<number>(0);

  const offset = (page - 1) * LIMIT;

  const params: Record<string, any> = { limit: LIMIT, offset };
  if (tab !== "all") params.estado = tab;
  if (bust) params.fresh = bust;

  const { data, isLoading, isError, error, isFetching, dataUpdatedAt } = useQuery<RutasResponse>({
    queryKey: ["/api/logistica/rutas", params],
    placeholderData: keepPreviousData,
  });

  const rutas = data?.data ?? [];
  const total = data?.total ?? 0;
  const tmsEnabled = data?.tmsEnabled ?? true;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  const changeTab = (value: string) => {
    setTab(value);
    setPage(1);
    setBust(0);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 space-y-5">
        {/* A) Encabezado */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#FF6E23] flex items-center justify-center">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Rutas</h1>
              <p className="text-sm text-gray-500">
                Seguimiento de todas las rutas: pendientes, en tránsito y completadas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && dataUpdatedAt > 0 && (
              <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
                Actualizado{" "}
                {new Date(dataUpdatedAt).toLocaleTimeString("es-CL", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setBust(Date.now())}
              disabled={isFetching}
              title="Traer el estado más reciente del TMS (saltea el cache)"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>

        {!tmsEnabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              El sistema de envíos (TMS) no está conectado en este entorno. Cargá{" "}
              <strong>TMS_API_BASE</strong> y <strong>TMS_API_KEY</strong> para ver los datos reales.
            </span>
          </div>
        )}

        {/* B) Tabs de filtro */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white border border-slate-200 p-1.5 w-fit">
          {TABS.map(({ value, label, Icon }) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => changeTab(value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            );
          })}
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400 ml-1" />}
        </div>

        {/* C) Tabla */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando rutas...
          </div>
        ) : isError ? (
          <div className="rounded-xl bg-red-50 ring-1 ring-inset ring-red-200 p-4 text-sm text-red-700">
            {(error as Error)?.message || "No se pudieron cargar las rutas."}
          </div>
        ) : rutas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">
            {tab === "all"
              ? "No hay rutas en este momento."
              : `No hay rutas en estado "${tab}" en este momento.`}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="px-2 py-3 w-8" />
                    <th className="px-3 py-3 text-left font-medium">Ruta</th>
                    <th className="px-3 py-3 text-left font-medium">Chofer</th>
                    <th className="px-3 py-3 text-left font-medium">Vehículo</th>
                    <th className="px-3 py-3 text-left font-medium">Entregas</th>
                    <th className="px-3 py-3 text-left font-medium">Peso</th>
                    <th className="px-3 py-3 text-left font-medium">Creada</th>
                    <th className="px-3 py-3 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rutas.map((ruta) => (
                    <RutaRow key={String(ruta.id)} ruta={ruta} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* E) Paginación */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Mostrando {from}-{to} de {total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </button>
                {pageList(page, totalPages).map((p, i) =>
                  p === "…" ? (
                    <span key={`e${i}`} className="px-2 text-slate-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`min-w-[2rem] px-2.5 py-1.5 rounded-lg text-sm ${
                        p === page
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
