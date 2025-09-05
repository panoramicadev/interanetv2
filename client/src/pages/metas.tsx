import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/dashboard/sidebar";
import ImportModal from "@/components/dashboard/import-modal";
import GoalsProgress from "@/components/dashboard/goals-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Target, TrendingUp, Users, Building } from "lucide-react";
import type { Goal } from "@shared/schema";

export default function Metas() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Global filter state for goals component
  const [globalFilter, setGlobalFilter] = useState<{
    type: "all" | "segment" | "salesperson";
    value?: string;
  }>({ type: "all" });

  // Form state
  const [formData, setFormData] = useState({
    type: 'global' as 'global' | 'segment' | 'salesperson',
    target: '',
    amount: '',
    period: new Date().toISOString().slice(0, 7), // YYYY-MM format
    description: ''
  });

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

  // Fetch goals
  const { data: goals, isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  // Fetch segments and salespeople for form selectors
  const { data: segments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
  });

  const { data: salespeople } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      const payload = {
        ...goalData,
        amount: goalData.amount, // Send as string (no parsing)
        target: goalData.type === 'global' ? null : goalData.target
      };
      
      return await apiRequest("POST", "/api/goals", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setShowCreateForm(false);
      resetForm();
      toast({
        title: "Meta creada",
        description: "La meta se ha creado exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error("Goal creation error:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la meta.",
        variant: "destructive",
      });
    },
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = {
        ...data,
        amount: data.amount, // Send as string (no parsing)
        target: data.type === 'global' ? null : data.target
      };
      
      return await apiRequest("PUT", `/api/goals/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setEditingGoal(null);
      resetForm();
      toast({
        title: "Meta actualizada",
        description: "La meta se ha actualizado exitosamente.",
      });
    },
    onError: (error: any) => {
      console.error("Goal update error:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la meta.",
        variant: "destructive",
      });
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Meta eliminada",
        description: "La meta se ha eliminado exitosamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la meta.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      type: 'global',
      target: '',
      amount: '',
      period: new Date().toISOString().slice(0, 7),
      description: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingGoal) {
      updateGoalMutation.mutate({ id: editingGoal.id, data: formData });
    } else {
      createGoalMutation.mutate(formData);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      type: goal.type as 'global' | 'segment' | 'salesperson',
      target: goal.target || '',
      amount: goal.amount.toString(),
      period: goal.period,
      description: goal.description || ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta meta?")) {
      deleteGoalMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'global': return <Target className="h-4 w-4" />;
      case 'segment': return <Building className="h-4 w-4" />;
      case 'salesperson': return <Users className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'global': return 'Global';
      case 'segment': return 'Segmento';
      case 'salesperson': return 'Vendedor';
      default: return type;
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onImportClick={() => setShowImportModal(true)} />
      
      <div className="ml-64">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Gestión de Metas
              </h1>
              <p className="text-muted-foreground">
                Administra las metas de ventas globales, por segmento y por vendedor
              </p>
            </div>
            
            <Button 
              onClick={() => {
                setShowCreateForm(true);
                setEditingGoal(null);
                resetForm();
              }}
              data-testid="button-create-goal"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Meta
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6 space-y-6">
          {/* Goals Progress Dashboard */}
          <GoalsProgress 
            globalFilter={globalFilter}
            onFilterChange={setGlobalFilter}
          />
          {/* Create/Edit Form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingGoal ? 'Editar Meta' : 'Crear Nueva Meta'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Tipo de Meta</Label>
                      <Select 
                        value={formData.type} 
                        onValueChange={(value: 'global' | 'segment' | 'salesperson') => 
                          setFormData({ ...formData, type: value, target: '' })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Global</SelectItem>
                          <SelectItem value="segment">Por Segmento</SelectItem>
                          <SelectItem value="salesperson">Por Vendedor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.type !== 'global' && (
                      <div>
                        <Label htmlFor="target">
                          {formData.type === 'segment' ? 'Segmento' : 'Vendedor'}
                        </Label>
                        <Select 
                          value={formData.target} 
                          onValueChange={(value) => setFormData({ ...formData, target: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              formData.type === 'segment' 
                                ? 'Selecciona un segmento' 
                                : 'Selecciona un vendedor'
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {formData.type === 'segment' ? (
                              segments?.map((segment) => (
                                <SelectItem key={segment} value={segment}>
                                  {segment}
                                </SelectItem>
                              ))
                            ) : (
                              salespeople?.map((salesperson) => (
                                <SelectItem key={salesperson} value={salesperson}>
                                  {salesperson}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="amount">Monto Meta</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="1000000"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="period">Período (Mes/Año)</Label>
                      <Input
                        id="period"
                        type="month"
                        value={formData.period}
                        onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descripción opcional de la meta..."
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      type="submit"
                      disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                    >
                      {editingGoal ? 'Actualizar' : 'Crear'} Meta
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingGoal(null);
                        resetForm();
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Goals List */}
          <div className="grid grid-cols-1 gap-4">
            {goalsLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-6 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ) : goals && goals.length > 0 ? (
              goals.map((goal) => (
                <Card key={goal.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(goal.type)}
                          <Badge variant="secondary">
                            {getTypeLabel(goal.type)}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">
                              {goal.type === 'global' 
                                ? 'Meta Global' 
                                : `${getTypeLabel(goal.type)}: ${goal.target}`
                              }
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              {goal.period}
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(parseFloat(goal.amount))}
                          </p>
                          {goal.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {goal.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(goal)}
                          data-testid={`button-edit-${goal.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(goal.id)}
                          data-testid={`button-delete-${goal.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay metas configuradas</h3>
                  <p className="text-muted-foreground mb-4">
                    Comienza creando tu primera meta de ventas
                  </p>
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Meta
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <ImportModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal}
      />
    </div>
  );
}