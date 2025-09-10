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
  Star
} from "lucide-react";
import { format } from "date-fns";

export default function SalespersonDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth() as { user: (User & { salespersonName?: string }) | null; isAuthenticated: boolean; isLoading: boolean };
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("2025-09");
  const [filterType, setFilterType] = useState<"day" | "month" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Date range state for custom range selection
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
        setSelectedPeriod("2025-09");
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

  const { data: salespersonData, isLoading: loadingSalesperson } = useQuery({
    queryKey: [`/api/salesperson/${user?.id}/dashboard?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!user?.id,
    staleTime: 300000, // 5 minutos
  });

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: [`/api/salesperson/${user?.id}/clients?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!user?.id,
  });

  const { data: goalsData, isLoading: loadingGoals } = useQuery({
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

  const salesData = salespersonData || {
    totalSales: 0,
    transactions: 0,
    avgTicket: 0,
    topProducts: [],
    recentSales: []
  };

  const clients = clientsData || [];
  const goals = goalsData || [];

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

      {/* Contenido Principal */}
      <main className="px-4 lg:px-6 pb-6 space-y-6">
        {/* Progreso de Meta Principal - Solo si hay metas */}
        {goals && goals.length > 0 && goals[0] && (
          <Card className="rounded-2xl shadow-sm border-green-100 bg-gradient-to-r from-green-50 to-blue-50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-semibold text-gray-700">Meta de Ventas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(goals[0]?.progress || 0) >= 100 ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (goals[0]?.progress || 0) >= 70 ? (
                      <TrendingUp className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${
                      (goals[0]?.progress || 0) >= 100 ? 'text-green-600' : 
                      (goals[0]?.progress || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(goals[0]?.progress || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      (goals[0]?.progress || 0) >= 100 ? 'bg-green-500' : 
                      (goals[0]?.progress || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(goals[0]?.progress || 0, 100)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Actual: <strong>${(goals[0]?.currentSales || 0).toLocaleString()}</strong></span>
                  <span>Meta: <strong>${(goals[0]?.targetAmount || 0).toLocaleString()}</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs del Vendedor */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl shadow-sm border-blue-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Ventas Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">
                ${salesData.totalSales.toLocaleString()}
              </div>
              <p className="text-xs text-blue-700">
                Este período
              </p>
              {goals && goals.length > 0 && goals[0] && (
                <div className="mt-2 pt-2 border-t border-blue-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-600">vs Meta:</span>
                    <span className={`font-medium ${
                      (goals[0]?.progress || 0) >= 100 ? 'text-green-600' : 
                      (goals[0]?.progress || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(goals[0]?.remaining || 0) <= 0 ? 
                        `+$${((goals[0]?.currentSales || 0) - (goals[0]?.targetAmount || 0)).toLocaleString()}` : 
                        `-$${(goals[0]?.remaining || 0).toLocaleString()}`
                      }
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-green-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900">Transacciones</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{salesData.transactions}</div>
              <p className="text-xs text-green-700">
                Operaciones realizadas
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-purple-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">Ticket Promedio</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                ${salesData.avgTicket.toLocaleString()}
              </div>
              <p className="text-xs text-purple-700">
                Promedio por venta
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-orange-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900">Mis Clientes</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{clients.length}</div>
              <p className="text-xs text-orange-700">
                Clientes activos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progreso de Metas */}
        {goals && goals.length > 0 && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Progreso de Metas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {goals.map((goal: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{goal?.description || 'Meta'}</span>
                      <span className="text-sm text-muted-foreground">
                        {(goal?.progress || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(goal?.progress || 0, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>${(goal?.currentSales || 0).toLocaleString()}</span>
                      <span>${(goal?.targetAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
    </>
  );
}