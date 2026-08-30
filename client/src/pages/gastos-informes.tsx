/**
 * Informes de rendición — pestaña del módulo Rendición de Gastos.
 *
 * Portado de primerosresultados/rendicion-gastos (client/src/pages/informes-page.tsx)
 * y reescrito con shadcn/ui y los tokens de Panorámica (naranja #fd6301).
 *
 * Un informe agrupa gastos pendientes del colaborador para enviarlos a
 * aprobación de una sola vez: borrador → enviado → aprobado → pagado.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  RotateCcw,
  Send,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HistorialEstados } from "@/components/gastos/historial-estados";
import { EstadoChip, EstadoVacio, Monto } from "@/components/gastos/ui";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type EstadoInforme = "borrador" | "enviado" | "aprobado" | "rechazado" | "pagado";

interface InformeResumen {
  id: string;
  titulo: string;
  periodo: string;
  estado: EstadoInforme;
  observaciones: string | null;
  motivoRechazo: string | null;
  fechaEnvio: string | null;
  fechaAprobacion: string | null;
  fechaPago: string | null;
  createdAt: string;
  total: string;
  cantidadGastos: number;
  usuario: { id: string; nombre: string };
}

interface GastoDeInforme {
  id: string;
  monto: string;
  descripcion: string;
  categoria: string | null;
  centroCostos: string | null;
  proyecto: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  proveedor: string | null;
  fechaEmision: string | null;
  archivoUrl: string | null;
  estado: string;
  fundingMode: string | null;
  userId: string;
}

interface InformeDetalle extends InformeResumen {
  gastos: GastoDeInforme[];
  historial: any[];
  comentarioAprobacion: string | null;
}

// ─── Presentación de estados ────────────────────────────────────────────────

/** Alias del chip compartido: los estados del informe ya viven en el kit. */
const EstadoBadge = ({ estado }: { estado: EstadoInforme }) => (
  <EstadoChip estado={estado} />
);

// ─── Formato ────────────────────────────────────────────────────────────────

const plata = (v: string | number | null | undefined) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(v ?? 0));

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-06" → "Junio 2026". */
function etiquetaPeriodo(periodo: string): string {
  const [anio, mes] = (periodo ?? "").split("-");
  const idx = Number(mes) - 1;
  return MESES[idx] ? `${MESES[idx]} ${anio}` : periodo;
}

/** Las fechas de emisión vienen como YYYY-MM-DD sin hora: anclamos a mediodía
 *  para que el offset de Chile no las corra un día hacia atrás. */
function fechaCorta(valor: string | null | undefined): string {
  if (!valor) return "—";
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(soloFecha ? `${valor}T12:00:00` : valor);
  return isNaN(d.getTime()) ? "—" : format(d, "d MMM yyyy", { locale: es });
}

const BOTON_NARANJA =
  "bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all rounded-2xl";

// ═══════════════════════════════════════════════════════════════════════════

export default function GastosInformes() {
  const { user } = useAuth();
  const { toast } = useToast();

  const esAprobador =
    !!user &&
    ["admin", "recursos_humanos", "supervisor", "encargado_area"].includes(user.role as string);

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [dialogoCrear, setDialogoCrear] = useState(false);
  const [dialogoRechazo, setDialogoRechazo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [gastosElegidos, setGastosElegidos] = useState<string[]>([]);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  // ─── Datos ───

  const informesQuery = useQuery<InformeResumen[]>({
    queryKey: ["/api/informes-rendicion"],
  });

  const disponiblesQuery = useQuery<GastoDeInforme[]>({
    queryKey: ["/api/informes-rendicion/gastos-disponibles"],
    enabled: dialogoCrear,
  });

  const detalleQuery = useQuery<InformeDetalle>({
    queryKey: [`/api/informes-rendicion/${seleccionadoId}`],
    enabled: !!seleccionadoId,
  });

  const disponibles = disponiblesQuery.data ?? [];
  const informes = informesQuery.data ?? [];
  const detalle = detalleQuery.data;

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/informes-rendicion"] });
    queryClient.invalidateQueries({ queryKey: ["/api/informes-rendicion/gastos-disponibles"] });
    if (seleccionadoId) {
      queryClient.invalidateQueries({ queryKey: [`/api/informes-rendicion/${seleccionadoId}`] });
    }
    // Los gastos cambian de "sueltos" a "en informe": la pestaña Rendición
    // muestra ese vínculo.
    queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales"] });
  };

  // ─── Mutaciones ───

  const crearMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/informes-rendicion", {
        method: "POST",
        data: { titulo: titulo.trim(), observaciones: observaciones.trim() || undefined, gastoIds: gastosElegidos },
      });
      return res.json();
    },
    onSuccess: (informe: InformeResumen) => {
      toast({ title: "Informe creado", description: `«${informe.titulo}» quedó en borrador.` });
      setDialogoCrear(false);
      setTitulo("");
      setObservaciones("");
      setGastosElegidos([]);
      refrescar();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo crear el informe", description: e.message, variant: "destructive" }),
  });

  const transicionMut = useMutation({
    mutationFn: async ({ id, accion, cuerpo }: { id: string; accion: string; cuerpo?: any }) => {
      const res = await apiRequest(`/api/informes-rendicion/${id}/${accion}`, {
        method: "POST",
        data: cuerpo ?? {},
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const mensajes: Record<string, string> = {
        enviar: "Informe enviado a aprobación",
        aprobar: "Informe aprobado",
        rechazar: "Informe rechazado",
        pagar: "Informe marcado como pagado",
        reabrir: "Informe reabierto para corrección",
      };
      toast({ title: mensajes[variables.accion] ?? "Informe actualizado" });
      setDialogoRechazo(false);
      setMotivoRechazo("");
      refrescar();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo actualizar", description: e.message, variant: "destructive" }),
  });

  const quitarGastoMut = useMutation({
    mutationFn: async ({ informeId, gastoId }: { informeId: string; gastoId: string }) => {
      const res = await apiRequest(`/api/informes-rendicion/${informeId}/gastos/${gastoId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gasto quitado del informe" });
      refrescar();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo quitar el gasto", description: e.message, variant: "destructive" }),
  });

  const eliminarMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/informes-rendicion/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Informe eliminado", description: "Los gastos volvieron a quedar disponibles." });
      setSeleccionadoId(null);
      refrescar();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo eliminar", description: e.message, variant: "destructive" }),
  });

  // ─── Derivados ───

  const totalElegido = useMemo(
    () =>
      gastosElegidos.reduce((acc, id) => {
        const g = disponibles.find((d) => d.id === id);
        return acc + Number(g?.monto ?? 0);
      }, 0),
    [gastosElegidos, disponibles],
  );

  const alternarGasto = (id: string) =>
    setGastosElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const descargarPdf = (informe: InformeResumen) => {
    window.open(`/api/informes-rendicion/${informe.id}/pdf?incluirComprobantes=true`, "_blank");
  };

  // ═══════════════════════════════════════════════════════════════════════
  // Detalle
  // ═══════════════════════════════════════════════════════════════════════

  if (seleccionadoId) {
    if (detalleQuery.isLoading || !detalle) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      );
    }

    const esDueno = detalle.usuario.id === user?.id;
    const puedeEditar = detalle.estado === "borrador" && (esDueno || esAprobador);
    const enTransicion = transicionMut.isPending;

    return (
      <div className="space-y-5">
        {/* Cabecera */}
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl shrink-0"
            onClick={() => setSeleccionadoId(null)}
            aria-label="Volver a la lista de informes"
            data-testid="button-volver-informes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold text-slate-800 dark:text-slate-100">
              {detalle.titulo}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {etiquetaPeriodo(detalle.periodo)} · {detalle.cantidadGastos} gastos ·{" "}
              {detalle.usuario.nombre}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl shrink-0"
            onClick={() => descargarPdf(detalle)}
            data-testid="button-informe-pdf"
          >
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {plata(detalle.total)}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado</p>
              <div className="mt-2">
                <EstadoBadge estado={detalle.estado} />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Creado</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {fechaCorta(detalle.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Acciones de flujo */}
        <div className="flex flex-wrap gap-2">
          {detalle.estado === "borrador" && (esDueno || esAprobador) && (
            <Button
              className={BOTON_NARANJA}
              disabled={enTransicion || detalle.cantidadGastos === 0}
              onClick={() => transicionMut.mutate({ id: detalle.id, accion: "enviar" })}
              data-testid="button-enviar-informe"
            >
              {enTransicion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar a aprobación
            </Button>
          )}
          {esAprobador && detalle.estado === "enviado" && (
            <>
              <Button
                className={BOTON_NARANJA}
                disabled={enTransicion}
                onClick={() => transicionMut.mutate({ id: detalle.id, accion: "aprobar" })}
                data-testid="button-aprobar-informe"
              >
                <Check className="mr-2 h-4 w-4" />
                Aprobar
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                disabled={enTransicion}
                onClick={() => setDialogoRechazo(true)}
                data-testid="button-rechazar-informe"
              >
                <X className="mr-2 h-4 w-4" />
                Rechazar
              </Button>
            </>
          )}
          {esAprobador && detalle.estado === "aprobado" && (
            <Button
              className={BOTON_NARANJA}
              disabled={enTransicion}
              onClick={() => transicionMut.mutate({ id: detalle.id, accion: "pagar" })}
              data-testid="button-pagar-informe"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Marcar como pagado
            </Button>
          )}
          {detalle.estado === "rechazado" && (esDueno || esAprobador) && (
            <Button
              variant="outline"
              className="rounded-2xl"
              disabled={enTransicion}
              onClick={() => transicionMut.mutate({ id: detalle.id, accion: "reabrir" })}
              data-testid="button-reabrir-informe"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reabrir para corregir
            </Button>
          )}
          {puedeEditar && (
            <Button
              variant="ghost"
              className="rounded-2xl text-slate-500 hover:text-red-600"
              disabled={eliminarMut.isPending}
              onClick={() => {
                if (confirm("¿Eliminar este informe? Los gastos quedarán disponibles de nuevo.")) {
                  eliminarMut.mutate(detalle.id);
                }
              }}
              data-testid="button-eliminar-informe"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>

        {detalle.estado === "rechazado" && detalle.motivoRechazo && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <span className="font-semibold">Motivo del rechazo:</span> {detalle.motivoRechazo}
          </div>
        )}

        {detalle.observaciones && (
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <span className="font-semibold">Observaciones:</span> {detalle.observaciones}
          </div>
        )}

        {/* Gastos del informe */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/70 dark:border-slate-700">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  {puedeEditar && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.gastos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={puedeEditar ? 6 : 5} className="py-10 text-center text-sm text-slate-500">
                      Este informe no tiene gastos.
                    </TableCell>
                  </TableRow>
                ) : (
                  detalle.gastos.map((g) => (
                    <TableRow key={g.id} data-testid={`row-gasto-informe-${g.id}`}>
                      <TableCell className="whitespace-nowrap tabular-nums text-slate-500">
                        {fechaCorta(g.fechaEmision)}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate font-medium text-slate-800 dark:text-slate-100">
                        {g.descripcion}
                      </TableCell>
                      <TableCell>
                        {g.categoria ? (
                          <Badge variant="outline" className="text-[11px]">{g.categoria}</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-500">
                        {[g.tipoDocumento, g.numeroDocumento].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                        {plata(g.monto)}
                      </TableCell>
                      {puedeEditar && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600"
                            aria-label={`Quitar «${g.descripcion}» del informe`}
                            disabled={quitarGastoMut.isPending}
                            onClick={() =>
                              quitarGastoMut.mutate({ informeId: detalle.id, gastoId: g.id })
                            }
                            data-testid={`button-quitar-gasto-${g.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Timeline */}
        <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-bold text-slate-800 dark:text-slate-100">Historial</h3>
            <HistorialEstados
              entidad="informe"
              entidadId={detalle.id}
              entradas={detalle.historial}
            />
          </CardContent>
        </Card>

        {/* Diálogo de rechazo */}
        <Dialog open={dialogoRechazo} onOpenChange={setDialogoRechazo}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Rechazar informe</DialogTitle>
              <DialogDescription>
                Indica el motivo. Se le notificará a {detalle.usuario.nombre}.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="motivo-rechazo">Motivo</Label>
              <Textarea
                id="motivo-rechazo"
                className="mt-1.5"
                rows={3}
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Falta el respaldo del gasto de combustible…"
                data-testid="textarea-motivo-rechazo"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-2xl" onClick={() => setDialogoRechazo(false)}>
                Cancelar
              </Button>
              <Button
                className="rounded-2xl bg-red-600 text-white hover:bg-red-700"
                disabled={!motivoRechazo.trim() || transicionMut.isPending}
                onClick={() =>
                  transicionMut.mutate({
                    id: detalle.id,
                    accion: "rechazar",
                    cuerpo: { motivoRechazo: motivoRechazo.trim() },
                  })
                }
                data-testid="button-confirmar-rechazo"
              >
                Rechazar informe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Listado
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Informes de rendición
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Agrupa tus gastos en un informe y envíalo a aprobación de una sola vez
          </p>
        </div>
        <Button
          className={BOTON_NARANJA}
          onClick={() => setDialogoCrear(true)}
          data-testid="button-nuevo-informe"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo informe
        </Button>
      </div>

      {informesQuery.isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : informesQuery.isError ? (
        <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No se pudieron cargar los informes
            </p>
            <p className="text-xs text-slate-500">{(informesQuery.error as Error).message}</p>
            <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => informesQuery.refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : informes.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-slate-300 dark:border-slate-700">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fd6301] shadow-md shadow-[#fd6301]/25">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sin informes</p>
            <p className="max-w-sm text-xs text-slate-500">
              Cuando agrupes gastos pendientes en un informe, aparecerán acá para seguir su
              aprobación.
            </p>
            <Button className={BOTON_NARANJA} size="sm" onClick={() => setDialogoCrear(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo informe
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {informes.map((informe) => (
            <li key={informe.id}>
              <button
                type="button"
                onClick={() => setSeleccionadoId(informe.id)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200/70 bg-white p-4 text-left shadow-sm transition-all hover:border-orange-200 hover:shadow dark:border-slate-700 dark:bg-slate-900"
                data-testid={`card-informe-${informe.id}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fd6301] shadow-md shadow-[#fd6301]/25">
                  <FileText className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0 flex-1 basis-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {informe.titulo}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {etiquetaPeriodo(informe.periodo)} · {informe.cantidadGastos} gastos
                    {esAprobador && ` · ${informe.usuario.nombre}`}
                  </p>
                </div>
                {/* En móvil el monto y el estado bajan a su propia fila: en línea
                    con el título, el chip largo ("EN APROBACIÓN") lo truncaba. */}
                <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 sm:w-auto sm:flex-col sm:items-end sm:gap-1.5 sm:border-0 sm:pt-0 dark:border-slate-800">
                  <Monto value={informe.total} className="text-sm font-bold text-slate-800 dark:text-slate-100" />
                  <EstadoBadge estado={informe.estado} />
                </div>
                {/* El chevron es decorativo: en móvil roba ancho al título. */}
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Diálogo: armar informe */}
      <Dialog open={dialogoCrear} onOpenChange={setDialogoCrear}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo informe</DialogTitle>
            <DialogDescription>
              Agrupa tus gastos pendientes en un solo informe para enviarlo a aprobación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo-informe">Título</Label>
              <Input
                id="titulo-informe"
                className="mt-1.5"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={`Rendición ${etiquetaPeriodo(new Date().toISOString().slice(0, 7)).toLowerCase()}`}
                data-testid="input-titulo-informe"
              />
            </div>

            <div>
              <Label htmlFor="obs-informe">Observaciones (opcional)</Label>
              <Textarea
                id="obs-informe"
                className="mt-1.5"
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Viaje a Temuco, semana del 8 al 12…"
                data-testid="textarea-obs-informe"
              />
            </div>

            <div>
              <Label className="mb-2 block">Gastos disponibles ({disponibles.length})</Label>
              <ul className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200/70 dark:border-slate-700">
                {disponiblesQuery.isLoading ? (
                  <li className="space-y-2 p-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </li>
                ) : disponibles.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-slate-500">
                    No tienes gastos pendientes sin informe.
                  </li>
                ) : (
                  disponibles.map((g) => (
                    <li key={g.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          checked={gastosElegidos.includes(g.id)}
                          onChange={() => alternarGasto(g.id)}
                          className="h-4 w-4 accent-[#fd6301]"
                          data-testid={`checkbox-gasto-${g.id}`}
                        />
                        <ReceiptText className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            {g.descripcion}
                          </p>
                          <p className="text-xs text-slate-500">
                            {fechaCorta(g.fechaEmision)} · {g.categoria ?? "Sin categoría"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {plata(g.monto)}
                        </span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
              {gastosElegidos.length > 0 && (
                <p className="mt-2 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">
                  {gastosElegidos.length} seleccionados ·{" "}
                  <span className="font-bold">{plata(totalElegido)}</span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogoCrear(false)}>
              Cancelar
            </Button>
            <Button
              className={BOTON_NARANJA}
              disabled={crearMut.isPending || !titulo.trim() || gastosElegidos.length === 0}
              onClick={() => crearMut.mutate()}
              data-testid="button-crear-informe"
            >
              {crearMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear informe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
