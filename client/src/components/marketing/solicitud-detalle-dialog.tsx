// ==================================================================================
// Detalle de una solicitud de marketing con chat integrado.
//
// Es la pieza compartida entre el módulo Marketing (dashboard general de solicitudes)
// y el Panel de Trabajo (bandeja del solicitante y panel de la encargada): en los tres
// lugares se abre la MISMA ficha, con la misma conversación, para que Marketing y quien
// pidió el trabajo tengan un solo hilo — igual que la bitácora de un pedido.
// ==================================================================================
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Loader2,
  MessageSquare,
  Play,
  Send,
  User,
  XCircle,
} from "lucide-react";

export interface SolicitudMarketingItem {
  id: string;
  titulo: string;
  descripcion?: string | null;
  estado: string; // solicitado | en_proceso | completado | rechazado
  urgencia?: string | null;
  segmento?: string | null;
  supervisorId?: string | null;
  supervisorName?: string | null;
  solicitanteRol?: string | null;
  clienteNombre?: string | null;
  fechaSolicitud?: string | null;
  fechaEntrega?: string | null;
  fechaCompletado?: string | null;
  motivoRechazo?: string | null;
  notas?: string | null;
}

interface MensajeSolicitud {
  id: string;
  nota: string;
  autorId: string;
  autorNombre: string;
  createdAt: string;
}

export const URGENCIA_STYLES: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50",
  media: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
  baja: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export const ESTADO_META: Record<string, { label: string; badge: string; icon: any }> = {
  solicitado: {
    label: "Pendiente",
    badge: "bg-orange-100 text-[#fd6301] border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50",
    icon: Send,
  },
  en_proceso: {
    label: "En progreso",
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
    icon: Play,
  },
  completado: {
    label: "Completada",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50",
    icon: CheckCircle,
  },
  rechazado: {
    label: "Rechazada",
    badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50",
    icon: XCircle,
  },
};

export const ROL_LABEL: Record<string, string> = {
  admin: "Administración",
  supervisor: "Supervisor",
  encargado_area: "Encargado de área",
  salesperson: "Vendedor",
  marketing: "Marketing",
};

const SEGMENTO_LABEL: Record<string, string> = {
  ferreterias: "Ferreterías",
  construccion: "Construcción",
  digital: "Digital",
  marketing: "Marketing",
};

// Las fechas "date" del backend llegan como YYYY-MM-DD: si se pasan crudas a Date se
// interpretan en UTC y en Chile (-4) se muestran un día antes. Se anclan al mediodía
// local para que el día calce con el que se guardó.
function parseFecha(value: string | Date) {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
}

export function formatFechaCorta(value?: string | Date | null) {
  if (!value) return "";
  const d = parseFecha(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function formatFechaHora(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function plazoVencido(s: SolicitudMarketingItem) {
  if (!s.fechaEntrega || s.estado === "completado" || s.estado === "rechazado") return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return new Date(`${s.fechaEntrega}T00:00:00`) < hoy;
}

// ==================================================================================
// Hilo de conversación de la solicitud
// ==================================================================================
export function SolicitudChat({ solicitudId, titulo }: { solicitudId: string; titulo?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const finRef = useRef<HTMLDivElement | null>(null);

  const { data: mensajes = [], isLoading } = useQuery<MensajeSolicitud[]>({
    queryKey: ["/api/marketing/solicitudes", solicitudId, "mensajes"],
    // El hilo es conversación en vivo: a diferencia del resto de la app (staleTime
    // infinito) conviene refrescarlo mientras la ficha está abierta.
    refetchInterval: 15000,
    staleTime: 0,
  });

  const enviar = useMutation({
    mutationFn: async (nota: string) =>
      apiRequest(`/api/marketing/solicitudes/${solicitudId}/mensajes`, { method: "POST", data: { nota } }),
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/solicitudes", solicitudId, "mensajes"] });
    },
    onError: (e: any) =>
      toast({ title: "No se pudo enviar", description: e.message || "Intenta de nuevo.", variant: "destructive" }),
  });

  // Al llegar mensajes nuevos, el hilo se mantiene abajo (comportamiento de chat).
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const submit = () => {
    const nota = texto.trim();
    if (!nota || enviar.isPending) return;
    enviar.mutate(nota);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-orange-50 text-[#fd6301] dark:bg-orange-500/10">
          <MessageSquare className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Conversación</p>
          <p className="text-[11px] text-slate-400 truncate">
            {titulo ? `Sobre "${titulo}"` : "Marketing y el solicitante ven el mismo hilo"}
          </p>
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
            <p className="text-xs text-slate-400 mt-1">Escribe el primero para coordinar con la otra parte.</p>
          </div>
        ) : (
          mensajes.map((m) => {
            const propio = String(m.autorId) === String(user?.id ?? "");
            return (
              <div key={m.id} className={`flex ${propio ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                  propio
                    ? "bg-[#fd6301] text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200"
                }`}>
                  {!propio && (
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{m.autorNombre}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.nota}</p>
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
          data-testid="input-mensaje-solicitud"
        />
        <Button
          onClick={submit}
          disabled={!texto.trim() || enviar.isPending}
          className="h-10 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shrink-0"
          data-testid="button-enviar-mensaje"
        >
          {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ==================================================================================
// Ficha completa: datos + acciones de estado + chat
// ==================================================================================
export function SolicitudDetalleDialog({
  solicitud,
  open,
  onOpenChange,
  canManage,
}: {
  solicitud: SolicitudMarketingItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [plazo, setPlazo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [modoRechazo, setModoRechazo] = useState(false);

  useEffect(() => {
    setPlazo(solicitud?.fechaEntrega || "");
    setMotivo("");
    setModoRechazo(false);
  }, [solicitud?.id, solicitud?.fechaEntrega]);

  const estadoMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, any> }) =>
      apiRequest(`/api/marketing/solicitudes/${id}/estado`, { method: "POST", data: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/solicitudes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tareas/init"] });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message || "No se pudo actualizar la solicitud.", variant: "destructive" }),
  });

  if (!solicitud) return null;

  const meta = ESTADO_META[solicitud.estado] || ESTADO_META.solicitado;
  const EstadoIcon = meta.icon;

  const cambiarEstado = (body: Record<string, any>, mensajeOk: string) =>
    estadoMutation.mutate(
      { id: solicitud.id, body },
      {
        onSuccess: () => {
          toast({ title: mensajeOk });
          setModoRechazo(false);
          setMotivo("");
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* z-[70]: el sidebar de la app es z-[60] y taparía el modal por defecto */}
      <DialogContent className="sm:max-w-[860px] z-[70] max-h-[90vh] overflow-y-auto" overlayClassName="z-[70]">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-left pr-6">
            <span className="min-w-0 break-words">{solicitud.titulo}</span>
            <Badge variant="outline" className={`text-[10px] font-semibold border shrink-0 inline-flex items-center gap-1 ${meta.badge}`}>
              <EstadoIcon className="h-3 w-3" /> {meta.label}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-left">
            Ficha de la solicitud y conversación con el solicitante.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Columna izquierda: datos + acciones */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3.5 space-y-2.5">
              {solicitud.descripcion && (
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{solicitud.descripcion}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {solicitud.urgencia && (
                  <Badge variant="outline" className={`text-[10px] font-semibold border ${URGENCIA_STYLES[solicitud.urgencia] || URGENCIA_STYLES.baja}`}>
                    URGENCIA {solicitud.urgencia.toUpperCase()}
                  </Badge>
                )}
                {solicitud.segmento && (
                  <Badge variant="outline" className="text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    {SEGMENTO_LABEL[solicitud.segmento] || solicitud.segmento}
                  </Badge>
                )}
                {plazoVencido(solicitud) && (
                  <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Plazo vencido
                  </Badge>
                )}
              </div>

              <div className="grid gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Solicitante: {solicitud.supervisorName || "—"}
                  {solicitud.solicitanteRol && ROL_LABEL[solicitud.solicitanteRol] ? ` · ${ROL_LABEL[solicitud.solicitanteRol]}` : ""}
                </span>
                {solicitud.clienteNombre && (
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Cliente: {solicitud.clienteNombre}</span>
                )}
                {solicitud.fechaSolicitud && (
                  <span className="inline-flex items-center gap-1.5"><Send className="h-3 w-3" /> Enviada: {formatFechaCorta(solicitud.fechaSolicitud)}</span>
                )}
                {solicitud.fechaEntrega && (
                  <span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-3 w-3" /> Plazo: {formatFechaCorta(solicitud.fechaEntrega)}</span>
                )}
                {solicitud.fechaCompletado && (
                  <span className="inline-flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Entregada: {formatFechaCorta(solicitud.fechaCompletado)}</span>
                )}
              </div>

              {solicitud.estado === "rechazado" && solicitud.motivoRechazo && (
                <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-xl px-2.5 py-1.5">
                  <span className="font-semibold">Motivo del rechazo:</span> {solicitud.motivoRechazo}
                </p>
              )}
            </div>

            {canManage ? (
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3.5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avance del trabajo</p>

                {modoRechazo ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">Motivo del rechazo *</Label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={3}
                      placeholder="Ej: No hay presupuesto este mes / falta información…"
                      className="rounded-2xl text-sm"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-2xl flex-1" onClick={() => { setModoRechazo(false); setMotivo(""); }}>
                        Cancelar
                      </Button>
                      <Button
                        className="rounded-2xl flex-1 bg-red-600 hover:bg-red-700 text-white"
                        disabled={!motivo.trim() || estadoMutation.isPending}
                        onClick={() => cambiarEstado({ estado: "rechazado", motivoRechazo: motivo.trim() }, "Solicitud rechazada")}
                      >
                        {estadoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar rechazo"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {solicitud.estado !== "completado" && solicitud.estado !== "rechazado" && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plazo de entrega</Label>
                        <Input type="date" value={plazo} onChange={(e) => setPlazo(e.target.value)} className="rounded-2xl h-9 text-sm" />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {solicitud.estado === "solicitado" && (
                        <Button
                          className="rounded-2xl flex-1 min-w-[150px] bg-[#fd6301] hover:bg-[#e35400] text-white font-semibold"
                          disabled={estadoMutation.isPending}
                          onClick={() => cambiarEstado({ estado: "en_proceso", fechaEntrega: plazo || undefined }, "Solicitud en progreso")}
                          data-testid="button-marcar-en-progreso"
                        >
                          <Play className="h-4 w-4 mr-1.5" /> Marcar en progreso
                        </Button>
                      )}

                      {solicitud.estado === "en_proceso" && (
                        <>
                          <Button
                            variant="outline"
                            className="rounded-2xl border-slate-200 dark:border-slate-700"
                            disabled={estadoMutation.isPending || plazo === (solicitud.fechaEntrega || "")}
                            onClick={() => cambiarEstado({ estado: "en_proceso", fechaEntrega: plazo || undefined }, "Plazo actualizado")}
                          >
                            <CalendarIcon className="h-4 w-4 mr-1.5" /> Guardar plazo
                          </Button>
                          <Button
                            className="rounded-2xl flex-1 min-w-[150px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            disabled={estadoMutation.isPending}
                            onClick={() => cambiarEstado({ estado: "completado" }, "Solicitud completada")}
                            data-testid="button-completar-solicitud"
                          >
                            <Check className="h-4 w-4 mr-1.5" /> Completar
                          </Button>
                        </>
                      )}

                      {(solicitud.estado === "completado" || solicitud.estado === "rechazado") && (
                        <Button
                          variant="outline"
                          className="rounded-2xl border-slate-200 dark:border-slate-700"
                          disabled={estadoMutation.isPending}
                          onClick={() => cambiarEstado({ estado: "en_proceso" }, "Solicitud reabierta")}
                        >
                          <Play className="h-4 w-4 mr-1.5" /> Reabrir
                        </Button>
                      )}

                      {solicitud.estado !== "rechazado" && (
                        <Button
                          variant="outline"
                          className="rounded-2xl border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:border-slate-700"
                          disabled={estadoMutation.isPending}
                          onClick={() => setModoRechazo(true)}
                        >
                          <XCircle className="h-4 w-4 mr-1.5" /> Rechazar
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3.5 text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Marketing gestiona el avance de esta solicitud. Usa el chat para coordinar.
              </div>
            )}
          </div>

          {/* Columna derecha: chat */}
          <div className="flex flex-col min-h-[380px] lg:h-[440px]">
            <SolicitudChat solicitudId={solicitud.id} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
