import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  UserCheck,
  AlertTriangle,
  Clock,
  TrendingDown,
  Plus,
  Edit
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";

export default function SupervisorDashboard() {
  const { user, logoutMutation } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [location] = useLocation();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Obtener vendedores bajo supervisión
  const { data: salespeople = [], isLoading: loadingSalespeople } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/salespeople`],
    enabled: !!user?.id && user?.role === 'supervisor',
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Obtener vendedores disponibles para reclamar
  const { data: availableVendors = [], isLoading: loadingVendors } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/available-vendors`],
    enabled: !!user?.id && user?.role === 'supervisor' && showAddMemberModal,
    staleTime: 30000, // Cache por 30 segundos
  });

  // Obtener metas del supervisor
  const { data: supervisorGoals = [], isLoading: loadingGoals } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/goals`],
    enabled: !!user?.id && user?.role === 'supervisor',
  });

  // Obtener alertas del supervisor
  const { data: supervisorAlerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/alerts`],
    enabled: !!user?.id && user?.role === 'supervisor',
  });

  const handleLogout = () => {
    logoutMutation.mutate();
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

  // Mutaciones para gestionar metas
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      return apiRequest(`/api/supervisor/${user?.id}/goals`, {
        method: 'POST',
        body: JSON.stringify(goalData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/salespeople`] });
      toast({
        title: "Meta creada",
        description: "La meta se creó exitosamente",
      });
      setGoalDialogOpen(false);
      setSelectedSalesperson(null);
      setEditingGoal(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la meta",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ goalId, ...goalData }: any) => {
      return apiRequest(`/api/supervisor/${user?.id}/goals/${goalId}`, {
        method: 'PUT',
        body: JSON.stringify(goalData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/salespeople`] });
      toast({
        title: "Meta actualizada",
        description: "La meta se actualizó exitosamente",
      });
      setGoalDialogOpen(false);
      setSelectedSalesperson(null);
      setEditingGoal(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "No se pudo actualizar la meta",
        variant: "destructive",
      });
    },
  });

  const handleCreateGoal = (salesperson: any) => {
    setSelectedSalesperson(salesperson);
    setEditingGoal(null);
    setGoalDialogOpen(true);
  };

  const handleEditGoal = (salesperson: any, goal: any) => {
    setSelectedSalesperson(salesperson);
    setEditingGoal(goal);
    setGoalDialogOpen(true);
  };

  // Claim vendor mutation
  const claimVendorMutation = useMutation({
    mutationFn: async (vendor: any) => {
      const password = generatePassword();
      const email = generateEmail(vendor.salespersonName);
      
      return apiRequest('POST', `/api/supervisor/${user?.id}/claim-vendor`, {
        salespersonName: vendor.salespersonName,
        email,
        password
      });
    },
    onSuccess: () => {
      // Refresh both available vendors and current team
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/available-vendors`] });
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/salespeople`] });
      
      toast({
        title: "Vendedor reclamado exitosamente",
        description: "El vendedor ha sido añadido a tu equipo",
      });
      
      setShowAddMemberModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al reclamar vendedor",
        description: error.message || "No se pudo reclamar el vendedor",
        variant: "destructive",
      });
    },
  });

  const handleClaimVendor = (vendor: any) => {
    claimVendorMutation.mutate(vendor);
  };

  // Helper functions
  const generateEmail = (name: string) => {
    const cleanName = name.toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9.]/g, '');
    return `${cleanName}@pinturaspanoramica.cl`;
  };

  const generatePassword = () => {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123!';
  };

  const handleSubmitGoal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const goalData = {
      salespersonId: selectedSalesperson?.id,
      salespersonName: selectedSalesperson?.salespersonName,
      description: formData.get('description'),
      amount: parseFloat(formData.get('amount') as string),
      period: formData.get('period'),
    };

    if (editingGoal) {
      updateGoalMutation.mutate({ goalId: editingGoal.id, ...goalData });
    } else {
      createGoalMutation.mutate(goalData);
    }
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

  if (loadingSalespeople || loadingGoals || loadingAlerts) {
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
          {/* Alertas Inteligentes */}
          {supervisorAlerts && (supervisorAlerts as any[]).length > 0 && (
            <Card className="rounded-2xl border-red-200/60 shadow-sm bg-red-50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-red-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                  Alertas del Equipo
                </CardTitle>
                <CardDescription className="text-red-700">
                  Situaciones que requieren tu atención inmediata
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(supervisorAlerts as any[]).map((alert: any, index: number) => {
                    const severityColors = {
                      high: 'bg-red-100 border-red-300 text-red-800',
                      medium: 'bg-orange-100 border-orange-300 text-orange-800',
                      low: 'bg-yellow-100 border-yellow-300 text-yellow-800'
                    };
                    
                    const severityIcons = {
                      high: AlertTriangle,
                      medium: Clock,
                      low: TrendingDown
                    };
                    
                    const Icon = severityIcons[alert.severity];
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center space-x-3 p-3 rounded-lg border ${severityColors[alert.severity]}`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{alert.message}</p>
                          <div className="flex items-center space-x-4 mt-1 text-xs opacity-75">
                            <Badge variant="outline" className="text-xs">
                              {alert.type === 'inactive' ? 'Inactivo' : 
                               alert.type === 'below_goal' ? 'Bajo Meta' : 'Proyección'}
                            </Badge>
                            <span>Severidad: {alert.severity === 'high' ? 'Alta' : alert.severity === 'medium' ? 'Media' : 'Baja'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
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
                    <div key={goal.id} className="col-span-full space-y-3 p-4 border rounded-lg bg-gray-50">
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-green-600" />
                    Mi Equipo de Vendedores
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Rendimiento, estadísticas y metas de tu equipo
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setShowAddMemberModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-add-team-member"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir Miembro
                </Button>
              </div>
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
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-700 flex items-center">
                              <Target className="w-4 h-4 mr-1 text-blue-600" />
                              Metas Asignadas
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleCreateGoal(salesperson)}
                              className="h-7 px-2 text-xs"
                              data-testid={`button-add-goal-${salesperson.id}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Agregar Meta
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {salesperson.goals.map((goal: any) => (
                              <div key={goal.id} className="bg-gray-50 rounded-lg p-3 border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-900 truncate">
                                    {goal.description}
                                  </span>
                                  <div className="flex items-center space-x-2">
                                    <Badge 
                                      variant={goal.progress >= 100 ? "default" : goal.progress >= 75 ? "secondary" : "outline"}
                                      className="text-xs"
                                    >
                                      {goal.progress}%
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditGoal(salesperson, goal)}
                                      className="h-6 w-6 p-0"
                                      data-testid={`button-edit-goal-${goal.id}`}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                  </div>
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
                          <Target className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 mb-3">Sin metas asignadas</p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleCreateGoal(salesperson)}
                            className="h-7 px-3 text-xs"
                            data-testid={`button-create-first-goal-${salesperson.id}`}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Crear Primera Meta
                          </Button>
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
      
      {/* Add Member Modal */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Vendedores Disponibles para Reclamar
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Selecciona un vendedor del segmento FERRETERIAS para añadir a tu equipo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {loadingVendors ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : availableVendors.length > 0 ? (
              <div className="space-y-3">
                {availableVendors.map((vendor: any, index: number) => (
                  <div 
                    key={index}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleClaimVendor(vendor)}
                    data-testid={`vendor-option-${vendor.salespersonName.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {vendor.salespersonName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{vendor.salespersonName}</h4>
                          <p className="text-sm text-gray-600">
                            {vendor.totalTransactions} transacciones • Segmento: {vendor.segment}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {new Intl.NumberFormat('es-CL', {
                            style: 'currency',
                            currency: 'CLP',
                            minimumFractionDigits: 0,
                          }).format(vendor.totalSales)}
                        </p>
                        <p className="text-xs text-gray-500">ventas totales</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay vendedores disponibles para reclamar</p>
                <p className="text-gray-400 text-sm mt-1">Todos los vendedores ya están asignados</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para gestionar metas */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? 'Editar Meta' : 'Crear Nueva Meta'}
            </DialogTitle>
            <DialogDescription>
              {editingGoal 
                ? `Editando meta para ${selectedSalesperson?.salespersonName}`
                : `Crear una nueva meta para ${selectedSalesperson?.salespersonName}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitGoal} className="space-y-4">
            <div>
              <Label htmlFor="description">Descripción de la Meta</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Ej: Meta mensual de ventas para octubre"
                defaultValue={editingGoal?.description || ''}
                required
                className="mt-1"
                data-testid="input-goal-description"
              />
            </div>
            
            <div>
              <Label htmlFor="amount">Monto Objetivo (CLP)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                placeholder="Ej: 25000000"
                defaultValue={editingGoal?.targetAmount || ''}
                required
                min="1"
                step="1"
                className="mt-1"
                data-testid="input-goal-amount"
              />
            </div>
            
            <div>
              <Label htmlFor="period">Período</Label>
              <Input
                id="period"
                name="period"
                placeholder="Ej: 2025-09"
                defaultValue={editingGoal?.period || new Date().toISOString().slice(0, 7)}
                required
                pattern="[0-9]{4}-[0-9]{2}"
                title="Formato: YYYY-MM (ej: 2025-09)"
                className="mt-1"
                data-testid="input-goal-period"
              />
              <p className="text-xs text-gray-500 mt-1">Formato: YYYY-MM (ej: 2025-09)</p>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setGoalDialogOpen(false)}
                data-testid="button-cancel-goal"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                data-testid="button-save-goal"
              >
                {createGoalMutation.isPending || updateGoalMutation.isPending 
                  ? 'Guardando...' 
                  : editingGoal ? 'Actualizar Meta' : 'Crear Meta'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}