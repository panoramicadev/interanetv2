import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Loader2,
  ChevronDown,
  ChevronRight,
  Users,
  Building2,
} from "lucide-react";

interface SalesComparisonRow {
  sku: string;
  producto: string | null;
  unidad: string | null;
  cost: number | null;
  costDate: string | null;
  avgSellPrice: number | null;
  revenue: number;
  qty: number;
  lineCount: number;
  totalCost: number | null;
  marginAmount: number | null;
  marginPct: number | null;
  unitMarginPct: number | null;
}

interface SalesComparisonResponse {
  rows: SalesComparisonRow[];
  totalCount: number;
}

interface SalesBySalespersonRow {
  salesperson: string;
  segment: string | null;
  revenue: number;
  qty: number;
  lineCount: number;
  avgSellPrice: number | null;
  totalCost: number | null;
  marginAmount: number | null;
  marginPct: number | null;
}

interface SalesBySegmentRow {
  segment: string;
  revenue: number;
  qty: number;
  lineCount: number;
  salespersonCount: number;
  avgSellPrice: number | null;
  totalCost: number | null;
  marginAmount: number | null;
  marginPct: number | null;
}

interface SalesBySkuResponse {
  sku: string;
  cost: number | null;
  costDate: string | null;
  bySalesperson: SalesBySalespersonRow[];
  bySegment: SalesBySegmentRow[];
}

const COMPARISON_PERIOD_OPTIONS = [
  { value: "current-month", label: "Mes actual" },
  { value: "last-month", label: "Mes anterior" },
  { value: "last-30-days", label: "Últimos 30 días" },
  { value: "last-90-days", label: "Últimos 90 días" },
  { value: `year-${new Date().getFullYear()}`, label: `Año ${new Date().getFullYear()}` },
  { value: "all", label: "Todo" },
];

function fmtCLP(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}
function fmtInt(n: number): string {
  return new Intl.NumberFormat("es-CL").format(Math.round(n));
}
function marginBadgeClass(pct: number | null): string {
  if (pct == null) return "bg-gray-50 text-gray-500 border-gray-200";
  if (pct >= 30) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pct >= 15) return "bg-amber-50 text-amber-700 border-amber-200";
  if (pct >= 0) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export function CostComparisonSection({ autoRefresh = false }: { autoRefresh?: boolean }) {
  const [period, setPeriod] = useState<string>("last-90-days");
  const [salespersonFilter, setSalespersonFilter] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const limit = 50;

  // Catálogos para los dropdowns — mismos endpoints que usa el dashboard.
  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
    queryFn: async () => {
      const res = await apiRequest("/api/goals/data/segments");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: salespeople = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
    queryFn: async () => {
      const res = await apiRequest("/api/goals/data/salespeople");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const buildParams = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ period, search, ...extra });
    if (salespersonFilter) p.set("salesperson", salespersonFilter);
    if (segmentFilter) p.set("segment", segmentFilter);
    return p;
  };

  const { data, isLoading } = useQuery<SalesComparisonResponse>({
    queryKey: [`/api/etl/costos/sales-comparison`, { period, search, salespersonFilter, segmentFilter, limit, offset: page * limit }],
    queryFn: async () => {
      const params = buildParams({ limit: String(limit), offset: String(page * limit) });
      const res = await apiRequest(`/api/etl/costos/sales-comparison?${params}`);
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const breakdownQuery = useQuery<SalesBySkuResponse>({
    queryKey: [`/api/etl/costos/sales-by-sku`, { sku: expandedSku, period, salespersonFilter, segmentFilter }],
    queryFn: async () => {
      const params = buildParams();
      params.set("sku", expandedSku!);
      const res = await apiRequest(`/api/etl/costos/sales-by-sku?${params}`);
      return res.json();
    },
    enabled: !!expandedSku,
  });

  const resetPaging = () => { setPage(0); setExpandedSku(null); };
  const hasFilters = !!(salespersonFilter || segmentFilter || search);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Costo vs Venta FCV (margen real)
            </CardTitle>
            <CardDescription>
              Cruza el costo GRI con el precio efectivo de venta en facturas FCV. Click en un SKU para desglosar por vendedor y segmento del vendedor.
              {data ? ` ${data.totalCount.toLocaleString("es-CL")} SKUs con ventas en el período.` : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={period}
              onChange={e => { setPeriod(e.target.value); resetPaging(); }}
              className="text-sm border rounded-md px-2 py-1.5 h-9 bg-background"
              data-testid="select-comparison-period"
            >
              {COMPARISON_PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={segmentFilter}
              onChange={e => { setSegmentFilter(e.target.value); resetPaging(); }}
              className="text-sm border rounded-md px-2 py-1.5 h-9 bg-background max-w-[180px]"
              data-testid="select-comparison-segment"
            >
              <option value="">Todos los segmentos</option>
              {segments.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={salespersonFilter}
              onChange={e => { setSalespersonFilter(e.target.value); resetPaging(); }}
              className="text-sm border rounded-md px-2 py-1.5 h-9 bg-background max-w-[200px]"
              data-testid="select-comparison-salesperson"
            >
              <option value="">Todos los vendedores</option>
              {salespeople.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <form
              className="flex items-center gap-2"
              onSubmit={e => {
                e.preventDefault();
                setSearch(searchInput);
                resetPaging();
              }}
            >
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Buscar SKU o producto..."
                className="w-56 text-sm"
              />
              <Button type="submit" size="sm" variant="secondary">Buscar</Button>
              {hasFilters && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setSalespersonFilter("");
                    setSegmentFilter("");
                    resetPaging();
                  }}
                >
                  Limpiar
                </Button>
              )}
            </form>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando comparación...
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            {search ? "Sin resultados." : "No hay ventas FCV en el período seleccionado."}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Producto</TableHead>
                  <TableHead className="text-right text-xs text-amber-700">Costo</TableHead>
                  <TableHead className="text-right text-xs">Precio venta prom.</TableHead>
                  <TableHead className="text-right text-xs">Unidades</TableHead>
                  <TableHead className="text-right text-xs">Ingresos</TableHead>
                  <TableHead className="text-right text-xs">Margen $</TableHead>
                  <TableHead className="text-right text-xs">Margen %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map(row => {
                  const isExpanded = expandedSku === row.sku;
                  return (
                    <Fragment key={row.sku}>
                      <TableRow
                        className="text-xs cursor-pointer hover:bg-muted/40"
                        onClick={() => setExpandedSku(isExpanded ? null : row.sku)}
                        data-testid={`row-comparison-${row.sku}`}
                      >
                        <TableCell className="py-2">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </TableCell>
                        <TableCell className="font-mono py-2">{row.sku}</TableCell>
                        <TableCell className="py-2 max-w-[280px] truncate" title={row.producto || ""}>
                          {row.producto || <span className="text-muted-foreground italic">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2 text-amber-700 font-semibold">
                          {fmtCLP(row.cost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2">
                          {fmtCLP(row.avgSellPrice)}
                          {row.unitMarginPct != null && (
                            <span className={`block text-[9px] ${row.unitMarginPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {row.unitMarginPct >= 0 ? "+" : ""}{row.unitMarginPct.toFixed(1)}% unit.
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2">{fmtInt(row.qty)}</TableCell>
                        <TableCell className="text-right tabular-nums py-2 font-semibold">{fmtCLP(row.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums py-2">
                          {fmtCLP(row.marginAmount)}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <Badge variant="outline" className={marginBadgeClass(row.marginPct)}>
                            {fmtPct(row.marginPct)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={9} className="p-4">
                            {breakdownQuery.isLoading ? (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando desglose...
                              </div>
                            ) : !breakdownQuery.data ? (
                              <div className="text-xs text-muted-foreground">Sin datos.</div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                  <div className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" /> Por vendedor
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="text-[10px]">
                                        <TableHead className="text-[10px]">Vendedor</TableHead>
                                        <TableHead className="text-[10px]">Segmento</TableHead>
                                        <TableHead className="text-right text-[10px]">Unid.</TableHead>
                                        <TableHead className="text-right text-[10px]">Precio prom.</TableHead>
                                        <TableHead className="text-right text-[10px]">Ingresos</TableHead>
                                        <TableHead className="text-right text-[10px]">Margen %</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {breakdownQuery.data.bySalesperson.map(s => (
                                        <TableRow key={s.salesperson} className="text-[11px]">
                                          <TableCell className="py-1.5 font-medium">{s.salesperson}</TableCell>
                                          <TableCell className="py-1.5 text-muted-foreground">
                                            {s.segment || <span className="italic">—</span>}
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums py-1.5">{fmtInt(s.qty)}</TableCell>
                                          <TableCell className="text-right tabular-nums py-1.5">{fmtCLP(s.avgSellPrice)}</TableCell>
                                          <TableCell className="text-right tabular-nums py-1.5">{fmtCLP(s.revenue)}</TableCell>
                                          <TableCell className="text-right py-1.5">
                                            <Badge variant="outline" className={`${marginBadgeClass(s.marginPct)} text-[10px]`}>
                                              {fmtPct(s.marginPct)}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                <div>
                                  <div className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5" /> Por segmento del vendedor
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="text-[10px]">
                                        <TableHead className="text-[10px]">Segmento</TableHead>
                                        <TableHead className="text-right text-[10px]">Vend.</TableHead>
                                        <TableHead className="text-right text-[10px]">Unid.</TableHead>
                                        <TableHead className="text-right text-[10px]">Precio prom.</TableHead>
                                        <TableHead className="text-right text-[10px]">Ingresos</TableHead>
                                        <TableHead className="text-right text-[10px]">Margen %</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {breakdownQuery.data.bySegment.map(s => (
                                        <TableRow key={s.segment} className="text-[11px]">
                                          <TableCell className="py-1.5 font-medium">{s.segment}</TableCell>
                                          <TableCell className="text-right tabular-nums py-1.5">{fmtInt(s.salespersonCount)}</TableCell>
                                          <TableCell className="text-right tabular-nums py-1.5">{fmtInt(s.qty)}</TableCell>
                                          <TableCell className="text-right tabular-nums py-1.5">{fmtCLP(s.avgSellPrice)}</TableCell>
                                          <TableCell className="text-right tabular-nums py-1.5">{fmtCLP(s.revenue)}</TableCell>
                                          <TableCell className="text-right py-1.5">
                                            <Badge variant="outline" className={`${marginBadgeClass(s.marginPct)} text-[10px]`}>
                                              {fmtPct(s.marginPct)}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {data.totalCount > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/50 text-xs">
                <div className="text-muted-foreground">
                  Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, data.totalCount)} de{" "}
                  {data.totalCount.toLocaleString("es-CL")}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setPage(p => Math.max(0, p - 1)); setExpandedSku(null); }}
                    disabled={page === 0}
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" /> Anterior
                  </Button>
                  <span className="px-2">Página {page + 1} de {Math.max(1, Math.ceil(data.totalCount / limit))}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setPage(p => p + 1); setExpandedSku(null); }}
                    disabled={(page + 1) * limit >= data.totalCount}
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
