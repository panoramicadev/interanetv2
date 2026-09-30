import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Network } from "lucide-react";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";

// Desglose de una cadena por sucursal, en la ficha de su casa matriz (REDMAT).
//
// Desde que cada venta lleva el nombre de su ferretería, la cadena ya no se ve
// como un bloque en los rankings. Esta tarjeta devuelve la vista consolidada
// donde corresponde —la ficha de la matriz— con cuánto aporta cada ferretería,
// para poder cuadrar el total contra el desglose sin que nada se cuente dos veces.
//
// El servidor usa las mismas condiciones que las tarjetas de arriba (cliente,
// período, sin guías), así el total de acá tiene que ser igual a "Compras
// Totales". Se compara y se dice explícito.

interface SucursalDeCadena {
  nombre: string;
  total: number;
  documentos: number;
  esMatriz: boolean;
}

interface DesgloseCadena {
  cadena: string;
  total: number;
  sucursales: SucursalDeCadena[];
}

const pesos = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n || 0);

const porcentaje = (parte: number, total: number) =>
  total > 0 ? `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format((parte / total) * 100)}%` : "—";

/** Nombre de la cadena sin la razón social: "REDMAT SPA" → "REDMAT". */
const nombreCorto = (nombre: string) =>
  nombre.replace(/[\s,.]+(SPA|S\.?P\.?A\.?|LTDA\.?|LIMITADA|S\.?A\.?|EIRL)$/i, "").trim() || nombre;

export function CadenaSucursalesCard({
  clientName,
  period,
  filterType,
  comprasTotales,
  onSeleccionarSucursal,
}: {
  clientName: string;
  period: string;
  filterType: string;
  /**
   * "Compras Totales" de la ficha, para mostrar que el desglose cuadra con ella.
   * Sin este dato (en el dashboard, o mientras carga) no se dice nada del cuadre.
   */
  comprasTotales?: number;
  /** Si viene, cada ferretería se puede tocar para ver solo la suya (dashboard). */
  onSeleccionarSucursal?: (nombre: string) => void;
}) {
  const { data } = useQuery<DesgloseCadena | null>({
    queryKey: [
      `/api/sales/client/${encodeURIComponent(clientName)}/cadena?period=${period}&filterType=${filterType}`,
    ],
    enabled: !!clientName,
  });

  // Cliente que no es matriz de una cadena: la tarjeta no existe.
  if (!data) return null;

  const cadena = nombreCorto(data.cadena);
  // Las ferreterías primero, de mayor a menor; lo que no trae prefijo, al final.
  const ferreterias = data.sucursales.filter((s) => !s.esMatriz);
  const sinPrefijo = data.sucursales.filter((s) => s.esMatriz);
  const filas = [...ferreterias, ...sinPrefijo];
  const cuadra = comprasTotales != null && Math.abs(data.total - comprasTotales) < 1;

  return (
    <div
      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      data-testid="card-cadena-sucursales"
    >
      <div className="flex items-start gap-3">
        <div className={ICONO_CHIP}>
          <Network className={ICONO_CHIP_ICONO} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
            Cadena completa · {cadena}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Lo que aporta cada ferretería al total del período.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-orange-50 px-3 py-2.5 dark:bg-orange-500/10">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Total {cadena}</span>
        <span className="text-base font-bold tabular-nums text-gray-900 dark:text-white" data-testid="text-total-cadena">
          {pesos(data.total)}
        </span>
      </div>

      {filas.length === 0 ? (
        <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          Sin compras de la cadena en este período.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {filas.map((s) => {
            const seleccionable = !!onSeleccionarSucursal && !s.esMatriz;
            const contenido = (
              <>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {s.esMatriz ? "Sin orden de compra reconocible" : s.nombre}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {s.esMatriz ? `Queda en ${s.nombre} · ` : ""}
                    {s.documentos} {s.documentos === 1 ? "documento" : "documentos"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{pesos(s.total)}</p>
                  <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{porcentaje(s.total, data.total)}</p>
                </div>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-2 rounded-full ${s.esMatriz ? "bg-slate-400 dark:bg-slate-500" : "bg-[#fd6301]"}`}
                  style={{ width: `${data.total > 0 ? Math.max(0, (s.total / data.total) * 100) : 0}%` }}
                />
              </div>
              </>
            );
            return (
              <li key={s.nombre} data-testid={`fila-cadena-${s.nombre}`}>
                {seleccionable ? (
                  <button
                    type="button"
                    onClick={() => onSeleccionarSucursal!(s.nombre)}
                    className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-orange-50 dark:hover:bg-orange-500/10"
                    title={`Ver solo ${s.nombre}`}
                  >
                    {contenido}
                  </button>
                ) : (
                  contenido
                )}
              </li>
            );
          })}
        </ul>
      )}

      {comprasTotales != null && (
      <div
        className={`mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800 ${
          cuadra ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {cuadra ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span>
          {cuadra
            ? "El total de la cadena cuadra con Compras Totales."
            : `El total de la cadena no cuadra con Compras Totales (${pesos(comprasTotales ?? 0)}).`}
        </span>
      </div>
      )}
    </div>
  );
}
