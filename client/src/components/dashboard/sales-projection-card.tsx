import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, BarChart3, Calendar, Target, ArrowUpRight, ArrowDownRight, Activity, CalendarClock, CalendarDays, CalendarRange } from "lucide-react";

type ProjectionType = 'cierre_mes' | 'siguiente_mes' | 'cierre_semestre' | 'cierre_ano';

interface MonthlyBreakdown {
  month: string;
  projected: number;
  isActual: boolean;
}

interface ProjectionData {
  projection: number | null;
  projectionLabel: string;
  projectionType: string;
  currentSales: number;
  avg12: number;
  avg6: number;
  trend: 'alza' | 'baja' | 'estable';
  yoyChange: number | null;
  samePeriodLastYear: number | null;
  methodology: string;
  elapsedDays: number;
  totalDays: number;
  currentActiveDays: number;
  currentOrders: number;
  bestMonth: { period: string; sales: number } | null;
  worstMonth: { period: string; sales: number } | null;
  monthlyBreakdown: MonthlyBreakdown[];
  justification: string;
  factors: string[];
}

interface SalesProjectionCardProps {
  selectedPeriod: string;
  filterType: string;
  segment?: string;
  salesperson?: string;
  client?: string;
}

const projectionOptions: { value: ProjectionType; label: string; shortLabel: string; icon: any }[] = [
  { value: 'cierre_mes', label: 'Cierre de Mes', shortLabel: 'Mes', icon: CalendarClock },
  { value: 'siguiente_mes', label: 'Siguiente Mes', shortLabel: 'Sig. Mes', icon: CalendarDays },
  { value: 'cierre_semestre', label: 'Cierre Semestre', shortLabel: 'Semestre', icon: CalendarRange },
  { value: 'cierre_ano', label: 'Cierre de Año', shortLabel: 'Año', icon: Calendar },
];

export default function SalesProjectionCard({ selectedPeriod, filterType, segment, salesperson, client }: SalesProjectionCardProps) {
  const [projectionType, setProjectionType] = useState<ProjectionType>('cierre_mes');

  const { data, isLoading } = useQuery<ProjectionData>({
    queryKey: ['/api/sales/projection-insight', selectedPeriod, filterType, segment, salesperson, client, projectionType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      params.append('projectionType', projectionType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/sales/projection-insight?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

  const formatCompact = (amount: number) => {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
    return formatCurrency(amount);
  };

  if (isLoading) {
    return (
      <div className="modern-card p-4 sm:p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!data || !data.projection) {
    return null;
  }

  const TrendIcon = data.trend === 'alza' ? TrendingUp : data.trend === 'baja' ? TrendingDown : Minus;
  const trendColor = data.trend === 'alza' ? 'text-green-600' : data.trend === 'baja' ? 'text-red-600' : 'text-amber-600';
  const trendBg = data.trend === 'alza' ? 'bg-green-50 dark:bg-green-950/30' : data.trend === 'baja' ? 'bg-red-50 dark:bg-red-950/30' : 'bg-amber-50 dark:bg-amber-950/30';
  const trendLabel = data.trend === 'alza' ? 'Tendencia al alza' : data.trend === 'baja' ? 'Tendencia a la baja' : 'Tendencia estable';

  const salesProgressPct = data.projection > 0 ? Math.min((data.currentSales / data.projection) * 100, 100) : 0;

  const showBreakdown = data.monthlyBreakdown && data.monthlyBreakdown.length > 1;

  return (
    <div className="modern-card p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none">
        <BarChart3 className="w-full h-full" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Proyección de Venta
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {data.projectionLabel} — Basado en análisis de 12 y 6 meses
            </p>
          </div>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
          {projectionOptions.map((opt) => {
            const isActive = projectionType === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setProjectionType(opt.value)}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <span className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(data.projection)}
            </span>
            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${trendBg} ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trendLabel}
            </div>
            {data.yoyChange !== null && (
              <span className={`text-xs font-semibold ${data.yoyChange >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center gap-0.5`}>
                {data.yoyChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {data.yoyChange >= 0 ? '+' : ''}{data.yoyChange}% YoY
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-1.5 mb-4">
            {data.factors.map((factor, i) => (
              <p key={i} className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1 flex-shrink-0">
                  <Activity className="w-3 h-3" />
                </span>
                <span>{factor}</span>
              </p>
            ))}
          </div>

          {showBreakdown && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Desglose Mensual</p>
              <div className="flex flex-wrap gap-1.5">
                {data.monthlyBreakdown.map((mb) => (
                  <div
                    key={mb.month}
                    className={`px-2 py-1.5 rounded-lg text-center min-w-[60px] ${
                      mb.isActual 
                        ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                        : 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800'
                    }`}
                  >
                    <p className={`text-[9px] font-semibold ${mb.isActual ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                      {mb.month}
                    </p>
                    <p className={`text-[10px] font-bold ${mb.isActual ? 'text-green-800 dark:text-green-300' : 'text-indigo-800 dark:text-indigo-300'}`}>
                      {formatCompact(mb.projected)}
                    </p>
                    <p className={`text-[8px] ${mb.isActual ? 'text-green-500' : 'text-indigo-400'}`}>
                      {mb.isActual ? 'Real' : 'Proy.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 w-full lg:w-72 space-y-3">
          {data.currentSales > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>{projectionType === 'cierre_ano' ? 'Acumulado año' : projectionType === 'cierre_semestre' ? 'Acumulado semestre' : 'Venta actual'} vs proyección</span>
                <span className="font-semibold">{salesProgressPct.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${salesProgressPct >= 90 ? 'bg-green-500' : salesProgressPct >= 60 ? 'bg-amber-500' : 'bg-red-400'}`}
                  style={{ width: `${salesProgressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Actual: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(data.currentSales)}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">Prom. 6 meses</p>
              <p className="text-xs font-bold text-blue-800 dark:text-blue-300">{formatCurrency(data.avg6)}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-0.5">Prom. 12 meses</p>
              <p className="text-xs font-bold text-purple-800 dark:text-purple-300">{formatCurrency(data.avg12)}</p>
            </div>
          </div>

          {data.samePeriodLastYear !== null && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-0.5">Mismo mes año anterior</p>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{formatCurrency(data.samePeriodLastYear)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
