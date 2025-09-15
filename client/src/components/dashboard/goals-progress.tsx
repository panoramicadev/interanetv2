import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, CheckCircle, AlertCircle, TrendingDown, Clock, AlertTriangle, Building, Users } from "lucide-react";

export interface GoalProgress {
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
    type: "all" | "global" | "segment" | "salesperson";
    value?: string;
  };
  selectedPeriod: string; // Required period for filtering goals
  goalsData?: GoalProgress[]; // Accept external goals data
  isLoading?: boolean; // Accept loading state
}

export default function GoalsProgress({ globalFilter, selectedPeriod, goalsData, isLoading: externalLoading }: GoalsProgressProps) {
  
  const { data: fetchedGoalsProgress, isLoading: fetchedLoading } = useQuery<GoalProgress[]>({
    queryKey: ["/api/goals/progress", selectedPeriod],
    queryFn: async () => {
      const url = selectedPeriod 
        ? `/api/goals/progress?selectedPeriod=${selectedPeriod}`
        : '/api/goals/progress';
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !goalsData, // Only fetch if no external data provided
  });

  // Use external data if provided, otherwise use fetched data
  const goalsProgress = goalsData || fetchedGoalsProgress;
  const isLoading = externalLoading !== undefined ? externalLoading : fetchedLoading;

  // Filter goals based on global filter
  const filteredGoals = goalsProgress?.filter(goal => {
    // If we have a global filter with a specific value, show only goals matching that exact target
    if (globalFilter.type !== "all" && globalFilter.value) {
      return goal.type === globalFilter.type && goal.target === globalFilter.value;
    }
    
    // Otherwise filter by global filter type
    if (globalFilter.type === "all") return true;
    return goal.type === globalFilter.type;
  }) || [];

  const formatCurrency = (amount: number | string | null | undefined) => {
    // Handle null/undefined cases first
    if (amount === null || amount === undefined) {
      return '$0';
    }
    
    // Convert to number safely
    let numericAmount: number;
    if (typeof amount === 'string') {
      // Remove any non-numeric characters except decimal point and minus sign
      const cleanString = amount.replace(/[^-\d.]/g, '');
      numericAmount = parseFloat(cleanString);
    } else if (typeof amount === 'number') {
      numericAmount = amount;
    } else {
      return '$0';
    }
    
    // Check if conversion was successful
    if (isNaN(numericAmount) || !isFinite(numericAmount)) {
      return '$0';
    }
    
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numericAmount);
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

  // Calcular proyección basada en el progreso actual
  const calculateProjection = (goal: GoalProgress) => {
    const currentDate = new Date();
    const goalPeriod = goal.period; // formato "YYYY-MM"
    const [year, month] = goalPeriod.split('-');
    
    // Primer día del mes de la meta
    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    // Último día del mes de la meta
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
    
    // Verificar si el mes ya terminó
    const isMonthClosed = currentDate > endOfMonth;
    
    // Días totales del mes
    const totalDays = endOfMonth.getDate();
    // Días transcurridos desde el inicio del mes
    const currentDay = isMonthClosed ? totalDays : Math.min(currentDate.getDate(), totalDays);
    // Porcentaje del tiempo transcurrido
    const timeProgress = currentDay / totalDays;
    
    // Proyección simple: ventas actuales / tiempo transcurrido * tiempo total
    const projectedSales = timeProgress > 0 ? (goal.currentSales / timeProgress) : 0;
    const projectedPercentage = (projectedSales / goal.targetAmount) * 100;
    
    return {
      projectedSales,
      projectedPercentage,
      timeProgress: timeProgress * 100,
      daysRemaining: totalDays - currentDay,
      isOnTrack: projectedPercentage >= 100,
      isMonthClosed,
      actualPercentage: goal.percentage, // Porcentaje real alcanzado
      pace: projectedPercentage >= 95 ? 'excellent' : 
            projectedPercentage >= 85 ? 'good' : 
            projectedPercentage >= 70 ? 'warning' : 'danger'
    };
  };

  // Generar mensaje motivacional o de advertencia
  const getProjectionMessage = (goal: GoalProgress, projection: ReturnType<typeof calculateProjection>) => {
    const { isMonthClosed, actualPercentage, pace, projectedPercentage, daysRemaining } = projection;
    
    // Si el mes ya cerró, mostrar resultado final
    if (isMonthClosed) {
      const monthName = getMonthName(goal.period);
      
      if (actualPercentage >= 100) {
        return {
          text: `${monthName} cerrado - Meta alcanzada: ${actualPercentage.toFixed(1)}%`,
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200"
        };
      } else if (actualPercentage >= 90) {
        return {
          text: `${monthName} cerrado - Muy cerca: ${actualPercentage.toFixed(1)}% de la meta`,
          icon: Target,
          color: "text-blue-600",
          bgColor: "bg-blue-50 border-blue-200"
        };
      } else {
        return {
          text: `${monthName} cerrado - Meta no alcanzada: ${actualPercentage.toFixed(1)}%`,
          icon: AlertCircle,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200"
        };
      }
    }
    
    // Si está completada durante el mes actual
    if (goal.isCompleted) {
      return {
        text: "¡Felicitaciones! Meta completada exitosamente.",
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-50 border-green-200"
      };
    }

    // Mensajes de proyección para meses en curso
    switch (pace) {
      case 'excellent':
        return {
          text: `¡Excelente ritmo! Al paso actual llegarás al ${projectedPercentage.toFixed(1)}% de la meta. ¡Sigue así!`,
          icon: TrendingUp,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200"
        };
      case 'good':
        return {
          text: `Buen progreso. Proyectado: ${projectedPercentage.toFixed(1)}% de la meta. Quedan ${daysRemaining} días.`,
          icon: Target,
          color: "text-blue-600",
          bgColor: "bg-blue-50 border-blue-200"
        };
      case 'warning':
        return {
          text: `¡Acelera el ritmo! Proyección actual: ${projectedPercentage.toFixed(1)}%. Necesitas aumentar las ventas.`,
          icon: Clock,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50 border-yellow-200"
        };
      case 'danger':
        return {
          text: `⚠️ Ritmo insuficiente. Proyección: ${projectedPercentage.toFixed(1)}%. ¡Acción urgente requerida!`,
          icon: AlertTriangle,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200"
        };
      default:
        return {
          text: "Iniciando seguimiento de meta...",
          icon: Target,
          color: "text-gray-600",
          bgColor: "bg-gray-50 border-gray-200"
        };
    }
  };


  // Función para obtener el nombre del mes en español
  const getMonthName = (period: string) => {
    const [year, month] = period.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
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

  // When we have a specific filter (segment/salesperson), treat all goals as full-width
  const shouldShowFullWidth = globalFilter.type !== "all" && globalFilter.value;

  // Separate global goals from specific goals
  const globalGoals = filteredGoals?.filter(goal => goal.type === 'global') || [];
  const specificGoals = filteredGoals?.filter(goal => goal.type !== 'global') || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
        <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Progreso de Metas</h2>
          {globalFilter.type !== "all" && globalFilter.value && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              Filtrando por {globalFilter.type === "segment" ? "segmento" : "vendedor"}: 
              <span className="font-medium ml-1">{globalFilter.value}</span>
            </p>
          )}
        </div>
      </div>

      {/* No results message */}
      {filteredGoals.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay metas {globalFilter.type === "all" ? "" : (globalFilter.type === "segment" ? "de segmento" : "de vendedor")}
            </h3>
            <p className="text-muted-foreground">
              {globalFilter.type === "all" 
                ? "Configura tu primera meta para empezar a monitorear el progreso."
                : `No tienes metas configuradas para ${globalFilter.type === "segment" ? "segmentos" : "vendedores"}.`
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Global Goals - Enhanced Design */}
      {globalGoals.length > 0 && (
        <div className="space-y-4">
          {globalGoals.map((goal) => {
            const projection = calculateProjection(goal);
            const message = getProjectionMessage(goal, projection);
            const MessageIcon = message.icon;
            
            return (
              <Card key={goal.id} className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <Target className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">Meta Global - {goal.period}</h3>
                      {goal.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{goal.description}</p>
                      )}
                    </div>
                  </div>
                  {goal.isCompleted ? (
                    <div className="flex items-center space-x-2 text-green-600 self-start sm:self-center">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm font-medium">Completada</span>
                    </div>
                  ) : (
                    <div className="text-left sm:text-right">
                      <div className="text-lg sm:text-xl font-bold text-foreground">
                        {goal.percentage.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">progreso</div>
                    </div>
                  )}
                </div>

                {/* Proyección y Mensaje Motivacional */}
                <div className={`mb-4 p-3 sm:p-4 rounded-lg border ${message.bgColor}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                    <MessageIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${message.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs sm:text-sm font-medium ${message.color} leading-relaxed`}>
                        {message.text}
                      </p>
                      {!goal.isCompleted && (
                        <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          Tiempo transcurrido: {projection.timeProgress.toFixed(1)}% • Proyección: {formatCurrency(projection.projectedSales)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Progress Bar */}
                <div className="space-y-2 mb-4">
                  <Progress 
                    value={goal.percentage} 
                    className="h-2 sm:h-3"
                    data-testid={`progress-global-${goal.id}`}
                  />
                </div>

                {/* Mobile-Optimized Stats */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div className="p-2 sm:p-0">
                    <div className="text-xs text-muted-foreground mb-1">Actual</div>
                    <div className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap overflow-hidden">
                      {formatCurrency(goal.currentSales)}
                    </div>
                  </div>
                  <div className="p-2 sm:p-0">
                    <div className="text-xs text-muted-foreground mb-1">Meta</div>
                    <div className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap overflow-hidden">
                      {formatCurrency(goal.targetAmount)}
                    </div>
                  </div>
                  <div className="p-2 sm:p-0">
                    <div className="text-xs text-muted-foreground mb-1">
                      {goal.isCompleted ? "Excedente" : "Falta"}
                    </div>
                    <div className={`text-xs sm:text-sm font-semibold whitespace-nowrap overflow-hidden ${goal.isCompleted ? "text-green-600" : "text-red-600"}`}>
                      {goal.isCompleted ? "✓" : formatCurrency(goal.remaining)}
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Specific Goals - Show when filtered */}
      {specificGoals.length > 0 && shouldShowFullWidth && (
        <div className="space-y-4">
          {specificGoals.map((goal) => {
            const projection = calculateProjection(goal);
            const message = getProjectionMessage(goal, projection);
            const MessageIcon = message.icon;
            
            return (
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

                  {/* Proyección y Mensaje Motivacional */}
                  <div className={`mb-4 p-3 rounded-lg border ${message.bgColor}`}>
                    <div className="flex items-center space-x-3">
                      <MessageIcon className={`h-5 w-5 ${message.color}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${message.color}`}>
                          {message.text}
                        </p>
                        {!goal.isCompleted && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Tiempo transcurrido: {projection.timeProgress.toFixed(1)}% • Proyección: {formatCurrency(projection.projectedSales)}
                          </div>
                        )}
                      </div>
                    </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}