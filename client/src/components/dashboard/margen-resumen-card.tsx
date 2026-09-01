import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Percent, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { mesEs } from "@/lib/fecha-es";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";

// Tarjeta de margen que acompaña a cualquier dashboard.
//
// Muestra el margen del MISMO recorte que la pantalla ya está mostrando: se le
// pasan los mismos filtros que usan las tarjetas de ventas (período + segmento /
// sucursal / vendedor / cliente / producto / agrupación) y el servidor devuelve
// el margen de ese recorte.
//
// Se calcula sobre lo FACTURADO (facturas menos notas de crédito) y SIN el flete,
// que es un cargo traspasado y no mercadería. Los pedidos y las guías pendientes
// del modo "Combinado" tampoco entran porque todavía no tienen costo real — por eso
// el pie de la tarjeta lo dice de forma explícita.

interface MargenResumen {
  dateRange: { startDate: string; endDate: string };
  prevDateRange: { startDate: string; endDate: string };
  comparacion: "mes-anterior" | "ventana-anterior";
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  productCount: number;
  prev: { revenue: number; cost: number; margin: number; marginPct: number };
  deltaPctPoints: number | null;
}

export interface MargenResumenCardProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
  /** Agrupación comercial (nofmpr), la que usa el Dashboard de Productos */
  family?: string;
  /** Sucursal según la definición de sucursales del dashboard */
  branch?: string;
  className?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));

const formatPct = (value: number) =>
  `${value.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// Rango de fechas en español y con el mes completo: "1–29 de julio 2026". La
// comparación no sirve de nada si no se ve contra qué es, así que va escrita en la
// tarjeta, no solo al pasar el mouse: es la primera pregunta que hace cualquiera al
// ver una variación.
function rangoEnPalabras(r?: { startDate: string; endDate: string }): string | null {
  if (!r?.startDate || !r?.endDate) return null;
  const [ay, am, ad] = r.startDate.split("-").map(Number);
  const [by, bm, bd] = r.endDate.split("-").map(Number);
  if (!ay || !by) return null;
  const mesA = mesEs(am - 1);
  const mesB = mesEs(bm - 1);
  if (ay === by && am === bm) return `${ad}–${bd} de ${mesA} ${ay}`;
  if (ay === by) return `${ad} de ${mesA} – ${bd} de ${mesB} ${ay}`;
  return `${ad} de ${mesA} ${ay} – ${bd} de ${mesB} ${by}`;
}

// Bajada de la tarjeta: dice en palabras a qué está acotado el margen que se ve,
// para que no se confunda con el margen de toda la empresa.
function buildScopeLabel(p: MargenResumenCardProps): string {
  if (p.client) return `Cliente: ${p.client}`;
  if (p.product) return `Producto: ${p.product}`;
  if (p.family) return `Agrupación: ${p.family}`;
  if (p.salesperson) return `Vendedor: ${p.salesperson}`;
  if (p.branch) return `Sucursal: ${p.branch}`;
  if (p.segment) return `Segmento: ${p.segment}`;
  return "Todo lo que estás viendo";
}

export default function MargenResumenCard(props: MargenResumenCardProps) {
  const { selectedPeriod, filterType, segment, salesperson, client, product, family, branch, className } = props;

  const queryString = (() => {
    const params = new URLSearchParams();
    params.append("period", selectedPeriod);
    params.append("filterType", filterType);
    if (segment) params.append("segment", segment);
    if (salesperson) params.append("salesperson", salesperson);
    if (client) params.append("client", client);
    if (product) params.append("product", product);
    if (family) params.append("family", family);
    if (branch) params.append("branch", branch);
    return params.toString();
  })();

  const { data, isLoading, isError } = useQuery<MargenResumen>({
    queryKey: ["/api/margen/resumen", queryString],
    queryFn: async () => {
      const res = await apiRequest(`/api/margen/resumen?${queryString}`);
      return res.json();
    },
    enabled: !!selectedPeriod && !!filterType,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const scopeLabel = buildScopeLabel(props);

  return (
    <div
      className={`modern-card p-3 sm:p-5 lg:p-6 hover-lift relative overflow-hidden ${className || ""}`}
      data-testid="card-margen-resumen"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 mb-2 lg:mb-0 min-w-0">
          {/* Sin bajada de contexto (corrección del usuario, ago-2026): antes acá decía
              a qué estaba acotado el margen ("Segmento: INDUSTRIAL", "Todo lo que estás
              viendo") y sobraba, porque el recorte ya se ve en el selector de arriba y en
              el resto de las tarjetas. Se conserva como texto al pasar el mouse. */}
          {/* El hueco del ícono va solo acá, no en todo el bloque: si no, en celular le
              come ancho a las cifras y quedan cortadas. */}
          <div className="flex items-center justify-between mb-1 sm:mb-2 gap-2 pr-12 sm:pr-16 lg:pr-0">
            <p
              className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white"
              title={scopeLabel}
            >
              Margen
            </p>
          </div>

          {isLoading && !data ? (
            <div className="flex items-center gap-2 py-3 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Calculando…</span>
            </div>
          ) : isError ? (
            <p className="py-3 text-sm text-gray-500 dark:text-gray-400">
              No se pudo calcular el margen de este período.
            </p>
          ) : (
            <>
              {/* La cifra grande va en el mismo negro que las otras tres tarjetas del
                  bloque (corrección del usuario, ago-2026). Estaba en naranjo y era la
                  única distinta. El acento naranjo queda para la variación, igual que
                  el "+17,8%" de Ventas Totales. */}
              <p
                className="text-xl min-[400px]:text-2xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-bold text-gray-900 dark:text-white mb-1"
                data-testid="text-margen-pct"
              >
                {formatPct(data?.marginPct ?? 0)}
              </p>

              {/* La variación y el período comparado van juntos en su propia línea,
                  debajo del porcentaje (pedido del usuario, ago-2026). Es el mismo orden
                  que usa Ventas Totales: primero la cifra, y debajo contra qué se compara. */}
              {data?.deltaPctPoints != null && (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className={`text-sm sm:text-base lg:text-lg font-semibold ${data.deltaPctPoints >= 0 ? "text-[#fd6301]" : "text-red-600"}`}
                    title={`Variación en puntos porcentuales contra ${rangoEnPalabras(data.prevDateRange) || "el período anterior"}`}
                    data-testid="text-margen-delta"
                  >
                    {data.deltaPctPoints >= 0 ? "+" : ""}
                    {data.deltaPctPoints.toLocaleString("es-CL", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    pts
                  </span>
                  {rangoEnPalabras(data.prevDateRange) && (
                    <span
                      className="text-xs lg:text-sm text-gray-400 dark:text-gray-500"
                      data-testid="text-margen-comparacion"
                    >
                      vs {rangoEnPalabras(data.prevDateRange)}
                    </span>
                  )}
                </div>
              )}

              {/* El monto del margen pasó a llamarse "Beneficio" y a mostrarse con el
                  mismo formato de "Ventas sin flete" y "Costo" (pedido del usuario,
                  ago-2026): antes iba suelto y en grande arriba del grupo. */}
              <div className="mt-3 space-y-1.5 text-sm lg:text-base pt-2">
                <div className="flex items-baseline gap-2 lg:justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Beneficio:</span>
                  <span
                    className="font-medium text-gray-700 dark:text-gray-300 truncate"
                    title={formatCurrency(data?.margin ?? 0)}
                    data-testid="text-margen-monto"
                  >
                    {formatCurrency(data?.margin ?? 0)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 lg:justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Ventas sin flete:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                    {formatCurrency(data?.revenue ?? 0)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 lg:justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Costo:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                    {formatCurrency(data?.cost ?? 0)}
                  </span>
                </div>
              </div>

              {/* Nota al pie: en celular no se muestra (pedido del usuario, ago-2026),
                  porque ocupaba casi un tercio de la tarjeta. En pantalla grande sigue
                  visible, que es donde hay espacio de sobra para la aclaración. */}
              <p className="hidden md:block mt-3 pb-1 text-xs lg:text-sm leading-snug text-gray-400 dark:text-gray-500">
                Sobre lo facturado del período (facturas menos notas de crédito), sin el flete.
                No incluye pedidos ni guías pendientes.
              </p>
            </>
          )}
        </div>

        <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 lg:static lg:ml-4 transition-transform hover:scale-105 ${ICONO_CHIP}`}>
          <Percent className={ICONO_CHIP_ICONO} />
        </div>
      </div>
    </div>
  );
}
