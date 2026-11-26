import type { LucideIcon } from "lucide-react";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";
import {
  KPI_CHIP_FILA,
  kpiCifraClase,
  KPI_DETALLE,
  KPI_DETALLE_ETIQUETA,
  KPI_TARJETA,
  KPI_TITULO,
  KPI_VARIACION,
  KPI_VARIACION_ETIQUETA,
} from "@/lib/kpi-tarjeta";

interface DetalleKpi {
  /** Nombre del dato, va en gris. */
  etiqueta: string;
  valor: string;
}

interface TarjetaKpiProps {
  titulo: string;
  /** Cifra grande, ya formateada. */
  valor: string;
  icono: LucideIcon;
  /** Fila de variación: la cifra destacada (ya con signo) y su etiqueta de contexto. */
  variacion?: string;
  /** Color de esa cifra. Naranjo por defecto; rojo solo si el indicador cae. */
  variacionColor?: string;
  variacionEtiqueta?: string;
  /** Filas del pie, una debajo de otra. */
  detalles?: DetalleKpi[];
  onClick?: () => void;
  testId?: string;
  className?: string;
  /** Centra chip, título y cifra (por defecto van a la izquierda). */
  centrado?: boolean;
  /**
   * Algo pendiente que hay que mirar ya (p. ej. mensajes sin leer): la tarjeta
   * pasa a rojo, el chip late y arriba a la derecha va esta etiqueta.
   */
  alerta?: string;
}

/**
 * Tarjeta de indicador del dashboard, con el diseño de las cuatro tarjetas del bloque
 * superior del dashboard principal: chip naranjo arriba a la izquierda, título, cifra
 * grande en gris oscuro, fila de variación y detalle al pie.
 *
 * Es para las vistas que muestran indicadores simples (sucursal, supervisor, "Mis
 * Vendedores"). El bloque grande del dashboard —con su interruptor Facturado/Combinado,
 * el presupuesto y el margen— vive en `kpi-cards.tsx` y comparte la tipografía a través
 * de `lib/kpi-tarjeta.ts`.
 */
export default function TarjetaKpi({
  titulo,
  valor,
  icono: Icono,
  variacion,
  variacionColor = "text-[#fd6301]",
  variacionEtiqueta,
  detalles,
  onClick,
  testId,
  className = "",
  centrado = false,
  alerta,
}: TarjetaKpiProps) {
  return (
    <div
      className={`${KPI_TARJETA} ${onClick ? "cursor-pointer" : ""} ${centrado ? "text-center" : ""} ${
        alerta ? "!border-2 !border-red-500 !bg-red-50 dark:!bg-red-950/40 shadow-[0_0_18px_rgba(239,68,68,0.35)]" : ""
      } ${className}`}
      onClick={onClick}
    >
      {alerta && (
        <span className="absolute top-2 right-2 sm:top-3 sm:right-3 inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          {alerta}
        </span>
      )}
      <div className={`${KPI_CHIP_FILA} ${centrado ? "justify-center" : ""}`}>
        <div className="relative">
          {/* Onda que late detrás del chip mientras haya algo pendiente */}
          {alerta && (
            <span className="absolute inset-0 rounded-xl bg-red-500 opacity-60 animate-ping motion-reduce:animate-none" />
          )}
          <div className={`${ICONO_CHIP} relative ${alerta ? "!bg-red-500 !shadow-red-500/40" : ""}`}>
            <Icono className={ICONO_CHIP_ICONO} />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className={`flex items-center ${centrado ? "justify-center" : "justify-between"} mb-1 sm:mb-2`}>
          <p className={KPI_TITULO}>{titulo}</p>
        </div>

        {/* El tamaño sale del largo del valor: una cifra de plata se muestra ENTERA,
            nunca recortada con puntos suspensivos. */}
        <p className={`${kpiCifraClase(valor)} ${alerta ? "!text-red-600 dark:!text-red-400" : ""}`} data-testid={testId} title={valor}>
          {valor}
        </p>

        {(variacion || variacionEtiqueta) && (
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {variacion && (
              <span className={`${KPI_VARIACION} ${variacionColor}`}>{variacion}</span>
            )}
            {variacionEtiqueta && (
              <span className={KPI_VARIACION_ETIQUETA}>{variacionEtiqueta}</span>
            )}
          </div>
        )}

        {detalles && detalles.length > 0 && (
          <div className="mt-2 pt-2">
            <div className={`flex flex-col gap-y-1 ${KPI_DETALLE}`}>
              {detalles.map((detalle) => (
                <div key={detalle.etiqueta} className="flex items-baseline gap-x-2 flex-wrap">
                  <span className={KPI_DETALLE_ETIQUETA}>{detalle.etiqueta}:</span>
                  {/* Sin `truncate`: acá abajo también hay cifras de plata y recortarlas
                      con puntos suspensivos es perder el dato. La fila ya es `flex-wrap`,
                      así que si no cabe el valor baja a la línea de abajo, entero. */}
                  <span title={detalle.valor}>{detalle.valor}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
