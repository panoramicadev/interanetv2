import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCLP } from "@/lib/crm-seguimiento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, ChevronDown, ChevronRight, Users, FileText, Download, Percent, RotateCcw, Truck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ─── Tipos ───
interface CommissionItem {
  salesperson: string;
  grossRevenue: number;
  netRevenue: number;
  grossCost: number;
  netCost: number;
  grossMargin: number;
  netMargin: number;
  netMarginPct: number;
  lineCount: number;
  overriddenClientCount: number;
  commissionPct: number;
  commissionAmount: number;
  freightAmount: number;
  freightLines: number;
}
interface CommissionSummary {
  startDate: string;
  endDate: string;
  items: CommissionItem[];
  totals: { netRevenue: number; netMargin: number; commissionAmount: number; freightAmount: number };
  freightUnassigned: number;
}
interface DetailClient {
  client: string; revenue: number; cost: number; margin: number; lineCount: number;
  overridePct: number | null; effectivePct: number;
}
interface DetailDocument {
  document: string; numero: string; client: string; fecha: string;
  revenue: number; cost: number; margin: number; lineCount: number;
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
    const header = ["Vendedor", "Facturado neto", "Costo neto", "Margen neto", "Flete excluido", "% Comisión", "Comisión a pagar"];
    const rows = items.map((it) => [
      it.salesperson, Math.round(it.netRevenue), Math.round(it.netCost),
      Math.round(it.netMargin), Math.round(it.freightAmount), it.commissionPct, Math.round(it.commissionAmount),
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Comisiones de Vendedores</h1>
            <p className="text-sm text-slate-500">
              Comisión sobre el margen de lo facturado (FCV). El flete se excluye automáticamente de la base.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!items.length}>
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Selector de período */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <Button size="sm" variant={activePreset === "current" ? "default" : "outline"}
                onClick={() => setRange(currentMonthRange())}>Mes actual</Button>
              <Button size="sm" variant={activePreset === "last" ? "default" : "outline"}
                onClick={() => setRange(lastMonthRange())}>Mes anterior</Button>
              <Button size="sm" variant={activePreset === "year" ? "default" : "outline"}
                onClick={() => setRange(yearRange())}>Este año</Button>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Facturado neto (base)" value={formatCLP(summary?.totals.netRevenue)} loading={isLoading} />
        <KpiCard label="Margen neto total" value={formatCLP(summary?.totals.netMargin)} loading={isLoading} />
        <KpiCard label="Flete excluido" value={formatCLP(summary?.totals.freightAmount)} loading={isLoading} freight />
        <KpiCard label="Comisión total a pagar" value={formatCLP(summary?.totals.commissionAmount)} loading={isLoading}
          highlight />
      </div>

      {/* Auditoría de flete: cuánto se descuenta por vendedor */}
      <FreightAuditCard items={items} totals={summary?.totals} unassigned={summary?.freightUnassigned} loading={isLoading} />

      {/* Tabla principal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vendedores ({items.length})</CardTitle>
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
                  <TableHead className="text-right">Flete excluido</TableHead>
                  <TableHead className="text-right w-28">% Comisión</TableHead>
                  <TableHead className="text-right">Comisión a pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-500 py-10">
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
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        onClick={() => setExpanded(isOpen ? null : it.salesperson)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell className="font-medium">
                          {it.salesperson}
                          {it.overriddenClientCount > 0 && (
                            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                              <Percent className="w-3 h-3 mr-1" />{it.overriddenClientCount} ajustado{it.overriddenClientCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCLP(it.netRevenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(it.netCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCLP(it.netMargin)}
                          <span className="text-xs text-slate-400 ml-1">({it.netMarginPct.toFixed(1)}%)</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-amber-600">
                          {it.freightAmount > 0 ? formatCLP(it.freightAmount) : <span className="text-slate-300">—</span>}
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
                          <TableCell colSpan={8} className="bg-slate-50/60 dark:bg-slate-900/40 p-0">
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
                    <TableCell className="text-right font-semibold tabular-nums text-amber-600">{formatCLP(summary?.totals.freightAmount)}</TableCell>
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

function KpiCard({ label, value, loading, highlight, freight }: {
  label: string; value: string; loading?: boolean; highlight?: boolean; freight?: boolean;
}) {
  const cardClass = highlight
    ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-900/10"
    : freight
      ? "border-amber-300 bg-amber-50/40 dark:bg-amber-900/10"
      : "";
  const valueClass = highlight ? "text-emerald-600" : freight ? "text-amber-600" : "text-slate-900 dark:text-white";
  return (
    <Card className={cardClass}>
      <CardContent className="py-4">
        <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
          {freight && <Truck className="w-3.5 h-3.5 text-amber-500" />}{label}
        </p>
        {loading ? <Skeleton className="h-7 w-32" />
          : <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>}
      </CardContent>
    </Card>
  );
}

// Auditoría de flete: gráfico de barras con lo que se descuenta por vendedor.
// Ayuda a detectar de un vistazo dónde se concentra el flete facturado que NO
// entra en la base de comisiones.
function FreightAuditCard({ items, totals, unassigned, loading }: {
  items: CommissionItem[];
  totals?: { netRevenue: number; freightAmount: number };
  unassigned?: number;
  loading?: boolean;
}) {
  const chartData = useMemo(() => {
    const rows = items
      .filter((it) => it.freightAmount > 0)
      .map((it) => ({ name: it.salesperson, flete: Math.round(it.freightAmount) }))
      .sort((a, b) => b.flete - a.flete);
    return rows.slice(0, 15);
  }, [items]);

  const freightTotal = totals?.freightAmount ?? 0;
  const base = totals?.netRevenue ?? 0;
  const pctOfBase = base > 0 ? (freightTotal / base) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-500" />
          Auditoría de flete
          <span className="text-xs font-normal text-slate-500 ml-1">
            excluido de la base de comisiones
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">
            No se facturó flete en el período seleccionado.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-sm">
              <span className="text-slate-500">
                Total flete: <span className="font-semibold text-amber-600 tabular-nums">{formatCLP(freightTotal)}</span>
              </span>
              <span className="text-slate-500">
                Sobre lo facturado: <span className="font-semibold tabular-nums">{pctOfBase.toFixed(2)}%</span>
              </span>
              {!!unassigned && unassigned > 0 && (
                <span className="text-slate-500">
                  Sin vendedor asignado: <span className="font-semibold tabular-nums">{formatCLP(unassigned)}</span>
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 34)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatCLP(v)}
                  tick={{ fontSize: 11 }}
                  className="text-slate-500"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 11 }}
                  className="text-slate-500"
                />
                <Tooltip
                  formatter={(v: any) => [formatCLP(Number(v)), "Flete"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="flete" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="#f59e0b" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
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
      <div className="relative inline-flex items-center">
        <Input
          type="number" min={0} max={100} step={0.1}
          value={shown}
          className={`w-20 h-8 text-right pr-5 tabular-nums ${isOverride ? "border-amber-400 text-amber-700 dark:text-amber-400 font-medium" : ""}`}
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
        className={`text-slate-300 hover:text-slate-600 transition-opacity ${isOverride ? "opacity-100" : "opacity-0 pointer-events-none"}`}
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
        <Button size="sm" variant={tab === "clients" ? "default" : "outline"} onClick={() => setTab("clients")}>
          <Users className="w-4 h-4 mr-1.5" /> Clientes ({data?.clients.length ?? 0})
        </Button>
        <Button size="sm" variant={tab === "documents" ? "default" : "outline"} onClick={() => setTab("documents")}>
          <FileText className="w-4 h-4 mr-1.5" /> Ventas ({data?.documents.length ?? 0})
        </Button>
        {data && (
          <span className="text-xs text-slate-500 ml-auto">
            % por defecto del vendedor: <span className="font-medium tabular-nums">{data.defaultPct}%</span> · edítalo por cliente o venta (0 = no paga)
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
                <TableHead className="text-right w-40">% Comisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.clients.map((c) => (
                <TableRow key={c.client} className={c.effectivePct === 0 ? "opacity-60" : ""}>
                  <TableCell>{c.client}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(c.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(c.margin)}</TableCell>
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
                <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">Sin clientes</TableCell></TableRow>
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
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">Sin ventas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
