/**
 * Remuneraciones — Talana cruzado con la intranet
 * ---------------------------------------------------------------
 * La pantalla responde una sola pregunta antes de cerrar el mes: **¿lo que
 * Talana va a pagar coincide con lo que la intranet calculó?**. Por eso el
 * primer contenido no es la planilla completa sino los descuadres; la planilla
 * está para revisar persona por persona y la pestaña de vínculos para arreglar
 * la causa de fondo cuando algo no calza.
 *
 * Backend: server/routes-remuneraciones.ts (permiso `rrhh.remuneraciones`).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCLP } from "@/lib/crm-seguimiento";
import { ICONO_CHIP_SM, ICONO_CHIP_ICONO_SM } from "@/lib/icono-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wallet, CalendarDays, Users, AlertTriangle, Link2, Download, RefreshCw,
  Banknote, CalendarCheck, Building2, Search, X, Check, EyeOff, RotateCcw,
  type LucideIcon,
} from "lucide-react";

// ─── Tipos (espejo de server/routes-remuneraciones.ts) ───

interface Periodo {
  id: number; desde: string; hasta: string; mes: number; ano: number; cerrado: boolean;
}

type EstadoVinculo = "confirmado" | "automatico" | "sin_vinculo" | "ignorado";

interface FilaCruce {
  talanaEmpleadoId: number;
  rut: string;
  nombre: string;
  cargo: string | null;
  centroCosto: string | null;
  sucursal: string | null;
  contratoActivo: boolean;
  diasTrabajados: number | null;
  fuenteDias: "liquidacion" | "workedDays" | null;
  diasAusencia: number;
  diasLicencia: number;
  sueldoBase: number;
  haberes: number;
  descuentos: number;
  liquido: number;
  costoEmpresa: number;
  anticipo: number;
  atrasos: number;
  comisionTalana: number;
  estadoLiquidacion: string | null;
  userId: string | null;
  userNombre: string | null;
  salespersonName: string | null;
  comisionIntranet: number | null;
  diferenciaComision: number | null;
  reembolsosAprobados: number;
  reembolsosCantidad: number;
  estadoVinculo: EstadoVinculo;
}

interface Alerta {
  tipo: string; nombre: string; detalle: string; monto?: number; talanaEmpleadoId?: number;
}

interface Totales {
  personas: number; conLiquidacion: number; haberes: number; descuentos: number;
  liquido: number; costoEmpresa: number; comisionTalana: number;
  comisionIntranet: number; reembolsos: number; diasTrabajados: number;
}

interface Cruce {
  talana: { ok: boolean; error?: string };
  periodo: Periodo | null;
  filas: FilaCruce[];
  totales: Totales | null;
  alertas: Alerta[];
  vendedoresSinLiquidacion: { salesperson: string; commissionAmount: number }[];
  comisionesError?: string | null;
  umbralDescuadre?: number;
}

interface Vinculo {
  talanaEmpleadoId: number; userId: string | null; salespersonName: string | null;
  confirmado: boolean; ignorado: boolean;
}
interface EmpleadoTalana {
  id: number; rut: string; nombre: string; cargo: string | null; activo: boolean;
  /** Lo que el servidor propone calzando por nombre (todavía sin confirmar). */
  sugerencia: { userId: string | null; salespersonName: string | null };
}
interface PersonaIntranet { id: string; nombre: string; email: string | null; role: string | null }
interface VinculosData {
  empleados: EmpleadoTalana[];
  personas: PersonaIntranet[];
  vendedores: string[];
  vinculos: Vinculo[];
  talanaError: string | null;
}

// ─── Helpers ───

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function etiquetaPeriodo(p: Periodo) {
  return `${MESES[p.mes - 1] ?? p.mes} ${p.ano}`;
}

const ETIQUETA_VINCULO: Record<EstadoVinculo, { texto: string; clase: string }> = {
  confirmado: {
    texto: "Confirmado",
    clase: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  automatico: {
    texto: "Automático",
    clase: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  },
  sin_vinculo: {
    texto: "Sin vínculo",
    clase: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  },
  ignorado: {
    texto: "Ignorado",
    clase: "border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  },
};

/** Orden en que se muestran los grupos de alertas: primero lo que mueve plata. */
const GRAVEDAD_ALERTA: Record<string, number> = {
  comision_descuadrada: 1,
  comision_no_pagada: 2,
  comision_sin_respaldo: 3,
  vendedor_sin_liquidacion: 4,
  sin_liquidacion: 5,
  sin_vinculo: 6,
};

/** Ítems que se muestran antes de plegar el resto de un grupo. */
const TOPE_ALERTAS_VISIBLES = 6;

const TITULO_ALERTA: Record<string, string> = {
  comision_descuadrada: "Comisión distinta a la calculada",
  comision_no_pagada: "Comisión calculada que Talana no paga",
  comision_sin_respaldo: "Comisión pagada sin respaldo en la intranet",
  sin_vinculo: "Persona de Talana sin vincular",
  vendedor_sin_liquidacion: "Vendedor sin liquidación en el período",
  sin_liquidacion: "Contrato vigente sin liquidación",
};

/** Explicación de cada columna: son cifras de sueldo, nadie debería adivinar de dónde salen. */
const COL_HELP: Record<string, string> = {
  "Días": "Días trabajados del período. En un mes ya liquidado sale de la liquidación; en el mes en curso, de los días vigentes que informa Talana.",
  "Sueldo base": "Sueldo base del contrato aplicado en la liquidación del período.",
  "Haberes": "Suma de haberes de la liquidación (imponibles y no imponibles).",
  "Descuentos": "Descuentos legales y adicionales de la liquidación.",
  "Líquido": "Lo que Talana transfiere: sueldo líquido de la liquidación.",
  "Comisión Talana": "Comisión pagada en la liquidación (ítems Comision1 + Comision2).",
  "Comisión intranet": "Comisión que calcula el módulo de Comisiones sobre el margen facturado del mismo período.",
  "Diferencia": "Comisión intranet − comisión Talana. En rojo cuando la intranet calculó más de lo que Talana paga.",
  "Reembolsos": "Gastos ya aprobados en Rendición de Gastos que se pagan junto con este sueldo (por fecha de aprobación).",
};

function ColHead({ children, className }: { children: string; className?: string }) {
  const help = COL_HELP[children];
  const base = `whitespace-nowrap align-bottom ${className ?? ""}`;
  if (!help) return <TableHead className={base}>{children}</TableHead>;
  return (
    <TableHead className={base}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-slate-400 dark:border-slate-500">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{help}</TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

/** "$-3.931.002" se lee mal: el signo va afuera, delante del monto. */
function montoConSigno(n: number): string {
  return n < 0 ? `− ${formatCLP(Math.abs(n))}` : formatCLP(n);
}

function KpiCard({ icon: Icon, label, value, sub, loading, accent = "neutro" }: {
  icon: LucideIcon; label: string; value: string; sub?: string;
  loading?: boolean; accent?: "neutro" | "destacada" | "alerta";
}) {
  const color = accent === "destacada" ? "text-[#fd6301]"
    : accent === "alerta" ? "text-red-600"
    : "text-slate-900 dark:text-white";
  return (
    <Card className="rounded-2xl shadow-sm border-slate-200/70 dark:border-slate-800 overflow-hidden">
      <CardContent className="px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 mb-2 min-w-0">
          <span className={ICONO_CHIP_SM}><Icon className={ICONO_CHIP_ICONO_SM} /></span>
          <p className="text-xs font-medium text-slate-500 leading-tight min-w-0">{label}</p>
        </div>
        {loading
          ? <Skeleton className="h-8 w-28" />
          : <p className={`text-base min-[400px]:text-lg sm:text-xl 2xl:text-2xl font-bold tabular-nums truncate ${color}`} title={value}>{value}</p>}
        {sub && !loading && <p className="text-[11px] text-slate-400 mt-1 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Pestañas ───
// Declaradas como datos para que el riel de escritorio y el desplegable de
// celular no se desincronicen (regla del sistema de diseño).
type TabId = "cruce" | "descuadres" | "vinculos";
const TABS: { value: TabId; label: string; Icon: LucideIcon }[] = [
  { value: "cruce", label: "Planilla del período", Icon: Users },
  { value: "descuadres", label: "Descuadres", Icon: AlertTriangle },
  { value: "vinculos", label: "Vínculos", Icon: Link2 },
];

export default function RemuneracionesPage() {
  const { toast } = useToast();
  const [periodoId, setPeriodoId] = useState<string>("");
  const [tab, setTab] = useState<TabId>("cruce");
  const [busqueda, setBusqueda] = useState("");

  const { data: periodosResp, isLoading: cargandoPeriodos } = useQuery<{ ok: boolean; periodos: Periodo[]; error?: string }>({
    queryKey: ["/api/rrhh/remuneraciones/periodos"],
    queryFn: async () => {
      const res = await fetch("/api/rrhh/remuneraciones/periodos", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudieron cargar los períodos de Talana");
      return res.json();
    },
  });

  const periodos = periodosResp?.periodos ?? [];
  const periodoActual = periodoId || (periodos[0] ? String(periodos[0].id) : "");

  const { data: cruce, isLoading: cargandoCruce, isFetching } = useQuery<Cruce>({
    queryKey: ["/api/rrhh/remuneraciones/cruce", periodoActual],
    enabled: !!periodoActual,
    queryFn: async () => {
      const res = await fetch(`/api/rrhh/remuneraciones/cruce?periodo=${periodoActual}`, { credentials: "include" });
      if (!res.ok) throw new Error("No se pudo cargar el cruce del período");
      return res.json();
    },
  });

  const refrescar = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/rrhh/remuneraciones/refrescar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/periodos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/cruce"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/vinculos"] });
      toast({ title: "Datos actualizados", description: "Se volvieron a leer los datos de Talana." });
    },
    onError: (e: any) => toast({ title: "No se pudo actualizar", description: e?.message, variant: "destructive" }),
  });

  const filas = cruce?.filas ?? [];
  const totales = cruce?.totales ?? null;
  const alertas = cruce?.alertas ?? [];
  const periodo = periodos.find((p) => String(p.id) === periodoActual) ?? cruce?.periodo ?? null;

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) =>
      f.nombre.toLowerCase().includes(q) ||
      f.rut.toLowerCase().includes(q) ||
      (f.cargo ?? "").toLowerCase().includes(q) ||
      (f.centroCosto ?? "").toLowerCase().includes(q));
  }, [filas, busqueda]);

  const diferenciaComisiones = (totales?.comisionIntranet ?? 0) - (totales?.comisionTalana ?? 0);
  const talanaCaido = cruce && cruce.talana && cruce.talana.ok === false;

  const descargarCsv = () => {
    if (!periodoActual) return;
    window.open(`/api/rrhh/remuneraciones/export.csv?periodo=${periodoActual}`, "_blank");
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4 md:p-6 max-w-[1500px] mx-auto space-y-5 md:space-y-6 bg-white dark:bg-slate-900">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/25">
              <Wallet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Remuneraciones</h1>
              <p className="text-sm text-muted-foreground hidden md:block">
                Días trabajados y liquidaciones de Talana cruzados con las comisiones y los reembolsos de la intranet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm" onClick={() => refrescar.mutate()}
              disabled={refrescar.isPending}
              className="rounded-2xl border-slate-200 hover:border-orange-200 hover:text-[#fd6301]">
              <RefreshCw className={`w-4 h-4 mr-2 ${refrescar.isPending || isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              variant="outline" size="sm" onClick={descargarCsv} disabled={!filas.length}
              className="rounded-2xl border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/40">
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* Aviso: Talana no responde */}
        {talanaCaido && (
          <Card className="rounded-2xl border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-rose-800 dark:text-rose-300">No se pudo leer Talana</p>
                <p className="text-rose-700/90 dark:text-rose-300/80">{cruce?.talana?.error}</p>
                <p className="text-rose-700/70 dark:text-rose-300/60 mt-1">
                  El módulo necesita la variable de entorno <code className="font-mono">TALANA_API_TOKEN</code> con
                  el token de la cuenta de integración.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aviso: comisiones no disponibles */}
        {cruce?.comisionesError && (
          <Card className="rounded-2xl border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
            <CardContent className="py-3 flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-800 dark:text-amber-300">
                El cruce se muestra sin la comisión calculada por la intranet: {cruce.comisionesError}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Período */}
        <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-3 py-2 shadow-sm hover:border-orange-200 hover:shadow transition-all">
                <div className="flex items-center justify-center w-9 h-9 text-[#fd6301] dark:text-orange-400 flex-shrink-0">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Período</span>
                  <Select value={periodoActual} onValueChange={setPeriodoId} disabled={!periodos.length}>
                    <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto min-w-[9rem] bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60">
                      <SelectValue placeholder={cargandoPeriodos ? "Cargando…" : "Sin períodos"} />
                    </SelectTrigger>
                    <SelectContent>
                      {periodos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {etiquetaPeriodo(p)}{p.cerrado ? "" : " · abierto"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {periodo && (
                <Badge variant="outline" className={periodo.cerrado
                  ? "rounded-full border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "rounded-full border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"}>
                  {periodo.cerrado ? "Mes cerrado en Talana" : "Mes abierto: las cifras pueden cambiar"}
                </Badge>
              )}
              {periodo && (
                <span className="text-xs text-slate-500 tabular-nums">
                  {periodo.desde} a {periodo.hasta}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard icon={Users} label="Personas del período" loading={cargandoCruce}
            value={String(totales?.personas ?? 0)}
            sub={totales ? `${totales.conLiquidacion} con liquidación` : undefined} />
          <KpiCard icon={CalendarCheck} label="Días trabajados (promedio)" loading={cargandoCruce}
            value={totales && totales.personas ? (totales.diasTrabajados / totales.personas).toFixed(1) : "—"} />
          <KpiCard icon={Banknote} label="Líquido a pagar" loading={cargandoCruce}
            value={formatCLP(totales?.liquido)}
            sub={totales ? `Costo empresa ${formatCLP(totales.costoEmpresa)}` : undefined} />
          <KpiCard icon={Wallet} label="Comisiones en Talana" loading={cargandoCruce}
            value={formatCLP(totales?.comisionTalana)}
            sub={totales ? `Intranet calculó ${formatCLP(totales.comisionIntranet)}` : undefined} />
          <div className="col-span-2 lg:col-span-1">
            <KpiCard icon={AlertTriangle} label="Descuadre de comisiones" loading={cargandoCruce}
              value={montoConSigno(diferenciaComisiones)}
              accent={Math.abs(diferenciaComisiones) >= (cruce?.umbralDescuadre ?? 1000) ? "alerta" : "neutro"}
              sub={`${alertas.length} ${alertas.length === 1 ? "alerta" : "alertas"} en el período`} />
          </div>
        </div>

        {/* Riel de pestañas (escritorio) */}
        <div className="hidden sm:flex gap-1.5 border-b border-slate-200 dark:border-slate-800">
          {TABS.map(({ value, label, Icon }) => {
            const activa = tab === value;
            const contador = value === "descuadres" ? alertas.length : undefined;
            return (
              <button key={value} type="button" onClick={() => setTab(value)}
                className={`group inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activa
                    ? "font-semibold text-[#0a0a0a] border-[#0a0a0a] dark:text-white dark:border-slate-100"
                    : "text-[#0a0a0a]/70 border-transparent hover:text-[#fd6301] dark:text-slate-300 dark:hover:text-white"}`}>
                <Icon className="w-4 h-4" /> {label}
                {contador ? (
                  <span className="rounded-full bg-[#fd6301] text-white text-[11px] font-semibold px-1.5 py-0.5 tabular-nums">{contador}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Selector de sección (celular) */}
        <div className="sm:hidden flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-3 py-2 shadow-sm">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-[#fd6301] dark:bg-orange-950/40 flex-shrink-0">
            <Users className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none w-full">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Sección</span>
            <Select value={tab} onValueChange={(v) => setTab(v as TabId)}>
              <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}{t.value === "descuadres" && alertas.length ? ` (${alertas.length})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {tab === "cruce" && (
          <PlanillaPeriodo
            filas={filasFiltradas}
            totalFilas={filas.length}
            loading={cargandoCruce}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            umbral={cruce?.umbralDescuadre ?? 1000}
          />
        )}

        {tab === "descuadres" && (
          <Descuadres alertas={alertas} loading={cargandoCruce} onIrAVinculos={() => setTab("vinculos")} />
        )}

        {tab === "vinculos" && <Vinculos />}
      </div>
    </TooltipProvider>
  );
}

// ─── Planilla del período ───

function PlanillaPeriodo({ filas, totalFilas, loading, busqueda, setBusqueda, umbral }: {
  filas: FilaCruce[]; totalFilas: number; loading: boolean;
  busqueda: string; setBusqueda: (v: string) => void; umbral: number;
}) {
  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-[#fd6301]" />
            Planilla del período
            <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60 tabular-nums">
              {filas.length}{busqueda ? ` de ${totalFilas}` : ""}
            </span>
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, RUT, cargo o centro de costo…"
              className="h-9 pl-8 pr-8 rounded-xl" />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} title="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 sm:px-2">
        {loading && <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>}

        {/* Escritorio: la tabla completa */}
        {!loading && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap align-bottom">Persona</TableHead>
                  <TableHead className="whitespace-nowrap align-bottom">Cargo</TableHead>
                  <ColHead className="text-right">Días</ColHead>
                  <ColHead className="text-right">Sueldo base</ColHead>
                  <ColHead className="text-right">Haberes</ColHead>
                  <ColHead className="text-right">Descuentos</ColHead>
                  <ColHead className="text-right">Líquido</ColHead>
                  <ColHead className="text-right">Comisión Talana</ColHead>
                  <ColHead className="text-right">Comisión intranet</ColHead>
                  <ColHead className="text-right">Diferencia</ColHead>
                  <ColHead className="text-right">Reembolsos</ColHead>
                  <TableHead className="whitespace-nowrap align-bottom">Vínculo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.talanaEmpleadoId} className="hover:bg-orange-50/50 dark:hover:bg-orange-950/15">
                    <TableCell className="font-medium">
                      <div className="flex flex-col leading-tight">
                        <span className="whitespace-nowrap">{f.nombre}</span>
                        <span className="text-xs text-slate-400 tabular-nums">{f.rut}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      <div className="flex flex-col leading-tight">
                        <span>{f.cargo ?? "—"}</span>
                        {f.centroCosto && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{f.centroCosto}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.diasTrabajados ?? "—"}
                      {f.fuenteDias === "workedDays" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 text-[10px] text-amber-600 cursor-help">·hoy</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            Días que van corriendo en el mes abierto (aún no hay liquidación).
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-slate-500">{formatCLP(f.sueldoBase)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCLP(f.haberes)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-slate-500">{formatCLP(f.descuentos)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap font-semibold">{formatCLP(f.liquido)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{f.comisionTalana ? formatCLP(f.comisionTalana) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {f.comisionIntranet === null
                        ? <span className="text-slate-300">—</span>
                        : formatCLP(f.comisionIntranet)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      <Diferencia valor={f.diferenciaComision} umbral={umbral} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-slate-500">
                      {f.reembolsosAprobados ? formatCLP(f.reembolsosAprobados) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <ChipVinculo fila={f} />
                    </TableCell>
                  </TableRow>
                ))}
                {!filas.length && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-slate-500 py-10">
                      {busqueda ? `Nadie coincide con "${busqueda}"` : "No hay personas en este período."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Celular: la tabla no entra, va como lista de tarjetas */}
        {!loading && (
          <div className="md:hidden space-y-2 px-3 pb-3">
            {filas.map((f) => (
              <div key={f.talanaEmpleadoId} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{f.nombre}</p>
                    <p className="text-xs text-slate-400 truncate">{f.cargo ?? f.rut}</p>
                  </div>
                  <ChipVinculo fila={f} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Días</p>
                    <p className="font-semibold tabular-nums">{f.diasTrabajados ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Líquido</p>
                    <p className="font-semibold tabular-nums">{formatCLP(f.liquido)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Comisión</p>
                    <p className="font-semibold tabular-nums">{formatCLP(f.comisionTalana)}</p>
                  </div>
                </div>
                {f.diferenciaComision !== null && Math.abs(f.diferenciaComision) >= umbral && (
                  <p className="mt-2 text-xs text-red-600">
                    Descuadre de comisión: <Diferencia valor={f.diferenciaComision} umbral={umbral} />
                  </p>
                )}
              </div>
            ))}
            {!filas.length && (
              <p className="text-center text-slate-500 py-8 text-sm">
                {busqueda ? `Nadie coincide con "${busqueda}"` : "No hay personas en este período."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Diferencia({ valor, umbral }: { valor: number | null; umbral: number }) {
  if (valor === null) return <span className="text-slate-300">—</span>;
  if (Math.abs(valor) < umbral) return <span className="text-slate-400">$0</span>;
  const color = valor > 0 ? "text-red-600" : "text-amber-600";
  return <span className={`font-semibold ${color}`}>{valor > 0 ? "+" : "−"} {formatCLP(Math.abs(valor))}</span>;
}

function ChipVinculo({ fila }: { fila: FilaCruce }) {
  const { texto, clase } = ETIQUETA_VINCULO[fila.estadoVinculo];
  const detalle = [fila.userNombre, fila.salespersonName].filter(Boolean).join(" · ");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`rounded-full text-[11px] whitespace-nowrap cursor-help ${clase}`}>{texto}</Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {detalle
          ? `Vinculado a ${detalle}`
          : "Sin persona de la intranet ni vendedor del ERP asociado. Asígnalo en la pestaña Vínculos."}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Descuadres ───

function Descuadres({ alertas, loading, onIrAVinculos }: {
  alertas: Alerta[]; loading: boolean; onIrAVinculos: () => void;
}) {
  const porTipo = useMemo<[string, Alerta[]][]>(() => {
    const m = new Map<string, Alerta[]>();
    for (const a of alertas) {
      const lista = m.get(a.tipo) ?? [];
      lista.push(a);
      m.set(a.tipo, lista);
    }
    // Primero la plata: un mes con 60 personas sin vincular no puede tapar las
    // tres comisiones que no cuadran, que es a lo que se entra a esta pestaña.
    return Array.from(m.entries()).sort(
      (a, b) => (GRAVEDAD_ALERTA[a[0]] ?? 99) - (GRAVEDAD_ALERTA[b[0]] ?? 99),
    );
  }, [alertas]);

  if (loading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  if (!alertas.length) {
    return (
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
        <CardContent className="py-10 text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 mb-3">
            <Check className="w-6 h-6" />
          </span>
          <p className="font-semibold text-slate-800 dark:text-slate-100">Sin descuadres</p>
          <p className="text-sm text-slate-500 mt-1">
            Lo que Talana va a pagar coincide con lo que calculó la intranet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {porTipo.map(([tipo, lista]) => (
        <GrupoAlertas key={tipo} tipo={tipo} lista={lista} onIrAVinculos={onIrAVinculos} />
      ))}
    </div>
  );
}

function GrupoAlertas({ tipo, lista, onIrAVinculos }: {
  tipo: string; lista: Alerta[]; onIrAVinculos: () => void;
}) {
  const [todas, setTodas] = useState(false);
  const visibles = todas ? lista : lista.slice(0, TOPE_ALERTAS_VISIBLES);
  const ocultas = lista.length - visibles.length;

  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#fd6301]" />
          {TITULO_ALERTA[tipo] ?? tipo}
          <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60 tabular-nums">
            {lista.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibles.map((a, i) => (
          <div key={`${a.nombre}-${i}`} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.nombre}</p>
              <p className="text-xs text-slate-500">{a.detalle}</p>
            </div>
            {a.monto !== undefined && (
              <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatCLP(a.monto)}</span>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {ocultas > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTodas(true)}
              className="rounded-2xl text-slate-500 hover:text-[#fd6301]">
              Ver las {ocultas} restantes
            </Button>
          )}
          {todas && lista.length > TOPE_ALERTAS_VISIBLES && (
            <Button variant="ghost" size="sm" onClick={() => setTodas(false)}
              className="rounded-2xl text-slate-500 hover:text-[#fd6301]">
              Mostrar menos
            </Button>
          )}
          {(tipo === "sin_vinculo" || tipo === "vendedor_sin_liquidacion" || tipo === "comision_sin_respaldo") && (
            <Button variant="outline" size="sm" onClick={onIrAVinculos}
              className="rounded-2xl border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/40">
              <Link2 className="w-4 h-4 mr-2" /> Arreglar en Vínculos
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Vínculos ───

const SIN_VALOR = "__ninguno__";

function Vinculos() {
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState("");

  const { data, isLoading } = useQuery<VinculosData>({
    queryKey: ["/api/rrhh/remuneraciones/vinculos"],
    queryFn: async () => {
      const res = await fetch("/api/rrhh/remuneraciones/vinculos", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudieron cargar los vínculos");
      return res.json();
    },
  });

  const guardar = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("PUT", "/api/rrhh/remuneraciones/vinculos", body);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "No se pudo guardar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/cruce"] });
      toast({ title: "Vínculo guardado" });
    },
    onError: (e: any) => toast({ title: "No se pudo guardar", description: e?.message, variant: "destructive" }),
  });

  const borrar = useMutation({
    mutationFn: async (talanaEmpleadoId: number) => {
      const res = await apiRequest("DELETE", `/api/rrhh/remuneraciones/vinculos/${talanaEmpleadoId}`);
      if (!res.ok) throw new Error("No se pudo borrar el vínculo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/vinculos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/cruce"] });
      toast({ title: "Vínculo borrado", description: "La persona vuelve al calce automático por nombre." });
    },
  });

  const empleados = data?.empleados ?? [];
  const vinculoPorEmpleado = useMemo(
    () => new Map((data?.vinculos ?? []).map((v) => [v.talanaEmpleadoId, v])),
    [data],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter((e) => e.nombre.toLowerCase().includes(q) || e.rut.includes(q));
  }, [empleados, busqueda]);

  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#fd6301]" /> Vínculos con la intranet
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Cada persona de Talana se conecta con su usuario de la intranet (de ahí salen los reembolsos)
              y con su nombre de vendedor en el ERP (de ahí sale la comisión calculada). El sistema propone
              el calce por nombre; guardarlo lo deja confirmado.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar persona…" className="h-9 pl-8 rounded-xl" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 sm:px-2">
        {isLoading && <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}

        {data?.talanaError && (
          <p className="px-4 pb-3 text-sm text-rose-600">No se pudo leer Talana: {data.talanaError}</p>
        )}

        {!isLoading && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap align-bottom">Persona en Talana</TableHead>
                  <TableHead className="whitespace-nowrap align-bottom">Usuario de la intranet</TableHead>
                  <TableHead className="whitespace-nowrap align-bottom">Vendedor en el ERP</TableHead>
                  <TableHead className="whitespace-nowrap align-bottom">Estado</TableHead>
                  <TableHead className="text-right whitespace-nowrap align-bottom">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((e) => {
                  const v = vinculoPorEmpleado.get(e.id);
                  // Sin fila guardada mandan las sugerencias del servidor: son
                  // las mismas que usa la planilla, así las dos pantallas dicen
                  // lo mismo de la misma persona.
                  const userId = v?.userId ?? (v ? null : e.sugerencia?.userId ?? null);
                  const vendedor = v?.salespersonName ?? (v ? null : e.sugerencia?.salespersonName ?? null);
                  const estado: EstadoVinculo = v?.ignorado
                    ? "ignorado"
                    : v?.confirmado
                      ? "confirmado"
                      : (userId || vendedor) ? "automatico" : "sin_vinculo";
                  return (
                    <TableRow key={e.id} className={v?.ignorado ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium whitespace-nowrap">{e.nombre}</span>
                          <span className="text-xs text-slate-400 tabular-nums">{e.rut}{e.cargo ? ` · ${e.cargo}` : ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={userId ?? SIN_VALOR}
                          onValueChange={(valor) => guardar.mutate({
                            talanaEmpleadoId: e.id, rut: e.rut, nombreTalana: e.nombre,
                            userId: valor === SIN_VALOR ? null : valor,
                            salespersonName: vendedor,
                            ignorado: false,
                          })}>
                          <SelectTrigger className="h-9 w-[15rem] rounded-xl"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SIN_VALOR}>Sin asignar</SelectItem>
                            {(data?.personas ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nombre || p.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={vendedor ?? SIN_VALOR}
                          onValueChange={(valor) => guardar.mutate({
                            talanaEmpleadoId: e.id, rut: e.rut, nombreTalana: e.nombre,
                            userId,
                            salespersonName: valor === SIN_VALOR ? null : valor,
                            ignorado: false,
                          })}>
                          <SelectTrigger className="h-9 w-[15rem] rounded-xl"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SIN_VALOR}>Sin asignar</SelectItem>
                            {(data?.vendedores ?? []).map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full text-[11px] ${ETIQUETA_VINCULO[estado].clase}`}>
                          {ETIQUETA_VINCULO[estado].texto}
                        </Badge>
                        {!e.activo && (
                          <Badge variant="outline" className="ml-1 rounded-full text-[11px] border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                            Sin contrato vigente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700"
                              onClick={() => guardar.mutate({
                                talanaEmpleadoId: e.id, rut: e.rut, nombreTalana: e.nombre,
                                userId: null, salespersonName: null, ignorado: true,
                              })}>
                              <EyeOff className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">No cruzar a esta persona (deja de aparecer en las alertas)</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-[#fd6301]"
                              onClick={() => borrar.mutate(e.id)} disabled={!v}
                              title="Borrar el vínculo guardado">
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Borrar el vínculo y volver al calce automático</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filtrados.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                      {busqueda ? `Nadie coincide con "${busqueda}"` : "Talana no devolvió personas."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
