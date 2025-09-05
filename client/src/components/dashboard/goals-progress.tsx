import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, TrendingUp, Users, Building, CheckCircle, AlertCircle, Filter } from "lucide-react";

interface GoalProgress {
  id: string;
  type: string;
  target: string | null;
  amount: string;
  period: string;
  description: string | null;
  currentSales: number;
  targetAmount: number;
  percentage: number;
  remaining: number;
  isCompleted: boolean;
}

interface GoalsProgressProps {
  globalFilter: {
    type: "all" | "segment" | "salesperson";
    value?: string;
  };
  onFilterChange: (filter: { type: "all" | "segment" | "salesperson"; value?: string }) => void;
}

export default function GoalsProgress({ globalFilter, onFilterChange }: GoalsProgressProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  
  // Fetch segments and salespeople for the filter dropdown
  const { data: segments } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
  });

  const { data: salespeople } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
  });
  
  const { data: goalsProgress, isLoading } = useQuery<GoalProgress[]>({
    queryKey: ["/api/goals/progress"],
  });

  // Filter goals based on selected filter and global filter
  const filteredGoals = goalsProgress?.filter(goal => {
    // If we have a global filter with a specific value, show only goals matching that exact target
    if (globalFilter.type !== "all" && globalFilter.value) {
      return goal.type === globalFilter.type && goal.target === globalFilter.value;
    }
    
    // Otherwise filter by selected filter type
    if (selectedFilter === "all") return true;
    return goal.type === selectedFilter;
  }) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'global': return <Target className="h-5 w-5" />;
      case 'segment': return <Building className="h-5 w-5" />;
      case 'salesperson': return <Users className="h-5 w-5" />;
      default: return <TrendingUp className="h-5 w-5" />;
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

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getFilterLabel = (filter: string) => {
    switch (filter) {
      case "global": return "Metas Globales";
      case "segment": return "Metas por Segmento";
      case "salesperson": return "Metas por Vendedor";
      default: return "Todas las Metas";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Progreso de Metas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!goalsProgress || goalsProgress.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Progreso de Metas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay metas configuradas aún</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate global goals from specific goals
  const globalGoals = filteredGoals.filter(goal => goal.type === 'global');
  const specificGoals = filteredGoals.filter(goal => goal.type !== 'global');
  
  // When we have a specific filter (segment/salesperson), treat all goals as full-width
  const shouldShowFullWidth = globalFilter.type !== "all" && globalFilter.value;

  return (
    <div className="space-y-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">Progreso de Metas</h2>
            {globalFilter.type !== "all" && globalFilter.value && (
              <p className="text-sm text-muted-foreground">
                Filtrando por {globalFilter.type === "segment" ? "segmento" : "vendedor"}: 
                <span className="font-medium ml-1">{globalFilter.value}</span>
              </p>
            )}
          </div>
        </div>
        
        {/* Elegant Filter Dropdown */}
        <div className="flex items-center space-x-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select 
            value={selectedFilter} 
            onValueChange={(value) => {
              setSelectedFilter(value);
              if (value === "all") {
                onFilterChange({ type: "all" });
              } else {
                onFilterChange({ type: value as "segment" | "salesperson" });
              }
            }}
          >
            <SelectTrigger className="w-48 bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <SelectValue placeholder="Filtrar dashboard" />
            </SelectTrigger>
            <SelectContent className="border border-border/50 shadow-lg">
              <SelectItem value="all" className="hover:bg-muted/50">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>Todo el dashboard</span>
                </div>
              </SelectItem>
              <SelectItem value="global" className="hover:bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>Solo metas globales</span>
                </div>
              </SelectItem>
              <SelectItem value="segment" className="hover:bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-green-500" />
                  <span>Por segmento</span>
                </div>
              </SelectItem>
              <SelectItem value="salesperson" className="hover:bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>Por vendedor</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {/* Secondary selector for specific segment/salesperson */}
          {(selectedFilter === "segment" || selectedFilter === "salesperson") && (
            <Select 
              value={globalFilter.value || ""} 
              onValueChange={(value) => {
                onFilterChange({ 
                  type: selectedFilter as "segment" | "salesperson", 
                  value 
                });
              }}
            >
              <SelectTrigger className="w-56 bg-card border border-border/50 shadow-sm">
                <SelectValue placeholder={
                  selectedFilter === "segment" ? "Selecciona segmento" : "Selecciona vendedor"
                } />
              </SelectTrigger>
              <SelectContent className="border border-border/50 shadow-lg max-h-60 overflow-y-auto">
                {selectedFilter === "segment" ? (
                  segments?.map((segment) => (
                    <SelectItem key={segment} value={segment} className="hover:bg-muted/50">
                      {segment}
                    </SelectItem>
                  ))
                ) : (
                  salespeople?.map((salesperson) => (
                    <SelectItem key={salesperson} value={salesperson} className="hover:bg-muted/50">
                      {salesperson}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* No results message */}
      {filteredGoals.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay metas {selectedFilter === "all" ? "" : getFilterLabel(selectedFilter).toLowerCase()}
            </h3>
            <p className="text-muted-foreground">
              {selectedFilter === "all" 
                ? "Configura tu primera meta para empezar a monitorear el progreso."
                : `No tienes metas configuradas para ${getFilterLabel(selectedFilter).toLowerCase()}.`
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Global Goals - Enhanced Design */}
      {globalGoals.length > 0 && (
        <div className="space-y-4">
          {globalGoals.map((goal) => (
            <Card key={goal.id} className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Meta Global - {goal.period}</h3>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    )}
                  </div>
                </div>
                {goal.isCompleted ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Completada</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="text-xl font-bold text-foreground">
                      {goal.percentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">progreso</div>
                  </div>
                )}
              </div>

              {/* Compact Progress Bar */}
              <div className="space-y-2 mb-3">
                <Progress 
                  value={goal.percentage} 
                  className="h-2"
                  data-testid={`progress-global-${goal.id}`}
                />
              </div>

              {/* Compact Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Actual</div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatCurrency(goal.currentSales)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Meta</div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatCurrency(goal.targetAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {goal.isCompleted ? "Excedente" : "Falta"}
                  </div>
                  <div className={`text-sm font-semibold ${goal.isCompleted ? "text-green-600" : "text-red-600"}`}>
                    {goal.isCompleted ? "✓" : formatCurrency(goal.remaining)}
                  </div>
                </div>
              </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Specific Goals - Enhanced Cards or Full Width */}
      {specificGoals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>
              {selectedFilter === "segment" ? "Metas por Segmento" : 
               selectedFilter === "salesperson" ? "Metas por Vendedor" : 
               "Metas Específicas"}
            </span>
          </h3>
          
          {/* Full Width Display for Filtered Goals */}
          {shouldShowFullWidth ? (
            <div className="space-y-4">
              {specificGoals.map((goal) => (
                <Card key={goal.id} className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getTypeIcon(goal.type)}
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {goal.target} - {goal.period}
                          </h3>
                          {goal.description && (
                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                          )}
                        </div>
                      </div>
                      {goal.isCompleted ? (
                        <div className="flex items-center space-x-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">Completada</span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="text-xl font-bold text-foreground">
                            {goal.percentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">progreso</div>
                        </div>
                      )}
                    </div>

                    {/* Compact Progress Bar */}
                    <div className="space-y-2 mb-3">
                      <Progress 
                        value={goal.percentage} 
                        className="h-2"
                        data-testid={`progress-specific-${goal.id}`}
                      />
                    </div>

                    {/* Compact Stats */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xs text-muted-foreground">Actual</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatCurrency(goal.currentSales)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Meta</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatCurrency(goal.targetAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {goal.isCompleted ? "Excedente" : "Falta"}
                        </div>
                        <div className={`text-sm font-semibold ${goal.isCompleted ? "text-green-600" : "text-red-600"}`}>
                          {goal.isCompleted ? "✓" : formatCurrency(goal.remaining)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Regular Card Grid Display */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {specificGoals.map((goal) => (
                <Card key={goal.id} className="hover:shadow-md transition-shadow border border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(goal.type)}
                        <span className="text-xs font-medium text-muted-foreground">
                          {getTypeLabel(goal.type)}
                        </span>
                      </div>
                      {goal.isCompleted ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-xs font-semibold text-foreground">
                          {goal.percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    
                    <h4 className="text-sm font-semibold text-foreground mb-1 truncate">
                      {goal.target}
                    </h4>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {goal.period}
                    </p>

                    {/* Mini Progress Bar */}
                    <Progress 
                      value={goal.percentage} 
                      className="h-1 mb-2"
                      data-testid={`progress-${goal.id}`}
                    />

                    {/* Compact Stats */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Actual:</span>
                        <span className="font-medium">
                          {formatCurrency(goal.currentSales)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Meta:</span>
                        <span className="font-medium">
                          {formatCurrency(goal.targetAmount)}
                        </span>
                      </div>
                      {!goal.isCompleted && (
                        <div className="flex justify-between text-xs">
                          <span className="text-red-600">Falta:</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(goal.remaining)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}