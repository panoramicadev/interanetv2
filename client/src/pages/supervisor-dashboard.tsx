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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
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

export default function SupervisorDashboard() {
  const { user } = useAuth();
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

  // Obtener productos más vendidos por el equipo
  const { data: teamProducts = [], isLoading: loadingTeamProducts } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/team-products`],
    enabled: !!user?.id && user?.role === 'supervisor',
    staleTime: 300000, // Cache por 5 minutos
  });

  // Obtener métricas consolidadas del equipo
  const { data: teamMetricsData, isLoading: loadingTeamMetrics } = useQuery({
    queryKey: [`/api/supervisor/${user?.id}/team-metrics`],
    enabled: !!user?.id && user?.role === 'supervisor',
    staleTime: 300000, // Cache por 5 minutos
  });

  // Mutaciones para gestionar metas
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      return apiRequest('POST', `/api/supervisor/${user?.id}/goals`, goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/salespeople`] });
      toast({
        title: "Meta creada",
        description: "La meta se creó exitosamente",
      });
      setGoalDialogOpen(false);
      setEditingGoal(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la meta",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ goalId, ...goalData }: any) => {
      return apiRequest('PUT', `/api/supervisor/${user?.id}/goals/${goalId}`, goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/salespeople`] });
      toast({
        title: "Meta actualizada",
        description: "La meta se actualizó exitosamente",
      });
      setGoalDialogOpen(false);
      setEditingGoal(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la meta",
        variant: "destructive",
      });
    },
  });

  // Mutación para reclamar vendedores
  const claimVendorMutation = useMutation({
    mutationFn: async (vendor: any) => {
      const generateEmail = (name: string) => {
        return name.toLowerCase().replace(/ /g, '.') + '@pinturaspanoramica.cl';
      };

      const generatePassword = () => {
        return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123!';
      };

      const email = generateEmail(vendor.salespersonName);
      
      return apiRequest('POST', `/api/supervisor/${user?.id}/claim-vendor`, {
        salespersonName: vendor.salespersonName,
        email,
        password: generatePassword(),
        assignedSegment: vendor.assignedSegment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/salespeople`] });
      queryClient.invalidateQueries({ queryKey: [`/api/supervisor/${user?.id}/available-vendors`] });
      toast({
        title: "Vendedor reclamado",
        description: "El vendedor fue asignado exitosamente a tu equipo",
      });
      setShowAddMemberModal(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo reclamar el vendedor",
        variant: "destructive",
      });
    },
  });

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

  // Calcular métricas del equipo
  const teamMetrics = {
    totalSalespeople: salespeople.length,
    totalSales: salespeople.reduce((sum: number, sp: any) => sum + (sp.totalSales || 0), 0),
    totalTransactions: salespeople.reduce((sum: number, sp: any) => sum + (sp.transactionCount || 0), 0),
    averagePerSalesperson: salespeople.length > 0 ? 
      salespeople.reduce((sum: number, sp: any) => sum + (sp.totalSales || 0), 0) / salespeople.length : 0
  };

  if (loadingSalespeople || loadingGoals || loadingAlerts || loadingTeamProducts || loadingTeamMetrics) {
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
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
        <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              Dashboard Supervisor - {user?.firstName} {user?.lastName}
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
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-lg text-red-900">Alertas del Equipo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(supervisorAlerts as any[]).map((alert, index) => {
                const severityColors = {
                  high: 'bg-red-100 text-red-800 border-red-300',
                  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                  low: 'bg-blue-100 text-blue-800 border-blue-300'
                };

                const severityIcons = {
                  high: AlertTriangle,
                  medium: Clock,
                  low: TrendingDown,
                };

                const Icon = severityIcons[alert.severity];
                
                return (
                  <div 
                    key={index} 
                    className={`flex items-start gap-3 p-3 rounded-lg border ${severityColors[alert.severity]}`}
                  >
                    <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm opacity-90">{alert.description}</p>
                      {alert.salesperson && (
                        <p className="text-xs mt-1 font-medium">Vendedor: {alert.salesperson}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Métricas del Equipo */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl shadow-sm border-blue-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Total Vendedores</CardTitle>
              <UserCheck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{teamMetrics.totalSalespeople}</div>
              <p className="text-xs text-blue-700">
                Vendedores activos
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-green-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900">Ventas Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">
                ${teamMetrics.totalSales.toLocaleString()}
              </div>
              <p className="text-xs text-green-700">
                Ventas del equipo completo
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-purple-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">Transacciones</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{teamMetricsData?.totalTransactions || teamMetrics.totalTransactions}</div>
              <p className="text-xs text-purple-700">
                Total de operaciones
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-orange-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900">Promedio por Vendedor</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                ${teamMetricsData?.averagePerSalesperson?.toLocaleString() || teamMetrics.averagePerSalesperson.toLocaleString()}
              </div>
              <p className="text-xs text-orange-700">
                Rendimiento promedio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gestión del Equipo */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Mi Equipo de Vendedores</CardTitle>
                <CardDescription>Gestiona y supervisa a tu equipo de ventas</CardDescription>
              </div>
              <Button onClick={() => setShowAddMemberModal(true)} className="rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Vendedor
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salespeople && salespeople.map && salespeople.map((salesperson: any) => (
                <div key={salesperson.id} className="flex items-center justify-between p-4 border rounded-xl bg-gray-50/50">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-900">
                        {salesperson.salespersonName?.charAt(0) || 'V'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{salesperson.salespersonName}</h3>
                      <p className="text-sm text-gray-600">{salesperson.email}</p>
                      <p className="text-xs text-gray-500">Segmento: {salesperson.assignedSegment || 'No asignado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ${salesperson.totalSales?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {salesperson.transactionCount || 0} transacciones
                      </p>
                      <p className="text-xs text-gray-500">
                        Última venta: {salesperson.lastSale || 'N/A'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSalesperson(salesperson);
                        setEditingGoal(null);
                        setGoalDialogOpen(true);
                      }}
                      className="rounded-lg"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Meta
                    </Button>
                  </div>
                </div>
              ))}

              {(!salespeople || salespeople.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No tienes vendedores asignados</p>
                  <p className="text-sm">Comienza agregando vendedores a tu equipo</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metas y Progreso */}
        {supervisorGoals && supervisorGoals.length > 0 && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Metas del Equipo</CardTitle>
              <CardDescription>Seguimiento del progreso de las metas establecidas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {supervisorGoals.map((goal: any) => {
                  const progress = Math.min((goal.currentSales / goal.targetAmount) * 100, 100);
                  const isCompleted = progress >= 100;
                  
                  return (
                    <div key={goal.id} className="col-span-full space-y-3 p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{goal.description}</h3>
                          <p className="text-sm text-gray-600">Meta: ${goal.targetAmount.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">Período: {goal.period}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            ${goal.currentSales.toLocaleString()}
                          </p>
                          <Badge 
                            variant={isCompleted ? "default" : "secondary"}
                            className={`${isCompleted ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                          >
                            {progress.toFixed(1)}% completado
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isCompleted ? "bg-green-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Restante: ${Math.max(goal.remaining, 0).toLocaleString()}</span>
                        <span>{isCompleted ? "¡Meta completada!" : `${(100 - progress).toFixed(1)}% restante`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Modal para crear/editar metas */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Editar Meta' : 'Nueva Meta'}</DialogTitle>
            <DialogDescription>
              {selectedSalesperson && `Establecer meta para ${selectedSalesperson.salespersonName}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitGoal}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Descripción
                </Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={editingGoal?.description || ''}
                  className="col-span-3"
                  placeholder="Descripción de la meta"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Monto
                </Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  defaultValue={editingGoal?.targetAmount || ''}
                  className="col-span-3"
                  placeholder="Monto objetivo"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="period" className="text-right">
                  Período
                </Label>
                <Select name="period" defaultValue={editingGoal?.period || new Date().toISOString().slice(0, 7)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={new Date().toISOString().slice(0, 7)}>Este mes</SelectItem>
                    <SelectItem value={new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 7)}>Próximo mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createGoalMutation.isPending || updateGoalMutation.isPending}>
                {createGoalMutation.isPending || updateGoalMutation.isPending ? 'Guardando...' : 'Guardar Meta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para agregar vendedores */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Agregar Vendedor al Equipo</DialogTitle>
            <DialogDescription>
              Selecciona un vendedor disponible para agregar a tu equipo
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {loadingVendors ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2">Cargando vendedores...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {availableVendors && availableVendors.length > 0 ? (
                  availableVendors.map((vendor: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{vendor.salespersonName}</h4>
                        <p className="text-sm text-gray-600">Segmento: {vendor.assignedSegment}</p>
                        <p className="text-xs text-gray-500">
                          Total ventas: ${vendor.totalSales?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <Button
                        onClick={() => claimVendorMutation.mutate(vendor)}
                        disabled={claimVendorMutation.isPending}
                        size="sm"
                      >
                        {claimVendorMutation.isPending ? 'Asignando...' : 'Asignar'}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay vendedores disponibles para asignar</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}