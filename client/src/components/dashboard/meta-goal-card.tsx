import { ReactNode } from "react";
import { Target } from "lucide-react";
import { useFilter } from "@/contexts/FilterContext";

interface MetaGoalCardProps {
  /** Título de la tarjeta: "Meta Global", "Meta del Segmento", "Meta del Vendedor"... */
  title: string;
  targetAmount: number;
  currentSales: number;
  /** % logrado sobre lo facturado (viene calculado del backend) */
  percentage: number;
  /** Pendiente vivo que suma al combinado */
  nvvTotal?: number;
  gdvTotal?: number;
  /** Período seleccionado (YYYY-MM o YYYY-MM-DD) para saber si el combinado aplica */
  selectedPeriod?: string;
  icon?: ReactNode;
  testId?: string;
  percentageTestId?: string;
  targetTestId?: string;
  currentTestId?: string;
}

/**
 * Tarjeta de meta del dashboard (diseño negro + naranjo de marca).
 *
 * El % grande sigue al interruptor Facturado / Combinado que se elige en las
 * tarjetas KPI: en Combinado muestra el logro incluyendo NVV y GDV, en Facturado
 * solo la plata firme. Es una sola tarjeta compartida por el dashboard principal
 * y las vistas de segmento, sucursal y vendedor, para que no se vea distinta en
 * cada pantalla.
 */
export default function MetaGoalCard({
  title,
  targetAmount,
  currentSales,
  percentage,
  nvvTotal = 0,
  gdvTotal = 0,
  selectedPeriod,
  icon,
  testId,
  percentageTestId,
  targetTestId,
  currentTestId,
}: MetaGoalCardProps) {
  const { showCombined } = useFilter();

  // El combinado (Facturado + NVV + GDV) solo tiene sentido en el mes en curso:
  // en un mes cerrado lo pendiente ya se transformó en facturado.
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentPeriod = selectedPeriod?.startsWith(currentMonthStr) ?? false;

  const combinedTotal = currentSales + nvvTotal + gdvTotal;
  const combinedPercentage = targetAmount > 0 ? (combinedTotal / targetAmount) * 100 : 0;
  const hasCombined = nvvTotal > 0 || gdvTotal > 0;
  const effectiveCombined = showCombined && isCurrentPeriod && hasCombined;
  const displayPercentage = effectiveCombined ? combinedPercentage : (percentage ?? 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);

  return (
    <div
      className="rounded-2xl bg-white dark:bg-slate-900 p-5"
      data-testid={testId}
    >
      <div className="space-y-4">
        {/* Header con título y porcentaje */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#fd6301] rounded-xl p-2.5 shadow-md shadow-[#fd6301]/25 text-white">
              {icon ?? <Target className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
            </div>
          </div>
          <div className="text-right">
            <div
              // El color sigue al modo: negro en Combinado, naranjo en Facturado
              className={`text-2xl font-bold transition-all ${
                effectiveCombined ? 'text-[#0a0a0a] dark:text-white' : 'text-[#fd6301]'
              }`}
              data-testid={percentageTestId}
            >
              {displayPercentage.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Logrado{effectiveCombined ? ' combinado' : ''}
            </p>
          </div>
        </div>

        {/* Meta y ventas en fila.
            Los montos van en peso normal, no en negrita (corrección del usuario,
            ago-2026): sobre los fondos negro y naranjo la negrita se empasta y las dos
            cifras compiten con el % grande, que es el dato principal de la tarjeta. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0a0a0a] border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-white mb-1">Meta Mensual</p>
            <p className="text-lg font-normal text-white" data-testid={targetTestId}>
              {formatCurrency(targetAmount)}
            </p>
          </div>
          <div className="bg-[#fd6301] rounded-xl p-3 shadow-sm shadow-[#fd6301]/25">
            <p className="text-[10px] uppercase tracking-wider font-bold text-white mb-1">
              {effectiveCombined ? 'Total Combinado' : 'Ventas Actuales'}
            </p>
            <p className="text-lg font-normal text-white" data-testid={currentTestId}>
              {formatCurrency(effectiveCombined ? combinedTotal : currentSales)}
            </p>
          </div>
        </div>

        {/* Barras de progreso: gruesa = facturado, fina = combinado */}
        <div className="space-y-1">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                (percentage ?? 0) >= 100
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                  : 'bg-gradient-to-r from-[#fd6301] to-[#e35400]'
              }`}
              style={{ width: `${Math.min(percentage ?? 0, 100)}%` }}
            />
          </div>

          {hasCombined && (
            <div className="space-y-0.5">
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    combinedPercentage >= 100
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                      : 'bg-gradient-to-r from-slate-700 to-[#0a0a0a]'
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
}
