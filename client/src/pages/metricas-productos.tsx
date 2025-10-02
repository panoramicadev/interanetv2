import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingBag, Search, Filter, ArrowLeft, CalendarIcon, Settings2, TrendingUp, Package } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DateRange } from "react-day-picker";

interface ProductMetrics {
  productName: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  averageOrderValue: number;
  percentage: number;
}

interface ProductMetricsResponse {
  items: ProductMetrics[];
  periodTotalSales: number;
  totalProducts: number;
}

export default function MetricasProductos() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();

  // Filter states
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("month");
  const [selectedPeriod, setSelectedPeriod] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const [segment, setSegment] = useState<string>("");
  const [salesperson, setSalesperson] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Drawer state for mobile
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Local filter states for drawer
  const [localFilterType, setLocalFilterType] = useState(filterType);
  const [localSelectedPeriod, setLocalSelectedPeriod] = useState(selectedPeriod);
  const [localSelectedDate, setLocalSelectedDate] = useState(selectedDate);
  const [localSelectedYear, setLocalSelectedYear] = useState(selectedYear);
  const [localDateRange, setLocalDateRange] = useState(dateRange);
  const [localSegment, setLocalSegment] = useState(segment);
  const [localSalesperson, setLocalSalesperson] = useState(salesperson);

  // Update selected period when filter type changes
  useEffect(() => {
    switch (filterType) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        }
        break;
      case "month":
        if (!selectedPeriod || selectedPeriod.includes("_")) {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (dateRange?.from && dateRange?.to) {
          setSelectedPeriod(`${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}`);
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, dateRange]);

  // Fetch segments and salespeople for filters
  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
  });

  const { data: salespeople = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
  });

  // Fetch available periods
  const { data: availablePeriodsData } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({ queryKey: ["/api/sales/available-periods"] });

  const monthOptions = availablePeriodsData?.months || [];
  const yearOptions = availablePeriodsData?.years || [];

  // Fetch product metrics
  const { data: productMetricsResponse, isLoading } = useQuery<ProductMetricsResponse>({
    queryKey: [`/api/sales/top-products?limit=5000&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
  });

  const products = productMetricsResponse?.items || [];
  const periodTotal = productMetricsResponse?.periodTotalSales || 0;

  // Filter products by search term
  const filteredProducts = products.filter(product =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleDrawerOpen = () => {
    setLocalFilterType(filterType);
    setLocalSelectedPeriod(selectedPeriod);
    setLocalSelectedDate(selectedDate);
    setLocalSelectedYear(selectedYear);
    setLocalDateRange(dateRange);
    setLocalSegment(segment);
    setLocalSalesperson(salesperson);
    setIsDrawerOpen(true);
  };

  const handleApplyFilters = () => {
    setFilterType(localFilterType);
    setSelectedPeriod(localSelectedPeriod);
    setSelectedDate(localSelectedDate);
    setSelectedYear(localSelectedYear);
    setDateRange(localDateRange);
    setSegment(localSegment);
    setSalesperson(localSalesperson);
    setIsDrawerOpen(false);
  };

  const handleClearFilters = () => {
    const today = new Date();
    setLocalFilterType("month");
    setLocalSelectedPeriod(format(today, "yyyy-MM"));
    setLocalSelectedDate(today);
    setLocalSelectedYear(today.getFullYear());
    setLocalDateRange(undefined);
    setLocalSegment("");
    setLocalSalesperson("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-gray-200/60 px-4 py-5 m-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Métricas de Productos</h1>
                <p className="text-sm text-gray-600">Análisis completo de ventas por producto</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        {isMobile ? (
          <div className="space-y-3">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDrawerOpen}
                  className="w-full flex items-center justify-center gap-2"
                  data-testid="button-filters"
                >
                  <Settings2 className="h-4 w-4" />
                  <span>Filtros</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85vh]">
                <DrawerHeader className="text-center border-b pb-4 mb-6">
                  <DrawerTitle className="text-lg font-semibold">Filtros</DrawerTitle>
                  <DrawerDescription className="text-sm text-gray-600">
                    Personaliza la vista de productos
                  </DrawerDescription>
                </DrawerHeader>

                <div className="px-6 space-y-6 overflow-y-auto max-h-[calc(85vh-180px)]">
                  {/* Filter Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Filtrar por</label>
                    <Select value={localFilterType} onValueChange={(value: "day" | "month" | "year" | "range") => setLocalFilterType(value)}>
                      <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
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

                  {/* Period Selection */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Período</label>
                    {localFilterType === "month" && (
                      <Select value={localSelectedPeriod} onValueChange={setLocalSelectedPeriod}>
                        <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200">
                          {monthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {localFilterType === "year" && (
                      <Select value={localSelectedYear.toString()} onValueChange={(value) => setLocalSelectedYear(parseInt(value))}>
                        <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200">
                          {yearOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {localFilterType === "day" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-11 w-full justify-start text-left">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {localSelectedDate ? format(localSelectedDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={localSelectedDate} onSelect={setLocalSelectedDate} initialFocus />
                        </PopoverContent>
                      </Popover>
                    )}
                    {localFilterType === "range" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-11 w-full justify-start text-left">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {localDateRange?.from && localDateRange?.to
                              ? `${format(localDateRange.from, "dd/MM")} - ${format(localDateRange.to, "dd/MM")}`
                              : "Seleccionar rango"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="range" selected={localDateRange} onSelect={setLocalDateRange} initialFocus numberOfMonths={1} />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {/* Segment Filter */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Segmento</label>
                    <Select value={localSegment} onValueChange={setLocalSegment}>
                      <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                        <SelectValue placeholder="Todos los segmentos" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-200">
                        <SelectItem value="">Todos los segmentos</SelectItem>
                        {segments.map((seg) => (
                          <SelectItem key={seg} value={seg}>
                            {seg}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Salesperson Filter */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Vendedor</label>
                    <Select value={localSalesperson} onValueChange={setLocalSalesperson}>
                      <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                        <SelectValue placeholder="Todos los vendedores" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-200">
                        <SelectItem value="">Todos los vendedores</SelectItem>
                        {salespeople.map((sp) => (
                          <SelectItem key={sp} value={sp}>
                            {sp}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DrawerFooter className="border-t pt-4 mt-6">
                  <div className="flex space-x-3">
                    <Button variant="outline" onClick={handleClearFilters} className="flex-1" data-testid="button-clear-filters">
                      Limpiar
                    </Button>
                    <Button onClick={handleApplyFilters} className="flex-1" data-testid="button-apply-filters">
                      Aplicar filtros
                    </Button>
                  </div>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter Type */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Filtrar:</label>
              <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => setFilterType(value)}>
                <SelectTrigger className="h-9 w-28 rounded-xl border-gray-200" data-testid="select-filter-type">
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

            {/* Period Selection */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Período:</label>
              {filterType === "month" && (
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="h-9 w-44 rounded-xl border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filterType === "year" && (
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="h-9 w-32 rounded-xl border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {yearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Segment Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Segmento:</label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="h-9 w-52 rounded-xl border-gray-200">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="">Todos</SelectItem>
                  {segments.map((seg) => (
                    <SelectItem key={seg} value={seg}>
                      {seg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Salesperson Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Vendedor:</label>
              <Select value={salesperson} onValueChange={setSalesperson}>
                <SelectTrigger className="h-9 w-52 rounded-xl border-gray-200">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="">Todos</SelectItem>
                  {salespeople.map((sp) => (
                    <SelectItem key={sp} value={sp}>
                      {sp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 mb-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Ventas Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(periodTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Promedio por Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredProducts.length > 0 ? periodTotal / filteredProducts.length : 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <div className="px-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Productos</CardTitle>
                <CardDescription>Lista completa de productos con métricas de venta</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm text-gray-600">Cargando productos...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Transacciones</TableHead>
                        <TableHead className="text-right">Promedio/Orden</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.productName} data-testid={`row-product-${product.productName}`}>
                          <TableCell className="font-medium">{product.productName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.totalSales)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{product.percentage.toFixed(1)}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">{product.totalUnits.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{product.transactionCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.averageOrderValue)}</TableCell>
                          <TableCell className="text-right">
                            <Link href={`/product/${encodeURIComponent(product.productName)}`}>
                              <Button variant="ghost" size="sm" data-testid={`button-view-${product.productName}`}>
                                Ver detalle
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredProducts.map((product) => (
                    <Card key={product.productName} data-testid={`card-product-${product.productName}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{product.productName}</CardTitle>
                          <Badge variant="secondary">{product.percentage.toFixed(1)}%</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Ventas:</span>
                          <span className="font-semibold">{formatCurrency(product.totalSales)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Unidades:</span>
                          <span className="font-medium">{product.totalUnits.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Transacciones:</span>
                          <span className="font-medium">{product.transactionCount}</span>
                        </div>
                        <Link href={`/product/${encodeURIComponent(product.productName)}`}>
                          <Button variant="outline" size="sm" className="w-full mt-3" data-testid={`button-view-mobile-${product.productName}`}>
                            Ver detalle
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No se encontraron productos</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
