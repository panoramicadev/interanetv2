/**
 * Balance — estado de resultados, presupuesto y cruce con Talana
 * ---------------------------------------------------------------
 * ⚠️ Es un estado de RESULTADOS, no un balance general: el plan de cuentas que
 * entregó el cliente sólo trae ingresos (41) y egresos (51, 52). Sin cuentas de
 * activo, pasivo ni patrimonio no hay estado de situación, y la pantalla lo dice
 * arriba en vez de dejar que alguien lo suponga.
 *
 * Backend: server/routes-balance.ts (permiso `finanzas.balance`, solo admin).
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Scale, CalendarDays, TrendingUp, TrendingDown, Users, Upload, Download,
  AlertTriangle, ChevronRight, ChevronDown, Target, ListTree, Info,
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
  cargado: { periodo: string; estado: string; origen: string; archivoNombre: string | null } | null;
  grupos: GrupoResultado[]; lineas: LineaResultado[];
}
interface Estado {
  cuentas: number; periodos: string[]; ultimoPeriodo: string | null;
  talanaConfigurado: boolean; soloResultado: boolean;
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

/** Variación contra el mes anterior. Sin base no hay porcentaje, y se dice. */
function variacion(actual: number, anterior: number): string | null {
  if (!anterior) return null;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

export default function BalancePage() {
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Balance</h1>
            <p className="text-sm text-muted-foreground hidden md:block">
              Estado de resultados mes a mes, con el presupuesto de ventas y el gasto en gente contrastado contra Talana.
            </p>
          </div>
        </div>
        <Button
          variant="outline" size="sm" disabled={!periodoActual}
          onClick={() => window.open(`/api/finanzas/balance/export.csv?periodo=${periodoActual}`, "_blank")}
          className="rounded-2xl border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/40">
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Lo que el módulo NO es. Va arriba: el nombre "Balance" promete otra cosa. */}
      {estado?.soloResultado && (
        <Card className="rounded-2xl border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/30">
          <CardContent className="py-3 flex items-start gap-3 text-sm">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-slate-600 dark:text-slate-300">
              Esto es el <strong>estado de resultados</strong>: el plan de cuentas que entregó el cliente sólo
              trae ingresos y egresos. Para el estado de situación (activo, pasivo y patrimonio) faltan las
              cuentas 1, 2 y 3.
            </p>
          </CardContent>
        </Card>
      )}

      {sinPlan && <ImportarPlan onListo={() => setTab("cuentas")} />}

      {!sinPlan && (
        <>
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
                    <Select value={periodoActual} onValueChange={setPeriodo} disabled={sinPeriodos}>
                      <SelectTrigger className="h-5 border-0 shadow-none p-0 gap-2 w-auto min-w-[9rem] bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60">
                        <SelectValue placeholder={cargandoEstado ? "Cargando…" : "Sin meses cargados"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(estado?.periodos ?? []).slice().reverse().map((p) => (
                          <SelectItem key={p} value={p}>{etiquetaPeriodo(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {resultado?.cargado && (
                  <Badge variant="outline" className={resultado.cargado.estado === "cerrado"
                    ? "rounded-full border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "rounded-full border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"}>
                    {resultado.cargado.estado === "cerrado" ? "Mes cerrado" : "Borrador: se puede volver a cargar"}
                  </Badge>
                )}
                <div className="ml-auto">
                  <SubirSaldos periodoSugerido={periodoActual} />
                </div>
              </div>
            </CardContent>
          </Card>

          {sinPeriodos && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
              <CardContent className="py-4 flex items-start gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-amber-800 dark:text-amber-300">
                  El plan de cuentas está cargado pero todavía no hay ningún mes con saldos.
                  Subí el balance del mes con <strong>Cargar mes</strong> para ver el resultado.
                </p>
              </CardContent>
            </Card>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Kpi icon={TrendingUp} label="Ingresos operacionales" loading={cargandoResultado}
              value={formatCLP(ingresos?.mes ?? 0)}
              sub={ingresos ? `Acumulado año ${formatCLP(ingresos.acumulado)}` : undefined}
              variacion={ingresos ? variacion(ingresos.mes, ingresos.anterior) : null} />
            <Kpi icon={TrendingDown} label="Gastos del mes" loading={cargandoResultado}
              value={formatCLP(gastos?.mes ?? 0)}
              variacion={gastos ? variacion(gastos.mes, gastos.anterior) : null} />
            <Kpi icon={Scale} label="Margen bruto" loading={cargandoResultado}
              value={montoConSigno(margen?.mes ?? 0)}
              sub={ingresos?.mes ? `${((margen?.mes ?? 0) / ingresos.mes * 100).toFixed(1)}% sobre ingresos` : undefined} />
            <Kpi icon={Target} label="Resultado del período" loading={cargandoResultado}
              value={montoConSigno(total?.mes ?? 0)}
              accent={(total?.mes ?? 0) < 0 ? "alerta" : "destacada"}
              sub={total ? `Acumulado año ${montoConSigno(total.acumulado)}` : undefined} />
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
          <p className="text-xs font-medium text-slate-500 leading-tight min-w-0">{label}</p>
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
function ImportarPlan({ onListo }: { onListo: () => void }) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

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

  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
      <CardContent className="py-10 flex flex-col items-center text-center gap-3">
        <span className="w-12 h-12 rounded-xl bg-[#fd6301] text-white flex items-center justify-center shadow-md shadow-[#fd6301]/25">
          <ListTree className="w-6 h-6" />
        </span>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Todavía no hay plan de cuentas</p>
          <p className="text-sm text-slate-500 max-w-md mt-1">
            Subí el archivo de cuentas que exporta Softland (CGRANCUE, NOGRANCUE, CMAYOR, NOMAYOR,
            CUENTA, NOCUENTA). Los códigos que vienen con el mayor sin rellenar —como <code className="font-mono">5120 106</code>—
            se corrigen solos al importar.
          </p>
        </div>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
        <Button onClick={() => input.current?.click()} disabled={subiendo}
          className="rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25">
          <Upload className="w-4 h-4 mr-2" /> {subiendo ? "Importando…" : "Importar plan de cuentas"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Cargar los saldos de un mes ───

function SubirSaldos({ periodoSugerido }: { periodoSugerido: string }) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mes, setMes] = useState(() => periodoSugerido || new Date().toISOString().slice(0, 7));

  const subir = async (archivo: File) => {
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("file", archivo);
      form.append("periodo", mes);
      const res = await apiRequest("/api/finanzas/balance/saldos/importar", { method: "POST", data: form });
      const json = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/estado"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/resultado"] });
      toast({
        title: `${json.guardadas} cuentas cargadas en ${etiquetaPeriodo(mes)}`,
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
    <div className="flex items-center gap-2">
      <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
        className="h-9 w-[10rem] rounded-xl bg-slate-50/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:border-[#fd6301]" />
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
      <Button size="sm" onClick={() => input.current?.click()} disabled={subiendo || !mes}
        className="rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25">
        <Upload className="w-4 h-4 mr-2" /> {subiendo ? "Cargando…" : "Cargar mes"}
      </Button>
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
                  <TableHead>Línea</TableHead>
                  <TableHead className="text-right">{etiquetaPeriodo(datos.periodo)}</TableHead>
                  <TableHead className="text-right">{etiquetaPeriodo(datos.periodoAnterior)}</TableHead>
                  <TableHead className="text-right">Variación</TableHead>
                  <TableHead className="text-right">Acumulado año</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.lineas.map((l) => {
                  const v = variacion(l.mes, l.anterior);
                  const fuerte = l.tipo !== "grupo";
                  return (
                    <TableRow key={l.clave} className={l.tipo === "total" ? "bg-orange-50/70 dark:bg-orange-950/20" : undefined}>
                      <TableCell className={fuerte ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}>
                        {l.etiqueta}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${fuerte ? "font-semibold" : ""} ${l.clave === "resultado" && l.mes < 0 ? "text-red-600" : ""}`}>
                        {montoConSigno(l.mes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">{montoConSigno(l.anterior)}</TableCell>
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
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`tabular-nums font-semibold ${l.clave === "resultado" && l.mes < 0 ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
                    {montoConSigno(l.mes)}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    acumulado {montoConSigno(l.acumulado)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* El detalle, plegado: gran cuenta → mayor → cuenta. */}
      {datos.grupos.map((g) => (
        <Card key={g.granCuenta} className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
          <button type="button" onClick={() => alternar(g.granCuenta)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <span className="flex items-center gap-2 min-w-0">
              {abiertos[g.granCuenta] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              <span className="font-semibold text-slate-900 dark:text-white truncate">{g.nombre}</span>
              <Badge variant="outline" className="rounded-full text-[11px] font-mono">{g.granCuenta}</Badge>
            </span>
            <span className="tabular-nums font-semibold text-slate-900 dark:text-white flex-shrink-0">{montoConSigno(g.mes)}</span>
          </button>
          {abiertos[g.granCuenta] && (
            <div className="border-t border-slate-100 dark:border-slate-800">
              {g.mayores.map((m) => (
                <div key={m.mayor}>
                  <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-50/70 dark:bg-slate-800/30">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{m.nombre}</span>
                    <span className="tabular-nums text-sm font-medium flex-shrink-0">{montoConSigno(m.mes)}</span>
                  </div>
                  {m.cuentas.map((c) => (
                    <div key={c.codigo} className="flex items-center justify-between gap-3 px-4 py-2 pl-8 text-sm border-t border-slate-50 dark:border-slate-800/50">
                      <span className="truncate text-slate-600 dark:text-slate-300">
                        <span className="font-mono text-[11px] text-slate-400 mr-2">{c.codigo}</span>{c.nombre}
                      </span>
                      <span className="tabular-nums flex-shrink-0 text-slate-700 dark:text-slate-200">{montoConSigno(c.mes)}</span>
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

  const mapear = useMutation({
    mutationFn: async ({ concepto, valores }: { concepto: string; valores: string[] }) => {
      const res = await apiRequest("/api/finanzas/balance/puente-personal", {
        method: "PUT", data: { concepto, tipo: "centro_costo", valores },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finanzas/balance/personal"] });
      toast({ title: "Centro de costo asignado" });
    },
    onError: (err: any) => toast({ title: "No se pudo asignar", description: err.message, variant: "destructive" }),
  });

  if (!periodo) return <Vacio texto="Elegí un mes para cruzar con Talana." />;
  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!data) return <Vacio texto="Sin datos para este mes." />;

  const asignar = (centro: string, concepto: string) => {
    const actual = data.conceptos.find((c) => c.concepto === concepto)?.centrosCosto ?? [];
    mapear.mutate({ concepto, valores: [...actual, centro] });
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
                    <SelectTrigger className="h-9 w-full sm:w-56 rounded-xl border-slate-200 dark:border-slate-700">
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
