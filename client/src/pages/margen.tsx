import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Percent,
  LayoutDashboard,
  ListChecks,
  Layers,
  Palette,
  Ruler,
  ArrowDownAZ,
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MarginDashboard } from "@/components/finanzas/margin-dashboard";

interface MargenProductRow {
  id: string;
  codigo: string;
  producto: string;
  unidad: string | null;
  lista: string | number | null;
  minimo: string | number | null;
  costoProduccion: string | number | null;
  productFamily: string | null;
  color: string | null;
  formatUnit: string | null;
}

interface MargenProductsResponse {
  items: MargenProductRow[];
  totalCount: number;
  hasMore: boolean;
}

interface AgrupacionOptions {
  families: string[];
  colors: string[];
  formatos: string[];
}

type MargenSort = "family" | "margin-asc" | "margin-desc";

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
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [productsSearch, setProductsSearch] = useState<string>("");
  const [productsSearchInput, setProductsSearchInput] = useState<string>("");
  const [productsPage, setProductsPage] = useState<number>(0);
  const [selectedFamily, setSelectedFamily] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedFormato, setSelectedFormato] = useState<string>("");
  const [marginSort, setMarginSort] = useState<MargenSort>("family");
  const [isDownloadingCsv, setIsDownloadingCsv] = useState<boolean>(false);
  const productsPerPage = 50;

  const { data: costosStatus, isLoading: loadingStatus } = useQuery<CostosStatus>({
    queryKey: ["/api/etl/status?etlName=costos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/etl/status?etlName=costos");
      return res.json();
    },
    refetchInterval: 10000,
  });

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

  const { data: griPrices } = useQuery<Record<string, { price: number; date: string | null }>>({
    queryKey: ["/api/inventory/gri-prices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/gri-prices");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery<MargenProductsResponse>({
    queryKey: [
      "/api/margen/products",
      {
        search: productsSearch,
        family: selectedFamily,
        color: selectedColor,
        formato: selectedFormato,
        limit: productsPerPage,
        offset: productsPage * productsPerPage,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: productsPerPage.toString(),
        offset: (productsPage * productsPerPage).toString(),
      });
      if (productsSearch) params.set("search", productsSearch);
      if (selectedFamily) params.set("family", selectedFamily);
      if (selectedColor) params.set("color", selectedColor);
      if (selectedFormato) params.set("formato", selectedFormato);
      const res = await apiRequest("GET", `/api/margen/products?${params}`);
      return res.json();
    },
  });

  const { data: agrupacionOptions } = useQuery<AgrupacionOptions>({
    queryKey: [
      "/api/margen/agrupacion-options",
      { family: selectedFamily, color: selectedColor, formato: selectedFormato },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFamily) params.set("family", selectedFamily);
      if (selectedColor) params.set("color", selectedColor);
      if (selectedFormato) params.set("formato", selectedFormato);
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/margen/agrupacion-options${qs ? `?${qs}` : ""}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Apply margin sort on the current page (so the user can re-order ascending /
  // descending margin within the slice they're viewing).
  const sortedItems = useMemo(() => {
    const items = productsData?.items ?? [];
    if (marginSort === "family") return items;
    const withMargin = items.map(item => {
      const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
      const costoValue = griEntry?.price ?? (item.costoProduccion as any);
      const costoNum = costoValue == null ? null : (typeof costoValue === "string" ? parseFloat(costoValue) : costoValue);
      const minimoNum = item.minimo == null ? null : (typeof item.minimo === "string" ? parseFloat(item.minimo as any) : (item.minimo as any));
      const margenPct = costoNum && minimoNum && minimoNum > 0 ? ((minimoNum - costoNum) / minimoNum) * 100 : null;
      return { item, margenPct };
    });
    withMargin.sort((a, b) => {
      const av = a.margenPct;
      const bv = b.margenPct;
      // Null margins fall to the bottom regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return marginSort === "margin-asc" ? av - bv : bv - av;
    });
    return withMargin.map(r => r.item);
  }, [productsData?.items, griPrices, marginSort]);

  const lastExec = costosStatus?.lastExecution;
  const isRunning = costosStatus?.isRunning ?? false;
  const stats = parseStats(lastExec?.statistics ?? null);

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    try {
      const params = new URLSearchParams({ limit: "10000", offset: "0" });
      if (productsSearch) params.set("search", productsSearch);
      if (selectedFamily) params.set("family", selectedFamily);
      if (selectedColor) params.set("color", selectedColor);
      if (selectedFormato) params.set("formato", selectedFormato);
      const res = await apiRequest("GET", `/api/margen/products?${params}`);
      const data: MargenProductsResponse = await res.json();

      const rows = data.items.map(item => {
        const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
        const costoValue = griEntry?.price ?? (item.costoProduccion as any);
        const costoDate = griEntry?.date ?? null;
        const costoNum = costoValue == null ? null : (typeof costoValue === "string" ? parseFloat(costoValue) : costoValue);
        const minimoNum = item.minimo == null ? null : (typeof item.minimo === "string" ? parseFloat(item.minimo as any) : (item.minimo as any));
        const listaNum = item.lista == null ? null : (typeof item.lista === "string" ? parseFloat(item.lista as any) : (item.lista as any));
        const margenPct = costoNum && minimoNum && minimoNum > 0 ? ((minimoNum - costoNum) / minimoNum) * 100 : null;
        const formato = item.formatUnit || item.unidad || "";
        return {
          codigo: item.codigo ?? "",
          producto: item.producto ?? "",
          agrupacion: item.productFamily ?? "",
          color: item.color ?? "",
          formato,
          lista: listaNum,
          minimo: minimoNum,
          costo: costoNum,
          fechaCosto: costoDate ?? "",
          margenPct,
        };
      });

      if (marginSort !== "family") {
        rows.sort((a, b) => {
          const av = a.margenPct;
          const bv = b.margenPct;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return marginSort === "margin-asc" ? av - bv : bv - av;
        });
      }

      const headers = [
        "Código",
        "Producto",
        "Agrupación",
        "Color",
        "Formato",
        "Lista",
        "Mínimo",
        "Costo",
        "Fecha Costo",
        "Margen vs Mínimo (%)",
      ];

      const numberToEs = (n: number | null, decimals = 0) => {
        if (n == null || Number.isNaN(n)) return "";
        return n.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      };

      const escape = (val: string) => {
        if (val.includes(";") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      };

      const lines: string[] = [];
      lines.push(headers.map(escape).join(";"));
      for (const r of rows) {
        lines.push([
          r.codigo,
          r.producto,
          r.agrupacion,
          r.color,
          r.formato,
          numberToEs(r.lista),
          numberToEs(r.minimo),
          numberToEs(r.costo),
          r.fechaCosto,
          numberToEs(r.margenPct, 1),
        ].map(v => escape(String(v))).join(";"));
      }

      const csvContent = lines.join("\r\n");
      const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `margen_productos_${dateStr}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "CSV descargado",
        description: `${rows.length} producto${rows.length === 1 ? "" : "s"} exportado${rows.length === 1 ? "" : "s"}.`,
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
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Modern SaaS Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 dark:from-emerald-950 dark:via-slate-950 dark:to-slate-950">
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Percent className="h-5 w-5 text-emerald-400" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Margen</h1>
              </div>
              <p className="text-slate-400 text-sm ml-12">
                Análisis de margen real, alertas y comparativas — solo administradores
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {lastExec && (
                <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 backdrop-blur-sm rounded-md px-3 py-1.5">
                  {lastExec.status === "success" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : lastExec.status === "running" || isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span>
                    Costos: {formatDistanceToNow(new Date(lastExec.startTime), { locale: es, addSuffix: true })}
                  </span>
                </div>
              )}
              <Button
                size="sm"
                onClick={() => runCostosMutation.mutate()}
                disabled={isRunning || runCostosMutation.isPending}
                className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
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
                    Importar costos
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs Navigation - inside header */}
        <div className="px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="overflow-x-auto -mx-2 px-2 scrollbar-hide">
              <TabsList className="inline-flex min-w-max gap-0.5 p-1 bg-white/10 backdrop-blur-sm rounded-t-xl border-0 h-auto">
                <TabsTrigger
                  value="dashboard"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-margen-dashboard"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 flex-shrink-0" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger
                  value="productos"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-margen-productos"
                >
                  <ListChecks className="h-3.5 w-3.5 flex-shrink-0" />
                  Productos & costos
                </TabsTrigger>
                <TabsTrigger
                  value="etl"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-margen-etl"
                >
                  <Database className="h-3.5 w-3.5 flex-shrink-0" />
                  ETL Costos
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard" className="mt-0">
            <MarginDashboard />
          </TabsContent>

          <TabsContent value="productos" className="mt-0">
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
                      Agrupación, color y formato vienen de la <strong>agrupación comercial</strong> del catálogo.
                      {productsData ? ` ${formatInt(productsData.totalCount)} productos.` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
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
                        />
                      </div>
                      <Button type="submit" size="sm" variant="secondary">Buscar</Button>
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadCsv}
                      disabled={isDownloadingCsv}
                      data-testid="button-margen-export-csv"
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
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

                {/* Filtros por agrupación comercial */}
                <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-teal-600" />
                    <Select
                      value={selectedFamily || "__all__"}
                      onValueChange={v => {
                        setSelectedFamily(v === "__all__" ? "" : v);
                        setProductsPage(0);
                      }}
                    >
                      <SelectTrigger className="h-9 w-56 text-sm" data-testid="select-margen-family">
                        <SelectValue placeholder="Todas las agrupaciones" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__all__">Todas las agrupaciones</SelectItem>
                        {(agrupacionOptions?.families ?? []).map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-purple-600" />
                    <Select
                      value={selectedColor || "__all__"}
                      onValueChange={v => {
                        setSelectedColor(v === "__all__" ? "" : v);
                        setProductsPage(0);
                      }}
                    >
                      <SelectTrigger className="h-9 w-44 text-sm" data-testid="select-margen-color">
                        <SelectValue placeholder="Todos los colores" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__all__">Todos los colores</SelectItem>
                        {(agrupacionOptions?.colors ?? []).map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5 text-amber-600" />
                    <Select
                      value={selectedFormato || "__all__"}
                      onValueChange={v => {
                        setSelectedFormato(v === "__all__" ? "" : v);
                        setProductsPage(0);
                      }}
                    >
                      <SelectTrigger className="h-9 w-44 text-sm" data-testid="select-margen-formato">
                        <SelectValue placeholder="Todos los formatos" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__all__">Todos los formatos</SelectItem>
                        {(agrupacionOptions?.formatos ?? []).map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-gray-500">Ordenar:</span>
                    <Select value={marginSort} onValueChange={v => setMarginSort(v as MargenSort)}>
                      <SelectTrigger className="h-9 w-52 text-sm" data-testid="select-margen-sort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="family">
                          <div className="flex items-center gap-2">
                            <ArrowDownAZ className="h-3.5 w-3.5 text-gray-500" />
                            <span>Agrupación / nombre</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="margin-asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="h-3.5 w-3.5 text-red-500" />
                            <span>Margen ascendente</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="margin-desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Margen descendente</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(selectedFamily || selectedColor || selectedFormato) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedFamily("");
                        setSelectedColor("");
                        setSelectedFormato("");
                        setProductsPage(0);
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-10 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando productos...
                  </div>
                ) : !productsData || sortedItems.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    {productsSearch || selectedFamily || selectedColor || selectedFormato
                      ? "Sin resultados para los filtros aplicados."
                      : "No hay productos en la lista de precios."}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Código</TableHead>
                          <TableHead className="text-xs">Producto</TableHead>
                          <TableHead className="text-xs">Agrupación</TableHead>
                          <TableHead className="text-xs">Color</TableHead>
                          <TableHead className="text-xs">Formato</TableHead>
                          <TableHead className="text-right text-xs">Lista</TableHead>
                          <TableHead className="text-right text-xs">Mínimo</TableHead>
                          <TableHead className="text-right text-xs text-amber-700">Costo</TableHead>
                          <TableHead className="text-right text-xs">Margen vs mínimo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedItems.map(item => {
                          const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                          const costoValue = griEntry?.price ?? (item.costoProduccion as any);
                          const costoDate = griEntry?.date ?? null;
                          const costoNum = costoValue == null ? null : (typeof costoValue === "string" ? parseFloat(costoValue) : costoValue);
                          const minimoNum = item.minimo == null ? null : (typeof item.minimo === "string" ? parseFloat(item.minimo as any) : (item.minimo as any));
                          const margenPct = costoNum && minimoNum && minimoNum > 0 ? ((minimoNum - costoNum) / minimoNum) * 100 : null;
                          const formato = item.formatUnit || item.unidad || "-";
                          return (
                            <TableRow key={item.id} className="text-xs">
                              <TableCell className="font-mono py-2">{item.codigo}</TableCell>
                              <TableCell className="py-2 max-w-[280px] truncate" title={item.producto}>{item.producto}</TableCell>
                              <TableCell className="py-2 max-w-[180px] truncate" title={item.productFamily || ""}>
                                {item.productFamily ? (
                                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 font-normal">
                                    {item.productFamily}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                {item.color || <span className="text-gray-400">—</span>}
                              </TableCell>
                              <TableCell className="py-2">{formato}</TableCell>
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
                          >
                            <ChevronLeft className="h-4 w-4" /> Anterior
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
          </TabsContent>

          <TabsContent value="etl" className="mt-0">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-emerald-600" />
                  Importación de costos (ETL)
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Última extracción del costo GRI (Bodega 006) desde SQL Server. Cada cambio se guarda como un nuevo snapshot histórico.
                </p>
              </CardHeader>
              <CardContent>
                {loadingStatus ? (
                  <div className="flex items-center text-gray-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando estado...
                  </div>
                ) : !lastExec ? (
                  <div className="text-sm text-gray-500">
                    Aún no se ejecutó ninguna importación. Hacé clic en <strong>Importar costos</strong> arriba para traer los costos desde SQL Server.
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
                      <div className="text-sm font-semibold mt-0.5 capitalize">
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
                      <div className="text-sm font-semibold mt-0.5">
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
                      <div className="text-lg font-bold mt-0.5">
                        {formatInt(lastExec.recordsProcessed ?? 0)}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">desde SQL Server</div>
                    </div>

                    <div className="rounded-md border bg-gray-50 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">Snapshots nuevos</div>
                      <div className="text-lg font-bold mt-0.5 text-emerald-700">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
