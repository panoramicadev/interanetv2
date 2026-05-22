import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, TrendingUp, ShoppingBag, Package, DollarSign, Clock, CalendarIcon,
  Tag, History, Mail, Building2, Hash, KeyRound, Link as LinkIcon, Unlink,
  UserCircle, FileText, CreditCard, ExternalLink, MapPin, Phone, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

interface ClientDetails {
  totalPurchases: number;
  totalProducts: number;
  transactionCount: number;
  averageTicket: number;
  purchaseFrequency: number; // days between purchases
  segments: string[];
  lastPurchaseDate?: string;
}

interface ClientProduct {
  productName: string;
  totalPurchases: number;
  transactionCount: number;
  averagePrice: number;
  lastPurchase: string;
  daysSinceLastPurchase: number;
}

interface LastOrder {
  id: string;
  nudo: string;
  feemdo: string;
  nokopr: string;
  monto: string;
  nokofu: string;
}

interface PurchaseItem {
  id: string;
  nudo: string;
  feemdo: string;
  nokopr: string;
  monto: string;
  nokofu: string;
}

interface FichaInfo {
  id: string;
  clientCode: string | null;
  clientName: string | null;
  rut: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  email: string | null;
  paymentCondition: string | null;
  salesRepCode: string | null;
  priceList: string | null;
  creditLimit: number | null;
  creditAvailable: number | null;
  creditUsed: number | null;
}

interface AccountStatus {
  hasFicha: boolean;
  ficha: FichaInfo | null;
  inEcommerce: boolean;
  linked: boolean;
  ecommerceUserId: string | null;
  clientId: string | null;
  pendingRequest: {
    id: string;
    empresa: string;
    rut: string;
    contacto: string;
    email: string;
    telefono: string;
    ciudad: string;
    createdAt: string;
  } | null;
}

export default function ClientDetail() {
  const { clientName } = useParams();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "supervisor" || user?.role === "encargado_area" || user?.role === "reception";

  // Date filter states - default to last 30 days for better initial data display
  const [selectedPeriod, setSelectedPeriod] = useState<string>("last-30-days");
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("range");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isLastPurchaseActive, setIsLastPurchaseActive] = useState(false);
  const [periodInitializedFor, setPeriodInitializedFor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("resumen");

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

  const decodedClientName = clientName ? decodeURIComponent(clientName) : '';

  // Fetch last order to get the global last purchase date (independent of period filters)
  const { data: lastOrder } = useQuery<LastOrder>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/last-order`],
    enabled: !!decodedClientName,
  });

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
        if (!selectedPeriod || selectedPeriod.includes("_") || selectedPeriod === "current-month" || selectedPeriod === "last-month" || selectedPeriod === "last-30-days" || selectedPeriod === "last-7-days") {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (startDate && endDate) {
          setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, startDate, endDate]);

  // On first load (per client), default the period to the client's last-purchase
  // month so the KPIs show real data immediately instead of an empty
  // "last 30 days" window. Skips clients with no sales; never overrides a manual change.
  useEffect(() => {
    if (periodInitializedFor === decodedClientName) return;
    if (!lastOrder?.feemdo) return;
    const lastDate = new Date(lastOrder.feemdo);
    if (Number.isNaN(lastDate.getTime())) return;
    setFilterType("month");
    setSelectedPeriod(format(lastDate, "yyyy-MM"));
    setIsLastPurchaseActive(true);
    setPeriodInitializedFor(decodedClientName);
  }, [lastOrder, decodedClientName, periodInitializedFor]);

  // Handler for "Mes Ultima Compra" button
  const handleLastPurchaseMonth = useCallback(() => {
    if (!lastOrder?.feemdo) return;
    const lastDate = new Date(lastOrder.feemdo);
    const monthPeriod = format(lastDate, "yyyy-MM");
    setFilterType("month");
    setSelectedPeriod(monthPeriod);
    setIsLastPurchaseActive(true);
  }, [lastOrder]);

  const handleFilterTypeChange = useCallback((value: "day" | "month" | "year" | "range") => {
    setFilterType(value);
    setIsLastPurchaseActive(false);
  }, []);

  const handlePeriodChange = useCallback((value: string) => {
    setSelectedPeriod(value);
    setIsLastPurchaseActive(false);
  }, []);

  const { data: details, isLoading: isLoadingDetails } = useQuery<ClientDetails>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/details?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!decodedClientName,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<ClientProduct[]>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/products?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!decodedClientName,
  });

  // Account status — powers the status badges + commercial panel
  const { data: accountStatus } = useQuery<AccountStatus>({
    queryKey: [`/api/clients/account-status?name=${encodeURIComponent(decodedClientName)}`],
    enabled: !!decodedClientName,
  });

  // Purchase history (recent transactions) for the "Pedidos" tab
  const { data: purchaseHistory = [], isLoading: isLoadingHistory } = useQuery<PurchaseItem[]>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/purchase-history?limit=25`],
    enabled: !!decodedClientName && activeTab === "pedidos",
  });

  const ficha = accountStatus?.ficha;

  if (!decodedClientName) {
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

  const formatCurrency = (amount: number | null | undefined) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('es-CL').format(num);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  const getFrequencyDescription = (days: number) => {
    if (days < 1) return 'Diario';
    if (days < 7) return `Cada ${Math.round(days)} dias`;
    if (days < 30) return `Cada ${Math.round(days / 7)} semanas`;
    return `Cada ${Math.round(days / 30)} meses`;
  };

  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-green-600';
    if (days <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const lastPurchaseLabel = lastOrder?.feemdo
    ? format(new Date(lastOrder.feemdo), "MMMM yyyy", { locale: es })
    : null;

  const vendedor = lastOrder?.nokofu || ficha?.salesRepCode || null;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
        {/* Profile Header — modern dark gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 md:p-7 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
          <div className="relative">
            <nav className="flex items-center space-x-1 text-xs text-slate-400 mb-3">
              <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
              <span>&rsaquo;</span>
              <span className="hidden sm:inline">Cliente</span>
              <span className="hidden sm:inline">&rsaquo;</span>
              <span className="font-medium text-slate-200 truncate">{decodedClientName}</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-2xl font-bold shadow-lg shrink-0">
                {decodedClientName?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">{decodedClientName}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-300 text-sm">
                  {ficha?.email && (
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {ficha.email}</span>
                  )}
                  {ficha?.rut && (
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {ficha.rut}</span>
                  )}
                  {ficha?.clientCode && (
                    <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> {ficha.clientCode}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-3">
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  <Link href="/">
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white" data-testid="button-back-dashboard">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Volver al Dashboard</span>
                      <span className="sm:hidden">Volver</span>
                    </Button>
                  </Link>
                  {canManage && accountStatus?.inEcommerce && (
                    <Link href="/clientes">
                      <Button size="sm" className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white" data-testid="button-manage-ecommerce">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Administrar en eCommerce
                      </Button>
                    </Link>
                  )}
                </div>
                {/* Status badges — the four client contexts */}
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  {accountStatus?.inEcommerce ? (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-3 py-1">
                      <KeyRound className="h-3 w-3 mr-1" /> En eCommerce
                    </Badge>
                  ) : accountStatus?.pendingRequest ? (
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-3 py-1">
                      <Clock className="h-3 w-3 mr-1" /> Solicitó unirse
                    </Badge>
                  ) : accountStatus?.hasFicha ? (
                    <Badge className="bg-slate-500/30 text-slate-200 border-slate-400/30 px-3 py-1">
                      <UserCircle className="h-3 w-3 mr-1" /> Cliente registrado
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-500/30 text-slate-200 border-slate-400/30 px-3 py-1">
                      <UserCircle className="h-3 w-3 mr-1" /> Cliente
                    </Badge>
                  )}
                  {accountStatus?.inEcommerce && (
                    accountStatus.linked ? (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">
                        <LinkIcon className="h-3 w-3 mr-1" /> Vinculado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-3 py-1">
                        <Unlink className="h-3 w-3 mr-1" /> Sin ficha
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="bg-white border border-gray-200/60 px-3 sm:px-4 py-3 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filtrar:</label>
              <Select value={filterType} onValueChange={handleFilterTypeChange}>
                <SelectTrigger className="w-24 rounded-xl border-gray-200 shadow-sm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                  <SelectItem value="range">Rango</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Periodo:</label>
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
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {availablePeriods?.years.map((year) => (
                      <SelectItem key={year.value} value={year.value}>{year.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {availablePeriods?.months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {lastOrder?.feemdo && (
              <Button
                variant={isLastPurchaseActive ? "default" : "outline"}
                size="sm"
                onClick={handleLastPurchaseMonth}
                className={`rounded-xl shadow-sm text-sm whitespace-nowrap ${isLastPurchaseActive ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"}`}
                title={lastPurchaseLabel ? `Ir a ${lastPurchaseLabel}` : undefined}
              >
                <History className="mr-2 h-4 w-4" />
                Mes Ultima Compra
                {lastPurchaseLabel && (
                  <span className={`ml-1.5 text-xs ${isLastPurchaseActive ? "text-blue-100" : "text-blue-500"}`}>({lastPurchaseLabel})</span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Pending request alert */}
        {accountStatus?.pendingRequest && (
          <Card className="border-orange-200 bg-orange-50/60 shadow-sm">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-orange-800">Solicitud de acceso al eCommerce pendiente</h3>
                <p className="text-xs text-orange-600 mt-0.5">
                  {accountStatus.pendingRequest.contacto || accountStatus.pendingRequest.empresa} solicitó unirse el {formatDate(accountStatus.pendingRequest.createdAt)}.
                  Revísala en la pestaña <span className="font-medium">Solicitudes</span> de Usuarios eCommerce.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider">Compras Totales</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-900" data-testid="text-total-purchases">
                    {isLoadingDetails ? '…' : formatCurrency(details?.totalPurchases || 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-purple-600 uppercase tracking-wider">Transacciones</p>
                  <p className="text-xl lg:text-2xl font-bold text-purple-900" data-testid="text-transaction-count">
                    {isLoadingDetails ? '…' : formatNumber(details?.transactionCount || 0)}
                  </p>
                </div>
                <ShoppingBag className="h-8 w-8 text-purple-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Productos Diferentes</p>
                  <p className="text-xl lg:text-2xl font-bold text-blue-900" data-testid="text-total-products">
                    {isLoadingDetails ? '…' : formatNumber(details?.totalProducts || 0)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">Ticket Promedio</p>
                  <p className="text-xl lg:text-2xl font-bold text-indigo-900" data-testid="text-average-ticket">
                    {isLoadingDetails ? '…' : formatCurrency(details?.averageTicket || 0)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-orange-600 uppercase tracking-wider">Frecuencia</p>
                  <p className="text-lg lg:text-xl font-bold text-orange-900" data-testid="text-purchase-frequency">
                    {isLoadingDetails ? '…' : getFrequencyDescription(details?.purchaseFrequency || 0)}
                  </p>
                  <p className="text-[10px] text-orange-700/70">{isLoadingDetails ? '' : `${details?.purchaseFrequency || 0} dias prom.`}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-rose-600 uppercase tracking-wider">Última Compra</p>
                  <p className="text-lg lg:text-xl font-bold text-rose-900">{lastOrder?.feemdo ? formatDate(lastOrder.feemdo) : '—'}</p>
                </div>
                <CalendarIcon className="h-8 w-8 text-rose-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-violet-600 uppercase tracking-wider">Vendedor</p>
                  <p className="text-sm lg:text-base font-bold text-violet-900 truncate">{vendedor || '—'}</p>
                </div>
                <UserCircle className="h-8 w-8 text-violet-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-teal-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-teal-600 uppercase tracking-wider">Segmentos</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {details?.segments && details.segments.length > 0 ? (
                      details.segments.slice(0, 3).map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] bg-teal-100 text-teal-700 hover:bg-teal-200">{s}</Badge>
                      ))
                    ) : (
                      <span className="text-sm font-bold text-teal-900">—</span>
                    )}
                  </div>
                </div>
                <Tag className="h-8 w-8 text-teal-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
            <TabsTrigger value="resumen" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ShoppingBag className="h-4 w-4" /> Resumen
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <UserCircle className="h-4 w-4" /> Información
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" /> Pedidos
            </TabsTrigger>
          </TabsList>

          {/* Resumen tab — products bought */}
          <TabsContent value="resumen" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-blue-500" />
                  Productos Comprados por el Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {isLoadingProducts ? (
                    <div className="space-y-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
                      ))}
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-8 space-y-1">
                      {!lastOrder?.feemdo ? (
                        <p className="text-gray-500">Este cliente no tiene historial de compras registrado.</p>
                      ) : (
                        <>
                          <p className="text-gray-500">Sin compras en el período seleccionado.</p>
                          <p className="text-sm text-gray-400">Última compra: {formatDate(lastOrder.feemdo)}. Cambiá el período para verla.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    products.map((product, index) => (
                      <div
                        key={product.productName}
                        className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        data-testid={`product-${index}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="text-xs shrink-0">#{index + 1}</Badge>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{product.productName}</p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                <p className="text-xs text-gray-500">{formatNumber(product.transactionCount)} transacciones</p>
                                <p className="text-xs text-gray-500">Precio promedio: {formatCurrency(product.averagePrice)}</p>
                                <p className={`text-xs ${getDaysColor(product.daysSinceLastPurchase)}`}>Ultima compra: {product.daysSinceLastPurchase} dias</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(product.totalPurchases)}</p>
                          <p className="text-xs text-gray-500">{formatDate(product.lastPurchase)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Información tab — general + commercial from ficha */}
          <TabsContent value="info" className="mt-4">
            {!accountStatus?.hasFicha ? (
              <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800">Sin ficha SAP asociada</h3>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Este cliente no tiene una ficha de cliente (SAP) en el sistema, por lo que no hay información comercial disponible. Los datos mostrados provienen del historial de ventas.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-blue-500" /> Información General
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      { label: "Nombre", value: ficha?.clientName || decodedClientName, icon: UserCircle },
                      { label: "Email", value: ficha?.email, icon: Mail },
                      { label: "RUT", value: ficha?.rut, icon: Building2 },
                      { label: "Código", value: ficha?.clientCode, icon: Hash },
                      { label: "Teléfono", value: ficha?.phone, icon: Phone },
                      { label: "Dirección", value: ficha?.address, icon: MapPin },
                      { label: "Comuna", value: ficha?.commune, icon: MapPin },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                        <span className="text-sm text-muted-foreground flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span>
                        <span className="text-sm font-medium text-right max-w-[60%] truncate">{value || "—"}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-500" /> Información Comercial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      { label: "Condición de Pago", value: ficha?.paymentCondition },
                      { label: "Vendedor", value: vendedor },
                      { label: "Lista de Precios", value: ficha?.priceList },
                      { label: "Límite de Crédito", value: ficha?.creditLimit != null ? formatCurrency(ficha.creditLimit) : null },
                      { label: "Crédito Usado", value: ficha?.creditUsed != null ? formatCurrency(ficha.creditUsed) : null },
                      { label: "Crédito Disponible", value: ficha?.creditAvailable != null ? formatCurrency(ficha.creditAvailable) : null },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium text-right max-w-[60%] truncate">{value || "—"}</span>
                      </div>
                    ))}
                    {canManage && accountStatus?.inEcommerce && (
                      <div className="pt-3">
                        <Link href="/clientes">
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Editar en Usuarios eCommerce
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Pedidos tab — purchase history */}
          <TabsContent value="pedidos" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" /> Historial de Compras (SAP)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {isLoadingHistory ? (
                    <div className="space-y-2">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse h-14 bg-gray-200 rounded-lg"></div>
                      ))}
                    </div>
                  ) : purchaseHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Sin compras registradas para este cliente</p>
                  ) : (
                    purchaseHistory.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.nokopr || 'Producto'}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {formatDate(item.feemdo)}</span>
                            {item.nudo && <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {item.nudo}</span>}
                            {item.nokofu && <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" /> {item.nokofu}</span>}
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 ml-4 shrink-0">{formatCurrency(Number(item.monto) || 0)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
