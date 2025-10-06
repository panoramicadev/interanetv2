import { useAuth } from "@/hooks/useAuth";
import type { User, SalespersonUser } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import KPICards from "@/components/dashboard/kpi-cards";
import SalesChart from "@/components/dashboard/sales-chart";
import TransactionsTable from "@/components/dashboard/transactions-table";
import TopProductsChart from "@/components/dashboard/top-products-chart";
import NotificationsPanel from "@/components/dashboard/notifications-panel";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Package, 
  Calendar as CalendarIcon, 
  Target, 
  BarChart3, 
  FileText, 
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Info,
  Bell,
  Clock,
  TrendingDown,
  Star,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Helper function to get current month name
const getCurrentMonthLabel = () => {
  const monthName = format(new Date(), "MMMM yyyy", { locale: es });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
};

// Type definitions for API responses
interface GoalProgress {
  id: string;
  type: string;
  target?: string;
  amount: number;
  period: string;
  description?: string;
  currentSales: number;
  targetAmount: number;
  progress: number;
  remaining: number;
  isCompleted: boolean;
}

interface SalespersonDashboardData {
  totalSales: number;
  transactions: number;
  avgTicket: number;
  topProducts: any[];
  recentSales: any[];
  clientCount?: number;
  daysSinceLastSale?: number;
  productivity?: number;
}

type ClientData = any; // Can be refined later if needed

export default function TecnicoObraDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth() as { user: (User & { salespersonName?: string }) | null; isAuthenticated: boolean; isLoading: boolean };
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const [filterType, setFilterType] = useState<"day" | "month" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Date range state for custom range selection
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  
  // Client search state
  const [clientSearch, setClientSearch] = useState("");
  
  // Dialog state
  const [showClientsDialog, setShowClientsDialog] = useState(false);
  
  // Reset client search when dialog closes
  useEffect(() => {
    if (!showClientsDialog) {
      setClientSearch("");
    }
  }, [showClientsDialog]);
  
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
        setSelectedPeriod("current-month");
        break;
      case "range":
        if (startDate && endDate) {
          setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        } else {
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  }, [filterType, selectedDate, startDate, endDate]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: salespersonData, isLoading: loadingSalesperson } = useQuery<SalespersonDashboardData>({
    queryKey: [`/api/salesperson/${user?.id}/dashboard?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!user?.id,
    staleTime: 300000, // 5 minutos
  });

  // Usar el mismo endpoint que el panel de clientes del dashboard
  const { data: clientsResponse, isLoading: loadingClients } = useQuery<{ items: any[] }>({
    queryKey: [`/api/sales/top-clients?limit=5000&period=${selectedPeriod}&filterType=${filterType}${user?.salespersonName ? `&salesperson=${encodeURIComponent(user.salespersonName)}` : ''}`],
    enabled: !!user?.salespersonName,
  });

  const { data: goalsData, isLoading: loadingGoals } = useQuery<GoalProgress[]>({
    queryKey: [`/api/salesperson/${user?.id}/goals?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!user?.id,
  });

  if (isLoading || loadingSalesperson || loadingClients || loadingGoals) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Safe data access with proper defaults
  const salesData: SalespersonDashboardData = {
    totalSales: salespersonData?.totalSales || 0,
    transactions: salespersonData?.transactions || 0,
    avgTicket: salespersonData?.avgTicket || 0,
    topProducts: salespersonData?.topProducts || [],
    recentSales: salespersonData?.recentSales || [],
    clientCount: salespersonData?.clientCount || 0,
    daysSinceLastSale: salespersonData?.daysSinceLastSale || 0,
    productivity: salespersonData?.productivity || 0
  };

  const clients = Array.isArray(clientsResponse?.items) ? clientsResponse.items : [];
  const goals = Array.isArray(goalsData) ? goalsData : [];
  const primaryGoal = goals.length > 0 ? goals[0] : null;

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
        <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
              Dashboard Vendedor - {user?.salespersonName || `${user?.firstName} ${user?.lastName}`}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
              Panel de control personalizado para gestión de ventas
            </p>
          </div>

          {/* Controles de Período y Notificaciones */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
            {/* Panel de Notificaciones */}
            {user?.salespersonName && (
              <NotificationsPanel 
                salespersonName={user.salespersonName} 
                salespersonId={user.id}
              />
            )}
            
            <Select value={filterType} onValueChange={(value: "day" | "month" | "range") => setFilterType(value)}>
              <SelectTrigger className="w-full sm:w-[140px] rounded-xl">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Por día</SelectItem>
                <SelectItem value="month">Por mes</SelectItem>
                <SelectItem value="range">Rango</SelectItem>
              </SelectContent>
            </Select>

            {filterType === "day" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[200px] justify-start text-left font-normal rounded-xl">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {filterType === "range" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[140px] justify-start text-left font-normal rounded-xl">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM") : "Inicio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[140px] justify-start text-left font-normal rounded-xl">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM") : "Fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {filterType === "month" && (
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full sm:w-[200px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">{getCurrentMonthLabel()}</SelectItem>
                  <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                  <SelectItem value="2025-08">Agosto 2025</SelectItem>
                  <SelectItem value="2025-07">Julio 2025</SelectItem>
                  <SelectItem value="2025-06">Junio 2025</SelectItem>
                  <SelectItem value="2025-05">Mayo 2025</SelectItem>
                  <SelectItem value="last-month">Mes anterior</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="px-4 lg:px-6 pb-6 space-y-6">
        {/* Progreso de Meta Principal - Solo si hay metas */}
        {primaryGoal && (
          <Card className="rounded-2xl shadow-sm border-green-100 bg-gradient-to-r from-green-50 to-blue-50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-semibold text-gray-700">Meta de Ventas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(primaryGoal.progress || 0) >= 100 ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (primaryGoal.progress || 0) >= 70 ? (
                      <TrendingUp className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${
                      (primaryGoal.progress || 0) >= 100 ? 'text-green-600' : 
                      (primaryGoal.progress || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(primaryGoal.progress || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      (primaryGoal.progress || 0) >= 100 ? 'bg-green-500' : 
                      (primaryGoal.progress || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(primaryGoal.progress || 0, 100)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Actual: <strong>${(primaryGoal.currentSales || 0).toLocaleString()}</strong></span>
                  <span>Meta: <strong>${(primaryGoal.targetAmount || 0).toLocaleString()}</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs del Vendedor */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-2xl shadow-sm border-blue-100 bg-gradient-to-br from-blue-50 to-white" data-testid="card-ventas-totales">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Ventas Totales</CardTitle>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900" data-testid="text-ventas-totales">
                ${salesData.totalSales.toLocaleString()}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Este período
              </p>
            </CardContent>
          </Card>

          <Card 
            className="rounded-2xl shadow-sm border-green-100 bg-gradient-to-br from-green-50 to-white cursor-pointer hover:shadow-md transition-shadow" 
            data-testid="card-clientes"
            onClick={() => setShowClientsDialog(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900">Clientes</CardTitle>
              <Users className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900" data-testid="text-clientes">
                {salesData.clientCount}
              </div>
              <p className="text-xs text-green-600 mt-1">
                Atendidos · Click para ver
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-purple-100 bg-gradient-to-br from-purple-50 to-white" data-testid="card-transacciones">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">Transacciones</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900" data-testid="text-transacciones">
                {salesData.transactions}
              </div>
              <p className="text-xs text-purple-600 mt-1">
                Realizadas
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-orange-100 bg-gradient-to-br from-orange-50 to-white" data-testid="card-dias-ultima-venta">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900">Días desde última venta</CardTitle>
              <Clock className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900" data-testid="text-dias-ultima-venta">
                {salesData.daysSinceLastSale}
              </div>
              <p className="text-xs text-orange-600 mt-1">
                días
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-indigo-100 bg-gradient-to-br from-indigo-50 to-white" data-testid="card-ticket-promedio">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-indigo-900">Ticket Promedio</CardTitle>
              <BarChart3 className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-900" data-testid="text-ticket-promedio">
                ${salesData.avgTicket.toLocaleString()}
              </div>
              <p className="text-xs text-indigo-600 mt-1">
                Por transacción
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-pink-100 bg-gradient-to-br from-pink-50 to-white" data-testid="card-productividad">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-pink-900">Productividad</CardTitle>
              <Star className="h-5 w-5 text-pink-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-900" data-testid="text-productividad">
                {(salesData.productivity || 0).toFixed(1)}
              </div>
              <p className="text-xs text-pink-600 mt-1">
                trans/cliente
              </p>
            </CardContent>
          </Card>
        </div>


        {/* Tendencia de Ventas - Ancho completo */}
        <div className="modern-card p-5 lg:p-6 hover-lift">
          <SalesChart 
            selectedPeriod={selectedPeriod} 
            filterType={filterType}
            salesperson={user?.salespersonName}
          />
        </div>

        {/* Top Productos */}
        <div className="modern-card p-5 lg:p-6 hover-lift">
          <TopProductsChart 
            selectedPeriod={selectedPeriod} 
            filterType={filterType}
            salesperson={user?.salespersonName}
          />
        </div>

        {/* Tabla de Transacciones */}
        <div className="modern-card p-5 lg:p-6 hover-lift">
          <TransactionsTable 
            selectedPeriod={selectedPeriod} 
            filterType={filterType}
            salesperson={user?.salespersonName}
          />
        </div>
      </main>

      {/* Diálogo de Clientes */}
      <Dialog open={showClientsDialog} onOpenChange={setShowClientsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Mis Clientes ({clients.filter((client: any) => {
                const clientName = (client.clientName || client.name || '').toLowerCase();
                return clientName.includes(clientSearch.toLowerCase());
              }).length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar cliente por nombre..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full pl-10"
              data-testid="input-client-search"
            />
          </div>
          
          <div className="mt-4">
            {loadingClients ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay clientes en este período
              </div>
            ) : clients.filter((client: any) => {
                const clientName = (client.clientName || client.name || '').toLowerCase();
                return clientName.includes(clientSearch.toLowerCase());
              }).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron clientes con "{clientSearch}"
              </div>
            ) : (
              <div className="grid gap-3">
                {clients
                  .filter((client: any) => {
                    const clientName = (client.clientName || client.name || '').toLowerCase();
                    return clientName.includes(clientSearch.toLowerCase());
                  })
                  .map((client: any, index: number) => (
                  <Card 
                    key={index} 
                    className="hover:shadow-md transition-shadow border-l-4 border-l-green-500"
                    data-testid={`client-card-${index}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900" data-testid={`client-name-${index}`}>
                            {client.clientName || client.name || 'Sin nombre'}
                          </h3>
                          {client.segment && (
                            <Badge variant="outline" className="mt-1">
                              {client.segment}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Ventas Totales</p>
                            <p className="font-bold text-blue-600" data-testid={`client-sales-${index}`}>
                              ${(client.totalSales || 0).toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Transacciones</p>
                            <p className="font-bold text-green-600" data-testid={`client-transactions-${index}`}>
                              {client.transactionCount || 0}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Ticket Prom.</p>
                            <p className="font-bold text-purple-600">
                              ${((client.totalSales || 0) / (client.transactionCount || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Última Compra</p>
                            <p className="font-bold text-orange-600 text-xs">
                              {client.lastPurchaseDate ? new Date(client.lastPurchaseDate).toLocaleDateString('es-CL') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}