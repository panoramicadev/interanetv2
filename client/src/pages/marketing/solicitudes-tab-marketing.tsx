// ==================================================================================
// Dashboard general de solicitudes de marketing.
//
// Es la vista de trabajo del área: TODAS las solicitudes del equipo en un solo lugar
// (no solo las pendientes), con filtros por estado/urgencia/texto, cambio de estado en
// un clic y, al abrir una, la ficha con el chat hacia el solicitante.
// ==================================================================================
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle,
  ClipboardList,
  Flame,
  Inbox,
  Loader2,
  MessageSquare,
  Play,
  Search,
  Send,
  User,
  XCircle,
} from "lucide-react";
import {
  ESTADO_META,
  SolicitudDetalleDialog,
  URGENCIA_STYLES,
  formatFechaCorta,
  plazoVencido,
  type SolicitudMarketingItem,
} from "@/components/marketing/solicitud-detalle-dialog";

type FiltroEstado = "todas" | "solicitado" | "en_proceso" | "completado" | "rechazado";

const URGENCIA_ORDEN: Record<string, number> = { alta: 0, media: 1, baja: 2 };

const KPIS: Array<{ key: FiltroEstado; label: string; icon: any; valor: string; chip: string }> = [
  { key: "todas", label: "Todas", icon: ClipboardList, valor: "text-slate-700 dark:text-slate-200", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { key: "solicitado", label: "Pendientes", icon: Send, valor: "text-[#fd6301]", chip: "bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 dark:text-orange-400" },
  { key: "en_proceso", label: "En progreso", icon: Play, valor: "text-amber-600", chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
  { key: "completado", label: "Completadas", icon: CheckCircle, valor: "text-emerald-600", chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
  { key: "rechazado", label: "Rechazadas", icon: XCircle, valor: "text-red-600", chip: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" },
];

export default function SolicitudesTabMarketing({ userRole }: { userRole?: string | null }) {
  const [estado, setEstado] = useState<FiltroEstado>("todas");
  const [urgencia, setUrgencia] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  // Se guarda el id y no el objeto: así la ficha abierta refleja el estado recién
  // guardado en vez de un snapshot viejo de la lista.
  const [detalleId, setDetalleId] = useState<string | null>(null);

  // Solo Marketing y admin pueden mover el estado (mismo criterio que el backend).
  const canManage = userRole === "admin" || userRole === "marketing";

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudMarketingItem[]>({
    queryKey: ["/api/marketing/solicitudes"],
  });

  const conteos = useMemo(() => {
    const base: Record<FiltroEstado, number> = { todas: solicitudes.length, solicitado: 0, en_proceso: 0, completado: 0, rechazado: 0 };
    for (const s of solicitudes) {
      if (s.estado in base) base[s.estado as FiltroEstado] += 1;
    }
    return base;
  }, [solicitudes]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return solicitudes
      .filter((s) => (estado === "todas" ? true : s.estado === estado))
      .filter((s) => (urgencia === "todas" ? true : (s.urgencia || "baja") === urgencia))
      .filter((s) =>
        !texto
          ? true
          : [s.titulo, s.descripcion, s.supervisorName, s.clienteNombre]
              .filter(Boolean)
              .some((campo) => String(campo).toLowerCase().includes(texto)),
      )
      .sort((a, b) => {
        // Primero lo que está vivo (pendiente / en progreso), luego por urgencia y,
        // a igual urgencia, la solicitud más antigua arriba (evita que se hunda).
        const vivo = (s: SolicitudMarketingItem) => (s.estado === "solicitado" || s.estado === "en_proceso" ? 0 : 1);
        if (vivo(a) !== vivo(b)) return vivo(a) - vivo(b);
        const ua = URGENCIA_ORDEN[a.urgencia || "baja"] ?? 2;
        const ub = URGENCIA_ORDEN[b.urgencia || "baja"] ?? 2;
        if (ua !== ub) return ua - ub;
        return new Date(a.fechaSolicitud || 0).getTime() - new Date(b.fechaSolicitud || 0).getTime();
      });
  }, [solicitudes, estado, urgencia, busqueda]);

  const urgentesActivas = solicitudes.filter(
    (s) => s.urgencia === "alta" && (s.estado === "solicitado" || s.estado === "en_proceso"),
  ).length;
  const vencidas = solicitudes.filter(plazoVencido).length;

  return (
    <div className="space-y-4">
      {/* Banner del módulo */}
      <div className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white px-4 sm:px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight">Panel de solicitudes</h2>
            <p className="text-xs text-white/85 mt-0.5">
              Todas las tareas del equipo en un solo lugar: márcalas en progreso, complétalas y conversa con quien las pidió.
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 flex-shrink-0">
            {urgentesActivas > 0 && (
              <Badge className="bg-white text-[#fd6301] hover:bg-white font-bold rounded-full px-3 inline-flex items-center gap-1">
                <Flame className="h-3 w-3" /> {urgentesActivas} urgentes
              </Badge>
            )}
            {vencidas > 0 && (
              <Badge className="bg-red-600 text-white hover:bg-red-600 font-bold rounded-full px-3 inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {vencidas} con plazo vencido
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* KPIs por estado — también son el selector de la lista */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {KPIS.map((kpi) => (
          <button
            key={kpi.key}
            onClick={() => setEstado(kpi.key)}
            data-testid={`kpi-solicitudes-${kpi.key}`}
            className={`rounded-2xl border bg-white dark:bg-slate-900 p-3.5 text-left transition-all ${
              estado === kpi.key
                ? "border-orange-300 ring-1 ring-orange-200 dark:border-orange-700 dark:ring-orange-900 shadow-md"
                : "border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:border-orange-200"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-lg ${kpi.chip}`}>
                <kpi.icon className="h-3 w-3" />
              </span>
              {kpi.label}
            </div>
            <div className={`text-2xl font-bold leading-none tabular-nums ${conteos[kpi.key] > 0 ? kpi.valor : "text-slate-300 dark:text-slate-600"}`}>
              {conteos[kpi.key]}
            </div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título, solicitante o cliente…"
              className="pl-9 rounded-2xl h-10"
              data-testid="input-buscar-solicitud"
            />
          </div>
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-4 py-2 shadow-sm hover:border-orange-200 transition-all">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 flex-shrink-0">
              <Flame className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Urgencia</span>
              <Select value={urgencia} onValueChange={setUrgencia}>
                <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full self-start sm:self-auto">
          {visibles.length} {visibles.length === 1 ? "solicitud" : "solicitudes"}
        </Badge>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando solicitudes...
        </div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {solicitudes.length === 0
              ? "Todavía no hay solicitudes de marketing."
              : "Ninguna solicitud coincide con los filtros aplicados."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((s) => {
            const meta = ESTADO_META[s.estado] || ESTADO_META.solicitado;
            const EstadoIcon = meta.icon;
            return (
              <button
                key={s.id}
                onClick={() => setDetalleId(s.id)}
                data-testid={`card-solicitud-${s.id}`}
                className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{s.titulo}</span>
                      <Badge variant="outline" className={`text-[10px] font-semibold border inline-flex items-center gap-1 ${meta.badge}`}>
                        <EstadoIcon className="h-3 w-3" /> {meta.label}
                      </Badge>
                      {s.urgencia && s.estado !== "completado" && s.estado !== "rechazado" && (
                        <Badge variant="outline" className={`text-[10px] font-semibold border ${URGENCIA_STYLES[s.urgencia] || URGENCIA_STYLES.baja}`}>
                          {s.urgencia.toUpperCase()}
                        </Badge>
                      )}
                      {plazoVencido(s) && (
                        <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Plazo vencido: {formatFechaCorta(s.fechaEntrega)}
                        </Badge>
                      )}
                    </div>
                    {s.descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.descripcion}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {s.supervisorName || "—"}</span>
                      {s.clienteNombre && (
                        <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {s.clienteNombre}</span>
                      )}
                      {s.fechaSolicitud && (
                        <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> Enviada: {formatFechaCorta(s.fechaSolicitud)}</span>
                      )}
                      {s.fechaEntrega && !plazoVencido(s) && (
                        <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Plazo: {formatFechaCorta(s.fechaEntrega)}</span>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#fd6301] bg-orange-50 dark:bg-orange-500/10 rounded-xl px-2.5 py-1.5 shrink-0">
                    <MessageSquare className="h-3.5 w-3.5" /> Abrir chat
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SolicitudDetalleDialog
        solicitud={solicitudes.find((s) => s.id === detalleId) ?? null}
        open={!!detalleId}
        onOpenChange={(o) => { if (!o) setDetalleId(null); }}
        canManage={canManage}
      />
    </div>
  );
}
