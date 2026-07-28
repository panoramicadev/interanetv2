// ==================================================================================
// Dashboard general del módulo Marketing — la vista de entrada.
//
// Es "todo de una": cómo va el trabajo del área (tareas) y cómo van los pedidos que
// le llegan desde el resto de la empresa (solicitudes), en el mismo lugar. Desde acá
// se abre cualquiera de las dos fichas — con su cambio de estado y su chat — sin tener
// que ir primero a la sección correspondiente.
// ==================================================================================
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CheckSquare,
  ClipboardList,
  Clock,
  Flame,
  LayoutDashboard,
  Loader2,
  Play,
  Send,
  Sparkles,
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
import {
  TAREA_ESTADO_META,
  TareaDetalleDialog,
  estadoTarea,
  tareaVencida,
  useTareasMarketing,
  type TareaMarketingItem,
} from "@/components/marketing/tarea-detalle-dialog";
import { TareaCard, esMiTarea } from "@/pages/marketing/mis-tareas-marketing";

// Un KPI del dashboard. `tono` decide el color del número cuando hay algo que contar.
function KpiTile({
  label,
  valor,
  icon: Icon,
  tono,
  chip,
  onClick,
  testId,
}: {
  label: string;
  valor: number;
  icon: any;
  tono: string;
  chip: string;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-3.5 text-left shadow-sm transition-all ${
        onClick ? "hover:shadow-md hover:border-orange-200" : "cursor-default"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-lg ${chip}`}>
          <Icon className="h-3 w-3" />
        </span>
        {label}
      </div>
      <div className={`text-2xl font-bold leading-none tabular-nums ${valor > 0 ? tono : "text-slate-300 dark:text-slate-600"}`}>
        {valor}
      </div>
    </button>
  );
}

function SeccionHeader({
  icon: Icon,
  titulo,
  descripcion,
  accionLabel,
  onAccion,
}: {
  icon: any;
  titulo: string;
  descripcion: string;
  accionLabel?: string;
  onAccion?: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{titulo}</h3>
          <p className="text-[11px] text-slate-400 truncate">{descripcion}</p>
        </div>
      </div>
      {accionLabel && onAccion && (
        <button
          onClick={onAccion}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#fd6301] hover:text-[#e35400] transition-colors shrink-0"
        >
          {accionLabel} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default function DashboardMarketing({ onIrA }: { onIrA?: (vista: string) => void }) {
  const { user } = useAuth();
  const { tareas, nombrePorId, isLoading: cargandoTareas } = useTareasMarketing();

  const { data: solicitudes = [], isLoading: cargandoSolicitudes } = useQuery<SolicitudMarketingItem[]>({
    queryKey: ["/api/marketing/solicitudes"],
  });

  const [tareaId, setTareaId] = useState<string | null>(null);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);

  const canManageSolicitudes = user?.role === "admin" || user?.role === "marketing";

  const tareasConteo = useMemo(() => {
    const base = { total: tareas.length, pendiente: 0, en_progreso: 0, completada: 0 };
    for (const t of tareas) {
      const e = estadoTarea(t);
      if (e in base) (base as any)[e] += 1;
    }
    return base;
  }, [tareas]);

  const solicitudesConteo = useMemo(() => {
    const base = { total: solicitudes.length, solicitado: 0, en_proceso: 0, completado: 0, rechazado: 0 };
    for (const s of solicitudes) {
      if (s.estado in base) (base as any)[s.estado] += 1;
    }
    return base;
  }, [solicitudes]);

  // "Requiere atención": lo vencido primero y después lo urgente/alta prioridad que
  // sigue vivo. Se mezclan tareas y solicitudes porque para quien trabaja el área es
  // la misma cola de pendientes.
  const atencion = useMemo(() => {
    const items: Array<{
      tipo: "tarea" | "solicitud";
      id: string;
      titulo: string;
      estadoLabel: string;
      estadoBadge: string;
      EstadoIcon: any;
      vencida: boolean;
      fecha?: string | null;
      urgenciaBadge?: string | null;
      urgenciaLabel?: string | null;
    }> = [];

    for (const t of tareas) {
      const vencida = tareaVencida(t);
      const urgente = t.priority === "high" && estadoTarea(t) !== "completada";
      if (!vencida && !urgente) continue;
      const meta = TAREA_ESTADO_META[estadoTarea(t)] || TAREA_ESTADO_META.pendiente;
      items.push({
        tipo: "tarea",
        id: t.id,
        titulo: t.title,
        estadoLabel: meta.label,
        estadoBadge: meta.badge,
        EstadoIcon: meta.icon,
        vencida,
        fecha: t.dueDate,
        urgenciaBadge: urgente ? "bg-red-100 text-red-700 border-red-200" : null,
        urgenciaLabel: urgente ? "PRIORIDAD ALTA" : null,
      });
    }

    for (const s of solicitudes) {
      const vencida = plazoVencido(s);
      const urgente = s.urgencia === "alta" && (s.estado === "solicitado" || s.estado === "en_proceso");
      if (!vencida && !urgente) continue;
      const meta = ESTADO_META[s.estado] || ESTADO_META.solicitado;
      items.push({
        tipo: "solicitud",
        id: s.id,
        titulo: s.titulo,
        estadoLabel: meta.label,
        estadoBadge: meta.badge,
        EstadoIcon: meta.icon,
        vencida,
        fecha: s.fechaEntrega,
        urgenciaBadge: urgente ? URGENCIA_STYLES.alta : null,
        urgenciaLabel: urgente ? "URGENTE" : null,
      });
    }

    return items.sort((a, b) => Number(b.vencida) - Number(a.vencida)).slice(0, 8);
  }, [tareas, solicitudes]);

  const misPendientes = useMemo(
    () =>
      tareas
        .filter((t) => esMiTarea(t, user?.id) && estadoTarea(t) !== "completada")
        .sort((a, b) => {
          const fa = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const fb = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return fa - fb;
        })
        .slice(0, 4),
    [tareas, user?.id],
  );

  const isLoading = cargandoTareas || cargandoSolicitudes;
  const urgentesActivas = solicitudes.filter(
    (s) => s.urgencia === "alta" && (s.estado === "solicitado" || s.estado === "en_proceso"),
  ).length;
  const vencidasTotales = solicitudes.filter(plazoVencido).length + tareas.filter(tareaVencida).length;

  return (
    <div className="space-y-5">
      {/* Banner del módulo */}
      <div className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white px-4 sm:px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight">Dashboard de Marketing</h2>
            <p className="text-xs text-white/85 mt-0.5">
              Todo el trabajo del área en una vista: tareas del equipo y solicitudes que llegan desde la empresa.
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 flex-shrink-0">
            {urgentesActivas > 0 && (
              <Badge className="bg-white text-[#fd6301] hover:bg-white font-bold rounded-full px-3 inline-flex items-center gap-1">
                <Flame className="h-3 w-3" /> {urgentesActivas} urgentes
              </Badge>
            )}
            {vencidasTotales > 0 && (
              <Badge className="bg-red-600 text-white hover:bg-red-600 font-bold rounded-full px-3 inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {vencidasTotales} con plazo vencido
              </Badge>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando el panel...
        </div>
      ) : (
        <>
          {/* Tareas del área */}
          <div className="space-y-2.5">
            <SeccionHeader
              icon={CheckSquare}
              titulo="Tareas del área"
              descripcion="Trabajo interno del equipo de marketing"
              accionLabel="Ver mis tareas"
              onAccion={onIrA ? () => onIrA("mis-tareas") : undefined}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <KpiTile label="Todas" valor={tareasConteo.total} icon={CheckSquare} tono="text-slate-700 dark:text-slate-200" chip="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" testId="kpi-dash-tareas-todas" />
              <KpiTile label="Pendientes" valor={tareasConteo.pendiente} icon={Clock} tono="text-[#fd6301]" chip="bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 dark:text-orange-400" testId="kpi-dash-tareas-pendientes" />
              <KpiTile label="En progreso" valor={tareasConteo.en_progreso} icon={Play} tono="text-amber-600" chip="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" testId="kpi-dash-tareas-en-progreso" />
              <KpiTile label="Completadas" valor={tareasConteo.completada} icon={CheckCircle} tono="text-emerald-600" chip="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" testId="kpi-dash-tareas-completadas" />
            </div>
          </div>

          {/* Solicitudes del equipo */}
          <div className="space-y-2.5">
            <SeccionHeader
              icon={ClipboardList}
              titulo="Solicitudes del equipo"
              descripcion="Pedidos que llegan a marketing desde el resto de la empresa"
              accionLabel="Ver solicitudes"
              onAccion={onIrA ? () => onIrA("solicitudes") : undefined}
            />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
              <KpiTile label="Todas" valor={solicitudesConteo.total} icon={ClipboardList} tono="text-slate-700 dark:text-slate-200" chip="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" testId="kpi-dash-solicitudes-todas" />
              <KpiTile label="Pendientes" valor={solicitudesConteo.solicitado} icon={Send} tono="text-[#fd6301]" chip="bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 dark:text-orange-400" testId="kpi-dash-solicitudes-pendientes" />
              <KpiTile label="En progreso" valor={solicitudesConteo.en_proceso} icon={Play} tono="text-amber-600" chip="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" testId="kpi-dash-solicitudes-en-progreso" />
              <KpiTile label="Completadas" valor={solicitudesConteo.completado} icon={CheckCircle} tono="text-emerald-600" chip="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" testId="kpi-dash-solicitudes-completadas" />
              <KpiTile label="Rechazadas" valor={solicitudesConteo.rechazado} icon={XCircle} tono="text-red-600" chip="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" testId="kpi-dash-solicitudes-rechazadas" />
            </div>
          </div>

          {/* Cola de pendientes + lo mío */}
          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <div className="space-y-2.5">
              <SeccionHeader
                icon={AlertTriangle}
                titulo="Requiere atención"
                descripcion="Vencido o urgente, tareas y solicitudes juntas"
              />
              {atencion.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-6 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-slate-500">Nada vencido ni urgente. El área está al día.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {atencion.map((item) => (
                    <button
                      key={`${item.tipo}-${item.id}`}
                      onClick={() => (item.tipo === "tarea" ? setTareaId(item.id) : setSolicitudId(item.id))}
                      data-testid={`atencion-${item.tipo}-${item.id}`}
                      className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm hover:shadow-md hover:border-orange-200 transition-all"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          {item.tipo === "tarea" ? "TAREA" : "SOLICITUD"}
                        </Badge>
                        <span className="font-semibold text-sm text-slate-800 dark:text-white truncate min-w-0">{item.titulo}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] font-semibold border inline-flex items-center gap-1 ${item.estadoBadge}`}>
                          <item.EstadoIcon className="h-3 w-3" /> {item.estadoLabel}
                        </Badge>
                        {item.urgenciaLabel && (
                          <Badge variant="outline" className={`text-[10px] font-semibold border ${item.urgenciaBadge}`}>
                            {item.urgenciaLabel}
                          </Badge>
                        )}
                        {item.vencida && (
                          <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Venció {formatFechaCorta(item.fecha)}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <SeccionHeader
                icon={CheckSquare}
                titulo="Mis pendientes"
                descripcion="Tus tareas abiertas, por plazo más cercano"
                accionLabel="Ver todas"
                onAccion={onIrA ? () => onIrA("mis-tareas") : undefined}
              />
              {misPendientes.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-6 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-slate-500">No tienes tareas de marketing abiertas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {misPendientes.map((t: TareaMarketingItem) => (
                    <TareaCard key={t.id} tarea={t} nombrePorId={nombrePorId} onOpen={() => setTareaId(t.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <TareaDetalleDialog
        tarea={tareas.find((t) => t.id === tareaId) ?? null}
        open={!!tareaId}
        onOpenChange={(o) => { if (!o) setTareaId(null); }}
        nombrePorId={nombrePorId}
      />

      <SolicitudDetalleDialog
        solicitud={solicitudes.find((s) => s.id === solicitudId) ?? null}
        open={!!solicitudId}
        onOpenChange={(o) => { if (!o) setSolicitudId(null); }}
        canManage={canManageSolicitudes}
      />
    </div>
  );
}
