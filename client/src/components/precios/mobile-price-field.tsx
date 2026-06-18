import { ReactNode } from "react";

// Campo etiqueta/valor usado en las tarjetas de precios para móvil.
// Mantiene el mismo lenguaje visual que las celdas de la tabla (valor
// tabular, sub-línea opcional para la fecha del costo, color por tipo).
export function MobilePriceField({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums truncate ${className || "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-[9px] leading-tight text-muted-foreground/60">{sub}</div>}
    </div>
  );
}
