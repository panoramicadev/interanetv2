import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CalendarIcon, 
  Building2, 
  LogOut, 
  Menu, 
  X, 
  Target, 
  TrendingUp, 
  DollarSign,
  UserCheck
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [location] = useLocation();

  // Obtener vendedores bajo supervisión
  const { data: salespeople = [], isLoading: loadingSalespeople } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/salespeople`],
    enabled: !!user?.id && user?.role === 'supervisor',
  });

  // Obtener metas del supervisor
  const { data: supervisorGoals = [], isLoading: loadingGoals } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/goals`],
    enabled: !!user?.id && user?.role === 'supervisor',
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "S";
  };

  const getDisplayName = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    return user?.salespersonName || "Supervisor";
  };

  const sidebarItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/metas",
      label: "Gestión de Metas",
      icon: Target,
    },
    {
      href: "/equipo",
      label: "Mi Equipo",
      icon: Users,
    },
    {
      href: "/reportes",
      label: "Reportes",
      icon: FileText,
    },
    {
      href: "/calendario",
      label: "Calendario",
      icon: CalendarIcon,
    },
  ];

  // Calcular métricas del equipo
  const teamMetrics = {
    totalSalespeople: salespeople.length,
    totalSales: salespeople.reduce((sum: number, sp: any) => sum + (sp.totalSales || 0), 0),
    totalTransactions: salespeople.reduce((sum: number, sp: any) => sum + (sp.transactionCount || 0), 0),
    averagePerSalesperson: salespeople.length > 0 ? 
      salespeople.reduce((sum: number, sp: any) => sum + (sp.totalSales || 0), 0) / salespeople.length : 0
  };

  if (loadingSalespeople || loadingGoals) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando dashboard del supervisor...</p>
        </div>
      </div>
    );
  }

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Panel Supervisor</h1>
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
                <p className="text-xs text-slate-400">Supervisor</p>
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
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Dashboard Supervisor - {user?.salespersonName}
              </h1>
              <p className="text-gray-600 text-base lg:text-lg">
                Gestión de equipo y seguimiento de metas
              </p>
            </div>
          </div>
        </header>

        {/* Contenido principal */}
        <main className="px-4 lg:px-6 pb-6 space-y-6">
          {/* KPI Cards del equipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Vendedores</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {teamMetrics.totalSalespeople}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Miembros del equipo
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Ventas del Equipo</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0,
                  }).format(teamMetrics.totalSales)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Total acumulado
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Transacciones</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {teamMetrics.totalTransactions}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Total del equipo
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Promedio/Vendedor</CardTitle>
                <UserCheck className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    minimumFractionDigits: 0,
                  }).format(teamMetrics.averagePerSalesperson)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Promedio por vendedor
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Metas del Supervisor */}
          <Card className="rounded-2xl border-gray-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                <Target className="w-5 h-5 mr-2 text-blue-600" />
                Mis Metas Asignadas
              </CardTitle>
              <CardDescription className="text-gray-600">
                Objetivos y metas de supervisión
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(supervisorGoals as any[])?.map((goal: any) => {
                  const progress = Math.min((goal.currentSales / parseFloat(goal.targetAmount)) * 100, 100);
                  const isCompleted = progress >= 100;
                  
                  return (
                    <div key={goal.id} className="space-y-3 p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {goal.description || "Meta de Supervisión"}
                          </span>
                        </div>
                        <Badge variant={isCompleted ? "default" : "secondary"}>
                          {Math.round(progress)}%
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Actual:</span>
                          <span>
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(goal.currentSales || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Meta:</span>
                          <span>
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(goal.targetAmount || 0)}
                          </span>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-3" />
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Restante:</span>
                          <span className={`font-medium ${goal.remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(Math.max(goal.remaining || 0, 0))}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Período: {goal.period}
                      </p>
                    </div>
                  );
                })}
                
                {(!supervisorGoals || (supervisorGoals as any[]).length === 0) && (
                  <div className="col-span-full text-center py-8">
                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No tienes metas asignadas</p>
                    <p className="text-gray-400 text-xs mt-1">Contacta al administrador para establecer objetivos</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de Vendedores del Equipo */}
          <Card className="rounded-2xl border-gray-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-green-600" />
                Mi Equipo de Vendedores
              </CardTitle>
              <CardDescription className="text-gray-600">
                Rendimiento, estadísticas y metas de tu equipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {(salespeople as any[])?.map((salesperson: any, index: number) => (
                  <div key={salesperson.id} className="border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    {/* Información básica del vendedor */}
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white font-medium">
                            {salesperson.salespersonName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{salesperson.salespersonName}</h4>
                          <p className="text-sm text-gray-600">{salesperson.email}</p>
                          <p className="text-xs text-gray-500">
                            {salesperson.transactionCount} transacciones
                            {salesperson.lastSale && (
                              <> • Última venta: {new Date(salesperson.lastSale).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {new Intl.NumberFormat('es-CL', {
                            style: 'currency',
                            currency: 'CLP',
                            minimumFractionDigits: 0,
                          }).format(salesperson.totalSales)}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {teamMetrics.totalSales > 0 ? ((salesperson.totalSales / teamMetrics.totalSales) * 100).toFixed(1) : 0}% del equipo
                        </Badge>
                      </div>
                    </div>

                    {/* Metas del vendedor */}
                    {salesperson.goals && salesperson.goals.length > 0 && (
                      <div className="px-4 pb-4 border-t border-gray-200 bg-white">
                        <div className="pt-3">
                          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <Target className="w-4 h-4 mr-1 text-blue-600" />
                            Metas Asignadas
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {salesperson.goals.map((goal: any) => (
                              <div key={goal.id} className="bg-gray-50 rounded-lg p-3 border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-900 truncate">
                                    {goal.description}
                                  </span>
                                  <Badge 
                                    variant={goal.progress >= 100 ? "default" : goal.progress >= 75 ? "secondary" : "outline"}
                                    className="text-xs"
                                  >
                                    {goal.progress}%
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-gray-600">
                                    <span>Actual:</span>
                                    <span className="font-medium">
                                      {new Intl.NumberFormat('es-CL', {
                                        style: 'currency',
                                        currency: 'CLP',
                                        minimumFractionDigits: 0,
                                      }).format(goal.currentSales)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-600">
                                    <span>Meta:</span>
                                    <span className="font-medium">
                                      {new Intl.NumberFormat('es-CL', {
                                        style: 'currency',
                                        currency: 'CLP',
                                        minimumFractionDigits: 0,
                                      }).format(goal.targetAmount)}
                                    </span>
                                  </div>
                                  <Progress value={Math.min(goal.progress, 100)} className="h-2 mt-2" />
                                  <div className="flex justify-between text-xs mt-1">
                                    <span className="text-gray-500">Período:</span>
                                    <span className="font-medium text-gray-700">{goal.period}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mensaje cuando no hay metas */}
                    {(!salesperson.goals || salesperson.goals.length === 0) && (
                      <div className="px-4 pb-4 border-t border-gray-200 bg-white">
                        <div className="pt-3 text-center">
                          <Target className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                          <p className="text-xs text-gray-500">Sin metas asignadas</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {(!salespeople || (salespeople as any[]).length === 0) && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No tienes vendedores asignados</p>
                    <p className="text-gray-400 text-xs mt-1">Contacta al administrador para asignar vendedores a tu supervisión</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}