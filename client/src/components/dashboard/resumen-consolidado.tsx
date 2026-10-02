import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { DollarSign, Package, Receipt, Users, FileText } from "lucide-react";
import TarjetaKpi from "@/components/dashboard/kpi-simple-card";
import { KPI_TARJETA } from "@/lib/kpi-tarjeta";
import { mesEs } from "@/lib/fecha-es";

// Resumen consolidado de una selección de VARIOS períodos.
//
// Cuando en el dashboard se eligen cuatro meses, el gráfico comparativo muestra una
// barra por mes — pero la primera pregunta es cuánto suma todo junto y cómo le fue
// contra el mismo tramo del año pasado. Esta fila de tarjetas responde eso y va ARRIBA
// de los gráficos.
//
// Los números NO se suman en el cliente: "clientes activos" y "clientes nuevos" son
// cuentas de distintos, y sumar mes a mes cuenta dos veces a quien compró en dos meses.
// El servidor consulta una sola vez sobre la unión de los tramos elegidos
// (/api/sales/metrics/consolidado), así que también sale bien cuando la selección tiene
// huecos (enero, marzo y abril).

interface MetricasConsolidadas {
  totalSales: number;
  totalTransactions: number;
  salesTransactionCount: number;
  totalOrders: number;
  totalUnits: number;
  activeCustomers: number;
  gdvSales: number;
  /** `null` cuando no se puede contar con el recorte pedido (sucursal). */
  newClients: number | null;
}

interface RespuestaConsolidado {
  periodos: number;
  tramos: Array<{ startDate: string; endDate: string }>;
  rango: { startDate: string; endDate: string };
  rangoAnterior: { startDate: string; endDate: string };
  actual: MetricasConsolidadas;
  anterior: MetricasConsolidadas;
}

export interface ResumenConsolidadoProps {
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
  /** Sucursal según la definición de sucursales del dashboard. */
  branch?: string;
}

const formatearMoneda = (valor: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(valor));

const formatearNumero = (valor: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(valor);

/**
 * Variación porcentual lista para mostrar. `null` cuando el tramo del año anterior no
 * tiene nada con qué comparar: "+100%" sobre cero no dice nada y engaña.
 */
function variacion(actual: number, anterior: number): string | null {
  if (!anterior) return null;
  const pct = ((actual - anterior) / anterior) * 100;
  const signo = pct > 0 ? "+" : "";
  return `${signo}${pct.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Rango de fechas en palabras: "1 de enero – 30 de abril 2026". La comparación no sirve
// si no se ve contra qué es, así que va escrita en la tarjeta y no solo en el tooltip.
function rangoEnPalabras(r?: { startDate: string; endDate: string }): string {
  if (!r?.startDate || !r?.endDate) return "";
  const [ay, am, ad] = r.startDate.split("-").map(Number);
  const [by, bm, bd] = r.endDate.split("-").map(Number);
  if (!ay || !by) return "";
  if (ay === by && am === bm) return `${ad}–${bd} de ${mesEs(am - 1)} ${ay}`;
  if (ay === by) return `${ad} de ${mesEs(am - 1)} – ${bd} de ${mesEs(bm - 1)} ${ay}`;
  return `${ad} de ${mesEs(am - 1)} ${ay} – ${bd} de ${mesEs(bm - 1)} ${by}`;
}

/** "4 meses", "3 días", "2 años" — el tamaño de lo que se está sumando. */
function cuantosPeriodos(cantidad: number, filterType: "day" | "month" | "year"): string {
  const unidad =
    filterType === "day" ? (cantidad === 1 ? "día" : "días")
    : filterType === "year" ? (cantidad === 1 ? "año" : "años")
    : cantidad === 1 ? "mes" : "meses";
  return `${cantidad} ${unidad}`;
}

export default function ResumenConsolidado({
  periods,
  segment,
  salesperson,
  client,
  product,
  branch,
}: ResumenConsolidadoProps) {
  const filterType = periods[0]?.filterType ?? "month";
  const listaPeriodos = periods.map(p => p.period).join(",");

  const { data, isLoading, isError } = useQuery<RespuestaConsolidado>({
    queryKey: ["/api/sales/metrics/consolidado", listaPeriodos, filterType, segment, salesperson, client, product, branch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("periods", listaPeriodos);
      params.append("filterType", filterType);
      if (segment) params.append("segment", segment);
      if (salesperson) params.append("salesperson", salesperson);
      if (client) params.append("client", client);
      if (product) params.append("product", product);
      if (branch) params.append("branch", branch);
      const res = await fetch(`/api/sales/metrics/consolidado?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("No se pudo cargar el resumen consolidado");
      return (await res.json()) as RespuestaConsolidado;
    },
    enabled: periods.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (periods.length === 0) return null;

  const cantidad = cuantosPeriodos(periods.length, filterType);

  if (isLoading && !data) {
    return (
      <section aria-busy="true">
        <div className="mb-2 h-4 w-56 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={KPI_TARJETA}>
              <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="mt-3 h-3 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="mt-2 h-6 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="mt-2 h-3 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${KPI_TARJETA} text-sm text-gray-600 dark:text-gray-300`}>
        No pudimos calcular el consolidado de {cantidad}. Volvé a elegir el período o
        recargá la página.
      </div>
    );
  }

  const { actual, anterior } = data;

  // Con huecos en la selección ("enero, marzo y abril") decir "enero – abril" miente, así
  // que el rango en palabras se muestra solo cuando los tramos quedaron pegados y son uno.
  const esContinuo = data.tramos.length === 1;
  const descripcion = esContinuo ? rangoEnPalabras(data.rango) : periods.map(p => p.label).join(" · ");
  // Contra qué se compara va UNA vez, en el encabezado: repetir el rango completo en las
  // cinco tarjetas lo partía en dos líneas y tapaba las cifras, que son lo que se mira.
  const contra = esContinuo
    ? rangoEnPalabras(data.rangoAnterior)
    : `el mismo tramo de ${data.rangoAnterior.startDate.slice(0, 4)}`;

  const ticketActual = actual.totalOrders > 0 ? actual.totalSales / actual.totalOrders : 0;
  const ticketAnterior = anterior.totalOrders > 0 ? anterior.totalSales / anterior.totalOrders : 0;

  const tarjetas = [
    {
      titulo: "Ventas del período",
      valor: formatearMoneda(actual.totalSales),
      icono: DollarSign,
      variacion: variacion(actual.totalSales, anterior.totalSales),
      testId: "consolidado-ventas",
      detalles: [{ etiqueta: "Año anterior", valor: formatearMoneda(anterior.totalSales) }],
    },
    {
      titulo: "Unidades vendidas",
      valor: formatearNumero(actual.totalUnits),
      icono: Package,
      variacion: variacion(actual.totalUnits, anterior.totalUnits),
      testId: "consolidado-unidades",
      detalles: [{ etiqueta: "Año anterior", valor: formatearNumero(anterior.totalUnits) }],
    },
    {
      titulo: "Documentos emitidos",
      valor: formatearNumero(actual.totalOrders),
      icono: FileText,
      variacion: variacion(actual.totalOrders, anterior.totalOrders),
      testId: "consolidado-documentos",
      detalles: [{ etiqueta: "Año anterior", valor: formatearNumero(anterior.totalOrders) }],
    },
    {
      titulo: "Ticket promedio",
      valor: formatearMoneda(ticketActual),
      icono: Receipt,
      variacion: variacion(ticketActual, ticketAnterior),
      testId: "consolidado-ticket",
      detalles: [{ etiqueta: "Año anterior", valor: formatearMoneda(ticketAnterior) }],
    },
    {
      titulo: "Clientes que compraron",
      valor: formatearNumero(actual.activeCustomers),
      icono: Users,
      variacion: variacion(actual.activeCustomers, anterior.activeCustomers),
      testId: "consolidado-clientes",
      // Clientes distintos en TODO el tramo, no la suma de los meses: quien compró en
      // enero y en marzo cuenta una vez. "Nuevos" no viene cuando el recorte es una
      // sucursal — ver la nota del endpoint; en ese caso la fila no se muestra en vez
      // de mostrar un número de toda la empresa.
      detalles: [
        ...(actual.newClients !== null
          ? [{ etiqueta: "Nuevos", valor: formatearNumero(actual.newClients) }]
          : []),
        { etiqueta: "Año anterior", valor: formatearNumero(anterior.activeCustomers) },
      ],
    },
  ];

  return (
    <section data-testid="resumen-consolidado">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Consolidado de {cantidad}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400" title={descripcion}>
          {descripcion} · comparado con {contra}
        </p>
      </div>

      {/* Dos por fila desde 360 px: apiladas de a una se pierde la comparación de un
          vistazo. Bajo 360 sí va una sola columna — en media tarjeta de un iPhone SE el
          total de ventas (trece dígitos) se cortaba con puntos suspensivos. */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {tarjetas.map((t, i) => (
          <TarjetaKpi
            key={t.titulo}
            titulo={t.titulo}
            valor={t.valor}
            icono={t.icono}
            variacion={t.variacion ?? "—"}
            variacionEtiqueta={t.variacion ? "vs año anterior" : "sin dato del año anterior"}
            detalles={t.detalles}
            testId={t.testId}
            // En celular son dos por fila y la quinta quedaba sola dejando un hueco al
            // lado; ocupando el ancho completo la fila cierra y se gana aire para sus
            // dos líneas de detalle.
            className={i === tarjetas.length - 1 ? "min-[360px]:col-span-2 md:col-span-1" : ""}
          />
        ))}
      </div>
    </section>
  );
}
