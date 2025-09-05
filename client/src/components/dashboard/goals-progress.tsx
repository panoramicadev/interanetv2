import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Users, Building, CheckCircle, AlertCircle } from "lucide-react";

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

export default function GoalsProgress() {
  const { data: goalsProgress, isLoading } = useQuery<GoalProgress[]>({
    queryKey: ["/api/goals/progress"],
  });

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
  const globalGoals = goalsProgress.filter(goal => goal.type === 'global');
  const specificGoals = goalsProgress.filter(goal => goal.type !== 'global');

  return (
    <div className="space-y-4">
      {/* Global Goals - Subtle Design */}
      {globalGoals.length > 0 && (
        <div className="space-y-3">
          {globalGoals.map((goal) => (
            <div key={goal.id} className="bg-muted/30 border border-border/50 rounded-lg p-4">
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
            </div>
          ))}
        </div>
      )}

      {/* Specific Goals - Compact Cards */}
      {specificGoals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Metas Específicas</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {specificGoals.map((goal) => (
              <div key={goal.id} className="bg-card border border-border/30 rounded-md p-3">
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}