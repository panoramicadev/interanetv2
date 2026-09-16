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
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Wallet, CalendarDays, Users, AlertTriangle, Link2, Download, RefreshCw, DollarSign,
  Banknote, CalendarCheck, Building2, Search, X, Check, EyeOff, RotateCcw,
  Columns3, Briefcase,
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
  liquidacionesDelPeriodo: number;
  tiposLiquidacion: string[];
  userId: string | null;
  userNombre: string | null;
  salespersonName: string | null;
  comisionIntranet: number | null;
  motivoSinComision: "sin_vendedor" | "sin_porcentaje" | null;
  diferenciaComision: number | null;
  reembolsosAprobados: number;
  reembolsosCantidad: number;
  estadoVinculo: EstadoVinculo;
  /** Todos los ítems de la liquidación (tipoItem → monto), para las columnas elegibles. */
  itemsTalana?: Record<string, number>;
}

/** Un ítem de liquidación que Talana informó este mes y se puede pedir como columna. */
interface ColumnaTalana {
  id: string;
  label: string;
  /** En cuántas personas viene con valor: ordena el catálogo y avisa lo que es anecdótico. */
  personas: number;
  tipo: "monto" | "dias";
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
  /** Vendedores del ERP marcados como "no es una persona" (mostradores, canales). */
  vendedoresIgnorados?: string[];
  columnasTalana?: ColumnaTalana[];
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
  comision_sin_porcentaje: 4,
  vendedor_sin_liquidacion: 5,
  sin_liquidacion: 6,
  sin_vinculo: 7,
};

/** Ítems que se muestran antes de plegar el resto de un grupo. */
const TOPE_ALERTAS_VISIBLES = 6;

const TITULO_ALERTA: Record<string, string> = {
  comision_descuadrada: "Comisión distinta a la calculada",
  comision_no_pagada: "Comisión calculada que Talana no paga",
  comision_sin_respaldo: "Comisión pagada sin respaldo en la intranet",
  comision_sin_porcentaje: "Comisión pagada y vendedor sin % configurado",
  sin_vinculo: "Persona de Talana sin vincular",
  vendedor_sin_liquidacion: "Vendedor sin liquidación en el período",
  sin_liquidacion: "Contrato vigente sin liquidación",
};

// ─── Columnas de la planilla ───
//
// Las columnas se declaran como datos y no como JSX suelto porque cada persona
// elige cuáles ve (se guardan en `remuneraciones_columnas`, por usuario) y
// porque a las propias del módulo se les suman los ítems que Talana informó
// ese mes: una liquidación trae del orden de 200 y ninguno estaba disponible.

interface ColumnaDef {
  id: string;
  /** Cabecera de la tabla y etiqueta en la tarjeta de celular. */
  label: string;
  /** De dónde sale la cifra: son sueldos, nadie debería adivinarlo. */
  help?: string;
  /** Las de plata van a la derecha; las de texto, a la izquierda. */
  derecha?: boolean;
  /** Entra en el set con el que abre quien nunca eligió columnas. */
  porDefecto?: boolean;
  /** No se puede sacar: sin ella la fila no se sabe de quién es. */
  fija?: boolean;
  celda: (f: FilaCruce, ctx: { umbral: number }) => ReactNode;
  /** Variante para la tarjeta de celular, donde todo se lee alineado a la izquierda. */
  celdaTarjeta?: (f: FilaCruce, ctx: { umbral: number }) => ReactNode;
}

const GUION = <span className="text-slate-300">—</span>;

const COLUMNAS_BASE: ColumnaDef[] = [
  {
    id: "persona", label: "Persona", fija: true, porDefecto: true,
    celda: (f) => (
      <div className="flex flex-col leading-tight">
        <span className="whitespace-nowrap flex items-center gap-1.5 font-medium">
          {f.nombre}
          <ChipFiniquito fila={f} />
        </span>
        <span className="text-xs text-slate-400 tabular-nums">{f.rut}</span>
      </div>
    ),
  },
  {
    id: "cargo", label: "Cargo", porDefecto: true,
    celda: (f) => (
      <div className="flex flex-col leading-tight text-sm text-slate-500">
        <span>{f.cargo ?? "—"}</span>
        {f.centroCosto && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Building2 className="w-3 h-3" />{f.centroCosto}
          </span>
        )}
      </div>
    ),
  },
  {
    id: "sucursal", label: "Sucursal",
    help: "Sucursal del contrato vigente en Talana.",
    celda: (f) => <span className="text-sm text-slate-500">{f.sucursal ?? "—"}</span>,
  },
  {
    id: "dias", label: "Días", derecha: true, porDefecto: true,
    help: "Días trabajados del período. En un mes ya liquidado sale de la liquidación; en el mes en curso, de los días vigentes que informa Talana.",
    celda: (f) => (
      <>
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
      </>
    ),
  },
  {
    id: "diasAusencia", label: "Días de ausencia", derecha: true,
    help: "Días de ausencia informados en la liquidación (ítem diasAusenciaItem).",
    celda: (f) => (f.diasAusencia ? f.diasAusencia : GUION),
  },
  {
    id: "diasLicencia", label: "Días de licencia", derecha: true,
    help: "Días de licencia médica informados en la liquidación (ítem diasLicenciaItem).",
    celda: (f) => (f.diasLicencia ? f.diasLicencia : GUION),
  },
  {
    id: "sueldoBase", label: "Sueldo base", derecha: true, porDefecto: true,
    help: "Sueldo base del contrato aplicado en la liquidación del período.",
    celda: (f) => <span className="text-slate-500">{formatCLP(f.sueldoBase)}</span>,
  },
  {
    id: "haberes", label: "Haberes", derecha: true, porDefecto: true,
    help: "Suma de haberes de la liquidación (imponibles y no imponibles).",
    celda: (f) => formatCLP(f.haberes),
  },
  {
    id: "descuentos", label: "Descuentos", derecha: true, porDefecto: true,
    help: "Descuentos legales y adicionales de la liquidación.",
    celda: (f) => <span className="text-slate-500">{formatCLP(f.descuentos)}</span>,
  },
  {
    // Acordado con Paolo el 16-sep-2026: el número que se mira primero es lo
    // que la persona le cuesta a la empresa, no lo que se le transfiere. El
    // líquido no se saca —se sigue cuadrando contra el banco—, baja a segunda
    // línea dentro de la misma celda.
    id: "costoEmpresa", label: "Costo empresa", derecha: true, porDefecto: true,
    help: "Lo que la persona le cuesta a la empresa en el período: líquido más leyes sociales y aportes del empleador (ítem CostoEmpresa de la liquidación). Debajo va el líquido a pagar. OJO: el finiquito de Talana no trae CostoEmpresa, así que en un mes con finiquito la indemnización NO está incluida acá.",
    celda: (f) => (
      <div className="flex flex-col items-end leading-tight">
        <span className="font-semibold">{f.costoEmpresa ? formatCLP(f.costoEmpresa) : GUION}</span>
        <span className="text-xs text-slate-400">Líquido {formatCLP(f.liquido)}</span>
      </div>
    ),
    celdaTarjeta: (f) => (
      <div className="flex flex-col leading-tight">
        <span className="font-semibold tabular-nums">{f.costoEmpresa ? formatCLP(f.costoEmpresa) : "—"}</span>
        <span className="text-[11px] text-slate-400 tabular-nums">Líquido {formatCLP(f.liquido)}</span>
      </div>
    ),
  },
  {
    id: "liquido", label: "Líquido", derecha: true,
    help: "Lo que Talana transfiere: sueldo líquido de la liquidación. Ya aparece bajo el costo empresa; esta columna existe para cuando se quiere mirarlo solo.",
    celda: (f) => <span className="font-semibold">{formatCLP(f.liquido)}</span>,
  },
  {
    id: "anticipo", label: "Anticipo", derecha: true,
    help: "Anticipos del período (liquidaciones de tipo anticipo).",
    celda: (f) => (f.anticipo ? formatCLP(f.anticipo) : GUION),
  },
  {
    id: "atrasos", label: "Atrasos", derecha: true,
    help: "Descuento por atrasos de la liquidación (ítem Atraso).",
    celda: (f) => (f.atrasos ? formatCLP(f.atrasos) : GUION),
  },
  {
    id: "comisionTalana", label: "Comisión Talana", derecha: true, porDefecto: true,
    help: "Comisión pagada en la liquidación (ítems Comision1 + Comision2).",
    celda: (f) => (f.comisionTalana ? formatCLP(f.comisionTalana) : GUION),
  },
  {
    id: "comisionIntranet", label: "Comisión intranet", derecha: true, porDefecto: true,
    help: "Comisión que calcula el módulo de Comisiones sobre el margen facturado del mismo período.",
    celda: (f) => (f.comisionIntranet === null ? <SinComision fila={f} /> : formatCLP(f.comisionIntranet)),
  },
  {
    id: "diferencia", label: "Diferencia", derecha: true, porDefecto: true,
    help: "Comisión intranet − comisión Talana. En rojo cuando la intranet calculó más de lo que Talana paga.",
    celda: (f, { umbral }) => <Diferencia valor={f.diferenciaComision} umbral={umbral} />,
  },
  {
    id: "reembolsos", label: "Reembolsos", derecha: true, porDefecto: true,
    help: "Gastos ya aprobados en Rendición de Gastos que se pagan junto con este sueldo (por fecha de aprobación).",
    celda: (f) => (f.reembolsosAprobados
      ? <span className="text-slate-500">{formatCLP(f.reembolsosAprobados)}</span>
      : GUION),
  },
  {
    id: "vendedor", label: "Vendedor ERP",
    help: "Nombre con el que el ERP registra sus ventas. Es el puente hacia la comisión calculada por la intranet.",
    celda: (f) => <span className="text-sm text-slate-500 whitespace-nowrap">{f.salespersonName ?? "—"}</span>,
  },
  {
    id: "vinculo", label: "Vínculo", porDefecto: true,
    celda: (f) => <ChipVinculo fila={f} />,
  },
];

/** Prefijo de las columnas que son un ítem de Talana, para no chocar con las propias. */
const PREFIJO_TALANA = "talana:";

// Radix no acepta "" como valor de un SelectItem: los dos filtros que no son
// un vendedor concreto necesitan valor propio.
const VENDEDOR_TODOS = "__todos__";
const VENDEDOR_SIN_ASIGNAR = "__sin_vendedor__";

const COLUMNAS_POR_DEFECTO = COLUMNAS_BASE.filter((c) => c.porDefecto).map((c) => c.id);

/** La definición de un ítem de Talana como columna de la planilla. */
function columnaDeItem(item: ColumnaTalana): ColumnaDef {
  return {
    id: PREFIJO_TALANA + item.id,
    label: item.label,
    derecha: true,
    help: `Ítem ${item.id} de la liquidación de Talana. Viene con valor en ${item.personas} ${item.personas === 1 ? "persona" : "personas"} de este período.`,
    celda: (f) => {
      const valor = f.itemsTalana?.[item.id];
      if (!valor) return GUION;
      return item.tipo === "dias" ? String(valor) : formatCLP(valor);
    },
  };
}

function ColHead({ label, help, className }: { label: string; help?: string; className?: string }) {
  const base = `whitespace-nowrap align-bottom ${className ?? ""}`;
  if (!help) return <TableHead className={base}>{label}</TableHead>;
  return (
    <TableHead className={base}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-slate-400 dark:border-slate-500">{label}</span>
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
  const [vendedor, setVendedor] = useState<string>(VENDEDOR_TODOS);
  /**
   * Columnas elegidas. `null` mientras no se sabe qué eligió esta persona:
   * recién ahí manda lo guardado en el servidor, y si nunca eligió, el set por
   * defecto. Se guarda local además de en el servidor para que marcar una
   * casilla se vea al instante y no espere el ida y vuelta.
   */
  const [columnasLocal, setColumnasLocal] = useState<string[] | null>(null);

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

  const { data: prefColumnas } = useQuery<{ columnas: string[] | null }>({
    queryKey: ["/api/rrhh/remuneraciones/columnas"],
    queryFn: async () => {
      const res = await fetch("/api/rrhh/remuneraciones/columnas", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudieron cargar las columnas");
      return res.json();
    },
    staleTime: Infinity,
  });

  // Lo guardado manda hasta que esta sesión toque una casilla.
  useEffect(() => {
    if (prefColumnas && columnasLocal === null) {
      setColumnasLocal(prefColumnas.columnas ?? COLUMNAS_POR_DEFECTO);
    }
  }, [prefColumnas]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarColumnas = useMutation({
    mutationFn: async (columnas: string[] | null) => {
      const res = await apiRequest("PUT", "/api/rrhh/remuneraciones/columnas", { columnas });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "No se pudo guardar");
      return res.json();
    },
    onSuccess: (_d, columnas) => {
      queryClient.setQueryData(["/api/rrhh/remuneraciones/columnas"], { columnas });
    },
    onError: (e: any) => toast({ title: "No se pudieron guardar las columnas", description: e?.message, variant: "destructive" }),
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

  // Marcar un "vendedor" del ERP que en realidad es un mostrador o un canal.
  const ignorarVendedor = useMutation({
    mutationFn: async (salespersonName: string) => {
      const res = await apiRequest("PUT", "/api/rrhh/remuneraciones/vendedores-ignorados", { salespersonName });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "No se pudo guardar");
      return res.json();
    },
    onSuccess: (_d, nombre) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/cruce"] });
      toast({ title: "Fuera de los descuadres", description: `${nombre} ya no se busca en Talana.` });
    },
    onError: (e: any) => toast({ title: "No se pudo guardar", description: e?.message, variant: "destructive" }),
  });

  const restaurarVendedor = useMutation({
    mutationFn: async (salespersonName: string) => {
      const res = await apiRequest("DELETE", `/api/rrhh/remuneraciones/vendedores-ignorados?nombre=${encodeURIComponent(salespersonName)}`);
      if (!res.ok) throw new Error("No se pudo restaurar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rrhh/remuneraciones/cruce"] });
      toast({ title: "Vuelve a los descuadres" });
    },
    onError: (e: any) => toast({ title: "No se pudo restaurar", description: e?.message, variant: "destructive" }),
  });

  const filas = cruce?.filas ?? [];
  const totales = cruce?.totales ?? null;
  const alertas = cruce?.alertas ?? [];
  const periodo = periodos.find((p) => String(p.id) === periodoActual) ?? cruce?.periodo ?? null;

  /**
   * Los vendedores del ERP que aparecen en el período, para el filtro. Sale de
   * las propias filas y no del catálogo de vendedores: lo que se quiere es
   * "mostrame la planilla de este vendedor", y un vendedor sin nadie liquidado
   * en el mes daría una lista vacía sin explicar por qué.
   */
  const vendedoresDelPeriodo = useMemo(() => {
    const set = new Set<string>();
    for (const f of filas) if (f.salespersonName) set.add(f.salespersonName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [filas]);

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (vendedor === VENDEDOR_SIN_ASIGNAR && f.salespersonName) return false;
      if (vendedor !== VENDEDOR_TODOS && vendedor !== VENDEDOR_SIN_ASIGNAR && f.salespersonName !== vendedor) return false;
      if (!q) return true;
      return f.nombre.toLowerCase().includes(q) ||
        f.rut.toLowerCase().includes(q) ||
        (f.cargo ?? "").toLowerCase().includes(q) ||
        (f.salespersonName ?? "").toLowerCase().includes(q) ||
        (f.centroCosto ?? "").toLowerCase().includes(q);
    });
  }, [filas, busqueda, vendedor]);

  // El catálogo de columnas del período: las propias del módulo más los ítems
  // que Talana informó este mes.
  const columnasTalana = cruce?.columnasTalana ?? [];
  const seleccion = columnasLocal ?? COLUMNAS_POR_DEFECTO;
  const columnasVisibles = useMemo(() => {
    const elegidas = new Set(seleccion);
    const base = COLUMNAS_BASE.filter((c) => c.fija || elegidas.has(c.id));
    const items = columnasTalana.filter((i) => elegidas.has(PREFIJO_TALANA + i.id)).map(columnaDeItem);
    return [...base, ...items];
  }, [seleccion, columnasTalana]);

  const cambiarColumna = (id: string, visible: boolean) => {
    const siguiente = visible
      ? Array.from(new Set([...seleccion, id]))
      : seleccion.filter((c) => c !== id);
    setColumnasLocal(siguiente);
    guardarColumnas.mutate(siguiente);
  };

  const resetearColumnas = () => {
    setColumnasLocal(COLUMNAS_POR_DEFECTO);
    guardarColumnas.mutate(null);
  };

  const diferenciaComisiones = (totales?.comisionIntranet ?? 0) - (totales?.comisionTalana ?? 0);
  const talanaCaido = cruce && cruce.talana && cruce.talana.ok === false;

  const descargarCsv = () => {
    if (!periodoActual) return;
    // El CSV trae siempre las columnas del cierre de mes; los ítems de Talana
    // que la persona sumó a la planilla se agregan al final, para que lo que
    // se ve en pantalla se pueda exportar.
    const items = seleccion
      .filter((c) => c.startsWith(PREFIJO_TALANA))
      .map((c) => c.slice(PREFIJO_TALANA.length));
    const extra = items.length ? `&items=${encodeURIComponent(items.join(","))}` : "";
    window.open(`/api/rrhh/remuneraciones/export.csv?periodo=${periodoActual}${extra}`, "_blank");
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
          {/* Acordado con Paolo (16-sep-2026): el número del mes es lo que cuesta
              la gente, no lo que se transfiere. El líquido queda debajo. */}
          <KpiCard icon={Banknote} label="Costo empresa" loading={cargandoCruce}
            value={formatCLP(totales?.costoEmpresa)}
            sub={totales ? `Líquido a pagar ${formatCLP(totales.liquido)}` : undefined} />
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
            columnas={columnasVisibles}
            catalogoTalana={columnasTalana}
            seleccion={seleccion}
            onCambiarColumna={cambiarColumna}
            onResetearColumnas={resetearColumnas}
            vendedores={vendedoresDelPeriodo}
            vendedor={vendedor}
            setVendedor={setVendedor}
          />
        )}

        {tab === "descuadres" && (
          <Descuadres
            alertas={alertas}
            loading={cargandoCruce}
            onIrAVinculos={() => setTab("vinculos")}
            onIgnorarVendedor={(n) => ignorarVendedor.mutate(n)}
            ignorando={ignorarVendedor.isPending}
            ignorados={cruce?.vendedoresIgnorados ?? []}
            onRestaurarVendedor={(n) => restaurarVendedor.mutate(n)}
          />
        )}

        {tab === "vinculos" && <Vinculos />}
      </div>
    </TooltipProvider>
  );
}

// ─── Planilla del período ───

function PlanillaPeriodo({
  filas, totalFilas, loading, busqueda, setBusqueda, umbral,
  columnas, catalogoTalana, seleccion, onCambiarColumna, onResetearColumnas,
  vendedores, vendedor, setVendedor,
}: {
  filas: FilaCruce[]; totalFilas: number; loading: boolean;
  busqueda: string; setBusqueda: (v: string) => void; umbral: number;
  columnas: ColumnaDef[]; catalogoTalana: ColumnaTalana[]; seleccion: string[];
  onCambiarColumna: (id: string, visible: boolean) => void;
  onResetearColumnas: () => void;
  vendedores: string[]; vendedor: string; setVendedor: (v: string) => void;
}) {
  const ctx = { umbral };
  const filtrando = !!busqueda || vendedor !== VENDEDOR_TODOS;
  // En la tarjeta de celular el nombre, el cargo y el vínculo ya van en la
  // cabecera: repetirlos en la grilla sería leerlos dos veces.
  const enTarjeta = columnas.filter((c) => !["persona", "cargo", "vinculo"].includes(c.id));

  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-[#fd6301]" />
            Planilla del período
            <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60 tabular-nums">
              {filas.length}{filtrando ? ` de ${totalFilas}` : ""}
            </span>
          </CardTitle>

          <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, RUT, cargo o vendedor…"
                className="h-11 sm:h-9 pl-8 pr-8 rounded-xl text-base sm:text-sm" />
              {busqueda && (
                <button type="button" onClick={() => setBusqueda("")} title="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtro por vendedor: pedido en la reunión del 16-sep-2026 para
                poder mirar la planilla de uno solo cuando se revisa su comisión. */}
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger className="h-11 sm:h-9 w-full sm:w-56 rounded-xl text-base sm:text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Todos los vendedores" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VENDEDOR_TODOS}>Todos los vendedores</SelectItem>
                <SelectItem value={VENDEDOR_SIN_ASIGNAR}>Sin vendedor asignado</SelectItem>
                {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            <SelectorColumnas catalogoTalana={catalogoTalana} seleccion={seleccion}
              onCambiar={onCambiarColumna} onResetear={onResetearColumnas} />
          </div>
        </div>

        {/* Lo aplicado, a la vista y con cómo sacarlo */}
        {filtrando && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {vendedor !== VENDEDOR_TODOS && (
              <ChipFiltro
                texto={vendedor === VENDEDOR_SIN_ASIGNAR ? "Sin vendedor asignado" : vendedor}
                onQuitar={() => setVendedor(VENDEDOR_TODOS)} />
            )}
            {busqueda && <ChipFiltro texto={`"${busqueda}"`} onQuitar={() => setBusqueda("")} />}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-0 sm:px-2">
        {loading && <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>}

        {/* Escritorio: la tabla completa */}
        {!loading && (
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnas.map((c) => (
                    <ColHead key={c.id} label={c.label} help={c.help}
                      className={[
                        c.derecha ? "text-right" : "",
                        // Con los ítems de Talana sumados la tabla se va a la
                        // derecha: sin fijar la persona, la fila deja de saberse
                        // de quién es a la tercera columna.
                        c.fija ? "sticky left-0 z-20 bg-white dark:bg-slate-900" : "",
                      ].filter(Boolean).join(" ") || undefined} />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.talanaEmpleadoId} className="group hover:bg-orange-50/50 dark:hover:bg-orange-950/15">
                    {columnas.map((c) => (
                      <TableCell key={c.id}
                        className={[
                          c.derecha ? "text-right tabular-nums whitespace-nowrap" : "",
                          c.fija
                            ? "sticky left-0 z-10 bg-white group-hover:bg-orange-50/50 dark:bg-slate-900 dark:group-hover:bg-orange-950/15 shadow-[6px_0_10px_-8px_rgba(0,0,0,.25)]"
                            : "",
                        ].filter(Boolean).join(" ") || undefined}>
                        {c.celda(f, ctx)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {!filas.length && (
                  <TableRow>
                    <TableCell colSpan={columnas.length} className="text-center text-slate-500 py-10">
                      {filtrando ? "Nadie coincide con el filtro aplicado." : "No hay personas en este período."}
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
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                      {f.nombre}
                      <ChipFiniquito fila={f} />
                    </p>
                    <p className="text-xs text-slate-400 truncate">{f.cargo ?? f.rut}</p>
                  </div>
                  <ChipVinculo fila={f} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  {enTarjeta.map((c) => (
                    <div key={c.id} className="min-w-0">
                      <p className="text-slate-400 truncate">{c.label}</p>
                      <div className="font-semibold tabular-nums">
                        {(c.celdaTarjeta ?? c.celda)(f, ctx)}
                      </div>
                    </div>
                  ))}
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
                {filtrando ? "Nadie coincide con el filtro aplicado." : "No hay personas en este período."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChipFiltro({ texto, onQuitar }: { texto: string; onQuitar: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 pl-3 pr-1.5 py-1 text-xs font-medium text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300">
      <span className="truncate max-w-[12rem]">{texto}</span>
      <button type="button" onClick={onQuitar} title="Quitar filtro"
        className="p-1 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/40">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

/**
 * Qué columnas ve esta persona. Dos listas: las del módulo (siempre las mismas)
 * y los ítems que Talana informó en el período, que cambian mes a mes y son
 * ~200 — por eso el buscador y el contador de en cuántas personas viene cada
 * uno: un ítem que trae una sola persona, como columna, es una fila con dato y
 * sesenta guiones.
 */
function SelectorColumnas({ catalogoTalana, seleccion, onCambiar, onResetear }: {
  catalogoTalana: ColumnaTalana[]; seleccion: string[];
  onCambiar: (id: string, visible: boolean) => void; onResetear: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const elegidas = new Set(seleccion);
  const q = busqueda.trim().toLowerCase();

  const base = COLUMNAS_BASE.filter((c) => !c.fija && (!q || c.label.toLowerCase().includes(q)));
  const items = catalogoTalana.filter((i) =>
    !q || i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));

  const cuantas = seleccion.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"
          className="h-11 sm:h-9 rounded-xl border-slate-200 hover:border-orange-200 hover:text-[#fd6301] justify-start sm:justify-center">
          <Columns3 className="w-4 h-4 mr-2" />
          Columnas
          <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 text-[11px] tabular-nums">{cuantas}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0 rounded-2xl">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar columna…" className="h-11 sm:h-9 pl-8 rounded-xl text-base sm:text-sm" />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Columnas del módulo
          </p>
          {base.map((c) => (
            <FilaColumna key={c.id} label={c.label} detalle={c.help}
              marcada={elegidas.has(c.id)} onCambiar={(v) => onCambiar(c.id, v)} />
          ))}
          {!base.length && <p className="px-3 py-2 text-xs text-slate-400">Ninguna coincide.</p>}

          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Ítems de Talana {catalogoTalana.length ? `(${catalogoTalana.length})` : ""}
          </p>
          {!catalogoTalana.length && (
            <p className="px-3 py-2 text-xs text-slate-400">
              Este período todavía no tiene liquidaciones cargadas en Talana.
            </p>
          )}
          {items.map((i) => (
            <FilaColumna key={i.id} label={i.label}
              detalle={`${i.id} · ${i.personas} ${i.personas === 1 ? "persona" : "personas"}`}
              marcada={elegidas.has(PREFIJO_TALANA + i.id)}
              onCambiar={(v) => onCambiar(PREFIJO_TALANA + i.id, v)} />
          ))}
          {catalogoTalana.length > 0 && !items.length && (
            <p className="px-3 py-2 text-xs text-slate-400">Ningún ítem coincide.</p>
          )}
        </div>

        <div className="p-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onResetear}
            className="w-full h-10 rounded-xl text-slate-500 hover:text-[#fd6301]">
            <RotateCcw className="w-4 h-4 mr-2" /> Volver a las columnas por defecto
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilaColumna({ label, detalle, marcada, onCambiar }: {
  label: string; detalle?: string; marcada: boolean; onCambiar: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 px-3 py-2.5 min-h-[44px] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <input type="checkbox" checked={marcada} onChange={(e) => onCambiar(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#fd6301] focus:ring-[#fd6301]" />
      <span className="min-w-0">
        <span className="block text-sm text-slate-700 dark:text-slate-200 truncate">{label}</span>
        {detalle && <span className="block text-[11px] text-slate-400 line-clamp-2">{detalle}</span>}
      </span>
    </label>
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

/**
 * Aviso de que el mes trae DOS liquidaciones de pago para la misma persona
 * (sueldo y finiquito, de quien se fue a mitad de mes). Las cifras de la fila
 * son la suma de las dos: sin este chip se leerían como un sueldo normal, que
 * es justo lo que haría dudar del total.
 */
function ChipFiniquito({ fila }: { fila: FilaCruce }) {
  if ((fila.liquidacionesDelPeriodo ?? 0) <= 1) return null;
  const detalle = (fila.tiposLiquidacion ?? []).join(" + ");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="shrink-0 text-[10px] font-medium border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {fila.liquidacionesDelPeriodo} liquidaciones
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        El mes trae {detalle}. Las cifras de la fila suman las dos.
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * El guion de la columna "Comisión intranet". Un guion a secas deja la duda de
 * si el módulo no calculó o si calculó cero, que son cosas distintas: la
 * primera se arregla configurando el % en Comisiones, la segunda es un
 * descuadre de verdad. Verificado contra julio 2026: de los 8 que cobran
 * comisión en Talana, 3 caían acá.
 */
function SinComision({ fila }: { fila: FilaCruce }) {
  const motivo = fila.motivoSinComision;
  if (!motivo) return <span className="text-slate-300">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-slate-300 cursor-help underline decoration-dotted underline-offset-4">—</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {motivo === "sin_porcentaje"
          ? `La intranet no calcula comisión para ${fila.salespersonName}: no tiene % configurado en Comisiones. No es que haya dado cero.`
          : "Esta persona no está vinculada a ningún vendedor del ERP, así que no hay comisión que calcular. Se arregla en Vínculos."}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Descuadres ───

function Descuadres({ alertas, loading, onIrAVinculos, onIgnorarVendedor, ignorando, ignorados, onRestaurarVendedor }: {
  alertas: Alerta[]; loading: boolean; onIrAVinculos: () => void;
  onIgnorarVendedor: (nombre: string) => void; ignorando: boolean;
  ignorados: string[]; onRestaurarVendedor: (nombre: string) => void;
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
        <GrupoAlertas key={tipo} tipo={tipo} lista={lista} onIrAVinculos={onIrAVinculos}
          onIgnorarVendedor={onIgnorarVendedor} ignorando={ignorando} />
      ))}
      <VendedoresIgnorados ignorados={ignorados} onRestaurar={onRestaurarVendedor} />
    </div>
  );
}

/**
 * Lo que se sacó a mano de los descuadres. Va al pie y plegado: no es una
 * alerta, pero tiene que quedar a la vista para que "no aparece" nunca sea un
 * misterio y se pueda deshacer.
 */
function VendedoresIgnorados({ ignorados, onRestaurar }: {
  ignorados: string[]; onRestaurar: (nombre: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!ignorados.length) return null;
  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
      <CardContent className="py-3">
        <button type="button" onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          <EyeOff className="w-4 h-4" />
          {ignorados.length} {ignorados.length === 1 ? "vendedor marcado" : "vendedores marcados"} como mostrador o canal
        </button>
        {abierto && (
          <div className="mt-3 space-y-1.5">
            {ignorados.map((n) => (
              <div key={n} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 px-3 py-1.5">
                <span className="text-sm text-slate-600 dark:text-slate-300">{n}</span>
                <Button variant="ghost" size="sm" onClick={() => onRestaurar(n)}
                  className="rounded-2xl h-8 text-slate-400 hover:text-[#fd6301]">
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Volver a incluir
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GrupoAlertas({ tipo, lista, onIrAVinculos, onIgnorarVendedor, ignorando }: {
  tipo: string; lista: Alerta[]; onIrAVinculos: () => void;
  onIgnorarVendedor: (nombre: string) => void; ignorando: boolean;
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
            <div className="flex items-center gap-2 shrink-0">
              {a.monto !== undefined && (
                <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatCLP(a.monto)}</span>
              )}
              {/* Los mostradores y canales del ERP (MCT, marketplaces, tienda
                  online) facturan y comisionan pero no tienen liquidación que
                  buscar: sin esto su alerta no se puede resolver nunca. */}
              {tipo === "vendedor_sin_liquidacion" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={ignorando}
                      onClick={() => onIgnorarVendedor(a.nombre)}
                      className="rounded-2xl h-8 px-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                      <EyeOff className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>No es una persona (mostrador o canal de venta)</TooltipContent>
                </Tooltip>
              )}
            </div>
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
          {tipo === "comision_sin_porcentaje" && (
            <Button asChild variant="outline" size="sm"
              className="rounded-2xl border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/40">
              <a href="/comisiones"><DollarSign className="w-4 h-4 mr-2" /> Configurar en Comisiones</a>
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

/** Qué se muestra en la pestaña de Vínculos. */
type FiltroVinculo = "todos" | "pendientes" | "sin_vinculo";

const FILTROS_VINCULO: { value: FiltroVinculo; label: string }[] = [
  { value: "pendientes", label: "Pendientes de confirmar" },
  { value: "sin_vinculo", label: "Sin vincular" },
  { value: "todos", label: "Todas las personas" },
];

function Vinculos() {
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState("");
  /**
   * Abre en "pendientes" a propósito: a esta pestaña se entra a arreglar lo que
   * no cruzó, y con 64 personas liquidadas las tres que hay que tocar quedaban
   * perdidas en la lista completa. "Pendientes" son las que nadie confirmó
   * todavía: las que no calzaron con nadie y las que el sistema propuso por
   * nombre y siguen sin revisar.
   */
  const [filtro, setFiltro] = useState<FiltroVinculo>("pendientes");

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

  /**
   * Cada persona de Talana con el vínculo que le corresponde hoy. El estado se
   * calcula acá (y no dentro del render) porque es lo que filtra la pestaña.
   * Sin fila guardada mandan las sugerencias del servidor: son las mismas que
   * usa la planilla, así las dos pantallas dicen lo mismo de la misma persona.
   */
  const filasVinculo = useMemo(() => empleados.map((e) => {
    const v = vinculoPorEmpleado.get(e.id) ?? null;
    const userId = v?.userId ?? (v ? null : e.sugerencia?.userId ?? null);
    const vendedor = v?.salespersonName ?? (v ? null : e.sugerencia?.salespersonName ?? null);
    const estado: EstadoVinculo = v?.ignorado
      ? "ignorado"
      : v?.confirmado
        ? "confirmado"
        : (userId || vendedor) ? "automatico" : "sin_vinculo";
    return { e, v, userId, vendedor, estado };
  }), [empleados, vinculoPorEmpleado]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filasVinculo.filter(({ e, estado }) => {
      if (filtro === "sin_vinculo" && estado !== "sin_vinculo") return false;
      if (filtro === "pendientes" && estado !== "sin_vinculo" && estado !== "automatico") return false;
      if (!q) return true;
      return e.nombre.toLowerCase().includes(q) || e.rut.includes(q);
    });
  }, [filasVinculo, busqueda, filtro]);

  const sinVincular = filasVinculo.filter((f) => f.estado === "sin_vinculo").length;
  const porConfirmar = filasVinculo.filter((f) => f.estado === "automatico").length;

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
          <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2">
            <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroVinculo)}>
              <SelectTrigger className="h-11 sm:h-9 w-full sm:w-56 rounded-xl text-base sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTROS_VINCULO.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                    {f.value === "sin_vinculo" && sinVincular ? ` (${sinVincular})` : ""}
                    {f.value === "pendientes" && (sinVincular + porConfirmar) ? ` (${sinVincular + porConfirmar})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar persona…" className="h-11 sm:h-9 pl-8 rounded-xl text-base sm:text-sm" />
            </div>
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
                {filtrados.map(({ e, v, userId, vendedor, estado }) => {
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
                      {busqueda
                        ? `Nadie coincide con "${busqueda}"`
                        : filtro === "sin_vinculo"
                          ? "Todas las personas de Talana están vinculadas."
                          : filtro === "pendientes"
                            ? "No queda nada por confirmar: todos los vínculos están revisados."
                            : "Talana no devolvió personas."}
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
