/**
 * Estado de Resultados — el resultado del mes, presupuesto y cruce con Talana
 * ---------------------------------------------------------------
 * Esto arma un ESTADO DE RESULTADOS: ingresos menos egresos del mes. No es un
 * balance general —el estado de situación, con activo, pasivo y patrimonio— y
 * por eso dejó de llamarse "Balance": el nombre viejo prometía otra cosa y la
 * pantalla se pasaba media tarjeta aclarando que no era eso.
 *
 * Las cuentas de activo y pasivo existen en Softland; no se importan porque
 * `armarResultado()` las pintaría como gasto. Ver ESTADO-RESULTADOS.md.
 *
 * Backend: server/routes-balance.ts (los identificadores internos siguen siendo
 * `balance*` a propósito: el permiso `finanzas.balance` tiene grants otorgados y
 * las tablas `balance_*` tienen datos cargados).
 */
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCLP } from "@/lib/crm-seguimiento";
import { ICONO_CHIP_SM, ICONO_CHIP_ICONO_SM } from "@/lib/icono-chip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Scale, CalendarDays, TrendingUp, TrendingDown, Users, Upload, Download,
  AlertTriangle, ChevronRight, ChevronDown, Target, ListTree, Info,
  DatabaseZap, RefreshCw, PlugZap, FlaskConical, Trash2,
  type LucideIcon,
} from "lucide-react";

// ─── Tipos (espejo de server/routes-balance.ts) ───

interface Montos { mes: number; anterior: number; acumulado: number; presupuesto: number }
interface CuentaResultado extends Montos {
  codigo: string; codigoErp: string; nombre: string; nombreErp: string; activa: boolean;
}
interface MayorResultado extends Montos { mayor: string; nombre: string; cuentas: CuentaResultado[] }
interface GrupoResultado extends Montos { granCuenta: string; nombre: string; mayores: MayorResultado[] }
interface LineaResultado extends Montos { clave: string; etiqueta: string; tipo: string }
interface Resultado {
  periodo: string; periodoAnterior: string;
  /** `false` ⇒ la columna del mes anterior es un hueco, no un cero. */
  periodoAnteriorCargado: boolean;
  mesesAcumulados: number; mesesDelAcumulado: number;
  cargado: { periodo: string; estado: string; origen: string; archivoNombre: string | null } | null;
  grupos: GrupoResultado[]; lineas: LineaResultado[];
}
interface Estado {
  cuentas: number; periodos: string[]; ultimoPeriodo: string | null;
  /** Meses cargados que no tienen ni un peso. Se marcan en el selector. */
  periodosVacios: string[];
  talanaConfigurado: boolean; soloResultado: boolean;
}
/** Lo que hay del otro lado, en Softland. Ver server/etl-contabilidad.ts. */
interface EstadoErp {
  disponible: boolean; error?: string;
  servidor: string; base: string; empresa: string;
  anios: string[];
  /** Ya filtrados por la compuerta de prueba: no se ofrece lo que se va a rechazar. */
  periodos: { periodo: string; comprobantes: number; lineas: number }[];
  limitadoA: string[] | null;
  mesesFueraDelLimite: number;
}
interface Cuenta {
  codigo: string; codigoErp: string; granCuenta: string; granCuentaNombre: string;
  mayor: string; mayorNombre: string; nombre: string; nombreLargo: string | null;
  naturaleza: string; activa: boolean;
}
interface ConceptoPersonal {
  concepto: string; nombre: string;
  cuentas: { codigo: string; nombre: string; monto: number }[];
  centrosCosto: string[]; contable: number; talana: number; personas: number;
  diferencia: number; comparable: boolean; descuadra: boolean;
}
interface Personal {
  periodo: string; talana: { ok: boolean; error: string | null };
  conceptos: ConceptoPersonal[];
  centrosSinMapear: { centroCosto: string; costoEmpresa: number; personas: number }[];
  cuentasSinMapear: { codigo: string; nombre: string; monto: number }[];
  umbralDescuadre: number;
}

// ─── Pestañas ───
// Declaradas como datos para que el riel de escritorio y el desplegable de
// celular no se desincronicen (regla del sistema de diseño).
type TabId = "resultado" | "presupuesto" | "personal" | "cuentas";
const TABS: { value: TabId; label: string; Icon: LucideIcon }[] = [
  { value: "resultado", label: "Resultado", Icon: Scale },
  { value: "presupuesto", label: "Presupuesto", Icon: Target },
  { value: "personal", label: "Personal", Icon: Users },
  { value: "cuentas", label: "Cuentas", Icon: ListTree },
];

// ─── Detalle plegable ───
// En pantallas anchas la tarjeta mide casi mil pixeles y el monto se iba al
// borde, lejos del nombre de la cuenta. La fila se corta antes y el monto vive
// en una columna de ancho fijo: queda cerca del texto y alineado entre niveles.
/** Los títulos de columna van en negro, no en el gris de la tabla base. */
const CABECERA_TABLA = "text-right text-slate-900 dark:text-white";

const FILA_DETALLE = "w-full max-w-3xl";
const COLUMNA_MONTO = "w-40 text-right flex-shrink-0";

/** "$-3.931.002" se lee mal: el signo va afuera, delante del monto. */
function montoConSigno(n: number): string {
  return n < 0 ? `− ${formatCLP(Math.abs(n))}` : formatCLP(n);
}

function etiquetaPeriodo(periodo: string): string {
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [ano, mes] = periodo.split("-").map(Number);
  const nombre = meses[mes - 1] ?? periodo;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${ano}`;
}

/**
 * "Acumulado año" miente si sólo hay un mes cargado. Mientras falten meses lo
 * dice: es la diferencia entre "la empresa lleva esto en el año" y "esto es lo
 * único que trajimos".
 */
function etiquetaAcumulado(r?: Resultado): string {
  if (!r || r.mesesAcumulados >= r.mesesDelAcumulado) return "Acumulado año";
  return `Acumulado ${r.mesesAcumulados} de ${r.mesesDelAcumulado} meses`;
}

/**
 * Los meses del ERP agrupados por año, del más nuevo al más viejo.
 *
 * Con la compuerta de prueba eran uno o dos. Abierta son **154**, y una lista
 * plana de 154 meses no se recorre: hay que poder saltar al año.
 */
function porAnio<T extends { periodo: string }>(meses: T[]): { anio: string; meses: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const m of meses) {
    const anio = m.periodo.slice(0, 4);
    grupos.set(anio, [...(grupos.get(anio) ?? []), m]);
  }
  return Array.from(grupos.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([anio, meses]) => ({ anio, meses }));
}

/** Variación contra el mes anterior. Sin base no hay porcentaje, y se dice. */
function variacion(actual: number, anterior: number): string | null {
  if (!anterior) return null;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

export default function EstadoResultadosPage() {
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState<string>("");
  const [tab, setTab] = useState<TabId>("resultado");

  const { data: estado, isLoading: cargandoEstado } = useQuery<Estado>({
    queryKey: ["/api/finanzas/balance/estado"],
  });

  const periodoActual = periodo || estado?.ultimoPeriodo || "";

  const { data: resultado, isLoading: cargandoResultado } = useQuery<Resultado>({
    queryKey: ["/api/finanzas/balance/resultado", { periodo: periodoActual }],
    enabled: !!periodoActual,
  });

  const linea = (clave: string) => resultado?.lineas.find((l) => l.clave === clave);
  const ingresos = linea("ingresos_operacionales");
  const margen = linea("margen_bruto");
  const total = linea("resultado");
  const gastos = useMemo(() => {
    const a = linea("gastos_admin_ventas");
    const b = linea("gastos_operacion");
    if (!a || !b) return null;
    return { mes: a.mes + b.mes, anterior: a.anterior + b.anterior };
  }, [resultado]);

  /** Sacar un mes que quedó vacío. El servidor rechaza cualquier otro. */
  const eliminar = useMutation({
    mutationFn: async (p: string) => {
      const res = await apiRequest(`/api/finanzas/balance/periodos/${p}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: (json: any) => {
      // Se suelta el período elegido: el que quede lo decide el servidor, que
      // ahora abre en el más reciente CON datos.
      setPeriodo("");
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/estado"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/resultado"] });
      toast({ title: `${etiquetaPeriodo(json.periodo)} eliminado`, description: `${json.saldosEliminados} cuentas en cero sacadas.` });
    },
    onError: (err: any) => toast({ title: "No se pudo eliminar", description: err.message, variant: "destructive" }),
  });

  const sinPlan = !cargandoEstado && estado?.cuentas === 0;
  const sinPeriodos = !cargandoEstado && (estado?.periodos.length ?? 0) === 0;

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen p-4 sm:p-6 space-y-4 md:space-y-6 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/25">
            <Scale className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Estado de Resultado</h1>
          </div>
        </div>
        <Button
          variant="outline" size="sm" disabled={!periodoActual}
          onClick={() => window.open(`/api/finanzas/balance/export.csv?periodo=${periodoActual}`, "_blank")}
          className="rounded-2xl border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/40">
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Primera corrida: se está validando el ETL contra el ERP mes a mes, así
          que sólo hay un mes habilitado. Se dice acá y no al apretar el botón:
          si no, parece que faltan datos. */}
      <NotaPrimeraCorrida />

      {sinPlan && <ImportarPlan onListo={() => setTab("cuentas")} />}

      {!sinPlan && (
        <>
          {/* Período. Sin marco: los controles van sueltos sobre el fondo. */}
          <Card className="rounded-2xl border-0 bg-transparent shadow-none">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-3 py-2 shadow-sm hover:border-orange-200 hover:shadow transition-all">
                  <div className="flex items-center justify-center w-9 h-9 text-[#fd6301] dark:text-orange-400 flex-shrink-0">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Período</span>
                    <Select value={periodoActual} onValueChange={setPeriodo} disabled={sinPeriodos}>
                      <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto min-w-[9rem] bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60">
                        <SelectValue placeholder={cargandoEstado ? "Cargando…" : "Sin meses cargados"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(estado?.periodos ?? []).slice().reverse().map((p) => (
                          <SelectItem key={p} value={p}>
                            {etiquetaPeriodo(p)}
                            {/* Un mes sin un peso se dice. Si no, el que lo elige
                                lee "$0 en todo" como "no hubo movimiento". */}
                            {estado?.periodosVacios?.includes(p) ? " · sin datos" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* De dónde salió el mes que se está mirando. Un número traído
                    del ERP y uno tecleado desde un Excel no valen lo mismo. */}
                {resultado?.cargado && (
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-600 font-normal dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    {resultado.cargado.origen === "erp"
                      ? <><DatabaseZap className="w-3 h-3 mr-1.5" /> Traído de Random</>
                      : <><Upload className="w-3 h-3 mr-1.5" /> Cargado por archivo</>}
                  </Badge>
                )}
                {/* En celular no se carga el mes: es una tarea de escritorio y ocupaba media pantalla. */}
                <div className="hidden sm:block sm:w-auto sm:ml-auto">
                  <CargarMes periodoSugerido={periodoActual} />
                </div>
              </div>
            </CardContent>
          </Card>

          {!sinPeriodos && periodoActual && estado?.periodosVacios?.includes(periodoActual) && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-amber-800 dark:text-amber-300 flex-1">
                  <strong>{etiquetaPeriodo(periodoActual)} está cargado pero no tiene ni un peso.</strong>{" "}
                  Los $0 de abajo son eso, no un mes sin movimiento. Traelo del ERP, elegí otro mes,
                  o sacalo de la lista.
                </p>
                {/* Sólo sale acá, o sea sólo sobre un mes vacío. Y el cerrojo de
                    verdad está en el servidor, que recuenta antes de borrar. */}
                <Button variant="outline" size="sm" disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(periodoActual)}
                  className="h-11 sm:h-9 w-full sm:w-auto flex-shrink-0 rounded-2xl border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/60">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {eliminar.isPending ? "Eliminando…" : "Eliminar este mes vacío"}
                </Button>
              </CardContent>
            </Card>
          )}

      {sinPeriodos && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
              <CardContent className="py-4 flex items-start gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-amber-800 dark:text-amber-300">
                  El plan de cuentas está cargado pero todavía no hay ningún mes con saldos.
                  Elegí un mes y apretá <strong>Traer del ERP</strong> para ver el resultado.
                </p>
              </CardContent>
            </Card>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Kpi icon={TrendingUp} label="Ingresos operacionales" loading={cargandoResultado}
              value={formatCLP(ingresos?.mes ?? 0)}
              variacion={ingresos && resultado?.periodoAnteriorCargado ? variacion(ingresos.mes, ingresos.anterior) : null} />
            <Kpi icon={TrendingDown} label="Gastos del mes" loading={cargandoResultado}
              value={formatCLP(gastos?.mes ?? 0)}
              variacion={gastos && resultado?.periodoAnteriorCargado ? variacion(gastos.mes, gastos.anterior) : null} />
            <Kpi icon={Scale} label="Margen bruto" loading={cargandoResultado}
              value={montoConSigno(margen?.mes ?? 0)}
              sub={ingresos?.mes ? `${((margen?.mes ?? 0) / ingresos.mes * 100).toFixed(1)}% sobre ingresos` : undefined} />
            <Kpi icon={Target} label="Resultado del período" loading={cargandoResultado}
              value={montoConSigno(total?.mes ?? 0)}
              accent={(total?.mes ?? 0) < 0 ? "alerta" : "destacada"}
              sub={total ? `${etiquetaAcumulado(resultado)} ${montoConSigno(total.acumulado)}` : undefined} />
          </div>

          {/* Riel de pestañas (escritorio) */}
          <div className="hidden sm:flex gap-1.5 border-b border-slate-200 dark:border-slate-800">
            {TABS.map(({ value, label, Icon }) => {
              const activa = tab === value;
              return (
                <button key={value} type="button" onClick={() => setTab(value)}
                  className={`group inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activa
                      ? "font-semibold text-[#0a0a0a] border-[#0a0a0a] dark:text-white dark:border-slate-100"
                      : "text-[#0a0a0a]/70 border-transparent hover:text-[#fd6301] dark:text-slate-300 dark:hover:text-white"}`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              );
            })}
          </div>

          {/* Selector de sección (celular) */}
          <div className="sm:hidden flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-3 py-2 shadow-sm">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-[#fd6301] dark:bg-orange-950/40 flex-shrink-0">
              <Scale className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-none w-full">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Sección</span>
              <Select value={tab} onValueChange={(v) => setTab(v as TabId)}>
                <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tab === "resultado" && <EstadoDeResultados datos={resultado} loading={cargandoResultado} />}
          {tab === "presupuesto" && <Presupuesto periodo={periodoActual} resultado={resultado} />}
          {tab === "personal" && <PersonalVsTalana periodo={periodoActual} />}
          {tab === "cuentas" && <Cuentas />}
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, loading, accent = "neutro", variacion: v }: {
  icon: LucideIcon; label: string; value: string; sub?: string;
  loading?: boolean; accent?: "neutro" | "destacada" | "alerta"; variacion?: string | null;
}) {
  const color = accent === "destacada" ? "text-[#fd6301]"
    : accent === "alerta" ? "text-red-600"
    : "text-slate-900 dark:text-white";
  return (
    <Card className="rounded-2xl shadow-sm border-slate-200/70 dark:border-slate-800 overflow-hidden">
      <CardContent className="px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 mb-2 min-w-0">
          <span className={ICONO_CHIP_SM}><Icon className={ICONO_CHIP_ICONO_SM} /></span>
          <p className="text-xs font-medium text-slate-900 dark:text-white leading-tight min-w-0">{label}</p>
        </div>
        {loading
          ? <Skeleton className="h-8 w-28" />
          : <p className={`text-base min-[400px]:text-lg sm:text-xl 2xl:text-2xl font-bold tabular-nums truncate ${color}`} title={value}>{value}</p>}
        {!loading && (sub || v) && (
          <p className="text-[11px] text-slate-400 mt-1 leading-tight">
            {v && <span className="tabular-nums">{v} vs mes anterior</span>}
            {v && sub ? " · " : ""}{sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Importar el plan de cuentas ───

/**
 * Sólo aparece cuando no hay ninguna cuenta cargada: es lo primero que hay que
 * hacer y sin eso el resto del módulo no tiene con qué trabajar.
 */
/**
 * El aviso de la compuerta de prueba. Sale del propio ERP —`limitadoA`— así que
 * el día que se levante el límite, la nota desaparece sola.
 */
function NotaPrimeraCorrida() {
  const erp = useErpEstado();
  const limite = erp.data?.limitadoA;
  if (!erp.data?.disponible || !limite?.length) return null;
  return (
    <Card className="rounded-2xl border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20">
      <CardContent className="py-3 flex items-start gap-3 text-sm">
        <FlaskConical className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
        <p className="text-sky-800 dark:text-sky-300">
          <strong>Primera corrida del ETL.</strong> Por ahora sólo se puede traer{" "}
          {limite.map((p) => etiquetaPeriodo(p).toLowerCase()).join(", ")}, mientras se valida contra el ERP que los números
          calcen. Los otros {erp.data.mesesFueraDelLimite} meses con movimiento están ahí y se habilitan
          después.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Softland en vivo ───

/**
 * Qué hay del otro lado: años con plan y meses con movimiento.
 *
 * Se pide una vez y no se repite al volver a la pestaña. La consulta agrupa las
 * 350 mil líneas de detalle contable del ERP, que además está en red privada:
 * no es algo que deba dispararse cada vez que alguien cambia de ventana.
 */
function useErpEstado() {
  return useQuery<EstadoErp>({
    queryKey: ["/api/finanzas/balance/erp/estado"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Por qué no se puede traer del ERP. Se muestra como dato, no como error: el
 * módulo sigue funcionando con la carga por archivo, que es justo lo que hay que
 * decirle a quien lo está mirando.
 */
function ErpCaido({ error }: { error?: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
      <PlugZap className="w-4 h-4 mt-px flex-shrink-0 text-amber-600 dark:text-amber-500" />
      <p>
        Softland no responde, así que hay que cargar el mes por archivo.
        {error ? <span className="block font-mono text-[11px] opacity-70 mt-0.5">{error}</span> : null}
      </p>
    </div>
  );
}

// ─── Plan de cuentas: primera carga ───

/**
 * El estado vacío. Ofrece las dos vías en el orden correcto: traerlo del ERP es
 * lo normal, subir un archivo es el respaldo para cuando el servidor no está.
 */
function ImportarPlan({ onListo }: { onListo: () => void }) {
  const { toast } = useToast();
  const erp = useErpEstado();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [anio, setAnio] = useState("");

  // El plan se versiona por año: el más nuevo es el que casi siempre se quiere.
  const anioActual = anio || erp.data?.anios[0] || "";

  const traer = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/finanzas/balance/erp/plan", { method: "POST", data: { anio: anioActual } });
      return res.json();
    },
    onSuccess: (json: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/estado"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/cuentas"] });
      toast({
        title: `${json.guardadas} cuentas traídas del plan ${json.anio}`,
        description: json.normalizadas?.length
          ? `Se corrigió el código de ${json.normalizadas.length} cuentas que el ERP guarda mal formadas (ej. "${json.normalizadas[0].codigoErp}" → ${json.normalizadas[0].codigo}).`
          : undefined,
      });
      onListo();
    },
    onError: (err: any) => toast({ title: "No se pudo traer el plan", description: err.message, variant: "destructive" }),
  });

  const subir = async (archivo: File) => {
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("file", archivo);
      const res = await apiRequest("/api/finanzas/balance/cuentas/importar", { method: "POST", data: form });
      const json = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/estado"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/cuentas"] });
      toast({
        title: `${json.guardadas} cuentas importadas`,
        description: json.normalizadas?.length
          ? `Se corrigió el código de ${json.normalizadas.length} cuentas que Softland entrega mal formadas (ej. "${json.normalizadas[0].codigoErp}" → ${json.normalizadas[0].codigo}).`
          : undefined,
      });
      onListo();
    } catch (err: any) {
      toast({ title: "No se pudo importar", description: err.message, variant: "destructive" });
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  const hayErp = erp.data?.disponible && (erp.data.anios.length > 0);

  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
      <CardContent className="py-10 px-5 sm:px-6 flex flex-col items-center text-center gap-4">
        <span className="w-12 h-12 rounded-2xl bg-[#fd6301] text-white flex items-center justify-center shadow-md shadow-[#fd6301]/25">
          <ListTree className="w-6 h-6" />
        </span>
        <div className="max-w-md">
          <p className="font-semibold text-slate-900 dark:text-white">Todavía no hay plan de cuentas</p>
          <p className="text-sm text-slate-500 mt-1">
            El plan vive en Softland, repartido en tres niveles (gran cuenta, mayor y cuenta). Se trae de ahí:
            los códigos que el ERP guarda con el mayor sin rellenar —como <code className="font-mono">5120 106</code>,
            que es <code className="font-mono">51020106</code>— se corrigen al traerlos.
          </p>
        </div>

        {erp.isLoading ? (
          <Skeleton className="h-11 w-56 rounded-2xl" />
        ) : hayErp ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Select value={anioActual} onValueChange={setAnio}>
              <SelectTrigger className="h-11 sm:h-10 w-full sm:w-[8.5rem] rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-base sm:text-sm font-semibold">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {erp.data!.anios.map((a) => <SelectItem key={a} value={a}>Plan {a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => traer.mutate()} disabled={traer.isPending || !anioActual}
              className="h-11 sm:h-10 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25">
              <DatabaseZap className={`w-4 h-4 mr-2 ${traer.isPending ? "animate-pulse" : ""}`} />
              {traer.isPending ? "Trayendo…" : "Traer de Softland"}
            </Button>
          </div>
        ) : (
          <ErpCaido error={erp.data?.error} />
        )}

        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
        <Button variant="ghost" onClick={() => input.current?.click()} disabled={subiendo}
          className="h-11 sm:h-9 rounded-2xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <Upload className="w-4 h-4 mr-2" /> {subiendo ? "Importando…" : "o subir un archivo"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Cargar los saldos de un mes ───

/**
 * Traer el mes. El ERP manda y el archivo es el respaldo, así que el selector
 * ofrece sólo meses que de verdad tienen movimiento: no se puede pedir un mes
 * que no existe y descubrirlo por un 404.
 *
 * Cuando el ERP no está, cae al mismo input de archivo de siempre, con un
 * `type="month"` libre — ahí sí hay que poder escribir cualquier mes.
 */
function CargarMes({ periodoSugerido }: { periodoSugerido: string }) {
  const { toast } = useToast();
  const erp = useErpEstado();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mes, setMes] = useState("");

  const disponibles = erp.data?.periodos ?? [];
  const hayErp = !!erp.data?.disponible && disponibles.length > 0;
  const mesActual = mes
    || (disponibles.some((p) => p.periodo === periodoSugerido) ? periodoSugerido : "")
    || disponibles[0]?.periodo
    || periodoSugerido
    || new Date().toISOString().slice(0, 7);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/estado"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/resultado"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/personal"] });
  };

  const traer = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/finanzas/balance/erp/periodo", { method: "POST", data: { periodo: mesActual } });
      return res.json();
    },
    onSuccess: (json: any) => {
      refrescar();
      // Una cuenta con movimiento que no está en el plan deja el mes incompleto
      // y en silencio. Es lo primero que hay que ver, no un detalle.
      const huerfanas = json.sinCuentaEnElPlan ?? [];
      const detalle = [
        `${json.lineas.toLocaleString("es-CL")} líneas de comprobante`,
        // Si faltaban cuentas, el ETL trajo el plan de ese año solo. Se dice:
        // el usuario pidió un mes y se cargaron dos cosas.
        json.planTraidoAutomaticamente ? `se trajo además el plan ${json.planTraidoAutomaticamente}` : null,
      ].filter(Boolean).join(" · ");
      toast({
        title: `${json.cuentas} cuentas traídas de ${etiquetaPeriodo(json.periodo)}`,
        description: huerfanas.length
          ? `${huerfanas.length} cuenta(s) con movimiento siguen sin estar en el plan del ERP (ej. ${huerfanas[0].codigo}). El mes quedó incompleto.`
          : detalle,
        variant: huerfanas.length ? "destructive" : undefined,
      });
    },
    onError: (err: any) => toast({ title: "No se pudo traer el mes", description: err.message, variant: "destructive" }),
  });

  const subir = async (archivo: File) => {
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("file", archivo);
      form.append("periodo", mesActual);
      const res = await apiRequest("/api/finanzas/balance/saldos/importar", { method: "POST", data: form });
      const json = await res.json();
      refrescar();
      toast({
        title: `${json.guardadas} cuentas cargadas en ${etiquetaPeriodo(mesActual)}`,
        // Las filas que no calzaron no se tapan: son las que hay que revisar.
        description: json.errores?.length
          ? `${json.errores.length} fila(s) quedaron fuera. La primera: ${json.errores[0].motivo} (${json.errores[0].detalle ?? `fila ${json.errores[0].fila}`}).`
          : undefined,
        variant: json.errores?.length ? "destructive" : undefined,
      });
    } catch (err: any) {
      toast({ title: "No se pudo cargar el mes", description: err.message, variant: "destructive" });
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    // En celular son dos filas limpias —el mes arriba, las acciones abajo— en vez
    // de dejar que el botón de respaldo se descuelgue solo por el flex-wrap.
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
      {hayErp ? (
        <Select value={mesActual} onValueChange={setMes}>
          <SelectTrigger className="h-11 sm:h-9 w-full sm:w-[11rem] rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-base sm:text-sm font-semibold">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {porAnio(disponibles).map(({ anio, meses }) => (
              <SelectGroup key={anio}>
                <SelectLabel className="text-[11px] uppercase tracking-wider text-slate-400">{anio}</SelectLabel>
                {meses.map((p) => (
                  <SelectItem key={p.periodo} value={p.periodo}>{etiquetaPeriodo(p.periodo)}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input type="month" value={mesActual} onChange={(e) => setMes(e.target.value)}
          className="h-11 sm:h-9 w-full sm:w-[10rem] rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-base sm:text-sm focus-visible:border-[#fd6301]" />
      )}

      <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />

      {hayErp ? (
        <div className="flex items-center gap-2">
          <Button onClick={() => traer.mutate()} disabled={traer.isPending || !mesActual}
            className="h-11 sm:h-9 flex-1 sm:flex-none rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25">
            <RefreshCw className={`w-4 h-4 mr-2 ${traer.isPending ? "animate-spin" : ""}`} />
            {traer.isPending ? "Trayendo…" : "Traer del ERP"}
          </Button>
          <Button variant="ghost" size="icon" title="Cargar el mes desde un archivo"
            onClick={() => input.current?.click()} disabled={subiendo}
            className="h-11 w-11 sm:h-9 sm:w-9 flex-shrink-0 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button onClick={() => input.current?.click()} disabled={subiendo || !mesActual}
          className="h-11 sm:h-9 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25">
          <Upload className="w-4 h-4 mr-2" /> {subiendo ? "Cargando…" : "Cargar mes"}
        </Button>
      )}
    </div>
  );
}

// ─── Estado de resultados ───

function EstadoDeResultados({ datos, loading }: { datos?: Resultado; loading: boolean }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!datos) return <Vacio texto="Elegí un mes para ver el resultado." />;

  const alternar = (clave: string) => setAbiertos((a) => ({ ...a, [clave]: !a[clave] }));

  return (
    <div className="space-y-4">
      {/* Las líneas del resultado. Esto es lo que se mira primero. */}
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Más de 5 columnas: en celular la tabla se reemplaza por tarjetas. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* La primera columna va sin título: las líneas se nombran solas. */}
                  <TableHead />
                  <TableHead className={CABECERA_TABLA}>{etiquetaPeriodo(datos.periodo)}</TableHead>
                  <TableHead className={CABECERA_TABLA}>
                    {etiquetaPeriodo(datos.periodoAnterior)}
                    {!datos.periodoAnteriorCargado && (
                      <span className="block text-[10px] font-normal normal-case text-amber-600">sin cargar</span>
                    )}
                  </TableHead>
                  <TableHead className={CABECERA_TABLA}>Variación</TableHead>
                  <TableHead className={CABECERA_TABLA}>
                    Acumulado año
                    {datos.mesesAcumulados < datos.mesesDelAcumulado && (
                      <span className="block text-[10px] font-normal normal-case text-amber-600">
                        {datos.mesesAcumulados} de {datos.mesesDelAcumulado} meses
                      </span>
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.lineas.map((l) => {
                  // Sin el mes anterior cargado no hay contra qué comparar: la
                  // variación sería contra cero y daría siempre ±100%.
                  const v = datos.periodoAnteriorCargado ? variacion(l.mes, l.anterior) : null;
                  const fuerte = l.tipo !== "grupo";
                  return (
                    <TableRow key={l.clave} className={l.tipo === "total" ? "bg-orange-50/70 dark:bg-orange-950/20" : undefined}>
                      <TableCell className={fuerte ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}>
                        {l.etiqueta}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${fuerte ? "font-semibold" : ""} ${l.clave === "resultado" && l.mes < 0 ? "text-red-600" : ""}`}>
                        {montoConSigno(l.mes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">
                        {datos.periodoAnteriorCargado ? montoConSigno(l.anterior) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-sm ${v?.startsWith("−") ? "text-red-600" : "text-[#fd6301]"}`}>
                        {v ?? "—"}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${fuerte ? "font-semibold" : ""}`}>{montoConSigno(l.acumulado)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {datos.lineas.map((l) => (
              <div key={l.clave} className={`px-4 py-3 ${l.tipo === "total" ? "bg-orange-50/70 dark:bg-orange-950/20" : ""}`}>
                <p className={l.tipo !== "grupo" ? "font-semibold text-slate-900 dark:text-white text-sm" : "text-sm text-slate-600 dark:text-slate-300"}>
                  {l.etiqueta}
                </p>
                {/* Apilado y no en dos columnas: el acumulado creció al tener que
                    decir cuántos meses cubre, y al lado del monto se pisaban. */}
                <p className={`tabular-nums font-semibold mt-1 ${l.clave === "resultado" && l.mes < 0 ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
                  {montoConSigno(l.mes)}
                </p>
                <p className="text-xs text-slate-400 tabular-nums">
                  acumulado {montoConSigno(l.acumulado)}
                  {datos.mesesAcumulados < datos.mesesDelAcumulado && (
                    <span className="text-amber-600"> · {datos.mesesAcumulados}/{datos.mesesDelAcumulado} meses</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* El detalle, plegado: gran cuenta → mayor → cuenta. */}
      {datos.grupos.map((g) => (
        <Card key={g.granCuenta} className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* El monto no se va al borde de la tarjeta: la fila se corta en FILA_DETALLE
              para que la cifra quede cerca del nombre y las tres secciones alineadas. */}
          <button type="button" onClick={() => alternar(g.granCuenta)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <span className={`flex items-center gap-3 ${FILA_DETALLE}`}>
              <span className="flex items-center gap-2 flex-1 text-left">
                {abiertos[g.granCuenta] ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                {/* Mismo cuerpo y peso que las etiquetas de la tabla de arriba. */}
                <span className="text-sm font-semibold text-slate-900 dark:text-white break-words">{g.nombre}</span>
                <Badge variant="outline" className="rounded-full text-[11px] font-mono flex-shrink-0">{g.granCuenta}</Badge>
              </span>
              {/* Mismo cuerpo que los montos de la tabla de arriba. */}
              <span className={`tabular-nums text-sm font-semibold text-slate-900 dark:text-white ${COLUMNA_MONTO}`}>{montoConSigno(g.mes)}</span>
            </span>
          </button>
          {abiertos[g.granCuenta] && (
            <div className="border-t border-slate-100 dark:border-slate-800">
              {g.mayores.map((m) => (
                <div key={m.mayor}>
                  <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-800/30">
                    <div className={`flex items-center gap-3 ${FILA_DETALLE}`}>
                      {/* Nivel mayor: se lee como "Resultado operacional" en la tabla. */}
                      <span className="text-sm font-semibold text-slate-900 dark:text-white flex-1 break-words">{m.nombre}</span>
                      <span className={`tabular-nums text-sm font-semibold text-slate-900 dark:text-white ${COLUMNA_MONTO}`}>{montoConSigno(m.mes)}</span>
                    </div>
                  </div>
                  {m.cuentas.map((c) => (
                    <div key={c.codigo} className="px-4 py-2 text-sm border-t border-slate-50 dark:border-slate-800/50">
                      <div className={`flex items-center gap-3 ${FILA_DETALLE}`}>
                        <span className="flex-1 break-words pl-4 text-slate-600 dark:text-slate-300">
                          <span className="font-mono text-[11px] text-slate-400 mr-2">{c.codigo}</span>{c.nombre}
                        </span>
                        <span className={`tabular-nums text-slate-700 dark:text-slate-200 ${COLUMNA_MONTO}`}>{montoConSigno(c.mes)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
      <CardContent className="py-12 text-center text-sm text-slate-500">{texto}</CardContent>
    </Card>
  );
}

// ─── Presupuesto ───

/**
 * Sólo ingresos, y la pantalla dice por qué.
 *
 * El presupuesto que existe es de ventas por vendedor y unidad de negocio
 * (`info-extra/PRESUPUESTO 2026.csv`): no trae una sola línea de gastos ni está
 * expresado en cuentas contables. Mostrar una columna de meta vacía para los
 * gastos se leería como "no cumplimos", que es distinto de "no hay meta".
 */
function Presupuesto({ periodo, resultado }: { periodo: string; resultado?: Resultado }) {
  const { toast } = useToast();
  const [borrador, setBorrador] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{
    periodo: string;
    filas: { cuentaCodigo: string; monto: string }[];
    cuentasIngreso: { codigo: string; nombre: string }[];
    nota: string;
  }>({
    queryKey: ["/api/finanzas/balance/presupuesto", { periodo }],
    enabled: !!periodo,
  });

  const guardar = useMutation({
    mutationFn: async ({ cuentaCodigo, monto }: { cuentaCodigo: string; monto: string }) => {
      const res = await apiRequest("/api/finanzas/balance/presupuesto", {
        method: "PUT", data: { periodo, cuentaCodigo, monto },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/presupuesto"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/resultado"] });
      toast({ title: "Meta guardada" });
    },
    onError: (err: any) => toast({ title: "No se pudo guardar", description: err.message, variant: "destructive" }),
  });

  if (!periodo) return <Vacio texto="Elegí un mes para cargar su presupuesto." />;
  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  const real = new Map<string, number>();
  for (const g of resultado?.grupos ?? []) {
    for (const m of g.mayores) for (const c of m.cuentas) real.set(c.codigo, c.mes);
  }
  const guardado = new Map((data?.filas ?? []).map((f) => [f.cuentaCodigo, Number(f.monto)]));

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/30">
        <CardContent className="py-3 flex items-start gap-3 text-sm">
          <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <p className="text-slate-600 dark:text-slate-300">
            {data?.nota} Por eso acá sólo se compara la línea de <strong>ingresos</strong>:
            los gastos quedan sin meta hasta que el cliente mande un presupuesto por cuenta.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta de ingreso</TableHead>
                  <TableHead className="text-right">Meta del mes</TableHead>
                  <TableHead className="text-right">Real</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.cuentasIngreso ?? []).map((c) => {
                  const meta = guardado.get(c.codigo) ?? 0;
                  const obtenido = real.get(c.codigo) ?? 0;
                  const diferencia = obtenido - meta;
                  const valor = borrador[c.codigo] ?? (meta ? String(meta) : "");
                  return (
                    <TableRow key={c.codigo}>
                      <TableCell>
                        <span className="font-mono text-[11px] text-slate-400 mr-2">{c.codigo}</span>{c.nombre}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          value={valor} inputMode="numeric" placeholder="0"
                          onChange={(e) => setBorrador((b) => ({ ...b, [c.codigo]: e.target.value }))}
                          onBlur={() => {
                            if (valor === (meta ? String(meta) : "")) return;
                            guardar.mutate({ cuentaCodigo: c.codigo, monto: valor || "0" });
                          }}
                          className="h-9 w-40 ml-auto text-right tabular-nums rounded-xl bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:border-[#fd6301]" />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCLP(obtenido)}</TableCell>
                      {/* La diferencia del presupuesto va SIEMPRE en naranjo, esté sobre
                          o bajo la meta: el signo ya dice si falta (regla de diseño). */}
                      <TableCell className="text-right tabular-nums text-[#fd6301]">
                        {meta ? montoConSigno(diferencia) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.cuentasIngreso ?? []).map((c) => {
              const meta = guardado.get(c.codigo) ?? 0;
              const obtenido = real.get(c.codigo) ?? 0;
              const valor = borrador[c.codigo] ?? (meta ? String(meta) : "");
              return (
                <div key={c.codigo} className="px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{c.nombre}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={valor} inputMode="numeric" placeholder="Meta del mes"
                      onChange={(e) => setBorrador((b) => ({ ...b, [c.codigo]: e.target.value }))}
                      onBlur={() => {
                        if (valor === (meta ? String(meta) : "")) return;
                        guardar.mutate({ cuentaCodigo: c.codigo, monto: valor || "0" });
                      }}
                      className="h-9 flex-1 text-right tabular-nums rounded-xl bg-slate-50/60 dark:bg-slate-800/60" />
                    <span className="text-sm tabular-nums text-slate-500 w-28 text-right">{formatCLP(obtenido)}</span>
                  </div>
                  {meta > 0 && (
                    <p className="text-xs tabular-nums text-[#fd6301]">
                      Diferencia: {montoConSigno(obtenido - meta)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Personal: contabilidad contra Talana ───

/**
 * La pregunta: ¿lo que la contabilidad cargó por gente calza con lo que Talana
 * pagó? No se puede comparar cuenta a cuenta —el costo empresa de Talana viene
 * todo junto por persona y la contabilidad separa remuneración de indemnización—
 * así que se compara por ÁREA, que es el corte que los dos lados comparten.
 */
function PersonalVsTalana({ periodo }: { periodo: string }) {
  const { toast } = useToast();
  const [asignando, setAsignando] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<Personal>({
    queryKey: ["/api/finanzas/balance/personal", { periodo }],
    enabled: !!periodo,
  });

  // El PUT reemplaza la lista completa de (concepto, tipo), así que los dos
  // lados del puente —centros de costo y cuentas— se asignan igual.
  const mapear = useMutation({
    mutationFn: async ({ concepto, tipo, valores }: { concepto: string; tipo: "cuenta" | "centro_costo"; valores: string[] }) => {
      const res = await apiRequest("/api/finanzas/balance/puente-personal", {
        method: "PUT", data: { concepto, tipo, valores },
      });
      return res.json();
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/personal"] });
      toast({ title: v.tipo === "cuenta" ? "Cuenta asignada al área" : "Centro de costo asignado" });
    },
    onError: (err: any) => toast({ title: "No se pudo asignar", description: err.message, variant: "destructive" }),
  });

  if (!periodo) return <Vacio texto="Elegí un mes para cruzar con Talana." />;
  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!data) return <Vacio texto="Sin datos para este mes." />;

  const asignar = (centro: string, concepto: string) => {
    const actual = data.conceptos.find((c) => c.concepto === concepto)?.centrosCosto ?? [];
    mapear.mutate({ concepto, tipo: "centro_costo", valores: [...actual, centro] });
  };

  const asignarCuenta = (codigo: string, concepto: string) => {
    const actual = data.conceptos.find((c) => c.concepto === concepto)?.cuentas.map((x) => x.codigo) ?? [];
    mapear.mutate({ concepto, tipo: "cuenta", valores: [...actual, codigo] });
  };

  return (
    <div className="space-y-4">
      {!data.talana.ok && (
        <Card className="rounded-2xl border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-rose-800 dark:text-rose-300">Sin el lado de Talana</p>
              <p className="text-rose-700/90 dark:text-rose-300/80">{data.talana.error}</p>
              <p className="text-rose-700/70 dark:text-rose-300/60 mt-1">
                Talana no guarda historia acá: sólo se puede cruzar contra los períodos que su
                plataforma sigue exponiendo. El lado contable se muestra igual.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Contabilidad</TableHead>
                  <TableHead className="text-right">Talana</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Centros de costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.conceptos.map((c) => (
                  <TableRow key={c.concepto}>
                    <TableCell>
                      <p className="font-medium text-slate-900 dark:text-white">{c.nombre}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {c.cuentas.map((x) => x.codigo).join(" · ") || "sin cuentas"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCLP(c.contable)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.comparable ? formatCLP(c.talana) : <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${c.descuadra ? "text-red-600" : "text-slate-500"}`}>
                      {c.comparable ? montoConSigno(c.diferencia) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.centrosCosto.length
                        ? <span className="text-slate-600 dark:text-slate-300">{c.centrosCosto.join(", ")}</span>
                        // "Falta configurar" no es lo mismo que "cuadra": se dice.
                        : <span className="text-amber-600">Sin centro de costo asignado</span>}
                      {c.personas > 0 && <span className="text-slate-400"> · {c.personas} personas</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {data.conceptos.map((c) => (
              <div key={c.concepto} className="px-4 py-3">
                <p className="font-medium text-slate-900 dark:text-white text-sm">{c.nombre}</p>
                <div className="flex items-baseline justify-between mt-1 text-sm">
                  <span className="tabular-nums text-slate-700 dark:text-slate-200">{formatCLP(c.contable)}</span>
                  <span className={`tabular-nums font-semibold ${c.descuadra ? "text-red-600" : "text-slate-500"}`}>
                    {c.comparable ? montoConSigno(c.diferencia) : "sin mapear"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lo que Talana informó y nadie asignó. Si esto no se ve, el cruce miente
          por omisión: un área sin centros mapeados da diferencia = lo contable. */}
      {data.centrosSinMapear.length > 0 && (
        <Card className="rounded-2xl border-amber-200 dark:border-amber-900/60 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="px-4 py-3 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40">
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                {data.centrosSinMapear.length} centro(s) de costo sin asignar
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                Talana los informó en este mes y no están en ningún área, así que su costo no entra al cruce.
              </p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.centrosSinMapear.map((c) => (
                <div key={c.centroCosto} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.centroCosto}</p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {formatCLP(c.costoEmpresa)} · {c.personas} {c.personas === 1 ? "persona" : "personas"}
                    </p>
                  </div>
                  <Select
                    value={asignando[c.centroCosto] ?? ""}
                    onValueChange={(v) => {
                      setAsignando((a) => ({ ...a, [c.centroCosto]: v }));
                      asignar(c.centroCosto, v);
                    }}>
                    <SelectTrigger className="h-11 sm:h-9 w-full sm:w-56 rounded-xl border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Asignar a un área" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.conceptos.map((x) => (
                        <SelectItem key={x.concepto} value={x.concepto}>{x.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* El mismo agujero por el otro lado: gasto contable en gente que no entra
          al cruce. El puente se armó con las 77 cuentas del export viejo; el plan
          del ERP trae 30 de personal, y las que nadie asignó restarían del
          contable sin que se note. */}
      {data.cuentasSinMapear.length > 0 && (
        <Card className="rounded-2xl border-amber-200 dark:border-amber-900/60 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="px-4 py-3 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40">
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                {data.cuentasSinMapear.length} cuenta(s) de personal fuera del cruce
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                Tienen movimiento este mes y no están en ningún área, así que su gasto no se compara contra Talana.
              </p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.cuentasSinMapear.map((c) => (
                <div key={c.codigo} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.nombre}</p>
                    <p className="text-xs text-slate-400 tabular-nums font-mono">
                      {c.codigo} · {formatCLP(c.monto)}
                    </p>
                  </div>
                  <Select
                    value={asignando[c.codigo] ?? ""}
                    onValueChange={(v) => {
                      setAsignando((a) => ({ ...a, [c.codigo]: v }));
                      asignarCuenta(c.codigo, v);
                    }}>
                    <SelectTrigger className="h-11 sm:h-9 w-full sm:w-56 rounded-xl border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Asignar a un área" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.conceptos.map((x) => (
                        <SelectItem key={x.concepto} value={x.concepto}>{x.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Plan de cuentas ───

function Cuentas() {
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{
    cuentas: Cuenta[];
    posiblesDuplicados: { nombre: string; codigos: string[] }[];
    normalizadas: number;
  }>({ queryKey: ["/api/finanzas/balance/cuentas"] });

  const guardar = useMutation({
    mutationFn: async ({ codigo, nombreLargo }: { codigo: string; nombreLargo: string }) => {
      const res = await apiRequest(`/api/finanzas/balance/cuentas/${codigo}`, {
        method: "PUT", data: { nombreLargo },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/cuentas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/resultado"] });
      toast({ title: "Nombre actualizado" });
    },
    onError: (err: any) => toast({ title: "No se pudo guardar", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const duplicados = new Set((data?.posiblesDuplicados ?? []).flatMap((d) => d.codigos));
  const filtro = busqueda.trim().toLowerCase();
  const cuentas = (data?.cuentas ?? []).filter((c) =>
    !filtro || c.codigo.includes(filtro) || (c.nombreLargo || c.nombre).toLowerCase().includes(filtro));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código o nombre"
          className="h-10 max-w-xs rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:border-[#fd6301]" />
        <Badge className="rounded-full bg-[#fd6301] text-white border-0 px-3 py-1.5">
          {cuentas.length} de {data?.cuentas.length ?? 0} cuentas
        </Badge>
        {!!data?.normalizadas && (
          <span className="text-xs text-slate-500">
            {data.normalizadas} con el código corregido al importar
          </span>
        )}
      </div>

      {/* Nombres repetidos con códigos distintos: no es un error, el código manda,
          pero hay que preguntarle al cliente en qué se diferencian. */}
      {(data?.posiblesDuplicados.length ?? 0) > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-amber-800 dark:text-amber-300">
              <p className="font-semibold">Cuentas con el mismo nombre y distinto código</p>
              <ul className="mt-1 space-y-0.5">
                {data!.posiblesDuplicados.map((d) => (
                  <li key={d.nombre}>{d.nombre} — <span className="font-mono">{d.codigos.join(", ")}</span></li>
                ))}
              </ul>
              <p className="mt-1 text-amber-700/80">Hay que preguntarle al cliente en qué se diferencian.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {cuentas.map((c) => {
              const valor = editando[c.codigo] ?? (c.nombreLargo ?? "");
              return (
                <div key={c.codigo} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">{c.codigo}</span>
                      {c.codigo !== c.codigoErp && (
                        <Badge variant="outline" className="rounded-full text-[10px] border-slate-200 text-slate-500">
                          ERP: {c.codigoErp}
                        </Badge>
                      )}
                      {duplicados.has(c.codigo) && (
                        <Badge variant="outline" className="rounded-full text-[10px] border-amber-300 bg-amber-50 text-amber-700">
                          posible duplicado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{c.nombre}</p>
                    <p className="text-[11px] text-slate-400 truncate">{c.granCuentaNombre} · {c.mayorNombre}</p>
                  </div>
                  <Input
                    value={valor}
                    // El ERP trunca a 25 caracteres; el nombre legible es nuestro.
                    placeholder="Nombre completo (opcional)"
                    onChange={(e) => setEditando((x) => ({ ...x, [c.codigo]: e.target.value }))}
                    onBlur={() => {
                      if (valor === (c.nombreLargo ?? "")) return;
                      guardar.mutate({ codigo: c.codigo, nombreLargo: valor });
                    }}
                    className="h-9 w-full sm:w-72 rounded-xl bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:border-[#fd6301]" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
