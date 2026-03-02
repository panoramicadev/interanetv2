import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, ShoppingBag, Package, DollarSign, Users, Award, CalendarIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───
interface ParentProductData {
  parentName: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  uniqueClients: number;
  topClient: string | null;
  topSalesperson: string | null;
  variants: Array<{
    fullName: string;
    format: string;
    color: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
  }>;
  formatBreakdown: Array<{
    format: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    percentage: number;
  }>;
  colorBreakdown: Array<{
    color: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    percentage: number;
  }>;
}

export default function ProductDetail() {
  const { productName } = useParams();

  // Date filter states
  const [selectedPeriod, setSelectedPeriod] = useState(() => format(new Date(), "yyyy-MM"));
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    switch (filterType) {
      case "day":
        if (selectedDate) setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        else setSelectedPeriod(format(new Date(), "yyyy-MM-dd"));
        break;
      case "month":
        if (!selectedPeriod || selectedPeriod.includes("_") || selectedPeriod === "current-month" || selectedPeriod === "last-month") {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (startDate && endDate) setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        else setSelectedPeriod("last-30-days");
        break;
    }
  }, [filterType, selectedDate, selectedYear, startDate, endDate]);

  // ─── Parent product variant data ───
  const { data, isLoading } = useQuery<ParentProductData>({
    queryKey: [`/api/sales/product-parent/${productName}/variants`, selectedPeriod, filterType],
    queryFn: async () => {
      const res = await fetch(
        `/api/sales/product-parent/${encodeURIComponent(productName!)}/variants?period=${selectedPeriod}&filterType=${filterType}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Error al cargar datos del producto');
      return res.json();
    },
    enabled: !!productName,
  });

  if (!productName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Producto no encontrado</h1>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const fmtCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const fmtNumber = (num: number) => new Intl.NumberFormat('es-CL').format(num);

  const getFormatIcon = (f: string) => {
    if (f.includes('Galón') || f.includes('Galones')) return '🪣';
    if (f.includes('Balde')) return '🪣';
    if (f.includes('Tineta')) return '🫙';
    if (f.includes('1/4')) return '🥤';
    if (f.includes('Litro')) return '🧴';
    if (f.includes('Kilo')) return '⚖️';
    return '📦';
  };

  const getColorDot = (color: string) => {
    const map: Record<string, string> = {
      'Blanco': '#FFFFFF', 'Negro': '#1a1a1a', 'Rojo': '#DC2626',
      'Azul': '#2563EB', 'Azul Pacífico': '#0891B2', 'Verde': '#16A34A',
      'Amarillo': '#EAB308', 'Gris': '#6B7280', 'Café': '#92400E',
      'Rosa': '#EC4899', 'Naranja': '#EA580C', 'Violeta': '#7C3AED',
      'Incoloro': '#E5E7EB', 'Beige': '#D4A574', 'Crema': '#FFF8DC',
      'Marfil': '#FFFFF0', 'Celeste': '#7DD3FC',
    };
    const hex = map[color] || '#9CA3AF';
    return (
      <div
        className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
        style={{ backgroundColor: hex }}
      />
    );
  };

  const avgOrderValue = data && data.transactionCount > 0
    ? data.totalSales / data.transactionCount
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div>
        {/* ─── Header ─── */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-4 m-3 sm:m-4 rounded-2xl shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1">
              <nav className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
                <Link href="/" className="hover:text-blue-600 transition-colors">
                  Dashboard
                </Link>
                <span>›</span>
                <span className="hidden sm:inline">Producto</span>
                <span className="hidden sm:inline">›</span>
                <span className="font-medium text-gray-900 truncate">{decodeURIComponent(productName)}</span>
              </nav>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                Análisis de Producto
              </h1>
              <p className="text-gray-600 text-sm font-semibold truncate">
                {decodeURIComponent(productName)}
              </p>
              {data && data.variants.length > 0 && (
                <p className="text-gray-500 text-xs mt-0.5">
                  {data.variants.length} variante{data.variants.length !== 1 ? 's' : ''} encontrada{data.variants.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Link href="/">
              <Button variant="outline" size="sm" className="rounded-xl border-gray-200 shadow-sm ml-4" data-testid="button-back-dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Volver al Dashboard</span>
                <span className="sm:hidden">Volver</span>
              </Button>
            </Link>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filtrar:</label>
              <Select value={filterType} onValueChange={(v: "day" | "month" | "year" | "range") => setFilterType(v)}>
                <SelectTrigger className="w-24 rounded-xl border-gray-200 shadow-sm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                  <SelectItem value="range">Rango</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Período:</label>
              {filterType === "day" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>{selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                    <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                  </PopoverContent>
                </Popover>
              ) : filterType === "range" ? (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        <span>{startDate ? format(startDate, "dd/MM") : "Inicio"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <span className="text-gray-500">-</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        <span>{endDate ? format(endDate, "dd/MM") : "Final"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus disabled={(date) => startDate ? date < startDate : false} />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : filterType === "year" ? (
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {[2026, 2025, 2024, 2023, 2022].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {(() => {
                      const months = [];
                      const now = new Date();
                      for (let i = 0; i < 12; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const val = format(d, "yyyy-MM");
                        const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
                        months.push(<SelectItem key={val} value={val}>{label.charAt(0).toUpperCase() + label.slice(1)}</SelectItem>);
                      }
                      return months;
                    })()}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </header>

        {/* ─── Main Content ─── */}
        <main className="p-4 lg:p-6 space-y-4 lg:space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
            <div className="modern-card p-4 hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Ventas</span>
              </div>
              <p className="text-lg font-bold text-green-600">{isLoading ? '...' : fmtCurrency(data?.totalSales || 0)}</p>
            </div>
            <div className="modern-card p-4 hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Unidades</span>
              </div>
              <p className="text-lg font-bold text-blue-600">{isLoading ? '...' : fmtNumber(data?.totalUnits || 0)}</p>
            </div>
            <div className="modern-card p-4 hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Transacciones</span>
              </div>
              <p className="text-lg font-bold text-purple-600">{isLoading ? '...' : fmtNumber(data?.transactionCount || 0)}</p>
            </div>
            <div className="modern-card p-4 hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Ticket Prom.</span>
              </div>
              <p className="text-lg font-bold text-indigo-600">{isLoading ? '...' : fmtCurrency(avgOrderValue)}</p>
            </div>
            <div className="modern-card p-4 hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-teal-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Clientes</span>
              </div>
              <p className="text-lg font-bold text-teal-600">{isLoading ? '...' : fmtNumber(data?.uniqueClients || 0)}</p>
            </div>
            <div className="modern-card p-4 hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-xs font-medium text-gray-500">Variantes</span>
              </div>
              <p className="text-lg font-bold text-orange-600">{isLoading ? '...' : data?.variants.length || 0}</p>
            </div>
          </div>

          {/* Top Client & Salesperson */}
          {data && (data.topClient || data.topSalesperson) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.topClient && (
                <div className="modern-card p-4 hover-lift flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500">Cliente Principal</p>
                    <p className="text-sm font-bold text-teal-700 truncate">{data.topClient}</p>
                  </div>
                </div>
              )}
              {data.topSalesperson && (
                <div className="modern-card p-4 hover-lift flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Award className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500">Vendedor Principal</p>
                    <p className="text-sm font-bold text-orange-700 truncate">{data.topSalesperson}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Tabs: Envases / Colores / Variantes ─── */}
          <Tabs defaultValue="envases" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="envases" className="text-sm">
                📦 Envases
                {data && data.formatBreakdown.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-5">{data.formatBreakdown.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="colores" className="text-sm">
                🎨 Colores
                {data && data.colorBreakdown.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-5">{data.colorBreakdown.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="variantes" className="text-sm">
                📋 Todas
                {data && data.variants.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-5">{data.variants.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ══ Envases Tab ══ */}
            <TabsContent value="envases" className="mt-4">
              <Card className="modern-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-gray-900">Desglose por Envase</CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Ventas de cada tipo de envase para este producto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  ) : data && data.formatBreakdown.length > 0 ? (
                    <>
                      {/* Format Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                        {data.formatBreakdown.map((f, i) => (
                          <div key={f.format} className={`border rounded-xl p-4 ${i === 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{getFormatIcon(f.format)}</span>
                                <span className="font-semibold text-sm text-gray-900">{f.format}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs font-medium">
                                {f.percentage.toFixed(1)}%
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Ventas</span>
                                <span className="font-bold text-green-700">{fmtCurrency(f.totalSales)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Unidades</span>
                                <span className="font-semibold text-blue-700">{fmtNumber(f.totalUnits)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Transacciones</span>
                                <span className="text-gray-700">{fmtNumber(f.transactionCount)}</span>
                              </div>
                            </div>
                            {/* Percentage bar */}
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(f.percentage, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay datos de formatos para este período</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ══ Colores Tab ══ */}
            <TabsContent value="colores" className="mt-4">
              <Card className="modern-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-gray-900">Desglose por Color</CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Ventas de cada color para este producto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  ) : data && data.colorBreakdown.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {data.colorBreakdown.map((c, i) => (
                        <div key={c.color} className={`border rounded-xl p-4 ${i === 0 ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getColorDot(c.color)}
                              <span className="font-semibold text-sm text-gray-900">{c.color}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs font-medium">
                              {c.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Ventas</span>
                              <span className="font-bold text-green-700">{fmtCurrency(c.totalSales)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Unidades</span>
                              <span className="font-semibold text-blue-700">{fmtNumber(c.totalUnits)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Transacciones</span>
                              <span className="text-gray-700">{fmtNumber(c.transactionCount)}</span>
                            </div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(c.percentage, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay datos de colores para este período</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ══ All Variants Tab ══ */}
            <TabsContent value="variantes" className="mt-4">
              <Card className="modern-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-gray-900">Todas las Variantes</CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Detalle completo de cada variante del producto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  ) : data && data.variants.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">Variante</TableHead>
                            <TableHead className="text-left">Envase</TableHead>
                            <TableHead className="text-left">Color</TableHead>
                            <TableHead className="text-right">Ventas</TableHead>
                            <TableHead className="text-right">Unidades</TableHead>
                            <TableHead className="text-right">Txns</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.variants.map((v, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-sm max-w-[200px] truncate">{v.fullName}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm">{getFormatIcon(v.format)}</span>
                                  <span className="text-sm">{v.format}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {getColorDot(v.color)}
                                  <span className="text-sm">{v.color}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-700 text-sm">
                                {fmtCurrency(v.totalSales)}
                              </TableCell>
                              <TableCell className="text-right text-sm">{fmtNumber(v.totalUnits)}</TableCell>
                              <TableCell className="text-right text-sm">{fmtNumber(v.transactionCount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay variantes para este período</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </main>
      </div>
    </div>
  );
}