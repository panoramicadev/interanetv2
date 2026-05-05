import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Package,
  Minus,
} from "lucide-react";

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

interface MarginDashboardData {
  overview: OverviewData;
  lowMarginAlerts: AlertRow[];
  threshold: number;
  bySegment: SegmentRow[];
  bySalesperson: SalespersonRow[];
}

const PERIOD_OPTIONS = [
  { value: "current-month", label: "Mes actual" },
  { value: "last-month", label: "Mes anterior" },
  { value: "last-30-days", label: "Últimos 30 días" },
  { value: "last-90-days", label: "Últimos 90 días" },
  { value: `year-${new Date().getFullYear()}`, label: `Año ${new Date().getFullYear()}` },
];

const THRESHOLD_OPTIONS = [
  { value: "0", label: "Solo negativos" },
  { value: "10", label: "< 10%" },
  { value: "15", label: "< 15%" },
  { value: "20", label: "< 20%" },
  { value: "30", label: "< 30%" },
];

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
  if (delta > 0.1) return "text-emerald-600";
  if (delta < -0.1) return "text-red-600";
  return "text-gray-500";
}
function DeltaIcon({ delta }: { delta: number | null }) {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) <= 0.1) return <Minus className="h-3 w-3" />;
  return delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
}

export function MarginDashboard() {
  const [period, setPeriod] = useState<string>("last-90-days");
  const [threshold, setThreshold] = useState<string>("15");

  const { data, isLoading, error } = useQuery<MarginDashboardData>({
    queryKey: [`/api/etl/costos/margin-dashboard`, { period, threshold }],
    queryFn: async () => {
      const params = new URLSearchParams({ period, lowMarginThreshold: threshold });
      const res = await apiRequest(`/api/etl/costos/margin-dashboard?${params}`);
      return res.json();
    },
  });

  const ov = data?.overview;
  const alerts = data?.lowMarginAlerts ?? [];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wide text-gray-500">Período</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="text-sm border rounded-md px-2 py-1.5 h-9 bg-white"
            data-testid="select-margin-dashboard-period"
          >
            {PERIOD_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wide text-gray-500">Umbral de alerta</label>
          <select
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            className="text-sm border rounded-md px-2 py-1.5 h-9 bg-white"
            data-testid="select-margin-dashboard-threshold"
          >
            {THRESHOLD_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-red-700 text-sm py-4">
            No se pudo cargar el dashboard de margen.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Ingresos FCV"
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          value={isLoading ? null : ov ? fmtCLP(ov.revenue) : "—"}
          delta={ov?.deltas.revenuePct ?? null}
          deltaLabel="vs período anterior"
          deltaSuffix="%"
        />
        <KpiCard
          label="Margen $"
          icon={<Calculator className="h-4 w-4 text-emerald-600" />}
          value={isLoading ? null : ov ? fmtCLP(ov.margin) : "—"}
          delta={ov?.deltas.marginPct ?? null}
          deltaLabel="vs período anterior"
          deltaSuffix="%"
        />
        <KpiCard
          label="Margen %"
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          value={isLoading ? null : ov ? fmtPct(ov.marginPct) : "—"}
          delta={ov?.deltas.marginPctPoints ?? null}
          deltaLabel="vs período anterior"
          deltaSuffix="pp"
          highlight={ov ? marginBadgeClass(ov.marginPct) : ""}
        />
        <KpiCard
          label="SKUs en riesgo"
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          value={isLoading ? null : `${alerts.length}`}
          deltaLabel={`con margen < ${threshold}%`}
          extraValue={ov ? `${fmtInt(ov.skuCount)} SKUs vendidos` : undefined}
          danger={alerts.length > 0}
        />
      </div>

      {/* Alertas */}
      <Card className="border-red-100">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-red-600" />
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
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Producto</TableHead>
                  <TableHead className="text-right text-xs">Unidades</TableHead>
                  <TableHead className="text-right text-xs">Ingresos</TableHead>
                  <TableHead className="text-right text-xs">Costo total</TableHead>
                  <TableHead className="text-right text-xs">Margen $</TableHead>
                  <TableHead className="text-right text-xs">Margen %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map(a => (
                  <TableRow key={a.sku} className="text-xs" data-testid={`row-alert-${a.sku}`}>
                    <TableCell className="font-mono py-2">{a.sku}</TableCell>
                    <TableCell className="py-2 max-w-[300px] truncate" title={a.producto || ""}>
                      {a.producto || <span className="italic text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums py-2">{fmtInt(a.qty)}</TableCell>
                    <TableCell className="text-right tabular-nums py-2">{fmtCLP(a.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums py-2 text-amber-700">{fmtCLP(a.cost)}</TableCell>
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
          )}
        </CardContent>
      </Card>

      {/* Comparativas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-blue-600" />
              Margen por segmento (cliente)
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
                    <TableHead className="text-xs">Segmento</TableHead>
                    <TableHead className="text-right text-xs">Ingresos</TableHead>
                    <TableHead className="text-right text-xs">Margen $</TableHead>
                    <TableHead className="text-right text-xs">Margen %</TableHead>
                    <TableHead className="text-right text-xs">Δ vs prev.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySegment.map(r => (
                    <TableRow key={r.segment} className="text-xs">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-blue-600" />
              Margen por vendedor
            </CardTitle>
            <CardDescription>Top 50 por ingresos. Segmento = del vendedor (vía supervisor).</CardDescription>
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
                      <TableHead className="text-xs">Vendedor</TableHead>
                      <TableHead className="text-xs">Segmento</TableHead>
                      <TableHead className="text-right text-xs">Ingresos</TableHead>
                      <TableHead className="text-right text-xs">Margen %</TableHead>
                      <TableHead className="text-right text-xs">Δ vs prev.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bySalesperson.map(r => (
                      <TableRow key={r.salesperson} className="text-xs">
                        <TableCell className="font-medium py-2 max-w-[180px] truncate" title={r.salesperson}>
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
    </div>
  );
}

function KpiCard({
  label,
  icon,
  value,
  delta,
  deltaLabel,
  deltaSuffix,
  highlight,
  extraValue,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  delta?: number | null;
  deltaLabel?: string;
  deltaSuffix?: string;
  highlight?: string;
  extraValue?: string;
  danger?: boolean;
}) {
  const showDelta = delta != null && Number.isFinite(delta);
  return (
    <Card className={`border-0 shadow-sm ${danger ? "ring-1 ring-red-200" : ""}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        {value === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <>
            <div className={`text-2xl font-bold ${danger ? "text-red-600" : "text-gray-900"}`}>{value}</div>
            {extraValue && <div className="text-[11px] text-gray-500 mt-0.5">{extraValue}</div>}
            {showDelta && (
              <div className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${deltaColor(delta!)}`}>
                <DeltaIcon delta={delta!} />
                {delta! >= 0 ? "+" : ""}{delta!.toFixed(1)}{deltaSuffix || ""}
                <span className="text-gray-400 font-normal ml-1">{deltaLabel}</span>
              </div>
            )}
            {!showDelta && deltaLabel && (
              <div className="text-[11px] text-gray-500 mt-1">{deltaLabel}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
