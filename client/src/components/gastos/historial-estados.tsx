/**
 * Timeline unificado de cambios de estado (gastos, informes y fondos).
 *
 * Portado de primerosresultados/rendicion-gastos. Lee
 * GET /api/gastos-historial/:entidad/:entidadId, que devuelve las entradas
 * append-only de `historial_estados_gasto` ordenadas cronológicamente.
 */
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Clock, FileText, Loader2, Send, Wallet, X } from "lucide-react";

export type EntidadHistorial = "gasto" | "informe" | "fondo";

interface EntradaHistorial {
  id: string;
  entidad: string;
  entidadId: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  actorId: string | null;
  actorNombre: string | null;
  comentario: string | null;
  createdAt: string;
}

/** Ícono + color por estado destino. Sirve para las tres entidades. */
const ESTILO_ESTADO: Record<
  string,
  { icono: typeof Check; color: string; fondo: string; etiqueta: string }
> = {
  borrador: { icono: FileText, color: "text-slate-600 dark:text-slate-300", fondo: "bg-slate-100 dark:bg-slate-800", etiqueta: "Borrador" },
  enviado: { icono: Send, color: "text-amber-600 dark:text-amber-400", fondo: "bg-amber-50 dark:bg-amber-950/40", etiqueta: "Enviado a aprobación" },
  pendiente: { icono: Clock, color: "text-amber-600 dark:text-amber-400", fondo: "bg-amber-50 dark:bg-amber-950/40", etiqueta: "Pendiente" },
  aprobado: { icono: Check, color: "text-emerald-600 dark:text-emerald-400", fondo: "bg-emerald-50 dark:bg-emerald-950/40", etiqueta: "Aprobado" },
  rechazado: { icono: X, color: "text-red-600 dark:text-red-400", fondo: "bg-red-50 dark:bg-red-950/40", etiqueta: "Rechazado" },
  pagado: { icono: Wallet, color: "text-sky-600 dark:text-sky-400", fondo: "bg-sky-50 dark:bg-sky-950/40", etiqueta: "Pagado" },
};

const estiloDe = (estado: string) =>
  ESTILO_ESTADO[estado] ?? {
    icono: FileText,
    color: "text-slate-600 dark:text-slate-300",
    fondo: "bg-slate-100 dark:bg-slate-800",
    etiqueta: estado,
  };

export function HistorialEstados({
  entidad,
  entidadId,
  /** Entradas ya cargadas (el detalle del informe las trae). Evita un fetch extra. */
  entradas,
}: {
  entidad: EntidadHistorial;
  entidadId: string;
  entradas?: EntradaHistorial[];
}) {
  const consulta = useQuery<EntradaHistorial[]>({
    queryKey: [`/api/gastos-historial/${entidad}/${entidadId}`],
    enabled: !entradas && !!entidadId,
  });

  const items = entradas ?? consulta.data ?? [];

  if (!entradas && consulta.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Sin movimientos registrados.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 pl-2">
      {items.map((entrada, idx) => {
        const estilo = estiloDe(entrada.estadoNuevo);
        const Icono = estilo.icono;
        const esUltimo = idx === items.length - 1;

        return (
          <li key={entrada.id} className="relative flex gap-3">
            {/* Línea vertical que une los hitos */}
            {!esUltimo && (
              <span
                className="absolute left-[15px] top-9 h-[calc(100%-1rem)] w-px bg-slate-200 dark:bg-slate-700"
                aria-hidden
              />
            )}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${estilo.fondo}`}
            >
              <Icono className={`h-4 w-4 ${estilo.color}`} />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {estilo.etiqueta}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {entrada.actorNombre ?? "Sistema"} ·{" "}
                {entrada.createdAt
                  ? format(new Date(entrada.createdAt), "d MMM yyyy, HH:mm", { locale: es })
                  : "—"}
              </p>
              {entrada.comentario && (
                <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {entrada.comentario}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
