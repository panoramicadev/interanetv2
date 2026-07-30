// ==================================================================================
// "Hoy" — la vista de entrada del módulo Marketing.
//
// Responde una sola pregunta: ¿qué tengo que hacer ahora? Por eso NO es un muro de
// KPIs (eso ya estuvo y no se entendía): son bloques de trabajo real, en orden de
// urgencia, y cada bloque aparece solo si tiene algo adentro. Si no hay nada, lo
// dice: "estás al día".
//
// El orden no es decorativo:
//   1. Por aceptar  — bloquea a otro departamento que está esperando respuesta.
//   2. Atrasado     — ya incumplido, sea tarea propia o compromiso con un tercero.
//   3. Esta semana  — lo que vence pronto, para no volver a caer en atrasado.
// Cada fila abre la ficha con su chat, que es donde se resuelve.
// ==================================================================================
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckSquare,
  Inbox,
  Loader2,
  MessageSquare,
  PartyPopper,
  Play,
  Send,
  User,
} from "lucide-react";
import {
  ROL_LABEL,
  SolicitudDetalleDialog,
  URGENCIA_STYLES,
  formatFechaCorta,
  plazoVencido,
  type SolicitudMarketingItem,
} from "@/components/marketing/solicitud-detalle-dialog";
import {
  TAREA_PRIORIDAD_LABEL,
  TAREA_PRIORIDAD_STYLES,
  TareaDetalleDialog,
  estadoTarea,
  tareaVencida,
  useTareasMarketing,
  type TareaMarketingItem,
} from "@/components/marketing/tarea-detalle-dialog";
import { esMiTarea } from "@/pages/marketing/mis-tareas-marketing";

const URGENCIA_ORDEN: Record<string, number> = { alta: 0, media: 1, baja: 2 };

// Días que faltan para una fecha, contando por día calendario (no por horas): lo que
// vence "hoy" da 0 aunque ya haya pasado la hora.
function diasHasta(valor?: string | null): number | null {
  if (!valor) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
  if (isNaN(d.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
}

function etiquetaPlazo(dias: number | null) {
  if (dias === null) return null;
  if (dias < 0) return `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

function Bloque({
  icon: Icon,
  titulo,
  descripcion,
  tono,
  accion,
  children,
}: {
  icon: any;
  titulo: string;
  descripcion: string;
  tono: string;
  accion?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${tono}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{titulo}</h3>
            <p className="text-[11px] text-slate-400">{descripcion}</p>
          </div>
        </div>
        {accion && (
          <Link href={accion.href}>
            <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#fd6301] hover:text-[#e35400] transition-colors shrink-0">
              {accion.label} <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// Fila compacta: lo justo para decidir si entrar. El detalle vive en la ficha.
function Fila({
  tipo,
  titulo,
  descripcion,
  onOpen,
  badges,
  meta,
  testId,
}: {
  tipo: "TAREA" | "SOLICITUD";
  titulo: string;
  descripcion?: string | null;
  onOpen: () => void;
  badges: React.ReactNode;
  meta?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      onClick={onOpen}
      data-testid={testId}
      className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-semibold border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {tipo}
            </Badge>
            <span className="font-semibold text-sm text-slate-800 dark:text-white truncate min-w-0">{titulo}</span>
            {badges}
          </div>
          {descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{descripcion}</p>}
          {meta && <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">{meta}</div>}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#fd6301] bg-orange-50 dark:bg-orange-500/10 rounded-xl px-2.5 py-1.5 shrink-0">
          <MessageSquare className="h-3.5 w-3.5" /> Abrir
        </span>
      </div>
    </button>
  );
}

export default function HoyMarketing({ canManage }: { canManage: boolean }) {
  const { user } = useAuth();
  const { tareas, nombrePorId, isLoading: cargandoTareas } = useTareasMarketing();
  const { data: solicitudes = [], isLoading: cargandoSolicitudes } = useQuery<SolicitudMarketingItem[]>({
    queryKey: ["/api/marketing/solicitudes"],
  });

  const [tareaId, setTareaId] = useState<string | null>(null);
  const [solicitudId, setSolicitudId] = useState<string | null>(null);

  const misTareas = useMemo(() => tareas.filter((t) => esMiTarea(t, user?.id)), [tareas, user?.id]);

  // Mismo criterio de triage que la bandeja: primero lo urgente y, a igual urgencia,
  // lo que lleva más tiempo esperando (si no, una solicitud vieja se hunde para siempre).
  const porAceptar = useMemo(
    () =>
      solicitudes
        .filter((s) => s.estado === "solicitado")
        .sort(
          (a, b) =>
            (URGENCIA_ORDEN[a.urgencia || "baja"] ?? 2) - (URGENCIA_ORDEN[b.urgencia || "baja"] ?? 2) ||
            new Date(a.fechaSolicitud || 0).getTime() - new Date(b.fechaSolicitud || 0).getTime(),
        ),
    [solicitudes],
  );

  const atrasado = useMemo(() => {
    const s = solicitudes.filter(plazoVencido).map((x) => ({ kind: "solicitud" as const, item: x }));
    const t = misTareas.filter(tareaVencida).map((x) => ({ kind: "tarea" as const, item: x }));
    return [...s, ...t];
  }, [solicitudes, misTareas]);

  // Próximos 7 días, sin lo que ya está atrasado (eso tiene su propio bloque).
  const estaSemana = useMemo(() => {
    const dentro = (d: number | null) => d !== null && d >= 0 && d <= 7;
    const s = solicitudes
      .filter((x) => x.estado === "en_proceso" && !plazoVencido(x) && dentro(diasHasta(x.fechaEntrega)))
      .map((x) => ({ kind: "solicitud" as const, item: x, dias: diasHasta(x.fechaEntrega) }));
    const t = misTareas
      .filter((x) => estadoTarea(x) !== "completada" && !tareaVencida(x) && dentro(diasHasta(x.dueDate)))
      .map((x) => ({ kind: "tarea" as const, item: x, dias: diasHasta(x.dueDate) }));
    return [...s, ...t].sort((a, b) => (a.dias ?? 99) - (b.dias ?? 99));
  }, [solicitudes, misTareas]);

  const enCurso = solicitudes.filter((s) => s.estado === "en_proceso").length;
  const tareasAbiertas = misTareas.filter((t) => estadoTarea(t) !== "completada").length;

  const isLoading = cargandoTareas || cargandoSolicitudes;
  const nombre = (user as any)?.fullName || (user as any)?.name || "";
  const primerNombre = String(nombre).trim().split(/\s+/)[0] || "";
  const sinNada = porAceptar.length === 0 && atrasado.length === 0 && estaSemana.length === 0;

  // Una frase, no un tablero: lo que hay que saber antes de mirar nada más.
  const resumen = (() => {
    const partes: string[] = [];
    if (porAceptar.length > 0) partes.push(`${porAceptar.length} solicitud${porAceptar.length !== 1 ? "es" : ""} esperando tu respuesta`);
    if (atrasado.length > 0) partes.push(`${atrasado.length} con plazo vencido`);
    if (partes.length === 0 && estaSemana.length > 0) partes.push(`${estaSemana.length} con plazo esta semana`);
    if (partes.length === 0) return "No tienes nada pendiente de respuesta ni atrasado.";
    return `Tienes ${partes.join(" y ")}.`;
  })();

  const badgeUrgencia = (s: SolicitudMarketingItem) =>
    s.urgencia ? (
      <Badge variant="outline" className={`text-[10px] font-semibold border ${URGENCIA_STYLES[s.urgencia] || URGENCIA_STYLES.baja}`}>
        {s.urgencia.toUpperCase()}
      </Badge>
    ) : null;

  const metaSolicitud = (s: SolicitudMarketingItem) => (
    <>
      <span className="inline-flex items-center gap-1">
        <User className="h-3 w-3" /> {s.supervisorName || "—"}
        {s.solicitanteRol && ROL_LABEL[s.solicitanteRol] ? ` · ${ROL_LABEL[s.solicitanteRol]}` : ""}
      </span>
      {s.clienteNombre && (
        <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {s.clienteNombre}</span>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      {/* Franja de resumen: la frase del día y el volumen abierto. No repite el título
          —eso ya lo dice el encabezado de la página— para no decir dos veces lo mismo. */}
      <div className="rounded-2xl border border-orange-200/70 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/20 px-4 py-3 flex items-center gap-3 flex-wrap">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 min-w-0 flex-1">
          {isLoading ? "Cargando tu día…" : primerNombre ? `${primerNombre}: ${resumen.charAt(0).toLowerCase()}${resumen.slice(1)}` : resumen}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {enCurso > 0 && (
            <Badge variant="outline" className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-semibold rounded-full px-3 inline-flex items-center gap-1">
              <Play className="h-3 w-3" /> {enCurso} en curso
            </Badge>
          )}
          {tareasAbiertas > 0 && (
            <Badge variant="outline" className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-semibold rounded-full px-3 inline-flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> {tareasAbiertas} tareas abiertas
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu día...
        </div>
      ) : sinNada ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <PartyPopper className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Estás al día</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Nada esperando respuesta, nada atrasado y nada que venza esta semana.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <Link href="/marketing/solicitudes">
              <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-2xl px-4 py-2 transition-colors">
                <Inbox className="h-3.5 w-3.5" /> Ver la bandeja
              </button>
            </Link>
            <Link href="/marketing/mis-tareas">
              <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-2xl px-4 py-2 transition-colors">
                <CheckSquare className="h-3.5 w-3.5" /> Ver mis tareas
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {porAceptar.length > 0 && (
            <Bloque
              icon={Send}
              titulo="Esperando tu respuesta"
              descripcion="Otro departamento no puede avanzar hasta que aceptes o rechaces"
              tono="bg-orange-50 text-[#fd6301] dark:bg-orange-500/10"
              accion={{ label: "Ir a la bandeja", href: "/marketing/solicitudes" }}
            >
              {porAceptar.slice(0, 5).map((s) => (
                <Fila
                  key={s.id}
                  tipo="SOLICITUD"
                  titulo={s.titulo}
                  descripcion={s.descripcion}
                  onOpen={() => setSolicitudId(s.id)}
                  testId={`hoy-por-aceptar-${s.id}`}
                  badges={badgeUrgencia(s)}
                  meta={metaSolicitud(s)}
                />
              ))}
              {porAceptar.length > 5 && (
                <Link href="/marketing/solicitudes">
                  <button className="text-[11px] font-semibold text-slate-400 hover:text-[#fd6301] px-1">
                    y {porAceptar.length - 5} más en la bandeja →
                  </button>
                </Link>
              )}
            </Bloque>
          )}

          {atrasado.length > 0 && (
            <Bloque
              icon={AlertTriangle}
              titulo="Atrasado"
              descripcion="Ya pasó el plazo comprometido"
              tono="bg-red-50 text-red-600 dark:bg-red-500/10"
            >
              {atrasado.map(({ kind, item }) =>
                kind === "solicitud" ? (
                  <Fila
                    key={`s-${item.id}`}
                    tipo="SOLICITUD"
                    titulo={(item as SolicitudMarketingItem).titulo}
                    descripcion={(item as SolicitudMarketingItem).descripcion}
                    onOpen={() => setSolicitudId(item.id)}
                    testId={`hoy-atrasado-solicitud-${item.id}`}
                    badges={
                      <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {etiquetaPlazo(diasHasta((item as SolicitudMarketingItem).fechaEntrega))}
                      </Badge>
                    }
                    meta={metaSolicitud(item as SolicitudMarketingItem)}
                  />
                ) : (
                  <Fila
                    key={`t-${item.id}`}
                    tipo="TAREA"
                    titulo={(item as TareaMarketingItem).title}
                    descripcion={(item as TareaMarketingItem).description}
                    onOpen={() => setTareaId(item.id)}
                    testId={`hoy-atrasado-tarea-${item.id}`}
                    badges={
                      <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {etiquetaPlazo(diasHasta((item as TareaMarketingItem).dueDate))}
                      </Badge>
                    }
                  />
                ),
              )}
            </Bloque>
          )}

          {estaSemana.length > 0 && (
            <Bloque
              icon={CalendarClock}
              titulo="Esta semana"
              descripcion="Vence dentro de los próximos 7 días"
              tono="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
            >
              {estaSemana.map(({ kind, item, dias }) =>
                kind === "solicitud" ? (
                  <Fila
                    key={`s-${item.id}`}
                    tipo="SOLICITUD"
                    titulo={(item as SolicitudMarketingItem).titulo}
                    descripcion={(item as SolicitudMarketingItem).descripcion}
                    onOpen={() => setSolicitudId(item.id)}
                    testId={`hoy-semana-solicitud-${item.id}`}
                    badges={
                      <Badge variant="outline" className="text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {etiquetaPlazo(dias)}
                      </Badge>
                    }
                    meta={metaSolicitud(item as SolicitudMarketingItem)}
                  />
                ) : (
                  <Fila
                    key={`t-${item.id}`}
                    tipo="TAREA"
                    titulo={(item as TareaMarketingItem).title}
                    descripcion={(item as TareaMarketingItem).description}
                    onOpen={() => setTareaId(item.id)}
                    testId={`hoy-semana-tarea-${item.id}`}
                    badges={
                      <>
                        <Badge variant="outline" className="text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" /> {etiquetaPlazo(dias)}
                        </Badge>
                        {(item as TareaMarketingItem).priority === "high" && (
                          <Badge variant="outline" className={`text-[10px] font-semibold border ${TAREA_PRIORIDAD_STYLES.high}`}>
                            {TAREA_PRIORIDAD_LABEL.high}
                          </Badge>
                        )}
                      </>
                    }
                  />
                ),
              )}
            </Bloque>
          )}
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
        canManage={canManage}
      />
    </div>
  );
}
