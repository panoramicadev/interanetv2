import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

type GroupBy = "vendedor" | "segmento" | "cliente";

interface SinCargoRow {
  name: string;
  total: number;
  docs: number;
}

interface SinCargoResponse {
  items: SinCargoRow[];
  periodTotal: number;
  totalDocs: number;
  totalCount: number;
}

interface SinCargoPanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
}

const GROUP_LABELS: Record<GroupBy, { tab: string; singular: string; plural: string }> = {
  vendedor: { tab: "Por vendedor", singular: "vendedor", plural: "vendedores" },
  segmento: { tab: "Por segmento", singular: "segmento", plural: "segmentos" },
  cliente: { tab: "Por cliente", singular: "cliente", plural: "clientes" },
};

/**
 * Ventas con "SIN CARGO" en la orden de compra (muestras y regalos).
 * La agrupación que ya está fija por el filtro de la vista no se ofrece:
 * en el dashboard de un vendedor no tiene sentido "por vendedor".
 */
export default function SinCargoPanel({
  selectedPeriod,
  filterType,
  segment,
  salesperson,
  client,
}: SinCargoPanelProps) {
  const options = (["vendedor", "segmento", "cliente"] as GroupBy[]).filter(
    (g) => !(g === "vendedor" && salesperson) && !(g === "segmento" && segment) && !(g === "cliente" && client),
  );
  const [groupBy, setGroupBy] = useState<GroupBy>(options[0] ?? "cliente");
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useQuery<SinCargoResponse>({
    queryKey: [
      `/api/sales/sin-cargo?groupBy=${groupBy}&limit=${limit}&period=${selectedPeriod}&filterType=${filterType}` +
        `${segment ? `&segment=${encodeURIComponent(segment)}` : ""}` +
        `${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ""}` +
        `${client ? `&client=${encodeURIComponent(client)}` : ""}`,
    ],
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(n || 0);

  const periodTotal = data?.periodTotal || 0;
  const totalDocs = data?.totalDocs || 0;
  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const labels = GROUP_LABELS[groupBy];

  const handleGroupChange = (g: GroupBy) => {
    setGroupBy(g);
    setLimit(10);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#fd6301] rounded-lg flex items-center justify-center flex-shrink-0 shadow-md shadow-[#fd6301]/25">
            <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">Sin cargo</h2>
        </div>

        <div className="text-right">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">
            Total · {totalDocs} {totalDocs === 1 ? "documento" : "documentos"}
          </p>
          <p className="text-sm sm:text-lg font-bold text-[#fd6301]" data-testid="sin-cargo-total">
            {formatCurrency(periodTotal)}
          </p>
        </div>
      </div>

      {options.length > 1 && (
        <div className="inline-flex rounded-2xl bg-slate-100/70 dark:bg-slate-800 p-1 gap-1">
          {options.map((g) => (
            <button
              key={g}
              onClick={() => handleGroupChange(g)}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                groupBy === g
                  ? "bg-white dark:bg-slate-900 text-[#fd6301] shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
              data-testid={`button-sin-cargo-${g}`}
            >
              {GROUP_LABELS[g].tab}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200/60 dark:border-slate-800 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-4 bg-gray-200 rounded w-12" />
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200 rounded" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No hay ventas sin cargo en este período</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((row, index) => {
                const percentage = periodTotal > 0 ? (row.total / periodTotal) * 100 : 0;
                return (
                  <div
                    key={row.name + index}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full py-2 px-1"
                    data-testid={`sin-cargo-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-200 font-medium line-clamp-2 sm:truncate">
                        {row.name}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {row.docs} {row.docs === 1 ? "documento" : "documentos"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right flex-shrink-0">
                        {percentage.toFixed(1)}%
                      </span>
                      <div className="flex-1 sm:flex-none sm:w-32">
                        <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#fd6301] rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white w-20 sm:w-28 text-right flex-shrink-0 tabular-nums">
                        {formatCurrency(row.total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {items.length < totalCount && (
              <div className="flex justify-center pt-4 border-t border-gray-200 dark:border-slate-800 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLimit((p) => p + 10)}
                  className="text-xs px-6 rounded-2xl hover:scale-105 transition-all"
                  data-testid="button-load-more-sin-cargo"
                >
                  Ver más ({items.length} de {totalCount})
                </Button>
              </div>
            )}

            <div className="border-t-2 border-gray-300 dark:border-slate-700 pt-3 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full bg-orange-50 dark:bg-orange-950/30 rounded-lg py-3 px-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-[#fd6301] font-bold">
                    TOTAL ({totalCount} {totalCount === 1 ? labels.singular : labels.plural})
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <span className="text-xs text-[#fd6301] w-10 text-right flex-shrink-0">100%</span>
                  <div className="flex-1 sm:flex-none sm:w-32">
                    <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#fd6301] rounded-full w-full" />
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#fd6301] w-20 sm:w-28 text-right flex-shrink-0 tabular-nums">
                    {formatCurrency(periodTotal)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
