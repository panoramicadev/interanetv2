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

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground flex items-center space-x-2">
        <Target className="h-6 w-6" />
        <span>Progreso de Metas</span>
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goalsProgress.map((goal) => (
          <Card key={goal.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(goal.type)}
                  <Badge variant="secondary">
                    {getTypeLabel(goal.type)}
                  </Badge>
                </div>
                {goal.isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
              </div>
              
              <CardTitle className="text-lg">
                {goal.type === 'global' 
                  ? 'Meta Global' 
                  : `${goal.target}`
                }
              </CardTitle>
              
              <p className="text-sm text-muted-foreground">
                Período: {goal.period}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progreso</span>
                  <span className={`font-semibold ${goal.isCompleted ? 'text-green-600' : 'text-foreground'}`}>
                    {goal.percentage.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={goal.percentage} 
                  className="h-3"
                  data-testid={`progress-${goal.id}`}
                />
              </div>

              {/* Current vs Target */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vendido:</span>
                  <span className="font-medium">
                    {formatCurrency(goal.currentSales)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Meta:</span>
                  <span className="font-medium">
                    {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className={goal.isCompleted ? "text-green-600" : "text-red-600"}>
                    {goal.isCompleted ? "¡Meta alcanzada!" : "Falta:"}
                  </span>
                  <span className={`font-semibold ${goal.isCompleted ? "text-green-600" : "text-red-600"}`}>
                    {goal.isCompleted ? "✓" : formatCurrency(goal.remaining)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {goal.description && (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  {goal.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}