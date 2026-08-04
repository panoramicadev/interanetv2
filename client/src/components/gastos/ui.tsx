/**
 * Kit visual del módulo Rendición de Gastos.
 *
 * Traduce el lenguaje de primerosresultados/rendicion-gastos (superficies
 * blancas, radios generosos, bordes muy sutiles, montos tabulares, pills de
 * estado en MAYÚSCULAS) a los tokens de Panorámica: naranja de marca #fd6301,
 * `rounded-2xl`, y dark mode con los `slate-*` que usa el resto de la app.
 *
 * Existe para que las seis pantallas del módulo (rendición, informes, fondos,
 * viajes, catálogos y dashboard) compartan una sola definición de tarjeta, KPI,
 * chip de estado y estado vacío, en vez de repetir clases en cada archivo.
 */
import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  Briefcase,
  Car,
  Coins,
  FileText,
  Fuel,
  Package,
  ReceiptText,
  Utensils,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Naranja de marca. Se repite acá para no depender de un token de Tailwind. */
export const MARCA = "#fd6301";

/** Botón primario del módulo. */
export const BOTON_MARCA =
  "bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all rounded-2xl";

/** Superficie base de tarjeta: borde sutil, radio generoso, sombra mínima. */
export const SUPERFICIE =
  "rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900";

// ─── Montos ─────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export const formatoMoneda = (v: string | number | null | undefined) =>
  CLP.format(Number(v ?? 0));

/**
 * Monto en CLP con cifras tabulares. Los montos SIEMPRE van con `tabular-nums`
 * para que las columnas queden alineadas al comparar filas.
 */
export function Monto({
  value,
  className,
}: {
  value: string | number | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>{formatoMoneda(value)}</span>
  );
}

// ─── Chips de estado ────────────────────────────────────────────────────────

/**
 * Un solo mapa para los estados de las tres entidades del módulo. Antes cada
 * pantalla tenía su propio `getEstadoBadge` con colores distintos para el mismo
 * concepto (un "aprobado" se veía diferente en gastos y en fondos).
 */
const ESTADOS: Record<string, { label: string; className: string }> = {
  // Gastos y fondos
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  pendiente_supervisor: { label: "Pend. supervisor", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  pendiente_rrhh: { label: "Pend. RRHH", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  aprobado: { label: "Aprobado", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  rechazado: { label: "Rechazado", className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
  activo: { label: "Activo", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  cerrado: { label: "Cerrado", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  solicitud: { label: "Solicitud", className: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" },
  pendiente_aprobacion: { label: "Por aprobar", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  // Informes de rendición
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  enviado: { label: "En aprobación", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  pagado: { label: "Pagado", className: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" },
};

/** Pill de estado: MAYÚSCULAS, bold y tracking, como en el sistema de origen. */
export function EstadoChip({
  estado,
  label,
  className,
}: {
  estado: string;
  label?: string;
  className?: string;
}) {
  const cfg = ESTADOS[estado] ?? {
    label: estado,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        cfg.className,
        className,
      )}
    >
      {label ?? cfg.label}
    </span>
  );
}

// ─── Íconos por categoría ───────────────────────────────────────────────────

/**
 * Ícono según la categoría del gasto. Las claves son los nombres del catálogo
 * de Panorámica; cualquier categoría nueva cae al ícono de boleta.
 */
const ICONOS_CATEGORIA: Record<string, LucideIcon> = {
  Combustibles: Fuel,
  Peaje: Coins,
  Colación: Utensils,
  "Gestión Ventas": Briefcase,
  Alojamiento: BedDouble,
  Transporte: Car,
  Materiales: Package,
  Mantención: Wrench,
  Otros: ReceiptText,
};

export const iconoCategoria = (categoria?: string | null): LucideIcon =>
  (categoria && ICONOS_CATEGORIA[categoria]) || ReceiptText;

/** Chip circular con el ícono de la categoría. */
export function CategoriaIcono({
  categoria,
  className,
}: {
  categoria?: string | null;
  className?: string;
}) {
  const Icono = iconoCategoria(categoria);
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-orange-50 dark:bg-orange-950/40",
        className,
      )}
    >
      <Icono className="size-[18px] text-[#fd6301]" strokeWidth={1.8} />
    </span>
  );
}

// ─── KPI ────────────────────────────────────────────────────────────────────

/**
 * Tarjeta de indicador con barra de acento a la izquierda. `tono` elige el
 * color del acento sin que cada pantalla tenga que recordar el hex.
 */
export function KpiCard({
  label,
  value,
  sub,
  tono = "marca",
  icono: Icono,
  className,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tono?: "marca" | "ok" | "alerta" | "error" | "info" | "neutro";
  icono?: LucideIcon;
  className?: string;
  /** Va sobre el valor, que es lo que verifican las pruebas. */
  testId?: string;
}) {
  const acento = {
    marca: "bg-[#fd6301]",
    ok: "bg-emerald-500",
    alerta: "bg-amber-500",
    error: "bg-red-500",
    info: "bg-sky-500",
    neutro: "bg-slate-300 dark:bg-slate-600",
  }[tono];

  return (
    <div className={cn("relative overflow-hidden p-4 pl-5", SUPERFICIE, className)}>
      <span className={cn("absolute inset-y-0 left-0 w-1", acento)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {Icono && <Icono className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />}
      </div>
      <p
        className="mt-1.5 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100"
        data-testid={testId}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Estado vacío ───────────────────────────────────────────────────────────

export function EstadoVacio({
  icono: Icono = FileText,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono?: LucideIcon;
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-orange-50 dark:bg-orange-950/40">
        <Icono className="size-6 text-[#fd6301]" strokeWidth={1.8} />
      </span>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{titulo}</p>
      {descripcion && (
        <p className="max-w-sm px-6 text-xs text-slate-500 dark:text-slate-400">
          {descripcion}
        </p>
      )}
      {accion}
    </div>
  );
}

// ─── Encabezado de sección ──────────────────────────────────────────────────

/** Título + bajada + acciones, con el mismo ritmo en las seis pantallas. */
export function EncabezadoSeccion({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{titulo}</h2>
        {descripcion && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
        )}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
