// ==================================================================================
// "Mis tareas" — la bandeja personal dentro del módulo Marketing.
//
// A diferencia del dashboard (que muestra TODO lo del área) acá solo aparece lo que
// me toca a mí: tareas del segmento marketing que tengo asignadas o que yo creé. El
// objetivo es que la persona entre, vea su carga del día y la mueva sin filtrar nada.
// ==================================================================================
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  CheckSquare,
  Clock,
  Flame,
  Inbox,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Search,
  User,
  Users,
} from "lucide-react";
import {
  TAREA_ESTADO_META,
  TAREA_PRIORIDAD_LABEL,
  TAREA_PRIORIDAD_STYLES,
  TareaDetalleDialog,
  estadoTarea,
  tareaVencida,
  useTareasMarketing,
  type TareaMarketingItem,
} from "@/components/marketing/tarea-detalle-dialog";
import { formatFechaCorta } from "@/components/marketing/solicitud-detalle-dialog";
import { MarketingTaskDialog } from "@/pages/marketing/nueva-tarea-dialog";

type FiltroEstado = "todas" | "pendiente" | "en_progreso" | "completada";

const PRIORIDAD_ORDEN: Record<string, number> = { high: 0, medium: 1, low: 2 };

const KPIS: Array<{ key: FiltroEstado; label: string; icon: any; valor: string; chip: string }> = [
  { key: "todas", label: "Todas", icon: CheckSquare, valor: "text-slate-700 dark:text-slate-200", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { key: "pendiente", label: "Pendientes", icon: Clock, valor: "text-[#fd6301]", chip: "bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 dark:text-orange-400" },
  { key: "en_progreso", label: "En progreso", icon: Play, valor: "text-amber-600", chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
  { key: "completada", label: "Completadas", icon: CheckCircle, valor: "text-emerald-600", chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
];

// Compartido con el dashboard: "mías" = asignadas a mí o creadas por mí.
export function esMiTarea(t: TareaMarketingItem, userId?: string | null) {
  if (!userId) return false;
  if (String(t.createdByUserId) === String(userId)) return true;
  return (t.assignments || []).some((a) => String(a.assigneeId) === String(userId));
}

export default function MisTareasMarketing() {
  const { user } = useAuth();
  const { tareas, nombrePorId, isLoading } = useTareasMarketing();

  const [estado, setEstado] = useState<FiltroEstado>("todas");
  const [prioridad, setPrioridad] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  // Se guarda el id y no el objeto: así la ficha abierta refleja el estado recién
  // guardado en vez de un snapshot viejo de la lista.
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const mias = useMemo(() => tareas.filter((t) => esMiTarea(t, user?.id)), [tareas, user?.id]);

  const conteos = useMemo(() => {
    const base: Record<FiltroEstado, number> = { todas: mias.length, pendiente: 0, en_progreso: 0, completada: 0 };
    for (const t of mias) {
      const e = estadoTarea(t) as FiltroEstado;
      if (e in base) base[e] += 1;
    }
    return base;
  }, [mias]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return mias
      .filter((t) => (estado === "todas" ? true : estadoTarea(t) === estado))
      .filter((t) => (prioridad === "todas" ? true : (t.priority || "low") === prioridad))
      .filter((t) =>
        !texto
          ? true
          : [t.title, t.description, t.clienteNombre]
              .filter(Boolean)
              .some((campo) => String(campo).toLowerCase().includes(texto)),
      )
      .sort((a, b) => {
        // Primero lo que sigue vivo, luego por prioridad y, a igual prioridad, la de
        // plazo más cercano arriba (las sin plazo al final).
        const vivo = (t: TareaMarketingItem) => (estadoTarea(t) === "completada" ? 1 : 0);
        if (vivo(a) !== vivo(b)) return vivo(a) - vivo(b);
        const pa = PRIORIDAD_ORDEN[a.priority || "low"] ?? 2;
        const pb = PRIORIDAD_ORDEN[b.priority || "low"] ?? 2;
        if (pa !== pb) return pa - pb;
        const fa = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const fb = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return fa - fb;
      });
  }, [mias, estado, prioridad, busqueda]);

  const vencidas = mias.filter(tareaVencida).length;
  const altasActivas = mias.filter((t) => t.priority === "high" && estadoTarea(t) !== "completada").length;

  return (
    <div className="space-y-4">
      {/* Sin banner de título (el encabezado de la página ya dice "Mis tareas"): acá van
          solo las alertas y la acción. Crear tarea vive en esta sección porque el rol
          Marketing ya no pasa por el Panel de Trabajo. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {altasActivas > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-[#fd6301] border-orange-200 dark:bg-orange-500/10 dark:border-orange-900/50 font-semibold rounded-full px-3 inline-flex items-center gap-1">
              <Flame className="h-3 w-3" /> {altasActivas} de prioridad alta
            </Badge>
          )}
          {vencidas > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-900/50 font-semibold rounded-full px-3 inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {vencidas} con plazo vencido
            </Badge>
          )}
        </div>
        <Button
          onClick={() => setNuevaAbierta(true)}
          className="ml-auto rounded-2xl font-medium bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
          data-testid="button-nueva-tarea-marketing"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Nueva tarea
        </Button>
      </div>

      {/* KPIs por estado — también son el selector de la lista */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {KPIS.map((kpi) => (
          <button
            key={kpi.key}
            onClick={() => setEstado(kpi.key)}
            data-testid={`kpi-mis-tareas-${kpi.key}`}
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
              placeholder="Buscar por título, detalle o cliente…"
              className="pl-9 rounded-2xl h-10"
              data-testid="input-buscar-mi-tarea"
            />
          </div>
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-4 py-2 shadow-sm hover:border-orange-200 transition-all">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 flex-shrink-0">
              <Flame className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Prioridad</span>
              <Select value={prioridad} onValueChange={setPrioridad}>
                <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full self-start sm:self-auto">
          {visibles.length} {visibles.length === 1 ? "tarea" : "tareas"}
        </Badge>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tareas...
        </div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {mias.length === 0
              ? "No tienes tareas de marketing asignadas ni creadas por ti."
              : "Ninguna de tus tareas coincide con los filtros aplicados."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((t) => (
            <TareaCard key={t.id} tarea={t} nombrePorId={nombrePorId} onOpen={() => setDetalleId(t.id)} />
          ))}
        </div>
      )}

      <TareaDetalleDialog
        tarea={tareas.find((t) => t.id === detalleId) ?? null}
        open={!!detalleId}
        onOpenChange={(o) => { if (!o) setDetalleId(null); }}
        nombrePorId={nombrePorId}
      />

      <MarketingTaskDialog open={nuevaAbierta} onOpenChange={setNuevaAbierta} />
    </div>
  );
}

// Tarjeta de tarea reutilizada por "Mis tareas" y por el dashboard.
export function TareaCard({
  tarea,
  nombrePorId,
  onOpen,
}: {
  tarea: TareaMarketingItem;
  nombrePorId?: Map<string, string>;
  onOpen: () => void;
}) {
  const estado = estadoTarea(tarea);
  const meta = TAREA_ESTADO_META[estado] || TAREA_ESTADO_META.pendiente;
  const EstadoIcon = meta.icon;
  const creador = nombrePorId?.get(String(tarea.createdByUserId));
  // Lo habitual es que uno se cree sus propias tareas: repetir el nombre como creador
  // y como asignado no dice nada, así que solo se listan los asignados distintos.
  const asignados = (tarea.assignments || [])
    .map((a) => nombrePorId?.get(String(a.assigneeId)) || null)
    .filter((n): n is string => !!n && n !== creador);

  return (
    <button
      onClick={onOpen}
      data-testid={`card-tarea-${tarea.id}`}
      className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{tarea.title}</span>
            <Badge variant="outline" className={`text-[10px] font-semibold border inline-flex items-center gap-1 ${meta.badge}`}>
              <EstadoIcon className="h-3 w-3" /> {meta.label}
            </Badge>
            {tarea.priority && estado !== "completada" && (
              <Badge variant="outline" className={`text-[10px] font-semibold border ${TAREA_PRIORIDAD_STYLES[tarea.priority] || TAREA_PRIORIDAD_STYLES.low}`}>
                {TAREA_PRIORIDAD_LABEL[tarea.priority] || "BAJA"}
              </Badge>
            )}
            {tareaVencida(tarea) && (
              <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Plazo vencido: {formatFechaCorta(tarea.dueDate)}
              </Badge>
            )}
          </div>
          {tarea.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tarea.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
            {/* Sin nombre resoluble no se muestra la fila: un "—" no aporta nada. */}
            {creador && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" /> {creador}
              </span>
            )}
            {asignados.length > 0 && (
              <span className="inline-flex items-center gap-1 text-slate-500"><Users className="h-3 w-3" /> {asignados.join(", ")}</span>
            )}
            {tarea.clienteNombre && (
              <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {tarea.clienteNombre}</span>
            )}
            {tarea.dueDate && !tareaVencida(tarea) && (
              <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Plazo: {formatFechaCorta(tarea.dueDate)}</span>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#fd6301] bg-orange-50 dark:bg-orange-500/10 rounded-xl px-2.5 py-1.5 shrink-0">
          <MessageSquare className="h-3.5 w-3.5" /> Abrir chat
        </span>
      </div>
    </button>
  );
}
