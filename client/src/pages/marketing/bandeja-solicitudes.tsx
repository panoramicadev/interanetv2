// ==================================================================================
// Bandeja de solicitudes de Marketing.
//
// Es el triage de los pedidos que llegan desde el resto de la empresa, y el único
// lugar donde se gestionan: antes esta misma bandeja vivía duplicada dentro del
// Panel de Trabajo (MarketingManagerPanel) con una UX distinta a la del módulo, y
// nadie sabía cuál era la buena. Acá quedó una sola, con el flujo completo —
// aceptar fijando plazo, rechazar con motivo, completar, reabrir— y el chat hacia
// el solicitante en la ficha.
//
// Las secciones son estados, no filtros sueltos: se trabaja de izquierda a derecha
// (lo que espera respuesta primero) y cada una ordena por lo que importa en esa
// etapa —urgencia en Pendientes, plazo en En curso, fecha en las cerradas.
// ==================================================================================
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Check,
  CheckCircle,
  Flame,
  Inbox,
  Loader2,
  MessageSquare,
  Play,
  RotateCcw,
  Search,
  Send,
  User,
  XCircle,
} from "lucide-react";
import {
  ROL_LABEL,
  SolicitudDetalleDialog,
  URGENCIA_STYLES,
  formatFechaCorta,
  plazoVencido,
  type SolicitudMarketingItem,
} from "@/components/marketing/solicitud-detalle-dialog";

type Seccion = "pendientes" | "en_curso" | "completadas" | "rechazadas";

const URGENCIA_ORDEN: Record<string, number> = { alta: 0, media: 1, baja: 2 };

export default function BandejaSolicitudes({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [seccion, setSeccion] = useState<Seccion>("pendientes");
  const [urgencia, setUrgencia] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  // Se guarda el id y no el objeto: así la ficha abierta refleja el estado recién
  // guardado en vez de un snapshot viejo de la lista.
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [aceptar, setAceptar] = useState<SolicitudMarketingItem | null>(null);
  const [rechazar, setRechazar] = useState<SolicitudMarketingItem | null>(null);
  const [plazo, setPlazo] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudMarketingItem[]>({
    queryKey: ["/api/marketing/solicitudes"],
  });

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

  const ts = (s: SolicitudMarketingItem) => new Date(s.fechaSolicitud || 0).getTime();

  const grupos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const visible = solicitudes
      .filter((s) => (urgencia === "todas" ? true : (s.urgencia || "baja") === urgencia))
      .filter((s) =>
        !texto
          ? true
          : [s.titulo, s.descripcion, s.supervisorName, s.clienteNombre]
              .filter(Boolean)
              .some((campo) => String(campo).toLowerCase().includes(texto)),
      );

    return {
      // Pendientes: las urgentes primero (triage); a igual urgencia, la más antigua arriba.
      pendientes: visible
        .filter((s) => s.estado === "solicitado")
        .sort((a, b) => (URGENCIA_ORDEN[a.urgencia || "baja"] ?? 2) - (URGENCIA_ORDEN[b.urgencia || "baja"] ?? 2) || ts(a) - ts(b)),
      // En curso: el plazo más próximo arriba; sin plazo, al final.
      en_curso: visible
        .filter((s) => s.estado === "en_proceso")
        .sort((a, b) => (a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : Infinity) - (b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : Infinity)),
      completadas: visible
        .filter((s) => s.estado === "completado")
        .sort((a, b) => new Date(b.fechaCompletado || b.fechaSolicitud || 0).getTime() - new Date(a.fechaCompletado || a.fechaSolicitud || 0).getTime()),
      rechazadas: visible.filter((s) => s.estado === "rechazado").sort((a, b) => ts(b) - ts(a)),
    } as Record<Seccion, SolicitudMarketingItem[]>;
  }, [solicitudes, urgencia, busqueda]);

  const secciones: Array<{ key: Seccion; label: string; icon: any; valor: string; chip: string; vacio: string }> = [
    { key: "pendientes", label: "Por aceptar", icon: Send, valor: "text-[#fd6301]", chip: "bg-orange-50 text-[#fd6301] dark:bg-orange-500/10 dark:text-orange-400", vacio: "No hay solicitudes esperando tu respuesta." },
    { key: "en_curso", label: "En curso", icon: Play, valor: "text-amber-600", chip: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", vacio: "Nada en curso. Acepta una solicitud pendiente para empezar a trabajarla." },
    { key: "completadas", label: "Entregadas", icon: CheckCircle, valor: "text-emerald-600", chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400", vacio: "Todavía no hay entregas marcadas como completadas." },
    { key: "rechazadas", label: "Rechazadas", icon: XCircle, valor: "text-red-600", chip: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400", vacio: "No rechazaste ninguna solicitud." },
  ];
  const activa = secciones.find((x) => x.key === seccion)!;
  const items = grupos[seccion];

  const confirmarAceptar = () => {
    if (!aceptar) return;
    estadoMutation.mutate(
      { id: aceptar.id, body: { estado: "en_proceso", fechaEntrega: plazo || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Solicitud aceptada", description: "Pasó a tus solicitudes en curso." });
          setAceptar(null); setPlazo("");
        },
      },
    );
  };

  const confirmarRechazar = () => {
    if (!rechazar || !motivo.trim()) return;
    estadoMutation.mutate(
      { id: rechazar.id, body: { estado: "rechazado", motivoRechazo: motivo.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Solicitud rechazada", description: "Se notificó el motivo al solicitante." });
          setRechazar(null); setMotivo("");
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Sin banner de título: el encabezado de la página ya dice "Solicitudes". Las
          etapas del pedido son a la vez el selector de la lista. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {secciones.map((sec) => (
          <button
            key={sec.key}
            onClick={() => setSeccion(sec.key)}
            data-testid={`seccion-solicitudes-${sec.key}`}
            className={`rounded-2xl border bg-white dark:bg-slate-900 p-3.5 text-left transition-all ${
              seccion === sec.key
                ? "border-orange-300 ring-1 ring-orange-200 dark:border-orange-700 dark:ring-orange-900 shadow-md"
                : "border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:border-orange-200"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-lg ${sec.chip}`}>
                <sec.icon className="h-3 w-3" />
              </span>
              {sec.label}
            </div>
            <div className={`text-2xl font-bold leading-none tabular-nums ${grupos[sec.key].length > 0 ? sec.valor : "text-slate-300 dark:text-slate-600"}`}>
              {grupos[sec.key].length}
            </div>
          </button>
        ))}
      </div>

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
          {items.length} {items.length === 1 ? "solicitud" : "solicitudes"}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando solicitudes...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${activa.chip}`}>
            <activa.icon className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {busqueda.trim() || urgencia !== "todas"
              ? "Ninguna solicitud de esta sección coincide con los filtros."
              : activa.vacio}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((s) => (
            <div
              key={s.id}
              onClick={() => setDetalleId(s.id)}
              data-testid={`card-solicitud-${s.id}`}
              className={`rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 p-3.5 shadow-sm cursor-pointer hover:shadow-md hover:border-orange-200 transition-all ${
                seccion === "completadas" || seccion === "rechazadas" ? "opacity-90" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{s.titulo}</span>
                    {(seccion === "pendientes" || seccion === "en_curso") && s.urgencia && (
                      <Badge variant="outline" className={`text-[10px] font-semibold border ${URGENCIA_STYLES[s.urgencia] || URGENCIA_STYLES.baja}`}>
                        {s.urgencia.toUpperCase()}
                      </Badge>
                    )}
                    {seccion === "completadas" && (
                      <Badge variant="outline" className="text-[10px] font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Entregada{s.fechaCompletado ? `: ${formatFechaCorta(s.fechaCompletado)}` : ""}
                      </Badge>
                    )}
                    {seccion === "rechazadas" && (
                      <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Rechazada
                      </Badge>
                    )}
                    {seccion === "en_curso" && s.fechaEntrega && (
                      plazoVencido(s) ? (
                        <Badge variant="outline" className="text-[10px] font-semibold border bg-red-100 text-red-700 border-red-200 inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Plazo vencido: {formatFechaCorta(s.fechaEntrega)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 inline-flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" /> Plazo: {formatFechaCorta(s.fechaEntrega)}
                        </Badge>
                      )
                    )}
                  </div>
                  {s.descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.descripcion}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {s.supervisorName || "—"}
                      {s.solicitanteRol && ROL_LABEL[s.solicitanteRol] ? ` · ${ROL_LABEL[s.solicitanteRol]}` : ""}
                    </span>
                    {s.clienteNombre && (
                      <span className="inline-flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> {s.clienteNombre}</span>
                    )}
                    {s.fechaSolicitud && (
                      <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> Enviada: {formatFechaCorta(s.fechaSolicitud)}</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[#fd6301] font-semibold"><MessageSquare className="h-3 w-3" /> Abrir chat</span>
                  </div>
                  {seccion === "pendientes" && s.fechaEntrega && (
                    <p className="text-[11px] text-slate-400 mt-1 inline-flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" /> Fecha sugerida por el solicitante: {formatFechaCorta(s.fechaEntrega)}
                    </p>
                  )}
                  {seccion === "rechazadas" && s.motivoRechazo && (
                    <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-lg px-2.5 py-1.5 mt-2">
                      <span className="font-semibold">Motivo:</span> {s.motivoRechazo}
                    </p>
                  )}
                </div>

                {canManage && seccion === "en_curso" && (
                  <Button
                    size="sm"
                    className="h-8 rounded-2xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    disabled={estadoMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      estadoMutation.mutate({ id: s.id, body: { estado: "completado" } }, { onSuccess: () => toast({ title: "Solicitud completada", description: "Quedó registrada como entregada." }) });
                    }}
                    data-testid={`button-completar-${s.id}`}
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Completar
                  </Button>
                )}
                {/* Deshacer un "Completar" mal marcado: la devuelve a En curso con su plazo intacto. */}
                {canManage && seccion === "completadas" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-2xl text-xs font-semibold border-slate-200 text-slate-600 hover:border-orange-300 hover:text-[#fd6301] hover:bg-orange-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-orange-950/30 shrink-0"
                    disabled={estadoMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      estadoMutation.mutate({ id: s.id, body: { estado: "en_proceso" } }, { onSuccess: () => toast({ title: "Solicitud reabierta", description: "Volvió a tus solicitudes en curso." }) });
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reabrir
                  </Button>
                )}
              </div>

              {canManage && seccion === "pendientes" && (
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    className="h-8 rounded-2xl text-xs font-semibold bg-[#fd6301] hover:bg-[#e35400] text-white flex-1"
                    onClick={(e) => { e.stopPropagation(); setAceptar(s); setPlazo(s.fechaEntrega || ""); }}
                    data-testid={`button-aceptar-${s.id}`}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Aceptar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-2xl text-xs font-semibold border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 flex-1"
                    onClick={(e) => { e.stopPropagation(); setRechazar(s); setMotivo(""); }}
                    data-testid={`button-rechazar-${s.id}`}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Rechazar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ficha de la solicitud + chat con el solicitante */}
      <SolicitudDetalleDialog
        solicitud={solicitudes.find((s) => s.id === detalleId) ?? null}
        open={!!detalleId}
        onOpenChange={(o) => { if (!o) setDetalleId(null); }}
        canManage={canManage}
      />

      {/* Aceptar + fijar plazo */}
      <Dialog open={!!aceptar} onOpenChange={(o) => { if (!o) { setAceptar(null); setPlazo(""); } }}>
        <DialogContent className="sm:max-w-[440px] z-[70]" overlayClassName="z-[70]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-[#fd6301]" /> Aceptar solicitud</DialogTitle>
            <DialogDescription>Define el plazo final para "{aceptar?.titulo}". Pasará a tus solicitudes en curso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha límite</Label>
            <Input type="date" value={plazo} onChange={(e) => setPlazo(e.target.value)} className="rounded-2xl" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => { setAceptar(null); setPlazo(""); }}>Cancelar</Button>
            <Button className="rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white" disabled={estadoMutation.isPending} onClick={confirmarAceptar}>
              {estadoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar y agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechazar + motivo */}
      <Dialog open={!!rechazar} onOpenChange={(o) => { if (!o) { setRechazar(null); setMotivo(""); } }}>
        <DialogContent className="sm:max-w-[440px] z-[70]" overlayClassName="z-[70]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" /> Rechazar solicitud</DialogTitle>
            <DialogDescription>Indica por qué rechazas "{rechazar?.titulo}". El solicitante verá el motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motivo del rechazo *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ej: No hay presupuesto este mes / falta información…" className="rounded-2xl" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => { setRechazar(null); setMotivo(""); }}>Cancelar</Button>
            <Button variant="destructive" className="rounded-2xl" disabled={!motivo.trim() || estadoMutation.isPending} onClick={confirmarRechazar}>
              {estadoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
