import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Package,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { PriceList } from "@shared/schema";
import { CostComparisonSection } from "@/components/finanzas/cost-comparison-section";

interface PriceListResponse {
  items: PriceList[];
  totalCount: number;
  hasMore: boolean;
}

interface CostosExecution {
  id: string;
  startTime: string;
  endTime: string | null;
  status: string;
  recordsProcessed: number | null;
  executionTimeMs: number | null;
  errorMessage: string | null;
  statistics: string | null;
}

interface CostosStatus {
  lastExecution: CostosExecution | null;
  isRunning: boolean;
  history: CostosExecution[];
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
}

const formatCLP = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const formatPct = (n: number) => `${n.toFixed(1)}%`;

const formatInt = (n: number) => new Intl.NumberFormat("es-CL").format(Math.round(n));

function marginBadgeClass(pct: number): string {
  if (pct >= 30) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pct >= 15) return "bg-amber-50 text-amber-700 border-amber-200";
  if (pct >= 0) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function parseStats(raw: string | null): { totalErp?: number; newSnapshots?: number; unchanged?: number } {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function MargenPage() {
  const { toast } = useToast();
  const [productsSearch, setProductsSearch] = useState<string>("");
  const [productsSearchInput, setProductsSearchInput] = useState<string>("");
  const [productsPage, setProductsPage] = useState<number>(0);
  const productsPerPage = 50;

  // Estado del ETL Costos: muestra resultado de la última importación
  const { data: costosStatus, isLoading: loadingStatus } = useQuery<CostosStatus>({
    queryKey: ["/api/etl/status?etlName=costos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/etl/status?etlName=costos");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Disparar ETL de costos
  const runCostosMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/etl/execute?etlName=costos");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Importación iniciada", description: "El ETL de costos está corriendo en segundo plano." });
      queryClient.invalidateQueries({ queryKey: ["/api/etl/status?etlName=costos"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo iniciar la importación", variant: "destructive" });
    },
  });

  // Costos GRI (último valor por SKU) — usado para enriquecer la tabla de productos
  const { data: griPrices } = useQuery<Record<string, { price: number; date: string | null }>>({
    queryKey: ["/api/inventory/gri-prices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/gri-prices");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Listado paginado de productos de la lista de precios
  const { data: productsData, isLoading: loadingProducts } = useQuery<PriceListResponse>({
    queryKey: ["/api/price-list", { search: productsSearch, limit: productsPerPage, offset: productsPage * productsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: productsSearch,
        limit: productsPerPage.toString(),
        offset: (productsPage * productsPerPage).toString(),
      });
      const res = await apiRequest("GET", `/api/price-list?${params}`);
      return res.json();
    },
  });

  const lastExec = costosStatus?.lastExecution;
  const isRunning = costosStatus?.isRunning ?? false;
  const stats = parseStats(lastExec?.statistics ?? null);

  return (
    <div className="space-y-6">
      {/* Resultado de la última importación de costos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-emerald-600" />
                Importación de costos (ETL)
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Última extracción del costo GRI (Bodega 006) desde SQL Server. Cada cambio se guarda como un nuevo snapshot histórico.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => runCostosMutation.mutate()}
              disabled={isRunning || runCostosMutation.isPending}
              data-testid="button-run-costos-etl"
            >
              {isRunning || runCostosMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Importar costos ahora
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center text-gray-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando estado...
            </div>
          ) : !lastExec ? (
            <div className="text-sm text-gray-500">
              Aún no se ejecutó ninguna importación. Hacé clic en <strong>Importar costos ahora</strong> para traer los costos desde SQL Server.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500">
                  {lastExec.status === "success" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : lastExec.status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                  )}
                  Estado
                </div>
                <div className="text-sm font-semibold mt-0.5 capitalize" data-testid="status-costos-last">
                  {lastExec.status === "success" ? "Exitoso" : lastExec.status === "running" ? "En curso" : "Error"}
                </div>
                {lastExec.errorMessage && (
                  <div className="text-[10px] text-red-600 mt-0.5 truncate" title={lastExec.errorMessage}>
                    {lastExec.errorMessage}
                  </div>
                )}
              </div>

              <div className="rounded-md border bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500">
                  <Clock className="h-3.5 w-3.5 text-gray-500" />
                  Hace
                </div>
                <div className="text-sm font-semibold mt-0.5" data-testid="status-costos-when">
                  {formatDistanceToNow(new Date(lastExec.startTime), { locale: es, addSuffix: true })}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {lastExec.executionTimeMs != null
                    ? `${(lastExec.executionTimeMs / 1000).toFixed(1)}s de ejecución`
                    : ""}
                </div>
              </div>

              <div className="rounded-md border bg-gray-50 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">SKUs procesados</div>
                <div className="text-lg font-bold mt-0.5" data-testid="status-costos-records">
                  {formatInt(lastExec.recordsProcessed ?? 0)}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">desde SQL Server</div>
              </div>

              <div className="rounded-md border bg-gray-50 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Snapshots nuevos</div>
                <div className="text-lg font-bold mt-0.5 text-emerald-700" data-testid="status-costos-changes">
                  {formatInt(stats.newSnapshots ?? 0)}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {stats.unchanged != null ? `${formatInt(stats.unchanged)} sin cambio` : ""}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Costo vs Venta FCV (margen real) */}
      <CostComparisonSection />

      {/* Listado de productos con su costo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-blue-600" />
                Productos de la lista de precios y su costo
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Costo desde la última GRI (Bodega 006); si no hay, se usa el costo de producción cargado.
                {productsData ? ` ${formatInt(productsData.totalCount)} productos.` : ""}
              </p>
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={e => {
                e.preventDefault();
                setProductsSearch(productsSearchInput);
                setProductsPage(0);
              }}
            >
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={productsSearchInput}
                  onChange={e => setProductsSearchInput(e.target.value)}
                  placeholder="Buscar código o producto..."
                  className="pl-7 h-9 w-64 text-sm"
                  data-testid="input-margen-products-search"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary" data-testid="button-margen-products-search">
                Buscar
              </Button>
              {productsSearch && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setProductsSearch("");
                    setProductsSearchInput("");
                    setProductsPage(0);
                  }}
                >
                  Limpiar
                </Button>
              )}
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingProducts ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando productos...
            </div>
          ) : !productsData || productsData.items.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              {productsSearch ? "Sin resultados para la búsqueda." : "No hay productos en la lista de precios."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Producto</TableHead>
                    <TableHead className="text-xs">Formato</TableHead>
                    <TableHead className="text-right text-xs">Lista</TableHead>
                    <TableHead className="text-right text-xs">Mínimo</TableHead>
                    <TableHead className="text-right text-xs text-amber-700">Costo</TableHead>
                    <TableHead className="text-right text-xs">Margen vs mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsData.items.map(item => {
                    const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                    const costoValue = griEntry?.price ?? (item as any).costoProduccion;
                    const costoDate = griEntry?.date ?? null;
                    const costoNum = costoValue == null ? null : (typeof costoValue === "string" ? parseFloat(costoValue) : costoValue);
                    const minimoNum = item.minimo == null ? null : (typeof item.minimo === "string" ? parseFloat(item.minimo as any) : (item.minimo as any));
                    const margenPct = costoNum && minimoNum && minimoNum > 0 ? ((minimoNum - costoNum) / minimoNum) * 100 : null;
                    return (
                      <TableRow key={item.id} className="text-xs" data-testid={`row-margen-product-${item.id}`}>
                        <TableCell className="font-mono py-2">{item.codigo}</TableCell>
                        <TableCell className="py-2 max-w-[320px] truncate" title={item.producto}>{item.producto}</TableCell>
                        <TableCell className="py-2">{item.unidad || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums py-2">
                          {item.lista ? formatCLP(Number(item.lista)) : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2">
                          {item.minimo ? formatCLP(Number(item.minimo)) : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2 font-semibold text-amber-700">
                          {costoNum ? (
                            <div>
                              {formatCLP(costoNum)}
                              {costoDate && (
                                <span className="block text-[9px] leading-tight mt-0.5 font-normal text-gray-500">
                                  {new Date(costoDate + "T00:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })}
                                </span>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {margenPct !== null ? (
                            <Badge variant="outline" className={marginBadgeClass(margenPct)}>
                              {formatPct(margenPct)}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {productsData.totalCount > productsPerPage && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-xs">
                  <div className="text-gray-600">
                    Mostrando {productsPage * productsPerPage + 1}–
                    {Math.min((productsPage + 1) * productsPerPage, productsData.totalCount)} de{" "}
                    {formatInt(productsData.totalCount)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProductsPage(p => Math.max(0, p - 1))}
                      disabled={productsPage === 0}
                      data-testid="button-margen-products-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-gray-700 px-2">
                      Página {productsPage + 1} de{" "}
                      {Math.max(1, Math.ceil(productsData.totalCount / productsPerPage))}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProductsPage(p => p + 1)}
                      disabled={!productsData.hasMore}
                      data-testid="button-margen-products-next"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
