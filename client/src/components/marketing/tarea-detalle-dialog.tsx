// ==================================================================================
// Ficha de una tarea de Marketing con chat del equipo.
//
// Es la contraparte de `solicitud-detalle-dialog` para el otro lado del módulo: la
// solicitud la pide alguien de afuera (y el chat es CON el solicitante); la tarea es
// trabajo interno del área y el hilo es el chat del EQUIPO sobre esa tarea.
//
// El hilo usa el endpoint unificado /api/tasks/:id/comments (un solo hilo por tarea,
// sin importar a qué asignación se ancle el comentario), igual que el Panel de Trabajo.
// ==================================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  Play,
  Send,
  User,
  Users,
} from "lucide-react";
import { formatFechaCorta } from "@/components/marketing/solicitud-detalle-dialog";

export interface TareaMarketingItem {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null; // pendiente | en_progreso | completada
  priority?: string | null; // low | medium | high
  dueDate?: string | null;
  segmento?: string | null;
  clienteNombre?: string | null;
  createdByUserId: string;
  createdAt?: string | null;
  payload?: Record<string, any> | null;
  assignments?: Array<{ id: string; assigneeId: string; assigneeType?: string | null; status?: string | null }>;
}

interface TaskCommentItem {
  id: string;
  authorId: string;
  authorName: string | null;
  content: string;
  createdAt: string;
}

export const TAREA_ESTADO_META: Record<string, { label: string; badge: string; icon: any }> = {
  pendiente: {
    label: "Pendiente",
    badge: "bg-orange-100 text-[#fd6301] border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50",
    icon: Clock,
  },
  en_progreso: {
    label: "En progreso",
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
    icon: Play,
  },
  completada: {
    label: "Completada",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50",
    icon: CheckCircle,
  },
};

export const TAREA_PRIORIDAD_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
  low: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export const TAREA_PRIORIDAD_LABEL: Record<string, string> = { high: "ALTA", medium: "MEDIA", low: "BAJA" };

export function estadoTarea(t: TareaMarketingItem) {
  return t.status || "pendiente";
}

export function tareaVencida(t: TareaMarketingItem) {
  if (!t.dueDate || estadoTarea(t) === "completada") return false;
  const d = new Date(t.dueDate);
  if (isNaN(d.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return d < hoy;
}

function formatFechaHora(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ==================================================================================
// Universo de tareas del módulo Marketing.
//
// /api/tareas/init trae en una sola llamada las tareas visibles para el usuario más
// los directorios de gente, que es lo que permite mostrar nombres de asignados sin
// una consulta extra por tarjeta. El filtro por segmento se hace acá: el endpoint
// solo usa el parámetro para acotar los grupos, no las tareas.
// ==================================================================================
export function useTareasMarketing() {
  const { data, isLoading } = useQuery<{
    tasks: TareaMarketingItem[];
    salespeople: Array<{ id: string; fullName?: string; salespersonName?: string }>;
    supervisors: Array<{ id: string; fullName?: string; salespersonName?: string }>;
  }>({
    queryKey: ["/api/tareas/init", { segmento: "marketing" }],
  });

  const tareas = useMemo(
    () => (data?.tasks || []).filter((t) => t.segmento === "marketing"),
    [data?.tasks],
  );

  const nombrePorId = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const u of [...(data?.salespeople || []), ...(data?.supervisors || [])]) {
      if (u?.id) mapa.set(String(u.id), u.fullName || u.salespersonName || "Usuario");
    }
    return mapa;
  }, [data?.salespeople, data?.supervisors]);

  return { tareas, nombrePorId, isLoading };
}

// ==================================================================================
// Hilo del equipo sobre la tarea
// ==================================================================================
export function TareaChat({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const finRef = useRef<HTMLDivElement | null>(null);

  const { data: mensajes = [], isLoading } = useQuery<TaskCommentItem[]>({
    queryKey: ["/api/tasks", taskId, "comments"],
    // Conversación en vivo: se refresca mientras la ficha está abierta (el resto de
    // la app corre con staleTime infinito).
    refetchInterval: 15000,
    staleTime: 0,
  });

  const enviar = useMutation({
    mutationFn: async (content: string) =>
      apiRequest(`/api/tasks/${taskId}/comments`, { method: "POST", data: { content } }),
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "comments"] });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo enviar", description: e.message || "Intenta de nuevo.", variant: "destructive" }),
  });

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const submit = () => {
    const content = texto.trim();
    if (!content || enviar.isPending) return;
    enviar.mutate(content);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-orange-50 text-[#fd6301] dark:bg-orange-500/10">
          <MessageSquare className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Chat del equipo</p>
          <p className="text-[11px] text-slate-400 truncate">Todos los que trabajan la tarea ven este hilo</p>
        </div>
      </div>

      <div className="flex-1 min-h-[220px] overflow-y-auto rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversación...
          </div>
        ) : mensajes.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-7 w-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500">Todavía no hay mensajes.</p>
            <p className="text-xs text-slate-400 mt-1">Escribe el primero para coordinar con el equipo.</p>
          </div>
        ) : (
          mensajes.map((m) => {
            const propio = String(m.authorId) === String(user?.id ?? "");
            return (
              <div key={m.id} className={`flex ${propio ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                  propio
                    ? "bg-[#fd6301] text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200"
                }`}>
                  {!propio && (
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{m.authorName || "Usuario"}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${propio ? "text-white/70" : "text-slate-400"}`}>
                    {formatFechaHora(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>

      <div className="flex items-end gap-2 pt-2 shrink-0">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter deja escribir varias líneas.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Escribe un mensaje… (Enter envía, Shift+Enter salta línea)"
          className="resize-none rounded-2xl text-sm"
          data-testid="input-mensaje-tarea"
        />
        <Button
          onClick={submit}
          disabled={!texto.trim() || enviar.isPending}
          className="h-10 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shrink-0"
          data-testid="button-enviar-mensaje-tarea"
        >
          {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ==================================================================================
// Ficha completa: datos + cambio de estado + chat
// ==================================================================================
export function TareaDetalleDialog({
  tarea,
  open,
  onOpenChange,
  nombrePorId,
}: {
  tarea: TareaMarketingItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nombrePorId?: Map<string, string>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const estadoMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/tasks/${id}`, { method: "PATCH", data: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tareas/init"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Estado actualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message || "No se pudo actualizar la tarea.", variant: "destructive" }),
  });

  if (!tarea) return null;

  const estado = estadoTarea(tarea);
  const meta = TAREA_ESTADO_META[estado] || TAREA_ESTADO_META.pendiente;
  const EstadoIcon = meta.icon;
  const payload = tarea.payload || {};

  // Mismo criterio que el backend (PATCH /api/tasks/:id): admin, supervisor/encargado
  // o quien creó la tarea. El resto usa el chat para coordinar.
  const canEdit =
    user?.role === "admin" ||
    user?.role === "supervisor" ||
    user?.role === "encargado_area" ||
    tarea.createdByUserId === user?.id;

  const asignados = (tarea.assignments || [])
    .map((a) => nombrePorId?.get(String(a.assigneeId)) || null)
    .filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* z-[70]: el sidebar de la app es z-[60] y taparía el modal por defecto */}
      <DialogContent className="sm:max-w-[860px] z-[70] max-h-[90vh] overflow-y-auto" overlayClassName="z-[70]">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-left pr-6">
            <span className="min-w-0 break-words">{tarea.title}</span>
            <Badge variant="outline" className={`text-[10px] font-semibold border shrink-0 inline-flex items-center gap-1 ${meta.badge}`}>
              <EstadoIcon className="h-3 w-3" /> {meta.label}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-left">
            Ficha de la tarea y conversación del equipo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Columna izquierda: datos + acciones */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3.5 space-y-2.5">
              {tarea.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{tarea.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {tarea.priority && (
                  <Badge variant="outline" className={`text-[10px] font-semibold border ${TAREA_PRIORIDAD_STYLES[tarea.priority] || TAREA_PRIORIDAD_STYLES.low}`}>
                    PRIORIDAD {TAREA_PRIORIDAD_LABEL[tarea.priority] || "BAJA"}
                  </Badge>
                )}
                {payload.plataforma && (
                  <Badge variant="outline" className="text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 capitalize">
                    {payload.plataforma}
                  </Badge>
                )}
                {tareaVencida(tarea) && (
                  <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Plazo vencido
                  </Badge>
                )}
              </div>

              <div className="grid gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Creada por: {nombrePorId?.get(String(tarea.createdByUserId)) || "—"}
                </span>
                {asignados.length > 0 && (
                  <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" /> Asignada a: {asignados.join(", ")}</span>
                )}
                {tarea.clienteNombre && (
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Cliente: {tarea.clienteNombre}</span>
                )}
                {tarea.createdAt && (
                  <span className="inline-flex items-center gap-1.5"><Send className="h-3 w-3" /> Creada: {formatFechaCorta(tarea.createdAt)}</span>
                )}
                {tarea.dueDate && (
                  <span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-3 w-3" /> Plazo: {formatFechaCorta(tarea.dueDate)}</span>
                )}
                {payload.presupuesto && (
                  <span className="inline-flex items-center gap-1.5">
                    Presupuesto estimado: ${Number(payload.presupuesto).toLocaleString("es-CL")}
                  </span>
                )}
                {payload.urlReferencia && (
                  <a
                    href={payload.urlReferencia}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#fd6301] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver enlace de referencia
                  </a>
                )}
              </div>
            </div>

            {canEdit ? (
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3.5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avance del trabajo</p>
                <div className="flex flex-wrap gap-2">
                  {estado !== "en_progreso" && estado !== "completada" && (
                    <Button
                      className="rounded-2xl flex-1 min-w-[150px] bg-[#fd6301] hover:bg-[#e35400] text-white font-semibold"
                      disabled={estadoMutation.isPending}
                      onClick={() => estadoMutation.mutate({ id: tarea.id, status: "en_progreso" })}
                      data-testid="button-tarea-en-progreso"
                    >
                      <Play className="h-4 w-4 mr-1.5" /> Marcar en progreso
                    </Button>
                  )}

                  {estado !== "completada" && (
                    <Button
                      className="rounded-2xl flex-1 min-w-[150px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      disabled={estadoMutation.isPending}
                      onClick={() => estadoMutation.mutate({ id: tarea.id, status: "completada" })}
                      data-testid="button-tarea-completar"
                    >
                      <Check className="h-4 w-4 mr-1.5" /> Completar
                    </Button>
                  )}

                  {estado !== "pendiente" && (
                    <Button
                      variant="outline"
                      className="rounded-2xl border-slate-200 dark:border-slate-700"
                      disabled={estadoMutation.isPending}
                      onClick={() => estadoMutation.mutate({ id: tarea.id, status: "pendiente" })}
                      data-testid="button-tarea-reabrir"
                    >
                      <Clock className="h-4 w-4 mr-1.5" /> {estado === "completada" ? "Reabrir" : "Volver a pendiente"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3.5 text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Solo quien creó la tarea (o un supervisor) puede mover el estado. Usa el chat para coordinar.
              </div>
            )}
          </div>

          {/* Columna derecha: chat */}
          <div className="flex flex-col min-h-[380px] lg:h-[440px]">
            <TareaChat taskId={tarea.id} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
