import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Building, Users } from "lucide-react";
import { useFilter } from "@/contexts/FilterContext";

interface NVVMetrics {
  totalAmount: number;
  totalQuantity: number;
  pendingCount: number;
  confirmedCount: number;
  deliveredCount: number;
  cancelledCount: number;
}

interface GDVMetrics {
  gdvSales: number;
  gdvCount: number;
}

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
  // Modo Facturado / Combinado compartido con las tarjetas KPI del dashboard
  const { showCombined } = useFilter();

  // El combinado (Facturado + NVV + GDV) solo tiene sentido en el mes en curso:
  // en un mes cerrado lo pendiente ya se transformó en facturado.
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentPeriod = selectedPeriod?.startsWith(currentMonthStr) ?? false;

  
  const { data: fetchedGoalsProgress, isLoading: fetchedLoading } = useQuery<GoalProgress[]>({
    queryKey: ["/api/goals/progress", selectedPeriod, globalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPeriod) {
        params.append('selectedPeriod', selectedPeriod);
      }
      if (globalFilter.type !== "all") {
        params.append('type', globalFilter.type);
        if (globalFilter.value) {
          params.append('target', globalFilter.value);
        }
      }
      const url = `/api/goals/progress${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !goalsData, // Only fetch if no external data provided
  });

  // Query NVV totals for combined progress bar - uses same API as Documentos Pendientes
  // This ensures Total Combinado matches the breakdown shown in Documentos Pendientes
  const { data: nvvForProgress } = useQuery<Array<{ totalAmount: number }>>({
    queryKey: ['/api/nvv/all-by-salespeople', 'goals-combined', globalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (globalFilter.type === 'salesperson' && globalFilter.value) {
        params.append('salesperson', globalFilter.value);
      } else if (globalFilter.type === 'segment' && globalFilter.value) {
        params.append('segment', globalFilter.value);
      }
      
      const res = await fetch(`/api/nvv/all-by-salespeople?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Query GDV totals for combined progress bar - uses same API as Documentos Pendientes
  const { data: gdvForProgress } = useQuery<Array<{ totalAmount: number }>>({
    queryKey: ['/api/gdv/all-by-salespeople', 'goals-combined', globalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (globalFilter.type === 'salesperson' && globalFilter.value) {
        params.append('salesperson', globalFilter.value);
      } else if (globalFilter.type === 'segment' && globalFilter.value) {
        params.append('segment', globalFilter.value);
      }

      const res = await fetch(`/api/gdv/all-by-salespeople?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  // Use external data if provided, otherwise use fetched data
  const goalsProgress = goalsData || fetchedGoalsProgress;
  const isLoading = externalLoading !== undefined ? externalLoading : fetchedLoading;
  
  // Calculate combined total for progress bar (ventas + NVV + GDV)
  const nvvTotal = nvvForProgress?.reduce((s: number, sp: { totalAmount: number }) => s + sp.totalAmount, 0) || 0;
  const gdvTotal = gdvForProgress?.reduce((s: number, sp: { totalAmount: number }) => s + sp.totalAmount, 0) || 0;

  // Normalize function to handle case and accent insensitive comparison
  const normalize = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
      .toLowerCase()
      .trim();
  };

  // Filter goals based on global filter
  const filteredGoals = goalsProgress?.filter(goal => {
    // If we have a global filter with a specific value, show only goals matching that target
    if (globalFilter.type !== "all" && globalFilter.value) {
      return goal.type === globalFilter.type && normalize(goal.target) === normalize(globalFilter.value);
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
      default: return <Target className="h-5 w-5" />;
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

      {/* Global Goals - Clean Design */}
      {globalGoals.length > 0 && (
        <div className="space-y-4">
          {globalGoals.map((goal) => {
            const combinedTotal = goal.currentSales + nvvTotal + gdvTotal;
            const combinedPercentage = goal.targetAmount > 0
              ? (combinedTotal / goal.targetAmount) * 100
              : 0;
            const hasCombined = nvvTotal > 0 || gdvTotal > 0;
            // El % grande sigue al interruptor Facturado / Combinado
            const effectiveCombined = showCombined && isCurrentPeriod && hasCombined;
            const displayPercentage = effectiveCombined ? combinedPercentage : (goal.percentage ?? 0);
            return (
              <div key={goal.id} className="rounded-2xl shadow-sm border border-gray-200 bg-white dark:bg-slate-900 dark:border-gray-700 p-5">
                <div className="space-y-4">
                  {/* Header con título y porcentaje */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#fd6301] rounded-xl p-2.5 shadow-md shadow-[#fd6301]/25 text-white">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Meta Global</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      {/* El color sigue al modo: negro en Combinado, naranjo en Facturado */}
                      <div className={`text-2xl font-bold transition-all ${
                        effectiveCombined ? 'text-[#0a0a0a] dark:text-white' : 'text-[#fd6301]'
                      }`}>
                        {displayPercentage.toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Logrado{effectiveCombined ? ' combinado' : ''}
                      </p>
                    </div>
                  </div>
                  
                  {/* Meta y Ventas Actuales en fila */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0a0a0a] border border-slate-800/80 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-white mb-1">Meta Mensual</p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(goal.targetAmount)}
                      </p>
                    </div>
                    <div className="bg-[#fd6301] rounded-xl p-3 shadow-sm shadow-[#fd6301]/25">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-white mb-1">
                        {effectiveCombined ? 'Total Combinado' : 'Ventas Actuales'}
                      </p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(effectiveCombined ? combinedTotal : goal.currentSales)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Barra de progreso - Ventas Actuales */}
                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          (goal.percentage ?? 0) >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-[#fd6301] to-[#e35400]'
                        }`}
                        style={{ width: `${Math.min(goal.percentage ?? 0, 100)}%` }}
                      />
                    </div>
                    
                    {/* Segunda barra de progreso - Total Combinado (Ventas + NVV + GDV) */}
                    {hasCombined && (
                        <div className="space-y-0.5">
                          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                combinedPercentage >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-slate-700 to-[#0a0a0a]'
                              }`}
                              style={{ width: `${Math.min(combinedPercentage, 100)}%` }}
                            />
                          </div>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Specific Goals - Show when filtered */}
      {specificGoals.length > 0 && shouldShowFullWidth && (
        <div className="space-y-4">
          {specificGoals.map((goal) => {
            const combinedTotal = goal.currentSales + nvvTotal + gdvTotal;
            const combinedPercentage = goal.targetAmount > 0
              ? (combinedTotal / goal.targetAmount) * 100
              : 0;
            const hasCombined = nvvTotal > 0 || gdvTotal > 0;
            // El % grande sigue al interruptor Facturado / Combinado
            const effectiveCombined = showCombined && isCurrentPeriod && hasCombined;
            const displayPercentage = effectiveCombined ? combinedPercentage : (goal.percentage ?? 0);
            return (
              <div key={goal.id} className="rounded-2xl shadow-sm border border-gray-200 bg-white dark:bg-slate-900 dark:border-gray-700 p-5">
                <div className="space-y-4">
                  {/* Header con título y porcentaje */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#fd6301] rounded-xl p-2.5 shadow-md shadow-[#fd6301]/25 text-white">
                        {getTypeIcon(goal.type)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                          {getTypeLabel(goal.type)}: {goal.target}
                        </h3>
                      </div>
                    </div>
                    <div className="text-right">
                      {/* El color sigue al modo: negro en Combinado, naranjo en Facturado */}
                      <div className={`text-2xl font-bold transition-all ${
                        effectiveCombined ? 'text-[#0a0a0a] dark:text-white' : 'text-[#fd6301]'
                      }`}>
                        {displayPercentage.toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Logrado{effectiveCombined ? ' combinado' : ''}
                      </p>
                    </div>
                  </div>
                  
                  {/* Meta y Ventas Actuales en fila */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0a0a0a] border border-slate-800/80 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-white mb-1">Meta Mensual</p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(goal.targetAmount)}
                      </p>
                    </div>
                    <div className="bg-[#fd6301] rounded-xl p-3 shadow-sm shadow-[#fd6301]/25">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-white mb-1">
                        {effectiveCombined ? 'Total Combinado' : 'Ventas Actuales'}
                      </p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(effectiveCombined ? combinedTotal : goal.currentSales)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        (goal.percentage ?? 0) >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-[#fd6301] to-[#e35400]'
                      }`}
                      style={{ width: `${Math.min(goal.percentage ?? 0, 100)}%` }}
                    />
                  </div>

                    {/* Segunda barra de progreso - Total Combinado (Ventas + NVV + GDV) */}
                    {hasCombined && (
                        <div className="space-y-0.5">
                          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                combinedPercentage >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-slate-700 to-[#0a0a0a]'
                              }`}
                              style={{ width: `${Math.min(combinedPercentage, 100)}%` }}
                            />
                          </div>
                        </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}