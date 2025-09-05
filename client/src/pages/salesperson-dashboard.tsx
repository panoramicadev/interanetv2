import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
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
  LayoutDashboard,
  Upload,
  LogOut,
  Building2,
  Menu,
  X
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";

export default function SalespersonDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth() as { user: User | null; isAuthenticated: boolean; isLoading: boolean };
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("2025-09");
  const [filterType, setFilterType] = useState<"day" | "month" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
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
        setSelectedPeriod("last-30-days");
        break;
    }
  }, [filterType, selectedDate]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
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
  
  if (!user || user.role !== 'salesperson') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">No tienes permisos para acceder a esta página.</p>
          <Button onClick={() => window.location.href = "/"}>
            Volver al Inicio
          </Button>
        </div>
      </div>
    );
  }

  // Queries específicas para el vendedor
  const { data: salespersonMetrics } = useQuery({
    queryKey: [`/api/sales/metrics/salesperson/${user?.salespersonName}`],
  });

  const { data: salespersonClients } = useQuery({
    queryKey: [`/api/sales/clients/salesperson/${user?.salespersonName}`],
  });

  const { data: salespersonGoals } = useQuery({
    queryKey: [`/api/goals/salesperson/${user?.salespersonName}`],
  });

  const { data: chartData } = useQuery({
    queryKey: [`/api/sales/chart-data/salesperson/${user?.salespersonName}?period=monthly&selectedPeriod=${selectedPeriod}&filterType=${filterType}`],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "V";
  };

  const getDisplayName = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    return user?.salespersonName || "Vendedor";
  };

  const sidebarItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/metas",
      label: "Mis Metas",
      icon: Target,
    },
    {
      href: "/presupuestos",
      label: "Presupuestos",
      icon: FileText,
    },
    {
      href: "/calendario",
      label: "Calendario",
      icon: CalendarIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden glass-card p-2"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar negro igual al admin */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Panel Vendedor</h1>
                <p className="text-sm text-slate-400">{user?.salespersonName}</p>
              </div>
            </div>
          </div>
        
          <nav className="flex-1 p-4 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                      isActive ? "bg-slate-800 text-white" : ""
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-6 border-t border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {getInitials(user?.firstName, user?.lastName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {getDisplayName(user?.firstName, user?.lastName)}
                </p>
                <p className="text-xs text-slate-400">Vendedor</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
      
      <div className="lg:ml-64 transition-all duration-300">
        {/* Header igual al dashboard admin */}
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Dashboard Personal - {user?.salespersonName}
              </h1>
              <p className="text-gray-600 text-base lg:text-lg">
                Resumen de tu rendimiento - {filterType === "day" ? "Análisis diario" : filterType === "month" ? "Análisis mensual" : "Análisis por rango"}
              </p>
            </div>
            
            <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:space-x-4">
              {/* Filter Type Selector */}
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Filtrar por:
                </label>
                <Select value={filterType} onValueChange={(value: "day" | "month" | "range") => setFilterType(value)}>
                  <SelectTrigger className="w-36 rounded-xl border-gray-200 shadow-sm" data-testid="select-filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="day">Día</SelectItem>
                    <SelectItem value="month">Mes</SelectItem>
                    <SelectItem value="range">Rango</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Period Selector */}
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700">
                  Período:
                </label>
                
                {filterType === "day" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-48 lg:w-52 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm"
                        data-testid="calendar-trigger"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecciona una fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        data-testid="calendar"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-48 lg:w-52 rounded-xl border-gray-200 shadow-sm" data-testid="select-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200">
                      {filterType === "month" ? (
                        <>
                          <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                          <SelectItem value="2025-08">Agosto 2025</SelectItem>
                          <SelectItem value="2025-07">Julio 2025</SelectItem>
                          <SelectItem value="2025-06">Junio 2025</SelectItem>
                          <SelectItem value="2025-05">Mayo 2025</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="last-7-days">Últimos 7 días</SelectItem>
                          <SelectItem value="last-30-days">Últimos 30 días</SelectItem>
                          <SelectItem value="last-90-days">Últimos 90 días</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Contenido principal con el mismo estilo que admin */}
        <main className="px-4 lg:px-6 pb-6 space-y-6">
          {/* KPI Cards para el vendedor */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Mis Ventas</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {salespersonMetrics ? new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0,
                  }).format(salespersonMetrics.totalSales) : "Cargando..."}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Total de ventas personales
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Mis Transacciones</CardTitle>
                <Package className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {salespersonMetrics?.totalTransactions || 0}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Transacciones realizadas
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Mis Clientes</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {salespersonClients?.length || 0}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Clientes únicos atendidos
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Promedio por Venta</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {salespersonMetrics ? new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0,
                  }).format(salespersonMetrics.averageTransaction) : "Cargando..."}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Valor promedio por transacción
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts y Goals lado a lado */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Sales Chart */}
            <div className="xl:col-span-2">
              <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900">Mis Ventas por Período</CardTitle>
                  <CardDescription className="text-gray-600">
                    Evolución de tus ventas personales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SalesChart 
                    selectedPeriod={selectedPeriod} 
                    filterType={filterType}
                    salespersonFilter={user?.salespersonName}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Goals Progress */}
            <div>
              <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-blue-600" />
                    Mis Metas
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Progreso de tus objetivos personales
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {salespersonGoals?.map((goal: any) => {
                      const progress = Math.min((goal.currentSales / parseFloat(goal.targetAmount)) * 100, 100);
                      const isCompleted = progress >= 100;
                      
                      return (
                        <div key={goal.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Target className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {goal.description || "Meta Personal"}
                              </span>
                            </div>
                            <Badge variant={isCompleted ? "default" : "secondary"}>
                              {Math.round(progress)}%
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>
                                {new Intl.NumberFormat('es-CL', {
                                  style: 'currency',
                                  currency: 'CLP',
                                  minimumFractionDigits: 0,
                                }).format(goal.currentSales || 0)}
                              </span>
                              <span>
                                {new Intl.NumberFormat('es-CL', {
                                  style: 'currency',
                                  currency: 'CLP',
                                  minimumFractionDigits: 0,
                                }).format(parseFloat(goal.targetAmount))}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  isCompleted ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Período: {goal.period}
                          </p>
                        </div>
                      );
                    })}
                    
                    {(!salespersonGoals || salespersonGoals.length === 0) && (
                      <div className="text-center py-8">
                        <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No tienes metas asignadas</p>
                        <p className="text-gray-400 text-xs mt-1">Contacta a tu supervisor para establecer objetivos</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Top Clients y Recent Transactions */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Top Clients */}
            <Card className="rounded-2xl border-gray-200/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">Mis Mejores Clientes</CardTitle>
                <CardDescription className="text-gray-600">
                  Clientes con mayor volumen de compras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salespersonClients?.slice(0, 5).map((client: any, index: number) => (
                    <div key={client.client} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{client.client}</p>
                          <p className="text-sm text-gray-600">{client.transactions} transacciones</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {new Intl.NumberFormat('es-CL', {
                            style: 'currency',
                            currency: 'CLP',
                            minimumFractionDigits: 0,
                          }).format(client.totalSales)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="rounded-2xl border-gray-200/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">Transacciones Recientes</CardTitle>
                <CardDescription className="text-gray-600">
                  Tus últimas ventas realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    {salespersonMetrics ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-600">
                          Consulta tus transacciones detalladas en el panel principal
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No hay transacciones recientes</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}