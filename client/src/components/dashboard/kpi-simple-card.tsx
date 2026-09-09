import type { LucideIcon } from "lucide-react";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";
import {
  KPI_CHIP_FILA,
  KPI_CIFRA,
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
}: TarjetaKpiProps) {
  return (
    <div
      className={`${KPI_TARJETA} ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className={KPI_CHIP_FILA}>
        <div className={ICONO_CHIP}>
          <Icono className={ICONO_CHIP_ICONO} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className={KPI_TITULO}>{titulo}</p>
        </div>

        <p className={KPI_CIFRA} data-testid={testId} title={valor}>
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
                  <span className="truncate" title={detalle.valor}>
                    {detalle.valor}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
