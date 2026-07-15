import { useState, useMemo, Fragment, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCLP } from "@/lib/crm-seguimiento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, ChevronDown, ChevronRight, Users, FileText, Download, Percent, RotateCcw,
  Receipt, TrendingUp, Truck, Scale, BadgeDollarSign, SlidersHorizontal, type LucideIcon,
} from "lucide-react";

// ─── Tipos ───
interface CommissionItem {
  salesperson: string;
  netRevenue: number;
  netCost: number;
  netMargin: number;
  netMarginPct: number;
  // Regularización del flete (4% que asume la empresa)
  fleteObjetivo: number;
  fleteCobrado: number;
  fleteDeficit: number;
  marginAdjusted: number;
  marginAdjustedPct: number;
  lineCount: number;
  overriddenClientCount: number;
  commissionPct: number;
  commissionAmount: number;
}
interface CommissionTotals {
  netRevenue: number; netMargin: number;
  fleteObjetivo: number; fleteCobrado: number; fleteDeficit: number;
  marginAdjusted: number; commissionAmount: number;
}
interface CommissionSummary {
  startDate: string;
  endDate: string;
  items: CommissionItem[];
  totals: CommissionTotals;
}
interface DetailClient {
  client: string; revenue: number; cost: number; margin: number; lineCount: number;
  fleteCobrado: number; fleteObjetivo: number; fleteDeficit: number; marginAdjusted: number;
  overridePct: number | null; effectivePct: number;
}
interface DetailDocument {
  document: string; numero: string; client: string; fecha: string;
  revenue: number; cost: number; margin: number; lineCount: number;
  fleteCobrado: number; fleteObjetivo: number; fleteDeficit: number; marginAdjusted: number;
  overridePct: number | null; effectivePct: number; clientPct: number | null;
}
interface SalespersonDetail {
  salesperson: string; startDate: string; endDate: string; defaultPct: number;
  clients: DetailClient[]; documents: DetailDocument[];
}

// ─── Helpers de fecha ───
function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}
function lastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}
function yearRange() {
  const now = new Date();
  return { startDate: `${now.getFullYear()}-01-01`, endDate: isoDate(now) };
}
function formatFecha(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).slice(0, 10);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Comisiones() {
  const { toast } = useToast();
  const [{ startDate, endDate }, setRange] = useState(currentMonthRange());
  const [expanded, setExpanded] = useState<string | null>(null);
  // Buffer local del % que se está editando por vendedor
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({});

  const summaryKey = ["/api/hr/commissions/summary", startDate, endDate] as const;
  const { data: summary, isLoading } = useQuery<CommissionSummary>({
    queryKey: summaryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/hr/commissions/summary?startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("No se pudo cargar el resumen de comisiones");
      return res.json();
    },
  });

  const savePct = useMutation({
    mutationFn: async ({ salespersonName, commissionPct }: { salespersonName: string; commissionPct: number }) => {
      const res = await apiRequest("PUT", "/api/hr/commissions/settings", { salespersonName, commissionPct });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/summary"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo guardar el %", variant: "destructive" }),
  });

  const saveOverride = useMutation({
    mutationFn: async (payload: {
      salespersonName: string; overrideType: "client" | "document"; value: string; commissionPct: number | null;
    }) => {
      const res = await apiRequest("PUT", "/api/hr/commissions/overrides", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/salesperson"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo guardar el %", variant: "destructive" }),
  });

  const items = summary?.items || [];

  const commitPct = (salesperson: string, current: number) => {
    const raw = pctDraft[salesperson];
    if (raw === undefined) return;
    const value = parseFloat(raw.replace(",", "."));
    setPctDraft((prev) => { const p = { ...prev }; delete p[salesperson]; return p; });
    if (isNaN(value) || value < 0 || value > 100) {
      toast({ title: "Porcentaje inválido", description: "Ingresa un valor entre 0 y 100", variant: "destructive" });
      return;
    }
    if (value === current) return;
    savePct.mutate({ salespersonName: salesperson, commissionPct: value });
  };

  const exportCsv = () => {
    if (!items.length) return;
    const header = [
      "Vendedor", "Facturado neto", "Costo neto", "Margen neto",
      "Flete cobrado", "Flete objetivo 4%", "Regularización flete", "Margen ajustado",
      "% Comisión", "Comisión a pagar",
    ];
    const rows = items.map((it) => [
      it.salesperson, Math.round(it.netRevenue), Math.round(it.netCost), Math.round(it.netMargin),
      Math.round(it.fleteCobrado), Math.round(it.fleteObjetivo), Math.round(it.fleteDeficit), Math.round(it.marginAdjusted),
      it.commissionPct, Math.round(it.commissionAmount),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comisiones_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePreset = useMemo(() => {
    const cm = currentMonthRange(), lm = lastMonthRange(), yr = yearRange();
    if (startDate === cm.startDate && endDate === cm.endDate) return "current";
    if (startDate === lm.startDate && endDate === lm.endDate) return "last";
    if (startDate === yr.startDate && endDate === yr.endDate) return "year";
    return "custom";
  }, [startDate, endDate]);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/25">
            <DollarSign className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Comisiones de Vendedores</h1>
            <p className="text-sm text-muted-foreground">
              Comisión sobre el margen de lo facturado (FCV), tras regularizar el 4% de flete que asume la empresa.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!items.length}
          className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/40">
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Selector de período */}
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="inline-flex gap-1.5 bg-slate-100/70 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <PresetButton active={activePreset === "current"} onClick={() => setRange(currentMonthRange())}>Mes actual</PresetButton>
              <PresetButton active={activePreset === "last"} onClick={() => setRange(lastMonthRange())}>Mes anterior</PresetButton>
              <PresetButton active={activePreset === "year"} onClick={() => setRange(yearRange())}>Este año</PresetButton>
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Desde</label>
                <Input type="date" value={startDate} className="w-40"
                  onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Hasta</label>
                <Input type="date" value={endDate} className="w-40"
                  onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Receipt} label="Facturado neto (base)" value={formatCLP(summary?.totals.netRevenue)} loading={isLoading} accent="orange" />
        <KpiCard icon={TrendingUp} label="Margen neto total" value={formatCLP(summary?.totals.netMargin)} loading={isLoading} />
        <KpiCard icon={Truck} label="Regularización flete (4%)" value={formatCLP(summary?.totals.fleteDeficit)} loading={isLoading}
          sub={summary ? `Cobrado ${formatCLP(summary.totals.fleteCobrado)} · objetivo ${formatCLP(summary.totals.fleteObjetivo)}` : undefined}
          accent="amber" showMinus />
        <KpiCard icon={Scale} label="Margen ajustado (base comisión)" value={formatCLP(summary?.totals.marginAdjusted)} loading={isLoading} />
        <KpiCard icon={BadgeDollarSign} label="Comisión total a pagar" value={formatCLP(summary?.totals.commissionAmount)} loading={isLoading}
          accent="emerald" />
      </div>

      {/* Tabla principal */}
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-600" />
            Vendedores
            <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60">
              {items.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Facturado neto</TableHead>
                  <TableHead className="text-right">Costo neto</TableHead>
                  <TableHead className="text-right">Margen neto</TableHead>
                  <TableHead className="text-right">Flete cobrado</TableHead>
                  <TableHead className="text-right">Reg. flete 4%</TableHead>
                  <TableHead className="text-right">Margen ajustado</TableHead>
                  <TableHead className="text-right w-28">% Comisión</TableHead>
                  <TableHead className="text-right">Comisión a pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-slate-500 py-10">
                      No hay ventas facturadas en el período seleccionado.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && items.map((it) => {
                  const isOpen = expanded === it.salesperson;
                  const draft = pctDraft[it.salesperson];
                  return (
                    <Fragment key={it.salesperson}>
                      <TableRow
                        className={`cursor-pointer transition-colors ${isOpen ? "bg-orange-50/60 dark:bg-orange-950/20" : "hover:bg-orange-50/50 dark:hover:bg-orange-950/15"}`}
                        onClick={() => setExpanded(isOpen ? null : it.salesperson)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="w-4 h-4 text-orange-500" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{it.salesperson}</span>
                            {it.overriddenClientCount > 0 && (
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : it.salesperson); }}
                                      className="gap-1 cursor-help border-orange-300 bg-orange-50 text-orange-700 font-medium hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                                    >
                                      <SlidersHorizontal className="w-3 h-3" />
                                      {it.overriddenClientCount} {it.overriddenClientCount === 1 ? "cliente con % especial" : "clientes con % especial"}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-center">
                                    <p>
                                      {it.overriddenClientCount === 1
                                        ? "Uno de sus clientes tiene un % de comisión distinto al general de este vendedor"
                                        : `${it.overriddenClientCount} de sus clientes tienen un % de comisión distinto al general de este vendedor`}
                                      {" "}({it.commissionPct}%). No es un error: es un ajuste manual. Abre la fila para verlo.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCLP(it.netRevenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(it.netCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCLP(it.netMargin)}
                          <span className="text-xs text-slate-400 ml-1">({it.netMarginPct.toFixed(1)}%)</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(it.fleteCobrado)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.fleteDeficit > 0
                            ? <span className="text-rose-600">− {formatCLP(it.fleteDeficit)}</span>
                            : <span className="text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCLP(it.marginAdjusted)}
                          <span className="text-xs text-slate-400 ml-1">({it.marginAdjustedPct.toFixed(1)}%)</span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-flex items-center">
                            <Input
                              type="number" min={0} max={100} step={0.1}
                              value={draft !== undefined ? draft : String(it.commissionPct)}
                              className="w-20 h-8 text-right pr-5 tabular-nums"
                              onChange={(e) => setPctDraft((p) => ({ ...p, [it.salesperson]: e.target.value }))}
                              onBlur={() => commitPct(it.salesperson, it.commissionPct)}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            />
                            <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                          {formatCLP(it.commissionAmount)}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-slate-50/60 dark:bg-slate-900/40 p-0">
                            <SalespersonDetailPanel
                              salesperson={it.salesperson}
                              startDate={startDate}
                              endDate={endDate}
                              onSaveOverride={(overrideType, value, commissionPct) =>
                                saveOverride.mutate({ salespersonName: it.salesperson, overrideType, value, commissionPct })}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
              {!isLoading && items.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCLP(summary?.totals.netRevenue)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCLP(summary?.totals.netMargin)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-slate-500">{formatCLP(summary?.totals.fleteCobrado)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-rose-600">
                      {(summary?.totals.fleteDeficit || 0) > 0 ? `− ${formatCLP(summary?.totals.fleteDeficit)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCLP(summary?.totals.marginAdjusted)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-emerald-600">
                      {formatCLP(summary?.totals.commissionAmount)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Botón de preset de período con el look pill/naranja de Panorámica.
function PresetButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
        active
          ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

type KpiAccent = "slate" | "emerald" | "amber" | "orange";

const KPI_ACCENTS: Record<KpiAccent, {
  card: string; iconWrap: string; icon: string; value: string;
}> = {
  slate: {
    card: "border-slate-200 dark:border-slate-800",
    iconWrap: "bg-slate-100 dark:bg-slate-800",
    icon: "text-slate-500",
    value: "text-slate-900 dark:text-white",
  },
  orange: {
    card: "border-orange-200 bg-orange-50/40 dark:border-orange-900/50 dark:bg-orange-950/10",
    iconWrap: "bg-gradient-to-br from-orange-500 to-[#fd6301] shadow-sm shadow-orange-500/25",
    icon: "text-white",
    value: "text-slate-900 dark:text-white",
  },
  emerald: {
    card: "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-900/10",
    iconWrap: "bg-emerald-500/15",
    icon: "text-emerald-600",
    value: "text-emerald-600",
  },
  amber: {
    card: "border-amber-300 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-900/10",
    iconWrap: "bg-amber-500/15",
    icon: "text-amber-600",
    value: "text-amber-600",
  },
};

function KpiCard({ icon: Icon, label, value, loading, accent = "slate", showMinus, sub }: {
  icon?: LucideIcon; label: string; value: string; loading?: boolean;
  accent?: KpiAccent; showMinus?: boolean; sub?: string;
}) {
  const a = KPI_ACCENTS[accent];
  const displayValue = showMinus && value !== "$0" && value !== "—" ? `− ${value}` : value;
  return (
    <Card className={`rounded-2xl shadow-sm ${a.card}`}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          {Icon && (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${a.iconWrap}`}>
              <Icon className={`w-4 h-4 ${a.icon}`} />
            </span>
          )}
          <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
        </div>
        {loading ? <Skeleton className="h-8 w-32" />
          : <p className={`text-2xl font-bold tabular-nums ${a.value}`}>{displayValue}</p>}
        {sub && !loading && <p className="text-[11px] text-slate-400 mt-1 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// Celda editable de % de comisión por fila. `value` es el % efectivo que se
// aplica; `isOverride` indica si viene de un ajuste manual (para resaltarlo y
// ofrecer "revertir" al % por defecto). Poner 0 = no paga comisión.
function PctCell({ value, isOverride, onSave, onReset }: {
  value: number; isOverride: boolean;
  onSave: (pct: number) => void; onReset: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null ? draft : String(value);
  const commit = () => {
    if (draft === null) return;
    const raw = draft;
    setDraft(null);
    const v = parseFloat(raw.replace(",", "."));
    if (isNaN(v) || v < 0 || v > 100) return; // valor inválido: se descarta
    if (v === value && !isOverride) return;   // sin cambios respecto al efectivo
    onSave(v);
  };
  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      {isOverride && (
        <Badge variant="outline" className="hidden sm:inline-flex border-orange-300 bg-orange-50 text-orange-700 text-[10px] px-1.5 py-0 font-medium dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
          especial
        </Badge>
      )}
      <div className="relative inline-flex items-center">
        <Input
          type="number" min={0} max={100} step={0.1}
          value={shown}
          className={`w-20 h-8 text-right pr-5 tabular-nums ${isOverride ? "border-orange-400 text-orange-700 dark:text-orange-400 font-semibold" : ""}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
        <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={onReset}
        title="Volver al % por defecto del vendedor"
        className={`text-slate-300 hover:text-orange-600 transition-opacity ${isOverride ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SalespersonDetailPanel({ salesperson, startDate, endDate, onSaveOverride }: {
  salesperson: string; startDate: string; endDate: string;
  onSaveOverride: (type: "client" | "document", value: string, commissionPct: number | null) => void;
}) {
  const [tab, setTab] = useState<"clients" | "documents">("clients");
  const { data, isLoading } = useQuery<SalespersonDetail>({
    queryKey: ["/api/hr/commissions/salesperson", salesperson, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/hr/commissions/salesperson/${encodeURIComponent(salesperson)}?startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("No se pudo cargar el detalle");
      return res.json();
    },
  });

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex gap-1.5 bg-slate-100/70 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <button type="button" onClick={() => setTab("clients")}
            className={`inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === "clients" ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Users className="w-4 h-4 mr-1.5" /> Clientes ({data?.clients.length ?? 0})
          </button>
          <button type="button" onClick={() => setTab("documents")}
            className={`inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === "documents" ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <FileText className="w-4 h-4 mr-1.5" /> Ventas ({data?.documents.length ?? 0})
          </button>
        </div>
        {data && (
          <span className="text-xs text-slate-500 ml-auto">
            % por defecto del vendedor: <span className="font-semibold tabular-nums text-orange-600">{data.defaultPct}%</span> · edítalo por cliente o venta (0 = no paga)
          </span>
        )}
      </div>

      {isLoading && <Skeleton className="h-24 w-full" />}

      {!isLoading && tab === "clients" && (
        <div className="rounded-lg border bg-white dark:bg-slate-950 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Flete cobrado</TableHead>
                <TableHead className="text-right">Reg. flete 4%</TableHead>
                <TableHead className="text-right">Margen ajustado</TableHead>
                <TableHead className="text-right w-40">% Comisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.clients.map((c) => (
                <TableRow key={c.client} className={c.effectivePct === 0 ? "opacity-60" : ""}>
                  <TableCell>{c.client}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(c.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(c.margin)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(c.fleteCobrado)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.fleteDeficit > 0
                      ? <span className="text-rose-600">− {formatCLP(c.fleteDeficit)}</span>
                      : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCLP(c.marginAdjusted)}</TableCell>
                  <TableCell className="text-right">
                    <PctCell
                      value={c.effectivePct}
                      isOverride={c.overridePct !== null}
                      onSave={(pct) => onSaveOverride("client", c.client, pct)}
                      onReset={() => onSaveOverride("client", c.client, null)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {data && data.clients.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-6">Sin clientes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && tab === "documents" && (
        <div className="rounded-lg border bg-white dark:bg-slate-950 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Flete cobrado</TableHead>
                <TableHead className="text-right">Reg. flete 4%</TableHead>
                <TableHead className="text-right">Margen ajustado</TableHead>
                <TableHead className="text-right w-40">% Comisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.documents.map((d) => (
                <TableRow key={d.document} className={d.effectivePct === 0 ? "opacity-60" : ""}>
                  <TableCell>N° {d.numero}</TableCell>
                  <TableCell>{formatFecha(d.fecha)}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={d.client}>{d.client}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(d.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(d.margin)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500" title={`Objetivo 4%: ${formatCLP(d.fleteObjetivo)}`}>{formatCLP(d.fleteCobrado)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.fleteDeficit > 0
                      ? <span className="text-rose-600">− {formatCLP(d.fleteDeficit)}</span>
                      : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCLP(d.marginAdjusted)}</TableCell>
                  <TableCell className="text-right">
                    <PctCell
                      value={d.effectivePct}
                      isOverride={d.overridePct !== null}
                      onSave={(pct) => onSaveOverride("document", d.document, pct)}
                      onReset={() => onSaveOverride("document", d.document, null)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {data && data.documents.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-6">Sin ventas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
