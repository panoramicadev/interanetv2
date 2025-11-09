import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, ShoppingBag, Package, DollarSign, Users, Award, CalendarIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductDetails {
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  averageOrderValue: number;
  topClient: string;
  topSalesperson: string;
}

interface ProductFormat {
  format: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  averagePrice: number;
  percentage: number;
}

interface ProductColor {
  color: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  averagePrice: number;
  percentage: number;
}

interface ProductDetailProps {
  productNameOverride?: string;
  embedded?: boolean;
  onClose?: () => void;
}

export default function ProductDetail({ productNameOverride, embedded = false, onClose }: ProductDetailProps = {}) {
  const params = useParams();
  const productName = productNameOverride || params.productName;
  
  // Date filter states
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return format(new Date(), "yyyy-MM");
  });
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Update selected period when filter type changes
  useEffect(() => {
    switch (filterType) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        } else {
          setSelectedPeriod(format(new Date(), "yyyy-MM-dd"));
        }
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
        if (startDate && endDate) {
          setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        } else {
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, startDate, endDate]);
  
  const { data: details, isLoading: isLoadingDetails } = useQuery<ProductDetails>({
    queryKey: [`/api/sales/product/${productName}/details?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!productName,
  });

  const { data: formats = [], isLoading: isLoadingFormats } = useQuery<ProductFormat[]>({
    queryKey: [`/api/sales/product/${productName}/formats?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!productName,
  });

  const { data: colors = [], isLoading: isLoadingColors } = useQuery<ProductColor[]>({
    queryKey: [`/api/sales/product/${productName}/colors?period=${selectedPeriod}&filterType=${filterType}`],
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const getFormatIcon = (format: string) => {
    if (format?.toLowerCase().includes('galón') || format?.toLowerCase().includes('galon')) return '🪣';
    if (format?.toLowerCase().includes('balde')) return '🪣';
    if (format?.toLowerCase().includes('litro')) return '🥤';
    return '📦';
  };

  const getColorIcon = (color: string) => {
    const colorMap: { [key: string]: string } = {
      'blanco': '⚪',
      'negro': '⚫',
      'rojo': '🔴',
      'azul': '🔵',
      'verde': '🟢',
      'amarillo': '🟡',
      'naranja': '🟠',
      'morado': '🟣',
      'cafe': '🟤',
      'gris': '⚫',
    };
    const lowerColor = color?.toLowerCase() || '';
    return colorMap[lowerColor] || '🎨';
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-background"}>
      <div>
        {/* Header - Compact Layout */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-4 m-3 sm:m-4 rounded-2xl shadow-sm">
          {/* Title Section */}
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1">
              {!embedded && (
                <nav className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
                  <Link href="/" className="hover:text-blue-600 transition-colors">
                    Dashboard
                  </Link>
                  <span>›</span>
                  <span className="hidden sm:inline">Producto</span>
                  <span className="hidden sm:inline">›</span>
                  <span className="font-medium text-gray-900 truncate">{decodeURIComponent(productName)}</span>
                </nav>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                Análisis de Producto
              </h1>
              <p className="text-gray-600 text-sm font-semibold truncate">
                {decodeURIComponent(productName)}
              </p>
              <p className="text-gray-600 text-sm">
                {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : filterType === "year" ? "Análisis anual" : "Análisis por rango"}
              </p>
            </div>
            
            {embedded ? (
              <div className="flex gap-2 ml-4">
                {onClose && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={onClose}
                    className="rounded-xl"
                    data-testid="button-close-modal"
                  >
                    ✕
                  </Button>
                )}
                <Link href={`/product/${encodeURIComponent(productName)}`}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-xl border-gray-200 shadow-sm"
                    data-testid="button-go-to-full-product"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Ir al tablero completo</span>
                    <span className="sm:hidden">Abrir</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <Link href="/">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl border-gray-200 shadow-sm ml-4"
                  data-testid="button-back-dashboard"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Volver al Dashboard</span>
                  <span className="sm:hidden">Volver</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Filter Controls - Horizontal Layout */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter Type */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Filtrar:
              </label>
              <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => setFilterType(value)}>
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

            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Período:
              </label>
              {filterType === "day" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-40 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : filterType === "range" ? (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        <span>
                          {startDate ? format(startDate, "dd/MM") : "Inicio"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <span className="text-gray-500">-</span>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        <span>
                          {endDate ? format(endDate, "dd/MM") : "Final"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        disabled={(date) => startDate ? date < startDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : filterType === "year" ? (
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                    <SelectItem value="2021">2021</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                    <SelectItem value="2025-08">Agosto 2025</SelectItem>
                    <SelectItem value="2025-07">Julio 2025</SelectItem>
                    <SelectItem value="2025-06">Junio 2025</SelectItem>
                    <SelectItem value="2025-05">Mayo 2025</SelectItem>
                    <SelectItem value="current-month">Mes actual</SelectItem>
                    <SelectItem value="last-month">Mes anterior</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Ventas Totales</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600" data-testid="text-total-sales">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalSales || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center ml-4">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Unidades Vendidas</p>
                  <p className="text-xl lg:text-2xl font-bold text-blue-600" data-testid="text-total-units">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalUnits || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center ml-4">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Transacciones</p>
                  <p className="text-xl lg:text-2xl font-bold text-purple-600" data-testid="text-transaction-count">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.transactionCount || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center ml-4">
                  <ShoppingBag className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Valor Promedio Orden</p>
                  <p className="text-xl lg:text-2xl font-bold text-indigo-600" data-testid="text-average-order-value">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageOrderValue || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center ml-4">
                  <TrendingUp className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Cliente Principal</p>
                  <p className="text-lg font-bold text-teal-600 truncate" data-testid="text-top-client">
                    {isLoadingDetails ? 'Cargando...' : details?.topClient || 'N/A'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center ml-4">
                  <Users className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Vendedor Principal</p>
                  <p className="text-lg font-bold text-orange-600 truncate" data-testid="text-top-salesperson">
                    {isLoadingDetails ? 'Cargando...' : details?.topSalesperson || 'N/A'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center ml-4">
                  <Award className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Format Analytics */}
          <Card className="modern-card hover-lift">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">Formatos Más Vendidos</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Análisis de ventas por formato de presentación
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFormats ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Cargando formatos...</p>
                </div>
              ) : formats.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">Formato</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Transacciones</TableHead>
                        <TableHead className="text-right">Precio Promedio</TableHead>
                        <TableHead className="text-right">Participación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formats.map((format, index) => (
                        <TableRow key={index} data-testid={`row-format-${index}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getFormatIcon(format.format)}</span>
                              <span className="truncate">{format.format || 'Sin formato'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(format.totalSales)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(format.totalUnits)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(format.transactionCount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(format.averagePrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="font-medium">
                              {(format.percentage || 0).toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay datos de formatos para este período</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Color Analytics */}
          <Card className="modern-card hover-lift">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">Colores Más Vendidos</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Análisis de ventas por color del producto
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingColors ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Cargando colores...</p>
                </div>
              ) : colors.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">Color</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Transacciones</TableHead>
                        <TableHead className="text-right">Precio Promedio</TableHead>
                        <TableHead className="text-right">Participación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {colors.map((color, index) => (
                        <TableRow key={index} data-testid={`row-color-${index}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getColorIcon(color.color)}</span>
                              <span className="truncate">{color.color || 'Sin color'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(color.totalSales)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(color.totalUnits)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(color.transactionCount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(color.averagePrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="font-medium">
                              {(color.percentage || 0).toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay datos de colores para este período</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}