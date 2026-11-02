import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  Layers,
  Users,
  DollarSign,
  Calculator,
  Minus,
  Eye,
  Grid3x3,
  Calendar,
  ShoppingBag,
  ChevronDown,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import { CostComparisonSection } from "@/components/finanzas/cost-comparison-section";
import TarjetaKpi from "@/components/dashboard/kpi-simple-card";
import { ICONO_CHIP_ICONO_SM, ICONO_CHIP_SM } from "@/lib/icono-chip";
import { KPI_VARIACION_COLOR } from "@/lib/kpi-tarjeta";

// ─── Types ───────────────────────────────────────────────────────────────────

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "months" | "day" | "days" | "custom-range";
  month?: number;
  months?: number[];
  days?: number[];
  startDate?: Date;
  endDate?: Date;
  display: string;
}

interface OverviewData {
  period: { startDate: string | null; endDate: string | null };
  prevPeriod: { startDate: string | null; endDate: string | null };
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  skuCount: number;
  lineCount: number;
  prev: {
    revenue: number;
    cost: number;
    margin: number;
    marginPct: number;
    skuCount: number;
  };
  deltas: {
    revenuePct: number | null;
    marginPct: number | null;
    marginPctPoints: number;
  };
}

interface AlertRow {
  sku: string;
  producto: string | null;
  revenue: number;
  qty: number;
  cost: number;
  marginAmount: number;
  marginPct: number;
}

interface SegmentRow {
  segment: string;
  revenue: number;
  cost: number;
  marginAmount: number;
  marginPct: number | null;
  lineCount: number;
  prevRevenue: number | null;
  prevMarginPct: number | null;
  marginPctDelta: number | null;
}

interface SalespersonRow {
  salesperson: string;
  segment: string | null;
  revenue: number;
  cost: number;
  marginAmount: number;
  marginPct: number | null;
  lineCount: number;
  prevRevenue: number | null;
  prevMarginPct: number | null;
  marginPctDelta: number | null;
}

interface TopProductRow {
  sku: string;
  producto: string | null;
  revenue: number;
  qty: number;
  cost: number;
  marginAmount: number;
  marginPct: number | null;
  pctOfTotal: number;
}

interface MarginDashboardData {
  overview: OverviewData;
  lowMarginAlerts: AlertRow[];
  threshold: number;
  bySegment: SegmentRow[];
  bySalesperson: SalespersonRow[];
  topProductos: TopProductRow[];
}

// ─── Threshold fijo al 45% ───────────────────────────────────────────────────
const FIXED_THRESHOLD = "45";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function selectionToApiPeriod(sel: YearMonthSelection | null): string {
  if (!sel) return "last-90-days";
  const year = sel.years[0] ?? new Date().getFullYear();
  if (sel.period === "full-year") return `year-${year}`;
  if ((sel.period === "month" || sel.period === "months") && sel.months && sel.months.length > 0) {
    const month = String(sel.months[0]).padStart(2, "0");
    return `month-${year}-${month}`;
  }
  return "last-90-days";
}

function defaultSelection(): YearMonthSelection {
  const now = new Date();
  return {
    years: [now.getFullYear()],
    period: "month",
    months: [now.getMonth() + 1],
    display: now.toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
  };
}

function fmtCLP(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
function fmtPctDelta(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}pp`;
}
function fmtInt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(Math.round(n));
}
function marginBadgeClass(pct: number | null): string {
  if (pct == null) return "bg-gray-100 text-gray-500 border-gray-200";
  if (pct >= 30) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pct >= 15) return "bg-amber-50 text-amber-700 border-amber-200";
  if (pct >= 0) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-red-50 text-red-700 border-red-200";
}
function deltaColor(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return "text-gray-400";
  if (Math.abs(delta) <= 0.1) return "text-gray-500";
  return KPI_VARIACION_COLOR(delta);
}
const fmtVariacion = (delta: number | null | undefined, sufijo: string) =>
  delta != null && Number.isFinite(delta) ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${sufijo}` : undefined;
const PANEL = "rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm";
function DeltaIcon({ delta }: { delta: number | null }) {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) <= 0.1) return <Minus className="h-3 w-3" />;
  return delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarginDashboard() {
  const { toast } = useToast();
  const [view, setView] = useState<"general" | "segment" | "salesperson">("general");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [periodSel, setPeriodSel] = useState<YearMonthSelection | null>(defaultSelection);
  const [topProductsLimit, setTopProductsLimit] = useState<number>(10);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState<boolean>(false);

  const period = selectionToApiPeriod(periodSel);
  const threshold = FIXED_THRESHOLD;

  // When view changes, clear sub-selections
  const handleViewChange = (v: "general" | "segment" | "salesperson") => {
    setView(v);
    setSelectedSegment("");
    setSelectedSalesperson("");
    setTopProductsLimit(10);
  };

  // Build filter params for API
  const apiSegment = view === "segment" && selectedSegment ? selectedSegment : undefined;
  const apiSalesperson = view === "salesperson" && selectedSalesperson ? selectedSalesperson : undefined;

  const { data, isLoading, error } = useQuery<MarginDashboardData>({
    queryKey: [`/api/etl/costos/margin-dashboard`, { period, threshold, segment: apiSegment, salesperson: apiSalesperson }],
    queryFn: async () => {
      const params = new URLSearchParams({ period, lowMarginThreshold: threshold });
      if (apiSegment) params.set("segment", apiSegment);
      if (apiSalesperson) params.set("salesperson", apiSalesperson);
      const res = await apiRequest(`/api/etl/costos/margin-dashboard?${params}`);
      return res.json();
    },
  });

  // Load unfiltered data to populate dropdowns
  const { data: baseData } = useQuery<MarginDashboardData>({
    queryKey: [`/api/etl/costos/margin-dashboard`, { period, threshold }],
    queryFn: async () => {
      const params = new URLSearchParams({ period, lowMarginThreshold: threshold });
      const res = await apiRequest(`/api/etl/costos/margin-dashboard?${params}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const segmentOptions = useMemo(
    () => Array.from(
      new Set(
        (baseData?.bySegment ?? [])
          .map(r => (r.segment ?? "").trim())
          .filter(s => s.length > 0)
      )
    ).sort(),
    [baseData]
  );
  const salespersonOptions = useMemo(
    () => Array.from(
      new Set(
        (baseData?.bySalesperson ?? [])
          .map(r => (r.salesperson ?? "").trim())
          .filter(s => s.length > 0)
      )
    ).sort(),
    [baseData]
  );

  const ov = data?.overview;
  const alerts = data?.lowMarginAlerts ?? [];
  const topProductos = data?.topProductos ?? [];
  const visibleTopProductos = topProductos.slice(0, topProductsLimit);

  // ─── Min / Max margin cards when a filter is active ────────────────────────
  const filterActive =
    (view === "segment" && !!selectedSegment) ||
    (view === "salesperson" && !!selectedSalesperson);

  const marginStats = useMemo(() => {
    if (!filterActive || !data) return null;

    // Cuando se filtra por vendedor: distribución por PRODUCTO de ese vendedor.
    // Cuando se filtra por segmento: distribución por vendedor dentro del segmento.
    if (view === "salesperson") {
      const rows = (data.topProductos ?? []).filter(p => p.marginPct != null);
      if (rows.length === 0) return null;
      const values = rows.map(p => p.marginPct as number);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const minRow = rows.find(p => p.marginPct === min);
      const maxRow = rows.find(p => p.marginPct === max);
      return {
        min,
        max,
        minLabel: minRow?.producto || minRow?.sku || "",
        maxLabel: maxRow?.producto || maxRow?.sku || "",
      };
    }

    const rows = data.bySalesperson.filter(r => r.marginPct != null);
    if (rows.length === 0) return null;
    const values = rows.map(r => r.marginPct as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const minRow = rows.find(r => r.marginPct === min);
    const maxRow = rows.find(r => r.marginPct === max);
    return { min, max, minLabel: minRow?.salesperson, maxLabel: maxRow?.salesperson };
  }, [data, filterActive, view]);

  // ─── Descarga del CSV ──────────────────────────────────────────────────────
  const handleDownloadCsv = () => {
    if (!data || !ov) {
      toast({
        title: "Sin datos",
        description: "Esperá a que termine de cargar el dashboard.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloadingCsv(true);
    try {
      const numEs = (n: number | null | undefined, decimals = 0) => {
        if (n == null || !Number.isFinite(n)) return "";
        return n.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      };
      const pctEs = (n: number | null | undefined, decimals = 1) => {
        if (n == null || !Number.isFinite(n)) return "";
        return `${numEs(n, decimals)}%`;
      };

      const periodLabel = periodSel?.display ?? period;
      const viewLabel = view === "general" ? "General" : view === "segment" ? "Por segmento" : "Por vendedor";
      const segmentFilter = view === "segment" ? (selectedSegment || "Todos los segmentos") : "";
      const salespersonFilter = view === "salesperson" ? (selectedSalesperson || "Todos los vendedores") : "";

      const rows: Array<Array<string>> = [];

      // Cabecera de contexto
      rows.push(["DASHBOARD DE MARGEN"]);
      rows.push(["Generado", new Date().toLocaleString("es-CL")]);
      rows.push(["Período", periodLabel]);
      rows.push(["Vista", viewLabel]);
      if (segmentFilter) rows.push(["Segmento", segmentFilter]);
      if (salespersonFilter) rows.push(["Vendedor", salespersonFilter]);
      rows.push([]);

      // KPIs
      rows.push(["KPIs"]);
      rows.push(["Indicador", "Valor"]);
      rows.push(["Ingresos netos (FCV − NCV)", numEs(ov.revenue)]);
      rows.push(["Costo total", numEs(ov.cost)]);
      rows.push(["Margen $", numEs(ov.margin)]);
      rows.push(["Margen %", pctEs(ov.marginPct)]);
      rows.push(["SKUs vendidos", numEs(ov.skuCount)]);
      rows.push([`SKUs en riesgo (margen < ${threshold}%)`, numEs(alerts.length)]);
      rows.push(["Δ Ingresos vs período anterior (%)", pctEs(ov.deltas.revenuePct)]);
      rows.push(["Δ Margen $ vs período anterior (%)", pctEs(ov.deltas.marginPct)]);
      rows.push(["Δ Margen % vs período anterior (pp)", numEs(ov.deltas.marginPctPoints, 1)]);
      if (filterActive && marginStats) {
        rows.push(["Margen mínimo (en filtro)", pctEs(marginStats.min)]);
        if (marginStats.minLabel) rows.push(["  ↳", marginStats.minLabel]);
        rows.push(["Margen máximo (en filtro)", pctEs(marginStats.max)]);
        if (marginStats.maxLabel) rows.push(["  ↳", marginStats.maxLabel]);
      }
      rows.push([]);

      // Alertas de margen bajo
      if (alerts.length > 0) {
        rows.push([`ALERTAS DE MARGEN BAJO (umbral ${threshold}%)`]);
        rows.push(["SKU", "Producto", "Unidades", "Ingresos", "Costo total", "Margen $", "Margen %"]);
        for (const a of alerts) {
          rows.push([
            a.sku,
            a.producto ?? "",
            numEs(a.qty),
            numEs(a.revenue),
            numEs(a.cost),
            numEs(a.marginAmount),
            pctEs(a.marginPct),
          ]);
        }
        rows.push([]);
      }

      // Top productos
      if (topProductos.length > 0) {
        rows.push([`TOP PRODUCTOS (${topProductos.length})`]);
        rows.push(["SKU", "Producto", "Unidades", "Ingresos", "Costo total", "Margen $", "Margen %", "% del total"]);
        for (const p of topProductos) {
          rows.push([
            p.sku,
            p.producto ?? "",
            numEs(p.qty),
            numEs(p.revenue),
            numEs(p.cost),
            numEs(p.marginAmount),
            pctEs(p.marginPct),
            pctEs(p.pctOfTotal),
          ]);
        }
        rows.push([]);
      }

      // Por segmento
      if (data.bySegment.length > 0) {
        rows.push(["MARGEN POR SEGMENTO"]);
        rows.push(["Segmento", "Ingresos", "Costo", "Margen $", "Margen %", "Δ vs prev (pp)"]);
        for (const s of data.bySegment) {
          rows.push([
            s.segment,
            numEs(s.revenue),
            numEs(s.cost),
            numEs(s.marginAmount),
            pctEs(s.marginPct),
            numEs(s.marginPctDelta, 1),
          ]);
        }
        rows.push([]);
      }

      // Por vendedor
      if (data.bySalesperson.length > 0) {
        rows.push(["MARGEN POR VENDEDOR"]);
        rows.push(["Vendedor", "Segmento", "Ingresos", "Costo", "Margen $", "Margen %", "Δ vs prev (pp)"]);
        for (const sp of data.bySalesperson) {
          rows.push([
            sp.salesperson,
            sp.segment ?? "",
            numEs(sp.revenue),
            numEs(sp.cost),
            numEs(sp.marginAmount),
            pctEs(sp.marginPct),
            numEs(sp.marginPctDelta, 1),
          ]);
        }
      }

      // Serializar
      const escape = (val: string) => {
        if (/[;"\n\r]/.test(val)) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      };
      const csv = rows.map(r => r.map(c => escape(String(c))).join(";")).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim().replace(/\s+/g, "-");
      const filterSuffix =
        view === "segment" && selectedSegment
          ? `_segmento-${safe(selectedSegment)}`
          : view === "salesperson" && selectedSalesperson
          ? `_vendedor-${safe(selectedSalesperson)}`
          : "";
      const periodSuffix = safe(periodLabel || "");
      const dateStr = new Date().toISOString().slice(0, 10);

      const link = document.createElement("a");
      link.href = url;
      link.download = `dashboard_margen${filterSuffix}_${periodSuffix}_${dateStr}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "CSV descargado",
        description: "Dashboard exportado correctamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error al descargar",
        description: error?.message || "No se pudo generar el CSV",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-sm">
        {/* Vista */}
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-[#fd6301] flex-shrink-0" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Vista:</span>
          <Select value={view} onValueChange={v => handleViewChange(v as any)}>
            <SelectTrigger className="h-9 w-44 rounded-lg border-gray-200 text-sm" data-testid="select-margin-view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="general">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                  <span>General</span>
                </div>
              </SelectItem>
              <SelectItem value="segment">
                <div className="flex items-center gap-2">
                  <Grid3x3 className="h-3.5 w-3.5 text-gray-500" />
                  <span>Por segmento</span>
                </div>
              </SelectItem>
              <SelectItem value="salesperson">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-gray-500" />
                  <span>Por vendedor</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Segmento selector */}
        {view === "segment" && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Segmento:</span>
            <Select value={selectedSegment || "__all__"} onValueChange={v => setSelectedSegment(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9 w-52 rounded-lg border-gray-200 text-sm" data-testid="select-margin-segment">
                <SelectValue placeholder="Todos los segmentos" />
              </SelectTrigger>
              <SelectContent className="rounded-lg max-h-60">
                <SelectItem value="__all__">Todos los segmentos</SelectItem>
                {segmentOptions.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Vendedor selector */}
        {view === "salesperson" && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Vendedor:</span>
            <Select value={selectedSalesperson || "__all__"} onValueChange={v => setSelectedSalesperson(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm" data-testid="select-margin-salesperson">
                <SelectValue placeholder="Todos los vendedores" />
              </SelectTrigger>
              <SelectContent className="rounded-lg max-h-60">
                <SelectItem value="__all__">Todos los vendedores</SelectItem>
                {salespersonOptions.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Período + Descarga */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#fd6301] flex-shrink-0" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Período:</span>
            <YearMonthSelector value={periodSel} onChange={setPeriodSel} />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownloadCsv}
            disabled={isDownloadingCsv || isLoading || !data}
            data-testid="button-margin-dashboard-export-csv"
            className="rounded-2xl border-slate-200 text-slate-700 hover:bg-white hover:border-orange-200 hover:text-[#fd6301]"
          >
            {isDownloadingCsv ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" />
                Descargar CSV
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-red-700 text-sm py-4">
            No se pudo cargar el dashboard de margen.
          </CardContent>
        </Card>
      )}

      {/* ── KPI Cards principales ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <TarjetaKpi
          titulo="Ingresos netos"
          icono={DollarSign}
          valor={isLoading ? "…" : ov ? fmtCLP(ov.revenue) : "—"}
          variacion={fmtVariacion(ov?.deltas.revenuePct, "%")}
          variacionEtiqueta={fmtVariacion(ov?.deltas.revenuePct, "%") ? "vs período anterior" : undefined}
        />
        <TarjetaKpi
          titulo="Margen $"
          icono={Calculator}
          valor={isLoading ? "…" : ov ? fmtCLP(ov.margin) : "—"}
          variacion={fmtVariacion(ov?.deltas.marginPct, "%")}
          variacionEtiqueta={fmtVariacion(ov?.deltas.marginPct, "%") ? "vs período anterior" : undefined}
        />
        <TarjetaKpi
          titulo="Margen %"
          icono={TrendingUp}
          valor={isLoading ? "…" : ov ? fmtPct(ov.marginPct) : "—"}
          variacion={fmtVariacion(ov?.deltas.marginPctPoints, "pp")}
          variacionEtiqueta={fmtVariacion(ov?.deltas.marginPctPoints, "pp") ? "vs período anterior" : undefined}
        />
        <TarjetaKpi
          titulo="SKUs en riesgo"
          icono={AlertTriangle}
          valor={isLoading ? "…" : `${alerts.length}`}
          variacionEtiqueta={`con margen < ${threshold}%`}
          detalles={ov ? [{ etiqueta: "SKUs vendidos", valor: fmtInt(ov.skuCount) }] : undefined}
        />
      </div>

      {/* ── Tarjetas Min / Max (solo cuando hay filtro activo) ────────────── */}
      {filterActive && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Margen Mínimo"
            value={isLoading ? null : marginStats ? fmtPct(marginStats.min) : "—"}
            sublabel={marginStats?.minLabel}
            colorClass="text-[#fd6301]"
            bgClass="bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800"
          />
          <StatCard
            label="Margen Máximo"
            value={isLoading ? null : marginStats ? fmtPct(marginStats.max) : "—"}
            sublabel={marginStats?.maxLabel}
            colorClass="text-[#fd6301]"
            bgClass="bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800"
          />
        </div>
      )}

      {/* ── Alertas de margen bajo ──────────────────────────────────────────── */}
      <Card className={PANEL}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={ICONO_CHIP_SM}><AlertTriangle className={ICONO_CHIP_ICONO_SM} /></span>
            Alertas de margen bajo
          </CardTitle>
          <CardDescription>
            SKUs con margen real por debajo de {threshold}% en el período seleccionado. Ordenados por margen ascendente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando alertas...
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              Sin alertas — todos los SKUs vendidos están sobre el umbral.
            </div>
          ) : (
            <>
            {/* Celular: siete columnas no entran, van como tarjetas. */}
            <div className="md:hidden space-y-2 px-3 pb-3" data-testid="margen-alertas-lista">
              {alerts.map(a => (
                <div key={a.sku} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{a.producto || a.sku}</p>
                    <Badge variant="outline" className={`${marginBadgeClass(a.marginPct)} shrink-0`}>{fmtPct(a.marginPct)}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-300">{a.sku} · {fmtInt(a.qty)} unid.</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm tabular-nums">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Ingresos</p>
                      <p className="text-slate-800 dark:text-slate-100">{fmtCLP(a.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Costo total</p>
                      <p className="text-[#fd6301]">{fmtCLP(a.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Margen $</p>
                      <p className={a.marginAmount < 0 ? "text-red-600 font-semibold" : "text-slate-800 dark:text-slate-100"}>{fmtCLP(a.marginAmount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-slate-800">
                  <TableHead className="text-xs font-semibold text-slate-600 dark:text-slate-300">SKU</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 dark:text-slate-300">Producto</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Unidades</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Ingresos</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Costo total</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Margen $</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Margen %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map(a => (
                  <TableRow key={a.sku} className="text-sm" data-testid={`row-alert-${a.sku}`}>
                    <TableCell className="font-mono text-xs py-2">{a.sku}</TableCell>
                    <TableCell className="py-2">
                      {a.producto || <span className="italic text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums py-2">{fmtInt(a.qty)}</TableCell>
                    <TableCell className="text-right tabular-nums py-2">{fmtCLP(a.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums py-2 text-[#fd6301]">{fmtCLP(a.cost)}</TableCell>
                    <TableCell className={`text-right tabular-nums py-2 ${a.marginAmount < 0 ? "text-red-600 font-semibold" : ""}`}>
                      {fmtCLP(a.marginAmount)}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Badge variant="outline" className={marginBadgeClass(a.marginPct)}>
                        {fmtPct(a.marginPct)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Top Productos ───────────────────────────────────────────────────── */}
      <Card className={PANEL}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={ICONO_CHIP_SM}><ShoppingBag className={ICONO_CHIP_ICONO_SM} /></span>
              Top Productos
            </CardTitle>
            {filterActive && (
              <span className="text-xs text-gray-500">
                {view === "segment"
                  ? `Segmento: ${selectedSegment}`
                  : `Vendedor: ${selectedSalesperson}`}
              </span>
            )}
          </div>
          <CardDescription>
            Productos vendidos {filterActive ? "filtrados por la selección actual" : "en el período"} con su margen real. Ordenados por ingresos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : topProductos.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              Sin productos para mostrar
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {visibleTopProductos.map((p) => (
                  <TopProductoCard key={p.sku} product={p} />
                ))}
              </div>
              {topProductos.length > topProductsLimit && (
                <div className="flex justify-center pt-4 mt-3 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTopProductsLimit(prev => prev + 10)}
                    className="text-xs px-6"
                    data-testid="button-load-more-top-productos"
                  >
                    Ver más ({visibleTopProductos.length} de {topProductos.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Comparativas ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        {/* Por segmento */}
        <Card className={PANEL}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={ICONO_CHIP_SM}><Layers className={ICONO_CHIP_ICONO_SM} /></span>
              Margen por segmento
            </CardTitle>
            <CardDescription>Comparativo con período anterior. Δpp = puntos porcentuales.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
              </div>
            ) : !data || data.bySegment.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">Sin datos</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold text-slate-600 dark:text-slate-300">Segmento</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Ingresos</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Margen $</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Margen %</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Δ vs prev.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySegment.map(r => (
                    <TableRow key={r.segment} className="text-sm">
                      <TableCell className="font-medium py-2">{r.segment}</TableCell>
                      <TableCell className="text-right tabular-nums py-2">{fmtCLP(r.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums py-2">{fmtCLP(r.marginAmount)}</TableCell>
                      <TableCell className="text-right py-2">
                        <Badge variant="outline" className={marginBadgeClass(r.marginPct)}>
                          {fmtPct(r.marginPct)}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right py-2 tabular-nums ${deltaColor(r.marginPctDelta)}`}>
                        <span className="inline-flex items-center gap-1 justify-end">
                          <DeltaIcon delta={r.marginPctDelta} />
                          {fmtPctDelta(r.marginPctDelta)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Por vendedor */}
        <Card className={PANEL}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={ICONO_CHIP_SM}><Users className={ICONO_CHIP_ICONO_SM} /></span>
              Margen por vendedor
            </CardTitle>
            <CardDescription>Top 50 por ingresos. Segmento del vendedor vía supervisor.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
              </div>
            ) : !data || data.bySalesperson.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">Sin datos</div>
            ) : (
              <div className="max-h-[460px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 sticky top-0 z-10">
                      <TableHead className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vendedor</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 dark:text-slate-300">Segmento</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Ingresos</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Margen %</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Δ vs prev.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bySalesperson.map(r => (
                      <TableRow key={r.salesperson} className="text-sm">
                        <TableCell className="font-medium py-2">
                          {r.salesperson}
                        </TableCell>
                        <TableCell className="py-2 text-gray-600">
                          {r.segment || <span className="italic text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2">{fmtCLP(r.revenue)}</TableCell>
                        <TableCell className="text-right py-2">
                          <Badge variant="outline" className={marginBadgeClass(r.marginPct)}>
                            {fmtPct(r.marginPct)}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right py-2 tabular-nums ${deltaColor(r.marginPctDelta)}`}>
                          <span className="inline-flex items-center gap-1 justify-end">
                            <DeltaIcon delta={r.marginPctDelta} />
                            {fmtPctDelta(r.marginPctDelta)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Costo vs Venta FCV (tabla detallada) ───────────────────────────── */}
      <CostComparisonSection
        period={period}
        salesperson={apiSalesperson ?? ""}
        segment={apiSegment ?? ""}
        hideFilters
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopProductoCard({ product }: { product: TopProductRow }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, Math.min(100, product.pctOfTotal));
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 sm:px-4 py-3 hover:bg-orange-50/60 dark:hover:bg-slate-800 transition-colors text-left"
        data-testid={`top-product-${product.sku}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 dark:text-slate-100 font-medium">
              {product.producto || product.sku}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <span className="text-sm text-gray-600 dark:text-gray-300 w-12 text-right flex-shrink-0 tabular-nums">
              {pct.toFixed(1)}%
            </span>
            <div className="flex-1 sm:flex-none sm:w-32">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#fd6301] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <Badge variant="outline" className={`${marginBadgeClass(product.marginPct)} text-xs px-2 py-0 h-6 flex-shrink-0`}>
              {fmtPct(product.marginPct)}
            </Badge>
            <span className="text-sm font-semibold text-gray-900 dark:text-white w-24 sm:w-28 text-right flex-shrink-0 tabular-nums">
              {fmtCLP(product.revenue)}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 uppercase tracking-wide">SKU</p>
            <p className="text-sm font-mono font-semibold text-gray-900 break-all">{product.sku}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Unidades</p>
            <p className="text-sm font-bold text-gray-900 tabular-nums">{fmtInt(product.qty)}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Costo total</p>
            <p className="text-sm font-bold text-[#fd6301] tabular-nums">{fmtCLP(product.cost)}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Margen $</p>
            <p className={`text-sm font-bold tabular-nums ${product.marginAmount < 0 ? "text-red-600" : "text-gray-900"}`}>
              {fmtCLP(product.marginAmount)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  colorClass,
  bgClass,
}: {
  label: string;
  value: string | null;
  sublabel?: string;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={`rounded-2xl border shadow-sm px-4 py-3 ${bgClass}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-1">{label}</div>
      {value === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <>
          <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
          {sublabel && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{sublabel}</div>
          )}
        </>
      )}
    </div>
  );
}
