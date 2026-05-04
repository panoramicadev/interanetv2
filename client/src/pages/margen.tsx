import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import {
  Percent,
  TrendingUp,
  TrendingDown,
  Calculator,
  BarChart3,
  Users,
  Layers,
  Package,
  Loader2,
  AlertCircle,
} from "lucide-react";

type MarginMetrics = {
  totalRevenue: number;
  totalCost: number;
  totalMarginAmount: number;
  averageMarginPct: number;
  averageMarginPctSimple: number;
  highestMargin: { product: string; marginPct: number; revenue: number; cost: number; marginAmount: number } | null;
  lowestMargin: { product: string; marginPct: number; revenue: number; cost: number; marginAmount: number } | null;
  productCount: number;
  transactionCount: number;
};

type SegmentRow = {
  segment: string;
  revenue: number;
  cost: number;
  marginAmount: number;
  marginPct: number;
  transactionCount: number;
  productCount: number;
};

type SalespersonRow = {
  salesperson: string;
  revenue: number;
  cost: number;
  marginAmount: number;
  marginPct: number;
  transactionCount: number;
  clientCount: number;
  productCount: number;
};

type ProductRow = {
  product: string;
  revenue: number;
  cost: number;
  marginAmount: number;
  marginPct: number;
  unitsSold: number;
};

const formatCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const formatPct = (n: number) => `${n.toFixed(1)}%`;

const formatInt = (n: number) => new Intl.NumberFormat("es-CL").format(Math.round(n));

function marginColor(pct: number): string {
  if (pct >= 30) return "text-emerald-600";
  if (pct >= 15) return "text-amber-600";
  if (pct >= 0) return "text-orange-600";
  return "text-red-600";
}

function marginBadgeClass(pct: number): string {
  if (pct >= 30) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pct >= 15) return "bg-amber-50 text-amber-700 border-amber-200";
  if (pct >= 0) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-red-50 text-red-700 border-red-200";
}

const currentYear = new Date().getFullYear();

function buildPeriodOptions() {
  const opts: Array<{ value: string; label: string; filterType: string; period: string }> = [];
  opts.push({ value: "current-month", label: "Mes actual", filterType: "month", period: "current-month" });
  opts.push({ value: "last-month", label: "Mes anterior", filterType: "month", period: "last-month" });
  opts.push({ value: "last-30-days", label: "Últimos 30 días", filterType: "range", period: "last-30-days" });
  opts.push({ value: "last-90-days", label: "Últimos 90 días", filterType: "range", period: "last-90-days" });
  for (let y = currentYear; y >= currentYear - 3; y--) {
    opts.push({ value: `year-${y}`, label: `Año ${y}`, filterType: "year", period: String(y) });
  }
  return opts;
}

const PERIOD_OPTIONS = buildPeriodOptions();

export default function MargenPage() {
  const [periodValue, setPeriodValue] = useState<string>("current-month");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [salespersonFilter, setSalespersonFilter] = useState<string>("all");

  const periodCfg = useMemo(
    () => PERIOD_OPTIONS.find(p => p.value === periodValue) || PERIOD_OPTIONS[0],
    [periodValue],
  );

  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("period", periodCfg.period);
    p.append("filterType", periodCfg.filterType);
    if (segmentFilter && segmentFilter !== "all") p.append("segment", segmentFilter);
    if (salespersonFilter && salespersonFilter !== "all") p.append("salesperson", salespersonFilter);
    return p.toString();
  }, [periodCfg, segmentFilter, salespersonFilter]);

  // Disparamos la carga del cache de precios GRI (costos reales desde SQL Server,
  // los mismos que se ven en Lista de Precios). El endpoint persiste el snapshot
  // a PostgreSQL para que el JOIN del análisis de margen pueda usarlos.
  useQuery<Record<string, { price: number; date: string | null }>>({
    queryKey: ["/api/inventory/gri-prices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/gri-prices");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Para los selectores de filtro: lista de segmentos y vendedores disponibles
  // Usamos los mismos endpoints que el dashboard principal para que aparezcan
  // aunque aún no haya costos calculados en el período seleccionado.
  const { data: segmentsData = [] } = useQuery<Array<{ segment: string; totalSales: number }>>({
    queryKey: ["/api/sales/segments", "year", currentYear],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/segments?period=${currentYear}&filterType=year`);
      return res.json();
    },
  });

  const { data: salespeopleData = [] } = useQuery<Array<{ id: string; salespersonName?: string; email?: string }>>({
    queryKey: ["/api/users/salespeople"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/salespeople`);
      return res.json();
    },
  });

  // Métricas globales de margen
  const {
    data: metrics,
    isLoading: loadingMetrics,
    error: errorMetrics,
  } = useQuery<MarginMetrics>({
    queryKey: ["/api/sales/margins", baseParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/margins?${baseParams}`);
      return res.json();
    },
  });

  // Margen por segmento
  const { data: bySegment = [], isLoading: loadingSegment } = useQuery<SegmentRow[]>({
    queryKey: ["/api/sales/margins/by-segment", baseParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/margins/by-segment?${baseParams}`);
      return res.json();
    },
  });

  // Margen por vendedor
  const { data: bySalesperson = [], isLoading: loadingSalesperson } = useQuery<SalespersonRow[]>({
    queryKey: ["/api/sales/margins/by-salesperson", baseParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/margins/by-salesperson?${baseParams}`);
      return res.json();
    },
  });

  // Top productos por margen (más alto y más bajo)
  const { data: topByMargin = [], isLoading: loadingTopProducts } = useQuery<ProductRow[]>({
    queryKey: ["/api/sales/margins/by-product/highest", baseParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/margins/by-product?${baseParams}&sortBy=highest&limit=15`);
      return res.json();
    },
  });

  const { data: bottomByMargin = [], isLoading: loadingBottomProducts } = useQuery<ProductRow[]>({
    queryKey: ["/api/sales/margins/by-product/lowest", baseParams],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/margins/by-product?${baseParams}&sortBy=lowest&limit=15`);
      return res.json();
    },
  });

  const segmentNames = useMemo(() => {
    const set = new Set<string>();
    segmentsData.forEach((r: any) => {
      if (r.segment) set.add(r.segment);
    });
    return Array.from(set).sort();
  }, [segmentsData]);

  const salespersonNames = useMemo(() => {
    return salespeopleData
      .map(s => s.salespersonName || s.email || s.id)
      .filter((n): n is string => !!n)
      .sort();
  }, [salespeopleData]);

  const hasData = !!metrics && metrics.transactionCount > 0;

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-emerald-600" />
            Análisis de Margen
          </CardTitle>
          <p className="text-sm text-gray-500">
            Margen comercial = (Venta neta − Costo promedio ponderado) sobre ventas reales
            (excluye guías de despacho).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Período</label>
              <Select value={periodValue} onValueChange={setPeriodValue}>
                <SelectTrigger data-testid="select-margen-period">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Segmento</label>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger data-testid="select-margen-segment">
                  <SelectValue placeholder="Todos los segmentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los segmentos</SelectItem>
                  {segmentNames.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vendedor</label>
              <Select value={salespersonFilter} onValueChange={setSalespersonFilter}>
                <SelectTrigger data-testid="select-margen-salesperson">
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {salespersonNames.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMetrics && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 py-4 text-red-700">
            <AlertCircle className="h-4 w-4" />
            Error cargando métricas de margen.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Margen promedio</span>
              <Calculator className="h-4 w-4 text-emerald-600" />
            </div>
            {loadingMetrics ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${marginColor(metrics?.averageMarginPct || 0)}`} data-testid="kpi-margen-promedio">
                  {hasData ? formatPct(metrics!.averageMarginPct) : "—"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {hasData
                    ? `${formatCLP(metrics!.totalMarginAmount)} sobre ${formatCLP(metrics!.totalRevenue)}`
                    : "Sin datos en el período"}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Margen más alto</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            {loadingMetrics ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : metrics?.highestMargin ? (
              <>
                <div className={`text-2xl font-bold ${marginColor(metrics.highestMargin.marginPct)}`} data-testid="kpi-margen-alto">
                  {formatPct(metrics.highestMargin.marginPct)}
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate" title={metrics.highestMargin.product}>
                  {metrics.highestMargin.product}
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold text-gray-400">—</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Margen más bajo</span>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            {loadingMetrics ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : metrics?.lowestMargin ? (
              <>
                <div className={`text-2xl font-bold ${marginColor(metrics.lowestMargin.marginPct)}`} data-testid="kpi-margen-bajo">
                  {formatPct(metrics.lowestMargin.marginPct)}
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate" title={metrics.lowestMargin.product}>
                  {metrics.lowestMargin.product}
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold text-gray-400">—</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Productos analizados</span>
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            {loadingMetrics ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-900" data-testid="kpi-productos">
                  {hasData ? formatInt(metrics!.productCount) : "—"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {hasData ? `${formatInt(metrics!.transactionCount)} líneas de venta` : "—"}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs con desgloses */}
      <Tabs defaultValue="segmento" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="segmento" className="gap-1.5" data-testid="tab-margen-segmento">
            <Layers className="h-3.5 w-3.5" />
            Por segmento
          </TabsTrigger>
          <TabsTrigger value="vendedor" className="gap-1.5" data-testid="tab-margen-vendedor">
            <Users className="h-3.5 w-3.5" />
            Por vendedor
          </TabsTrigger>
          <TabsTrigger value="productos" className="gap-1.5" data-testid="tab-margen-productos">
            <BarChart3 className="h-3.5 w-3.5" />
            Productos
          </TabsTrigger>
        </TabsList>

        {/* Tab Segmento */}
        <TabsContent value="segmento" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Margen promedio por segmento</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSegment ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
                </div>
              ) : bySegment.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">Sin datos en el período</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Segmento</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Margen $</TableHead>
                      <TableHead className="text-right">Margen %</TableHead>
                      <TableHead className="text-right">Productos</TableHead>
                      <TableHead className="text-right">Líneas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bySegment.map(row => (
                      <TableRow key={row.segment} data-testid={`row-segment-${row.segment}`}>
                        <TableCell className="font-medium">{row.segment}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCLP(row.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-gray-600">{formatCLP(row.cost)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${marginColor(row.marginPct)}`}>
                          {formatCLP(row.marginAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={marginBadgeClass(row.marginPct)}>
                            {formatPct(row.marginPct)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-gray-600">{formatInt(row.productCount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-gray-600">{formatInt(row.transactionCount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Vendedor */}
        <TabsContent value="vendedor" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Margen promedio por vendedor</CardTitle>
              <p className="text-xs text-gray-500">Calculado sobre las ventas que cada vendedor realizó en el período.</p>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSalesperson ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
                </div>
              ) : bySalesperson.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">Sin datos en el período</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Margen $</TableHead>
                      <TableHead className="text-right">Margen %</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                      <TableHead className="text-right">Productos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bySalesperson.map(row => (
                      <TableRow key={row.salesperson} data-testid={`row-salesperson-${row.salesperson}`}>
                        <TableCell className="font-medium">{row.salesperson}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCLP(row.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-gray-600">{formatCLP(row.cost)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${marginColor(row.marginPct)}`}>
                          {formatCLP(row.marginAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={marginBadgeClass(row.marginPct)}>
                            {formatPct(row.marginPct)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-gray-600">{formatInt(row.clientCount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-gray-600">{formatInt(row.productCount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Productos */}
        <TabsContent value="productos" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Top 15 — Mayor margen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTopProducts ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
                  </div>
                ) : topByMargin.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-sm">Sin datos</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Margen %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topByMargin.map(p => (
                        <TableRow key={p.product}>
                          <TableCell className="font-medium text-xs truncate max-w-[280px]" title={p.product}>{p.product}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatCLP(p.revenue)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={marginBadgeClass(p.marginPct)}>
                              {formatPct(p.marginPct)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  Top 15 — Menor margen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingBottomProducts ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
                  </div>
                ) : bottomByMargin.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-sm">Sin datos</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Margen %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bottomByMargin.map(p => (
                        <TableRow key={p.product}>
                          <TableCell className="font-medium text-xs truncate max-w-[280px]" title={p.product}>{p.product}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatCLP(p.revenue)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={marginBadgeClass(p.marginPct)}>
                              {formatPct(p.marginPct)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
