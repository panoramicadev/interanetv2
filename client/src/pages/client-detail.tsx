import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, ShoppingBag, Package, DollarSign, Clock, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface ClientDetails {
  totalPurchases: number;
  totalProducts: number;
  transactionCount: number;
  averageTicket: number;
  purchaseFrequency: number; // days between purchases
}

interface ClientProduct {
  productName: string;
  totalPurchases: number;
  transactionCount: number;
  averagePrice: number;
  lastPurchase: string;
  daysSinceLastPurchase: number;
}

export default function ClientDetail() {
  const { clientName } = useParams();
  const { user } = useAuth();
  
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
  
  const { data: details, isLoading: isLoadingDetails } = useQuery<ClientDetails>({
    queryKey: [`/api/sales/client/${clientName}/details?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!clientName,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<ClientProduct[]>({
    queryKey: [`/api/sales/client/${clientName}/products?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!clientName,
  });

  if (!clientName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Cliente no encontrado</h1>
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  const getFrequencyDescription = (days: number) => {
    if (days < 1) return 'Diario';
    if (days < 7) return `Cada ${Math.round(days)} días`;
    if (days < 30) return `Cada ${Math.round(days / 7)} semanas`;
    return `Cada ${Math.round(days / 30)} meses`;
  };

  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-green-600';
    if (days <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-background">
      <div>
        {/* Header - Compact Layout */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-4 m-3 sm:m-4 rounded-2xl shadow-sm">
          {/* Title Section */}
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1">
              <nav className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
                <Link href="/" className="hover:text-blue-600 transition-colors">
                  Dashboard
                </Link>
                <span>›</span>
                <span className="hidden sm:inline">Cliente</span>
                <span className="hidden sm:inline">›</span>
                <span className="font-medium text-gray-900 truncate">{decodeURIComponent(clientName)}</span>
              </nav>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                Análisis de Cliente
              </h1>
              <p className="text-gray-600 text-sm font-semibold truncate">
                {decodeURIComponent(clientName)}
              </p>
              <p className="text-gray-600 text-sm">
                {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : filterType === "year" ? "Análisis anual" : "Análisis por rango"}
              </p>
            </div>
            
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Compras Totales</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600" data-testid="text-total-purchases">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalPurchases || 0)}
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
                  <p className="text-sm font-medium text-muted-foreground mb-2">Productos Diferentes</p>
                  <p className="text-xl lg:text-2xl font-bold text-blue-600" data-testid="text-total-products">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalProducts || 0)}
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
                  <p className="text-sm font-medium text-muted-foreground mb-2">Frecuencia de Compra</p>
                  <p className="text-xl lg:text-2xl font-bold text-orange-600" data-testid="text-purchase-frequency">
                    {isLoadingDetails ? 'Cargando...' : getFrequencyDescription(details?.purchaseFrequency || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLoadingDetails ? '' : `${details?.purchaseFrequency || 0} días promedio`}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center ml-4">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Additional KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Ticket Promedio</p>
                  <p className="text-xl lg:text-2xl font-bold text-indigo-600" data-testid="text-average-ticket">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageTicket || 0)}
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
                  <p className="text-sm font-medium text-muted-foreground mb-2">Diversidad de Productos</p>
                  <p className="text-xl lg:text-2xl font-bold text-teal-600">
                    {isLoadingDetails ? 'Cargando...' : details?.totalProducts && details?.transactionCount 
                      ? (details.totalProducts / details.transactionCount * 100).toFixed(1) 
                      : '0.0'}%
                    <span className="text-sm text-muted-foreground ml-1">variedad</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center ml-4">
                  <Package className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Productos Comprados por el Cliente</h2>
            </div>
            
            <div className="space-y-3">
              {isLoadingProducts ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay productos registrados para este cliente</p>
              ) : (
                products.map((product, index) => (
                  <div 
                    key={product.productName}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    data-testid={`product-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {product.productName}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-xs text-gray-500">
                              {formatNumber(product.transactionCount)} transacciones
                            </p>
                            <p className="text-xs text-gray-500">
                              Precio promedio: {formatCurrency(product.averagePrice)}
                            </p>
                            <p className={`text-xs ${getDaysColor(product.daysSinceLastPurchase)}`}>
                              Última compra: {product.daysSinceLastPurchase} días
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(product.totalPurchases)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(product.lastPurchase)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}